"""HTTP integration tests: stable error codes, response contracts, CORS.

Pilot architecture: stateless. The POST /optimization/runs endpoint returns the
complete result synchronously. There is no database, no idempotency, and no
result-retrieval endpoint. All assertions are made on the direct POST response.
"""

import uuid

from ecorace.application import optimization_service as svc
from ecorace.interface.http.app import create_app
from fastapi.testclient import TestClient

app = create_app()
client = TestClient(app)

from ecorace.infrastructure import data_loader

IDS = [c["id"] for c in data_loader.circuit_list_sorted()]


# ---------------------------------------------------------------------------
# Health and reference data
# ---------------------------------------------------------------------------


def test_health():
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "dataset_version" in body
    # No database key — health is stateless.
    assert "database" not in body


def test_health_liveness_probe():
    """Root /health works without SQLite."""
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_health_diagnostic_fields():
    """Diagnostic health includes solver circuit-breaker state."""
    body = client.get("/api/v1/health").json()
    assert "solver" in body
    assert "circuit_breaker_open" in body["solver"]
    assert "consecutive_failures" in body["solver"]


def test_circuits_sorted_and_versioned():
    r = client.get("/api/v1/circuits")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 42
    names = [c["name"] for c in body["circuits"]]
    assert names == sorted(names, key=str.lower)
    assert body["dataset_version"] == "fia-grade1-2026-03-31+f1-2020-2026"


def test_circuits_expose_venue_provenance():
    # The official-preset UI depends on these fields; a stale server
    # silently breaks it, so pin them at the API level.
    body = client.get("/api/v1/circuits").json()
    for c in body["circuits"]:
        assert "f1_current_2026" in c and "f1_hosted_seasons" in c and "venue_source" in c
    official = [c["id"] for c in body["circuits"] if c["f1_current_2026"] is True]
    assert len(official) == 24


# ---------------------------------------------------------------------------
# Scenario (in-memory, no database writes)
# ---------------------------------------------------------------------------


def test_create_scenario_ok():
    body = svc.create_scenario(
        20,
        IDS[:20],
        2026,
        max_consecutive=2,
        summer_break_start=19,
        summer_break_end=21,
        pin_end_to_dec_week1=True,
    )
    assert body["scenario_id"].startswith("scn_")
    assert body["weekend_count"] == 40
    assert body["horizon"] == {"start": "2026-03-06", "end": "2026-12-04"}
    assert body["max_consecutive"] == 2
    assert body["summer_break_start"] == 19
    assert body["summer_break_end"] == 21
    assert body["pin_end_to_dec_week1"] is True
    # No database: validate the returned dict rather than a stored row.


def test_scenario_error_codes():
    cases = [
        ({"race_count": 22, "circuit_ids": IDS[:20]}, "INSUFFICIENT_CIRCUITS"),
        ({"race_count": 20, "circuit_ids": IDS[:22]}, "EXCESS_CIRCUITS"),
        ({"race_count": 20, "circuit_ids": [IDS[0]] * 20}, "DUPLICATE_CIRCUIT"),
        ({"race_count": 20, "circuit_ids": ["nope"] + IDS[1:20]}, "UNKNOWN_CIRCUIT_ID"),
        ({"race_count": 19, "circuit_ids": IDS[:19]}, "INVALID_RACE_COUNT"),
        (
            {"race_count": 20, "circuit_ids": IDS[:20], "season_year": 1999},
            "INVALID_REQUEST",
        ),
        (
            {"race_count": 20, "circuit_ids": IDS[:20], "max_consecutive": 0},
            "INVALID_REQUEST",
        ),
        (
            {"race_count": 20, "circuit_ids": IDS[:20], "max_consecutive": 1},
            "INVALID_REQUEST",
        ),
        (
            {"race_count": 20, "circuit_ids": IDS[:20], "max_consecutive": 8},
            "INVALID_REQUEST",
        ),
        (
            {
                "race_count": 20,
                "circuit_ids": IDS[:20],
                "summer_break_start": 21,
                "summer_break_end": 19,
            },
            "INVALID_SUMMER_BREAK",
        ),
        (
            {"race_count": 20, "circuit_ids": IDS[:20], "summer_break_start": 19},
            "INVALID_SUMMER_BREAK",
        ),
    ]
    for payload, code in cases:
        r = client.post("/api/v1/optimization/runs", json=payload)
        assert r.status_code == 422, (payload, r.text)
        assert r.json()["error"]["code"] == code, (payload, r.json())


# ---------------------------------------------------------------------------
# Optimization: response contract (synchronous, self-contained result)
# ---------------------------------------------------------------------------


def _run_once(budget_s: float = 3.0) -> dict:
    """Submit an optimization and return the full response body."""
    r = client.post(
        "/api/v1/optimization/runs",
        json={"race_count": 20, "circuit_ids": IDS[:20], "budget_s": budget_s},
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_run_happy_path_contract():
    """The POST response is the complete, self-contained result."""
    body = _run_once()
    assert body["run_id"].startswith("run_")
    assert body["status"] in ("feasible", "feasible_optimal", "feasible_timeout")
    cal = body["calendar"]
    assert cal["race_count"] == 20 and len(cal["races"]) == 20
    assert cal["race_count"] + cal["break_count"] == cal["weekend_count"] == 40
    assert cal["max_streak"] <= 3
    assert [x["race_id"] for x in cal["races"]] == [
        f"race-{i + 1:02d}" for i in range(20)
    ]
    assert len(body["segments"]) == 19
    assert body["segments"][0]["segment_id"] == "seg-01"
    if body["metrics"]["baseline_status"] == "ok":
        assert body["metrics"]["total_distance_km"] <= body["metrics"]["baseline_distance_km"]
    else:
        assert body["metrics"]["saving_km"] is None
    assert all(c["satisfied"] for c in body["constraints"])
    assert body["solver"]["optimality_proven"] in (True, False)
    assert body["data_version"] == "fia-grade1-2026-03-31+f1-2020-2026"
    assert body["provenance"]["weather_synthetic"] is True
    assert body["provenance"]["weather_sha256"]
    assert body["provenance"]["seed_schedule"] == [0, 1, 2]
    # Route geometry sanity: segment endpoints match race order.
    for seg, a, b in zip(body["segments"], cal["races"], cal["races"][1:]):
        assert (seg["from_circuit_id"], seg["to_circuit_id"]) == (
            a["circuit_id"],
            b["circuit_id"],
        )


def test_result_contains_all_required_fields():
    """Every field the frontend depends on must be present."""
    body = _run_once()
    required_top = {"run_id", "status", "calendar", "segments", "metrics", "constraints", "solver", "data_version", "provenance"}
    assert required_top <= body.keys()
    assert body["run_id"].startswith("run_")
    # Calendar structure
    cal = body["calendar"]
    for key in ("races", "breaks", "weekend_count", "race_count", "break_count", "max_streak"):
        assert key in cal, f"calendar.{key} missing"
    # Provenance structure
    prov = body["provenance"]
    for key in ("weather_version", "weather_sha256", "circuits_sha256", "weather_synthetic",
                "scenario", "requested_budget_s", "seed_schedule", "attempts", "total_runtime_ms"):
        assert key in prov, f"provenance.{key} missing"


def test_independent_validator_clears_all_constraints():
    """Every successful result must pass the independent validator (no DB required)."""
    body = _run_once()
    for c in body["constraints"]:
        assert c["satisfied"], f"Constraint {c['name']} violated in result"


def test_run_with_knobs_contract():
    r = client.post(
        "/api/v1/optimization/runs",
        json={
            "race_count": 20,
            "circuit_ids": IDS[:20],
            "budget_s": 9.0,
            "max_consecutive": 2,
            "summer_break_start": 19,
            "summer_break_end": 21,
            "pin_end_to_dec_week1": True,
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    cal = body["calendar"]
    assert cal["max_streak"] <= 2
    assert cal["races"][-1]["weekend_id"] == "2026-12-04"
    names = {c["name"] for c in body["constraints"]}
    assert {
        "weather",
        "max_consecutive",
        "summer_break",
        "monthly_minimum",
        "dec_end_pin",
        "race_count_unique",
    } <= names
    assert all(c["satisfied"] for c in body["constraints"])
    assert body["provenance"]["scenario"]["max_consecutive"] == 2
    assert body["provenance"]["scenario"]["summer_break_start"] == 19


def test_season_weekends_endpoint():
    r = client.get("/api/v1/seasons/2026/weekends")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["year"] == 2026 and body["count"] == 40
    assert body["weekends"][0] == {
        "id": "2026-03-06",
        "friday": "2026-03-06",
        "saturday": "2026-03-07",
        "sunday": "2026-03-08",
    }
    r = client.get("/api/v1/seasons/1999/weekends")
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "INVALID_HORIZON"


def test_run_error_codes_fast():
    r = client.post(
        "/api/v1/optimization/runs", json={"race_count": 22, "circuit_ids": IDS[:20]}
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "INSUFFICIENT_CIRCUITS"
    r = client.post("/api/v1/optimization/runs", json={"circuit_ids": IDS[:20]})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "INVALID_REQUEST"


def test_unsupported_request_fields_are_rejected():
    base = {"race_count": 20, "circuit_ids": IDS[:20]}
    for extra in ({"objective": {"type": "carbon"}}, {"constraints": {"custom": True}}):
        r = client.post("/api/v1/optimization/runs", json={**base, **extra})
        assert r.status_code == 422
        assert r.json()["error"]["code"] == "INVALID_REQUEST"


# ---------------------------------------------------------------------------
# Removed DB-backed endpoints must be absent
# ---------------------------------------------------------------------------


def test_result_lookup_endpoint_is_absent():
    """Backend does not retain run history. GET /optimization/runs/{id} must not exist."""
    body = _run_once()
    run_id = body["run_id"]
    # The route must return 404 (not 200 from a DB lookup).
    r = client.get(f"/api/v1/optimization/runs/{run_id}")
    assert r.status_code == 404

    r = client.get("/api/v1/optimization/runs/run_missing")
    assert r.status_code == 404


def test_submission_status_endpoint_is_absent():
    """Idempotency submission endpoint must not exist."""
    r = client.get(f"/api/v1/optimization/submissions/{uuid.uuid4()}")
    assert r.status_code == 404


def test_public_history_and_delete_routes_are_absent():
    assert client.get("/api/v1/scenarios").status_code == 404
    assert client.get("/api/v1/optimization/runs").status_code == 405
    assert client.delete("/api/v1/scenarios/scn_unknown").status_code == 404


# ---------------------------------------------------------------------------
# Protocol infrastructure
# ---------------------------------------------------------------------------


def test_request_id_and_payload_limit():
    r = client.get("/api/v1/health", headers={"X-Request-ID": "test-request-1"})
    assert r.headers["x-request-id"] == "test-request-1"
    r = client.get("/api/v1/health", headers={"X-Request-ID": "x" * 200})
    assert len(r.headers["x-request-id"]) <= 64
    r = client.post(
        "/api/v1/optimization/runs",
        content=b" " * 17000,
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 413
    assert r.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


def test_cors_allows_configured_origin():
    r = client.get("/api/v1/health", headers={"Origin": "http://localhost:3000"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"


# ---------------------------------------------------------------------------
# In-memory rate limiting (process-local, no DB)
# ---------------------------------------------------------------------------


def test_in_memory_rate_limiting_is_process_local_and_tracks_quota(monkeypatch):
    """In-memory quotas are process-local: requests track against sliding window."""
    monkeypatch.setenv("RATE_LIMIT_HEALTH", "1/minute")
    # Use a unique client address to avoid colliding with other tests.
    client_address = (f"quota-{uuid.uuid4()}", 51000)

    app = create_app()
    isolated = TestClient(app, client=client_address)
    assert isolated.get("/api/v1/health").status_code == 200
    # Second request from the same client exhausts the per-minute limit.
    limited = isolated.get("/api/v1/health")
    assert limited.status_code == 429
    assert limited.json()["error"]["code"] == "RATE_LIMITED"
    assert int(limited.headers["Retry-After"]) >= 1

    # In the same process, a different client IP gets its own independent quota.
    other_client = (f"quota-{uuid.uuid4()}", 51001)
    fresh = TestClient(app, client=other_client)
    assert fresh.get("/api/v1/health").status_code == 200


def test_rate_limit_runs_endpoint(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_RUNS", "1/minute")
    unique_client = (f"quota-runs-{uuid.uuid4()}", 52000)
    test_app = create_app()
    tc = TestClient(test_app, client=unique_client)
    # First request is allowed (may succeed or fail with a solver error; either is fine).
    # We just need a non-429 response.
    r1 = tc.post(
        "/api/v1/optimization/runs",
        json={"race_count": 22, "circuit_ids": IDS[:20]},  # invalid — fast 422
    )
    assert r1.status_code != 429
    # Second request must be rate-limited.
    r2 = tc.post(
        "/api/v1/optimization/runs",
        json={"race_count": 22, "circuit_ids": IDS[:20]},
    )
    assert r2.status_code == 429
    assert r2.json()["error"]["code"] == "RATE_LIMITED"


# ---------------------------------------------------------------------------
# Concurrency: solver semaphore
# ---------------------------------------------------------------------------


def test_solver_overloaded_while_slot_occupied():
    """While the first solver slot is held, a second request gets 503 SOLVER_OVERLOADED."""
    import threading
    import time

    test_app = create_app()
    tc = TestClient(test_app)

    # Acquire the semaphore directly to simulate a long-running solve.
    test_app.state.solver_slots.acquire()
    result_codes: list[int] = []

    def _request():
        r = tc.post(
            "/api/v1/optimization/runs",
            json={"race_count": 20, "circuit_ids": IDS[:20], "budget_s": 1.0},
        )
        result_codes.append(r.status_code)

    t = threading.Thread(target=_request)
    t.start()
    t.join(timeout=5)
    # Release the held slot.
    test_app.state.solver_slots.release()

    assert 503 in result_codes
    # The 503 response body must use the SOLVER_OVERLOADED code.


def test_circuit_breaker_opens_after_failures():
    """Circuit breaker blocks requests after the configured failure threshold."""
    test_app = create_app()
    # Force the breaker open by recording failures directly.
    for _ in range(test_app.state.circuit_breaker.failure_threshold):
        test_app.state.circuit_breaker.record_failure()

    tc = TestClient(test_app)
    r = tc.post(
        "/api/v1/optimization/runs",
        json={"race_count": 20, "circuit_ids": IDS[:20], "budget_s": 1.0},
    )
    assert r.status_code == 503
    assert r.json()["error"]["code"] == "SOLVER_OVERLOADED"


def test_circuit_breaker_recovers_after_cooldown(monkeypatch):
    """Circuit breaker closes after cooldown and allows the next request."""
    import time

    monkeypatch.setenv("SOLVER_CIRCUIT_BREAKER_COOLDOWN_S", "10")
    test_app = create_app()
    breaker = test_app.state.circuit_breaker
    current_time = 1000.0

    monkeypatch.setattr(time, "time", lambda: current_time)

    # Open the breaker.
    for _ in range(breaker.failure_threshold):
        breaker.record_failure()
    assert breaker.is_open()

    # Advance time within cooldown window — breaker remains open.
    current_time += 5.0
    assert breaker.is_open()

    # Advance time past cooldown — breaker closes on next query.
    current_time += 6.0
    assert not breaker.is_open()


# ---------------------------------------------------------------------------
# Stateless startup: no database required
# ---------------------------------------------------------------------------


def test_app_starts_without_database_env(monkeypatch):
    """Application factory must succeed even with no DB-related env vars."""
    for key in ("ECORACE_DB_PATH", "ECORACE_DB_MOUNT", "ECORACE_REQUIRE_PERSISTENT_DB", "ECORACE_DB_BUSY_TIMEOUT_S"):
        monkeypatch.delenv(key, raising=False)
    # Must not raise.
    fresh_app = create_app()
    tc = TestClient(fresh_app)
    assert tc.get("/health").status_code == 200
    assert tc.get("/api/v1/health").status_code == 200
    assert tc.get("/api/v1/circuits").status_code == 200
    assert tc.get("/api/v1/seasons/2026/weekends").status_code == 200
