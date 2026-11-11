import unicodedata

from rag.chiaDoan import TOI_DA_KY_TU, chiaDoan

VAN_BAN = """# QUY CHẾ THỬ

Lời mở đầu: quy chế áp dụng cho toàn bộ người lao động của công ty.

### Điều 1. Quỹ phép năm
1. Người lao động được nghỉ 12 ngày phép năm.
2. Cứ đủ 05 năm làm việc được tăng thêm 01 ngày.
a) Thâm niên tính đến 01/01.

**Điều 2.** Giờ làm việc
Công ty làm việc từ thứ Hai đến thứ Sáu.

ĐIỀU 3: Khen thưởng
Mức thưởng như sau:
1) Thưởng Tết bằng 1 tháng lương.
"""


def test_chiaTheoDieuKhoan():
    doan = chiaDoan(VAN_BAN)
    moDau, d1k1, d1k2, d2, d3k1 = doan
    assert moDau.dieu is None and "Lời mở đầu" in moDau.noiDung
    assert (d1k1.dieu, d1k1.khoan, d1k1.tenDieu) == (1, 1, "Quỹ phép năm")
    assert d1k1.noiDung.startswith("Điều 1. Quỹ phép năm\n1. Người lao động")
    # Điểm a) nối vào khoản đang mở
    assert (d1k2.khoan, "a) Thâm niên" in d1k2.noiDung) == (2, True)
    assert (d2.dieu, d2.khoan, d2.tenDieu) == (2, None, "Giờ làm việc")
    assert "thứ Hai đến thứ Sáu" in d2.noiDung
    # Đoạn dẫn trước khoản 1 giữ trong ngữ cảnh khoản
    assert (d3k1.dieu, d3k1.khoan) == (3, 1) and "Mức thưởng như sau" in d3k1.noiDung
    assert [d.thuTu for d in doan] == [1, 2, 3, 4, 5]


def test_chuToHopNfdSauChuanHoaVanKhop():
    # docVanBan chuẩn hóa NFC trước khi chia: "Điều" dạng tổ hợp vẫn nhận ra
    nfd = unicodedata.normalize("NFD", "Điều 7. Kỷ luật\nNội dung.")
    assert chiaDoan(unicodedata.normalize("NFC", nfd))[0].dieu == 7


def test_khongCoDieuDungDuPhong():
    doan = chiaDoan("Đoạn một về nội quy.\n\nĐoạn hai về an toàn.")
    assert len(doan) == 1 and doan[0].dieu is None and doan[0].khoan is None


def test_soThapPhanKhongPhaiKhoan():
    doan = chiaDoan("Điều 1. Hệ số\nHệ số lương:\n1.5 cho kỹ sư.")
    assert len(doan) == 1 and doan[0].khoan is None


def test_khoanDaiTachChongNhau():
    dai = " ".join(f"tu{i}" for i in range(1500))
    doan = chiaDoan(f"Điều 1. Dài\n1. {dai}")
    assert len(doan) >= 2
    assert all(len(d.noiDung) <= TOI_DA_KY_TU for d in doan)
    assert all((d.dieu, d.khoan) == (1, 1) for d in doan)
    # Mọi phần đều lặp lại tiêu đề Điều (giữ ngữ cảnh khi truy hồi)
    assert all(d.noiDung.startswith("Điều 1. Dài\n") for d in doan)
    # Thân phần sau bắt đầu bằng nội dung đã có ở cuối phần trước (chồng lấn)
    than = doan[1].noiDung.split("\n", 1)[1]
    assert than[:50] in doan[0].noiDung


def test_cauVanBatDauBangDieuKhongPhaiTieuDe():
    # "Điều 35 Bộ luật ..." (PDF ngắt dòng, không có dấu sau số) không mở Điều mới; "Điều 3" đứng riêng vẫn là tiêu đề
    doan = chiaDoan("Điều 1. A\n1. x\nĐiều 35 Bộ luật Lao động quy định thêm\n2. y\nĐiều 3\nw")
    assert [(d.dieu, d.khoan) for d in doan] == [(1, 1), (1, 2), (3, None)]
    assert "Điều 35 Bộ luật" in doan[0].noiDung
