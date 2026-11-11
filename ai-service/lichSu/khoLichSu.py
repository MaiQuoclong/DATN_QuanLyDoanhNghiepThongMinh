"""Lịch sử chat lưu SQLite (ai-service/duLieu/lichSu.db), khóa theo phientrochuyenai.id của MySQL + dauPhien.

dauPhien (Express sinh từ nguoiDungId + thoiGianTao của phiên) chống lẫn lịch sử khi id phiên bị dùng lại:
`npm run khoiTaoCsdl` làm AUTO_INCREMENT đếm lại từ 1 nhưng tệp SQLite vẫn còn tin nhắn cũ.

MySQL chỉ giữ phiên (tiêu đề, chủ sở hữu); nội dung tin nhắn ở đây để không đổi schema 25 bảng.
Mỗi lần gọi mở kết nối riêng (an toàn khi FastAPI chạy endpoint đồng bộ trên nhiều luồng).
"""

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from cauHinh import layCauHinh

class LoiLichSu(Exception):
    """Không đọc/ghi được SQLite lịch sử."""


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
        return ketNoi
    except sqlite3.Error as loi:
        raise LoiLichSu("Không mở được kho lịch sử trò chuyện") from loi


def themLuotHoiDap(phienId: int, dauPhien: str, cauHoi: str, traLoi: str, nguon: list) -> dict:
    """Ghi câu hỏi + câu trả lời trong MỘT transaction: không bao giờ còn câu hỏi lẻ không có trả lời."""
    thoiGian = datetime.now(timezone.utc).isoformat()
    ketNoi = _ketNoi()
    try:
        with ketNoi:
            ketNoi.execute(
                "INSERT INTO tinNhan (phienId, dauPhien, vaiTro, noiDung, nguonJson, thoiGian) VALUES (?, ?, ?, ?, ?, ?)",
                (phienId, dauPhien, "nguoiDung", cauHoi, "[]", thoiGian),
            )
            ketNoi.execute(
                "INSERT INTO tinNhan (phienId, dauPhien, vaiTro, noiDung, nguonJson, thoiGian) VALUES (?, ?, ?, ?, ?, ?)",
                (phienId, dauPhien, "troLy", traLoi, json.dumps(nguon, ensure_ascii=False), thoiGian),
            )
        return {"thoiGian": thoiGian}
    except sqlite3.Error as loi:
        raise LoiLichSu("Không ghi được lịch sử trò chuyện") from loi
    finally:
        ketNoi.close()


def layTinNhan(phienId: int, dauPhien: str, gioiHan: int | None = None) -> list[dict]:
    """Tin nhắn của phiên theo thứ tự thời gian; gioiHan = chỉ lấy N tin gần nhất (ngữ cảnh hội thoại)."""
    ketNoi = _ketNoi()
    try:
        if gioiHan:
            dong = ketNoi.execute(
                "SELECT * FROM (SELECT * FROM tinNhan WHERE phienId = ? AND dauPhien = ? ORDER BY id DESC LIMIT ?) ORDER BY id",
                (phienId, dauPhien, gioiHan),
            ).fetchall()
        else:
            dong = ketNoi.execute(
                "SELECT * FROM tinNhan WHERE phienId = ? AND dauPhien = ? ORDER BY id", (phienId, dauPhien)
            ).fetchall()
    except sqlite3.Error as loi:
        raise LoiLichSu("Không đọc được lịch sử trò chuyện") from loi
    finally:
        ketNoi.close()
    return [
        {
            "id": d["id"],
            "vaiTro": d["vaiTro"],
            "noiDung": d["noiDung"],
            "nguonTrichDan": json.loads(d["nguonJson"] or "[]"),
            "thoiGian": d["thoiGian"],
        }
        for d in dong
    ]


def xoaPhien(phienId: int) -> int:
    """Xóa mọi tin của id phiên (kể cả tin cũ còn sót của phiên trùng id trước khi dựng lại CSDL)."""
    ketNoi = _ketNoi()
    try:
        with ketNoi:
            return ketNoi.execute("DELETE FROM tinNhan WHERE phienId = ?", (phienId,)).rowcount
    except sqlite3.Error as loi:
        raise LoiLichSu("Không xóa được lịch sử trò chuyện") from loi
    finally:
        ketNoi.close()
