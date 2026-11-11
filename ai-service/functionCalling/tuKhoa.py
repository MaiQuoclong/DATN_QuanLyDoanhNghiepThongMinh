"""Lọc từ khóa rẻ trước khi gọi LLM có tool: câu không có dấu hiệu tạo đơn / xem quỹ phép đi thẳng luồng RAG
(tiết kiệm một lượt gọi LLM cho phần lớn câu hỏi quy chế)."""

import re
import unicodedata

# So khớp trên chuỗi đã bỏ dấu, chữ thường, gộp khoảng trắng
CUM_TU_TAO_DON = (
    "xin nghi",
    "muon nghi",
    "can nghi",
    "dang ky nghi",
    "tao don",
    "lam don",
    "viet don",
    "nop don",
    "don nghi",
    "nghi phep",
    "nghi om",
    "nghi ket hon",
    "nghi viec tang",
    "nghi khong luong",
    "quen cham",
    "quen check",
    "quen bam",
    "dieu chinh cong",
    "dieu chinh cham cong",
    "sua cong",
    "sua gio",
    "bo sung cong",
    "check in",
    "check-in",
    "checkin",
    "check out",
    "check-out",
    "checkout",
)
CUM_TU_QUY_PHEP = ("quy phep", "con may ngay phep", "con bao nhieu ngay phep", "ngay phep con", "so ngay phep")
# Câu hỏi thuần quy chế ("được nghỉ phép mấy ngày", "quy định nghỉ ốm") vẫn có thể khớp "nghi phep": LLM có tool
# sẽ không gọi tool và luồng chuyển sang RAG, chỉ tốn thêm một lượt gọi.


def boDau(vanBan: str) -> str:
    chuan = unicodedata.normalize("NFD", vanBan.lower()).replace("đ", "d")
    khongDau = "".join(k for k in chuan if unicodedata.category(k) != "Mn")
    return re.sub(r"\s+", " ", khongDau).strip()


def coYDinhTaoDon(cauHoi: str) -> bool:
    chuan = boDau(cauHoi)
    return any(cum in chuan for cum in CUM_TU_TAO_DON + CUM_TU_QUY_PHEP)
