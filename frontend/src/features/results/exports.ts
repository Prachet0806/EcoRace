import type { Circuit, RunPayload } from "@/lib/types";

type CsvValue = string | number | boolean | null | undefined;

function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  // Excel and several other spreadsheet apps interpret cells beginning with
  // these characters as formulas. Prefix only text cells; numeric negatives
  // such as southern/western coordinates remain numeric.
  const safe = typeof value === "string" && /^[\s\u0000-\u001f]*[=+@-]/.test(raw)
    ? `'${raw}`
    : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

function toCsv(headers: string[], rows: CsvValue[][]): string {
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

function saveCsv(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function venue(circuitId: string, circuits: Circuit[]): Circuit | undefined {
  return circuits.find((circuit) => circuit.id === circuitId);
}

function raceNumber(races: RunPayload["calendar"]["races"]): Map<string, number> {
  return new Map(races.map((race, index) => [race.race_id, index + 1]));
}

export function downloadScheduleCsv(run: RunPayload, circuits: Circuit[]): void {
  const races = run.calendar.races;
  const byRaceId = new Map(races.map((race) => [race.race_id, race]));
  const incomingLeg = new Map(run.segments.map((segment) => [segment.to_race_id, segment]));
  const rows = races.map((race, index) => {
    const leg = incomingLeg.get(race.race_id);
    const previousRace = leg ? byRaceId.get(leg.from_race_id) : undefined;
    const currentVenue = venue(race.circuit_id, circuits);
    const previousVenue = previousRace ? venue(previousRace.circuit_id, circuits) : undefined;
    const regionChanged = currentVenue && previousVenue
      ? currentVenue.region !== previousVenue.region
      : undefined;

    return [
      run.season_year,
      run.run_id,
      run.status,
      index + 1,
      race.race_id,
      race.weekend_id,
      race.friday,
      race.saturday,
      race.sunday,
      race.circuit_id,
      race.circuit_name,
      currentVenue?.city,
      currentVenue?.country,
      currentVenue?.region,
      race.latitude,
      race.longitude,
      previousRace?.circuit_name,
      leg?.distance_km,
      regionChanged,
    ];
  });

  const csv = toCsv(
    [
      "season_year", "run_id", "run_status", "race_number", "race_id", "weekend_id",
      "friday", "saturday", "sunday", "circuit_id", "circuit_name", "city", "country",
      "region", "latitude", "longitude", "from_circuit_name", "leg_distance_km", "region_changed",
    ],
    rows,
  );
  saveCsv(`ecorace-${run.run_id}-schedule.csv`, csv);
}

export function downloadTravelLegsCsv(run: RunPayload, circuits: Circuit[]): void {
  const races = new Map(run.calendar.races.map((race) => [race.race_id, race]));
  const numbers = raceNumber(run.calendar.races);
  const rows = run.segments.map((segment, index) => {
    const fromRace = races.get(segment.from_race_id);
    const toRace = races.get(segment.to_race_id);
    const fromVenue = venue(segment.from_circuit_id, circuits);
    const toVenue = venue(segment.to_circuit_id, circuits);
    const regionChanged = fromVenue && toVenue
      ? fromVenue.region !== toVenue.region
      : undefined;

    return [
      run.season_year,
      run.run_id,
      index + 1,
      segment.segment_id,
      numbers.get(segment.from_race_id),
      segment.from_race_id,
      segment.from_circuit_id,
      fromVenue?.name ?? fromRace?.circuit_name,
      fromVenue?.city,
      fromVenue?.country,
      fromVenue?.region,
      numbers.get(segment.to_race_id),
      segment.to_race_id,
      segment.to_circuit_id,
      toVenue?.name ?? toRace?.circuit_name,
      toVenue?.city,
      toVenue?.country,
      toVenue?.region,
      toRace?.weekend_id,
      segment.distance_km,
      regionChanged,
    ];
  });

  const csv = toCsv(
    [
      "season_year", "run_id", "leg_number", "segment_id", "from_race_number", "from_race_id",
      "from_circuit_id", "from_circuit_name", "from_city", "from_country", "from_region",
      "to_race_number", "to_race_id", "to_circuit_id", "to_circuit_name", "to_city",
      "to_country", "to_region", "to_weekend_id", "distance_km", "region_changed",
    ],
    rows,
  );
  saveCsv(`ecorace-${run.run_id}-travel-legs.csv`, csv);
}
