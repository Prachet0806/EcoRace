import { expect, test } from "@playwright/test";

test("map fully loads with route layers", async ({ page }) => {
  await page.goto("/");
  const addButtons = page.getByRole("button", { name: /^Select / });
  for (let i = 0; i < 20; i++) {
    await addButtons.nth(i).click();
  }
  await page.getByRole("button", { name: "→ Run optimization" }).click();
  await expect(page).toHaveURL(/\/results\/run_/, { timeout: 120_000 });
  // Canvas alone is not enough (a stalled map still paints a canvas):
  // require the style/tiles fully loaded signal.
  await expect(page.locator('[aria-label="Route map"][data-map-loaded="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(/Travel legs \(19\)/)).toBeVisible();
});
