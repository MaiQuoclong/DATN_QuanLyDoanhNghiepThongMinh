"""Route nội bộ Trợ lý AI (gắn routerNoiBo: bắt buộc X-Khoa-Noi-Bo). Chỉ Express gọi.

- POST /noiBo/troLy/xuLy: một lượt chat (phân loại → RAG / hỏi lại / bản nháp đơn / quỹ phép).
- GET  /noiBo/banNhap/{id}?nguoiDungId=: bản nháp của đúng người dùng (người khác → 404).
- POST /noiBo/banNhap/{id}/chuyenTrangThai: chuyển trạng thái nguyên tử (chống bấm Xác nhận hai lần).
ai-service không ghi MySQL: Express tạo đơn bằng service nghiệp vụ sẵn có khi người dùng xác nhận.
"""

from datetime import date

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from functionCalling.trichXuat import xuLy
from lichSu import khoLichSu
from rag import khoVector, nhung
from rag.api import TaiLieuHienCo, _maTheoId
from rag.hoiDap import LoiQuaHanChot

routerTroLy = APIRouter(prefix="/troLy")
routerBanNhap = APIRouter(prefix="/banNhap")

# Chỉ các bước chuyển hợp lệ của vòng đời bản nháp (không cho đi ngược, VD DA_TAO → CHO_XAC_NHAN)
CHUYEN_HOP_LE = {
    (khoLichSu.CHO_XAC_NHAN, khoLichSu.DANG_TAO),
    (khoLichSu.CHO_XAC_NHAN, khoLichSu.HUY),
    (khoLichSu.DANG_TAO, khoLichSu.DA_TAO),
    (khoLichSu.DANG_TAO, khoLichSu.LOI),
}


def _thanhCong(data, message: str) -> dict:
    return {"success": True, "code": 200, "message": message, "data": data}


class LoaiNghiPhep(BaseModel):
    maLoai: str = Field(min_length=1, max_length=30)
    tenLoai: str = Field(min_length=1, max_length=100)


class QuyPhep(BaseModel):
    nam: int
    tongSoNgayPhep: float
    soNgayDaNghi: float
    soNgayChoDuyet: float
    soNgayConLai: float


class YeuCauXuLy(BaseModel):
    phienId: int = Field(gt=0)
    dauPhien: str = Field(min_length=1, max_length=64)
    nguoiDungId: int = Field(gt=0)
    cauHoi: str = Field(min_length=1, max_length=1000)
    ngayHienTai: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    loaiNghiPhep: list[LoaiNghiPhep] = Field(default_factory=list, max_length=100)
    quyPhep: QuyPhep | None = None
    taiLieuIdsHienCo: list[int] | None = None
    taiLieuHienCo: list[TaiLieuHienCo] | None = None
    hanChot: int | None = Field(default=None, gt=0)

    @field_validator("ngayHienTai")
    @classmethod
    def _ngayCoThat(cls, giaTri: str) -> str:
        # Mẫu đúng nhưng sai lịch (2026-13-45) → 422 ngay, kể cả câu hỏi đi luồng RAG
        date.fromisoformat(giaTri)
        return giaTri


@routerTroLy.post("/xuLy")
def xuLyTroLy(yeuCau: YeuCauXuLy):
    if not yeuCau.cauHoi.strip():
        raise HTTPException(status_code=400, detail="Câu hỏi không được để trống")
    try:
        ketQua = xuLy(
            phienId=yeuCau.phienId,
            dauPhien=yeuCau.dauPhien,
            nguoiDungId=yeuCau.nguoiDungId,
            cauHoi=yeuCau.cauHoi,
            ngayHienTai=yeuCau.ngayHienTai,
            loaiNghiPhep=[l.model_dump() for l in yeuCau.loaiNghiPhep],
            quyPhep=yeuCau.quyPhep.model_dump() if yeuCau.quyPhep else None,
            taiLieuIdsHienCo=yeuCau.taiLieuIdsHienCo,
            taiLieuHienCo=_maTheoId(yeuCau.taiLieuHienCo),
            hanChot=yeuCau.hanChot,
        )
    except LoiQuaHanChot as loi:
        raise HTTPException(status_code=504, detail="Quá thời gian chờ, câu hỏi chưa được lưu") from loi
    except (nhung.LoiNhung, khoVector.LoiKhoVector, khoLichSu.LoiLichSu) as loi:
        raise HTTPException(status_code=503, detail=str(loi) or "Trợ lý AI không khả dụng") from loi
    return _thanhCong(ketQua, "Xử lý câu hỏi thành công")


def _layBanNhapHoac404(banNhapId: str, nguoiDungId: int) -> dict:
    try:
        banNhap = khoLichSu.layBanNhap(banNhapId, nguoiDungId)
    except khoLichSu.LoiLichSu as loi:
        raise HTTPException(status_code=503, detail=str(loi)) from loi
    if not banNhap:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản nháp đơn")
    return banNhap


@routerBanNhap.get("/{banNhapId}")
def layBanNhap(banNhapId: str, nguoiDungId: int = Query(gt=0)):
    return _thanhCong(_layBanNhapHoac404(banNhapId, nguoiDungId), "Lấy bản nháp đơn thành công")


class YeuCauChuyenTrangThai(BaseModel):
    nguoiDungId: int = Field(gt=0)
    tu: str
    sang: str
    ketQua: dict | None = None


@routerBanNhap.post("/{banNhapId}/chuyenTrangThai")
def chuyenTrangThai(banNhapId: str, yeuCau: YeuCauChuyenTrangThai):
    if (yeuCau.tu, yeuCau.sang) not in CHUYEN_HOP_LE:
        raise HTTPException(status_code=400, detail="Bước chuyển trạng thái bản nháp không hợp lệ")
    _layBanNhapHoac404(banNhapId, yeuCau.nguoiDungId)
    try:
        daChuyen = khoLichSu.chuyenTrangThaiBanNhap(
            banNhapId, yeuCau.nguoiDungId, yeuCau.tu, yeuCau.sang, yeuCau.ketQua
        )
        banNhap = khoLichSu.layBanNhap(banNhapId, yeuCau.nguoiDungId)
    except khoLichSu.LoiLichSu as loi:
        raise HTTPException(status_code=503, detail=str(loi)) from loi
    return _thanhCong(
        {"daChuyen": daChuyen, "banNhap": banNhap},
        "Cập nhật bản nháp đơn thành công" if daChuyen else "Bản nháp không ở trạng thái yêu cầu",
    )
