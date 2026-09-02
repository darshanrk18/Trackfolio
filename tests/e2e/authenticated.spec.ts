import { test, expect } from "@playwright/test";

const pages: { path: string; heading: string | RegExp }[] = [
  { path: "/onboarding", heading: /what should we call you/i },
  { path: "/dashboard", heading: "Dashboard" },
  { path: "/actions", heading: "Action Center" },
  { path: "/resume", heading: "Resume Lab" },
  { path: "/cover-letters", heading: "Cover Letters" },
  { path: "/history", heading: "History" },
  { path: "/compare", heading: "Compare" },
  { path: "/analyze", heading: "Analyze" },
  { path: "/assistant", heading: "AI Assistant" },
  { path: "/applications", heading: "Applications" },
  { path: "/workspace", heading: /Application Workspace|Add an application first/i },
  { path: "/interview", heading: "Interview Prep" },
  { path: "/analytics", heading: "Search Analytics" },
  { path: "/contacts", heading: "Contacts" },
  { path: "/data", heading: /Backup & data/i },
  { path: "/settings", heading: "Settings" },
];

test("signed-in home skips the marketing pitch", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

for (const item of pages) {
  test(`renders ${item.path}`, async ({ page }) => {
    await page.goto(item.path);
    await expect(page).not.toHaveURL(/\/sign-in/);
    await expect(page.getByRole("heading", { name: item.heading }).first()).toBeVisible({
      timeout: 15_000,
    });
  });
}

test("sidebar can open Resume Lab from dashboard", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: /resume lab/i }).first().click();
  await expect(page).toHaveURL(/\/resume/);
  await expect(page.getByRole("heading", { name: "Resume Lab" })).toBeVisible();
});

test("assistant is configured, not the empty state", async ({ page }) => {
  await page.goto("/assistant");
  await expect(page.getByText(/ai is not configured/i)).toHaveCount(0);
  await expect(page.getByText(/never invent experience|constrained to the resume/i)).toBeVisible();
  await page.getByRole("tab", { name: /tailor resume/i }).click();
  await expect(page.getByLabel(/^resume$/i)).toBeVisible();
  await expect(page.getByText(/grounded in the selected resume/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /propose tailoring/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /apply to a new branch/i })).toHaveCount(0);
});

test("analyze lets you pick which resume to score", async ({ page }) => {
  await page.goto("/analyze");
  await expect(page.getByRole("heading", { name: "Analyze", level: 2 })).toBeVisible();
  await expect(page.getByLabel(/^resume$/i)).toBeVisible();
  await expect(page.getByRole("combobox", { name: /^resume$/i })).toBeVisible();
});

test("account menu opens without crashing the shell", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /account menu/i }).click();
  await expect(page.getByRole("menuitem", { name: /settings/i })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: /sign out/i })).toBeVisible();
  await page.getByRole("menuitem", { name: /settings/i }).click();
  await expect(page).toHaveURL(/settings/);
  await expect(page.getByRole("heading", { name: "Settings", level: 2 })).toBeVisible();
  await expect(page.getByText(/this view failed to load/i)).toHaveCount(0);
});

