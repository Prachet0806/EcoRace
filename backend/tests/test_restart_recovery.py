"""A completed result remains retrievable after a real API process restart."""

from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
import uuid
from pathlib import Path

import httpx

from ecorace.infrastructure import data_loader, db_admin, persistence

ROOT = Path(__file__).resolve().parents[2]


def _free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def _start(port: int, db_path: Path) -> subprocess.Popen:
    env = os.environ.copy()
    env.update({
        "PYTHONPATH": str(ROOT / "backend" / "src"),
        "ECORACE_DB_PATH": str(db_path),
        "ECORACE_REQUIRE_PERSISTENT_DB": "0",
        "SOLVER_TIMEOUT_SECONDS": "3",
        "RATE_LIMIT_RUNS": "1000/minute",
    })
    process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "ecorace.interface.http.app:app", "--host", "127.0.0.1", "--port", str(port)],
        cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
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


def test_run_survives_api_process_restart(tmp_path):
    port = _free_port()
    db_path = tmp_path / "restart.db"
    base = f"http://127.0.0.1:{port}/api/v1"
    key = str(uuid.uuid4())
    ids = [c["id"] for c in data_loader.circuit_list_sorted()][:20]
    payload = {"race_count": 20, "circuit_ids": ids, "budget_s": 3}
    process = _start(port, db_path)
    try:
        created = httpx.post(f"{base}/optimization/runs", json=payload, headers={"Idempotency-Key": key}, timeout=30)
        assert created.status_code == 200, created.text
        run_id = created.json()["run_id"]
    finally:
        _stop(process)

    process = _start(port, db_path)
    try:
        retrieved = httpx.get(f"{base}/optimization/runs/{run_id}", timeout=10)
        assert retrieved.status_code == 200, retrieved.text
        assert retrieved.json()["run_id"] == run_id
        replayed = httpx.post(f"{base}/optimization/runs", json=payload, headers={"Idempotency-Key": key}, timeout=10)
        assert replayed.status_code == 200
        assert replayed.json()["run_id"] == run_id
    finally:
        _stop(process)

    report = db_admin.inspect_database(db_path)
    assert report["schema_version"] == persistence.SCHEMA_VERSION
    assert report["integrity"] == "ok"
    assert report["foreign_key_violations"] == 0
    assert (report["scenarios"], report["runs"]) == (1, 1)
