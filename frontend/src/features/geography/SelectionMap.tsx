"use client";

import { useEffect, useRef, useState } from "react";
import { DARK_STYLE, ensureWorkerUrl, maplibregl } from "@/components/map/maplibre";
import { SectionLabel } from "@/features/shared/SectionLabel";
import type { Circuit } from "@/lib/types";

interface Props {
  selected: Circuit[];
}

// Geographic preview: a small live MapLibre map (dark basemap, yellow
// markers) so the selection reads as geography, not dots on black.
// Descriptive only — never an optimization input. Static preview:
// non-interactive, markers refresh from props.
export function SelectionMap({ selected }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const selectedRef = useRef<Circuit[]>(selected);
  selectedRef.current = selected;
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let map: maplibregl.Map | null = null;
    try {
      ensureWorkerUrl();
      map = new maplibregl.Map({
        container: containerRef.current,
        style: DARK_STYLE,
        center: [10, 30],
        zoom: 1,
        interactive: false,
        attributionControl: false,
      });
    } catch (e: unknown) {
      setFailed(e instanceof Error ? e.message : "WebGL unavailable.");
      return;
    }
    const paint = () => {
      const pts = selectedRef.current;
      const data = {
        type: "FeatureCollection" as const,
        features: pts.map((c) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [c.longitude, c.latitude] as [number, number] },
          properties: { id: c.id, name: c.name },
        })),
      };
      const existing = map!.getSource("selected") as maplibregl.GeoJSONSource | undefined;
      if (existing) {
        existing.setData(data);
      } else {
        map!.addSource("selected", { type: "geojson", data });
        map!.addLayer({
          id: "selected-dots",
          type: "circle",
          source: "selected",
          paint: {
            "circle-color": "#ffeb00",
            "circle-radius": 5,
            "circle-stroke-color": "#0a0a0b",
            "circle-stroke-width": 1.5,
          },
        });
      }
      if (pts.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        for (const c of pts) bounds.extend([c.longitude, c.latitude]);
        map!.fitBounds(bounds, { padding: 30, maxZoom: 3 });
      }
    };
    map.on("load", () => {
      containerRef.current?.setAttribute("data-map-loaded", "true");
      paint();
    });
    mapRef.current = map;
    return () => {
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // Refresh markers when the selection changes (style may load later).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const data = {
      type: "FeatureCollection" as const,
      features: selected.map((c) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [c.longitude, c.latitude] as [number, number] },
        properties: { id: c.id, name: c.name },
      })),
    };
    const existing = map.getSource("selected") as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
      if (selected.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        for (const c of selected) bounds.extend([c.longitude, c.latitude]);
        map.fitBounds(bounds, { padding: 30, maxZoom: 3 });
      }
    }
  }, [selected]);

  if (failed) {
    return <p role="alert" className="rounded border border-rosso bg-card p-3 text-sm">Preview unavailable: {failed}</p>;
  }

  return (
    <section aria-label="Geographic preview" className="rounded-lg border border-hairline bg-card p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <SectionLabel>Geographic preview</SectionLabel>
        <p className="font-tel text-xs text-mute">{selected.length} plotted</p>
      </div>
      <div ref={containerRef} role="img" aria-label={`World map showing ${selected.length} selected circuit locations`} className="h-64 w-full rounded border border-hairline" />
      <p className="mt-1 text-xs text-mute">Live footprint of your selection — the optimizer turns this into a route.</p>
    </section>
  );
}
