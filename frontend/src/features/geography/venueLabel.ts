import type { Circuit } from "@/lib/types";

// Venue taxonomy derived from existing data fields (no backend change):
// current-season membership beats history beats bare Grade 1 certification.
// Defensive: older API payloads may omit enrichment fields entirely.
export type VenueLabel = `F1 ${number}` | "Former F1 venue" | "FIA Grade 1";

export function venueLabel(c: Circuit, seasonYear: number): VenueLabel {
  if (c.f1_current_2026 === true && seasonYear === 2026) return "F1 2026";
  if ((c.f1_hosted_seasons ?? []).length > 0) return "Former F1 venue";
  return "FIA Grade 1";
}
