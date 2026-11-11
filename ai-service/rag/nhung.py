"""Tạo vector embedding cho đoạn tài liệu và câu hỏi.

- Model thật: intfloat/multilingual-e5-base (sentence-transformers, chạy local, tải lần đầu ~1.1GB).
  e5 yêu cầu tiền tố "passage: " cho đoạn tài liệu và "query: " cho câu hỏi.
- MO_HINH_NHUNG=gia: embedding băm từ khóa (không cần torch/model) cho test và CI.
"""

import hashlib
import math
import re
import threading
import unicodedata

from cauHinh import layCauHinh

MO_HINH_GIA = "gia"
SO_CHIEU_GIA = 256

_khoa = threading.Lock()
_boNhoMoHinh: dict[str, object] = {}


class LoiNhung(Exception):
    """Không nạp được model embedding (chưa cài sentence-transformers, mất mạng khi tải lần đầu...)."""


def _nhungGia(vanBan: str) -> list[float]:
    """Vector túi-từ băm SHA-1 vào SO_CHIEU_GIA chiều, chuẩn hóa L2: câu có chung từ khóa → cosine cao."""
    vector = [0.0] * SO_CHIEU_GIA
    chuan = unicodedata.normalize("NFC", vanBan.lower())
    for tu in re.findall(r"\w+", chuan):
        viTri = int(hashlib.sha1(tu.encode("utf-8")).hexdigest(), 16) % SO_CHIEU_GIA
        vector[viTri] += 1.0
    doDai = math.sqrt(sum(x * x for x in vector)) or 1.0
    return [x / doDai for x in vector]


def _layMoHinh(ten: str):
    with _khoa:
        if ten not in _boNhoMoHinh:
            try:
                from sentence_transformers import SentenceTransformer
            except ImportError as loi:
                raise LoiNhung("Chưa cài sentence-transformers (pip install -r requirements-nhung.txt)") from loi
            try:
                _boNhoMoHinh[ten] = SentenceTransformer(ten)
            except Exception as loi:
                raise LoiNhung(f"Không nạp được model embedding {ten}") from loi
        return _boNhoMoHinh[ten]


def _nhung(danhSach: list[str], tienTo: str) -> list[list[float]]:
    ten = layCauHinh().moHinhNhung
    if ten == MO_HINH_GIA:
        return [_nhungGia(v) for v in danhSach]
    moHinh = _layMoHinh(ten)
    vectors = moHinh.encode([f"{tienTo}{v}" for v in danhSach], normalize_embeddings=True, batch_size=16)
    return [list(map(float, v)) for v in vectors]


def nhungDoan(danhSach: list[str]) -> list[list[float]]:
    return _nhung(danhSach, "passage: ") if danhSach else []


def nhungCauHoi(cauHoi: str) -> list[float]:
    return _nhung([cauHoi], "query: ")[0]


def tenMoHinhHienTai() -> str:
    return layCauHinh().moHinhNhung
