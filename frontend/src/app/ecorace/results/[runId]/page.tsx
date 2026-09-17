"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { use } from "react";
import { useState } from "react";
import { Pinstripe } from "@/components/ui/Pinstripe";
import { CalendarTimeline } from "@/features/results/CalendarTimeline";
import { ConstraintDiagnostics } from "@/features/results/ConstraintDiagnostics";
import { MetricsDashboard } from "@/features/results/MetricsDashboard";
import { TravelLegs } from "@/features/results/TravelLegs";
import { useRunResult } from "@/features/results/useRunResult";
import type { HoverTarget } from "@/lib/types";

// Client-only: MapLibre needs window/WebGL.
const RouteMap = dynamic(() => import("@/components/map/RouteMap").then((m) => m.RouteMap), { ssr: false });

// Chequered divider: single celebratory use at the results header.
function Chequered() {
  return (
    <div
      aria-hidden="true"
      className="h-2 w-full rounded-sm opacity-80"
      style={{
        background:
          "repeating-conic-gradient(#f5f5f4 0% 25%, #141417 0% 50%) 0 0 / 16px 16px",
      }}
    />
  );
}

// Results: Inspect (09 §7). Back preserves the draft via the zustand store.
export default function ResultsPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params);
  const router = useRouter();
  const load = useRunResult(runId);
  const [hovered, setHovered] = useState<HoverTarget>(null);

  const back = (
    <button
      type="button"
      onClick={() => router.push("/ecorace")}
      className="rounded border border-hairline px-3 py-1 text-sm text-mute underline transition-colors hover:border-rosso hover:text-ink"
    >
      ← Back to scenario builder
    </button>
  );

  if (load.state === "loading") {
    return (
      <main className="mx-auto max-w-5xl space-y-4 bg-base p-4 text-ink">
        <p role="status" className="font-tel text-sm text-mute">
          Loading result…
        </p>
      </main>
    );
  }

  if (load.state === "missing") {
    return (
      <main className="mx-auto max-w-5xl space-y-4 bg-base p-4 text-ink">
        <h1 className="font-display text-2xl font-extrabold tracking-tight italic">Result not available</h1>
        <p className="text-sm text-mute">
          Run <span className="font-tel">{runId}</span> was not found. MVP runs live in the API&apos;s memory, so a
          backend restart clears them — re-run the optimization to get a fresh result.
        </p>
        {back}
      </main>
    );
  }

  if (load.state === "error") {
    return (
      <main className="mx-auto max-w-5xl space-y-4 bg-base p-4 text-ink">
        <h1 className="font-display text-2xl font-extrabold tracking-tight italic">Could not load result</h1>
        <p role="alert" className="rounded border border-rosso p-2 font-tel text-sm">
          {load.code}: {load.message}
        </p>
        {back}
      </main>
    );
  }

  const { run, source } = load;
  return (
    <main className="mx-auto max-w-5xl space-y-4 bg-base p-4 text-ink">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight italic">
              Optimization <span className="text-rosso">result</span>
            </h1>
            <p className="font-tel text-sm text-mute">
              {run.run_id} · season {run.season_year} · loaded from {source === "session" ? "this browser" : "API"}
            </p>
          </div>
          {back}
        </div>
        <Chequered />
      </header>

      <MetricsDashboard run={run} />

      <div className="grid gap-4 lg:grid-cols-2">
        <CalendarTimeline run={run} hovered={hovered} onHover={setHovered} />
        <div className="space-y-4">
          <RouteMap key={run.run_id} run={run} hovered={hovered} />
          <TravelLegs run={run} hovered={hovered} onHover={setHovered} />
        </div>
      </div>

      <ConstraintDiagnostics run={run} />

      <footer className="text-xs text-mute">
        <Pinstripe className="mb-2 opacity-60" />
        Decision-support output: distances are great-circle approximations, weather reflects the configured
        feasibility policy ({run.data_version}). Not an official F1 calendar.
      </footer>
    </main>
  );
}
