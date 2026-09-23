"""P5 adversarial cases: hostile/edge inputs fail typed, never fake-valid."""
from fastapi.testclient import TestClient

from ecorace.infrastructure import data_loader
from ecorace.interface.http.app import create_app

app = create_app()
client = TestClient(app)
IDS = [c["id"] for c in data_loader.circuit_list_sorted()]


def test_empty_selection_rejected_by_schema():
    r = client.post("/api/v1/scenarios", json={"race_count": 20, "circuit_ids": []})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "INVALID_REQUEST"


def test_out_of_range_budget_and_season_rejected():
    r = client.post(
        "/api/v1/optimization/runs",
        json={"race_count": 20, "circuit_ids": IDS[:20], "budget_s": 999},
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "INVALID_REQUEST"
    r = client.post("/api/v1/scenarios", json={"race_count": 20, "circuit_ids": IDS[:20], "season_year": 2031})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "INVALID_REQUEST"


def test_duplicate_and_unknown_on_runs_path():
    r = client.post("/api/v1/optimization/runs", json={"race_count": 20, "circuit_ids": [IDS[0]] * 20})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "DUPLICATE_CIRCUIT"
    r = client.post("/api/v1/optimization/runs", json={"race_count": 20, "circuit_ids": ["nope"] + IDS[1:20]})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "UNKNOWN_CIRCUIT_ID"


def test_api_determinism_same_seed_same_result():
    payload = {"race_count": 20, "circuit_ids": IDS[:20], "seed": 7, "budget_s": 6.0}
    a = client.post("/api/v1/optimization/runs", json=payload).json()
    b = client.post("/api/v1/optimization/runs", json=payload).json()
    assert a["metrics"]["total_distance_km"] == b["metrics"]["total_distance_km"]
    assert [r["circuit_id"] for r in a["calendar"]["races"]] == [r["circuit_id"] for r in b["calendar"]["races"]]


def test_wrong_method_and_unknown_route():
    # GET /optimization/runs now returns list of runs (200), not 405
    r = client.get("/api/v1/optimization/runs")
    assert r.status_code == 200
    assert "runs" in r.json()
    assert client.get("/api/v1/nope").status_code == 404
