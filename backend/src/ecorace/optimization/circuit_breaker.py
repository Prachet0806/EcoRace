"""Circuit breaker for solver protection."""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field


@dataclass
class CircuitBreaker:
    failure_threshold: int = 5
    cooldown_s: int = 60
    _failures: int = 0
    _last_failure: float = 0
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def record_success(self) -> None:
        with self._lock:
            self._failures = 0

    def record_failure(self) -> None:
        with self._lock:
            self._failures += 1
            self._last_failure = time.time()

    def is_open(self) -> bool:
        with self._lock:
            if self._failures >= self.failure_threshold:
                if time.time() - self._last_failure > self.cooldown_s:
                    self._failures = 0
                    return False
                return True
            return False

    @property
    def consecutive_failures(self) -> int:
        with self._lock:
            return self._failures