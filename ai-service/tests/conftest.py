import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

KHOA_TEST = "khoa-noi-bo-dung-cho-test-dai-toi-thieu-32-ky-tu"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_KEY", KHOA_TEST)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    from main import app

    return TestClient(app)
