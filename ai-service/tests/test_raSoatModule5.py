"""Hồi quy rà soát Module 5 (2026-11-11): TB1 lọc/dọn vector theo cả id + maTaiLieu, TB2 thời gian chờ LLM theo hạn chót."""

import time

import pytest

from llm import claudeClient
from rag import hoiDap as moduleHoiDap
from rag import khoVector

DAU = "4|2026-11-11 08:00:00"
TL_CU = {"taiLieuId": 4, "maTaiLieu": "QC-NGHIPHEP", "tieuDe": "Quy chế nghỉ phép", "duongDanTep": "mau/QC-NGHIPHEP.md"}
TL_KHAC = {"taiLieuId": 5, "maTaiLieu": "QC-LUONG", "tieuDe": "Quy chế lương", "duongDanTep": "mau/QC-LUONG.md"}


@pytest.fixture
def llmGia(monkeypatch):
    trangThai = {"loiGoi": []}

    def goiLlmGia(heThong, tinNhan, soTokenToiDa=2048, mucNoLuc="low", thoiGianCho=None):
        trangThai["loiGoi"].append({"thoiGianCho": thoiGianCho})
        return "Trả lời [1]."

    monkeypatch.setattr(moduleHoiDap, "goiLlm", goiLlmGia)
    return trangThai


def hoi(client, phienId=1, **them):
    return client.post(
        "/noiBo/rag/hoiDap", json={"phienId": phienId, "dauPhien": DAU, "cauHoi": "Nghỉ kết hôn mấy ngày?", **them}
    )


# --- TB1 ---


def test_idCapLaiChoTaiLieuKhacMaKhongTrichDanTaiLieuCu(clientRag, llmGia, monkeypatch):
    monkeypatch.setenv("NGUONG_DIEM_RAG", "-1")
    assert clientRag.post("/noiBo/rag/lapChiMuc", json=TL_CU).status_code == 200
    # CSDL dựng lại: id 4 giờ là tài liệu mã khác → vector cũ mã QC-NGHIPHEP không được trích
    data = hoi(clientRag, taiLieuIdsHienCo=[4], taiLieuHienCo=[{"id": 4, "maTaiLieu": "QC-MOI"}]).json()["data"]
    assert data["cheDo"] == "KHONG_TIM_THAY" and data["nguonTrichDan"] == []
    assert llmGia["loiGoi"] == []
    # Khớp cả id + mã → trích bình thường
    data = hoi(clientRag, phienId=2, taiLieuHienCo=[{"id": 4, "maTaiLieu": "QC-NGHIPHEP"}]).json()["data"]
    assert data["cheDo"] == "LLM" and all(n["maTaiLieu"] == "QC-NGHIPHEP" for n in data["nguonTrichDan"])


def test_khongTruyenTaiLieuHienCoVanChayNhuCu(clientRag, llmGia, monkeypatch):
    monkeypatch.setenv("NGUONG_DIEM_RAG", "-1")
    assert clientRag.post("/noiBo/rag/lapChiMuc", json=TL_CU).status_code == 200
    assert hoi(clientRag).json()["data"]["cheDo"] == "LLM"
    assert hoi(clientRag, phienId=2, taiLieuIdsHienCo=[4]).json()["data"]["cheDo"] == "LLM"
    assert hoi(clientRag, phienId=3, taiLieuIdsHienCo=[7]).json()["data"]["cheDo"] == "KHONG_TIM_THAY"


def test_taiLieuHienCoSaiDinhDangTra400(clientRag):
    assert hoi(clientRag, taiLieuHienCo=[{"id": 0, "maTaiLieu": "A"}]).status_code == 400
    assert hoi(clientRag, taiLieuHienCo=[{"id": 1, "maTaiLieu": ""}]).status_code == 400


def test_lapChiMucTaiLieuKhacDonVectorCungIdKhacMa(clientRag):
    assert clientRag.post("/noiBo/rag/lapChiMuc", json=TL_CU).status_code == 200
    assert 4 in khoVector.thongKeTaiLieu()
    hienCo = [{"id": 4, "maTaiLieu": "QC-MOI"}, {"id": 5, "maTaiLieu": "QC-LUONG"}]
    res = clientRag.post("/noiBo/rag/lapChiMuc", json={**TL_KHAC, "taiLieuIdsHienCo": [4, 5], "taiLieuHienCo": hienCo})
    assert res.status_code == 200, res.text
    thongKe = khoVector.thongKeTaiLieu()
    assert 4 not in thongKe and 5 in thongKe


def test_lapChiMucKhongTaiLieuHienCoGiuVectorCungId(clientRag):
    assert clientRag.post("/noiBo/rag/lapChiMuc", json=TL_CU).status_code == 200
    res = clientRag.post("/noiBo/rag/lapChiMuc", json={**TL_KHAC, "taiLieuIdsHienCo": [4, 5]})
    assert res.status_code == 200
    assert {4, 5} <= set(khoVector.thongKeTaiLieu())


def test_lapChiMucMaKhopGiuNguyenVector(clientRag):
    assert clientRag.post("/noiBo/rag/lapChiMuc", json=TL_CU).status_code == 200
    hienCo = [{"id": 4, "maTaiLieu": "QC-NGHIPHEP"}, {"id": 5, "maTaiLieu": "QC-LUONG"}]
    clientRag.post("/noiBo/rag/lapChiMuc", json={**TL_KHAC, "taiLieuIdsHienCo": [4, 5], "taiLieuHienCo": hienCo})
    assert {4, 5} <= set(khoVector.thongKeTaiLieu())


# --- TB2 ---


def test_hanChotCon5GiayGoiLlmVoiThoiGianChoNhoHon4(clientRag, llmGia, monkeypatch):
    monkeypatch.setenv("NGUONG_DIEM_RAG", "-1")
    clientRag.post("/noiBo/rag/lapChiMuc", json=TL_CU)
    res = hoi(clientRag, hanChot=int(time.time() * 1000) + 5000)
    assert res.status_code == 200 and res.json()["data"]["cheDo"] == "LLM"
    thoiGianCho = llmGia["loiGoi"][0]["thoiGianCho"]
    assert thoiGianCho is not None and 1 <= thoiGianCho <= 4


def test_hanChotConDuoi2GiayBoLlmTraDuPhongVanGhiLichSu(clientRag, llmGia, monkeypatch):
    monkeypatch.setenv("NGUONG_DIEM_RAG", "-1")
    clientRag.post("/noiBo/rag/lapChiMuc", json=TL_CU)
    res = hoi(clientRag, phienId=31, hanChot=int(time.time() * 1000) + 1500)
    assert res.status_code == 200, res.text
    assert res.json()["data"]["cheDo"] == "DU_PHONG"
    assert llmGia["loiGoi"] == []
    tinNhan = clientRag.get("/noiBo/lichSu/31", params={"dauPhien": DAU}).json()["data"]["tinNhan"]
    assert len(tinNhan) == 2


def test_khongHanChotThoiGianChoNone(clientRag, llmGia, monkeypatch):
    monkeypatch.setenv("NGUONG_DIEM_RAG", "-1")
    clientRag.post("/noiBo/rag/lapChiMuc", json=TL_CU)
    assert hoi(clientRag).status_code == 200
    assert llmGia["loiGoi"][0]["thoiGianCho"] is None


def test_thoiGianChoLlmKhongVuotCauHinh(monkeypatch):
    monkeypatch.setenv("LLM_TIMEOUT_GIAY", "3")
    assert moduleHoiDap._thoiGianChoLlm(int(time.time() * 1000) + 60000) == 3
    assert moduleHoiDap._thoiGianChoLlm(None) is None
    assert moduleHoiDap._thoiGianChoLlm(int(time.time() * 1000) + 1500) == 0


class _ClientGia:
    def __init__(self):
        self.messages = self
        self.tuyChon = None
        self.duocGoi = False

    def with_options(self, **tuyChon):
        moi = _ClientGia()
        moi.tuyChon = tuyChon
        self.ban = moi
        return moi

    def create(self, **_):
        from types import SimpleNamespace

        self.duocGoi = True
        return SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="text", text="ok")])


def test_goiLlmThoiGianChoDungWithOptions(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test-key")
    monkeypatch.setenv("LLM_TIMEOUT_GIAY", "25")
    goc = _ClientGia()
    monkeypatch.setattr(claudeClient, "_client", goc)
    monkeypatch.setattr(claudeClient, "_cauHinhClient", ("sk-ant-test-key", 25.0))
    assert claudeClient.goiLlm("x", [{"role": "user", "content": "y"}], thoiGianCho=3.5) == "ok"
    assert goc.ban.tuyChon == {"timeout": 3.5} and goc.ban.duocGoi and not goc.duocGoi
    # Không truyền → dùng client gốc, không with_options
    goc2 = _ClientGia()
    monkeypatch.setattr(claudeClient, "_client", goc2)
    claudeClient.goiLlm("x", [{"role": "user", "content": "y"}])
    assert goc2.duocGoi and not hasattr(goc2, "ban")
