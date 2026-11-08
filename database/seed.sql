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
-- 7. Quỹ phép năm hiện tại (năm theo CURDATE(); soNgayDaNghi tính lại từ đơn đã duyệt ở mục 10)
-- ---------------------------------------------------------------------
INSERT INTO quyngayphep (nhanVienId, namHieuLuc, tongSoNgayPhep, soNgayDaNghi) VALUES
  (1, YEAR(CURDATE()), 12.0, 0.0),
  (2, YEAR(CURDATE()), 14.0, 0.0),
  (3, YEAR(CURDATE()), 13.0, 0.0),
  (4, YEAR(CURDATE()), 12.0, 0.0),
  (5, YEAR(CURDATE()), 12.0, 0.0),
  (6, YEAR(CURDATE()),  4.0, 0.0),
  (7, YEAR(CURDATE()), 12.0, 0.0),
  (8, YEAR(CURDATE()), 14.0, 0.0),
  (9, YEAR(CURDATE()), 13.0, 0.0),
  (10, YEAR(CURDATE()), 12.0, 0.0);
-- Năm trước và năm sau (đơn mẫu theo CURDATE() có thể rơi sang năm khác vào cuối/đầu năm)
INSERT INTO quyngayphep (nhanVienId, namHieuLuc, tongSoNgayPhep, soNgayDaNghi)
SELECT q.nhanVienId, q.namHieuLuc + n.lech, q.tongSoNgayPhep, 0.0
  FROM quyngayphep q CROSS JOIN (SELECT -1 AS lech UNION ALL SELECT 1) n
  JOIN nhanvien nv ON nv.id = q.nhanVienId
 WHERE nv.ngayVaoLam <= CONCAT(q.namHieuLuc + n.lech, '-12-31');

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

-- ---------------------------------------------------------------------
-- 9. Chấm công (ngày tính theo CURDATE() để demo luôn đúng)
--    Từ đầu tháng (hiện tại - 2) đến hôm qua, bỏ thứ 7/CN, từ ngày vào làm. Hôm nay để trống để demo check-in.
--    Ca 08:00-17:00, nghỉ trưa 12:00-13:00 (backend/src/config/thamSoNghiepVu.js). Mẫu giờ theo MOD(id*7 + ngày, 10):
--      0: 08:20-17:05 đi muộn (7.67 giờ) · 1: 07:55-18:45 làm thêm 1.75 giờ · 2: 07:50-16:30 về sớm (7.50 giờ) · còn lại: 07:55-17:10 (8 giờ)
-- ---------------------------------------------------------------------
INSERT INTO banghichamcong (nhanVienId, ngayChamCong, gioVao, gioRa, soGioLamThucTe, soGioLamThemOT, diMuon, veSom, trangThai)
SELECT nv.id, ng.ngay,
       CASE MOD(nv.id * 7 + DAYOFMONTH(ng.ngay), 10) WHEN 0 THEN '08:20:00' WHEN 1 THEN '07:55:00' WHEN 2 THEN '07:50:00' ELSE '07:55:00' END,
       CASE MOD(nv.id * 7 + DAYOFMONTH(ng.ngay), 10) WHEN 0 THEN '17:05:00' WHEN 1 THEN '18:45:00' WHEN 2 THEN '16:30:00' ELSE '17:10:00' END,
       CASE MOD(nv.id * 7 + DAYOFMONTH(ng.ngay), 10) WHEN 0 THEN 7.67 WHEN 2 THEN 7.50 ELSE 8.00 END,
       CASE MOD(nv.id * 7 + DAYOFMONTH(ng.ngay), 10) WHEN 1 THEN 1.75 ELSE 0.00 END,
       MOD(nv.id * 7 + DAYOFMONTH(ng.ngay), 10) = 0,
       MOD(nv.id * 7 + DAYOFMONTH(ng.ngay), 10) = 2,
       'HOP_LE'
  FROM nhanvien nv
  JOIN (SELECT DATE_SUB(CURDATE(), INTERVAL (a.n + b.n * 10 + 1) DAY) AS ngay
          FROM (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
                UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) a
         CROSS JOIN (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
                UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) b) ng
    ON ng.ngay >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 2 MONTH), '%Y-%m-01')
   AND DAYOFWEEK(ng.ngay) NOT IN (1, 7)
   AND ng.ngay >= nv.ngayVaoLam;

-- Ba ngày làm việc gần nhất trước hôm nay
SET @ngay1 = (SELECT MAX(ngayChamCong) FROM banghichamcong WHERE nhanVienId = 5);
SET @ngay2 = (SELECT MAX(ngayChamCong) FROM banghichamcong WHERE nhanVienId = 5 AND ngayChamCong < @ngay1);
SET @ngay3 = (SELECT MAX(ngayChamCong) FROM banghichamcong WHERE nhanVienId = 5 AND ngayChamCong < @ngay2);

-- NV0005 quên check-out hôm @ngay1; NV0010 quên chấm cả ngày @ngay2
UPDATE banghichamcong SET gioRa = NULL, soGioLamThucTe = 0, soGioLamThemOT = 0, veSom = 0
 WHERE nhanVienId = 5 AND ngayChamCong = @ngay1;
DELETE FROM banghichamcong WHERE nhanVienId = 10 AND ngayChamCong = @ngay2;
-- NV0006 đã được duyệt điều chỉnh hôm @ngay3
UPDATE banghichamcong SET gioVao = '08:00:00', gioRa = '17:00:00', soGioLamThucTe = 8.00, soGioLamThemOT = 0,
       diMuon = 0, veSom = 0, trangThai = 'DA_DIEU_CHINH'
 WHERE nhanVienId = 6 AND ngayChamCong = @ngay3;

-- Yêu cầu điều chỉnh công:
--   chờ duyệt: NV0005 (quanly duyệt, PKT-PT thuộc PKT), NV0010 (quanly2 duyệt, PKD), NV0007 hr2 (hr/giamdoc duyệt, không tự duyệt)
--   đã xử lý: NV0006 DA_DUYET bởi quanly NV0003, NV0001 admin TU_CHOI bởi giám đốc NV0002
INSERT INTO yeucaudieuchinhchamcong (banGhiChamCongId, nhanVienId, ngayCanDieuChinh, gioVaoDeXuat, gioRaDeXuat,
                                     lyDoGiaiTrinh, nguoiDuyetId, trangThai, lyDoTuChoi, thoiGianDuyet, ngayTao) VALUES
  ((SELECT id FROM banghichamcong WHERE nhanVienId = 5 AND ngayChamCong = @ngay1), 5, @ngay1, NULL, '17:30:00',
   'Quên check-out do họp khách hàng đến 17:30', NULL, 'CHO_DUYET', NULL, NULL, TIMESTAMP(CURDATE(), '08:10:00')),
  (NULL, 10, @ngay2, '08:00:00', '17:00:00',
   'Đi gặp khách hàng cả ngày, không chấm công trên hệ thống được', NULL, 'CHO_DUYET', NULL, NULL, TIMESTAMP(CURDATE(), '08:15:00')),
  ((SELECT id FROM banghichamcong WHERE nhanVienId = 7 AND ngayChamCong = @ngay2), 7, @ngay2, '07:45:00', NULL,
   'Đã đến sớm hỗ trợ phỏng vấn nhưng máy chấm công lỗi', NULL, 'CHO_DUYET', NULL, NULL, TIMESTAMP(CURDATE(), '08:20:00')),
  ((SELECT id FROM banghichamcong WHERE nhanVienId = 6 AND ngayChamCong = @ngay3), 6, @ngay3, '08:00:00', '17:00:00',
   'Kẹt xe do mưa lớn, đã báo trưởng phòng', 3, 'DA_DUYET', NULL, TIMESTAMP(@ngay2, '09:00:00'), TIMESTAMP(@ngay3, '18:00:00')),
  ((SELECT id FROM banghichamcong WHERE nhanVienId = 1 AND ngayChamCong = @ngay3), 1, @ngay3, '07:30:00', NULL,
   'Đến sớm bảo trì máy chủ', 2, 'TU_CHOI', 'Không có xác nhận của người phụ trách', TIMESTAMP(@ngay2, '10:00:00'), TIMESTAMP(@ngay3, '18:30:00'));

-- Chốt công tháng (hiện tại - 2) do HR thực hiện: dữ liệu sẵn cho demo lập bảng lương
INSERT INTO nhatkyhethong (nguoiDungId, hanhDong, diaChiIP, chiTiet, thoiGianTao) VALUES
  (4, 'CHOT_CONG_THANG', '127.0.0.1', DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 2 MONTH), '%Y-%m'),
   TIMESTAMP(DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-02'), '09:00:00'));

-- ---------------------------------------------------------------------
-- 10. Đơn nghỉ phép (ngày tính theo CURDATE(); chuỗi duyệt docs/phan-quyen.md quy tắc 5)
--     Chuỗi duyệt theo seed: PKT-PT, PKT -> quanly NV0003 · PKD -> quanly2 NV0009 · PNS (không trưởng), BGD,
--     trưởng PKT/PKD -> giám đốc NV0002 · đơn > 5 ngày -> giamDoc. Mọi giamDoc duyệt được đơn (trừ của mình).
-- ---------------------------------------------------------------------
SET @thu2Toi = DATE_ADD(CURDATE(), INTERVAL (7 - WEEKDAY(CURDATE())) DAY);           -- thứ 2 tuần sau
-- Cụm đơn chờ duyệt kéo dài tới @thu2Toi + 18: nếu vắt qua năm thì dời cả cụm sang thứ 2 đầu tiên của năm sau
SET @dauNamSau = MAKEDATE(YEAR(@thu2Toi) + 1, 1);
SET @thu2Toi = IF(YEAR(DATE_ADD(@thu2Toi, INTERVAL 18 DAY)) = YEAR(@thu2Toi), @thu2Toi,
                  DATE_ADD(@dauNamSau, INTERVAL MOD(7 - WEEKDAY(@dauNamSau), 7) DAY));
SET @dauThangTruoc = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 1 MONTH), '%Y-%m-01');
SET @thu2ThangTruoc = DATE_ADD(@dauThangTruoc, INTERVAL MOD(7 - WEEKDAY(@dauThangTruoc), 7) + 7 DAY); -- thứ 2 tuần thứ hai
SET @dauThangChot = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 2 MONTH), '%Y-%m-01');
SET @thu2ThangChot = DATE_ADD(@dauThangChot, INTERVAL MOD(7 - WEEKDAY(@dauThangChot), 7) + 7 DAY);
SET @thu2DauNam = DATE_ADD(MAKEDATE(YEAR(CURDATE()), 15), INTERVAL MOD(7 - WEEKDAY(MAKEDATE(YEAR(CURDATE()), 15)), 7) DAY);
-- Đầu tháng 1 mốc trên còn ở tương lai: lùi về tuần trước tháng đã chốt (đơn đã duyệt phải ở quá khứ)
SET @thu2DauNam = IF(@thu2DauNam < DATE_SUB(CURDATE(), INTERVAL 7 DAY), @thu2DauNam, DATE_SUB(@thu2ThangChot, INTERVAL 7 DAY));

-- maDon tạm, đánh lại DNPyyyy-xxxx theo năm ngày bắt đầu ở cuối mục
INSERT INTO dondexuatnghiphep (id, maDon, nhanVienId, loaiNghiPhepId, ngayBatDau, ngayKetThuc, soNgayNghi, lyDo,
                               phuongThucTao, trangThai, nguoiDuyetId, lyDoTuChoi, thoiGianDuyet, ngayTao) VALUES
  -- Chờ duyệt
  (1, 'TAM-1', 5, 1, @thu2Toi, DATE_ADD(@thu2Toi, INTERVAL 1 DAY), 2.0, 'Về quê dự đám cưới người thân',
   'FORM_GIAO_DIEN', 'CHO_DUYET', NULL, NULL, NULL, TIMESTAMP(CURDATE(), '08:30:00')),
  (2, 'TAM-2', 10, 1, DATE_ADD(@thu2Toi, INTERVAL 2 DAY), DATE_ADD(@thu2Toi, INTERVAL 2 DAY), 1.0, 'Giải quyết việc gia đình',
   'FORM_GIAO_DIEN', 'CHO_DUYET', NULL, NULL, NULL, TIMESTAMP(CURDATE(), '08:40:00')),
  (3, 'TAM-3', 3, 1, DATE_ADD(@thu2Toi, INTERVAL 7 DAY), DATE_ADD(@thu2Toi, INTERVAL 8 DAY), 2.0, 'Đưa con đi khám sức khỏe định kỳ',
   'FORM_GIAO_DIEN', 'CHO_DUYET', NULL, NULL, NULL, TIMESTAMP(CURDATE(), '09:00:00')),
  (4, 'TAM-4', 7, 2, DATE_ADD(@thu2Toi, INTERVAL 3 DAY), DATE_ADD(@thu2Toi, INTERVAL 3 DAY), 1.0, 'Lịch tái khám theo chỉ định bác sĩ',
   'FORM_GIAO_DIEN', 'CHO_DUYET', NULL, NULL, NULL, TIMESTAMP(CURDATE(), '09:10:00')),
  (5, 'TAM-5', 6, 5, DATE_ADD(@thu2Toi, INTERVAL 7 DAY), DATE_ADD(@thu2Toi, INTERVAL 18 DAY), 10.0, 'Thi chứng chỉ và chuyển nhà trọ',
   'FORM_GIAO_DIEN', 'CHO_DUYET', NULL, NULL, NULL, TIMESTAMP(CURDATE(), '09:20:00')),
  -- Đã duyệt / từ chối / đã hủy
  (6, 'TAM-6', 1, 1, @thu2ThangTruoc, DATE_ADD(@thu2ThangTruoc, INTERVAL 1 DAY), 2.0, 'Nghỉ phép đi du lịch cùng gia đình',
   'FORM_GIAO_DIEN', 'DA_DUYET', 3, NULL, TIMESTAMP(DATE_SUB(@thu2ThangTruoc, INTERVAL 3 DAY), '10:00:00'), TIMESTAMP(DATE_SUB(@thu2ThangTruoc, INTERVAL 5 DAY), '08:00:00')),
  (7, 'TAM-7', 4, 1, @thu2ThangChot, @thu2ThangChot, 1.0, 'Làm thủ tục hành chính cá nhân',
   'FORM_GIAO_DIEN', 'DA_DUYET', 2, NULL, TIMESTAMP(DATE_SUB(@thu2ThangChot, INTERVAL 2 DAY), '10:00:00'), TIMESTAMP(DATE_SUB(@thu2ThangChot, INTERVAL 4 DAY), '08:00:00')),
  (8, 'TAM-8', 9, 1, DATE_ADD(@thu2ThangTruoc, INTERVAL 3 DAY), DATE_ADD(@thu2ThangTruoc, INTERVAL 3 DAY), 0.5, 'Nghỉ buổi chiều đi họp phụ huynh',
   'FORM_GIAO_DIEN', 'DA_DUYET', 2, NULL, TIMESTAMP(@thu2ThangTruoc, '10:00:00'), TIMESTAMP(DATE_SUB(@thu2ThangTruoc, INTERVAL 1 DAY), '08:00:00')),
  (9, 'TAM-9', 8, 1, @thu2DauNam, @thu2DauNam, 1.0, 'Việc riêng',
   'FORM_GIAO_DIEN', 'DA_DUYET', 2, NULL, TIMESTAMP(DATE_SUB(@thu2DauNam, INTERVAL 3 DAY), '10:00:00'), TIMESTAMP(DATE_SUB(@thu2DauNam, INTERVAL 4 DAY), '08:00:00')),
  (10, 'TAM-10', 10, 1, DATE_ADD(@thu2ThangTruoc, INTERVAL 4 DAY), DATE_ADD(@thu2ThangTruoc, INTERVAL 4 DAY), 1.0, 'Nghỉ đi chơi cuối tuần dài',
   'FORM_GIAO_DIEN', 'TU_CHOI', 9, 'Phòng đang chạy chiến dịch bán hàng, đề nghị dời sang tuần sau',
   TIMESTAMP(@thu2ThangTruoc, '11:00:00'), TIMESTAMP(DATE_SUB(@thu2ThangTruoc, INTERVAL 2 DAY), '08:00:00')),
  (11, 'TAM-11', 5, 1, DATE_ADD(@thu2Toi, INTERVAL 14 DAY), DATE_ADD(@thu2Toi, INTERVAL 14 DAY), 1.0, 'Đi khám răng',
   'FORM_GIAO_DIEN', 'DA_HUY', NULL, NULL, NULL, TIMESTAMP(DATE_SUB(CURDATE(), INTERVAL 1 DAY), '15:00:00'));

UPDATE dondexuatnghiphep d
   SET maDon = CONCAT('DNP', YEAR(d.ngayBatDau), '-', LPAD((
         SELECT COUNT(*) FROM (SELECT id, ngayBatDau FROM dondexuatnghiphep) x
          WHERE YEAR(x.ngayBatDau) = YEAR(d.ngayBatDau) AND x.id <= d.id), 4, '0'));

-- Ngày nghỉ cả ngày đã duyệt thì không có bản ghi chấm công (đơn nửa ngày vẫn giữ)
DELETE cc FROM banghichamcong cc
  JOIN dondexuatnghiphep d ON d.nhanVienId = cc.nhanVienId AND cc.ngayChamCong BETWEEN d.ngayBatDau AND d.ngayKetThuc
 WHERE d.trangThai = 'DA_DUYET' AND d.soNgayNghi >= 1;

-- Quỹ phép: số ngày đã nghỉ = tổng đơn đã duyệt thuộc loại trừ quỹ trong năm
UPDATE quyngayphep q
   SET q.soNgayDaNghi = (SELECT COALESCE(SUM(d.soNgayNghi), 0) FROM dondexuatnghiphep d
                           JOIN loainghiphep l ON l.id = d.loaiNghiPhepId
                          WHERE d.nhanVienId = q.nhanVienId AND d.trangThai = 'DA_DUYET'
                            AND l.truVaoQuyPhepNam = 1 AND YEAR(d.ngayBatDau) = q.namHieuLuc);

-- ---------------------------------------------------------------------
-- 11. Lương (công thức backend/src/utils/tinhLuong.js, tham số thamSoNghiepVu.js THAM_SO_LUONG)
--     Tháng (hiện tại - 3): đã chốt công, bảng lương DA_DUYET (HR NV0004 lập, giám đốc NV0002 duyệt) -> mọi nhân viên
--     có phiếu để xem. Tháng này không có dữ liệu chấm công chi tiết nên phiếu tính đủ công chuẩn, không OT.
--     Tháng (hiện tại - 2): đã chốt công (mục 9), CHƯA có bảng lương -> HR demo lập bảng, giám đốc demo duyệt/trả lại.
--     Quyết định khen thưởng / kỷ luật ban hành trong tháng (hiện tại - 2) tự vào cột thưởng/phạt khi lập bảng.
-- ---------------------------------------------------------------------
SET @dauThangLuong = DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 3 MONTH), '%Y-%m-01');
SET @cuoiThangLuong = LAST_DAY(@dauThangLuong);
SET @congChuanLuong = (WITH RECURSIVE ngay AS (
    SELECT @dauThangLuong AS d UNION ALL SELECT d + INTERVAL 1 DAY FROM ngay WHERE d < @cuoiThangLuong)
  SELECT SUM(WEEKDAY(d) < 5) FROM ngay);

INSERT INTO nhatkyhethong (nguoiDungId, hanhDong, diaChiIP, chiTiet, thoiGianTao) VALUES
  (4, 'CHOT_CONG_THANG', '127.0.0.1', DATE_FORMAT(@dauThangLuong, '%Y-%m'), TIMESTAMP(@cuoiThangLuong + INTERVAL 2 DAY, '09:00:00')),
  (4, 'LAP_BANG_LUONG', '127.0.0.1', CONCAT('BL', DATE_FORMAT(@dauThangLuong, '%Y-%m')), TIMESTAMP(@cuoiThangLuong + INTERVAL 3 DAY, '09:00:00')),
  (4, 'GUI_DUYET_BANG_LUONG', '127.0.0.1', DATE_FORMAT(@dauThangLuong, '%Y-%m'), TIMESTAMP(@cuoiThangLuong + INTERVAL 3 DAY, '15:00:00')),
  (2, 'DUYET_BANG_LUONG', '127.0.0.1', DATE_FORMAT(@dauThangLuong, '%Y-%m'), TIMESTAMP(@cuoiThangLuong + INTERVAL 4 DAY, '10:00:00'));

INSERT INTO bangtonghopluong (id, maBangLuong, thang, nam, tongChiPhiLuong, trangThai, nguoiLapId, nguoiDuyetId, ngayTao) VALUES
  (1, CONCAT('BL', DATE_FORMAT(@dauThangLuong, '%Y-%m')), MONTH(@dauThangLuong), YEAR(@dauThangLuong), 0, 'DA_DUYET', 4, 2,
   TIMESTAMP(@cuoiThangLuong + INTERVAL 3 DAY, '09:00:00'));

-- Đủ công: lương theo công = lương cơ bản, phụ cấp đủ mức hợp đồng; BH 10.5% (trần 46.8 triệu); thuế lũy tiến 7 bậc
INSERT INTO phieuluongnhanvien (bangTongHopLuongId, nhanVienId, soNgayCongThucTe, luongCoBan, luongLamThemOT,
                                thuongKPI, tongPhuCap, khauTruBaoHiem, khauTruThueTNCN)
SELECT 1, x.nhanVienId, @congChuanLuong, x.luongCoBan, 0, 0, x.mucPhuCap, x.baoHiem,
       ROUND(GREATEST(0, LEAST(x.t, 5000000)) * 0.05 + GREATEST(0, LEAST(x.t, 10000000) - 5000000) * 0.10
           + GREATEST(0, LEAST(x.t, 18000000) - 10000000) * 0.15 + GREATEST(0, LEAST(x.t, 32000000) - 18000000) * 0.20
           + GREATEST(0, LEAST(x.t, 52000000) - 32000000) * 0.25 + GREATEST(0, LEAST(x.t, 80000000) - 52000000) * 0.30
           + GREATEST(0, x.t - 80000000) * 0.35)
  FROM (SELECT hd.nhanVienId, hd.luongCoBan, hd.mucPhuCap, ROUND(LEAST(hd.luongCoBan, 46800000) * 0.105) AS baoHiem,
               hd.luongCoBan + hd.mucPhuCap - ROUND(LEAST(hd.luongCoBan, 46800000) * 0.105) - 11000000 AS t
          FROM hopdonglaodong hd JOIN nhanvien nv ON nv.id = hd.nhanVienId
         WHERE hd.trangThai = 'HIEU_LUC' AND hd.ngayBatDau <= @cuoiThangLuong
           AND (hd.ngayKetThuc IS NULL OR hd.ngayKetThuc >= @dauThangLuong) AND nv.ngayVaoLam <= @cuoiThangLuong) x;

UPDATE bangtonghopluong
   SET tongChiPhiLuong = (SELECT SUM(luongCoBan + luongLamThemOT + thuongKPI + tongPhuCap) FROM phieuluongnhanvien WHERE bangTongHopLuongId = 1)
 WHERE id = 1;

INSERT INTO quyetdinhkhenthuongkyluat (soQuyetDinh, nhanVienId, loaiQuyetDinh, tieuDe, soTien, lyDo, ngayBanHanh, nguoiKyDuyetId) VALUES
  (CONCAT('QD', YEAR(@thu2ThangChot), '-0001'), 5, 'KHEN_THUONG', 'Khen thưởng hoàn thành dự án trước hạn', 2000000.00,
   'Hoàn thành module thanh toán sớm 2 tuần', @thu2ThangChot, 2),
  (CONCAT('QD', YEAR(@thu2ThangChot), '-0002'), 10, 'KY_LUAT', 'Khiển trách đi muộn nhiều lần', 500000.00,
   'Đi muộn quá 5 lần trong tháng không có lý do', @thu2ThangChot, 2);

-- ---------------------------------------------------------------------
-- 13. KPI: kỳ đánh giá, chỉ tiêu, phiếu (ngày theo CURDATE() để demo luôn đúng)
--     Kỳ 1 = quý trước (DA_DONG, đã nghiệm thu), Kỳ 2 = quý hiện tại (DANG_MO).
--     Điểm tổng = trung bình có trọng số điểm nghiệm thu; xếp loại theo THAM_SO_KPI (backend/src/config/thamSoNghiepVu.js):
--     >= 9 XUAT_SAC, >= 8 TOT, >= 6.5 KHA, >= 5 TRUNG_BINH, còn lại YEU.
--     Demo kỳ 2: nhanvien (NV0005) và nhanvien3 (NV0010) đã gửi -> quanly / quanly2 nghiệm thu;
--     quanly (NV0003, trưởng PKT) đã gửi -> giamdoc nghiệm thu; nhanvien2, hr, admin đang tự chấm (BAN_NHAP);
--     hr2 (NV0007) đã được giamdoc nghiệm thu. giamDoc không có phiếu.
-- ---------------------------------------------------------------------
SET @dauQuyNay = MAKEDATE(YEAR(CURDATE()), 1) + INTERVAL (QUARTER(CURDATE()) - 1) QUARTER;
SET @dauQuyTruoc = @dauQuyNay - INTERVAL 1 QUARTER;

INSERT INTO kydanhgiakpi (id, tenKyDanhGia, ngayBatDau, ngayKetThuc, trangThai) VALUES
  (1, CONCAT('KPI Quý ', QUARTER(@dauQuyTruoc), '/', YEAR(@dauQuyTruoc)), @dauQuyTruoc, @dauQuyNay - INTERVAL 1 DAY, 'DA_DONG'),
  (2, CONCAT('KPI Quý ', QUARTER(@dauQuyNay), '/', YEAR(@dauQuyNay)), @dauQuyNay, @dauQuyNay + INTERVAL 1 QUARTER - INTERVAL 1 DAY, 'DANG_MO');

-- chucDanhPhongBanId NULL = chỉ tiêu chung mọi vị trí (chỉ HR định nghĩa)
INSERT INTO chitieukpi (id, maChiTieu, tenChiTieu, moTa, donViDo, trongSoMacDinh, chucDanhPhongBanId) VALUES
  (1,  'CHUNG-01', 'Tuân thủ nội quy, giờ giấc',     'Đi làm đúng giờ, chấp hành nội quy công ty', 'Điểm', 1.00, NULL),
  (2,  'CHUNG-02', 'Tinh thần hợp tác',              'Phối hợp với đồng nghiệp và các phòng ban', 'Điểm', 1.00, NULL),
  (3,  'LTV-01',   'Hoàn thành task đúng hạn',       'Tỷ lệ task hoàn thành đúng deadline trong kỳ', '%', 3.00, 5),
  (4,  'LTV-02',   'Chất lượng mã nguồn',            'Số lỗi phát sinh sau khi bàn giao', 'Lỗi', 2.00, 5),
  (5,  'NVKD-01',  'Doanh số',                       'Doanh số ký mới trong kỳ', 'Triệu đồng', 3.00, 8),
  (6,  'NVKD-02',  'Khách hàng mới',                 'Số khách hàng mới ký hợp đồng', 'Khách hàng', 2.00, 8),
  (7,  'CVNS-01',  'Tuyển dụng đúng hạn',            'Tỷ lệ vị trí tuyển đủ trước hạn', '%', 3.00, 2),
  (8,  'CVNS-02',  'Xử lý hồ sơ, chế độ',            'Thời gian xử lý hồ sơ nhân sự trung bình', 'Ngày', 2.00, 2),
  (9,  'QTHT-01',  'Độ sẵn sàng hệ thống',           'Uptime hệ thống nội bộ', '%', 3.00, 4),
  (10, 'TPKT-01',  'Tiến độ dự án phòng Kỹ thuật',   'Tỷ lệ dự án bàn giao đúng hạn', '%', 3.00, 3),
  (11, 'TPKD-01',  'Doanh số phòng Kinh doanh',      'Doanh số toàn phòng so với kế hoạch', '%', 3.00, 7);

-- Phiếu id 1-7 kỳ 1 (đã nghiệm thu), id 8-14 kỳ 2. nguoiDanhGiaId: quanly (3) chấm PKT/PKT-PT, quanly2 (9) chấm PKD,
-- giamdoc (2) chấm trưởng bộ phận và phòng không có quản lý (PNS, PKT là trưởng)
INSERT INTO phieudanhgiakpi (id, kyDanhGiaId, nhanVienId, giaiTrinhNhanVien, nhanXetQuanLy, nguoiDanhGiaId, ngayNghiemThu, trangThai) VALUES
  (1, 1, 1,  'Hệ thống vận hành ổn định cả quý', 'Hoàn thành tốt', 3, LEAST(TIMESTAMP(@dauQuyNay + INTERVAL 3 DAY, '09:00:00'), NOW()), 'DA_DUYET'),
  (2, 1, 3,  'Bàn giao 4/5 dự án đúng hạn', 'Cần cải thiện tiến độ dự án lớn', 2, LEAST(TIMESTAMP(@dauQuyNay + INTERVAL 3 DAY, '10:00:00'), NOW()), 'DA_DUYET'),
  (3, 1, 4,  'Tuyển đủ 6 vị trí', 'Làm việc hiệu quả', 2, LEAST(TIMESTAMP(@dauQuyNay + INTERVAL 3 DAY, '11:00:00'), NOW()), 'DA_DUYET'),
  (4, 1, 5,  'Hoàn thành module thanh toán sớm', 'Xuất sắc, xứng đáng khen thưởng', 3, LEAST(TIMESTAMP(@dauQuyNay + INTERVAL 4 DAY, '09:00:00'), NOW()), 'DA_DUYET'),
  (5, 1, 7,  'Hỗ trợ xử lý hồ sơ BHXH', 'Đạt yêu cầu', 2, LEAST(TIMESTAMP(@dauQuyNay + INTERVAL 4 DAY, '10:00:00'), NOW()), 'DA_DUYET'),
  (6, 1, 9,  'Doanh số phòng đạt 92% kế hoạch', 'Khá, cần đẩy mạnh khách hàng mới', 2, LEAST(TIMESTAMP(@dauQuyNay + INTERVAL 4 DAY, '11:00:00'), NOW()), 'DA_DUYET'),
  (7, 1, 10, 'Chưa đạt doanh số do thị trường chậm', 'Cần cải thiện, đi muộn nhiều', 9, LEAST(TIMESTAMP(@dauQuyNay + INTERVAL 5 DAY, '09:00:00'), NOW()), 'DA_DUYET'),
  (8, 2, 5,  'Đã hoàn thành phần lớn task được giao', NULL, NULL, NULL, 'CHO_DUYET'),
  (9, 2, 10, 'Đã ký thêm 3 khách hàng mới', NULL, NULL, NULL, 'CHO_DUYET'),
  (10, 2, 3, 'Các dự án đang đúng tiến độ', NULL, NULL, NULL, 'CHO_DUYET'),
  (11, 2, 6, NULL, NULL, NULL, NULL, 'BAN_NHAP'),
  (12, 2, 4, NULL, NULL, NULL, NULL, 'BAN_NHAP'),
  (13, 2, 1, NULL, NULL, NULL, NULL, 'BAN_NHAP'),
  (14, 2, 7, 'Hoàn thành tốt các đợt tuyển dụng', 'Đạt kết quả tốt', 2, LEAST(GREATEST(TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '15:00:00'), TIMESTAMP(@dauQuyNay, '09:00:00')), NOW()), 'DA_DUYET');

-- Chi tiết sinh từ chỉ tiêu của vị trí + chỉ tiêu chung (như API tạo phiếu). Điểm mẫu theo MOD để có nhiều mức xếp loại.
-- Phiếu nháp: hr, admin chưa chấm; nhanvien2 (NV0006) mới chấm chỉ tiêu chung.
INSERT INTO chitietdanhgiakpi (phieuDanhGiaKPIId, chiTieuKPIId, trongSo, mucTieu, ketQuaThucTe, diemTuCham, diemNghiemThu, nhanXet)
SELECT p.id, ct.id, ct.trongSoMacDinh,
       CASE WHEN ct.donViDo = '%' THEN '>= 95%' WHEN ct.donViDo = 'Lỗi' THEN '<= 5 lỗi' ELSE 'Theo kế hoạch' END,
       CASE WHEN p.trangThai = 'BAN_NHAP' AND (p.nhanVienId <> 6 OR ct.chucDanhPhongBanId IS NOT NULL) THEN NULL
            ELSE 'Đã thực hiện theo kế hoạch' END,
       CASE WHEN p.trangThai = 'BAN_NHAP' AND (p.nhanVienId <> 6 OR ct.chucDanhPhongBanId IS NOT NULL) THEN NULL
            ELSE 7.00 + MOD(p.nhanVienId * 3 + ct.id, 4) * 0.50 END,
       CASE WHEN p.trangThai <> 'DA_DUYET' THEN NULL
            WHEN p.nhanVienId = 5 THEN 9.50
            WHEN p.nhanVienId = 10 THEN 4.50 + MOD(ct.id, 2)
            WHEN p.nhanVienId = 9 THEN 7.00 + MOD(ct.id, 2) * 0.50
            ELSE 8.00 + MOD(p.nhanVienId + ct.id, 3) * 0.50 END,
       CASE WHEN p.trangThai = 'DA_DUYET' THEN 'Đã nghiệm thu' ELSE NULL END
  FROM phieudanhgiakpi p
  JOIN nhanvien nv ON nv.id = p.nhanVienId
  JOIN chitieukpi ct ON ct.chucDanhPhongBanId = nv.chucDanhPhongBanId OR ct.chucDanhPhongBanId IS NULL;

-- Xếp loại phiếu đã nghiệm thu từ điểm tổng theo trọng số
UPDATE phieudanhgiakpi p
  JOIN (SELECT phieuDanhGiaKPIId AS id, ROUND(SUM(diemNghiemThu * trongSo) / SUM(trongSo), 2) AS diem
          FROM chitietdanhgiakpi GROUP BY phieuDanhGiaKPIId) d ON d.id = p.id
   SET p.xepLoaiChung = CASE WHEN d.diem >= 9 THEN 'XUAT_SAC' WHEN d.diem >= 8 THEN 'TOT' WHEN d.diem >= 6.5 THEN 'KHA'
                             WHEN d.diem >= 5 THEN 'TRUNG_BINH' ELSE 'YEU' END
 WHERE p.trangThai = 'DA_DUYET';

INSERT INTO nhatkyhethong (nguoiDungId, hanhDong, diaChiIP, chiTiet, thoiGianTao) VALUES
  (4, 'MO_KY_KPI', '127.0.0.1', CONCAT('KPI Quý ', QUARTER(@dauQuyTruoc), '/', YEAR(@dauQuyTruoc)), TIMESTAMP(@dauQuyTruoc, '08:30:00')),
  (4, 'DONG_KY_KPI', '127.0.0.1', CONCAT('KPI Quý ', QUARTER(@dauQuyTruoc), '/', YEAR(@dauQuyTruoc)), LEAST(TIMESTAMP(@dauQuyNay + INTERVAL 6 DAY, '17:00:00'), NOW())),
  (4, 'MO_KY_KPI', '127.0.0.1', CONCAT('KPI Quý ', QUARTER(@dauQuyNay), '/', YEAR(@dauQuyNay)), TIMESTAMP(@dauQuyNay, '08:30:00'));
