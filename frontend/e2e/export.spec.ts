import { expect, test } from "@playwright/test";

const runId = "run_0123456789abcdef0123456789abcdef";

function pdfFixture() {
  const races = Array.from({ length: 20 }, (_, index) => {
    const friday = new Date(Date.UTC(2026, 2, 6 + index * 7)).toISOString().slice(0, 10);
    const saturday = new Date(Date.UTC(2026, 2, 7 + index * 7)).toISOString().slice(0, 10);
    const sunday = new Date(Date.UTC(2026, 2, 8 + index * 7)).toISOString().slice(0, 10);
    return {
      race_id: `race_${index + 1}`,
      weekend_id: friday,
      friday,
      saturday,
      sunday,
      circuit_id: `circuit_${index + 1}`,
      circuit_name: `Circuit ${index + 1}`,
      latitude: 10 + index,
      longitude: 20 + index,
    };
  });

  return {
    run_id: runId,
    status: "feasible",
    season_year: 2026,
    calendar: { races, breaks: [], weekend_count: 40, race_count: 20, break_count: 20, max_streak: 3 },
    segments: races.slice(1).map((race, index) => ({
      segment_id: `segment_${index + 1}`,
      from_race_id: races[index].race_id,
      to_race_id: race.race_id,
      from_circuit_id: races[index].circuit_id,
      to_circuit_id: race.circuit_id,
      distance_km: 1200 + index,
    })),
    metrics: {
      total_distance_km: 25000,
      baseline_distance_km: null,
      saving_km: null,
      baseline_status: "unavailable",
    },
    constraints: ["weather", "max_consecutive", "summer_break", "monthly_minimum", "dec_end_pin", "race_count_unique"].map((name) => ({
      name,
      satisfied: true,
      violations: [],
    })),
    solver: {
      name: "fixture solver",
      version: "1",
      runtime_ms: 800,
      seed: 7,
      status: "feasible",
      optimality_proven: false,
      origin: "test fixture",
    },
    data_version: "test-data",
  };
}

test("PDF print layout renders a stored result without optional provenance", async ({ page }) => {
  const payload = pdfFixture();
  await page.goto("/");
  await page.evaluate((run) => {
    sessionStorage.setItem(`ecorace:run:${run.run_id}`, JSON.stringify(run));
  }, payload);
  await page.goto(`/results/${runId}`);
  await expect(page.getByRole("heading", { name: "Optimized 2026 calendar" })).toBeVisible();
  await page.emulateMedia({ media: "print" });

  await expect(page.locator(".screen-only")).toBeHidden();
  await expect(page.locator(".print-only-report")).toBeVisible();
  await expect(page.locator(".report-constraint-list")).toContainText("NOT RECORDED");
  await expect(page.locator(".report-footer")).toContainText("Weather data source is not recorded in run provenance.");
  await expect(page.locator(".report-table").nth(0).locator("tbody tr")).toHaveCount(20);
  await expect(page.locator(".report-table").nth(1).locator("tbody tr")).toHaveCount(19);

  const pdf = await page.pdf({ format: "A4", printBackground: true });
  expect(pdf.byteLength).toBeGreaterThan(5_000);
});
