-- =====================================================================
-- Dữ liệu mẫu Smart HRM (chạy SAU schema.sql)
-- CẢNH BÁO: xóa sạch dữ liệu toàn bộ 25 bảng rồi nạp lại. Chỉ dùng cho môi trường dev.
-- Mật khẩu mọi tài khoản mẫu: MatKhau@123 (bcrypt, sinh bằng backend/scripts/taoMatKhauBam.js)
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Xóa sạch cả 25 bảng để không còn dữ liệu mồ côi trỏ vào nhanvien/nguoidung cũ
TRUNCATE TABLE banghichamcong;
TRUNCATE TABLE bangtonghopluong;
TRUNCATE TABLE chitietdanhgiakpi;
TRUNCATE TABLE chitieukpi;
TRUNCATE TABLE chucdanh;
TRUNCATE TABLE chucdanhphongban;
TRUNCATE TABLE dexuatkhenthuongkyluat;
TRUNCATE TABLE dondexuatnghiphep;
TRUNCATE TABLE hopdonglaodong;
TRUNCATE TABLE kydanhgiakpi;
TRUNCATE TABLE lichsuhopdong;
TRUNCATE TABLE loainghiphep;
TRUNCATE TABLE nguoidung;
TRUNCATE TABLE nguoidungvaitro;
TRUNCATE TABLE nhanvien;
TRUNCATE TABLE nhatkyhethong;
TRUNCATE TABLE phientrochuyenai;
TRUNCATE TABLE phieudanhgiakpi;
TRUNCATE TABLE phieuluongnhanvien;
TRUNCATE TABLE phongban;
TRUNCATE TABLE quyetdinhkhenthuongkyluat;
TRUNCATE TABLE quyngayphep;
TRUNCATE TABLE tailieuquyche;
TRUNCATE TABLE vaitro;
TRUNCATE TABLE yeucaudieuchinhchamcong;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- 1. Vai trò (5 nhóm RBAC)
-- ---------------------------------------------------------------------
INSERT INTO vaitro (id, maVaiTro, tenVaiTro, moTa) VALUES
  (1, 'Admin',    'Quản trị hệ thống', 'Quản trị tài khoản, phân quyền, nhật ký hệ thống'),
  (2, 'giamDoc',  'Giám đốc',          'Phê duyệt cấp cao, xem toàn công ty'),
  (3, 'quanLy',   'Quản lý',           'Trưởng bộ phận, quản lý trong phạm vi phòng ban'),
  (4, 'HR',       'Nhân sự',           'Vận hành nghiệp vụ nhân sự toàn công ty'),
  (5, 'nhanVien', 'Nhân viên',         'Thao tác trên dữ liệu của chính mình');

-- ---------------------------------------------------------------------
-- 2. Cơ cấu tổ chức (cây: Ban Giám đốc -> Nhân sự, Kỹ thuật -> Nhóm Phát triển)
--    truongBoPhanId cập nhật ở bước 5 sau khi có nhân viên (tránh vòng khóa ngoại)
-- ---------------------------------------------------------------------
INSERT INTO phongban (id, maPhongBan, tenPhongBan, truongBoPhanId, phongBanChaId) VALUES
  (1, 'BGD',    'Ban Giám đốc',      NULL, NULL),
  (2, 'PNS',    'Phòng Nhân sự',     NULL, 1),
  (3, 'PKT',    'Phòng Kỹ thuật',    NULL, 1),
  (4, 'PKT-PT', 'Nhóm Phát triển',   NULL, 3),
  (5, 'PKD',    'Phòng Kinh doanh',  NULL, 1);

INSERT INTO chucdanh (id, maChucDanh, tenChucDanh, capBac) VALUES
  (1, 'GD',   'Giám đốc',                 'Lãnh đạo'),
  (2, 'TP',   'Trưởng phòng',             'Quản lý'),
  (3, 'CVNS', 'Chuyên viên nhân sự',      'Chuyên viên'),
  (4, 'QTHT', 'Quản trị hệ thống',        'Chuyên viên'),
  (5, 'LTV',  'Lập trình viên',           'Nhân viên'),
  (6, 'PGD',  'Phó giám đốc',             'Lãnh đạo'),
  (7, 'NVKD', 'Nhân viên kinh doanh',     'Nhân viên');

INSERT INTO chucdanhphongban (id, phongBanId, chucDanhId, dinhBien, ghiChu) VALUES
  (1, 1, 1, 1, 'Giám đốc công ty'),
  (2, 2, 3, 3, NULL),
  (3, 3, 2, 1, 'Trưởng phòng Kỹ thuật'),
  (4, 3, 4, 1, NULL),
  (5, 4, 5, 10, NULL),
  (6, 1, 6, 2, 'Phó giám đốc công ty'),
  (7, 5, 2, 1, 'Trưởng phòng Kinh doanh'),
  (8, 5, 7, 5, NULL);

-- ---------------------------------------------------------------------
-- 3. Tài khoản đăng nhập (mật khẩu: MatKhau@123)
-- ---------------------------------------------------------------------
INSERT INTO nguoidung (id, tenDangNhap, email, matKhauMaHoa) VALUES
  (1, 'admin',     'admin@smarthrm.local',     '$2b$10$zD6lfRlSpyvz9L74T597FOGTh28RJBVSK4Lw2ncM6/kuxXzfzUcpm'),
  (2, 'giamdoc',   'giamdoc@smarthrm.local',   '$2b$10$zD6lfRlSpyvz9L74T597FOGTh28RJBVSK4Lw2ncM6/kuxXzfzUcpm'),
  (3, 'quanly',    'quanly@smarthrm.local',    '$2b$10$zD6lfRlSpyvz9L74T597FOGTh28RJBVSK4Lw2ncM6/kuxXzfzUcpm'),
  (4, 'hr',        'hr@smarthrm.local',        '$2b$10$zD6lfRlSpyvz9L74T597FOGTh28RJBVSK4Lw2ncM6/kuxXzfzUcpm'),
  (5, 'nhanvien',  'nhanvien@smarthrm.local',  '$2b$10$zD6lfRlSpyvz9L74T597FOGTh28RJBVSK4Lw2ncM6/kuxXzfzUcpm'),
  (6, 'nhanvien2', 'nhanvien2@smarthrm.local', '$2b$10$zD6lfRlSpyvz9L74T597FOGTh28RJBVSK4Lw2ncM6/kuxXzfzUcpm'),
  (7, 'hr2',       'hr2@smarthrm.local',       '$2b$10$zD6lfRlSpyvz9L74T597FOGTh28RJBVSK4Lw2ncM6/kuxXzfzUcpm'),
  (8, 'giamdoc2',  'giamdoc2@smarthrm.local',  '$2b$10$zD6lfRlSpyvz9L74T597FOGTh28RJBVSK4Lw2ncM6/kuxXzfzUcpm'),
  (9, 'quanly2',   'quanly2@smarthrm.local',   '$2b$10$zD6lfRlSpyvz9L74T597FOGTh28RJBVSK4Lw2ncM6/kuxXzfzUcpm'),
  (10,'nhanvien3', 'nhanvien3@smarthrm.local', '$2b$10$zD6lfRlSpyvz9L74T597FOGTh28RJBVSK4Lw2ncM6/kuxXzfzUcpm');

-- Mọi người có hồ sơ nhân viên đều có thêm vai trò nhanVien (đa vai trò, xem docs/phan-quyen.md)
INSERT INTO nguoidungvaitro (nguoiDungId, vaiTroId) VALUES
  (1, 1), (1, 5),
  (2, 2), (2, 5),
  (3, 3), (3, 5),
  (4, 4), (4, 5),
  (5, 5),
  (6, 5),
  (7, 4), (7, 5),
  (8, 2), (8, 5),
  (9, 3), (9, 5),
  (10, 5);

-- ---------------------------------------------------------------------
-- 4. Hồ sơ nhân viên
-- ---------------------------------------------------------------------
INSERT INTO nhanvien (id, maNhanVien, nguoiDungId, hoVaTen, gioiTinh, ngaySinh, soDienThoai, diaChi,
                      soTaiKhoanNganHang, tenNganHang, chucDanhPhongBanId, ngayVaoLam, trangThaiLamViec) VALUES
  (1, 'NV0001', 1, 'Lê Văn Quản',     'NAM', '1995-03-12', '0905000001', 'Đà Nẵng', '0011000000001', 'Vietcombank', 4, '2022-01-10', 'CHINH_THUC'),
  (2, 'NV0002', 2, 'Trần Thị Minh',   'NU',  '1980-07-25', '0905000002', 'Đà Nẵng', '0011000000002', 'Vietcombank', 1, '2018-05-02', 'CHINH_THUC'),
  (3, 'NV0003', 3, 'Nguyễn Văn Hùng', 'NAM', '1988-11-04', '0905000003', 'Đà Nẵng', '0011000000003', 'BIDV',        3, '2019-08-15', 'CHINH_THUC'),
  (4, 'NV0004', 4, 'Phạm Thị Lan',    'NU',  '1992-02-18', '0905000004', 'Đà Nẵng', '0011000000004', 'Techcombank', 2, '2020-03-01', 'CHINH_THUC'),
  (5, 'NV0005', 5, 'Hoàng Văn Nam',   'NAM', '2000-09-30', '0905000005', 'Huế',     '0011000000005', 'MB Bank',     5, '2024-06-03', 'CHINH_THUC'),
  (6, 'NV0006', 6, 'Võ Thị Hoa',      'NU',  '2002-12-08', '0905000006', 'Quảng Nam','0011000000006','MB Bank',     5, DATE_SUB(CURDATE(), INTERVAL 60 DAY), 'THU_VIEC'),
  (7, 'NV0007', 7, 'Đặng Thu Trang',  'NU',  '1994-05-21', '0905000007', 'Đà Nẵng', '0011000000007', 'Vietinbank',  2, '2023-04-03', 'CHINH_THUC'),
  (8, 'NV0008', 8, 'Bùi Quốc Bảo',    'NAM', '1983-10-14', '0905000008', 'Đà Nẵng', '0011000000008', 'Vietcombank', 6, '2019-02-11', 'CHINH_THUC'),
  (9, 'NV0009', 9, 'Ngô Thị Thu',     'NU',  '1990-01-09', '0905000009', 'Huế',     '0011000000009', 'BIDV',        7, '2021-03-15', 'CHINH_THUC'),
  (10,'NV0010', 10,'Trương Minh Đức', 'NAM', '1999-06-27', '0905000010', 'Đà Nẵng', '0011000000010', 'ACB',         8, '2025-02-17', 'CHINH_THUC');

-- ---------------------------------------------------------------------
-- 5. Trưởng bộ phận (PNS và PKT-PT để trống để thử chuỗi duyệt lên phòng ban cha)
-- ---------------------------------------------------------------------
UPDATE phongban SET truongBoPhanId = 2 WHERE id = 1; -- Ban Giám đốc: giám đốc
UPDATE phongban SET truongBoPhanId = 3 WHERE id = 3; -- Phòng Kỹ thuật: quản lý
UPDATE phongban SET truongBoPhanId = 9 WHERE id = 5; -- Phòng Kinh doanh: quản lý thứ hai

-- ---------------------------------------------------------------------
-- 6. Loại nghỉ phép
-- ---------------------------------------------------------------------
INSERT INTO loainghiphep (id, maLoai, tenLoai, soNgayToiDa, coLuong, truVaoQuyPhepNam, moTa) VALUES
  (1, 'PHEP_NAM',     'Nghỉ phép năm',            12.0, 1, 1, 'Trừ vào quỹ phép năm'),
  (2, 'OM_DAU',       'Nghỉ ốm',                  30.0, 0, 0, 'Hưởng chế độ BHXH, cần giấy xác nhận'),
  (3, 'KET_HON',      'Nghỉ kết hôn',              3.0, 1, 0, 'Bản thân kết hôn'),
  (4, 'VIEC_TANG',    'Nghỉ việc tang',            3.0, 1, 0, 'Bố mẹ, vợ/chồng, con mất'),
  (5, 'KHONG_LUONG',  'Nghỉ không lương',         NULL, 0, 0, 'Cần thỏa thuận với quản lý');

-- ---------------------------------------------------------------------
-- 7. Quỹ phép năm 2026
-- ---------------------------------------------------------------------
INSERT INTO quyngayphep (nhanVienId, namHieuLuc, tongSoNgayPhep, soNgayDaNghi) VALUES
  (1, 2026, 12.0, 2.0),
  (2, 2026, 14.0, 0.0),
  (3, 2026, 13.0, 3.5),
  (4, 2026, 12.0, 1.0),
  (5, 2026, 12.0, 0.0),
  (6, 2026,  4.0, 0.0),
  (7, 2026, 12.0, 0.5),
  (8, 2026, 14.0, 1.0),
  (9, 2026, 13.0, 0.0),
  (10, 2026, 12.0, 0.0);

-- ---------------------------------------------------------------------
-- 8. Hợp đồng lao động + lịch sử (nguoiThucHienId = HR NV0004/NV0007; hợp đồng của HR và hợp đồng
--    lập trước khi HR vào làm do giám đốc NV0002 lập)
--    trangThai lưu HIEU_LUC / DA_CHAM_DUT; HET_HAN suy ra khi đọc (quá ngày kết thúc)
--    Demo: NV0005 sắp hết hạn (cảnh báo 30 ngày), NV0006 thử việc, NV0003 có hợp đồng cũ đã chấm dứt (ngày tính theo CURDATE() để demo luôn đúng)
-- ---------------------------------------------------------------------
INSERT INTO hopdonglaodong (id, maHopDong, nhanVienId, loaiHopDong, ngayBatDau, ngayKetThuc,
                            luongCoBan, mucPhuCap, trangThai, duongDanFileHopDong) VALUES
  (1, 'HD2018-0001', 2, 'KHONG_XAC_DINH_THOI_HAN', '2018-05-02', NULL,         45000000.00, 5000000.00, 'HIEU_LUC',    NULL),
  (2, 'HD2019-0001', 3, 'XAC_DINH_THOI_HAN',       '2019-08-15', '2021-08-14', 22000000.00, 2000000.00, 'DA_CHAM_DUT', NULL),
  (3, 'HD2021-0001', 3, 'KHONG_XAC_DINH_THOI_HAN', '2021-08-15', NULL,         30000000.00, 3000000.00, 'HIEU_LUC',    NULL),
  (4, 'HD2020-0001', 4, 'KHONG_XAC_DINH_THOI_HAN', '2020-03-01', NULL,         16000000.00, 1500000.00, 'HIEU_LUC',    NULL),
  (5, 'HD2022-0001', 1, 'KHONG_XAC_DINH_THOI_HAN', '2022-01-10', NULL,         18000000.00, 1000000.00, 'HIEU_LUC',    NULL),
  (6, 'HD2024-0001', 5, 'XAC_DINH_THOI_HAN',       '2024-06-03', DATE_ADD(CURDATE(), INTERVAL 20 DAY), 13000000.00,  800000.00, 'HIEU_LUC',    NULL),
  (7, CONCAT('HD', YEAR(DATE_SUB(CURDATE(), INTERVAL 60 DAY)), '-0001'), 6, 'THU_VIEC',                DATE_SUB(CURDATE(), INTERVAL 60 DAY), DATE_ADD(CURDATE(), INTERVAL 100 DAY),  8500000.00,       0.00, 'HIEU_LUC',    NULL),
  (8, 'HD2023-0001', 7, 'KHONG_XAC_DINH_THOI_HAN', '2023-04-03', NULL,         15000000.00, 1500000.00, 'HIEU_LUC',    NULL),
  (9, 'HD2019-0002', 8, 'KHONG_XAC_DINH_THOI_HAN', '2019-02-11', NULL,         38000000.00, 4000000.00, 'HIEU_LUC',    NULL),
  (10,'HD2021-0002', 9, 'KHONG_XAC_DINH_THOI_HAN', '2021-03-15', NULL,         28000000.00, 3000000.00, 'HIEU_LUC',    NULL),
  (11,'HD2025-0001', 10,'XAC_DINH_THOI_HAN',       '2025-02-17', '2027-02-16', 12000000.00, 1000000.00, 'HIEU_LUC',    NULL);

INSERT INTO lichsuhopdong (hopDongLaoDongId, hanhDong, loaiHopDongCu, loaiHopDongMoi, luongCoBanCu, luongCoBanMoi,
                           mucPhuCapCu, mucPhuCapMoi, ngayBatDauCu, ngayBatDauMoi, ngayKetThucCu, ngayKetThucMoi,
                           trangThaiCu, trangThaiMoi, lyDoThayDoi, nguoiThucHienId, ngayGhiNhan) VALUES
  (1, 'TAO_MOI', NULL, 'KHONG_XAC_DINH_THOI_HAN', NULL, 45000000.00, NULL, 5000000.00, NULL, '2018-05-02', NULL, NULL, NULL, 'HIEU_LUC', 'Ký hợp đồng giám đốc', 2, '2018-05-02 08:00:00'),
  (2, 'TAO_MOI', NULL, 'XAC_DINH_THOI_HAN', NULL, 22000000.00, NULL, 2000000.00, NULL, '2019-08-15', NULL, '2021-08-14', NULL, 'HIEU_LUC', NULL, 2, '2019-08-15 08:00:00'),
  (2, 'CHAM_DUT', 'XAC_DINH_THOI_HAN', 'XAC_DINH_THOI_HAN', 22000000.00, 22000000.00, 2000000.00, 2000000.00, '2019-08-15', '2019-08-15', '2021-08-14', '2021-08-14', 'HIEU_LUC', 'DA_CHAM_DUT', 'Hết hạn, chuyển sang hợp đồng không xác định thời hạn', 4, '2021-08-14 17:00:00'),
  (3, 'TAO_MOI', NULL, 'KHONG_XAC_DINH_THOI_HAN', NULL, 30000000.00, NULL, 3000000.00, NULL, '2021-08-15', NULL, NULL, NULL, 'HIEU_LUC', 'Ký tiếp sau hợp đồng HD2019-0001', 4, '2021-08-15 08:00:00'),
  (4, 'TAO_MOI', NULL, 'KHONG_XAC_DINH_THOI_HAN', NULL, 15000000.00, NULL, 1500000.00, NULL, '2020-03-01', NULL, NULL, NULL, 'HIEU_LUC', NULL, 2, '2020-03-01 08:00:00'),
  (4, 'DIEU_CHINH', 'KHONG_XAC_DINH_THOI_HAN', 'KHONG_XAC_DINH_THOI_HAN', 15000000.00, 16000000.00, 1500000.00, 1500000.00, '2020-03-01', '2020-03-01', NULL, NULL, 'HIEU_LUC', 'HIEU_LUC', 'Tăng lương định kỳ 2025', 2, '2025-01-02 09:00:00'),
  (5, 'TAO_MOI', NULL, 'KHONG_XAC_DINH_THOI_HAN', NULL, 18000000.00, NULL, 1000000.00, NULL, '2022-01-10', NULL, NULL, NULL, 'HIEU_LUC', NULL, 4, '2022-01-10 08:00:00'),
  (6, 'TAO_MOI', NULL, 'XAC_DINH_THOI_HAN', NULL, 12000000.00, NULL, 800000.00, NULL, '2024-06-03', NULL, '2025-06-02', NULL, 'HIEU_LUC', NULL, 4, '2024-06-03 08:00:00'),
  (6, 'GIA_HAN', 'XAC_DINH_THOI_HAN', 'XAC_DINH_THOI_HAN', 12000000.00, 12000000.00, 800000.00, 800000.00, '2024-06-03', '2024-06-03', '2025-06-02', DATE_ADD(CURDATE(), INTERVAL 20 DAY), 'HIEU_LUC', 'HIEU_LUC', 'Gia hạn theo đánh giá năm', 4, '2025-05-20 10:00:00'),
  (6, 'DIEU_CHINH', 'XAC_DINH_THOI_HAN', 'XAC_DINH_THOI_HAN', 12000000.00, 13000000.00, 800000.00, 800000.00, '2024-06-03', '2024-06-03', DATE_ADD(CURDATE(), INTERVAL 20 DAY), DATE_ADD(CURDATE(), INTERVAL 20 DAY), 'HIEU_LUC', 'HIEU_LUC', 'Điều chỉnh lương sau đánh giá KPI', 4, '2026-01-05 09:00:00'),
  (7, 'TAO_MOI', NULL, 'THU_VIEC', NULL, 8500000.00, NULL, 0.00, NULL, DATE_SUB(CURDATE(), INTERVAL 60 DAY), NULL, DATE_ADD(CURDATE(), INTERVAL 100 DAY), NULL, 'HIEU_LUC', 'Thử việc lập trình viên', 4, TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 60 DAY), '08:00:00')),
  (8, 'TAO_MOI', NULL, 'KHONG_XAC_DINH_THOI_HAN', NULL, 15000000.00, NULL, 1500000.00, NULL, '2023-04-03', NULL, NULL, NULL, 'HIEU_LUC', NULL, 2, '2023-04-03 08:00:00'),
  (9, 'TAO_MOI', NULL, 'KHONG_XAC_DINH_THOI_HAN', NULL, 38000000.00, NULL, 4000000.00, NULL, '2019-02-11', NULL, NULL, NULL, 'HIEU_LUC', 'Ký hợp đồng phó giám đốc', 2, '2019-02-11 08:00:00'),
  (10,'TAO_MOI', NULL, 'KHONG_XAC_DINH_THOI_HAN', NULL, 28000000.00, NULL, 3000000.00, NULL, '2021-03-15', NULL, NULL, NULL, 'HIEU_LUC', NULL, 2, '2021-03-15 08:00:00'),
  (11,'TAO_MOI', NULL, 'XAC_DINH_THOI_HAN', NULL, 12000000.00, NULL, 1000000.00, NULL, '2025-02-17', NULL, '2027-02-16', NULL, 'HIEU_LUC', NULL, 7, '2025-02-17 08:00:00');
