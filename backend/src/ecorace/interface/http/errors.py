"""Stable error envelope: {"error": {"code", "message", "details", "request_id", "timestamp"}}."""
from __future__ import annotations

import time
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from ecorace.application.optimization_service import AppError
from ecorace.interface.http.logging import request_id_var


def envelope(code: str, message: str, details: list[dict] | list = []) -> dict:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": list(details),
            "request_id": request_id_var.get(),
            "timestamp": time.time(),
        }
    }


async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=envelope(exc.code, exc.message, exc.details))


async def validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=envelope("INVALID_REQUEST", "Request failed schema validation.", exc.errors()),
    )


async def internal_error_handler(_: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=envelope("INTERNAL_ERROR", "An unexpected error occurred.", []),
    )
