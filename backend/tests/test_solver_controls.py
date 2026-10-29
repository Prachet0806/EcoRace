"""Admission and failure accounting around the expensive solver."""

from ecorace.application import optimization_service as svc
from ecorace.infrastructure import data_loader, persistence
from ecorace.interface.http.app import create_app
from ecorace.optimization.circuit_breaker import CircuitBreaker
from fastapi.testclient import TestClient

IDS = [c["id"] for c in data_loader.circuit_list_sorted()]
PAYLOAD = {"race_count": 20, "circuit_ids": IDS[:20], "budget_s": 1.0}


def test_busy_solver_returns_promptly_without_creating_scenario():
    app = create_app()
    app.state.solver_slots.acquire()
    try:
        with TestClient(app) as client:
            response = client.post("/api/v1/optimization/runs", json=PAYLOAD)
        assert response.status_code == 503
        assert response.headers["retry-after"] == "5"
        assert response.json()["error"]["code"] == "SOLVER_OVERLOADED"
    finally:
        app.state.solver_slots.release()


def test_solver_failure_opens_breaker_without_orphan_scenarios(monkeypatch):
    app = create_app()
    app.state.circuit_breaker = CircuitBreaker(failure_threshold=2, cooldown_s=60)

    def fail(*args, **kwargs):
        raise svc.AppError("SOLVER_FAILURE", "injected", status_code=500)

    monkeypatch.setattr(svc, "run_optimization", fail)
    before = len(persistence.list_scenarios(limit=200))
    with TestClient(app) as client:
        for _ in range(2):
            assert (
                client.post("/api/v1/optimization/runs", json=PAYLOAD).status_code
                == 500
            )
        assert client.post("/api/v1/optimization/runs", json=PAYLOAD).status_code == 503
    assert app.state.circuit_breaker.is_open()
    assert len(persistence.list_scenarios(limit=200)) == before
