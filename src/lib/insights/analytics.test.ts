import { describe, expect, it } from "vitest";
import {
  conversionBy,
  strategyInsight,
  summarizeSearch,
} from "./analytics";

describe("conversion analytics", () => {
  it("computes interview rate by source and labels small samples", () => {
    const rows = conversionBy(
      [
        { status: "applied", source: "Referral", profile: "backend" },
        { status: "interview", source: "Referral", profile: "backend" },
        { status: "offer", source: "Referral", profile: "backend" },
        { status: "applied", source: "LinkedIn", profile: "frontend" },
        { status: "wishlist", source: "LinkedIn", profile: "frontend" },
      ],
      (a) => a.source ?? "Unknown",
    );

    const referral = rows.find((r) => r.key === "Referral");
    expect(referral?.apps).toBe(3);
    expect(referral?.interviews).toBe(2);
    expect(referral?.interviewRate).toBe(67);
    expect(referral?.smallSample).toBe(false);

    const linkedin = rows.find((r) => r.key === "LinkedIn");
    expect(linkedin?.apps).toBe(1);
    expect(linkedin?.smallSample).toBe(true);
  });

  it("only surfaces a strategy insight once a profile has three applications", () => {
    const thin = conversionBy(
      [{ status: "interview", source: "x", profile: "ml" }],
      (a) => String(a.profile),
    );
    expect(strategyInsight(thin)).toBeNull();

    const thick = conversionBy(
      [
        { status: "applied", source: "x", profile: "backend" },
        { status: "interview", source: "x", profile: "backend" },
        { status: "interview", source: "x", profile: "backend" },
      ],
      (a) => String(a.profile),
    );
    expect(strategyInsight(thick)?.key).toBe("backend");
    expect(strategyInsight(thick)?.interviewRate).toBe(67);
  });

  it("summarises the overall search without counting wishlist rows", () => {
    const summary = summarizeSearch([
      { status: "wishlist", source: null, profile: null },
      { status: "applied", source: null, profile: null },
      { status: "interview", source: null, profile: null },
      { status: "offer", source: null, profile: null },
    ]);
    expect(summary.applications).toBe(3);
    expect(summary.interviews).toBe(2);
    expect(summary.offers).toBe(1);
    expect(summary.interviewRate).toBe(67);
  });
});
