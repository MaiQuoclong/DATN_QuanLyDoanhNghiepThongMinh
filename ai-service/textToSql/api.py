"""Route nội bộ báo cáo Text-to-SQL (gắn routerNoiBo: bắt buộc X-Khoa-Noi-Bo). Chỉ Express gọi.

POST /noiBo/baoCao/truyVan: cheDoPhamVi + phongBanIds do Express tính từ JWT (không tin câu hỏi).
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from textToSql.moTaSchema import PHONG_BAN, TOAN_CONG_TY
from textToSql.sinhSql import LoiQuaHanChot, xuLyBaoCao

router = APIRouter(prefix="/baoCao")


class YeuCauTruyVan(BaseModel):
    cauHoi: str = Field(min_length=1, max_length=500)
    cheDoPhamVi: str = Field(pattern=f"^({TOAN_CONG_TY}|{PHONG_BAN})$")
    phongBanIds: list[int] = Field(default_factory=list, max_length=500)
    ngayHienTai: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    hanChot: int | None = Field(default=None, gt=0)


@router.post("/truyVan")
def truyVan(yeuCau: YeuCauTruyVan):
    try:
        data = xuLyBaoCao(
            yeuCau.cauHoi, yeuCau.cheDoPhamVi, yeuCau.phongBanIds, yeuCau.ngayHienTai, yeuCau.hanChot
        )
    except LoiQuaHanChot as loi:
        raise HTTPException(status_code=504, detail="Quá thời gian xử lý báo cáo") from loi
    return {"success": True, "code": 200, "message": "Xử lý báo cáo thành công", "data": data}
