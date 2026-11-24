import type { RunPayload } from "@/lib/types";
import { constraintReportState, summarizeActiveConstraints } from "@/features/results/constraintSummary";

function dateLabel(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(parsed.valueOf())
    ? date
    : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed);
}

function number(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Unavailable";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);
}

function statusLabel(run: RunPayload): string {
  if (run.status === "feasible_timeout") return "Feasible · time limit reached";
  if (run.status === "feasible") return "Feasible";
  return run.status.replaceAll("_", " ");
}

export function RunReport({ run }: { run: RunPayload }) {
  const racesById = new Map(run.calendar.races.map((race) => [race.race_id, race]));
  const incoming = new Map(run.segments.map((segment) => [segment.to_race_id, segment]));
  const activeConstraints = summarizeActiveConstraints(run);
  const provenance = run.provenance;

  return (
    <article className="report-sheet print-only-report">
      <header className="report-header">
        <p className="report-kicker">ECORACE · CALENDAR PLANNER</p>
        <div className="report-title-row">
          <div>
            <h1>Optimized {run.season_year} calendar</h1>
            <p className="report-subtitle">Race schedule and route summary</p>
          </div>
          <span className="report-status">{statusLabel(run)}</span>
        </div>
        <p className="report-run-id">Run {run.run_id}</p>
      </header>

      <section className="report-section" aria-labelledby="report-summary-title">
        <h2 id="report-summary-title">Route summary</h2>
        <div className="report-metrics">
          <div><span>Total route distance</span><strong>{number(run.metrics.total_distance_km)} km</strong></div>
          <div><span>Baseline distance</span><strong>{run.metrics.baseline_distance_km === null ? `Unavailable · ${run.metrics.baseline_status.replaceAll("_", " ")}` : `${number(run.metrics.baseline_distance_km)} km`}</strong></div>
          <div><span>Distance saved</span><strong>{run.metrics.saving_km === null ? "Unavailable" : `${number(run.metrics.saving_km)} km`}</strong></div>
          <div><span>Longest leg</span><strong>{run.metrics.longest_hop_km === undefined ? "Unavailable" : `${number(run.metrics.longest_hop_km)} km`}</strong></div>
          <div><span>Regional re-entries</span><strong>{number(run.metrics.region_backtracks)}</strong></div>
          <div><span>Races / weekends</span><strong>{run.calendar.race_count} / {run.calendar.weekend_count}</strong></div>
          <div><span>Active constraints passed</span><strong>{activeConstraints.passed} / {activeConstraints.active}</strong></div>
        </div>
      </section>

      <section className="report-section" aria-labelledby="report-scenario-title">
        <h2 id="report-scenario-title">Scenario</h2>
        <dl className="report-facts">
          <div><dt>Season</dt><dd>{run.season_year}</dd></div>
          <div><dt>Maximum consecutive races</dt><dd>{provenance?.scenario.max_consecutive ?? "Unavailable"}</dd></div>
          <div><dt>Summer break</dt><dd>{run.calendar.breaks.length > 0 ? `${run.calendar.breaks.length} weekends` : "None"}</dd></div>
          <div><dt>Finale pinned</dt><dd>{provenance ? (provenance.scenario.pin_end_to_dec_week1 ? "Yes" : "No") : "Unavailable"}</dd></div>
          <div><dt>Solver</dt><dd>{run.solver.name} {run.solver.version}</dd></div>
          <div><dt>Optimality</dt><dd>{run.solver.optimality_proven ? "Proven optimal" : "Best found; optimality not proven"}</dd></div>
        </dl>
      </section>

      <section className="report-section" aria-labelledby="report-calendar-title">
        <h2 id="report-calendar-title">Race schedule</h2>
        <table className="report-table">
          <thead><tr><th>#</th><th>Weekend</th><th>Venue</th><th>Previous venue</th><th className="numeric">Leg km</th></tr></thead>
          <tbody>
            {run.calendar.races.map((race, index) => {
              const leg = incoming.get(race.race_id);
              const previousRace = leg ? racesById.get(leg.from_race_id) : undefined;
              return (
                <tr key={race.race_id}>
                  <td>{index + 1}</td>
                  <td>{dateLabel(race.friday)}–{dateLabel(race.sunday)}</td>
                  <td>{race.circuit_name}</td>
                  <td>{previousRace?.circuit_name ?? "Season start"}</td>
                  <td className="numeric">{leg ? number(leg.distance_km) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="report-section report-legs" aria-labelledby="report-legs-title">
        <h2 id="report-legs-title">Travel legs</h2>
        <table className="report-table">
          <thead><tr><th>Leg</th><th>From</th><th>To</th><th className="numeric">Distance (km)</th></tr></thead>
          <tbody>
            {run.segments.map((segment, index) => (
              <tr key={segment.segment_id}>
                <td>{index + 1}</td>
                <td>{racesById.get(segment.from_race_id)?.circuit_name ?? segment.from_circuit_id}</td>
                <td>{racesById.get(segment.to_race_id)?.circuit_name ?? segment.to_circuit_id}</td>
                <td className="numeric">{number(segment.distance_km)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="report-section" aria-labelledby="report-constraints-title">
        <h2 id="report-constraints-title">Constraint checks</h2>
        <ul className="report-constraint-list">
          {run.constraints.map((constraint) => {
            const state = constraintReportState(constraint, run);
            const style = state === "PASS" ? "report-check-pass"
              : state === "REVIEW" ? "report-check-fail"
                : state === "NOT APPLICABLE" ? "report-check-na" : "report-check-unknown";
            return (
              <li key={constraint.name}>
                <span className={style}>{state}</span>
                <span>{constraint.name}</span>
                {state === "REVIEW" && constraint.violations.length > 0 && (
                  <span className="report-muted">{constraint.violations.length} violation(s)</span>
                )}
              </li>
            );
          })}
        </ul>
        {run.constraints.some((constraint) => constraint.violations.length > 0) && (
          <table className="report-table report-violations">
            <thead><tr><th>Constraint</th><th>Issue</th><th>Weekend</th><th>Circuit ID</th></tr></thead>
            <tbody>
              {run.constraints.flatMap((constraint) => constraint.violations.map((violation, index) => (
                <tr key={`${constraint.name}-${violation.code}-${index}`}>
                  <td>{constraint.name}</td><td>{violation.message}</td><td>{violation.weekend_id}</td><td>{violation.circuit_id}</td>
                </tr>
              )))}
            </tbody>
          </table>
        )}
      </section>

      <section className="report-section" aria-labelledby="report-provenance-title">
        <h2 id="report-provenance-title">Run provenance</h2>
        <dl className="report-facts report-provenance">
          <div><dt>Data version</dt><dd>{run.data_version}</dd></div>
          <div><dt>Weather policy</dt><dd>{provenance?.weather_version ?? "Unavailable"}{provenance?.weather_synthetic ? " · synthetic demo data" : ""}</dd></div>
          <div><dt>Solver seed</dt><dd>{run.solver.seed}</dd></div>
          <div><dt>Runtime</dt><dd>{number(run.solver.runtime_ms / 1000, 1)} s</dd></div>
          <div><dt>Requested budget</dt><dd>{provenance ? `${number(provenance.requested_budget_s, 1)} s` : "Unavailable"}</dd></div>
          <div><dt>Region changes</dt><dd>{number(run.metrics.region_changes)}</dd></div>
        </dl>
      </section>

      <footer className="report-footer">
        Distances are great-circle estimates, not emissions. {provenance?.weather_synthetic === true
          ? "Weather data is a synthetic demonstration fixture."
          : provenance?.weather_synthetic === false
            ? "Weather data is from the source identified in run provenance."
            : "Weather data source is not recorded in run provenance."}
        {" "}This report summarizes a planning result and is not an authoritative race calendar.
      </footer>
    </article>
  );
}
