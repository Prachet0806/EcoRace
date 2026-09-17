import { expect, test } from "@playwright/test";

// Visual regression ARTIFACTS only: screenshots are saved for human review,
// never pixel-compared. Functional assertions remain the gates.
test("visual artifacts: builder states", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("list", { name: "Available tracks" })).toBeVisible();
  await page.screenshot({ path: "test-results/shot-builder-empty.png" });

  const addButtons = page.getByRole("button", { name: /^Select / });
  for (let i = 0; i < 20; i++) {
    await addButtons.nth(i).click();
  }
  await expect(page.getByText("Selected (20)")).toBeVisible();
  await page.screenshot({ path: "test-results/shot-builder-ready.png" });
});

test("visual artifacts: results + missing", async ({ page }) => {
  await page.goto("/");
  const addButtons = page.getByRole("button", { name: /^Select / });
  for (let i = 0; i < 20; i++) {
    await addButtons.nth(i).click();
  }
  await page.getByRole("button", { name: "→ Run optimization" }).click();
  await expect(page).toHaveURL(/\/results\/run_/, { timeout: 120_000 });
  await expect(page.locator('[aria-label="Route map"][data-map-loaded="true"]')).toBeVisible({ timeout: 60_000 });
  await page.screenshot({ path: "test-results/shot-results.png" });

  await page.goto("/results/run_missing");
  await expect(page.getByRole("heading", { name: "Result not available" })).toBeVisible();
  await page.screenshot({ path: "test-results/shot-missing.png" });
});
