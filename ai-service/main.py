"""ai-service Smart HRM (FastAPI). Chỉ Express gọi vào qua /noiBo/* kèm X-Khoa-Noi-Bo; chạy bind 127.0.0.1.

Chạy: .venv/Scripts/python main.py
"""

from datetime import datetime, timezone

import uvicorn
from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from baoMat import kiemTraKhoaNoiBo
from cauHinh import layCauHinh
from llm.claudeClient import daCauHinhLlm
from functionCalling.api import routerBanNhap, routerTroLy
from lichSu.api import router as routerLichSu
from rag.api import router as routerRag

app = FastAPI(title="Smart HRM AI Service", docs_url=None, redoc_url=None, openapi_url=None)


def _phanHoiLoi(code: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=code, content={"success": False, "code": code, "message": message, "data": None})


@app.exception_handler(StarletteHTTPException)
async def xuLyLoiHttp(_request: Request, loi: StarletteHTTPException):
    message = loi.detail if isinstance(loi.detail, str) else "Yêu cầu không hợp lệ"
    if loi.status_code == 404 and message == "Not Found":
        message = "Không tìm thấy đường dẫn"
    return _phanHoiLoi(loi.status_code, message)


@app.exception_handler(RequestValidationError)
async def xuLyLoiDuLieu(_request: Request, _loi: RequestValidationError):
    return _phanHoiLoi(400, "Dữ liệu gửi lên không hợp lệ")


@app.exception_handler(Exception)
async def xuLyLoiChung(_request: Request, _loi: Exception):
    return _phanHoiLoi(500, "Lỗi nội bộ AI service")


def thanhCong(data=None, message: str = "Thành công") -> dict:
    return {"success": True, "code": 200, "message": message, "data": data}


@app.get("/sucKhoe")
def kiemTraSucKhoe():
    # Không cần khóa, không lộ cấu hình nhạy cảm: chỉ báo đã có khóa LLM hay chưa
    llm = "DA_CAU_HINH" if daCauHinhLlm() else "CHUA_CAU_HINH"
    return thanhCong(
        {"mayChu": "HOAT_DONG", "llm": llm, "thoiGian": datetime.now(timezone.utc).isoformat()},
        "AI service đang hoạt động",
    )


# Mọi route nội bộ (rag, lichSu, functionCalling, textToSql) gắn vào router này để bắt buộc khóa
routerNoiBo = APIRouter(prefix="/noiBo", dependencies=[Depends(kiemTraKhoaNoiBo)])


@routerNoiBo.get("/kiemTra")
def kiemTraNoiBo():
    return thanhCong({"hopLe": True}, "Khóa nội bộ hợp lệ")


routerNoiBo.include_router(routerRag)
routerNoiBo.include_router(routerLichSu)
routerNoiBo.include_router(routerTroLy)
routerNoiBo.include_router(routerBanNhap)
app.include_router(routerNoiBo)


def _napTruocMoHinhNhung():
    # Nạp model embedding nền ngay khi khởi động (lần đầu tải ~1.1GB) để request lập chỉ mục/hỏi đáp đầu tiên
    # không phải chờ; lỗi chỉ ghi log, request sau sẽ thử nạp lại và trả 503 thân thiện
    from rag import nhung

    if nhung.tenMoHinhHienTai() == nhung.MO_HINH_GIA:
        return
    try:
        nhung.nhungCauHoi("khởi động")
        print(f"[ai-service] Đã nạp model embedding {nhung.tenMoHinhHienTai()}")
    except nhung.LoiNhung as loi:
        print(f"[ai-service] Chưa nạp được model embedding: {loi}")


if __name__ == "__main__":
    import threading

    threading.Thread(target=_napTruocMoHinhNhung, daemon=True).start()
    uvicorn.run(app, host="127.0.0.1", port=layCauHinh().cong)
