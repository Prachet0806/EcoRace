import { expect, test } from "@playwright/test";

// Full MVP loop against the real API (SOLVER_TIMEOUT_SECONDS=9 in e2e env).
// Covers: gating, select → optimize → inspect (incl. map) → back with draft
// preserved → modify → rerun, plus keyboard activation.

test("optimize button is gated until exact-match selection", async ({ page }) => {
  await page.goto("/ecorace");
  await expect(page.getByRole("button", { name: "Optimize Calendar" })).toBeDisabled();
  await expect(page.getByText("Select 20 more tracks (0/20).")).toBeVisible();
});

test("keyboard user can select a track", async ({ page }) => {
  await page.goto("/ecorace");
  await page.getByRole("button", { name: /Select .* / }).first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Selected (1)")).toBeVisible();
});

test("select → optimize → inspect → modify → rerun", async ({ page }) => {
  await page.goto("/ecorace");
  await expect(page.getByRole("list", { name: "Available tracks" })).toBeVisible();

  // Select 20 tracks.
  const addButtons = page.getByRole("button", { name: /^Select / });
  for (let i = 0; i < 20; i++) {
    await addButtons.nth(i).click();
  }
  await expect(page.getByText("Selected (20)")).toBeVisible();

  const optimize = page.getByRole("button", { name: "Optimize Calendar" });
  await expect(optimize).toBeEnabled();
  await optimize.click();

  // Solve takes ~10-12s at the e2e budget; wait for results navigation.
  await expect(page).toHaveURL(/\/ecorace\/results\/run_/, { timeout: 120_000 });
  const firstRunId = page.url().split("/").pop()!;
  await expect(page.getByRole("heading", { name: "Optimization result" })).toBeVisible();
  await expect(page.getByText("Summary")).toBeVisible();
  await expect(page.getByText("Calendar timeline")).toBeVisible();
  await expect(page.getByText(/Travel legs \(19\)/)).toBeVisible();
  // Map canvas (WebGL) — the component reports failure instead of silently blank.
  await expect(page.locator(".maplibregl-canvas, [role='alert']").first()).toBeVisible({ timeout: 30_000 });

  // Back preserves the draft.
  await page.getByRole("button", { name: /Back to scenario builder/ }).click();
  await expect(page).toHaveURL(/\/ecorace$/);
  await expect(page.getByText("Selected (20)")).toBeVisible();

  // Modify: swap one track, rerun → new run id.
  await page.getByRole("button", { name: /^Deselect / }).first().click();
  await expect(page.getByText("Selected (19)")).toBeVisible();
  await page.getByRole("button", { name: /^Select / }).first().click();
  await expect(page.getByText("Selected (20)")).toBeVisible();
  await page.getByRole("button", { name: "Optimize Calendar" }).click();
  await expect(page).toHaveURL(/\/ecorace\/results\/run_/, { timeout: 120_000 });
  const secondRunId = page.url().split("/").pop()!;
  expect(secondRunId).not.toBe(firstRunId);
  await expect(page.getByText("Calendar timeline")).toBeVisible();
});
