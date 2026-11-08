"use client";

import type { Circuit } from "@/lib/types";
import rawCatalog from "./catalog.json";

// Frontend-owned catalog snapshot; optimization uses the backend copy.
export function useCircuits() {
  const circuits = [...(rawCatalog as { circuits: Circuit[] }).circuits].sort((a, b) => a.name.localeCompare(b.name));
  return { circuits };
}
