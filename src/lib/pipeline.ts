import type { ApplicationStatus, Priority, RoleProfile } from "@/server/db/schema";

export type StatusTone = "neutral" | "primary" | "ok" | "warn" | "bad";

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  wishlist: "Wishlist",
  applied: "Applied",
  screen: "Recruiter screen",
  assessment: "Assessment",
  interview: "Interview",
  final: "Final round",
  offer: "Offer",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  ghosted: "Ghosted",
};

export const STATUS_TONE: Record<ApplicationStatus, StatusTone> = {
  wishlist: "neutral",
  applied: "neutral",
  screen: "primary",
  assessment: "warn",
  interview: "primary",
  final: "primary",
  offer: "ok",
  accepted: "ok",
  rejected: "bad",
  withdrawn: "neutral",
  ghosted: "warn",
};

/** Forward-progress stages shown on the funnel and workspace stepper. */
export const FUNNEL_STAGES = [
  "wishlist",
  "applied",
  "screen",
  "assessment",
  "interview",
  "final",
  "offer",
] as const satisfies readonly ApplicationStatus[];

export const ACTIVE_STATUSES = [
  "applied",
  "screen",
  "assessment",
  "interview",
  "final",
] as const satisfies readonly ApplicationStatus[];

export const TERMINAL_STATUSES = [
  "rejected",
  "withdrawn",
  "ghosted",
  "accepted",
] as const satisfies readonly ApplicationStatus[];

export const INTERVIEW_STATUSES = [
  "assessment",
  "interview",
  "final",
  "offer",
] as const satisfies readonly ApplicationStatus[];

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const PROFILE_LABELS: Record<RoleProfile, string> = {
  general: "General SWE",
  backend: "Backend",
  frontend: "Frontend",
  fullstack: "Full stack",
  cloud: "Cloud / Platform",
  data: "Data",
  ml: "AI / ML",
  mobile: "Mobile",
  security: "Security",
  sre: "SRE",
};

export function profileLabel(profile: string | null | undefined): string {
  if (!profile) return "Unlabeled";
  return Object.hasOwn(PROFILE_LABELS, profile)
    ? PROFILE_LABELS[profile as RoleProfile]
    : profile;
}

/** Directional hints shown while tailoring a branch for a role archetype. */
export const PROFILE_GUIDANCE: Record<RoleProfile, string[]> = {
  general: ["Quantified impact", "Ownership verbs", "One-page density", "ATS-safe formatting"],
  backend: ["APIs & data models", "Databases", "Concurrency", "Observability"],
  frontend: ["React / TypeScript", "Accessibility", "Performance", "Design systems"],
  fullstack: ["End-to-end delivery", "APIs", "Frontend craft", "Cloud deploy"],
  cloud: ["AWS / GCP / Azure", "IaC", "Containers", "Reliability"],
  data: ["SQL", "Pipelines", "Warehouses", "Experimentation"],
  ml: ["Python", "Training / eval", "Vector search", "Production ML"],
  mobile: ["iOS / Android", "Offline", "Performance", "Release cadence"],
  security: ["Threat modeling", "IAM", "Secure SDLC", "Incident response"],
  sre: ["SLOs", "On-call", "Automation", "Capacity"],
};

export const WORK_MODE_LABELS = {
  onsite: "On-site",
  hybrid: "Hybrid",
  remote: "Remote",
  unknown: "Unspecified",
} as const;

export function isActiveStatus(status: ApplicationStatus): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(status);
}

export function isTerminalStatus(status: ApplicationStatus): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

export function isInterviewStatus(status: ApplicationStatus): boolean {
  return (INTERVIEW_STATUSES as readonly string[]).includes(status);
}

export function reachedInterview(status: ApplicationStatus): boolean {
  return (
    status === "interview" ||
    status === "final" ||
    status === "offer" ||
    status === "accepted"
  );
}

export function reachedOffer(status: ApplicationStatus): boolean {
  return status === "offer" || status === "accepted";
}
