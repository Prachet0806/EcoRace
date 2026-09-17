import type { Circuit } from "@/lib/types";

// Chronological 2026 FIA Formula One World Championship order
// (FIA/FOM calendar announcement 2026-06-10; Madrid debut, Imola dropped).
// Used for the official venue-set preset so the left pane — and therefore
// the baseline, which follows input order — reflects the real season.
const OFFICIAL_2026_ORDER = [
  "albert_park",
  "shanghai",
  "suzuka",
  "bahrain",
  "jeddah",
  "miami",
  "montreal",
  "monaco",
  "catalunya",
  "spielberg",
  "silverstone",
  "spa",
  "hungaroring",
  "zandvoort",
  "monza",
  "madring",
  "baku",
  "singapore",
  "austin",
  "mexico_city",
  "interlagos",
  "las_vegas",
  "lusail",
  "abu_dhabi",
];

// Official 2026 venue-set preset (ADR-FE-007): flagged circuits in
// chronological race order. IDs absent from the order list (data drift)
// append in library order rather than vanishing.
export function official2026VenueIds(circuits: Circuit[]): string[] {
  const flagged = circuits.filter((c) => c.f1_current_2026 === true).map((c) => c.id);
  const rank = new Map(OFFICIAL_2026_ORDER.map((id, i) => [id, i]));
  return [...flagged].sort((a, b) => (rank.get(a) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b) ?? Number.MAX_SAFE_INTEGER));
}
