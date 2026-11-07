"""Backend restart test: stateless pilot.

Verifies that:
- The API starts cleanly without a database or persistent disk.
- Health and reference-data endpoints respond after a restart.
- A new optimization can be submitted after a restart.
- The backend does NOT retain run history across restarts (expected behavior).

The browser session test (session-storage retention after a backend restart) is
covered by the Playwright e2e suite.
"""

from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[2]


def _free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def _start(port: int) -> subprocess.Popen:
    """Start the API without any database configuration."""
    env = os.environ.copy()
    env.update(
        {
            "PYTHONPATH": str(ROOT / "backend" / "src"),
            "SOLVER_TIMEOUT_SECONDS": "5",
            "RATE_LIMIT_RUNS": "1000/minute",
        }
    )
    # Explicitly remove any DB-related env vars to prove they are not needed.
    for key in (
        "ECORACE_DB_PATH",
        "ECORACE_DB_MOUNT",
        "ECORACE_REQUIRE_PERSISTENT_DB",
        "ECORACE_DB_BUSY_TIMEOUT_S",
    ):
        env.pop(key, None)

    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "ecorace.interface.http.app:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
        ],
        cwd=ROOT,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    endpoint = f"http://127.0.0.1:{port}/api/v1/health"
    for _ in range(100):
        if process.poll() is not None:
            raise AssertionError("API process exited during startup")
        try:
            if httpx.get(endpoint, timeout=1).status_code == 200:
                return process
        except httpx.RequestError:
            pass
        time.sleep(0.1)
    process.terminate()
    process.wait(timeout=10)
    raise AssertionError("API health check did not become ready")


def _stop(process: subprocess.Popen) -> None:
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=10)


def test_database_free_restart():
    """
    Backend restart sequence (stateless):
    1. Start API without DB config.
    2. Submit an optimization, capture the result.
    3. Stop API (simulates restart/redeploy).
    4. Start API again without DB config.
    5. Health and reference-data endpoints work.
    6. A new optimization can be submitted.
    7. The old result is NOT available from the backend (expected — browser owns it).
    """
    port = _free_port()
    base = f"http://127.0.0.1:{port}/api/v1"

    from ecorace.infrastructure import data_loader
    ids = [c["id"] for c in data_loader.circuit_list_sorted()][:20]
    payload = {"race_count": 20, "circuit_ids": ids, "budget_s": 5}

    # --- First instance ---
    process = _start(port)
    try:
        # Health check without database
        health = httpx.get(f"{base}/health", timeout=5)
        assert health.status_code == 200
        assert health.json()["status"] == "ok"
        assert "database" not in health.json()

        # Circuits endpoint works
        circuits = httpx.get(f"{base}/circuits", timeout=5)
        assert circuits.status_code == 200

        # Submit optimization
        created = httpx.post(
            f"{base}/optimization/runs", json=payload, timeout=30
        )
        assert created.status_code == 200, created.text
        run_id = created.json()["run_id"]
        assert run_id.startswith("run_")
        # Verify complete result is in the response body
        result_body = created.json()
        assert result_body["calendar"]["race_count"] == 20
        assert all(c["satisfied"] for c in result_body["constraints"])

        # Backend does NOT expose a result-retrieval endpoint
        lookup = httpx.get(f"{base}/optimization/runs/{run_id}", timeout=5)
        assert lookup.status_code == 404
    finally:
        _stop(process)

    # --- Second instance (restart, no DB) ---
    process = _start(port)
    try:
        # Health works after restart without a database
        health = httpx.get(f"{base}/health", timeout=5)
        assert health.status_code == 200
        assert health.json()["status"] == "ok"

        # Reference data works
        circuits = httpx.get(f"{base}/circuits", timeout=5)
        assert circuits.status_code == 200

        weekends = httpx.get(f"{base}/seasons/2026/weekends", timeout=5)
        assert weekends.status_code == 200

        # Old run_id is NOT retrievable (expected — browser session owns the result)
        lookup = httpx.get(f"{base}/optimization/runs/{run_id}", timeout=5)
        assert lookup.status_code == 404

        # A fresh optimization can be submitted after restart
        new_result = httpx.post(
            f"{base}/optimization/runs", json=payload, timeout=30
        )
        assert new_result.status_code == 200, new_result.text
        new_run_id = new_result.json()["run_id"]
        assert new_run_id.startswith("run_")
        assert new_run_id != run_id  # New run, new ID
    finally:
        _stop(process)
