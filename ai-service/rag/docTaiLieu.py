"""Đọc văn bản thuần từ tệp quy chế (.md, .pdf, .docx) và chặn đường dẫn ra ngoài thư mục tài liệu."""

import unicodedata
from pathlib import Path, PureWindowsPath

DUOI_HO_TRO = {".md", ".pdf", ".docx"}


class LoiDocTaiLieu(Exception):
    """Lỗi nghiệp vụ khi đọc tệp; code là HTTP trả về cho Express (400/404)."""

    def __init__(self, code: int, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def giaiDuongDan(thuMucGoc: Path, duongDanTep: str) -> Path:
    """Đường dẫn tuyệt đối của tệp; giá trị trỏ ra ngoài thư mục gốc (../, tuyệt đối) bị từ chối."""
    goc = thuMucGoc.resolve()
    tuongDoi = Path(duongDanTep.replace("\\", "/"))
    # PureWindowsPath: chặn "C:/..." cả khi chạy Linux (Path Linux coi "C:" là tên thư mục thường)
    if not duongDanTep or tuongDoi.is_absolute() or PureWindowsPath(duongDanTep).drive:
        raise LoiDocTaiLieu(400, "Đường dẫn tệp tài liệu không hợp lệ")
    tuyetDoi = (goc / tuongDoi).resolve()
    if tuyetDoi == goc or not tuyetDoi.is_relative_to(goc):
        raise LoiDocTaiLieu(400, "Đường dẫn tệp tài liệu không hợp lệ")
    return tuyetDoi


def _docPdf(duongDan: Path) -> str:
    from pypdf import PdfReader

    trang = PdfReader(str(duongDan)).pages
    return "\n".join((t.extract_text() or "") for t in trang)


def _docDocx(duongDan: Path) -> str:
    from docx import Document

    return "\n".join(doan.text for doan in Document(str(duongDan)).paragraphs)


def docVanBan(duongDan: Path) -> str:
    """Văn bản đã chuẩn hóa Unicode NFC (chữ Việt tổ hợp "Điều" vẫn khớp regex chia đoạn)."""
    duoi = duongDan.suffix.lower()
    if duoi not in DUOI_HO_TRO:
        raise LoiDocTaiLieu(400, "Chỉ hỗ trợ tệp .pdf, .docx hoặc .md")
    if not duongDan.is_file():
        raise LoiDocTaiLieu(404, "Không tìm thấy tệp tài liệu trên máy chủ")
    try:
        if duoi == ".md":
            vanBan = duongDan.read_text(encoding="utf-8")
        elif duoi == ".pdf":
            vanBan = _docPdf(duongDan)
        else:
            vanBan = _docDocx(duongDan)
    except Exception as loi:  # pypdf/python-docx ném nhiều loại lỗi khi tệp hỏng
        raise LoiDocTaiLieu(400, f"Tệp {duoi} bị hỏng hoặc không đọc được") from loi
    vanBan = unicodedata.normalize("NFC", vanBan).replace("\r\n", "\n").replace("\r", "\n")
    if not vanBan.strip():
        # PDF scan (chỉ có ảnh) không có lớp chữ: chưa hỗ trợ OCR
        raise LoiDocTaiLieu(400, "Tài liệu không có nội dung văn bản (PDF dạng ảnh scan chưa được hỗ trợ)")
    return vanBan
