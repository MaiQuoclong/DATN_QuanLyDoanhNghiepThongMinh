"""Kho vector Chroma (persistent) lưu các đoạn quy chế đã nhúng.

Mỗi model embedding một collection riêng (số chiều khác nhau), tên suy ra từ tên model.
id đoạn = "<taiLieuId>-<thuTu>"; metadata giữ taiLieuId, maTaiLieu, tieuDe, dieu, khoan (0 = không có).
"""

import hashlib
import re
import threading
from pathlib import Path

from cauHinh import layCauHinh

_khoa = threading.Lock()
_boNhoClient: dict[str, object] = {}


class LoiKhoVector(Exception):
    """Chroma lỗi (thư mục không ghi được, dữ liệu hỏng...)."""


def _tenCollection(moHinh: str) -> str:
    rutGon = re.sub(r"[^a-zA-Z0-9]+", "-", moHinh).strip("-")[:40] or "mac-dinh"
    return f"quyChe-{rutGon}-{hashlib.sha1(moHinh.encode()).hexdigest()[:8]}"


def _layCollection():
    cauHinh = layCauHinh()
    duongDan = str(Path(cauHinh.duongDanChroma))
    try:
        import chromadb
        from chromadb.config import Settings

        with _khoa:
            if duongDan not in _boNhoClient:
                Path(duongDan).mkdir(parents=True, exist_ok=True)
                _boNhoClient[duongDan] = chromadb.PersistentClient(
                    path=duongDan, settings=Settings(anonymized_telemetry=False, allow_reset=False)
                )
            client = _boNhoClient[duongDan]
        return client.get_or_create_collection(
            name=_tenCollection(cauHinh.moHinhNhung), metadata={"hnsw:space": "cosine", "moHinh": cauHinh.moHinhNhung}
        )
    except Exception as loi:
        raise LoiKhoVector("Không mở được kho vector") from loi


def thayDoanTaiLieu(taiLieuId: int, maTaiLieu: str, tieuDe: str, doan: list, vectors: list[list[float]]) -> None:
    """Lập lại chỉ mục một tài liệu: upsert đoạn mới trước, sau đó mới xóa đoạn cũ thừa
    (ghi lỗi giữa chừng không làm mất chỉ mục cũ)."""
    collection = _layCollection()
    try:
        idMoi = {f"{taiLieuId}-{d.thuTu}" for d in doan}
        if doan:
            collection.upsert(
                ids=[f"{taiLieuId}-{d.thuTu}" for d in doan],
                embeddings=vectors,
                documents=[d.noiDung for d in doan],
                metadatas=[
                    {
                        "taiLieuId": taiLieuId,
                        "maTaiLieu": maTaiLieu,
                        "tieuDe": tieuDe,
                        "dieu": d.dieu or 0,
                        "tenDieu": d.tenDieu,
                        "khoan": d.khoan or 0,
                        "thuTu": d.thuTu,
                    }
                    for d in doan
                ],
            )
        idCu = collection.get(where={"taiLieuId": taiLieuId}, include=[])["ids"]
        thua = [i for i in idCu if i not in idMoi]
        if thua:
            collection.delete(ids=thua)
    except Exception as loi:
        raise LoiKhoVector("Không ghi được chỉ mục vào kho vector") from loi


def xoaTaiLieu(taiLieuId: int) -> int:
    """Xóa mọi đoạn của tài liệu; trả số đoạn đã xóa (0 nếu chưa từng lập chỉ mục)."""
    collection = _layCollection()
    try:
        ids = collection.get(where={"taiLieuId": taiLieuId}, include=[])["ids"]
        if ids:
            collection.delete(ids=ids)
        return len(ids)
    except Exception as loi:
        raise LoiKhoVector("Không xóa được chỉ mục trong kho vector") from loi


def thongKeTaiLieu() -> dict[int, int]:
    """{taiLieuId: số đoạn} của mọi tài liệu đã lập chỉ mục."""
    collection = _layCollection()
    try:
        thongKe: dict[int, int] = {}
        for meta in collection.get(include=["metadatas"])["metadatas"]:
            tid = int(meta["taiLieuId"])
            thongKe[tid] = thongKe.get(tid, 0) + 1
        return thongKe
    except Exception as loi:
        raise LoiKhoVector("Không đọc được kho vector") from loi


def donDepMoCoi(taiLieuIdsHienCo: set[int]) -> list[int]:
    """Xóa đoạn của tài liệu không còn trong CSDL (VD xóa bản ghi lúc ai-service tắt); trả danh sách id đã dọn.

    Chỉ dọn id ≤ id lớn nhất trong ảnh chụp: tài liệu tải lên SAU lúc Express chụp danh sách (id tự tăng lớn hơn)
    không bị xóa nhầm khi hai lượt lập chỉ mục chạy chen nhau."""
    if not taiLieuIdsHienCo:
        return []
    idLonNhat = max(taiLieuIdsHienCo)
    daDon = [tid for tid in thongKeTaiLieu() if tid not in taiLieuIdsHienCo and tid <= idLonNhat]
    for tid in daDon:
        xoaTaiLieu(tid)
    return daDon


def timKiem(vector: list[float], soLuong: int = 5) -> list[dict]:
    """Các đoạn gần câu hỏi nhất, kèm diem = độ tương đồng cosine (1 - khoảng cách), giảm dần."""
    collection = _layCollection()
    try:
        soDoan = collection.count()
        if soDoan == 0:
            return []
        kq = collection.query(
            query_embeddings=[vector], n_results=min(soLuong, soDoan), include=["documents", "metadatas", "distances"]
        )
    except Exception as loi:
        raise LoiKhoVector("Không truy vấn được kho vector") from loi
    ketQua = []
    for noiDung, meta, khoangCach in zip(kq["documents"][0], kq["metadatas"][0], kq["distances"][0]):
        ketQua.append(
            {
                "taiLieuId": int(meta["taiLieuId"]),
                "maTaiLieu": meta["maTaiLieu"],
                "tieuDe": meta["tieuDe"],
                "dieu": int(meta["dieu"]) or None,
                "tenDieu": meta.get("tenDieu", ""),
                "khoan": int(meta["khoan"]) or None,
                "noiDung": noiDung,
                "diem": round(1.0 - float(khoangCach), 4),
            }
        )
    return ketQua
