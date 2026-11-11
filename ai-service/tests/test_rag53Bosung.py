"""QA 5.3 bổ sung: tài liệu mẫu thật, PDF có chữ, cô lập giữa tài liệu, kho rỗng."""

from rag import khoVector, nhung
from rag.chiaDoan import chiaDoan
from rag.docTaiLieu import docVanBan
from tests.conftest import THU_MUC_MAU


def _taoPdfCoChu(noiDung: str) -> bytes:
    """PDF 1 trang tối thiểu, font Helvetica, lớp chữ ASCII; xref tính offset đúng."""
    luong = f"BT /F1 12 Tf 72 720 Td ({noiDung}) Tj ET".encode("latin-1")
    doiTuong = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length " + str(len(luong)).encode() + b" >>\nstream\n" + luong + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    ra = bytearray(b"%PDF-1.4\n")
    viTri = []
    for i, dt in enumerate(doiTuong, 1):
        viTri.append(len(ra))
        ra += f"{i} 0 obj\n".encode() + dt + b"\nendobj\n"
    xref = len(ra)
    ra += f"xref\n0 {len(doiTuong) + 1}\n0000000000 65535 f \n".encode()
    for v in viTri:
        ra += f"{v:010d} 00000 n \n".encode()
    ra += f"trailer\n<< /Size {len(doiTuong) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return bytes(ra)


def test_chiaDoanTaiLieuMauThatDungSoDieu():
    kyVong = {"QC-NGHIPHEP.md": 4, "QC-LUONG.md": 8, "QC-NOIQUY.md": 10}
    for ten, soDieu in kyVong.items():
        doan = chiaDoan(docVanBan(THU_MUC_MAU / ten))
        dieu = sorted({d.dieu for d in doan if d.dieu is not None})
        assert dieu == list(range(1, soDieu + 1)), ten
        assert [d.thuTu for d in doan] == list(range(1, len(doan) + 1))


def test_docPdfThatCoChu(tmp_path):
    (tmp_path / "qc.pdf").write_bytes(_taoPdfCoChu("Dieu 1. Thu viec 60 ngay"))
    vanBan = docVanBan(tmp_path / "qc.pdf")
    assert "Thu viec 60 ngay" in vanBan


def test_lapChiMucPdfQuaApi(clientRag, moiTruongRag):
    (moiTruongRag / "qc.pdf").write_bytes(_taoPdfCoChu("Dieu 1. Thu viec 60 ngay"))
    res = clientRag.post(
        "/noiBo/rag/lapChiMuc", json={"taiLieuId": 5, "maTaiLieu": "QC-PDF", "tieuDe": "PDF", "duongDanTep": "qc.pdf"}
    )
    assert res.status_code == 200, res.text
    assert res.json()["data"]["soDoan"] >= 1


def test_timKiemKhoRongTraRong(moiTruongRag):
    assert khoVector.timKiem(nhung.nhungCauHoi("nghỉ phép"), 5) == []
    assert khoVector.thongKeTaiLieu() == {}


def test_xoaMotTaiLieuKhongAnhHuongTaiLieuKhac(clientRag):
    a = {"taiLieuId": 1, "maTaiLieu": "QC-LUONG", "tieuDe": "Lương", "duongDanTep": "mau/QC-LUONG.md"}
    b = {"taiLieuId": 2, "maTaiLieu": "QC-NGHIPHEP", "tieuDe": "Phép", "duongDanTep": "mau/QC-NGHIPHEP.md"}
    soA = clientRag.post("/noiBo/rag/lapChiMuc", json=a).json()["data"]["soDoan"]
    soB = clientRag.post("/noiBo/rag/lapChiMuc", json=b).json()["data"]["soDoan"]
    assert clientRag.delete("/noiBo/rag/taiLieu/2").json()["data"]["soDoanDaXoa"] == soB
    assert clientRag.get("/noiBo/rag/taiLieu").json()["data"]["taiLieu"] == [{"taiLieuId": 1, "soDoan": soA}]
    ketQua = khoVector.timKiem(nhung.nhungCauHoi("nghỉ kết hôn"), 10)
    assert ketQua and all(k["taiLieuId"] == 1 for k in ketQua)
