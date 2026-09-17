import { expect, test } from "@playwright/test";

// Full MVP loop against the real API (SOLVER_TIMEOUT_SECONDS=9 in e2e env).
// Covers: gating, select → optimize → inspect (incl. map) → back with draft
// preserved → modify → rerun, plus keyboard activation.

test("optimize button is gated until exact-match selection", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "→ Run optimization" })).toBeDisabled();
  await expect(page.getByText("Select 20 more tracks (0/20).")).toBeVisible();
});

test("keyboard user can select a track", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Select .* / }).first().focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Selected (1)")).toBeVisible();
});

test("region filter narrows the available list", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("list", { name: "Available tracks" })).toBeVisible();
  const items = page.getByRole("list", { name: "Available tracks" }).getByRole("listitem");
  const before = await items.count();
  await page.getByRole("button", { name: "Oceania", exact: true }).click();
  const after = await items.count();
  expect(after).toBeGreaterThan(0);
  expect(after).toBeLessThan(before);
});

test("status rail and preview track the selection", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("list", { name: "Available tracks" })).toBeVisible();

  // Select 20 tracks.
  const addButtons = page.getByRole("button", { name: /^Select / });
  for (let i = 0; i < 20; i++) {
    await addButtons.nth(i).click();
  }
  await expect(page.getByText("Selected (20)")).toBeVisible();

  const optimize = page.getByRole("button", { name: "→ Run optimization" });
  await expect(optimize).toBeEnabled();
  await optimize.click();

  // Solve takes ~10-12s at the e2e budget; wait for results navigation.
  await expect(page).toHaveURL(/\/results\/run_/, { timeout: 120_000 });
  const firstRunId = page.url().split("/").pop()!;
  await expect(page.getByRole("heading", { name: "Optimized calendar" })).toBeVisible();
  await expect(page.getByText("Total distance")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
  await expect(page.getByText(/Travel legs \(19\)/)).toBeVisible();
  // Map canvas (WebGL) — the component reports failure instead of silently blank.
  await expect(page.locator(".maplibregl-canvas, [role='alert']").first()).toBeVisible({ timeout: 30_000 });

  // Back preserves the draft.
  await page.getByRole("button", { name: /Back to scenario builder/ }).click();
  await expect(page).toHaveURL(/localhost:3100\/$/);
  await expect(page.getByText("Selected (20)")).toBeVisible();

  // Modify: swap one track, rerun → new run id.
  await page.getByRole("button", { name: /^Deselect / }).first().click();
  await expect(page.getByText("Selected (19)")).toBeVisible();
  await page.getByRole("button", { name: /^Select / }).first().click();
  await expect(page.getByText("Selected (20)")).toBeVisible();
  await page.getByRole("button", { name: "→ Run optimization" }).click();
  await expect(page).toHaveURL(/\/results\/run_/, { timeout: 120_000 });
  const secondRunId = page.url().split("/").pop()!;
  expect(secondRunId).not.toBe(firstRunId);
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
});

test("official venue set loads the 24-race preset without auto-running", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("list", { name: "Available tracks" })).toBeVisible();
  await page.getByRole("button", { name: /Official season/ }).click();
  await expect(page.getByText("Selected (24)").first()).toBeVisible();
  await expect(page.locator('[aria-label="Geographic preview"] [data-map-loaded="true"]')).toBeVisible({
    timeout: 60_000,
  });
  // Chronological 2026 order: Melbourne first in the left pane.
  const selected = page.getByRole("list", { name: "Selected tracks" });
  await expect(selected.getByRole("listitem").first()).toContainText("Albert Park");
  // Official mode locks editing: rows disabled, no Clear action.
  await expect(selected.getByRole("button").first()).toBeDisabled();
  await expect(page.getByRole("button", { name: "Clear" })).toHaveCount(0);
  // Switching back to Custom resets to an empty draft.
  await page.getByRole("button", { name: /Custom calendar/ }).click();
  await expect(page.getByText("Selected (0)").first()).toBeVisible();
  await expect(page).not.toHaveURL(/\/results\/run_/);
  await expect(page.getByRole("button", { name: "→ Run optimization" })).toBeEnabled();
});
