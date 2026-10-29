"""Keep API tests away from the development database."""

import os
import tempfile
from pathlib import Path

_test_dir = tempfile.TemporaryDirectory(prefix="ecorace-tests-")
os.environ["ECORACE_DB_PATH"] = str(Path(_test_dir.name) / "ecorace.db")
os.environ["RATE_LIMIT_RUNS"] = "1000/minute"
