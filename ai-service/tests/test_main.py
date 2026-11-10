from tests.conftest import KHOA_TEST


def test_suKhoe_khongCanKhoa(client):
    res = client.get("/suKhoe")
    assert res.status_code == 200
    assert res.json()["success"] is True
    assert res.json()["data"]["mayChu"] == "HOAT_DONG"
    assert res.json()["data"]["llm"] == "CHUA_CAU_HINH"


def test_suKhoe_daCauHinhLlm(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    res = client.get("/suKhoe")
    assert res.status_code == 200
    assert res.json()["data"]["llm"] == "DA_CAU_HINH"


def test_noiBo_thieuKhoa_401(client):
    res = client.get("/noiBo/kiemTra")
    assert res.status_code == 401
    assert res.json() == {"success": False, "code": 401, "message": "Khóa nội bộ không hợp lệ", "data": None}


def test_noiBo_saiKhoa_401(client):
    res = client.get("/noiBo/kiemTra", headers={"X-Khoa-Noi-Bo": KHOA_TEST + "x"})
    assert res.status_code == 401


def test_noiBo_dungKhoa_200(client):
    res = client.get("/noiBo/kiemTra", headers={"X-Khoa-Noi-Bo": KHOA_TEST})
    assert res.status_code == 200
    assert res.json()["data"] == {"hopLe": True}


def test_noiBo_chuaCauHinhKhoa_503(client, monkeypatch):
    monkeypatch.setenv("AI_SERVICE_KEY", "ngan")
    res = client.get("/noiBo/kiemTra", headers={"X-Khoa-Noi-Bo": "ngan"})
    assert res.status_code == 503


def test_routeKhongTonTai_404_chuan(client):
    res = client.get("/khongCo")
    assert res.status_code == 404
    assert res.json()["success"] is False and res.json()["data"] is None
