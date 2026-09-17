"use client";

import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export const DARK_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// Vendored module worker (public/maplibre/, pinned to the installed
// maplibre-gl version). Turbopack rewrites import.meta.url inside the
// bundled library, so the default relative worker URL 404s and tile parsing
// stalls silently (black map, no errors). Explicit URL fixes it. The worker
// and maplibre-gl-shared.mjs must stay side by side (relative import).
let workerUrlConfigured = false;

export function ensureWorkerUrl() {
  if (!workerUrlConfigured) {
    maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
    workerUrlConfigured = true;
  }
}

export { maplibregl };
