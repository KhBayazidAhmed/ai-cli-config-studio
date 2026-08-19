import { expect, test } from "@playwright/test";

test("studio and documentation remain usable on a mobile viewport", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Configure AI Coding CLIs" })).toBeVisible();
  await expect(page.getByLabel("Base URL")).toBeVisible();
  await expect(page.getByRole("button", { name: "Fetch Models" })).toBeVisible();

  const studioWidth = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(studioWidth.content).toBeLessThanOrEqual(studioWidth.viewport + 1);

  await page.goto("/docs");
  await expect(page.getByRole("heading", { name: /User Guide & Documentation/ })).toBeVisible();
  const docsWidth = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(docsWidth.content).toBeLessThanOrEqual(docsWidth.viewport + 1);
});
