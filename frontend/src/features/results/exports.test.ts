import { describe, expect, it } from "vitest";
import type { Circuit, RunPayload } from "@/lib/types";
import { buildScheduleCsv, buildTravelLegsCsv } from "./exports";

function makeRun(count = 20): RunPayload {
  const races = Array.from({ length: count }, (_, index) => {
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
      latitude: index === 0 ? -33.8 : 10 + index,
      longitude: 20 + index,
    };
  });
  return {
    run_id: "run_0123456789abcdef0123456789abcdef",
    status: "feasible",
    season_year: 2026,
    calendar: {
      races,
      breaks: [],
      weekend_count: 40,
      race_count: count,
      break_count: 40 - count,
      max_streak: 3,
    },
    segments: races.slice(1).map((race, index) => ({
      segment_id: `segment_${index + 1}`,
      from_race_id: races[index].race_id,
      to_race_id: race.race_id,
      from_circuit_id: races[index].circuit_id,
      to_circuit_id: race.circuit_id,
      distance_km: 1200 + index,
    })),
    metrics: {
      total_distance_km: 1200 * Math.max(0, count - 1),
      baseline_distance_km: null,
      saving_km: null,
      baseline_status: "unavailable",
    },
    constraints: [],
    solver: {
      name: "test-solver",
      version: "1",
      runtime_ms: 100,
      seed: 1,
      status: "feasible",
      optimality_proven: false,
      origin: "test",
    },
    data_version: "test-data",
  };
}

function makeCircuits(run: RunPayload): Circuit[] {
  return run.calendar.races.map((race, index) => ({
    id: race.circuit_id,
    name: race.circuit_name,
    city: index === 0 ? '=HYPERLINK("https://bad.example","click")' : `City ${index + 1}`,
    country: index === 0 ? "Example,\nCountry" : `Country ${index + 1}`,
    country_code: "XX",
    region: "Test Region",
    timezone: "Etc/UTC",
    latitude: race.latitude,
    longitude: race.longitude,
  }));
}

function parseCsv(csv: string): string[][] {
  const source = csv.replace(/^\uFEFF/, "");
  const rows: string[][] = [[]];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      rows[rows.length - 1].push(cell);
      cell = "";
    } else if (char === "\r" || char === "\n") {
      rows[rows.length - 1].push(cell);
      cell = "";
      if (char === "\r" && source[index + 1] === "\n") index++;
      rows.push([]);
    } else {
      cell += char;
    }
  }

  if (cell !== "" || rows[rows.length - 1].length > 0) rows[rows.length - 1].push(cell);
  return rows.filter((row) => row.length > 0);
}

describe("EcoRace CSV exports", () => {
  it("keeps schedule columns consistent and leaves the first race without an incoming leg", () => {
    const run = makeRun();
    const rows = parseCsv(buildScheduleCsv(run, makeCircuits(run)));

    expect(rows).toHaveLength(21);
    expect(rows.every((row) => row.length === 19)).toBe(true);
    expect(rows[1][3]).toBe("1");
    expect(rows[1][16]).toBe("");
    expect(rows[1][17]).toBe("");
    expect(rows[1][18]).toBe("");
    expect(rows[20][3]).toBe("20");
    expect(rows[20][16]).toBe("Circuit 19");
    expect(rows[20][17]).toBe("1218");
  });

  it("exports exactly one ordered travel leg between each consecutive pair of races", () => {
    const run = makeRun();
    const rows = parseCsv(buildTravelLegsCsv(run, makeCircuits(run)));

    expect(rows).toHaveLength(20);
    expect(rows.every((row) => row.length === 21)).toBe(true);
    expect(rows[1][2]).toBe("1");
    expect(rows[1][4]).toBe("1");
    expect(rows[1][11]).toBe("2");
    expect(rows[19][2]).toBe("19");
    expect(rows[19][11]).toBe("20");
  });

  it("quotes CSV text, neutralizes formula-like text, and preserves negative numeric coordinates", () => {
    const run = makeRun();
    const rows = parseCsv(buildScheduleCsv(run, makeCircuits(run)));

    expect(rows[1][10]).toBe("Circuit 1");
    expect(rows[1][11]).toBe("'=HYPERLINK(\"https://bad.example\",\"click\")");
    expect(rows[1][12]).toBe("Example,\nCountry");
    expect(rows[1][14]).toBe("-33.8");
  });

  it("keeps race data when optional circuit metadata is missing", () => {
    const run = makeRun();
    const circuits = makeCircuits(run).slice(1);
    const schedule = parseCsv(buildScheduleCsv(run, circuits));
    const legs = parseCsv(buildTravelLegsCsv(run, circuits));

    expect(schedule[1][10]).toBe("Circuit 1");
    expect(schedule[1][11]).toBe("");
    expect(legs[1][7]).toBe("Circuit 1");
  });
});
