"""Cấu hình ai-service đọc từ biến môi trường (.env). Đọc lại mỗi lần gọi để test đổi được qua monkeypatch."""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

THU_MUC_GOC = Path(__file__).resolve().parent


def _duongDan(tenBien: str, macDinh: Path) -> Path:
    """Đường dẫn tương đối trong .env tính từ thư mục ai-service (không phụ thuộc thư mục đang chạy lệnh)."""
    giaTri = os.getenv(tenBien, "").strip()
    duongDan = Path(giaTri) if giaTri else macDinh
    return (duongDan if duongDan.is_absolute() else THU_MUC_GOC / duongDan).resolve()


@dataclass(frozen=True)
class CauHinh:
    cong: int
    khoaNoiBo: str
    anthropicApiKey: str
    moHinhLlm: str
    thoiGianChoLlm: float
    thuMucTaiLieu: Path
    duongDanChroma: Path
    duongDanLichSu: Path
    moHinhNhung: str
    nguongDiemRag: float
    csdlHost: str
    csdlCong: int
    csdlNguoiDung: str
    csdlMatKhau: str
    csdlTen: str
    thoiGianTruyVanGiay: float
    gioiHanDong: int


def layCauHinh() -> CauHinh:
    return CauHinh(
        cong=int(os.getenv("CONG", "8000")),
        khoaNoiBo=os.getenv("AI_SERVICE_KEY", ""),
        anthropicApiKey=os.getenv("ANTHROPIC_API_KEY", ""),
        moHinhLlm=os.getenv("MO_HINH_LLM", "claude-haiku-5-5"),
        thoiGianChoLlm=float(os.getenv("LLM_TIMEOUT_GIAY", "25")),
        # Cùng thư mục với THU_MUC_TAI_LIEU của backend (đọc tệp theo đường dẫn tương đối lưu trong CSDL)
        thuMucTaiLieu=_duongDan("THU_MUC_TAI_LIEU", Path("..") / "backend" / "uploads" / "quyChe"),
        duongDanChroma=_duongDan("DUONG_DAN_CHROMA", Path("duLieu") / "chroma"),
        duongDanLichSu=_duongDan("DUONG_DAN_LICH_SU", Path("duLieu") / "lichSu.db"),
        # "gia" = embedding băm từ khóa (test/CI, không cần tải model)
        moHinhNhung=os.getenv("MO_HINH_NHUNG", "intfloat/multilingual-e5-base").strip(),
        nguongDiemRag=float(os.getenv("NGUONG_DIEM_RAG", "0.78")),
        # Text-to-SQL: tài khoản CHỈ ĐỌC aiReadonly (backend khoiTaoCsdl tạo từ AI_CSDL_MAT_KHAU)
        csdlHost=os.getenv("CSDL_HOST", "127.0.0.1"),
        csdlCong=int(os.getenv("CSDL_CONG", "3306")),
        csdlNguoiDung=os.getenv("CSDL_NGUOI_DUNG", "aiReadonly"),
        csdlMatKhau=os.getenv("CSDL_MAT_KHAU", ""),
        csdlTen=os.getenv("CSDL_TEN", "quanlydoanhnghiepthongminh"),
        thoiGianTruyVanGiay=float(os.getenv("THOI_GIAN_TRUY_VAN_GIAY", "5")),
        gioiHanDong=min(max(int(os.getenv("GIOI_HAN_DONG", "200")), 1), 200),
    )
