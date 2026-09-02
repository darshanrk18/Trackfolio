import { describe, expect, it } from "vitest";
import { formatBranchOption } from "./resume-source";

describe("formatBranchOption", () => {
  it("marks master", () => {
    expect(formatBranchOption({ isMaster: true, name: "Master Resume" })).toBe(
      "MASTER · Master Resume",
    );
  });

  it("appends company and role when they differ from the name", () => {
    expect(
      formatBranchOption({
        isMaster: false,
        name: "Stripe backend",
        company: "Stripe",
        role: "Backend",
      }),
    ).toBe("Stripe backend — Stripe · Backend");
  });

  it("uses the branch name alone when there is no extra context", () => {
    expect(formatBranchOption({ isMaster: false, name: "Stripe" })).toBe("Stripe");
  });
});
