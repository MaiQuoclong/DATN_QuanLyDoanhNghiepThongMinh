"""Kiểm tra + viết lại SQL do LLM sinh trước khi chạy bằng tài khoản chỉ đọc.

Nhiều lớp (lớp chính vẫn là quyền DB của aiReadonly): một câu SELECT/UNION, cấm DML/DDL/khóa/biến/hàm nguy hiểm,
bảng/cột theo danh sách trắng của vai trò, thay bảng nhân sự bằng truy vấn con theo phạm vi, ép LIMIT.
Chỉ chạy chuỗi SQL sinh lại từ cây cú pháp (bỏ chú thích), không bao giờ chạy chuỗi gốc LLM trả về.
"""

import sqlglot
from sqlglot import exp
from sqlglot.errors import SqlglotError

from textToSql.moTaSchema import (
    BANG,
    BANG_CO_NHAN_VIEN_ID,
    COT_CAM_TOAN_CUC,
    COT_NHAN_VIEN_CAM,
    PHONG_BAN,
    TOAN_CONG_TY,
    bangDuocPhep,
    cotCuaBang,
)

# Bảng không có trong danh sách trắng (CTE không được đặt trùng tên, kể cả ở vai trò không được dùng)
BANG_HE_THONG = {"nguoidung", "nguoidungvaitro", "vaitro", "nhatkyhethong", "phientrochuyenai", "tailieuquyche"}
# quanLy: bảng danh mục không lọc (tường minh; bảng ngoài danh sách này phải có nhánh lọc)
BANG_DANH_MUC = {"phongban", "chucdanh", "chucdanhphongban", "loainghiphep", "kydanhgiakpi", "chitieukpi"}

DO_DAI_TOI_DA = 4000
OFFSET_TOI_DA = 10000

HAM_CAM = {
    "SLEEP",
    "BENCHMARK",
    "LOAD_FILE",
    "GET_LOCK",
    "RELEASE_LOCK",
    "RELEASE_ALL_LOCKS",
    "IS_FREE_LOCK",
    "IS_USED_LOCK",
    "MASTER_POS_WAIT",
    "MASTER_GTID_WAIT",
    "USER",
    "CURRENT_USER",
    "SESSION_USER",
    "SYSTEM_USER",
    "DATABASE",
    "SCHEMA",
    "VERSION",
    "UUID",
    "UUID_SHORT",
    "CONNECTION_ID",
    "LAST_INSERT_ID",
    "ROW_COUNT",
    "FOUND_ROWS",
    "SYS_EVAL",
    "SYS_EXEC",
    "EXTRACTVALUE",
    "UPDATEXML",
}

# Hàm CURRENT_* chỉ cho phép ngày/giờ (chặn CURRENT_USER, CURRENT_SCHEMA = DATABASE(), CURRENT_VERSION = VERSION())
HAM_HIEN_TAI_DUOC_PHEP = tuple(
    getattr(exp, ten) for ten in ("CurrentDate", "CurrentTime", "CurrentTimestamp", "CurrentDatetime") if hasattr(exp, ten)
)

# Hàm sqlglot không nhận ra (exp.Anonymous) chỉ cho phép khi nằm trong danh sách này
HAM_LA_DUOC_PHEP = {
    "NOW",
    "SYSDATE",
    "MONTHNAME",
    "DAYNAME",
    "PERIOD_DIFF",
    "ADDDATE",
    "SUBDATE",
    "DATE_FORMAT",
    "DATEDIFF",
    "TIMESTAMPDIFF",
    "WEEK",
    "WEEKDAY",
    "DAYOFWEEK",
    "DAYOFMONTH",
    "QUARTER",
    "LAST_DAY",
    "CURDATE",
    "CURTIME",
    "MAKEDATE",
    "FIELD",
    "TIME_TO_SEC",
    "SEC_TO_TIME",
    "TIMEDIFF",
    "IFNULL",
    "NULLIF",
    "GROUP_CONCAT",
    "LPAD",
    "RPAD",
    "FORMAT",
    "TRUNCATE",
}

NODE_CAM = tuple(
    getattr(exp, ten)
    for ten in (
        "Insert",
        "Update",
        "Delete",
        "Drop",
        "Create",
        "Alter",
        "Command",
        "Set",
        "Into",
        "Lock",
        "Merge",
        "TruncateTable",
        "Use",
        "Grant",
        "Transaction",
        "Commit",
        "Rollback",
        "Parameter",
        "SessionParameter",
        "Placeholder",
        "LoadData",
    )
    if hasattr(exp, ten)
)


class LoiSqlKhongHopLe(Exception):
    """SQL bị từ chối; message là lý do tiếng Việt hiển thị cho người dùng."""


def _phanTich(sql: str) -> exp.Expression:
    if not sql or not sql.strip():
        raise LoiSqlKhongHopLe("Không sinh được câu truy vấn")
    if len(sql) > DO_DAI_TOI_DA:
        raise LoiSqlKhongHopLe("Câu truy vấn quá dài")
    try:
        cauLenh = [c for c in sqlglot.parse(sql, read="mysql") if c is not None]
    except SqlglotError as loi:
        raise LoiSqlKhongHopLe("Câu truy vấn không đúng cú pháp hỗ trợ") from loi
    if len(cauLenh) != 1:
        raise LoiSqlKhongHopLe("Chỉ được chạy đúng một câu truy vấn")
    goc = cauLenh[0]
    if not isinstance(goc, (exp.Select, exp.SetOperation)) or isinstance(goc, exp.Subquery):
        raise LoiSqlKhongHopLe("Chỉ hỗ trợ truy vấn đọc dữ liệu (SELECT)")
    return goc


def _tenHam(node: exp.Func) -> str:
    if isinstance(node, exp.Anonymous):
        return str(node.name).upper()
    return node.sql_name().upper()


def _kiemTraCauTruc(goc: exp.Expression) -> None:
    for node in goc.walk():
        if isinstance(node, NODE_CAM):
            raise LoiSqlKhongHopLe("Chỉ hỗ trợ truy vấn đọc dữ liệu (SELECT)")
        if isinstance(node, exp.Select) and node.args.get("locks"):
            raise LoiSqlKhongHopLe("Không được khóa dữ liệu khi truy vấn")
        if isinstance(node, exp.Func):
            ten = _tenHam(node)
            if ten in HAM_CAM or (type(node).__name__.startswith("Current") and type(node) not in HAM_HIEN_TAI_DUOC_PHEP):
                raise LoiSqlKhongHopLe(f"Không được dùng hàm {ten}")
            if isinstance(node, exp.Anonymous) and ten not in HAM_LA_DUOC_PHEP:
                raise LoiSqlKhongHopLe(f"Hàm {ten} không được hỗ trợ")


def _kiemTraBangCot(goc: exp.Expression, cheDoPhamVi: str) -> list[exp.Table]:
    """Trả danh sách node bảng thật (không tính CTE) để viết lại phạm vi."""
    duocPhep = bangDuocPhep(cheDoPhamVi)
    # CTE chỉ được khai báo ở cấp gốc: CTE lồng trong truy vấn con chỉ có hiệu lực trong scope đó, nếu gom tên
    # toàn cây thì bảng thật cùng tên ở ngoài bị bỏ qua kiểm tra (lỗ quanLy đọc phieuluongnhanvien).
    withGoc = goc.args.get("with_") or goc.args.get("with")
    for w in goc.find_all(exp.With):
        if w is not withGoc:
            raise LoiSqlKhongHopLe("Chỉ hỗ trợ WITH ở đầu câu truy vấn")
    tenCte = {cte.alias_or_name.lower() for cte in goc.find_all(exp.CTE)}
    if tenCte & (set(BANG) | BANG_HE_THONG):
        raise LoiSqlKhongHopLe("Tên CTE không được trùng tên bảng")

    bangThat = []
    for bang in goc.find_all(exp.Table):
        if not bang.name:
            raise LoiSqlKhongHopLe("Nguồn dữ liệu không được hỗ trợ")
        if bang.args.get("db") or bang.args.get("catalog"):
            raise LoiSqlKhongHopLe("Không được truy vấn CSDL hệ thống hoặc CSDL khác")
        ten = bang.name.lower()
        if ten in tenCte:
            continue
        if ten not in duocPhep:
            if ten in {"hopdonglaodong", "lichsuhopdong", "bangtonghopluong", "phieuluongnhanvien"}:
                raise LoiSqlKhongHopLe("Bạn không có quyền truy vấn dữ liệu lương/hợp đồng")
            raise LoiSqlKhongHopLe(f"Không được truy vấn bảng {bang.name}")
        bangThat.append(bang)

    cotCam = {c.lower() for c in COT_CAM_TOAN_CUC | COT_NHAN_VIEN_CAM}
    for cot in goc.find_all(exp.Column):
        if cot.name.lower() in cotCam:
            raise LoiSqlKhongHopLe(f"Không được truy vấn cột {cot.name}")
    return bangThat


def _truyVanNhanVienTrongPhamVi(phongBanIds: list[int]) -> str:
    danhSach = ", ".join(str(int(i)) for i in phongBanIds)
    return (
        "SELECT id FROM nhanvien WHERE chucDanhPhongBanId IN "
        f"(SELECT id FROM chucdanhphongban WHERE phongBanId IN ({danhSach}))"
    )


def _truyVanThayThe(tenBang: str, cheDoPhamVi: str, phongBanIds: list[int]) -> str:
    """Truy vấn con thay cho bảng gốc. nhanvien luôn thay (chỉ cột được GRANT, để `*` không lỗi quyền cột)."""
    if tenBang == "nhanvien":
        cot = ", ".join(cotCuaBang("nhanvien"))
        sql = f"SELECT {cot} FROM nhanvien"
        if cheDoPhamVi == PHONG_BAN:
            danhSach = ", ".join(str(int(i)) for i in phongBanIds)
            sql += f" WHERE chucDanhPhongBanId IN (SELECT id FROM chucdanhphongban WHERE phongBanId IN ({danhSach}))"
        return sql
    if cheDoPhamVi != PHONG_BAN:
        return ""
    if tenBang in BANG_CO_NHAN_VIEN_ID:
        return f"SELECT * FROM {tenBang} WHERE nhanVienId IN ({_truyVanNhanVienTrongPhamVi(phongBanIds)})"
    if tenBang == "chitietdanhgiakpi":
        return (
            "SELECT * FROM chitietdanhgiakpi WHERE phieuDanhGiaKPIId IN "
            f"(SELECT id FROM phieudanhgiakpi WHERE nhanVienId IN ({_truyVanNhanVienTrongPhamVi(phongBanIds)}))"
        )
    if tenBang in BANG_DANH_MUC:
        return ""  # bảng danh mục: không chứa dữ liệu cá nhân, không lọc
    # Bảng mới thêm vào BANG mà chưa khai báo cách lọc → từ chối (mặc định đóng, không lộ toàn công ty)
    raise LoiSqlKhongHopLe(f"Không được truy vấn bảng {tenBang}")


def _vietLaiPhamVi(bangThat: list[exp.Table], cheDoPhamVi: str, phongBanIds: list[int]) -> None:
    for bang in bangThat:
        ten = bang.name.lower()
        sqlThay = _truyVanThayThe(ten, cheDoPhamVi, phongBanIds)
        if not sqlThay:
            continue
        bietDanh = bang.alias or bang.name
        truyVanCon = sqlglot.parse_one(sqlThay, read="mysql").subquery(exp.to_identifier(bietDanh))
        bang.replace(truyVanCon)


def _giaTriSo(node: exp.Expression | None) -> int | None:
    if node is None:
        return None
    if isinstance(node, exp.Literal) and not node.is_string:
        try:
            return int(node.this)
        except ValueError:
            pass
    raise LoiSqlKhongHopLe("LIMIT/OFFSET phải là số nguyên")


def _epLimit(goc: exp.Expression, gioiHanDong: int) -> exp.Expression:
    if isinstance(goc, exp.SetOperation):
        # UNION: bọc ngoài để LIMIT áp cho toàn bộ kết quả
        goc = exp.select("*").from_(goc.subquery("ketQua"))

    limit = goc.args.get("limit")
    offset = goc.args.get("offset")
    offsetSo = _giaTriSo(offset.expression) if isinstance(offset, exp.Offset) else None
    if isinstance(limit, exp.Limit):
        if limit.args.get("offset") is not None:
            offsetSo = _giaTriSo(limit.args["offset"])
        soDong = _giaTriSo(limit.expression)
        if soDong is None or soDong > gioiHanDong:
            limit.set("expression", exp.Literal.number(gioiHanDong))
        elif soDong < 0:
            raise LoiSqlKhongHopLe("LIMIT phải là số nguyên không âm")
    else:
        goc = goc.limit(gioiHanDong)
    if offsetSo is not None and not 0 <= offsetSo <= OFFSET_TOI_DA:
        raise LoiSqlKhongHopLe(f"OFFSET tối đa {OFFSET_TOI_DA}")
    return goc


def kiemTraVaVietLai(sql: str, cheDoPhamVi: str, phongBanIds: list[int] | None, gioiHanDong: int = 200) -> str:
    """Trả SQL an toàn để chạy (đã viết lại phạm vi, ép LIMIT). Ném LoiSqlKhongHopLe nếu bị từ chối."""
    if cheDoPhamVi not in (TOAN_CONG_TY, PHONG_BAN):
        raise LoiSqlKhongHopLe("Phạm vi truy vấn không hợp lệ")
    phongBanIds = [int(i) for i in (phongBanIds or [])]
    if cheDoPhamVi == PHONG_BAN and not phongBanIds:
        raise LoiSqlKhongHopLe("Bạn chưa phụ trách phòng ban nào")

    goc = _phanTich(sql)
    _kiemTraCauTruc(goc)
    bangThat = _kiemTraBangCot(goc, cheDoPhamVi)
    _vietLaiPhamVi(bangThat, cheDoPhamVi, phongBanIds)
    goc = _epLimit(goc, gioiHanDong)
    return goc.sql(dialect="mysql", comments=False)
