"""Structured JSON logging + request ID middleware with in-memory rate limiting."""

from __future__ import annotations

import logging
import os
import re
import threading
import time
import uuid
from contextvars import ContextVar
from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse
from pythonjsonlogger.jsonlogger import JsonFormatter

request_id_var: ContextVar[str] = ContextVar("request_id", default="")
_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
_QUOTA = re.compile(r"^([1-9][0-9]*)/(second|minute|hour)$")

# In-memory sliding-window rate limiter state.
# Key: f"{client_ip}:{group}" -> list of request timestamps (monotonic seconds).
# Guarded by _QUOTA_LOCK for thread safety.
_QUOTA_WINDOWS: dict[str, list[float]] = {}
_QUOTA_LOCK = threading.Lock()
_MAX_ENTRIES_PER_KEY = 1000  # bound memory per client+group
_MAX_TRACKED_KEYS = 5000     # maximum number of client:group keys to track
_LAST_PRUNE_TIME: float = 0.0
_PRUNE_INTERVAL_S: float = 60.0  # prune at most once every 60 seconds


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


def _consume_quota_in_memory(scope: str, limit: int, window_s: int) -> tuple[bool, int]:
    """In-memory sliding-window quota check.

    Returns (allowed, retry_after_seconds).
    """
    now = time.monotonic()
    key = scope
    retry_after = max(1, int(window_s - (now % window_s)) + 1)

    with _QUOTA_LOCK:
        # If tracking too many keys and this key is new, reject/shed or evict
        if key not in _QUOTA_WINDOWS and len(_QUOTA_WINDOWS) >= _MAX_TRACKED_KEYS:
            # Force immediate cleanup
            _prune_quota_windows_locked(now)
            if len(_QUOTA_WINDOWS) >= _MAX_TRACKED_KEYS:
                # Still saturated: drop oldest arbitrary key to keep memory strictly bounded
                oldest_key = next(iter(_QUOTA_WINDOWS))
                del _QUOTA_WINDOWS[oldest_key]

        timestamps = _QUOTA_WINDOWS.get(key, [])
        # Drop entries outside the sliding window.
        cutoff = now - window_s
        recent = [t for t in timestamps if t > cutoff]
        if len(recent) >= limit:
            _QUOTA_WINDOWS[key] = recent
            return False, retry_after
        recent.append(now)
        # Bound memory: keep only the most recent entries per key.
        if len(recent) > _MAX_ENTRIES_PER_KEY:
            recent = recent[-_MAX_ENTRIES_PER_KEY:]
        _QUOTA_WINDOWS[key] = recent
    return True, retry_after


def _prune_quota_windows_locked(now: float) -> None:
    """Internal helper to drop expired entries. Must be called while holding _QUOTA_LOCK."""
    global _LAST_PRUNE_TIME
    _LAST_PRUNE_TIME = now
    expired: list[str] = []
    for k, timestamps in _QUOTA_WINDOWS.items():
        # Windows are at most 1 hour; prune anything older than 2 hours.
        cutoff = now - 7200
        recent = [t for t in timestamps if t > cutoff]
        if recent:
            _QUOTA_WINDOWS[k] = recent
        else:
            expired.append(k)
    for k in expired:
        del _QUOTA_WINDOWS[k]


def _maybe_prune_quota_windows() -> None:
    """Drop expired entries periodically (at most once every _PRUNE_INTERVAL_S)."""
    now = time.monotonic()
    if now - _LAST_PRUNE_TIME < _PRUNE_INTERVAL_S:
        return
    with _QUOTA_LOCK:
        if now - _LAST_PRUNE_TIME >= _PRUNE_INTERVAL_S:
            _prune_quota_windows_locked(now)


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
            allowed, retry_after = _consume_quota_in_memory(f"{client}:{group}", limit, window_s)
            # Opportunistically prune old quota entries periodically without scanning on every request.
            _maybe_prune_quota_windows()
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
