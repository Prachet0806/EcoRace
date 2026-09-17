"""FastAPI application factory + module-level app for uvicorn.

Config (env):
  ECORACE_CORS_ORIGINS: comma-separated origins (default http://localhost:3000)
  SOLVER_TIMEOUT_SECONDS: total sync budget per run (default 30; split across seeds)
  ECORACE_DATA_DIR: override reference-data directory
"""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from ecorace.application.optimization_service import AppError
from ecorace.interface.http.errors import app_error_handler, validation_handler
from ecorace.interface.http.routes import router


def create_app() -> FastAPI:
    app = FastAPI(title="EcoRace Planner", version="0.1.0")
    origins = [o.strip() for o in os.environ.get("ECORACE_CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST"],
        allow_headers=["content-type"],
    )
    app.state.solver_budget_s = float(os.environ.get("SOLVER_TIMEOUT_SECONDS", "30"))
    app.state.runs = {}
    app.state.scenarios = {}
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_handler)
    app.include_router(router)
    return app


app = create_app()
