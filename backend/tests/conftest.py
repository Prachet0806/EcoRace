"""Configure test-environment settings that apply before any module import."""

import os

# High rate limit so tests that run many API calls are not blocked.
os.environ["RATE_LIMIT_RUNS"] = "1000/minute"
