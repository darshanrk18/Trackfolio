import { test, expect, type Page } from "@playwright/test";

const RESUME = String.raw`\documentclass{article}
\begin{document}
\section{Experience}
Software engineer. Built APIs in TypeScript on PostgreSQL and Kubernetes.
\section{Skills}
TypeScript, PostgreSQL, Kubernetes, AWS, Docker
\end{document}
`;

const JD = `Required Qualifications:
- TypeScript
- PostgreSQL
- Kubernetes
Preferred Qualifications:
- AWS
`;

async function fillLatex(page: Page, source: string) {
  await page.getByRole("group", { name: /latex source editor/i }).click();
  await page.locator(".cm-content").click();
  await page.keyboard.press("Meta+A");
  await page.keyboard.insertText(source);
}

test.describe.configure({ mode: "serial" });

test.describe("end-user UI journey", () => {
  test.setTimeout(180_000);

  test("onboard and land on the dashboard", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: /what should we call you/i })).toBeVisible();
    await page.getByLabel(/full name/i).fill("E2E Explorer");
    await page.getByRole("button", { name: /^continue$/i }).click();
    await expect(page.getByPlaceholder(/documentclass/i)).toBeVisible();
    await page.getByPlaceholder(/documentclass/i).fill(RESUME);
    await page.getByRole("button", { name: /enter trackfolio/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Dashboard", level: 2 })).toBeVisible();
  });

  test("command palette and theme toggle", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /search/i }).click();
    const palette = page.getByPlaceholder(/jump to a view, search a company/i);
    await expect(palette).toBeVisible();
    await palette.fill("Resume Lab");
    await page.getByRole("option", { name: /resume lab/i }).first().click();
    await expect(page).toHaveURL(/\/resume/, { timeout: 10_000 });

    await page.getByRole("button", { name: /change theme/i }).click();
    await page.getByRole("menuitemradio", { name: /^dark$/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("Resume Lab: unlock, edit, version, branch, watchlist, compile", async ({ page }) => {
    await page.goto("/resume");
    await expect(page.getByRole("heading", { name: "Resume Lab", level: 2 })).toBeVisible();

    const lock = page.getByRole("button", { name: /master locked/i });
    if (await lock.isVisible()) await lock.click();
    await expect(page.getByRole("button", { name: /master unlocked/i })).toBeVisible();

    await fillLatex(page, RESUME);
    await page.getByPlaceholder(/version note/i).fill("Baseline master");
    await page.getByRole("button", { name: /save version/i }).click();
    await expect(page.getByText(/saved baseline master/i)).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder(/e\.g\. aws iam/i).fill("Kubernetes");
    await page.getByRole("button", { name: /add term/i }).click();
    await expect(page.getByText(/kubernetes/i).first()).toBeVisible();

    await page.getByRole("textbox", { name: "Company" }).fill("Acme");
    await page.getByRole("textbox", { name: "Role" }).fill("Backend Engineer");
    await page.getByRole("button", { name: /create branch/i }).click();
    await expect(page.getByText(/created branch/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Acme").first()).toBeVisible();

    await page.getByRole("button", { name: /^compile$/i }).click();
    await expect(page.getByText(/compiled ·/i)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTitle("Resume PDF preview")).toBeAttached();
  });

  test("cover letter, history, and compare", async ({ page }) => {
    await page.goto("/cover-letters");
    await page.getByPlaceholder(/draft your cover letter/i).fill(
      "Dear Acme, I built TypeScript APIs on PostgreSQL and Kubernetes.",
    );
    await page.getByPlaceholder(/label \(e\.g\. tailored for stripe\)/i).fill("Acme letter");
    await page.getByRole("button", { name: /save as version/i }).click();
    await expect(page.getByText(/saved acme letter/i)).toBeVisible({ timeout: 15_000 });

    await page.goto("/history");
    await expect(page.getByText("Baseline master")).toBeVisible();
    await expect(page.getByText("Acme letter")).toBeVisible();

    await page.goto("/compare");
    await expect(page.locator("select option").nth(1)).toBeAttached({ timeout: 15_000 });
    await page.getByRole("button", { name: /^compare$/i }).click();
    await expect(page.getByText(/% similar/i)).toBeVisible({ timeout: 15_000 });
  });

  test("analyze a job description", async ({ page }) => {
    await page.goto("/analyze");
    await expect(page.getByText(/resume health/i)).toBeVisible();
    await page.getByPlaceholder(/paste the full job description/i).fill(JD);
    await page.getByRole("button", { name: /analyze match/i }).click();
    await expect(page.getByText(/role fit/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/must-have coverage/i)).toBeVisible();
  });

  test("applications, workspace snapshot, and interview prep", async ({ page }) => {
    await page.goto("/applications");
    await page.getByPlaceholder("Stripe").fill("Acme");
    await page.getByPlaceholder("Backend SDE").fill("Backend Engineer");
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByRole("link", { name: /^open$/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("tab", { name: /board/i }).click();
    await expect(page.getByText("Acme").first()).toBeVisible();
    await page.getByRole("tab", { name: /table/i }).click();

    await page.getByRole("link", { name: /^open$/i }).first().click();
    await expect(page.getByRole("heading", { name: /acme/i }).first()).toBeVisible();

    const jdBox = page.locator("textarea.min-h-\\[280px\\]");
    await jdBox.fill(JD);
    await jdBox.blur();
    await expect(page.getByText(/job description archived/i)).toBeVisible({ timeout: 10_000 });

    const resumeSelect = page.locator("select").filter({
      has: page.locator("option", { hasText: "Baseline master" }),
    });
    await resumeSelect.selectOption({ label: "Baseline master" });
    await expect(resumeSelect).toHaveValue(/.+/);
    await page.getByRole("button", { name: /capture \/ refresh snapshot/i }).click();
    await expect(page.getByText(/frozen submission/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /export snapshot/i })).toBeVisible();

    await page.goto("/interview");
    await expect(page.getByText(/prepare against the frozen submission/i)).toBeVisible();
    await page
      .getByPlaceholder(/situation → task → action → result/i)
      .fill("Led a latency drop on a TypeScript API using PostgreSQL indexes.");
    await expect(page.getByText(/interview prep saved/i)).toBeVisible({ timeout: 10_000 });
  });

  test("contacts, settings, backup, and assistant surface", async ({ page }) => {
    await page.goto("/contacts");
    await page.getByPlaceholder("Jane Doe").fill("Jordan Recruiter");
    await page.getByPlaceholder("Stripe").fill("Acme");
    await page.getByPlaceholder("Recruiter").fill("Recruiter");
    await page.getByRole("button", { name: /^add$/i }).click();
    await expect(page.getByRole("row", { name: /jordan recruiter/i })).toBeVisible({
      timeout: 10_000,
    });

    await page.goto("/settings");
    await page.getByPlaceholder("Software engineer").fill("Backend engineer");
    await page.getByPlaceholder("Software engineer").blur();
    await expect(page.getByText(/settings saved/i)).toBeVisible({ timeout: 10_000 });

    await page.goto("/data");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /download backup/i }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/trackfolio-backup/);

    await page.goto("/assistant");
    await expect(page.getByText(/ai is not configured/i)).toHaveCount(0);
    await expect(
      page.getByText(/constrained to the resume you actually wrote/i),
    ).toBeVisible();
    await page.getByPlaceholder(/paste a weak bullet/i).fill(
      "Worked on backend APIs in TypeScript.",
    );
    await page.getByRole("button", { name: /^rewrite$/i }).click();
    await expect(
      page
        .locator("p.font-medium")
        .first()
        .or(page.getByText(/the model could not complete this request/i)),
    ).toBeVisible({ timeout: 90_000 });

    await page.goto("/actions");
    await expect(page.getByRole("heading", { name: "Action Center", level: 2 })).toBeVisible();
    await page.goto("/analytics");
    await expect(page.getByRole("heading", { name: "Search Analytics", level: 2 })).toBeVisible();
  });
});
