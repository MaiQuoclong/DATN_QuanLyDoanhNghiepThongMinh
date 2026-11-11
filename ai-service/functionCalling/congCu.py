"""Khai báo tool cho LLM. CHỈ các trường dưới đây được nhận: không có trường nào chỉ định nhân viên, trạng thái,
người duyệt — chủ thể đơn luôn là người đang chat (Express lấy từ JWT), đơn luôn CHO_DUYET."""

TAO_DON_NGHI_PHEP = "taoDonNghiPhep"
TAO_YEU_CAU_DIEU_CHINH_CONG = "taoYeuCauDieuChinhCong"
XEM_QUY_PHEP = "xemQuyPhep"

# Danh sách trắng trường của từng tool (trường lạ do LLM bịa ra bị bỏ)
TRUONG_HOP_LE = {
    TAO_DON_NGHI_PHEP: ("maLoaiNghiPhep", "ngayBatDau", "ngayKetThuc", "nuaNgay", "lyDo"),
    TAO_YEU_CAU_DIEU_CHINH_CONG: ("ngayCanDieuChinh", "gioVaoDeXuat", "gioRaDeXuat", "lyDoGiaiTrinh"),
    XEM_QUY_PHEP: ("nam",),
}


def taoDanhSachCongCu(cacMaLoai: list[str]) -> list[dict]:
    """cacMaLoai: mã loại nghỉ phép đang áp dụng (Express gửi từ CSDL) → enum để LLM không bịa mã."""
    maLoai: dict = {"type": "string", "description": "Mã loại nghỉ phép"}
    if cacMaLoai:
        maLoai["enum"] = cacMaLoai
    return [
        {
            "name": TAO_DON_NGHI_PHEP,
            "description": (
                "Soạn đơn xin nghỉ phép cho CHÍNH người đang chat (không tạo cho người khác). "
                "Chỉ điền thông tin người dùng đã nói rõ; trường nào chưa rõ thì bỏ trống."
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "maLoaiNghiPhep": maLoai,
                    "ngayBatDau": {"type": "string", "description": "Ngày bắt đầu nghỉ, dạng YYYY-MM-DD"},
                    "ngayKetThuc": {"type": "string", "description": "Ngày kết thúc nghỉ, dạng YYYY-MM-DD"},
                    "nuaNgay": {"type": "boolean", "description": "true nếu chỉ nghỉ nửa ngày (bắt đầu = kết thúc)"},
                    "lyDo": {"type": "string", "description": "Lý do nghỉ, viết lại ngắn gọn bằng tiếng Việt"},
                },
            },
        },
        {
            "name": TAO_YEU_CAU_DIEU_CHINH_CONG,
            "description": (
                "Soạn yêu cầu điều chỉnh chấm công (quên check-in/check-out, giờ sai) cho CHÍNH người đang chat. "
                "Chỉ điền thông tin người dùng đã nói rõ; trường nào chưa rõ thì bỏ trống."
            ),
            "input_schema": {
                "type": "object",
                "properties": {
                    "ngayCanDieuChinh": {"type": "string", "description": "Ngày cần điều chỉnh, dạng YYYY-MM-DD"},
                    "gioVaoDeXuat": {"type": "string", "description": "Giờ vào đề xuất, dạng HH:MM (24 giờ)"},
                    "gioRaDeXuat": {"type": "string", "description": "Giờ ra đề xuất, dạng HH:MM (24 giờ)"},
                    "lyDoGiaiTrinh": {"type": "string", "description": "Lý do giải trình, tiếng Việt"},
                },
            },
        },
        {
            "name": XEM_QUY_PHEP,
            "description": "Xem quỹ phép năm của CHÍNH người đang chat (tổng, đã nghỉ, đang chờ duyệt, còn lại).",
            "input_schema": {
                "type": "object",
                "properties": {"nam": {"type": "integer", "description": "Năm cần xem, mặc định năm hiện tại"}},
            },
        },
    ]
