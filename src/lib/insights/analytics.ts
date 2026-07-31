import { groupBy } from "@/lib/utils";
import {
  isActiveStatus,
  reachedInterview,
  reachedOffer,
} from "@/lib/pipeline";
import type { ApplicationStatus, RoleProfile } from "@/server/db/schema";

export interface ConversionRow {
  key: string;
  apps: number;
  interviews: number;
  offers: number;
  interviewRate: number;
  offerRate: number;
  smallSample: boolean;
}

export interface FunnelPoint {
  status: ApplicationStatus;
  count: number;
  rate: number;
}

export interface AnalyticsInput {
  status: ApplicationStatus;
  source: string | null;
  profile: RoleProfile | string | null;
}

const MIN_SAMPLE = 3;

function rate(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

function toRow(key: string, apps: AnalyticsInput[]): ConversionRow {
  const counted = apps.filter((a) => a.status !== "wishlist");
  const interviews = counted.filter((a) => reachedInterview(a.status)).length;
  const offers = counted.filter((a) => reachedOffer(a.status)).length;
  return {
    key,
    apps: counted.length,
    interviews,
    offers,
    interviewRate: rate(interviews, counted.length),
    offerRate: rate(offers, counted.length),
    smallSample: counted.length < MIN_SAMPLE,
  };
}

export function conversionBy(
  apps: readonly AnalyticsInput[],
  keyOf: (app: AnalyticsInput) => string,
): ConversionRow[] {
  const grouped = groupBy(apps, keyOf);
  return [...grouped.entries()]
    .map(([key, rows]) => toRow(key || "Unknown", rows))
    .filter((row) => row.apps > 0)
    .sort((a, b) => b.apps - a.apps || b.interviewRate - a.interviewRate);
}

export function strategyInsight(rows: readonly ConversionRow[]): {
  key: string;
  interviewRate: number;
  apps: number;
  interviews: number;
} | null {
  const eligible = rows.filter((row) => !row.smallSample);
  if (eligible.length === 0) return null;
  const best = [...eligible].sort(
    (a, b) => b.interviewRate - a.interviewRate || b.apps - a.apps,
  )[0];
  if (!best) return null;
  return {
    key: best.key,
    interviewRate: best.interviewRate,
    apps: best.apps,
    interviews: best.interviews,
  };
}

export function summarizeSearch(apps: readonly AnalyticsInput[]) {
  const counted = apps.filter((a) => a.status !== "wishlist");
  const interviews = counted.filter((a) => reachedInterview(a.status)).length;
  const offers = counted.filter((a) => reachedOffer(a.status)).length;
  const active = counted.filter((a) => isActiveStatus(a.status)).length;
  return {
    applications: counted.length,
    active,
    interviews,
    offers,
    interviewRate: rate(interviews, counted.length),
    offerRate: rate(offers, counted.length),
  };
}
