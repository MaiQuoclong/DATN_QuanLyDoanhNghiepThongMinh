from types import SimpleNamespace

import anthropic
import httpx
import pytest

from llm import claudeClient
from llm.claudeClient import LoiLlm, goiLlm


class ClientGia:
    def __init__(self, phanHoi=None, loi=None):
        self.thamSo = None
        self._phanHoi, self._loi = phanHoi, loi
        self.messages = self

    def create(self, **thamSo):
        self.thamSo = thamSo
        if self._loi:
            raise self._loi
        return self._phanHoi


def _phanHoi(vanBan="Xin chào", stopReason="end_turn"):
    return SimpleNamespace(stop_reason=stopReason, content=[SimpleNamespace(type="text", text=vanBan)])


@pytest.fixture
def ganClient(monkeypatch):
    monkeypatch.setenv("MO_HINH_LLM", "claude-haiku-5-5")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test-key")
    monkeypatch.setenv("LLM_TIMEOUT_GIAY", "25")

    def _gan(gia):
        monkeypatch.setattr(claudeClient, "_client", gia)
        monkeypatch.setattr(claudeClient, "_cauHinhClient", ("sk-ant-test-key", 25.0))
        return gia

    return _gan


def test_goiLlm_traVanBan_vaDungMoHinh(ganClient):
    gia = ganClient(ClientGia(_phanHoi(" Trả lời ")))
    assert goiLlm("hệ thống", [{"role": "user", "content": "hỏi"}]) == "Trả lời"
    assert gia.thamSo["model"] == "claude-haiku-5-5"
    assert gia.thamSo["system"] == "hệ thống"


def test_goiLlm_tuChoi_nemLoiLlm(ganClient):
    ganClient(ClientGia(_phanHoi("", "refusal")))
    with pytest.raises(LoiLlm, match="từ chối"):
        goiLlm("x", [{"role": "user", "content": "y"}])


def test_goiLlm_noiDungRong_nemLoiLlm(ganClient):
    ganClient(ClientGia(_phanHoi("   ")))
    with pytest.raises(LoiLlm, match="rỗng"):
        goiLlm("x", [{"role": "user", "content": "y"}])


def test_goiLlm_timeout_nemLoiLlm(ganClient):
    loi = anthropic.APITimeoutError(request=httpx.Request("POST", "https://api.anthropic.com"))
    ganClient(ClientGia(loi=loi))
    with pytest.raises(LoiLlm, match="quá thời gian"):
        goiLlm("x", [{"role": "user", "content": "y"}])


def test_goiLlm_rateLimit_nemLoiLlm(ganClient):
    req = httpx.Request("POST", "https://api.anthropic.com")
    res = httpx.Response(429, request=req)
    loi = anthropic.RateLimitError("rate limit", response=res, body=None)
    ganClient(ClientGia(loi=loi))
    with pytest.raises(LoiLlm, match="vượt hạn mức"):
        goiLlm("x", [{"role": "user", "content": "y"}])


def test_goiLlm_apiStatusError_nemLoiLlm(ganClient):
    req = httpx.Request("POST", "https://api.anthropic.com")
    res = httpx.Response(502, request=req)
    loi = anthropic.APIStatusError("bad gateway", response=res, body=None)
    ganClient(ClientGia(loi=loi))
    with pytest.raises(LoiLlm, match="HTTP 502"):
        goiLlm("x", [{"role": "user", "content": "y"}])


def test_goiLlm_matKetNoi_nemLoiLlm(ganClient):
    loi = anthropic.APIConnectionError(request=httpx.Request("POST", "https://api.anthropic.com"))
    ganClient(ClientGia(loi=loi))
    with pytest.raises(LoiLlm, match="Không kết nối"):
        goiLlm("x", [{"role": "user", "content": "y"}])


def test_chuaCoKhoa_nemLoiLlm(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    with pytest.raises(LoiLlm, match="Chưa cấu hình"):
        goiLlm("x", [{"role": "user", "content": "y"}])
