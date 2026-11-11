import io

import pytest
from docx import Document

from rag.docTaiLieu import LoiDocTaiLieu, docVanBan, giaiDuongDan


@pytest.mark.parametrize("duongDan", ["../ngoai.md", "/etc/passwd", "C:/Windows/a.md", "mau/../../ngoai.md", ""])
def test_chanDuongDanRaNgoai(tmp_path, duongDan):
    with pytest.raises(LoiDocTaiLieu) as loi:
        giaiDuongDan(tmp_path, duongDan)
    assert loi.value.code == 400


def test_docMdDocxVaLoi(tmp_path):
    (tmp_path / "a.md").write_bytes("Điều 1. A\r\nNội dung".encode("utf-8"))
    assert docVanBan(tmp_path / "a.md") == "Điều 1. A\nNội dung"

    tai = Document()
    tai.add_paragraph("Điều 2. Docx")
    boDem = io.BytesIO()
    tai.save(boDem)
    (tmp_path / "b.docx").write_bytes(boDem.getvalue())
    assert "Điều 2. Docx" in docVanBan(tmp_path / "b.docx")

    (tmp_path / "hong.docx").write_bytes(b"PK\x03\x04word/rac")
    with pytest.raises(LoiDocTaiLieu) as loi:
        docVanBan(tmp_path / "hong.docx")
    assert loi.value.code == 400

    (tmp_path / "rong.md").write_text("   \n", encoding="utf-8")
    with pytest.raises(LoiDocTaiLieu) as loi:
        docVanBan(tmp_path / "rong.md")
    assert loi.value.code == 400

    with pytest.raises(LoiDocTaiLieu) as loi:
        docVanBan(tmp_path / "khongCo.md")
    assert loi.value.code == 404
