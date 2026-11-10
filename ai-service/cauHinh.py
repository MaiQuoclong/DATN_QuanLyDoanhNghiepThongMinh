"""Cấu hình ai-service đọc từ biến môi trường (.env). Đọc lại mỗi lần gọi để test đổi được qua monkeypatch."""

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class CauHinh:
    cong: int
    khoaNoiBo: str
    anthropicApiKey: str
    moHinhLlm: str
    thoiGianChoLlm: float


def layCauHinh() -> CauHinh:
    return CauHinh(
        cong=int(os.getenv("CONG", "8000")),
        khoaNoiBo=os.getenv("AI_SERVICE_KEY", ""),
        anthropicApiKey=os.getenv("ANTHROPIC_API_KEY", ""),
        moHinhLlm=os.getenv("MO_HINH_LLM", "claude-haiku-5-5"),
        thoiGianChoLlm=float(os.getenv("LLM_TIMEOUT_GIAY", "25")),
    )
