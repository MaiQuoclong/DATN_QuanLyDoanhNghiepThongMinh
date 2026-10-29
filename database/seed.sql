-- =====================================================================
-- Dữ liệu mẫu Smart HRM (chạy SAU schema.sql)
-- CẢNH BÁO: xóa sạch dữ liệu các bảng bên dưới rồi nạp lại. Chỉ dùng cho môi trường dev.
-- Mật khẩu mọi tài khoản mẫu: MatKhau@123 (bcrypt, sinh bằng backend/scripts/taoMatKhauBam.js)
-- =====================================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE quyngayphep;
TRUNCATE TABLE loainghiphep;
TRUNCATE TABLE nguoidungvaitro;
TRUNCATE TABLE nhanvien;
TRUNCATE TABLE nguoidung;
TRUNCATE TABLE chucdanhphongban;
TRUNCATE TABLE chucdanh;
TRUNCATE TABLE phongban;
TRUNCATE TABLE vaitro;

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
  (4, 'PKT-PT', 'Nhóm Phát triển',   NULL, 3);

INSERT INTO chucdanh (id, maChucDanh, tenChucDanh, capBac) VALUES
  (1, 'GD',   'Giám đốc',                 'Lãnh đạo'),
  (2, 'TP',   'Trưởng phòng',             'Quản lý'),
  (3, 'CVNS', 'Chuyên viên nhân sự',      'Chuyên viên'),
  (4, 'QTHT', 'Quản trị hệ thống',        'Chuyên viên'),
  (5, 'LTV',  'Lập trình viên',           'Nhân viên');

INSERT INTO chucdanhphongban (id, phongBanId, chucDanhId, dinhBien, ghiChu) VALUES
  (1, 1, 1, 1, 'Giám đốc công ty'),
  (2, 2, 3, 3, NULL),
  (3, 3, 2, 1, 'Trưởng phòng Kỹ thuật'),
  (4, 3, 4, 1, NULL),
  (5, 4, 5, 10, NULL);

-- ---------------------------------------------------------------------
-- 3. Tài khoản đăng nhập (mật khẩu: MatKhau@123)
-- ---------------------------------------------------------------------
INSERT INTO nguoidung (id, tenDangNhap, email, matKhauMaHoa) VALUES
  (1, 'admin',     'admin@smarthrm.local',     '$2b$10$zD6lfRlSpyvz9L74T597FOGTh28RJBVSK4Lw2ncM6/kuxXzfzUcpm'),
  (2, 'giamdoc',   'giamdoc@smarthrm.local',   '$2b$10$zD6lfRlSpyvz9L74T597FOGTh28RJBVSK4Lw2ncM6/kuxXzfzUcpm'),
  (3, 'quanly',    'quanly@smarthrm.local',    '$2b$10$zD6lfRlSpyvz9L74T597FOGTh28RJBVSK4Lw2ncM6/kuxXzfzUcpm'),
  (4, 'hr',        'hr@smarthrm.local',        '$2b$10$zD6lfRlSpyvz9L74T597FOGTh28RJBVSK4Lw2ncM6/kuxXzfzUcpm'),
  (5, 'nhanvien',  'nhanvien@smarthrm.local',  '$2b$10$zD6lfRlSpyvz9L74T597FOGTh28RJBVSK4Lw2ncM6/kuxXzfzUcpm'),
  (6, 'nhanvien2', 'nhanvien2@smarthrm.local', '$2b$10$zD6lfRlSpyvz9L74T597FOGTh28RJBVSK4Lw2ncM6/kuxXzfzUcpm');

-- Mọi người có hồ sơ nhân viên đều có thêm vai trò nhanVien (đa vai trò, xem docs/phan-quyen.md)
INSERT INTO nguoidungvaitro (nguoiDungId, vaiTroId) VALUES
  (1, 1), (1, 5),
  (2, 2), (2, 5),
  (3, 3), (3, 5),
  (4, 4), (4, 5),
  (5, 5),
  (6, 5);

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
  (6, 'NV0006', 6, 'Võ Thị Hoa',      'NU',  '2002-12-08', '0905000006', 'Quảng Nam','0011000000006','MB Bank',     5, '2026-09-01', 'THU_VIEC');

-- ---------------------------------------------------------------------
-- 5. Trưởng bộ phận (PNS và PKT-PT để trống để thử chuỗi duyệt lên phòng ban cha)
-- ---------------------------------------------------------------------
UPDATE phongban SET truongBoPhanId = 2 WHERE id = 1; -- Ban Giám đốc: giám đốc
UPDATE phongban SET truongBoPhanId = 3 WHERE id = 3; -- Phòng Kỹ thuật: quản lý

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
  (6, 2026,  4.0, 0.0);
