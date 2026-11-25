# CP-SAT diagnosis on the 0.1 CPU service

The API runs one CP-SAT attempt after the heuristic. The heuristic remains a
validated fallback. A `feasible` response with `solver.origin = heuristic`
does not mean that CP-SAT found a solution; inspect `provenance.attempts`.

## Measurements

Each attempt now reports its raw CP-SAT status, actual solver limit, model-build
time, solver wall and user time, process CPU time, model variable and constraint
counts, hint presence, branch/conflict counts, and first-solution time and
objective when a solution appeared. `MODEL_INVALID` is reported as solver
failure; `UNKNOWN` with no candidate remains a solver timeout.

`provenance.timing_ms` separates data loading, precheck, baseline, heuristic,
hint validation, pipeline, and presentation. `total_runtime_ms` covers the
application service through result construction. The access log's
`duration_ms` covers the HTTP route; client time also includes network and
cold-start delay.

With `SOLVER_DIAGNOSTICS=1`, CP-SAT progress is written to the service log,
bounded to 64,000 characters per attempt. Use `trace_id` from the response to
find that log. `search_started`, `presearch_ms`, and `presolve_estimate_ms` are
derived from OR-Tools progress markers. The presolve estimate is not a native
OR-Tools metric. A `null` value means the marker was not observed. Ordinary
requests should use `SOLVER_DIAGNOSTICS=0` to avoid logging overhead.

## Hosted comparison

Keep `SOLVER_TIMEOUT_SECONDS=45` and `SOLVER_MAX_CONCURRENT=1`. Use the same
request JSON, dataset, seed, region, and 0.1 CPU plan for both settings.
Record the Render memory graph during each series; the in-process trace does
not measure peak container memory.

1. Deploy with `SOLVER_CP_SAT_PRESOLVE=1` and `SOLVER_DIAGNOSTICS=1`.
2. Run three warm requests, saving responses and a summary:

   ```powershell
   python backend/tests/bench_hosted_presolve.py run --base-url https://YOUR-API.onrender.com --payload .\backend\tests\fixtures\hosted-24-request.json --label presolve-on --repeat 3
   ```

3. Set `SOLVER_CP_SAT_PRESOLVE=0`, redeploy, and run the same command with
   `--label presolve-off`. The script calls `/api/v1/health` before the first
   measured request to wake the free service.
4. Compare the two generated `summary.json` paths:

   ```powershell
   python backend/tests/bench_hosted_presolve.py compare .\benchmark-results\presolve-on-...\summary.json .\benchmark-results\presolve-off-...\summary.json
   ```

The comparison rejects different request hashes or dataset versions. It
reports the number of CP-SAT candidates, median client and service time, and
median time to search and first solution. Each run includes an `X-Request-Id`
in its summary; use that ID to correlate the access log. The full response
JSON is saved beside the summary. Do not interpret a single faster run as a
reliable change on a shared 0.1 CPU instance.

## Reading the result

- Large `model_build_ms`: investigate preparation and model construction.
- Large `presearch_ms` with no search: compare presolve off and inspect the
  bounded progress log before changing constraints.
- Search starts but no first solution: inspect whether the feasible hint was
  accepted and which search phase ran. Then investigate the table, element,
  and objective encoding without weakening hard constraints.
- First solution appears but the API selects the heuristic: compare objective
  and independent validator results; the selection policy may prefer the
  heuristic for operational route quality.

Keep a setting only if repeated 24-race runs on the target plan produce
validator-clean CP-SAT candidates or a useful selected-route improvement
within the request budget. A timed-out attempt still does not prove
optimality.
