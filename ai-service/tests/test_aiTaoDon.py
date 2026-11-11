"""5.5 AI tạo đơn qua chat. LLM luôn mock (monkeypatch functionCalling.trichXuat.goiLlmVoiCongCu), RAG mock,
SQLite tạm theo conftest (mỗi test một tệp riêng)."""

import sqlite3
import threading
import time

import pytest

from functionCalling import trichXuat
from functionCalling.tuKhoa import coYDinhTaoDon
from lichSu import khoLichSu
from llm.claudeClient import LoiLlm

DAU = "5|2026-11-11 08:00:00"
NGAY = "2026-11-11"
LOAI = [{"maLoai": "PHEP_NAM", "tenLoai": "Phép năm"}, {"maLoai": "NGHI_OM", "tenLoai": "Nghỉ ốm"}]
QUY = {"nam": 2026, "tongSoNgayPhep": 12, "soNgayDaNghi": 2, "soNgayChoDuyet": 1, "soNgayConLai": 9}
NGHI_DU = {"maLoaiNghiPhep": "PHEP_NAM", "ngayBatDau": "2026-11-20", "ngayKetThuc": "2026-11-20", "lyDo": "Việc gia đình"}


@pytest.fixture
def llm(monkeypatch):
    """ketQua: dict {ten, thamSo} | None | Exception; loiGoi ghi lại tham số."""
    trangThai = {"ketQua": None, "loiGoi": []}

    def gia(heThong, tinNhan, congCu, soToken=512, thoiGianCho=None):
        trangThai["loiGoi"].append({"heThong": heThong, "tinNhan": tinNhan, "congCu": congCu})
        kq = trangThai["ketQua"]
        if isinstance(kq, Exception):
            raise kq
        return kq

    monkeypatch.setattr(trichXuat, "goiLlmVoiCongCu", gia)
    return trangThai


@pytest.fixture
def rag(monkeypatch):
    goi = []

    def gia(phienId, dauPhien, cauHoi, *args, **kwargs):
        goi.append(cauHoi)
        luot = khoLichSu.themLuotHoiDap(phienId, dauPhien, cauHoi, "Trả lời RAG", [])
        return {"phienId": phienId, "traLoi": "Trả lời RAG", "nguonTrichDan": [], "cheDo": "LLM", "thoiGian": luot["thoiGian"]}

    monkeypatch.setattr(trichXuat.ragHoiDap, "hoiDap", gia)
    return goi


def xuLy(cauHoi, phienId=1, nguoiDungId=5, **them):
    thamSo = dict(phienId=phienId, dauPhien=DAU, nguoiDungId=nguoiDungId, cauHoi=cauHoi, ngayHienTai=NGAY,
                  loaiNghiPhep=LOAI, quyPhep=QUY)
    thamSo.update(them)
    return trichXuat.xuLy(**thamSo)


def taoBanNhap(nguoiDungId=5, phienId=1):
    luot = khoLichSu.themLuotHoiDap(phienId, DAU, "xin nghỉ", "nháp", [], {"loaiPhanHoi": "XEM_TRUOC_DON"},
                                    {"nguoiDungId": nguoiDungId, "loai": "NGHI_PHEP", "thamSo": NGHI_DU})
    return luot["banNhapId"]


# ---------------- Từ khóa ----------------
@pytest.mark.parametrize("cau", ["Tôi muốn xin nghỉ thứ 6", "xin nghi thu 6", "Hôm qua tôi QUÊN CHECK-OUT",
                                 "quen cham cong", "Tôi còn mấy ngày phép?", "điều chỉnh công ngày 10"])
def test_tuKhoaKhopCoVaKhongDau(cau):
    assert coYDinhTaoDon(cau)


@pytest.mark.parametrize("cau", ["Quy định đi muộn thế nào?", "Lương tháng 13 tính ra sao", "Xin chào"])
def test_tuKhoaKhongKhop(cau):
    assert not coYDinhTaoDon(cau)


def test_cauKhongTuKhoaDiRagKhongGoiTool(llm, rag):
    kq = xuLy("Quy định đi muộn thế nào?")
    assert kq["loaiPhanHoi"] == "TRA_LOI" and rag == ["Quy định đi muộn thế nào?"]
    assert llm["loiGoi"] == []


def test_llmKhongGoiToolChuyenRag(llm, rag):
    llm["ketQua"] = None
    kq = xuLy("Nghỉ phép năm được mấy ngày?")
    assert len(llm["loiGoi"]) == 1 and rag and kq["loaiPhanHoi"] == "TRA_LOI"


def test_congCuKhongCoTruongChiDinhNguoiHoacTrangThai(llm, rag):
    llm["ketQua"] = None
    xuLy("xin nghỉ phép")
    for cc in llm["loiGoi"][0]["congCu"]:
        props = set(cc["input_schema"]["properties"])
        assert not props & {"nhanVienId", "trangThai", "nguoiDuyetId", "phuongThucTao"}
    enum = llm["loiGoi"][0]["congCu"][0]["input_schema"]["properties"]["maLoaiNghiPhep"]["enum"]
    assert enum == ["PHEP_NAM", "NGHI_OM"]


# ---------------- Trích tham số ----------------
def test_xemTruocDonTaoBanNhapVaLocTruongLa(llm, rag):
    llm["ketQua"] = {"ten": "taoDonNghiPhep",
                     "thamSo": {**NGHI_DU, "nhanVienId": 99, "trangThai": "DA_DUYET", "nguoiDuyetId": 1}}
    kq = xuLy("xin nghỉ phép năm 20/11 việc gia đình")
    assert kq["loaiPhanHoi"] == "XEM_TRUOC_DON" and kq["banNhapId"]
    bn = kq["banNhap"]
    assert bn["trangThai"] == "CHO_XAC_NHAN" and bn["loai"] == "NGHI_PHEP" and bn["nguoiDungId"] == 5
    assert bn["thamSo"] == NGHI_DU
    assert "Thứ Sáu, 20/11/2026" in kq["traLoi"]
    assert not rag


def test_banNhapMoiThayBanCuThanhHuy(llm, rag):
    llm["ketQua"] = {"ten": "taoDonNghiPhep", "thamSo": NGHI_DU}
    cu = xuLy("xin nghỉ phép")["banNhapId"]
    moi = xuLy("xin nghỉ phép lại")["banNhapId"]
    assert cu != moi
    assert khoLichSu.layBanNhap(cu, 5)["trangThai"] == "HUY"
    assert khoLichSu.layBanNhap(moi, 5)["trangThai"] == "CHO_XAC_NHAN"


@pytest.mark.parametrize("thamSo,thieu", [
    ({**NGHI_DU, "ngayBatDau": "20/11/2026", "ngayKetThuc": "20/11/2026"}, ["ngayBatDau", "ngayKetThuc"]),
    ({**NGHI_DU, "ngayBatDau": "2028-01-01", "ngayKetThuc": "2028-01-01"}, ["ngayBatDau", "ngayKetThuc"]),
    ({**NGHI_DU, "ngayBatDau": "2026-02-30", "ngayKetThuc": "2026-02-30"}, ["ngayBatDau", "ngayKetThuc"]),
    ({**NGHI_DU, "maLoaiNghiPhep": "LOAI_BIA"}, ["maLoaiNghiPhep"]),
    ({**NGHI_DU, "lyDo": "abc"}, ["lyDo"]),
])
def test_thamSoSaiHoiLai(llm, rag, thamSo, thieu):
    llm["ketQua"] = {"ten": "taoDonNghiPhep", "thamSo": thamSo}
    kq = xuLy("xin nghỉ phép")
    assert kq["loaiPhanHoi"] == "HOI_LAI" and kq["banNhapId"] is None
    tin = khoLichSu.layTinNhan(1, DAU)[-1]
    assert tin["duLieu"]["thieu"] == thieu
    for t in thieu:
        assert t not in tin["duLieu"]["thamSo"]


def test_dieuChinhCongGioSaiHoiLai(llm, rag):
    llm["ketQua"] = {"ten": "taoYeuCauDieuChinhCong",
                     "thamSo": {"ngayCanDieuChinh": "2026-11-10", "gioRaDeXuat": "25:00", "lyDoGiaiTrinh": "Quên bấm"}}
    kq = xuLy("quên check-out hôm qua")
    assert kq["loaiPhanHoi"] == "HOI_LAI"
    assert khoLichSu.layTinNhan(1, DAU)[-1]["duLieu"]["thieu"] == ["gio"]


def test_gopThamSoQuaHaiLuot(llm, rag):
    llm["ketQua"] = {"ten": "taoDonNghiPhep", "thamSo": {"maLoaiNghiPhep": "PHEP_NAM", "ngayBatDau": "2026-11-20"}}
    assert xuLy("xin nghỉ phép năm 20/11")["loaiPhanHoi"] == "HOI_LAI"
    # Lượt 2 không có từ khóa nhưng đang dở → vẫn đi luồng tạo đơn, gộp tham số
    llm["ketQua"] = {"ten": "taoDonNghiPhep", "thamSo": {"lyDo": "Việc gia đình"}}
    kq = xuLy("lý do việc gia đình")
    assert not rag
    assert "đơn đang soạn dở" in llm["loiGoi"][1]["tinNhan"][-1]["content"]
    assert kq["loaiPhanHoi"] == "XEM_TRUOC_DON"
    assert kq["banNhap"]["thamSo"] == NGHI_DU


def test_quyPhep(llm, rag):
    llm["ketQua"] = {"ten": "xemQuyPhep", "thamSo": {}}
    kq = xuLy("Tôi còn mấy ngày phép?")
    assert kq["loaiPhanHoi"] == "QUY_PHEP" and "còn lại 9" in kq["traLoi"]
    kq2 = xuLy("quỹ phép của tôi", quyPhep=None)
    assert kq2["loaiPhanHoi"] == "QUY_PHEP" and "chưa được cấp quỹ phép" in kq2["traLoi"]


def test_loiLlmTraDuPhong(llm, rag):
    llm["ketQua"] = LoiLlm("hỏng")
    kq = xuLy("xin nghỉ phép")
    assert kq["cheDo"] == "DU_PHONG" and kq["loaiPhanHoi"] == "TRA_LOI" and kq["traLoi"] == trichXuat.TRA_LOI_DU_PHONG
    assert len(khoLichSu.layTinNhan(1, DAU)) == 2


def test_quaHanChotKhongGoiLlmKhongGhiLichSu(client, llm, rag):
    client.headers.update({"X-Khoa-Noi-Bo": "khoa-noi-bo-dung-cho-test-dai-toi-thieu-32-ky-tu"})
    res = client.post("/noiBo/troLy/xuLy", json={"phienId": 1, "dauPhien": DAU, "nguoiDungId": 5,
                                                 "cauHoi": "xin nghỉ phép", "ngayHienTai": NGAY,
                                                 "hanChot": int(time.time() * 1000) - 1000})
    assert res.status_code == 504, res.text
    assert llm["loiGoi"] == [] and khoLichSu.layTinNhan(1, DAU) == []


@pytest.mark.parametrize("ngay", ["2026/11/11", "2026-13-45", "abc"])
def test_apiNgayHienTaiSai400(client, llm, rag, ngay):
    client.headers.update({"X-Khoa-Noi-Bo": "khoa-noi-bo-dung-cho-test-dai-toi-thieu-32-ky-tu"})
    res = client.post("/noiBo/troLy/xuLy", json={"phienId": 1, "dauPhien": DAU, "nguoiDungId": 5,
                                                 "cauHoi": "xin nghỉ phép", "ngayHienTai": ngay})
    assert res.status_code == 400, res.text
    assert res.json()["success"] is False


# ---------------- Bản nháp ----------------
def test_chuyenTrangThaiHaiLuongChiMotThanhCong():
    banNhapId = taoBanNhap()
    ketQua = []
    rao = threading.Barrier(8)

    def chay():
        rao.wait()
        ketQua.append(khoLichSu.chuyenTrangThaiBanNhap(banNhapId, 5, "CHO_XAC_NHAN", "DANG_TAO"))

    luong = [threading.Thread(target=chay) for _ in range(8)]
    for t in luong:
        t.start()
    for t in luong:
        t.join()
    assert ketQua.count(True) == 1
    assert khoLichSu.layBanNhap(banNhapId, 5)["trangThai"] == "DANG_TAO"


def test_ttlHetHanKhongChuyenDuoc(monkeypatch):
    banNhapId = taoBanNhap()
    sau = khoLichSu._bayGioMs() + khoLichSu.TTL_BAN_NHAP_MS + 1000
    monkeypatch.setattr(khoLichSu, "_bayGioMs", lambda: sau)
    assert khoLichSu.layBanNhap(banNhapId, 5)["trangThai"] == "HET_HAN"
    assert khoLichSu.chuyenTrangThaiBanNhap(banNhapId, 5, "CHO_XAC_NHAN", "DANG_TAO") is False
    assert khoLichSu.layBanNhapDangCho(1, DAU) is None


def test_dangTaoQuaHaiPhutCoiLaKhongRo(monkeypatch):
    banNhapId = taoBanNhap()
    assert khoLichSu.chuyenTrangThaiBanNhap(banNhapId, 5, "CHO_XAC_NHAN", "DANG_TAO")
    sau = khoLichSu._bayGioMs() + khoLichSu.KET_DANG_TAO_MS + 1000
    monkeypatch.setattr(khoLichSu, "_bayGioMs", lambda: sau)
    assert khoLichSu.layBanNhap(banNhapId, 5)["trangThai"] == "KHONG_RO"


def test_banNhapNguoiKhacKhongThay(client):
    client.headers.update({"X-Khoa-Noi-Bo": "khoa-noi-bo-dung-cho-test-dai-toi-thieu-32-ky-tu"})
    banNhapId = taoBanNhap(nguoiDungId=5)
    assert khoLichSu.layBanNhap(banNhapId, 6) is None
    assert khoLichSu.chuyenTrangThaiBanNhap(banNhapId, 6, "CHO_XAC_NHAN", "DANG_TAO") is False
    assert client.get(f"/noiBo/banNhap/{banNhapId}", params={"nguoiDungId": 6}).status_code == 404
    res = client.post(f"/noiBo/banNhap/{banNhapId}/chuyenTrangThai",
                      json={"nguoiDungId": 6, "tu": "CHO_XAC_NHAN", "sang": "DANG_TAO"})
    assert res.status_code == 404
    ok = client.get(f"/noiBo/banNhap/{banNhapId}", params={"nguoiDungId": 5})
    assert ok.status_code == 200 and ok.json()["data"]["trangThai"] == "CHO_XAC_NHAN"


def test_apiChuyenTrangThaiLaHoacHetHan400(client):
    client.headers.update({"X-Khoa-Noi-Bo": "khoa-noi-bo-dung-cho-test-dai-toi-thieu-32-ky-tu"})
    banNhapId = taoBanNhap()
    for sang in ("HET_HAN", "DA_DUYET"):
        res = client.post(f"/noiBo/banNhap/{banNhapId}/chuyenTrangThai",
                          json={"nguoiDungId": 5, "tu": "CHO_XAC_NHAN", "sang": sang})
        assert res.status_code == 400
    res = client.post(f"/noiBo/banNhap/{banNhapId}/chuyenTrangThai",
                      json={"nguoiDungId": 5, "tu": "CHO_XAC_NHAN", "sang": "DANG_TAO"})
    assert res.json()["data"]["daChuyen"] is True
    res = client.post(f"/noiBo/banNhap/{banNhapId}/chuyenTrangThai",
                      json={"nguoiDungId": 5, "tu": "CHO_XAC_NHAN", "sang": "DANG_TAO"})
    assert res.json()["data"]["daChuyen"] is False


def test_layTinNhanGanTrangThaiBanNhap():
    banNhapId = taoBanNhap()
    khoLichSu.chuyenTrangThaiBanNhap(banNhapId, 5, "CHO_XAC_NHAN", "DANG_TAO")
    khoLichSu.chuyenTrangThaiBanNhap(banNhapId, 5, "DANG_TAO", "DA_TAO", {"maDon": "DNP2026-0099"})
    tin = khoLichSu.layTinNhan(1, DAU)[-1]
    assert tin["banNhap"]["trangThai"] == "DA_TAO" and tin["banNhap"]["ketQua"] == {"maDon": "DNP2026-0099"}


def test_migrationDuLieuJsonTrenTepCu(tmp_path, monkeypatch):
    tep = tmp_path / "cu.db"
    monkeypatch.setenv("DUONG_DAN_LICH_SU", str(tep))
    kn = sqlite3.connect(tep)
    kn.execute("""CREATE TABLE tinNhan (id INTEGER PRIMARY KEY AUTOINCREMENT, phienId INTEGER NOT NULL,
               dauPhien TEXT NOT NULL, vaiTro TEXT NOT NULL, noiDung TEXT NOT NULL,
               nguonJson TEXT NOT NULL DEFAULT '[]', thoiGian TEXT NOT NULL)""")
    kn.execute("INSERT INTO tinNhan (phienId, dauPhien, vaiTro, noiDung, thoiGian) VALUES (1, ?, 'troLy', 'cũ', 'x')",
               (DAU,))
    kn.commit()
    kn.close()
    for _ in range(2):  # chạy lại migration không lỗi
        tin = khoLichSu.layTinNhan(1, DAU)
        assert tin[0]["noiDung"] == "cũ" and tin[0]["duLieu"] is None
    assert taoBanNhap()
