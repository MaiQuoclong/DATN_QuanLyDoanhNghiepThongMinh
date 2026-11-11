import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

def pytest_configure(config):
    config.addinivalue_line("markers", "csdl: test tích hợp MariaDB thật (cần CSDL_MAT_KHAU_TEST)")


KHOA_TEST = "khoa-noi-bo-dung-cho-test-dai-toi-thieu-32-ky-tu"


@pytest.fixture(autouse=True)
def cachLyMoiTruong(tmp_path, monkeypatch):
    """Mọi test: kho vector, lịch sử chat, embedding không dùng giá trị .env thật của máy dev
    (cauHinh gọi load_dotenv khi import) → kết quả giống nhau trên máy dev và CI, không ghi vào repo."""
    monkeypatch.setenv("MO_HINH_NHUNG", "gia")
    monkeypatch.setenv("DUONG_DAN_CHROMA", str(tmp_path / "chromaMacDinh"))
    monkeypatch.setenv("DUONG_DAN_LICH_SU", str(tmp_path / "lichSu.db"))
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    monkeypatch.setenv("NGUONG_DIEM_RAG", "0.3")


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("AI_SERVICE_KEY", KHOA_TEST)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    from main import app

    return TestClient(app)


THU_MUC_MAU = Path(__file__).resolve().parent.parent.parent / "backend" / "uploads" / "quyChe" / "mau"


@pytest.fixture
def moiTruongRag(tmp_path, monkeypatch):
    """Kho Chroma + thư mục tài liệu tạm (bản sao tệp mẫu seed), embedding giả: không đụng dữ liệu thật."""
    import shutil

    thuMuc = tmp_path / "quyChe"
    shutil.copytree(THU_MUC_MAU, thuMuc / "mau")
    monkeypatch.setenv("MO_HINH_NHUNG", "gia")
    monkeypatch.setenv("DUONG_DAN_CHROMA", str(tmp_path / "chroma"))
    monkeypatch.setenv("THU_MUC_TAI_LIEU", str(thuMuc))
    return thuMuc


@pytest.fixture
def clientRag(client, moiTruongRag):
    client.headers.update({"X-Khoa-Noi-Bo": KHOA_TEST})
    return client
