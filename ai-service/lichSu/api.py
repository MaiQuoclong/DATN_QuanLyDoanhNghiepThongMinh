"""Route nội bộ lịch sử chat (gắn routerNoiBo: bắt buộc X-Khoa-Noi-Bo). Express đã kiểm tra phiên thuộc người dùng."""

from fastapi import APIRouter, HTTPException, Query

from lichSu import khoLichSu

router = APIRouter(prefix="/lichSu")


def _kiemTraPhien(phienId: int) -> None:
    if phienId <= 0:
        raise HTTPException(status_code=400, detail="Mã phiên trò chuyện không hợp lệ")


@router.get("/{phienId}")
def layLichSu(phienId: int, dauPhien: str = Query(min_length=1, max_length=64)):
    _kiemTraPhien(phienId)
    try:
        tinNhan = khoLichSu.layTinNhan(phienId, dauPhien)
    except khoLichSu.LoiLichSu as loi:
        raise HTTPException(status_code=503, detail=str(loi)) from loi
    return {"success": True, "code": 200, "message": "Lấy lịch sử trò chuyện thành công", "data": {"tinNhan": tinNhan}}


@router.delete("/{phienId}")
def xoaLichSu(phienId: int):
    _kiemTraPhien(phienId)
    try:
        soTin = khoLichSu.xoaPhien(phienId)
    except khoLichSu.LoiLichSu as loi:
        raise HTTPException(status_code=503, detail=str(loi)) from loi
    return {
        "success": True,
        "code": 200,
        "message": "Xóa lịch sử trò chuyện thành công",
        "data": {"phienId": phienId, "soTinNhanDaXoa": soTin},
    }
