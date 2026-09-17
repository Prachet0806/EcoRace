"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { use } from "react";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { useCircuits } from "@/features/circuits/useCircuits";
import { ScenarioHeader } from "@/features/builder/ScenarioHeader";
import { CalendarTimeline } from "@/features/results/CalendarTimeline";
import { ConstraintDiagnostics } from "@/features/results/ConstraintDiagnostics";
import { MetricsDashboard } from "@/features/results/MetricsDashboard";
import { RunProvenance } from "@/features/results/RunProvenance";
import { TravelLegs } from "@/features/results/TravelLegs";
import { useRunResult } from "@/features/results/useRunResult";
import type { HoverTarget } from "@/lib/types";

// Client-only: MapLibre needs window/WebGL.
const RouteMap = dynamic(() => import("@/components/map/RouteMap").then((m) => m.RouteMap), { ssr: false });

// Results workstation: header → impact → hero map → calendar →
// travel analysis + diagnostics → provenance. Back preserves the draft
// via the zustand store.
export default function ResultsPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params);
  const router = useRouter();
  const load = useRunResult(runId);
  const { circuits } = useCircuits();
  const [hovered, setHovered] = useState<HoverTarget>(null);
  const back = () => router.push("/");

  if (load.state === "loading") {
    return (
      <AppShell>
        <PageContainer>
          <p role="status" className="font-tel text-sm text-mute">
            Loading result…
          </p>
          <div className="space-y-2" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-lg border border-hairline bg-card" />
            ))}
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  if (load.state === "missing") {
    return (
      <AppShell onBack={back}>
        <PageContainer>
          <h1 className="font-display text-2xl font-extrabold tracking-tight italic">Result not available</h1>
          <p className="text-sm text-mute">
            Run <span className="font-tel">{runId}</span> was not found. MVP runs live in the API&apos;s memory, so a
            backend restart clears them — re-run the optimization to get a fresh result.
          </p>
        </PageContainer>
      </AppShell>
    );
  }

  if (load.state === "error") {
    return (
      <AppShell onBack={back}>
        <PageContainer>
          <h1 className="font-display text-2xl font-extrabold tracking-tight italic">Could not load result</h1>
          <p role="alert" className="rounded border border-rosso p-2 font-tel text-sm">
            {load.code}: {load.message}
          </p>
        </PageContainer>
      </AppShell>
    );
  }

  const { run, source } = load;
  return (
    <AppShell onBack={back}>
      <PageContainer>
        <ScenarioHeader
          kicker="EcoRace · Optimization result"
          title={
            <>
              Optimized <span className="text-rosso">calendar</span>
            </>
          }
          meta={`${run.run_id} · season ${run.season_year} · ${run.calendar.race_count} races · loaded from ${source === "session" ? "this browser" : "API"}`}
          badge={
            <span className="rounded border border-hairline px-2 py-1 font-tel text-xs tracking-widest text-mute uppercase">
              {run.status}
            </span>
          }
        />

        <MetricsDashboard run={run} />

        <section aria-label="Route map">
          <RouteMap key={run.run_id} run={run} hovered={hovered} />
        </section>

        <CalendarTimeline run={run} hovered={hovered} onHover={setHovered} />

        <div className="grid gap-4 lg:grid-cols-2">
          <TravelLegs run={run} circuits={circuits} hovered={hovered} onHover={setHovered} />
          <ConstraintDiagnostics run={run} />
        </div>

        <RunProvenance run={run} source={source} />
      </PageContainer>
    </AppShell>
  );
}
