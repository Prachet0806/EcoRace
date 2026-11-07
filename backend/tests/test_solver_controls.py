"""Admission and failure accounting around the expensive solver."""

from ecorace.application import optimization_service as svc
from ecorace.infrastructure import data_loader
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


def test_solver_failure_opens_breaker_stateless(monkeypatch):
    """Injected solver failure returns 500, opens breaker, and subsequent requests get 503."""
    app = create_app()
    app.state.circuit_breaker = CircuitBreaker(failure_threshold=2, cooldown_s=60)

    def fail(*args, **kwargs):
        raise svc.AppError("SOLVER_FAILURE", "injected", status_code=500)

    monkeypatch.setattr(svc, "run_optimization", fail)

    with TestClient(app) as client:
        # Injected failures return HTTP 500
        for _ in range(2):
            resp = client.post("/api/v1/optimization/runs", json=PAYLOAD)
            assert resp.status_code == 500
            assert resp.json()["error"]["code"] == "SOLVER_FAILURE"

        # After threshold failures, breaker is open and subsequent requests receive HTTP 503
        overloaded = client.post("/api/v1/optimization/runs", json=PAYLOAD)
        assert overloaded.status_code == 503
        assert overloaded.json()["error"]["code"] == "SOLVER_OVERLOADED"

    assert app.state.circuit_breaker.is_open()
