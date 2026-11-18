import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_frontend_catalog_matches_backend_catalog():
    backend = json.loads((ROOT / "data" / "circuits.json").read_text(encoding="utf-8"))
    frontend = json.loads(
        (
            ROOT
            / "frontend"
            / "src"
            / "features"
            / "circuits"
            / "catalog.json"
        ).read_text(encoding="utf-8")
    )

    assert frontend == backend
