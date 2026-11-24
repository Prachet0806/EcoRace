import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RunPayload } from "@/lib/types";
import { RunReport } from "./RunReport";

function reportRun(): RunPayload {
  return {
    run_id: "run_0123456789abcdef0123456789abcdef",
    status: "feasible",
    season_year: 2026,
    calendar: {
      races: [{
        race_id: "race_1", weekend_id: "2026-03-06", friday: "2026-03-06",
        saturday: "2026-03-07", sunday: "2026-03-08", circuit_id: "circuit_1",
        circuit_name: "Test Circuit", latitude: 10, longitude: 20,
      }],
      breaks: [], weekend_count: 40, race_count: 1, break_count: 39, max_streak: 1,
    },
    segments: [],
    metrics: { total_distance_km: 0, baseline_distance_km: null, saving_km: null, baseline_status: "unavailable" },
    constraints: ["weather", "max_consecutive", "summer_break", "monthly_minimum", "dec_end_pin", "race_count_unique"].map((name) => ({
      name, satisfied: true, violations: [],
    })),
    solver: { name: "test solver", version: "1", runtime_ms: 1, seed: 1, status: "feasible", optimality_proven: false, origin: "test" },
    data_version: "test-data",
  };
}

describe("PDF report", () => {
  it("renders safely when optional provenance is missing", () => {
    const markup = renderToStaticMarkup(createElement(RunReport, { run: reportRun() }));

    expect(markup).toContain("NOT RECORDED");
    expect(markup).toContain("Weather data source is not recorded in run provenance.");
    expect(markup).not.toContain("Weather data is a synthetic demonstration fixture.");
  });

  it("does not count disabled optional constraints as passed", () => {
    const run = reportRun();
    run.provenance = {
      weather_version: "weather-v1",
      weather_sha256: null,
      circuits_sha256: "test-hash",
      weather_synthetic: true,
      scenario: {
        race_count: 1,
        circuit_ids: ["circuit_1"],
        season_year: 2026,
        max_consecutive: 3,
        summer_break_start: null,
        summer_break_end: null,
        pin_end_to_dec_week1: false,
      },
      requested_budget_s: 5,
      seed_schedule: [1],
      attempts: [],
      quality_selection: null,
      total_runtime_ms: 1,
    };
    const markup = renderToStaticMarkup(createElement(RunReport, { run }));

    expect(markup).toContain("Active constraints passed</span><strong>4 / 4</strong>");
    expect(markup.match(/NOT APPLICABLE/g)).toHaveLength(2);
    expect(markup).toContain("Weather data is a synthetic demonstration fixture.");
  });
});
