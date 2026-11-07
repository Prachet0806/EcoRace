"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageContainer } from "@/components/layout/PageContainer";
import { useCircuits } from "@/features/circuits/useCircuits";
import { ScenarioHeader } from "@/features/builder/ScenarioHeader";
import { CalendarTimeline } from "@/features/results/CalendarTimeline";
import { ConstraintDiagnostics } from "@/features/results/ConstraintDiagnostics";
import { MetricsDashboard } from "@/features/results/MetricsDashboard";
import { PlanComparison } from "@/features/results/PlanComparison";
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
  const download = () => {
    if (load.state !== "ready") return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(load.run, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `ecorace-${load.run.run_id}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

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

  if (load.state === "missing" || load.state === "invalid") {
    const isInvalid = load.state === "invalid";
    return (
      <AppShell onBack={back}>
        <PageContainer>
          <div className="flex min-h-[55vh] max-w-xl flex-col justify-center">
            <h1 className="font-display text-3xl font-medium">Result not available</h1>
            <p className="mt-3 text-sm leading-6 text-mute">
              {isInvalid
                ? "The stored result for this run is corrupted and cannot be displayed."
                : <>
                    Run <span className="font-tel">{runId}</span> is not available in this browser session.
                    Results are kept in session storage only and are cleared when the tab is closed.
                  </>
              }
              {" "}Run the optimization again to generate a new result.
            </p>
            <button type="button" onClick={back} className="mt-5 self-start rounded-lg bg-rosso px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rosso-hi">
              Return to planner
            </button>
          </div>
        </PageContainer>
      </AppShell>
    );
  }

  const { run } = load;
  return (
    <AppShell onBack={back}>
      <PageContainer>
        <ScenarioHeader
          kicker="Optimization result"
          title={
            <>
              Optimized {run.season_year} calendar
            </>
          }
          meta={`${run.run_id} · season ${run.season_year} · ${run.calendar.race_count} races · this browser session`}
          badge={
            <span className="rounded-md border border-hairline px-3 py-1 font-tel text-xs text-mute">
              {run.status === "feasible_timeout" ? "Feasible · time limit reached" : run.status === "feasible" ? "Feasible" : run.status.replaceAll("_", " ")}
            </span>
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-sm text-mute">
            This route minimizes estimated great-circle travel distance while meeting the listed calendar and weather constraints.
            The longest legs and region changes below help judge its practical travel pattern.
          </p>
          <button type="button" onClick={download} className="min-h-10 shrink-0 rounded-lg border border-hairline px-3 py-2 font-tel text-sm hover:bg-lift">
            Download result JSON
          </button>
        </div>

        <MetricsDashboard run={run} />
        <PlanComparison run={run} />

        <section aria-label="Route map">
          <RouteMap key={run.run_id} run={run} hovered={hovered} />
        </section>

        <CalendarTimeline run={run} hovered={hovered} onHover={setHovered} />

        <div className="grid gap-4 lg:grid-cols-2">
          <TravelLegs run={run} circuits={circuits} hovered={hovered} onHover={setHovered} />
          <ConstraintDiagnostics run={run} />
        </div>

        <RunProvenance run={run} />
      </PageContainer>
    </AppShell>
  );
}
