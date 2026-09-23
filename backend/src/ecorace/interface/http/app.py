"""FastAPI application factory + module-level app for uvicorn.

Config (env):
  ECORACE_CORS_ORIGINS: comma-separated extra origins (default http://localhost:3000)
  ECORACE_CORS_ALLOW_LAN: auto-allow this machine's private-IPv4 origins on
    ports 3000/3100 (default 1; set 0 to disable). Covers phone/LAN testing
    without hand-maintaining IPs.
  SOLVER_TIMEOUT_SECONDS: total sync budget per run (default 30; split across seeds)
  ECORACE_DATA_DIR: override reference-data directory
  LOG_LEVEL: logging level (default INFO)
  SOLVER_CIRCUIT_BREAKER_THRESHOLD: consecutive failures before open (default 5)
  SOLVER_CIRCUIT_BREAKER_COOLDOWN_S: cooldown seconds (default 60)
  RATE_LIMIT_DEFAULT: default rate limit (default 60/minute)
  RATE_LIMIT_HEALTH: health endpoint limit (default 120/minute)
  RATE_LIMIT_CIRCUITS: circuits endpoint limit (default 60/minute)
  RATE_LIMIT_SCENARIOS: scenarios endpoint limit (default 30/minute)
  RATE_LIMIT_RUNS: optimization runs endpoint limit (default 10/minute)
  ECORACE_DB_PATH: SQLite database path (default ./data/ecorace.db)
"""
from __future__ import annotations

import ipaddress
import logging
import os
import socket

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from ecorace.application.optimization_service import AppError
from ecorace.interface.http.errors import app_error_handler, validation_handler, internal_error_handler
from ecorace.interface.http.logging import request_id_middleware, setup_logging
from ecorace.interface.http.routes import router, init_rate_limits
from ecorace.infrastructure import persistence
from ecorace.optimization.circuit_breaker import CircuitBreaker


def _lan_origins() -> list[str]:
    """http origins for this host's private IPv4s (phone/LAN dev testing)."""
    origins: list[str] = []
    try:
        infos = socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)
    except OSError:
        return origins
    seen: set[str] = set()
    for info in infos:
        ip = info[4][0]
        try:
            if not ipaddress.ip_address(ip).is_private or ip.startswith("127."):
                continue
        except ValueError:
            continue
        for port in (3000, 3100):
            origin = f"http://{ip}:{port}"
            if origin not in seen:
                seen.add(origin)
                origins.append(origin)
    return origins


def create_app() -> FastAPI:
    log_level = os.environ.get("LOG_LEVEL", "INFO")
    setup_logging(log_level)

    app = FastAPI(title="EcoRace Planner", version="0.1.0")

    origins = [o.strip() for o in os.environ.get("ECORACE_CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
    allow_lan = os.environ.get("ECORACE_CORS_ALLOW_LAN", "1") != "0"
    if allow_lan:
        origins.extend(o for o in _lan_origins() if o not in origins)
    logging.getLogger("ecorace").info("CORS origins: %s", ",".join(origins))
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        # Fallback for private IPs getaddrinfo() misses: any RFC1918 origin
        # on the dev ports. Same trust scope as _lan_origins().
        allow_origin_regex=(
            r"http://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):(3000|3100)"
            if allow_lan
            else ""
        ),
        allow_methods=["GET", "POST"],
        allow_headers=["content-type"],
    )

    app.middleware("http")(request_id_middleware)

    cb_threshold = int(os.environ.get("SOLVER_CIRCUIT_BREAKER_THRESHOLD", "5"))
    cb_cooldown = int(os.environ.get("SOLVER_CIRCUIT_BREAKER_COOLDOWN_S", "60"))
    app.state.circuit_breaker = CircuitBreaker(failure_threshold=cb_threshold, cooldown_s=cb_cooldown)

    app.state.solver_budget_s = float(os.environ.get("SOLVER_TIMEOUT_SECONDS", "30"))
    app.state.runs = {}
    app.state.scenarios = {}

    limiter = Limiter(key_func=get_remote_address, default_limits=[os.environ.get("RATE_LIMIT_DEFAULT", "60/minute")])
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    init_rate_limits(limiter)

    # Initialize database
    persistence.init_db()

    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_handler)
    app.add_exception_handler(Exception, internal_error_handler)

    app.include_router(router)
    return app


app = create_app()
