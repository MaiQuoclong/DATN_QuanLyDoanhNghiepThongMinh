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
