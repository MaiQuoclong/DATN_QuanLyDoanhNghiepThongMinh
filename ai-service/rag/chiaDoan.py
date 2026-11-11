"""Chia văn bản quy chế thành đoạn (chunk) theo cấu trúc pháp lý Điều/Khoản để trích dẫn đúng số điều khoản.

- Mỗi Khoản ("1. ...", "2) ...") của một Điều là một đoạn, kèm tiêu đề Điều ở đầu để giữ ngữ cảnh khi truy hồi.
- Điều không chia khoản → cả Điều là một đoạn. Phần trước Điều đầu tiên (lời mở đầu) là đoạn không số điều.
- Đoạn dài quá TOI_DA_KY_TU (~800 token) tách tiếp, các phần chồng nhau CHONG_KY_TU (~100 token).
- Văn bản không có "Điều n" → dự phòng chia theo đoạn văn ("đoạn k"), không có số điều/khoản.
"""

import re
from dataclasses import dataclass

TOI_DA_KY_TU = 3200
CHONG_KY_TU = 400
DO_DAI_DOAN_DU_PHONG = 1600

# "Điều 5. Tiêu đề", "### Điều 5: ...", "**Điều 5.**", "ĐIỀU 5 - ...", "Điều 5" (đứng một mình, đầu dòng).
# Bắt buộc có dấu . : - sau số (hoặc dòng chỉ có "Điều n") để câu văn "Điều 35 Bộ luật ... quy định" bị ngắt dòng
# không bị nhận nhầm là tiêu đề Điều mới.
MAU_DIEU = re.compile(
    r"^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*điều\s+(\d{1,3})(?:\s*(?:\*\*)?\s*[.:\-–]\s*(.*?)|\s*(?:\*\*)?)\s*(?:\*\*)?\s*$",
    re.IGNORECASE,
)
# "1. ...", "2) ..." (đầu dòng, không nhầm số thập phân "1.5")
MAU_KHOAN = re.compile(r"^\s*(\d{1,2})\s*[.)]\s+(\S.*)$")


@dataclass
class Doan:
    thuTu: int  # số thứ tự đoạn trong tài liệu, bắt đầu từ 1
    noiDung: str
    dieu: int | None = None
    tenDieu: str = ""
    khoan: int | None = None


def _tachDai(vanBan: str, toiDa: int = TOI_DA_KY_TU) -> list[str]:
    """Tách văn bản dài thành các phần ≤ toiDa, chồng CHONG_KY_TU, cắt ở khoảng trắng gần nhất."""
    # Ngữ cảnh rất dài vẫn chừa chỗ cho thân đoạn (tối thiểu gấp đôi phần chồng để vòng lặp tiến được)
    toiDa = max(toiDa, CHONG_KY_TU * 2)
    if len(vanBan) <= toiDa:
        return [vanBan]
    phan: list[str] = []
    batDau = 0
    while batDau < len(vanBan):
        ketThuc = min(batDau + toiDa, len(vanBan))
        if ketThuc < len(vanBan):
            viTriCat = vanBan.rfind(" ", batDau + toiDa // 2, ketThuc)
            if viTriCat > batDau:
                ketThuc = viTriCat
        phan.append(vanBan[batDau:ketThuc].strip())
        if ketThuc >= len(vanBan):
            break
        batDau = max(ketThuc - CHONG_KY_TU, batDau + 1)
    return [p for p in phan if p]


def _chiaDuPhong(vanBan: str) -> list[Doan]:
    """Không có cấu trúc Điều: gom các đoạn văn (cách nhau dòng trống) thành khối ~DO_DAI_DOAN_DU_PHONG ký tự."""
    khoi: list[str] = []
    hienTai = ""
    for doanVan in re.split(r"\n\s*\n", vanBan):
        doanVan = doanVan.strip()
        if not doanVan:
            continue
        if hienTai and len(hienTai) + len(doanVan) > DO_DAI_DOAN_DU_PHONG:
            khoi.append(hienTai)
            hienTai = doanVan
        else:
            hienTai = f"{hienTai}\n\n{doanVan}" if hienTai else doanVan
    if hienTai:
        khoi.append(hienTai)
    ketQua: list[Doan] = []
    for k in khoi:
        for phan in _tachDai(k):
            ketQua.append(Doan(thuTu=len(ketQua) + 1, noiDung=phan))
    return ketQua


def chiaDoan(vanBan: str) -> list[Doan]:
    dong = vanBan.split("\n")
    # Gom theo Điều: [(soDieu|None, tenDieu, [dòng nội dung])]
    nhomDieu: list[tuple[int | None, str, list[str]]] = [(None, "", [])]
    for d in dong:
        khop = MAU_DIEU.match(d)
        if khop:
            nhomDieu.append((int(khop.group(1)), (khop.group(2) or "").strip(" .*"), []))
        else:
            nhomDieu[-1][2].append(d)

    if len(nhomDieu) == 1:
        return _chiaDuPhong(vanBan)

    ketQua: list[Doan] = []

    def them(nguCanh: str, than: str, dieu: int | None, tenDieu: str, khoan: int | None):
        """nguCanh (tiêu đề Điều + đoạn dẫn) lặp lại ở đầu MỖI phần khi thân bị tách, để phần sau không mất ngữ cảnh."""
        than = than.strip()
        if not than:
            phanList = [nguCanh]
        elif not nguCanh:
            phanList = _tachDai(than)
        else:
            phanList = [f"{nguCanh}\n{p}" for p in _tachDai(than, TOI_DA_KY_TU - len(nguCanh) - 1)]
        for phan in phanList:
            ketQua.append(Doan(thuTu=len(ketQua) + 1, noiDung=phan, dieu=dieu, tenDieu=tenDieu, khoan=khoan))

    for soDieu, tenDieu, noiDungDong in nhomDieu:
        if soDieu is None:
            # Lời mở đầu: bỏ tiêu đề markdown trống, chỉ giữ khi có nội dung thực
            moDau = "\n".join(noiDungDong).strip()
            if len(re.sub(r"[#*\s]", "", moDau)) >= 20:
                them("", moDau, None, "", None)
            continue

        tieuDe = f"Điều {soDieu}. {tenDieu}".rstrip(". ") if tenDieu else f"Điều {soDieu}"
        # Gom khoản: dòng bắt đầu "n." mở khoản mới; dòng khác (điểm a, b, xuống dòng) nối vào khoản hiện tại
        khoan: list[tuple[int | None, list[str]]] = [(None, [])]
        for d in noiDungDong:
            khopKhoan = MAU_KHOAN.match(d)
            if khopKhoan:
                khoan.append((int(khopKhoan.group(1)), [d.strip()]))
            else:
                khoan[-1][1].append(d)

        coKhoan = len(khoan) > 1
        phanDau = "\n".join(khoan[0][1]).strip()
        if not coKhoan:
            them(tieuDe, phanDau, soDieu, tenDieu, None)
            continue
        # Đoạn dẫn trước khoản 1 (nếu có) gắn vào ngữ cảnh mọi khoản để không mất ý
        nguCanh = f"{tieuDe}\n{phanDau}" if phanDau else tieuDe
        for soKhoan, dongKhoan in khoan[1:]:
            them(nguCanh, "\n".join(dongKhoan), soDieu, tenDieu, soKhoan)
    return ketQua
