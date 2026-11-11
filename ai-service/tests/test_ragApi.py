from rag import khoVector, nhung
from tests.conftest import KHOA_TEST

TAI_LIEU = {"taiLieuId": 2, "maTaiLieu": "QC-NGHIPHEP", "tieuDe": "Quy chế nghỉ phép", "duongDanTep": "mau/QC-NGHIPHEP.md"}


def test_batBuocKhoaNoiBo(client, moiTruongRag):
    assert client.post("/noiBo/rag/lapChiMuc", json=TAI_LIEU).status_code == 401
    assert client.get("/noiBo/rag/taiLieu", headers={"X-Khoa-Noi-Bo": "sai" * 12}).status_code == 401
    assert client.delete("/noiBo/rag/taiLieu/2").status_code == 401


def test_lapChiMucThongKeTimKiemVaXoa(clientRag):
    res = clientRag.post("/noiBo/rag/lapChiMuc", json=TAI_LIEU)
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["soDoan"] > 5 and data["soDieu"] >= 4 and data["theoDieuKhoan"] is True
    assert data["moHinhNhung"] == "gia"

    # Lập lại không nhân đôi đoạn
    assert clientRag.post("/noiBo/rag/lapChiMuc", json=TAI_LIEU).json()["data"]["soDoan"] == data["soDoan"]
    thongKe = clientRag.get("/noiBo/rag/taiLieu").json()["data"]["taiLieu"]
    assert thongKe == [{"taiLieuId": 2, "soDoan": data["soDoan"]}]

    ketQua = khoVector.timKiem(nhung.nhungCauHoi("nghỉ kết hôn được mấy ngày"), 3)
    assert ketQua[0]["maTaiLieu"] == "QC-NGHIPHEP"
    assert any(k["dieu"] == 2 and k["khoan"] == 3 for k in ketQua)
    assert ketQua == sorted(ketQua, key=lambda k: -k["diem"])

    res = clientRag.delete("/noiBo/rag/taiLieu/2")
    assert res.json()["data"] == {"taiLieuId": 2, "soDoanDaXoa": data["soDoan"]}
    assert clientRag.get("/noiBo/rag/taiLieu").json()["data"]["taiLieu"] == []
    assert clientRag.delete("/noiBo/rag/taiLieu/2").json()["data"]["soDoanDaXoa"] == 0


def test_donDepTaiLieuMoCoi(clientRag):
    # 9: đã xóa khỏi CSDL (nhỏ hơn id lớn nhất trong ảnh chụp) → dọn.
    # 50: tải lên SAU lúc Express chụp danh sách (id lớn hơn) → giữ, không xóa nhầm khi hai lượt chạy chen nhau.
    clientRag.post("/noiBo/rag/lapChiMuc", json={**TAI_LIEU, "taiLieuId": 9, "maTaiLieu": "QC-CU"})
    clientRag.post("/noiBo/rag/lapChiMuc", json={**TAI_LIEU, "taiLieuId": 50, "maTaiLieu": "QC-MOI"})
    res = clientRag.post("/noiBo/rag/lapChiMuc", json={**TAI_LIEU, "taiLieuIdsHienCo": [1, 2, 3, 12]})
    assert res.json()["data"]["daDonTaiLieuIds"] == [9]
    assert [t["taiLieuId"] for t in clientRag.get("/noiBo/rag/taiLieu").json()["data"]["taiLieu"]] == [2, 50]


def test_lapLaiItDoanHonXoaDoanThua(clientRag, moiTruongRag):
    # Upsert rồi xóa đoạn thừa: tài liệu ngắn lại thì số đoạn giảm đúng, không còn đoạn cũ
    soDau = clientRag.post("/noiBo/rag/lapChiMuc", json=TAI_LIEU).json()["data"]["soDoan"]
    (moiTruongRag / "mau" / "QC-NGHIPHEP.md").write_bytes("Điều 1. Ngắn\n1. Một khoản.".encode("utf-8"))
    assert clientRag.post("/noiBo/rag/lapChiMuc", json=TAI_LIEU).json()["data"]["soDoan"] == 1 < soDau
    assert clientRag.get("/noiBo/rag/taiLieu").json()["data"]["taiLieu"] == [{"taiLieuId": 2, "soDoan": 1}]


def test_loiTepVaDuLieu(clientRag, moiTruongRag):
    def goi(**thayDoi):
        return clientRag.post("/noiBo/rag/lapChiMuc", json={**TAI_LIEU, **thayDoi})

    assert goi(duongDanTep="../../.env").status_code == 400
    assert goi(duongDanTep="khongCo.md").json()["code"] == 404
    (moiTruongRag / "anh.pdf").write_bytes(b"%PDF-1.4 rac")
    res = goi(duongDanTep="anh.pdf")
    assert res.status_code == 400 and res.json()["success"] is False
    assert goi(taiLieuId=0).status_code == 400
    assert clientRag.delete("/noiBo/rag/taiLieu/0").status_code == 400


def test_modelLoiTra503(clientRag, monkeypatch):
    monkeypatch.setenv("MO_HINH_NHUNG", "model-khong-ton-tai/xyz")
    monkeypatch.setattr(nhung, "_layMoHinh", lambda _ten: (_ for _ in ()).throw(nhung.LoiNhung("Không nạp được model")))
    res = clientRag.post("/noiBo/rag/lapChiMuc", json=TAI_LIEU)
    assert res.status_code == 503 and res.json()["message"] == "Không nạp được model"


def test_khoaNoiBoKhongLoTrongThongBao(clientRag):
    assert KHOA_TEST not in clientRag.post("/noiBo/rag/lapChiMuc", json={}).text
