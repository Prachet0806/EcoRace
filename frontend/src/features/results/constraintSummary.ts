import type { ConstraintStatus, RunPayload } from "@/lib/types";

export type ConstraintReportState = "PASS" | "REVIEW" | "NOT APPLICABLE" | "NOT RECORDED";

export function constraintReportState(
  constraint: ConstraintStatus,
  run: RunPayload,
): ConstraintReportState {
  const scenario = run.provenance?.scenario;
  if (constraint.name === "summer_break") {
    if (!scenario) return "NOT RECORDED";
    if (scenario.summer_break_start === null || scenario.summer_break_end === null) return "NOT APPLICABLE";
  }
  if (constraint.name === "dec_end_pin") {
    if (!scenario) return "NOT RECORDED";
    if (!scenario.pin_end_to_dec_week1) return "NOT APPLICABLE";
  }
  return constraint.satisfied ? "PASS" : "REVIEW";
}

export function summarizeActiveConstraints(run: RunPayload): { passed: number; active: number } {
  const states = run.constraints.map((constraint) => constraintReportState(constraint, run));
  const active = states.filter((state) => state === "PASS" || state === "REVIEW");
  return {
    passed: active.filter((state) => state === "PASS").length,
    active: active.length,
  };
}
