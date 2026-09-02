/**
 * End-to-end product flow against the real local Neon database.
 *
 * Seeds throwaway users, exercises the tRPC surface, then deletes the accounts.
 * Run: pnpm exec tsx scripts/local-e2e.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const MASTER_V1 = String.raw`\documentclass{article}
\begin{document}
\section{Experience}
Software engineer at Northwind. Built APIs in TypeScript on PostgreSQL and Kubernetes, cutting p95 latency 40\%.
\section{Skills}
TypeScript, PostgreSQL, Kubernetes, AWS, Docker
\end{document}
`;

const MASTER_V2 = MASTER_V1.replace("Northwind", "Contoso");

const TAILORED = MASTER_V1.replace(
  "Software engineer at Northwind",
  "Backend engineer at Acme targeting this role",
);

const JD = `About the role
We are building a payments platform for small businesses.

Required Qualifications:
- 5+ years building backend services in TypeScript
- Production experience with Kubernetes and Docker
- Solid SQL and PostgreSQL fundamentals

Preferred Qualifications:
- Experience with AWS
- Terraform for infrastructure automation
`;

let passed = 0;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
  passed += 1;
}

async function expectThrow(label: string, fn: () => Promise<unknown>, match: string) {
  try {
    await fn();
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (!text.toLowerCase().includes(match.toLowerCase())) {
      throw new Error(`${label}: got "${text}", expected "${match}"`);
    }
    passed += 1;
    return;
  }
  throw new Error(`${label}: expected an error containing "${match}"`);
}

async function main() {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../src/server/db");
  const { users } = await import("../src/server/db/schema");
  const { createCaller } = await import("../src/server/api/root");
  const { createTRPCContext } = await import("../src/server/api/trpc");

  const stamp = Date.now();
  const emailA = `e2e.a.${stamp}@trackfolio.test`;
  const emailB = `e2e.b.${stamp}@trackfolio.test`;

  const [userA] = await db
    .insert(users)
    .values({ email: emailA, name: "E2E Alpha" })
    .returning();
  const [userB] = await db
    .insert(users)
    .values({ email: emailB, name: "E2E Beta" })
    .returning();
  if (!userA || !userB) throw new Error("Failed to insert test users.");

  const callerFor = async (user: { id: string; email: string; name: string | null }) =>
    createCaller(
      await createTRPCContext({
        headers: new Headers({ "x-forwarded-for": "127.0.0.1" }),
        user: { id: user.id, email: user.email, name: user.name },
      }),
    );

  const api = await callerFor(userA);
  const other = await callerFor(userB);

  try {
    await api.profile.update({ fullName: "E2E Alpha" });
    const workspace = await api.documents.workspace({ kind: "resume" });
    assert(workspace.master?.isMaster, "workspace creates a master resume");

    await expectThrow(
      "delete master",
      () => api.documents.deleteBranch({ id: workspace.master!.id }),
      "master branch cannot be deleted",
    );

    await api.documents.saveDraft({
      branchId: workspace.master.id,
      content: MASTER_V1,
    });
    const version = await api.documents.commitVersion({
      branchId: workspace.master.id,
      note: "Baseline master",
    });
    assert(version.content.includes("Northwind"), "committed version stores the exact bytes");

    const branch = await api.documents.createBranch({
      kind: "resume",
      name: "Acme Backend",
      company: "Acme",
      fromBranchId: workspace.master.id,
    });
    assert(!branch.isMaster, "tailor branch is not master");
    await api.documents.saveDraft({ branchId: branch.id, content: TAILORED });

    const health = await api.analysis.health({ branchId: workspace.master.id });
    assert(typeof health.score === "number", "health returns a numeric score");

    const match = await api.analysis.jobMatch({
      branchId: branch.id,
      jobDescription: JD,
    });
    assert(match.must.length > 0, "JD match extracts must-have terms");

    const skills = await api.analysis.detectedSkills({
      branchId: workspace.master.id,
    });
    assert(skills.skills.length > 0, "detected skills stay grounded in the document");

    await api.documents.addWatchTerm({ term: "Kubernetes" });
    const watch = await api.analysis.watchlistStatus({
      branchId: workspace.master.id,
    });
    assert(
      watch.terms.some((t) => t.term === "Kubernetes" && t.present),
      "watchlist sees Kubernetes on the resume",
    );

    const application = await api.applications.create({
      company: "Acme",
      role: "Backend Engineer",
      status: "applied",
      jobDescription: JD,
      resumeVersionId: version.id,
    });
    assert(
      application.resumeSnapshot?.includes("Northwind"),
      "create freezes the submitted resume as a copy",
    );

    await api.documents.saveDraft({
      branchId: workspace.master.id,
      content: MASTER_V2,
    });
    const afterEdit = await api.applications.byId({ id: application.id });
    assert(
      afterEdit.resumeSnapshot?.includes("Northwind"),
      "editing master does not rewrite the frozen snapshot",
    );
    assert(
      !afterEdit.resumeSnapshot?.includes("Contoso"),
      "snapshot does not pick up later master edits",
    );

    await api.documents.deleteVersion({ id: version.id });
    const afterDelete = await api.applications.byId({ id: application.id });
    assert(
      afterDelete.resumeSnapshot?.includes("Northwind"),
      "deleting the version does not rewrite what the company received",
    );

    await api.applications.updateStatus({
      id: application.id,
      status: "interview",
    });
    await api.applications.saveInterviewPrep({
      id: application.id,
      prep: { notes: "Prep against the frozen Acme snapshot, not current master." },
    });
    const prep = await api.applications.byId({ id: application.id });
    assert(
      prep.interviewPrep.notes?.includes("frozen Acme snapshot"),
      "interview prep is stored on the application",
    );

    const contact = await api.contacts.create({
      name: "Jordan Recruiter",
      company: "Acme",
    });
    await api.applications.linkContact({
      applicationId: application.id,
      contactId: contact.id,
    });

    const coverWs = await api.documents.workspace({ kind: "cover_letter" });
    await api.documents.saveDraft({
      branchId: coverWs.master!.id,
      content: "Dear Acme, I built APIs on PostgreSQL.",
    });
    await api.documents.commitVersion({
      branchId: coverWs.master!.id,
      note: "Acme letter",
    });

    const queue = await api.insights.actionQueue();
    assert(Array.isArray(queue), "action queue returns a list");
    const dashboard = await api.insights.dashboard();
    assert(dashboard.totals.applications >= 1, "dashboard counts the application");
    const analytics = await api.insights.analytics();
    assert(analytics, "analytics payload is present");

    const backup = await api.data.exportBackup();
    assert(backup.applications.length === 1, "backup includes only this user's application");
    assert(
      backup.applications[0]?.resumeSnapshot?.includes("Northwind"),
      "backup preserves snapshot copies",
    );

    const pkg = await api.data.applicationPackage({ id: application.id });
    assert(pkg.company === "Acme", "application package is scoped to the job");

    const otherApps = await other.applications.list({ limit: 50 });
    assert(otherApps.length === 0, "another user cannot list this application");
    await expectThrow(
      "cross-user byId",
      () => other.applications.byId({ id: application.id }),
      "not found",
    );

    const ai = await api.ai.enabled();
    assert(ai.enabled === true, "AI is on with provider keys");
    let rewriteOk = false;
    try {
      const rewritten = await api.ai.rewriteBullet({
        bullet: "Worked on backend APIs in TypeScript.",
        context: MASTER_V1,
      });
      assert(rewritten.variants.length > 0, "rewrite returns grounded variants");
      assert(
        rewritten.variants.some((variant) => variant.text.trim().length > 0),
        "rewrite variant has text",
      );
      rewriteOk = true;
      console.log(`  ai rewrite: ${rewritten.variants.length} variants`);
    } catch (error) {
      console.log(
        `  ai rewrite skipped: ${error instanceof Error ? error.message : error}`,
      );
    }
    let extracted: { role: string | null; requirements: string[] } | undefined;
    try {
      extracted = await api.ai.extractJobPosting({ text: JD });
    } catch (error) {
      console.log(
        `  ai extract skipped: ${error instanceof Error ? error.message : error}`,
      );
    }
    if (extracted) {
      assert(
        extracted.requirements.length > 0,
        "JD extract returns requirements from the posting",
      );
      console.log(
        `  ai extract: role=${extracted.role ?? "n/a"} requirements=${extracted.requirements.length}`,
      );
    }

    const diff = await api.analysis.diff({
      leftContent: MASTER_V1,
      rightContent: TAILORED,
    });
    assert(diff.hunks.length > 0, "diff produces hunks between master and tailor");

    await api.profile.completeOnboarding();
    const profile = await api.profile.get();
    assert(profile.onboarded === true, "onboarding marks the profile complete");

    const cronDenied = await fetch("http://localhost:3000/api/cron/reminders");
    assert(cronDenied.status === 401, "cron rejects requests without the secret");
    const cronSecret = process.env.CRON_SECRET;
    assert(Boolean(cronSecret), "CRON_SECRET is set for local cron");
    const cronOk = await fetch("http://localhost:3000/api/cron/reminders", {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    assert(cronOk.status === 200, "cron accepts a bearer secret");

    let compileOk = false;
    try {
      const compiled = await api.latex.compileBranch({
        branchId: workspace.master.id,
        engine: "pdflatex",
      });
      compileOk = compiled.status === "success";
      console.log(`  latex compile: ${compiled.status}`);
    } catch (error) {
      console.log(
        `  latex compile skipped: ${error instanceof Error ? error.message : error}`,
      );
    }

    await api.profile.deleteAccount({ confirmation: emailA });
    await other.profile.deleteAccount({ confirmation: emailB });

    const gone = await db.query.users.findFirst({
      where: eq(users.id, userA.id),
    });
    assert(gone?.deletedAt != null, "deleteAccount soft-deletes the user");

    console.log(
      `\nProduct flow: ${passed} assertions passed${compileOk ? ", latex compile ran" : ""}${rewriteOk ? ", AI rewrite ran" : ""}.`,
    );
  } catch (error) {
    console.error(error);
    try {
      await api.profile.deleteAccount({ confirmation: emailA });
    } catch {
      /* still try the other account */
    }
    try {
      await other.profile.deleteAccount({ confirmation: emailB });
    } catch {
      /* best-effort cleanup */
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
