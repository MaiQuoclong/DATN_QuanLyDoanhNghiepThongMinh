"""Route nội bộ RAG (gắn vào routerNoiBo trong main.py nên bắt buộc X-Khoa-Noi-Bo). Chỉ Express gọi."""

import threading

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from cauHinh import layCauHinh
from lichSu.khoLichSu import LoiLichSu
from rag import khoVector, nhung
from rag.chiaDoan import chiaDoan
from rag.docTaiLieu import LoiDocTaiLieu, docVanBan, giaiDuongDan
from rag.hoiDap import LoiQuaHanChot, hoiDap

router = APIRouter(prefix="/rag")

# Lập chỉ mục tuần tự: tránh hai lượt cùng tài liệu xóa/ghi chen nhau và nạp model hai lần
_khoaLapChiMuc = threading.Lock()


def _thanhCong(data, message: str) -> dict:
    return {"success": True, "code": 200, "message": message, "data": data}


def _loiHaTang(loi: Exception) -> HTTPException:
    # Model embedding / kho vector lỗi: lỗi hạ tầng, Express quy về 503 thân thiện
    return HTTPException(status_code=503, detail=str(loi) or "Kho vector hoặc model embedding không khả dụng")


class TaiLieuHienCo(BaseModel):
    id: int = Field(gt=0)
    maTaiLieu: str = Field(min_length=1, max_length=30)


def _maTheoId(danhSach: list[TaiLieuHienCo] | None) -> dict[int, str] | None:
    return None if danhSach is None else {t.id: t.maTaiLieu for t in danhSach}


class YeuCauLapChiMuc(BaseModel):
    taiLieuId: int = Field(gt=0)
    maTaiLieu: str = Field(min_length=1, max_length=30)
    tieuDe: str = Field(min_length=1, max_length=255)
    duongDanTep: str = Field(min_length=1, max_length=255)
    # Danh sách id tài liệu còn trong CSDL (Express gửi): đoạn của tài liệu đã bị xóa sẽ được dọn
    taiLieuIdsHienCo: list[int] | None = None
    # {id, maTaiLieu} còn trong CSDL: dọn cả vector cùng id nhưng khác mã (id bị cấp lại sau khoiTaoCsdl)
    taiLieuHienCo: list[TaiLieuHienCo] | None = None


@router.post("/lapChiMuc")
def lapChiMuc(yeuCau: YeuCauLapChiMuc):
    cauHinh = layCauHinh()
    try:
        vanBan = docVanBan(giaiDuongDan(cauHinh.thuMucTaiLieu, yeuCau.duongDanTep))
    except LoiDocTaiLieu as loi:
        raise HTTPException(status_code=loi.code, detail=loi.message) from loi

    doan = chiaDoan(vanBan)
    if not doan:
        raise HTTPException(status_code=400, detail="Tài liệu không có nội dung để lập chỉ mục")
    try:
        with _khoaLapChiMuc:
            vectors = nhung.nhungDoan([d.noiDung for d in doan])
            khoVector.thayDoanTaiLieu(yeuCau.taiLieuId, yeuCau.maTaiLieu, yeuCau.tieuDe, doan, vectors)
            daDon = []
            if yeuCau.taiLieuIdsHienCo is not None:
                maTheoId = _maTheoId(yeuCau.taiLieuHienCo)
                if maTheoId is not None:
                    maTheoId[yeuCau.taiLieuId] = yeuCau.maTaiLieu
                daDon = khoVector.donDepMoCoi(set(yeuCau.taiLieuIdsHienCo) | {yeuCau.taiLieuId}, maTheoId)
    except (nhung.LoiNhung, khoVector.LoiKhoVector) as loi:
        raise _loiHaTang(loi) from loi

    soDieu = len({d.dieu for d in doan if d.dieu is not None})
    return _thanhCong(
        {
            "taiLieuId": yeuCau.taiLieuId,
            "soDoan": len(doan),
            "soDieu": soDieu,
            # false = văn bản không theo "Điều n", trích dẫn chỉ ghi được "đoạn k"
            "theoDieuKhoan": soDieu > 0,
            "moHinhNhung": nhung.tenMoHinhHienTai(),
            "daDonTaiLieuIds": daDon,
        },
        "Lập chỉ mục tài liệu thành công",
    )


@router.delete("/taiLieu/{taiLieuId}")
def xoaChiMuc(taiLieuId: int):
    if taiLieuId <= 0:
        raise HTTPException(status_code=400, detail="Mã tài liệu không hợp lệ")
    try:
        # Cùng khóa với lập chỉ mục: xóa không chen giữa lúc đang nhúng rồi bị ghi đè lại
        with _khoaLapChiMuc:
            soDoan = khoVector.xoaTaiLieu(taiLieuId)
    except khoVector.LoiKhoVector as loi:
        raise _loiHaTang(loi) from loi
    return _thanhCong({"taiLieuId": taiLieuId, "soDoanDaXoa": soDoan}, "Xóa chỉ mục tài liệu thành công")


@router.get("/taiLieu")
def thongKeChiMuc():
    try:
        thongKe = khoVector.thongKeTaiLieu()
    except khoVector.LoiKhoVector as loi:
        raise _loiHaTang(loi) from loi
    return _thanhCong(
        {"taiLieu": [{"taiLieuId": tid, "soDoan": so} for tid, so in sorted(thongKe.items())]},
        "Lấy trạng thái chỉ mục thành công",
    )


class YeuCauHoiDap(BaseModel):
    phienId: int = Field(gt=0)
    dauPhien: str = Field(min_length=1, max_length=64)
    cauHoi: str = Field(min_length=1, max_length=1000)
    # Id tài liệu còn trong CSDL: đoạn của tài liệu đã xóa (vector chưa dọn) không được trích dẫn
    taiLieuIdsHienCo: list[int] | None = None
    # {id, maTaiLieu}: lọc theo cả mã (id có thể bị cấp lại cho tài liệu khác sau khoiTaoCsdl)
    taiLieuHienCo: list[TaiLieuHienCo] | None = None
    # Epoch ms Express ngừng chờ; quá hạn thì không gọi LLM/không ghi lịch sử (Express đã báo lỗi cho người dùng)
    hanChot: int | None = Field(default=None, gt=0)


@router.post("/hoiDap")
def hoiDapQuyChe(yeuCau: YeuCauHoiDap):
    if not yeuCau.cauHoi.strip():
        raise HTTPException(status_code=400, detail="Câu hỏi không được để trống")
    try:
        ketQua = hoiDap(
            yeuCau.phienId,
            yeuCau.dauPhien,
            yeuCau.cauHoi,
            yeuCau.taiLieuIdsHienCo,
            yeuCau.hanChot,
            _maTheoId(yeuCau.taiLieuHienCo),
        )
    except LoiQuaHanChot as loi:
        raise HTTPException(status_code=504, detail="Quá thời gian chờ, câu hỏi chưa được lưu") from loi
    except (nhung.LoiNhung, khoVector.LoiKhoVector, LoiLichSu) as loi:
        raise _loiHaTang(loi) from loi
    return _thanhCong(ketQua, "Trả lời câu hỏi thành công")
