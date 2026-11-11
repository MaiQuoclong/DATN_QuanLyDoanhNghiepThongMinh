"""Lịch sử chat lưu SQLite (ai-service/duLieu/lichSu.db), khóa theo phientrochuyenai.id của MySQL + dauPhien.

dauPhien (Express sinh từ nguoiDungId + thoiGianTao của phiên) chống lẫn lịch sử khi id phiên bị dùng lại:
`npm run khoiTaoCsdl` làm AUTO_INCREMENT đếm lại từ 1 nhưng tệp SQLite vẫn còn tin nhắn cũ.

MySQL chỉ giữ phiên (tiêu đề, chủ sở hữu); nội dung tin nhắn ở đây để không đổi schema 25 bảng.
Bảng banNhapDon (5.5) giữ bản nháp đơn do Trợ lý AI soạn; ai-service KHÔNG ghi MySQL, Express tạo đơn khi người
dùng xác nhận. Mỗi lần gọi mở kết nối riêng (an toàn khi FastAPI chạy endpoint đồng bộ trên nhiều luồng).
"""

import json
import sqlite3
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from cauHinh import layCauHinh


class LoiLichSu(Exception):
    """Không đọc/ghi được SQLite lịch sử."""


# Trạng thái nội bộ bản nháp (SQLite, không phải giá trị MySQL)
CHO_XAC_NHAN, DANG_TAO, DA_TAO, LOI, HUY, HET_HAN = "CHO_XAC_NHAN", "DANG_TAO", "DA_TAO", "LOI", "HUY", "HET_HAN"
# Suy ra khi đọc: DANG_TAO quá lâu → không rõ đơn đã vào MySQL chưa (Express chết / mất kết nối giữa chừng)
KHONG_RO = "KHONG_RO"
TTL_BAN_NHAP_MS = 30 * 60 * 1000
KET_DANG_TAO_MS = 2 * 60 * 1000  # DANG_TAO quá lâu → KHONG_RO (người dùng kiểm tra trang Đơn của tôi)


def _bayGioMs() -> int:
    return int(time.time() * 1000)


def _ketNoi() -> sqlite3.Connection:
    duongDan = Path(layCauHinh().duongDanLichSu)
    try:
        duongDan.parent.mkdir(parents=True, exist_ok=True)
        ketNoi = sqlite3.connect(str(duongDan), timeout=10)
        ketNoi.row_factory = sqlite3.Row
        ketNoi.execute(
            """CREATE TABLE IF NOT EXISTS tinNhan (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phienId INTEGER NOT NULL,
                dauPhien TEXT NOT NULL,
                vaiTro TEXT NOT NULL,
                noiDung TEXT NOT NULL,
                nguonJson TEXT NOT NULL DEFAULT '[]',
                thoiGian TEXT NOT NULL
            )"""
        )
        ketNoi.execute("CREATE INDEX IF NOT EXISTS idxTinNhanPhien ON tinNhan(phienId, dauPhien, id)")
        # Nâng cấp tệp cũ (5.4): cột dữ liệu có cấu trúc của tin trợ lý (loaiPhanHoi, banNhapId, thamSo...)
        cacCot = {d["name"] for d in ketNoi.execute("PRAGMA table_info(tinNhan)").fetchall()}
        if "duLieuJson" not in cacCot:
            ketNoi.execute("ALTER TABLE tinNhan ADD COLUMN duLieuJson TEXT")
        ketNoi.execute(
            """CREATE TABLE IF NOT EXISTS banNhapDon (
                id TEXT PRIMARY KEY,
                phienId INTEGER NOT NULL,
                dauPhien TEXT NOT NULL,
                nguoiDungId INTEGER NOT NULL,
                loai TEXT NOT NULL,
                thamSoJson TEXT NOT NULL,
                trangThai TEXT NOT NULL,
                ketQuaJson TEXT,
                hetHan INTEGER NOT NULL,
                capNhatLuc INTEGER NOT NULL,
                thoiGian TEXT NOT NULL
            )"""
        )
        ketNoi.execute("CREATE INDEX IF NOT EXISTS idxBanNhapPhien ON banNhapDon(phienId, dauPhien, trangThai)")
        return ketNoi
    except sqlite3.Error as loi:
        raise LoiLichSu("Không mở được kho lịch sử trò chuyện") from loi


def themLuotHoiDap(
    phienId: int,
    dauPhien: str,
    cauHoi: str,
    traLoi: str,
    nguon: list,
    duLieu: dict | None = None,
    banNhap: dict | None = None,
) -> dict:
    """Ghi câu hỏi + câu trả lời trong MỘT transaction: không bao giờ còn câu hỏi lẻ không có trả lời.

    banNhap {nguoiDungId, loai, thamSo}: tạo bản nháp đơn cùng transaction (bản nháp đang chờ cũ của phiên → HUY,
    mỗi phiên tối đa một bản nháp chờ xác nhận); id bản nháp gắn vào duLieu.banNhapId của tin trợ lý."""
    thoiGian = datetime.now(timezone.utc).isoformat()
    duLieu = dict(duLieu or {})
    ketNoi = _ketNoi()
    try:
        with ketNoi:
            if banNhap is not None:
                bayGio = _bayGioMs()
                banNhapId = str(uuid.uuid4())
                ketNoi.execute(
                    "UPDATE banNhapDon SET trangThai = ?, capNhatLuc = ?"
                    " WHERE phienId = ? AND dauPhien = ? AND trangThai = ?",
                    (HUY, bayGio, phienId, dauPhien, CHO_XAC_NHAN),
                )
                ketNoi.execute(
                    "INSERT INTO banNhapDon (id, phienId, dauPhien, nguoiDungId, loai, thamSoJson, trangThai, hetHan,"
                    " capNhatLuc, thoiGian) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        banNhapId,
                        phienId,
                        dauPhien,
                        banNhap["nguoiDungId"],
                        banNhap["loai"],
                        json.dumps(banNhap["thamSo"], ensure_ascii=False),
                        CHO_XAC_NHAN,
                        bayGio + TTL_BAN_NHAP_MS,
                        bayGio,
                        thoiGian,
                    ),
                )
                duLieu["banNhapId"] = banNhapId
            ketNoi.execute(
                "INSERT INTO tinNhan (phienId, dauPhien, vaiTro, noiDung, nguonJson, thoiGian) VALUES (?, ?, ?, ?, ?, ?)",
                (phienId, dauPhien, "nguoiDung", cauHoi, "[]", thoiGian),
            )
            ketNoi.execute(
                "INSERT INTO tinNhan (phienId, dauPhien, vaiTro, noiDung, nguonJson, thoiGian, duLieuJson)"
                " VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    phienId,
                    dauPhien,
                    "troLy",
                    traLoi,
                    json.dumps(nguon, ensure_ascii=False),
                    thoiGian,
                    json.dumps(duLieu, ensure_ascii=False) if duLieu else None,
                ),
            )
        return {"thoiGian": thoiGian, "banNhapId": duLieu.get("banNhapId")}
    except sqlite3.Error as loi:
        raise LoiLichSu("Không ghi được lịch sử trò chuyện") from loi
    finally:
        ketNoi.close()


def layTinNhan(phienId: int, dauPhien: str, gioiHan: int | None = None) -> list[dict]:
    """Tin nhắn của phiên theo thứ tự thời gian; gioiHan = chỉ lấy N tin gần nhất (ngữ cảnh hội thoại).

    Tin có bản nháp đơn được gắn trạng thái HIỆN TẠI của bản nháp (Đã tạo / Đã hủy / Hết hạn) để vẽ lại thẻ."""
    ketNoi = _ketNoi()
    try:
        if gioiHan:
            dong = ketNoi.execute(
                "SELECT * FROM (SELECT * FROM tinNhan WHERE phienId = ? AND dauPhien = ? ORDER BY id DESC LIMIT ?)"
                " ORDER BY id",
                (phienId, dauPhien, gioiHan),
            ).fetchall()
        else:
            dong = ketNoi.execute(
                "SELECT * FROM tinNhan WHERE phienId = ? AND dauPhien = ? ORDER BY id", (phienId, dauPhien)
            ).fetchall()
        banNhapIds = [
            json.loads(d["duLieuJson"]).get("banNhapId") for d in dong if d["duLieuJson"]
        ]
        banNhapIds = [i for i in banNhapIds if i]
        cacBanNhap = {}
        if banNhapIds:
            dauHoi = ",".join("?" * len(banNhapIds))
            for b in ketNoi.execute(
                f"SELECT * FROM banNhapDon WHERE phienId = ? AND dauPhien = ? AND id IN ({dauHoi})",
                (phienId, dauPhien, *banNhapIds),
            ).fetchall():
                cacBanNhap[b["id"]] = _dinhDangBanNhap(b)
    except sqlite3.Error as loi:
        raise LoiLichSu("Không đọc được lịch sử trò chuyện") from loi
    finally:
        ketNoi.close()
    ketQua = []
    for d in dong:
        duLieu = json.loads(d["duLieuJson"]) if d["duLieuJson"] else None
        tin = {
            "id": d["id"],
            "vaiTro": d["vaiTro"],
            "noiDung": d["noiDung"],
            "nguonTrichDan": json.loads(d["nguonJson"] or "[]"),
            "thoiGian": d["thoiGian"],
            "duLieu": duLieu,
        }
        if duLieu and duLieu.get("banNhapId") in cacBanNhap:
            tin["banNhap"] = cacBanNhap[duLieu["banNhapId"]]
        ketQua.append(tin)
    return ketQua


def _dinhDangBanNhap(d: sqlite3.Row) -> dict:
    trangThai = d["trangThai"]
    bayGio = _bayGioMs()
    if trangThai == CHO_XAC_NHAN and d["hetHan"] <= bayGio:
        trangThai = HET_HAN
    elif trangThai == DANG_TAO and bayGio - d["capNhatLuc"] > KET_DANG_TAO_MS:
        trangThai = KHONG_RO
    return {
        "id": d["id"],
        "phienId": d["phienId"],
        "dauPhien": d["dauPhien"],
        "nguoiDungId": d["nguoiDungId"],
        "loai": d["loai"],
        "thamSo": json.loads(d["thamSoJson"]),
        "trangThai": trangThai,
        "ketQua": json.loads(d["ketQuaJson"]) if d["ketQuaJson"] else None,
        "hetHan": d["hetHan"],
    }


def _layMotBanNhap(dieuKien: str, thamSo: tuple) -> dict | None:
    ketNoi = _ketNoi()
    try:
        dong = ketNoi.execute(f"SELECT * FROM banNhapDon WHERE {dieuKien}", thamSo).fetchone()
    except sqlite3.Error as loi:
        raise LoiLichSu("Không đọc được bản nháp đơn") from loi
    finally:
        ketNoi.close()
    return _dinhDangBanNhap(dong) if dong else None


def layBanNhap(banNhapId: str, nguoiDungId: int) -> dict | None:
    """Bản nháp của đúng người dùng (Express gửi từ JWT); của người khác → None (Express trả 404)."""
    return _layMotBanNhap("id = ? AND nguoiDungId = ?", (banNhapId, nguoiDungId))


def layBanNhapDangCho(phienId: int, dauPhien: str) -> dict | None:
    """Bản nháp chờ xác nhận còn hạn của phiên: LLM sửa tiếp khi người dùng nói "đổi sang thứ 5"."""
    ban = _layMotBanNhap(
        "phienId = ? AND dauPhien = ? AND trangThai = ? ORDER BY capNhatLuc DESC LIMIT 1",
        (phienId, dauPhien, CHO_XAC_NHAN),
    )
    return ban if ban and ban["trangThai"] == CHO_XAC_NHAN else None


def chuyenTrangThaiBanNhap(banNhapId: str, nguoiDungId: int, tu: str, sang: str, ketQua: dict | None = None) -> bool:
    """Chuyển trạng thái NGUYÊN TỬ (UPDATE ... WHERE trangThai = tu): hai lần bấm Xác nhận đồng thời chỉ một lần
    thành công → chỉ một đơn được tạo. Chuyển từ CHO_XAC_NHAN thì bản nháp phải còn hạn."""
    bayGio = _bayGioMs()
    sql = (
        "UPDATE banNhapDon SET trangThai = ?, ketQuaJson = COALESCE(?, ketQuaJson), capNhatLuc = ?"
        " WHERE id = ? AND nguoiDungId = ? AND trangThai = ?"
    )
    thamSo: tuple = (sang, json.dumps(ketQua, ensure_ascii=False) if ketQua is not None else None, bayGio)
    thamSo += (banNhapId, nguoiDungId, tu)
    if tu == CHO_XAC_NHAN:
        sql += " AND hetHan > ?"
        thamSo += (bayGio,)
    ketNoi = _ketNoi()
    try:
        with ketNoi:
            soDong = ketNoi.execute(sql, thamSo).rowcount
        return soDong == 1
    except sqlite3.Error as loi:
        raise LoiLichSu("Không cập nhật được bản nháp đơn") from loi
    finally:
        ketNoi.close()


def xoaPhien(phienId: int) -> int:
    """Xóa mọi tin + bản nháp của id phiên (kể cả dữ liệu cũ còn sót của phiên trùng id trước khi dựng lại CSDL)."""
    ketNoi = _ketNoi()
    try:
        with ketNoi:
            ketNoi.execute("DELETE FROM banNhapDon WHERE phienId = ?", (phienId,))
            return ketNoi.execute("DELETE FROM tinNhan WHERE phienId = ?", (phienId,)).rowcount
    except sqlite3.Error as loi:
        raise LoiLichSu("Không xóa được lịch sử trò chuyện") from loi
    finally:
        ketNoi.close()
