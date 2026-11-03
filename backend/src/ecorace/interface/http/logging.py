"""Structured JSON logging + request ID middleware."""

from __future__ import annotations

import logging
import os
import re
import sqlite3
import time
import uuid
from contextvars import ContextVar
from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse
from pythonjsonlogger.jsonlogger import JsonFormatter
from ecorace.infrastructure import persistence

request_id_var: ContextVar[str] = ContextVar("request_id", default="")
_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
_QUOTA = re.compile(r"^([1-9][0-9]*)/(second|minute|hour)$")


def _limit_for(request: Request) -> tuple[int, int, str]:
    path = request.url.path
    if path == "/api/v1/health":
        env, default, group = "RATE_LIMIT_HEALTH", "120/minute", "health"
    elif path == "/api/v1/circuits":
        env, default, group = "RATE_LIMIT_CIRCUITS", "60/minute", "circuits"
    elif path.endswith("/weekends"):
        env, default, group = "RATE_LIMIT_WEEKENDS", "60/minute", "weekends"
    elif path == "/api/v1/optimization/runs" and request.method == "POST":
        env, default, group = "RATE_LIMIT_RUNS", "10/minute", "runs"
    elif path.startswith("/api/v1/optimization/"):
        env, default, group = "RATE_LIMIT_GET_RUN", "60/minute", "results"
    else:
        env, default, group = "RATE_LIMIT_DEFAULT", "60/minute", "default"
    setting = os.environ.get(env, default)
    match = _QUOTA.fullmatch(setting)
    if match is None:
        raise ValueError(f"Invalid {env}: {setting}")
    return int(match[1]), {"second": 1, "minute": 60, "hour": 3600}[match[2]], group


class EcoraceJsonFormatter(JsonFormatter):
    def add_fields(
        self,
        log_record: dict[str, Any],
        record: logging.LogRecord,
        message_dict: dict[str, Any],
    ) -> None:
        super().add_fields(log_record, record, message_dict)
        log_record["timestamp"] = self.formatTime(record)
        log_record["level"] = record.levelname
        log_record["logger"] = record.name
        log_record["request_id"] = request_id_var.get()
        if hasattr(record, "extra_fields"):
            log_record.update(record.extra_fields)


def setup_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(EcoraceJsonFormatter())
    root = logging.getLogger()
    root.setLevel(level)
    root.handlers = [handler]


async def request_id_middleware(request: Request, call_next):
    supplied = request.headers.get("x-request-id")
    rid = supplied if supplied and _REQUEST_ID.fullmatch(supplied) else uuid.uuid4().hex[:12]
    token = request_id_var.set(rid)
    start = time.perf_counter()
    try:
        from ecorace.interface.http.errors import envelope

        max_bytes = int(os.environ.get("ECORACE_MAX_REQUEST_BYTES", "16384"))
        declared = request.headers.get("content-length")
        too_large = False
        if request.method in ("POST", "PUT", "PATCH"):
            if declared is not None and (not declared.isdecimal() or int(declared) > max_bytes):
                too_large = True
            else:
                payload = bytearray()
                async for chunk in request.stream():
                    payload.extend(chunk)
                    if len(payload) > max_bytes:
                        too_large = True
                        break
                if not too_large:
                    request._body = bytes(payload)
        if too_large:
            response = JSONResponse(status_code=413, content=envelope("PAYLOAD_TOO_LARGE", "Request body exceeds the size limit."))
        elif request.url.path.startswith("/api/v1/") and request.method != "OPTIONS":
            limit, window_s, group = _limit_for(request)
            client = request.client.host if request.client else "unknown"
            try:
                allowed, retry_after = persistence.consume_quota(f"{client}:{group}", limit, window_s)
            except (sqlite3.Error, RuntimeError):
                response = JSONResponse(status_code=503, content=envelope("DATABASE_UNAVAILABLE", "Database temporarily unavailable."))
            else:
                response = await call_next(request) if allowed else JSONResponse(
                    status_code=429,
                    headers={"Retry-After": str(retry_after)},
                    content=envelope("RATE_LIMITED", "Request quota exceeded."),
                )
        else:
            response = await call_next(request)
        response.headers["x-request-id"] = rid
        logging.getLogger("ecorace.access").info(
            "request_complete",
            extra={"extra_fields": {
                "method": request.method, "path": request.url.path,
                "status": response.status_code,
                "duration_ms": int((time.perf_counter() - start) * 1000),
            }},
        )
        return response
    finally:
        request_id_var.reset(token)
