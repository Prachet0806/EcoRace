"use client";

import type { Circuit } from "@/lib/types";
import rawCatalog from "./catalog.json";

// Frontend-owned catalog snapshot; optimization uses the backend copy.
const CIRCUITS = [...(rawCatalog as { circuits: Circuit[] }).circuits].sort((a, b) =>
  a.name.localeCompare(b.name),
);

export function useCircuits() {
  return { circuits: CIRCUITS };
}
