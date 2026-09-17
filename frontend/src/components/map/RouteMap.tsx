"use client";

import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { greatCirclePoints } from "@/lib/geo";
import type { HoverTarget, RunPayload } from "@/lib/types";

const STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

interface Props {
  run: RunPayload;
  hovered: HoverTarget;
}

// Interactive route map (P0-10/11): consumes API races/segments only.
// Great-circle arcs; hover sync via race_id/segment_id with timeline + legs.
// Loaded with ssr:false (WebGL needs window).
export function RouteMap({ run, hovered }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const points = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: run.calendar.races.map((r, i) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [r.longitude, r.latitude] as [number, number] },
        properties: { race_id: r.race_id, name: r.circuit_name, seq: i + 1 },
      })),
    }),
    [run],
  );

  const lines = useMemo(() => {
    const byRace = new Map(run.calendar.races.map((r) => [r.race_id, r]));
    return {
      type: "FeatureCollection" as const,
      features: run.segments.map((s) => {
        const a = byRace.get(s.from_race_id)!;
        const b = byRace.get(s.to_race_id)!;
        return {
          type: "Feature" as const,
          geometry: {
            type: "LineString" as const,
            coordinates: greatCirclePoints(a.latitude, a.longitude, b.latitude, b.longitude),
          },
          properties: { segment_id: s.segment_id, from_race: s.from_race_id, to_race: s.to_race_id },
        };
      }),
    };
  }, [run]);

  const highlightSegmentIds = useMemo(() => {
    if (!hovered) return [];
    if (hovered.kind === "segment") return [hovered.id];
    return run.segments
      .filter((s) => s.from_race_id === hovered.id || s.to_race_id === hovered.id)
      .map((s) => s.segment_id);
  }, [hovered, run]);

  const highlightRaceIds = useMemo(() => {
    if (!hovered) return [];
    if (hovered.kind === "race") return [hovered.id];
    const seg = run.segments.find((s) => s.segment_id === hovered.id);
    return seg ? [seg.from_race_id, seg.to_race_id] : [];
  }, [hovered, run]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let map: maplibregl.Map | null = null;
    try {
      map = new maplibregl.Map({ container: containerRef.current, style: STYLE, center: [10, 30], zoom: 1.2 });
    } catch (e: unknown) {
      setFailed(e instanceof Error ? e.message : "WebGL unavailable.");
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("load", () => {
      map!.addSource("route", { type: "geojson", data: lines });
      map!.addSource("races", { type: "geojson", data: points });
      map!.addLayer({ id: "route-base", type: "line", source: "route", paint: { "line-color": "#71717a", "line-width": 1.5, "line-opacity": 0.7 } });
      map!.addLayer({ id: "route-hi", type: "line", source: "route", paint: { "line-color": "#e10600", "line-width": 3.5 }, filter: ["==", ["get", "segment_id"], ""] });
      map!.addLayer({ id: "race-base", type: "circle", source: "races", paint: { "circle-color": "#ffeb00", "circle-radius": 5, "circle-stroke-color": "#0a0a0b", "circle-stroke-width": 1.5 } });
      map!.addLayer({ id: "race-hi", type: "circle", source: "races", paint: { "circle-color": "#e10600", "circle-radius": 8 }, filter: ["==", ["get", "race_id"], ""] });
      map!.addLayer({
        id: "race-labels", type: "symbol", source: "races",
        layout: { "text-field": ["get", "seq"], "text-size": 9, "text-offset": [0, -1.2] },
        paint: { "text-color": "#f5f5f4", "text-halo-color": "#0a0a0b", "text-halo-width": 1 },
      });
      const bounds = new maplibregl.LngLatBounds();
      for (const f of points.features) bounds.extend(f.geometry.coordinates);
      map!.fitBounds(bounds, { padding: 40 });
    });
    return () => {
      map?.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // NOTE: the page keys this component by run_id, so sources are built fresh
  // per run in the onload handler above; no setData refresh needed.

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    map.setFilter("route-hi", highlightSegmentIds.length ? ["in", ["get", "segment_id"], ["literal", highlightSegmentIds]] : ["==", ["get", "segment_id"], ""]);
    map.setFilter("race-hi", highlightRaceIds.length ? ["in", ["get", "race_id"], ["literal", highlightRaceIds]] : ["==", ["get", "race_id"], ""]);
  }, [highlightSegmentIds, highlightRaceIds]);

  if (failed) return <p role="alert" className="rounded border border-rosso bg-card p-3 text-sm">Map unavailable: {failed}</p>;

  return <div ref={containerRef} aria-label="Route map" className="h-[480px] w-full rounded-lg border border-hairline" />;
}
