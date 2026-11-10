"""Xác thực lời gọi nội bộ từ Express bằng header X-Khoa-Noi-Bo (so sánh thời gian hằng)."""

import hmac

from fastapi import Header, HTTPException

from cauHinh import layCauHinh

DO_DAI_KHOA_TOI_THIEU = 32


def kiemTraKhoaNoiBo(x_khoa_noi_bo: str | None = Header(default=None)) -> None:
    khoa = layCauHinh().khoaNoiBo
    # Chưa cấu hình khóa đủ mạnh -> từ chối mọi lời gọi thay vì mở cửa
    if len(khoa) < DO_DAI_KHOA_TOI_THIEU:
        raise HTTPException(status_code=503, detail="AI service chưa cấu hình khóa nội bộ")
    if not x_khoa_noi_bo or not hmac.compare_digest(x_khoa_noi_bo.encode(), khoa.encode()):
        raise HTTPException(status_code=401, detail="Khóa nội bộ không hợp lệ")
