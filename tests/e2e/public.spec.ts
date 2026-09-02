import { test, expect } from "@playwright/test";

test("landing page presents the product", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Know exactly which resume",
  );
  await expect(page.getByRole("link", { name: /start free/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /see how it works/i })).toBeVisible();
});

test("guide and privacy are reachable", async ({ page }) => {
  await page.goto("/guide");
  await expect(page.getByRole("heading", { name: /how trackfolio works/i })).toBeVisible();
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: /privacy/i })).toBeVisible();
});

test("sign-in offers GitHub, Google, and email", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /continue with github/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /email me a sign-in link/i })).toBeVisible();
});

test("GitHub OAuth leaves the app for GitHub", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: /continue with github/i }).click();
  await page.waitForURL(/github\.com/, { timeout: 15_000 });
});

test("app routes redirect to sign-in when logged out", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto("/resume");
  await expect(page).toHaveURL(/\/sign-in/);
});
