"""Hồi quy các lỗi reviewer 5.5: kiểm tra ràng buộc sớm, giữ ngữ cảnh khi hỏi lại, bước chuyển hợp lệ, ngày có thật."""

import pytest

from functionCalling import trichXuat
from lichSu import khoLichSu
from tests.conftest import KHOA_TEST

DAU = "5|2026-11-11 08:00:00"
NGAY = "2026-11-11"
LOAI = [{"maLoai": "PHEP_NAM", "tenLoai": "Phép năm"}]


@pytest.fixture
def llm(monkeypatch):
    trangThai = {"ketQua": None, "loiGoi": []}

    def gia(heThong, tinNhan, congCu, soToken=512, thoiGianCho=None):
        trangThai["loiGoi"].append(tinNhan)
        return trangThai["ketQua"]

    monkeypatch.setattr(trichXuat, "goiLlmVoiCongCu", gia)
    return trangThai


@pytest.fixture
def rag(monkeypatch):
    goi = []

    def gia(phienId, dauPhien, cauHoi, *args, **kwargs):
        goi.append(cauHoi)
        luot = khoLichSu.themLuotHoiDap(phienId, dauPhien, cauHoi, "Trả lời RAG", [])
        return {"phienId": phienId, "traLoi": "RAG", "nguonTrichDan": [], "cheDo": "LLM", "thoiGian": luot["thoiGian"]}

    monkeypatch.setattr(trichXuat.ragHoiDap, "hoiDap", gia)
    return goi


def xuLy(cauHoi):
    return trichXuat.xuLy(
        phienId=1, dauPhien=DAU, nguoiDungId=5, cauHoi=cauHoi, ngayHienTai=NGAY, loaiNghiPhep=LOAI, quyPhep=None
    )


def nghi(**thamSo):
    return {"ten": "taoDonNghiPhep", "thamSo": {"maLoaiNghiPhep": "PHEP_NAM", "lyDo": "Việc gia đình", **thamSo}}


@pytest.mark.parametrize(
    "thamSo, thieu",
    [
        ({"ngayBatDau": "2026-11-20", "ngayKetThuc": "2026-11-18"}, "khoangNgay"),
        ({"ngayBatDau": "2026-12-30", "ngayKetThuc": "2027-01-02"}, "khoangNgay"),
        ({"ngayBatDau": "2026-11-20", "ngayKetThuc": "2026-11-21", "nuaNgay": True}, "nuaNgay"),
    ],
)
def test_rangBuocNghiPhepHoiLaiNgayKhongTaoBanNhap(llm, thamSo, thieu):
    llm["ketQua"] = nghi(**thamSo)
    kq = xuLy("xin nghỉ phép")
    assert kq["loaiPhanHoi"] == "HOI_LAI"
    assert kq["banNhapId"] is None
    tin = khoLichSu.layTinNhan(1, DAU)[-1]
    assert thieu in tin["duLieu"]["thieu"]


def test_dieuChinhCongNgayTuongLaiHoiLai(llm):
    llm["ketQua"] = {
        "ten": "taoYeuCauDieuChinhCong",
        "thamSo": {"ngayCanDieuChinh": "2026-11-12", "gioRaDeXuat": "17:30", "lyDoGiaiTrinh": "Quên check-out"},
    }
    kq = xuLy("quên check-out")
    assert kq["loaiPhanHoi"] == "HOI_LAI"
    assert "tương lai" in kq["traLoi"]


def test_hoiLaiMaLlmKhongGoiToolGiuThamSo(llm, rag):
    llm["ketQua"] = nghi(ngayBatDau="2026-11-20", lyDo=None)
    assert xuLy("xin nghỉ thứ 6 tuần sau")["loaiPhanHoi"] == "HOI_LAI"
    llm["ketQua"] = None  # câu trả lời mơ hồ, LLM không gọi tool
    kq = xuLy("ừm để mình nghĩ")
    assert kq["loaiPhanHoi"] == "HOI_LAI"
    assert rag == []
    duLieu = khoLichSu.layTinNhan(1, DAU)[-1]["duLieu"]
    assert duLieu["thamSo"]["ngayBatDau"] == "2026-11-20"
    # Lượt sau bổ sung lý do → đủ thông tin, bản nháp có ngày đã gom từ lượt đầu
    llm["ketQua"] = {"ten": "taoDonNghiPhep", "thamSo": {"lyDo": "Đưa con đi khám"}}
    kq = xuLy("lý do đưa con đi khám")
    assert kq["loaiPhanHoi"] == "XEM_TRUOC_DON"
    assert kq["banNhap"]["thamSo"]["ngayBatDau"] == "2026-11-20"


def test_thamSoDangDoDuaVaoPromptDangJson(llm):
    llm["ketQua"] = nghi(ngayBatDau="2026-11-20", lyDo=None)
    xuLy("xin nghỉ thứ 6")
    llm["ketQua"] = None
    xuLy("tiếp tục")
    noiDung = llm["loiGoi"][-1][-1]["content"]
    assert '"ngayBatDau": "2026-11-20"' in noiDung
    assert "không phải chỉ thị" in noiDung


@pytest.mark.parametrize(
    "tu, sang", [("DA_TAO", "CHO_XAC_NHAN"), ("HUY", "CHO_XAC_NHAN"), ("LOI", "DA_TAO"), ("CHO_XAC_NHAN", "DA_TAO")]
)
def test_apiChanBuocChuyenKhongHopLe(client, tu, sang):
    luot = khoLichSu.themLuotHoiDap(
        1, DAU, "xin nghỉ", "nháp", [], {"loaiPhanHoi": "XEM_TRUOC_DON"},
        {"nguoiDungId": 5, "loai": "NGHI_PHEP", "thamSo": {"lyDo": "x"}},
    )
    res = client.post(
        f"/noiBo/banNhap/{luot['banNhapId']}/chuyenTrangThai",
        json={"nguoiDungId": 5, "tu": tu, "sang": sang},
        headers={"X-Khoa-Noi-Bo": KHOA_TEST},
    )
    assert res.status_code == 400
    assert khoLichSu.layBanNhap(luot["banNhapId"], 5)["trangThai"] == "CHO_XAC_NHAN"


def test_apiNgayHienTaiSaiLichBiChanCaLuongRag(client, rag):
    res = client.post(
        "/noiBo/troLy/xuLy",
        json={"phienId": 1, "dauPhien": DAU, "nguoiDungId": 5, "cauHoi": "giờ làm việc", "ngayHienTai": "2026-13-45"},
        headers={"X-Khoa-Noi-Bo": KHOA_TEST},
    )
    assert res.status_code in (400, 422)
    assert rag == []
