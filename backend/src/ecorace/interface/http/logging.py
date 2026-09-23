"""Structured JSON logging + request ID middleware."""
from __future__ import annotations

import json
import logging
import time
import uuid
from contextvars import ContextVar
from typing import Any

from fastapi import Request
from pythonjsonlogger.jsonlogger import JsonFormatter

request_id_var: ContextVar[str] = ContextVar("request_id", default="")


class EcoraceJsonFormatter(JsonFormatter):
    def add_fields(self, log_record: dict[str, Any], record: logging.LogRecord, message_dict: dict[str, Any]) -> None:
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
    rid = request.headers.get("x-request-id", uuid.uuid4().hex[:12])
    request_id_var.set(rid)
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = int((time.perf_counter() - start) * 1000)
    logger = logging.getLogger("ecorace.access")
    logger.info(
        "request_complete",
        extra={
            "extra_fields": {
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": duration_ms,
            }
        },
    )
    response.headers["x-request-id"] = rid
    return response