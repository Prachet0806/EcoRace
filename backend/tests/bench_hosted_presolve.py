"""Repeat the same hosted optimization request and compare presolve settings.

Run each setting after setting SOLVER_CP_SAT_PRESOLVE on the deployed API.
This script uses only the Python standard library and never changes the API.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import statistics
import time
import urllib.error
import urllib.request
import uuid
from datetime import UTC, datetime
from pathlib import Path


def _request(
    url: str, payload: dict | None, timeout_s: float, request_id: str | None = None
) -> tuple[int, dict]:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Content-Type": "application/json"} if data is not None else {}
    if request_id is not None:
        headers["X-Request-Id"] = request_id
    request = urllib.request.Request(
        url,
        data=data,
        headers=headers,
        method="POST" if data is not None else "GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout_s) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as exc:
        try:
            body = json.load(exc)
        except (ValueError, UnicodeDecodeError):
            body = {"error": {"message": str(exc)}}
        return exc.code, body


def _run(args: argparse.Namespace) -> None:
    if not re.fullmatch(r"[A-Za-z0-9_-]+", args.label):
        raise SystemExit("--label must use only letters, digits, underscores, or hyphens")
    if args.repeat < 1:
        raise SystemExit("--repeat must be positive")
    base_url = args.base_url.rstrip("/")
    if not base_url.startswith(("http://", "https://")):
        raise SystemExit("--base-url must start with http:// or https://")
    payload = json.loads(args.payload.read_text(encoding="utf-8"))
    payload_hash = hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    output_dir = args.output_dir / f"{args.label}-{stamp}-{uuid.uuid4().hex[:6]}"
    output_dir.mkdir(parents=True)

    # Complete the free-service cold start before timing optimization requests.
    health_status, health = _request(f"{base_url}/api/v1/health", None, args.timeout)
    if health_status != 200:
        raise SystemExit(f"Health check failed: HTTP {health_status}: {health}")

    runs = []
    for number in range(1, args.repeat + 1):
        request_id = f"bench-{uuid.uuid4().hex[:12]}"
        started = time.perf_counter()
        try:
            http_status, body = _request(
                f"{base_url}/api/v1/optimization/runs", payload, args.timeout, request_id
            )
            error = None
        except (OSError, TimeoutError) as exc:
            http_status, body, error = None, {}, str(exc)
        client_ms = int((time.perf_counter() - started) * 1000)
        (output_dir / f"response-{number:02d}.json").write_text(
            json.dumps(body, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        provenance = body.get("provenance", {})
        attempts = provenance.get("attempts", [])
        attempt = attempts[0] if attempts else {}
        run = {
            "number": number,
            "request_id": request_id,
            "http_status": http_status,
            "error": error,
            "client_ms": client_ms,
            "service_ms": provenance.get("total_runtime_ms"),
            "raw_status": attempt.get("raw_status"),
            "presolve": attempt.get("presolve"),
            "search_started": attempt.get("search_started"),
            "presearch_ms": attempt.get("presearch_ms"),
            "presolve_estimate_ms": attempt.get("presolve_estimate_ms"),
            "first_solution_ms": attempt.get("first_solution_ms"),
            "candidate_km": attempt.get("km"),
            "selected_origin": body.get("solver", {}).get("origin"),
            "selected_km": body.get("metrics", {}).get("total_distance_km"),
            "trace_id": attempt.get("trace_id"),
        }
        runs.append(run)
        print(json.dumps(run, sort_keys=True))

    summary = {
        "label": args.label,
        "payload_sha256": payload_hash,
        "dataset_version": health.get("dataset_version"),
        "base_url": base_url,
        "runs": runs,
    }
    path = output_dir / "summary.json"
    path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(f"Saved {path}")


def _median(runs: list[dict], key: str) -> float | None:
    values = [run[key] for run in runs if run.get(key) is not None]
    return statistics.median(values) if values else None


def _compare(args: argparse.Namespace) -> None:
    left = json.loads(args.first.read_text(encoding="utf-8"))
    right = json.loads(args.second.read_text(encoding="utf-8"))
    if left["payload_sha256"] != right["payload_sha256"]:
        raise SystemExit("The requests differ; compare runs with the same payload")
    if left["dataset_version"] != right["dataset_version"]:
        raise SystemExit("The datasets differ; compare runs from the same deployment data")
    settings = {
        run.get("presolve") for summary in (left, right) for run in summary["runs"]
    }
    if settings != {True, False}:
        raise SystemExit("Expected one presolve-on set and one presolve-off set")
    for summary in (left, right):
        runs = summary["runs"]
        print(
            json.dumps(
                {
                    "label": summary["label"],
                    "presolve": runs[0]["presolve"],
                    "runs": len(runs),
                    "http_200": sum(run["http_status"] == 200 for run in runs),
                    "cp_sat_candidates": sum(run["candidate_km"] is not None for run in runs),
                    "median_client_ms": _median(runs, "client_ms"),
                    "median_service_ms": _median(runs, "service_ms"),
                    "median_presearch_ms": _median(runs, "presearch_ms"),
                    "median_first_solution_ms": _median(runs, "first_solution_ms"),
                },
                sort_keys=True,
            )
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    run = commands.add_parser("run", help="warm the API and save repeated responses")
    run.add_argument("--base-url", required=True)
    run.add_argument("--payload", required=True, type=Path)
    run.add_argument("--label", required=True)
    run.add_argument("--repeat", type=int, default=3)
    run.add_argument("--timeout", type=float, default=180)
    run.add_argument("--output-dir", type=Path, default=Path("benchmark-results"))
    run.set_defaults(func=_run)
    compare = commands.add_parser("compare", help="compare two saved summary files")
    compare.add_argument("first", type=Path)
    compare.add_argument("second", type=Path)
    compare.set_defaults(func=_compare)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
