import { daysSince, daysUntil } from "@/lib/utils";
import {
  isActiveStatus,
  isTerminalStatus,
} from "@/lib/pipeline";
import type { ApplicationStatus, Priority } from "@/server/db/schema";

export type ActionKind = "urgent" | "soon" | "info";
export type ActionType =
  | "follow_up"
  | "stale"
  | "interview"
  | "missing_jd"
  | "missing_snapshot"
  | "incomplete"
  | "contact";

export interface ActionSourceApplication {
  id: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  priority: Priority;
  appliedOn: string | null;
  followUpOn: string | null;
  interviewOn: Date | string | null;
  updatedAt: Date | string;
  jobDescription: string | null | undefined;
  resumeSnapshot: string | null | undefined;
  nextStep: string | null;
}

export interface ActionSourceContact {
  id: string;
  name: string;
  company: string | null;
  lastContactedOn: string | null;
  nextTouchOn: string | null;
  cadenceDays: number | null;
}

export interface ActionItem {
  id: string;
  kind: ActionKind;
  type: ActionType;
  title: string;
  meta: string;
  href: string;
  applicationId?: string;
  contactId?: string;
  company?: string;
  role?: string;
}

const KIND_RANK: Record<ActionKind, number> = { urgent: 0, soon: 1, info: 2 };

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function contactDueOn(contact: ActionSourceContact): Date | null {
  const explicit = contact.nextTouchOn
    ? new Date(`${contact.nextTouchOn}T00:00:00`)
    : null;
  const last = contact.lastContactedOn
    ? new Date(`${contact.lastContactedOn}T00:00:00`)
    : null;
  const cadence =
    last && contact.cadenceDays
      ? new Date(last.getTime() + contact.cadenceDays * 86_400_000)
      : null;

  if (explicit && Number.isNaN(explicit.getTime())) return cadence;
  if (explicit && cadence) return explicit < cadence ? explicit : cadence;
  return explicit ?? cadence;
}

export function isStaleApplication(
  app: ActionSourceApplication,
  staleAfterDays: number,
): boolean {
  if (isTerminalStatus(app.status) || app.status === "wishlist") return false;
  if (!isActiveStatus(app.status)) return false;
  const untilFollow = daysUntil(app.followUpOn);
  if (untilFollow !== null && untilFollow >= 0) return false;
  const anchor = app.appliedOn ?? asDate(app.updatedAt);
  const age = daysSince(anchor);
  return age !== null && age >= staleAfterDays;
}

/**
 * Highest-value next moves, ranked so the daily queue is never a dump of
 * every open application.
 */
export function buildActionQueue({
  applications,
  contacts = [],
  staleAfterDays = 14,
}: {
  applications: readonly ActionSourceApplication[];
  contacts?: readonly ActionSourceContact[];
  staleAfterDays?: number;
}): ActionItem[] {
  const out: ActionItem[] = [];

  for (const app of applications) {
    if (isTerminalStatus(app.status)) continue;

    const follow = daysUntil(app.followUpOn);
    if (follow !== null && follow <= 0) {
      out.push({
        id: `follow:${app.id}`,
        kind: "urgent",
        type: "follow_up",
        title: `Follow up with ${app.company}`,
        meta: follow < 0 ? `${Math.abs(follow)}d overdue` : "Due today",
        href: `/applications/${app.id}`,
        applicationId: app.id,
        company: app.company,
        role: app.role,
      });
    } else if (isStaleApplication(app, staleAfterDays)) {
      const age = daysSince(app.appliedOn ?? asDate(app.updatedAt)) ?? 0;
      out.push({
        id: `stale:${app.id}`,
        kind: "soon",
        type: "stale",
        title: `${app.company} has gone quiet`,
        meta: `${age} days since last movement`,
        href: `/applications/${app.id}`,
        applicationId: app.id,
        company: app.company,
        role: app.role,
      });
    }

    const interview = daysUntil(asDate(app.interviewOn));
    if (
      interview !== null &&
      interview >= 0 &&
      interview <= 7 &&
      (app.status === "interview" ||
        app.status === "final" ||
        app.status === "assessment")
    ) {
      out.push({
        id: `interview:${app.id}`,
        kind: interview <= 2 ? "urgent" : "info",
        type: "interview",
        title: `Prepare for ${app.company}`,
        meta: interview === 0 ? "Interview today" : `Interview in ${interview}d`,
        href: `/interview?id=${app.id}`,
        applicationId: app.id,
        company: app.company,
        role: app.role,
      });
    }

    if (
      isActiveStatus(app.status) &&
      !(app.jobDescription && app.jobDescription.trim())
    ) {
      out.push({
        id: `jd:${app.id}`,
        kind: "info",
        type: "missing_jd",
        title: `Archive the ${app.company} job description`,
        meta: "Original posting is missing — they disappear once filled",
        href: `/applications/${app.id}`,
        applicationId: app.id,
        company: app.company,
        role: app.role,
      });
    }

    if (app.status !== "wishlist" && !app.resumeSnapshot) {
      out.push({
        id: `snap:${app.id}`,
        kind: "urgent",
        type: "missing_snapshot",
        title: `Capture the ${app.company} submission snapshot`,
        meta: "Exact submitted resume is not frozen",
        href: `/applications/${app.id}`,
        applicationId: app.id,
        company: app.company,
        role: app.role,
      });
    }

    if (isActiveStatus(app.status) && !app.nextStep?.trim()) {
      out.push({
        id: `next:${app.id}`,
        kind: "info",
        type: "incomplete",
        title: `Set a next step for ${app.company}`,
        meta: app.role || "No next action recorded",
        href: `/applications/${app.id}`,
        applicationId: app.id,
        company: app.company,
        role: app.role,
      });
    }
  }

  for (const contact of contacts) {
    const due = contactDueOn(contact);
    const overdue = daysSince(due);
    if (overdue === null || overdue < 0) continue;
    out.push({
      id: `contact:${contact.id}`,
      kind: overdue >= 7 ? "soon" : "info",
      type: "contact",
      title: `Reach out to ${contact.name}`,
      meta:
        overdue === 0
          ? "Touch due today"
          : `${overdue}d since this relationship went due`,
      href: `/contacts?id=${contact.id}`,
      contactId: contact.id,
      company: contact.company ?? undefined,
    });
  }

  return out.sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind]);
}
