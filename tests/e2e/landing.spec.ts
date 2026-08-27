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
