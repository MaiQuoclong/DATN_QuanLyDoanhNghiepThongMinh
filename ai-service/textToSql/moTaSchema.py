"""Danh sách trắng bảng/cột cho Text-to-SQL + mô tả tiếng Việt gửi LLM.

Đây là nguồn chuẩn cho cả bộ kiểm tra SQL (bảng/cột nào được phép) và prompt (LLM chỉ thấy phần được phép).
Tên bảng/cột giữ đúng database/schema.sql. Quyền DB thật nằm ở database/taoTaiKhoanChiDoc.sql (khớp danh sách này).
"""

# Vai trò hiệu lực do Express tính (không tin dữ liệu trong câu hỏi)
TOAN_CONG_TY = "TOAN_CONG_TY"  # giamDoc, HR
PHONG_BAN = "PHONG_BAN"  # quanLy: giới hạn phòng ban mình làm trưởng (kể cả phòng con)

# Cột nhanvien không bao giờ lộ qua báo cáo (aiReadonly cũng không được GRANT)
COT_NHAN_VIEN_CAM = {"nguoiDungId", "soTaiKhoanNganHang", "tenNganHang"}
# Cột cấm ở mọi bảng, mọi vai trò
COT_CAM_TOAN_CUC = {"matKhauMaHoa", "soTaiKhoanNganHang", "tenNganHang"}

# bảng -> (mô tả, {cột: mô tả})
BANG: dict[str, tuple[str, dict[str, str]]] = {
    "nhanvien": (
        "Nhân viên",
        {
            "id": "khóa chính",
            "maNhanVien": "mã NV (VD NV0001)",
            "hoVaTen": "họ tên",
            "gioiTinh": "giới tính",
            "ngaySinh": "ngày sinh",
            "soDienThoai": "số điện thoại",
            "diaChi": "địa chỉ",
            "chucDanhPhongBanId": "→ chucdanhphongban.id (vị trí: phòng ban + chức danh)",
            "ngayVaoLam": "ngày vào làm",
            "trangThaiLamViec": "THU_VIEC | CHINH_THUC | TAM_NGHI | DA_NGHI_VIEC",
            "ngayTao": "thời điểm tạo",
            "ngayCapNhat": "thời điểm cập nhật",
        },
    ),
    "phongban": (
        "Phòng ban (cây)",
        {
            "id": "khóa chính",
            "maPhongBan": "mã phòng",
            "tenPhongBan": "tên phòng",
            "truongBoPhanId": "→ nhanvien.id trưởng phòng",
            "phongBanChaId": "→ phongban.id phòng cha",
            "trangThai": "DANG_HOAT_DONG | NGUNG_HOAT_DONG",
            "ngayTao": "",
            "ngayCapNhat": "",
        },
    ),
    "chucdanh": (
        "Chức danh",
        {"id": "", "maChucDanh": "", "tenChucDanh": "", "capBac": "", "trangThai": "DANG_HOAT_DONG | NGUNG_HOAT_DONG"},
    ),
    "chucdanhphongban": (
        "Vị trí = chức danh trong phòng ban; nhân viên thuộc phòng qua bảng này",
        {
            "id": "",
            "phongBanId": "→ phongban.id",
            "chucDanhId": "→ chucdanh.id",
            "dinhBien": "định biên",
            "ghiChu": "",
            "trangThai": "DANG_AP_DUNG | NGUNG_AP_DUNG",
            "ngayTao": "",
        },
    ),
    "banghichamcong": (
        "Chấm công theo ngày",
        {
            "id": "",
            "nhanVienId": "→ nhanvien.id",
            "ngayChamCong": "ngày",
            "gioVao": "",
            "gioRa": "",
            "soGioLamThucTe": "giờ làm",
            "soGioLamThemOT": "giờ OT",
            "diMuon": "1 = đi muộn",
            "veSom": "1 = về sớm",
            "trangThai": "HOP_LE | DA_DIEU_CHINH | ...",
        },
    ),
    "yeucaudieuchinhchamcong": (
        "Yêu cầu điều chỉnh chấm công",
        {
            "id": "",
            "banGhiChamCongId": "→ banghichamcong.id",
            "nhanVienId": "→ nhanvien.id",
            "ngayCanDieuChinh": "",
            "gioVaoDeXuat": "",
            "gioRaDeXuat": "",
            "lyDoGiaiTrinh": "",
            "nguoiDuyetId": "→ nhanvien.id",
            "trangThai": "CHO_DUYET | DA_DUYET | TU_CHOI",
            "lyDoTuChoi": "",
            "thoiGianDuyet": "",
            "ngayTao": "",
        },
    ),
    "dondexuatnghiphep": (
        "Đơn nghỉ phép",
        {
            "id": "",
            "maDon": "",
            "nhanVienId": "→ nhanvien.id",
            "loaiNghiPhepId": "→ loainghiphep.id",
            "ngayBatDau": "",
            "ngayKetThuc": "",
            "soNgayNghi": "số ngày",
            "lyDo": "",
            "phuongThucTao": "WEB | AI_CHAT",
            "trangThai": "CHO_DUYET | DA_DUYET | TU_CHOI | DA_HUY",
            "nguoiDuyetId": "→ nhanvien.id",
            "lyDoTuChoi": "",
            "thoiGianDuyet": "",
            "ngayTao": "",
        },
    ),
    "loainghiphep": (
        "Loại nghỉ phép",
        {
            "id": "",
            "maLoai": "",
            "tenLoai": "",
            "soNgayToiDa": "",
            "coLuong": "1 = có lương",
            "truVaoQuyPhepNam": "1 = trừ quỹ phép năm",
            "moTa": "",
            "trangThai": "DANG_AP_DUNG | NGUNG_AP_DUNG",
        },
    ),
    "quyngayphep": (
        "Quỹ ngày phép năm",
        {
            "id": "",
            "nhanVienId": "→ nhanvien.id",
            "namHieuLuc": "năm",
            "tongSoNgayPhep": "",
            "soNgayDaNghi": "",
            "ngayCapNhat": "",
        },
    ),
    "kydanhgiakpi": (
        "Kỳ đánh giá KPI",
        {"id": "", "tenKyDanhGia": "", "ngayBatDau": "", "ngayKetThuc": "", "trangThai": "DANG_MO | DA_DONG"},
    ),
    "chitieukpi": (
        "Chỉ tiêu KPI theo vị trí",
        {
            "id": "",
            "maChiTieu": "",
            "tenChiTieu": "",
            "moTa": "",
            "donViDo": "",
            "trongSoMacDinh": "",
            "chucDanhPhongBanId": "→ chucdanhphongban.id",
        },
    ),
    "phieudanhgiakpi": (
        "Phiếu đánh giá KPI của nhân viên trong một kỳ",
        {
            "id": "",
            "kyDanhGiaId": "→ kydanhgiakpi.id",
            "nhanVienId": "→ nhanvien.id",
            "giaiTrinhNhanVien": "",
            "nhanXetQuanLy": "",
            "xepLoaiChung": "XUAT_SAC | TOT | KHA | TRUNG_BINH | YEU",
            "nguoiDanhGiaId": "→ nhanvien.id",
            "ngayNghiemThu": "",
            "trangThai": "BAN_NHAP | CHO_DUYET | DA_DUYET ...",
        },
    ),
    "chitietdanhgiakpi": (
        "Chi tiết điểm từng chỉ tiêu trong phiếu KPI",
        {
            "id": "",
            "phieuDanhGiaKPIId": "→ phieudanhgiakpi.id",
            "chiTieuKPIId": "→ chitieukpi.id",
            "trongSo": "",
            "mucTieu": "",
            "ketQuaThucTe": "",
            "diemTuCham": "điểm 0-10",
            "diemNghiemThu": "điểm 0-10",
            "nhanXet": "",
        },
    ),
    "quyetdinhkhenthuongkyluat": (
        "Quyết định khen thưởng/kỷ luật đã ban hành",
        {
            "id": "",
            "soQuyetDinh": "",
            "nhanVienId": "→ nhanvien.id",
            "loaiQuyetDinh": "KHEN_THUONG | KY_LUAT",
            "tieuDe": "",
            "soTien": "VND",
            "lyDo": "",
            "ngayBanHanh": "",
            "nguoiKyDuyetId": "→ nhanvien.id",
        },
    ),
    "dexuatkhenthuongkyluat": (
        "Đề xuất khen thưởng/kỷ luật",
        {
            "id": "",
            "nguoiDeXuatId": "→ nhanvien.id",
            "nhanVienId": "→ nhanvien.id",
            "loaiDeXuat": "KHEN_THUONG | KY_LUAT",
            "tieuDe": "",
            "lyDo": "",
            "soTienDeXuat": "",
            "trangThai": "CHO_DUYET | CHO_KY | DA_DUYET | TU_CHOI",
            "nguoiXuLyId": "→ nhanvien.id",
            "ghiChuXuLy": "",
            "quyetDinhId": "→ quyetdinhkhenthuongkyluat.id",
            "ngayTao": "",
            "ngayCapNhat": "",
        },
    ),
    # --- Chỉ TOAN_CONG_TY ---
    "hopdonglaodong": (
        "Hợp đồng lao động",
        {
            "id": "",
            "maHopDong": "",
            "nhanVienId": "→ nhanvien.id",
            "loaiHopDong": "",
            "ngayBatDau": "",
            "ngayKetThuc": "NULL = không thời hạn",
            "luongCoBan": "VND",
            "mucPhuCap": "VND",
            "trangThai": "HIEU_LUC | HET_HAN | DA_CHAM_DUT ...",
            "duongDanFileHopDong": "",
            "ngayTao": "",
        },
    ),
    "lichsuhopdong": (
        "Lịch sử thay đổi hợp đồng",
        {
            "id": "",
            "hopDongLaoDongId": "→ hopdonglaodong.id",
            "hanhDong": "",
            "loaiHopDongCu": "",
            "loaiHopDongMoi": "",
            "luongCoBanCu": "",
            "luongCoBanMoi": "",
            "mucPhuCapCu": "",
            "mucPhuCapMoi": "",
            "ngayBatDauCu": "",
            "ngayBatDauMoi": "",
            "ngayKetThucCu": "",
            "ngayKetThucMoi": "",
            "trangThaiCu": "",
            "trangThaiMoi": "",
            "lyDoThayDoi": "",
            "nguoiThucHienId": "→ nhanvien.id",
            "ngayGhiNhan": "",
        },
    ),
    "bangtonghopluong": (
        "Bảng lương tháng",
        {
            "id": "",
            "maBangLuong": "",
            "thang": "1-12",
            "nam": "",
            "tongChiPhiLuong": "VND",
            "trangThai": "BAN_NHAP | CHO_DUYET | DA_DUYET",
            "nguoiLapId": "→ nhanvien.id",
            "nguoiDuyetId": "→ nhanvien.id",
            "ngayTao": "",
        },
    ),
    "phieuluongnhanvien": (
        "Phiếu lương từng nhân viên. Thực lĩnh = luongCoBan + luongLamThemOT + thuongKPI + tongPhuCap"
        " - khauTruBaoHiem - khauTruThueTNCN",
        {
            "id": "",
            "bangTongHopLuongId": "→ bangtonghopluong.id",
            "nhanVienId": "→ nhanvien.id",
            "soNgayCongThucTe": "",
            "luongCoBan": "lương theo ngày công",
            "luongLamThemOT": "",
            "thuongKPI": "",
            "tongPhuCap": "",
            "khauTruBaoHiem": "",
            "khauTruThueTNCN": "",
        },
    ),
}

BANG_CHI_TOAN_CONG_TY = {"hopdonglaodong", "lichsuhopdong", "bangtonghopluong", "phieuluongnhanvien"}

# Bảng có cột nhanVienId (dữ liệu cá nhân) → quanLy lọc theo nhân viên trong phạm vi
BANG_CO_NHAN_VIEN_ID = {ten for ten, (_, cot) in BANG.items() if "nhanVienId" in cot}


def bangDuocPhep(cheDoPhamVi: str) -> set[str]:
    tatCa = set(BANG)
    return tatCa if cheDoPhamVi == TOAN_CONG_TY else tatCa - BANG_CHI_TOAN_CONG_TY


def cotCuaBang(tenBang: str) -> list[str]:
    return list(BANG[tenBang][1])


def moTaChoLlm(cheDoPhamVi: str) -> str:
    dong = []
    for ten in sorted(bangDuocPhep(cheDoPhamVi)):
        moTa, cot = BANG[ten]
        phanCot = ", ".join(f"{c} ({m})" if m else c for c, m in cot.items())
        dong.append(f"- {ten}: {moTa}. Cột: {phanCot}")
    return "\n".join(dong)
