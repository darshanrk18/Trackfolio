import { describe, expect, it } from "vitest";
import { buildActionQueue, isStaleApplication } from "./actions";
import type { ActionSourceApplication } from "./actions";

function app(
  overrides: Partial<ActionSourceApplication> & Pick<ActionSourceApplication, "id" | "company">,
): ActionSourceApplication {
  return {
    role: "SWE",
    status: "applied",
    priority: "medium",
    appliedOn: "2026-08-01",
    followUpOn: null,
    interviewOn: null,
    updatedAt: "2026-08-01T00:00:00.000Z",
    jobDescription: "Build APIs",
    resumeSnapshot: "\\documentclass{article}",
    nextStep: "Follow up",
    ...overrides,
  };
}

describe("isStaleApplication", () => {
  it("flags active applications older than the stale window", () => {
    expect(isStaleApplication(app({ id: "1", company: "Acme" }), 14)).toBe(true);
  });

  it("ignores wishlist and terminal states", () => {
    expect(
      isStaleApplication(app({ id: "1", company: "Acme", status: "wishlist" }), 14),
    ).toBe(false);
    expect(
      isStaleApplication(app({ id: "1", company: "Acme", status: "rejected" }), 14),
    ).toBe(false);
  });

  it("does not flag when a future follow-up is scheduled", () => {
    expect(
      isStaleApplication(
        app({ id: "1", company: "Acme", followUpOn: "2099-01-01" }),
        14,
      ),
    ).toBe(false);
  });
});

describe("buildActionQueue", () => {
  it("ranks overdue follow-ups and missing snapshots ahead of missing JDs", () => {
    const queue = buildActionQueue({
      applications: [
        app({
          id: "a",
          company: "Stripe",
          followUpOn: "2020-01-01",
          resumeSnapshot: "tex",
          jobDescription: "jd",
        }),
        app({
          id: "b",
          company: "Datadog",
          resumeSnapshot: null,
          appliedOn: new Date().toISOString().slice(0, 10),
        }),
        app({
          id: "c",
          company: "Notion",
          jobDescription: "",
          appliedOn: new Date().toISOString().slice(0, 10),
        }),
      ],
      staleAfterDays: 14,
    });

    expect(queue[0]?.type).toBe("follow_up");
    expect(queue.some((item) => item.type === "missing_snapshot")).toBe(true);
    expect(queue.some((item) => item.type === "missing_jd")).toBe(true);
    expect(queue.findIndex((i) => i.type === "follow_up")).toBeLessThan(
      queue.findIndex((i) => i.type === "missing_jd"),
    );
  });

  it("surfaces overdue contacts", () => {
    const queue = buildActionQueue({
      applications: [],
      contacts: [
        {
          id: "c1",
          name: "Jane",
          company: "Stripe",
          lastContactedOn: "2020-01-01",
          nextTouchOn: "2020-02-01",
          cadenceDays: 30,
        },
      ],
    });
    expect(queue).toHaveLength(1);
    expect(queue[0]?.type).toBe("contact");
    expect(queue[0]?.href).toBe("/contacts?id=c1");
  });

  it("skips terminal applications entirely", () => {
    const queue = buildActionQueue({
      applications: [
        app({ id: "x", company: "Closed", status: "rejected", resumeSnapshot: null }),
      ],
    });
    expect(queue).toEqual([]);
  });
});
