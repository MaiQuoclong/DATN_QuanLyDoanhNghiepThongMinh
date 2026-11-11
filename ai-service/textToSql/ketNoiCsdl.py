"""Chạy SQL đã kiểm tra bằng tài khoản CHỈ ĐỌC aiReadonly (PyMySQL, mỗi lượt một kết nối ngắn).

MariaDB 10.4 không có MAX_EXECUTION_TIME → dùng `SET STATEMENT max_statement_time=N FOR <sql>`;
thêm read_timeout phía client phòng truy vấn không bị server cắt.
"""

from datetime import date, datetime, time, timedelta
from decimal import Decimal

import pymysql

from cauHinh import layCauHinh

MA_LOI_QUA_THOI_GIAN = 1969  # ER_STATEMENT_TIMEOUT (MariaDB)


class LoiCsdl(Exception):
    """Lỗi hạ tầng (mất kết nối, sai mật khẩu aiReadonly) → trả lời dự phòng."""


class LoiTruyVan(Exception):
    """Lỗi do câu SQL (sai cột, thiếu quyền, quá thời gian) → có thể nhờ LLM sửa một lần."""

    def __init__(self, message: str, quaThoiGian: bool = False):
        super().__init__(message)
        self.quaThoiGian = quaThoiGian


def _chuanHoa(giaTri):
    if isinstance(giaTri, Decimal):
        return int(giaTri) if giaTri == giaTri.to_integral_value() else float(giaTri)
    if isinstance(giaTri, (datetime, date, time)):
        return giaTri.isoformat()
    if isinstance(giaTri, timedelta):  # cột TIME của MySQL trả timedelta
        giay = int(giaTri.total_seconds())
        return f"{giay // 3600:02d}:{giay % 3600 // 60:02d}:{giay % 60:02d}"
    if isinstance(giaTri, (bytes, bytearray)):
        return giaTri.decode("utf-8", errors="replace")
    return giaTri


def _kieuCot(giaTriMau: list) -> str:
    for gt in giaTriMau:
        if gt is None:
            continue
        if isinstance(gt, bool) or isinstance(gt, (int, float, Decimal)):
            return "SO"
        if isinstance(gt, (datetime, date)):
            return "NGAY"
        return "CHU"
    return "CHU"


def chayTruyVan(sql: str, gioiHanDong: int, thoiGianToiDa: float | None = None) -> dict:
    """Trả {cot:[{ten,kieu}], dong:[[...]], soDong, biCatBot}.

    thoiGianToiDa (giây): rút ngắn theo hạn chót của Express (không chạy tiếp khi backend đã ngừng chờ)."""
    cauHinh = layCauHinh()
    thoiGian = cauHinh.thoiGianTruyVanGiay if thoiGianToiDa is None else min(cauHinh.thoiGianTruyVanGiay, thoiGianToiDa)
    thoiGian = max(thoiGian, 0.5)
    if not cauHinh.csdlMatKhau:
        raise LoiCsdl("Chưa cấu hình CSDL_MAT_KHAU cho tài khoản chỉ đọc")
    try:
        ketNoi = pymysql.connect(
            host=cauHinh.csdlHost,
            port=cauHinh.csdlCong,
            user=cauHinh.csdlNguoiDung,
            password=cauHinh.csdlMatKhau,
            database=cauHinh.csdlTen,
            charset="utf8mb4",
            connect_timeout=3,
            read_timeout=int(thoiGian) + 2,
            autocommit=True,
        )
    except pymysql.MySQLError as loi:
        raise LoiCsdl("Không kết nối được CSDL bằng tài khoản chỉ đọc") from loi

    try:
        with ketNoi.cursor() as conTro:
            conTro.execute("SET SESSION TRANSACTION READ ONLY")
            # Giá trị số do cấu hình kiểm soát (không từ người dùng); câu SQL đã sinh lại từ cây sqlglot
            conTro.execute(f"SET STATEMENT max_statement_time={float(thoiGian):g} FOR {sql}")
            tenCot = [mo[0] for mo in (conTro.description or [])]
            dongGoc = conTro.fetchmany(gioiHanDong + 1)
    except pymysql.err.OperationalError as loi:
        ma = loi.args[0] if loi.args else 0
        if ma == MA_LOI_QUA_THOI_GIAN:
            raise LoiTruyVan("Truy vấn quá lâu, hãy thu hẹp câu hỏi", quaThoiGian=True) from loi
        if ma in (2006, 2013, 2003):
            raise LoiCsdl("Mất kết nối CSDL") from loi
        raise LoiTruyVan(str(loi.args[1] if len(loi.args) > 1 else loi)) from loi
    except pymysql.MySQLError as loi:
        raise LoiTruyVan(str(loi.args[1] if len(loi.args) > 1 else loi)) from loi
    finally:
        ketNoi.close()

    biCatBot = len(dongGoc) > gioiHanDong
    dongGoc = list(dongGoc[:gioiHanDong])
    cot = [{"ten": ten, "kieu": _kieuCot([d[i] for d in dongGoc])} for i, ten in enumerate(tenCot)]
    dong = [[_chuanHoa(gt) for gt in d] for d in dongGoc]
    return {"cot": cot, "dong": dong, "soDong": len(dong), "biCatBot": biCatBot}
