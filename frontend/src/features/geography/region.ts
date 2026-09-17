import type { Circuit } from "@/lib/types";

// Display mapping for raw data regions. Unknown regions fall through to
// their raw value so new data can never break the filter UI.
const DISPLAY: Record<string, string> = {
  Europe: "Europe",
  "Europe/Asia": "Europe/Asia",
  Asia: "Asia",
  "Middle East": "Middle East",
  "North America": "Americas",
  "South America": "Americas",
  Oceania: "Oceania",
};

export function displayRegion(raw: string): string {
  return DISPLAY[raw] ?? raw;
}

export function distinctRegions(circuits: Circuit[]): string[] {
  const seen = new Map<string, string>();
  for (const c of circuits) {
    const d = displayRegion(c.region);
    if (!seen.has(d)) seen.set(d, c.region);
  }
  // Stable order: first appearance in the (alphabetical) library.
  return [...seen.keys()];
}

export function countByRegion(circuits: Circuit[]): Array<{ region: string; count: number }> {
  const counts = new Map<string, number>();
  for (const c of circuits) {
    const d = displayRegion(c.region);
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return distinctRegions(circuits).map((region) => ({ region, count: counts.get(region) ?? 0 }));
}
