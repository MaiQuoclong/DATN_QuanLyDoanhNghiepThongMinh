"""Chọn kiểu biểu đồ hợp lệ theo kiểu cột kết quả (đề xuất của LLM chỉ được nhận khi khớp dữ liệu)."""

BANG, COT, DUONG, TRON = "BANG", "COT", "DUONG", "TRON"
SO_NHOM_TRON_TOI_DA = 6
SO_DONG_BIEU_DO_TOI_DA = 50


def _laCotThoiGian(ten: str, kieu: str) -> bool:
    tenThuong = ten.lower()
    # Theo tiền tố (ngayChamCong, thang, namHieuLuc): "soNgayNghi" là giá trị, không phải mốc thời gian
    return kieu == "NGAY" or tenThuong.startswith(("ngay", "thang", "nam", "ky", "date", "month", "year"))


def _laCotKhoa(ten: str) -> bool:
    return ten.lower() == "id" or ten.endswith("Id")


def goiYBieuDo(cot: list[dict], soDong: int, deXuat: str | None = None) -> dict:
    """Trả {loai, x, y[]}. x = cột nhãn (chữ/ngày), y = 1-3 cột số."""
    if soDong < 1 or soDong > SO_DONG_BIEU_DO_TOI_DA or len(cot) < 2:
        return {"loai": BANG, "x": None, "y": []}
    # Cột số là khóa (id, ...Id) hoặc mốc thời gian (thang, nam) không phải giá trị để vẽ
    cotSo = [c["ten"] for c in cot if c["kieu"] == "SO" and not _laCotKhoa(c["ten"]) and not _laCotThoiGian(c["ten"], "SO")]
    cotNhan = [c for c in cot if c["kieu"] != "SO"] or [c for c in cot if _laCotThoiGian(c["ten"], c["kieu"])]
    if not cotNhan:
        # Cột đầu là số → dùng làm nhãn
        cotNhan, cotSo = [cot[0]], [c for c in cotSo if c != cot[0]["ten"]]
    if not cotSo:
        return {"loai": BANG, "x": None, "y": []}
    x = cotNhan[0]
    y = [c for c in cotSo if c != x["ten"]][:3]
    if not y:
        return {"loai": BANG, "x": None, "y": []}

    thoiGian = _laCotThoiGian(x["ten"], x["kieu"])
    deXuat = (deXuat or "").upper()
    if deXuat == TRON and len(y) == 1 and soDong <= SO_NHOM_TRON_TOI_DA:
        loai = TRON
    elif deXuat == BANG:
        loai = BANG
    elif deXuat == DUONG or (thoiGian and deXuat != COT):
        loai = DUONG
    else:
        loai = COT
    return {"loai": loai, "x": x["ten"], "y": y}
