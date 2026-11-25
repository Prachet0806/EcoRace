from ecorace.interface.http import logging as request_logging


def test_sliding_window_retry_after_tracks_oldest_request(monkeypatch):
    now = 58.0
    monkeypatch.setattr(request_logging.time, "monotonic", lambda: now)
    request_logging._QUOTA_WINDOWS.clear()

    assert request_logging._consume_quota_in_memory("client:test", 2, 60)[0] is True
    now = 59.0
    assert request_logging._consume_quota_in_memory("client:test", 2, 60)[0] is True

    now = 60.1
    allowed, retry_after = request_logging._consume_quota_in_memory("client:test", 2, 60)
    assert allowed is False
    assert retry_after == 58

    now = 117.9
    allowed, retry_after = request_logging._consume_quota_in_memory("client:test", 2, 60)
    assert allowed is False
    assert retry_after == 1

    now = 118.0
    assert request_logging._consume_quota_in_memory("client:test", 2, 60)[0] is True


def test_root_health_uses_health_rate_limit():
    from starlette.requests import Request

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/health",
        "headers": [],
        "query_string": b"",
        "server": ("test", 80),
        "client": ("127.0.0.1", 12345),
        "scheme": "http",
        "http_version": "1.1",
    }
    request = Request(scope)
    assert request_logging._limit_for(request) == (120, 60, "health")
