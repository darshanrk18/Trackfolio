import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  PRIORITY_LABELS,
  PROFILE_LABELS,
  STATUS_LABELS,
  STATUS_TONE,
} from "@/lib/pipeline";
import type { ApplicationStatus, Priority, RoleProfile } from "@/server/db/schema";

export function StatusPill({
  status,
  className,
}: {
  status: ApplicationStatus;
  className?: string;
}) {
  return (
    <Badge tone={STATUS_TONE[status]} mono size="sm" className={className}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function PriorityPill({ priority }: { priority: Priority }) {
  const tone: BadgeProps["tone"] =
    priority === "high" ? "bad" : priority === "medium" ? "warn" : "neutral";
  return (
    <Badge tone={tone} mono size="sm">
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}

export function ProfilePill({ profile }: { profile: RoleProfile | null | undefined }) {
  if (!profile) return null;
  return (
    <Badge tone="primary" mono size="sm">
      {PROFILE_LABELS[profile]}
    </Badge>
  );
}
