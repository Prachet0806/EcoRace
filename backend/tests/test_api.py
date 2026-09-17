"""P2 gate: HTTP integration, stable error codes, response contracts, CORS."""
from fastapi.testclient import TestClient

from ecorace.infrastructure import data_loader
from ecorace.interface.http.app import create_app

app = create_app()
client = TestClient(app)

IDS = [c["id"] for c in data_loader.circuit_list_sorted()]
BY_ID = {c["id"]: c for c in data_loader.circuit_list_sorted()}


def test_health():
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert "dataset_version" in r.json()


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


def test_create_scenario_ok():
    r = client.post("/api/v1/scenarios", json={"race_count": 20, "circuit_ids": IDS[:20]})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["scenario_id"].startswith("scn_")
    assert body["weekend_count"] == 40
    assert body["horizon"] == {"start": "2026-03-06", "end": "2026-12-04"}


def test_scenario_error_codes():
    cases = [
        ({"race_count": 22, "circuit_ids": IDS[:20]}, "INSUFFICIENT_CIRCUITS"),
        ({"race_count": 20, "circuit_ids": IDS[:22]}, "EXCESS_CIRCUITS"),
        ({"race_count": 20, "circuit_ids": [IDS[0]] * 20}, "DUPLICATE_CIRCUIT"),
        ({"race_count": 20, "circuit_ids": ["nope"] + IDS[1:20]}, "UNKNOWN_CIRCUIT_ID"),
        ({"race_count": 19, "circuit_ids": IDS[:19]}, "INVALID_RACE_COUNT"),
        ({"race_count": 20, "circuit_ids": IDS[:20], "season_year": 1999}, "INVALID_REQUEST"),
    ]
    for payload, code in cases:
        r = client.post("/api/v1/scenarios", json=payload)
        assert r.status_code == 422, (payload, r.text)
        assert r.json()["error"]["code"] == code, (payload, r.json())


def _run_once() -> str:
    r = client.post(
        "/api/v1/optimization/runs",
        json={"race_count": 20, "circuit_ids": IDS[:20], "budget_s": 3.0},
    )
    assert r.status_code == 200, r.text
    return r.json()["run_id"]


def test_run_happy_path_contract():
    body = client.get(f"/api/v1/optimization/runs/{_run_once()}").json()
    assert body["run_id"].startswith("run_")
    assert body["status"] in ("feasible", "feasible_optimal", "feasible_timeout")
    cal = body["calendar"]
    assert cal["race_count"] == 20 and len(cal["races"]) == 20
    assert cal["race_count"] + cal["break_count"] == cal["weekend_count"] == 40
    assert cal["max_streak"] <= 3
    assert [x["race_id"] for x in cal["races"]] == [f"race-{i + 1:02d}" for i in range(20)]
    assert len(body["segments"]) == 19
    assert body["segments"][0]["segment_id"] == "seg-01"
    assert body["metrics"]["total_distance_km"] <= body["metrics"]["baseline_distance_km"]
    assert all(c["satisfied"] for c in body["constraints"])
    assert body["solver"]["optimality_proven"] in (True, False)
    assert body["data_version"] == "fia-grade1-2026-03-31+f1-2020-2026"
    # Route geometry sanity: segment endpoints match race order.
    for seg, a, b in zip(body["segments"], cal["races"], cal["races"][1:]):
        assert (seg["from_circuit_id"], seg["to_circuit_id"]) == (a["circuit_id"], b["circuit_id"])


def test_run_roundtrip_and_404():
    run_id = _run_once()
    r = client.get(f"/api/v1/optimization/runs/{run_id}")
    assert r.status_code == 200
    assert r.json()["run_id"] == run_id
    r = client.get("/api/v1/optimization/runs/run_missing")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "RUN_NOT_FOUND"


def test_run_error_codes_fast():
    r = client.post("/api/v1/optimization/runs", json={"race_count": 22, "circuit_ids": IDS[:20]})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "INSUFFICIENT_CIRCUITS"
    r = client.post("/api/v1/optimization/runs", json={"circuit_ids": IDS[:20]})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "INVALID_REQUEST"


def test_cors_allows_configured_origin():
    r = client.get("/api/v1/health", headers={"Origin": "http://localhost:3000"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"
