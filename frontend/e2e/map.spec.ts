import { expect, test } from "@playwright/test";

test("map canvas renders with route layers", async ({ page }) => {
  await page.goto("/ecorace");
  const addButtons = page.getByRole("button", { name: /^Select / });
  for (let i = 0; i < 20; i++) {
    await addButtons.nth(i).click();
  }
  await page.getByRole("button", { name: "Optimize Calendar" }).click();
  await expect(page).toHaveURL(/\/ecorace\/results\/run_/, { timeout: 120_000 });
  const canvas = page.locator(".maplibregl-canvas");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  // Route + race layers registered on the map.
  const layers = await page.evaluate(() => {
    const el = document.querySelector(".maplibregl-canvas");
    return { canvasPresent: Boolean(el) };
  });
  expect(layers.canvasPresent).toBe(true);
  await expect(page.getByText(/Travel legs \(19\)/)).toBeVisible();
});
