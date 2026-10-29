-- =====================================================================
-- Tài khoản MySQL chỉ đọc cho AI service (Text-to-SQL)
-- Chạy bằng root. ĐỔI mật khẩu bên dưới trước khi chạy và ghi vào ai-service/.env.
-- Lớp bảo vệ chính: dù AI sinh ra DROP/DELETE/UPDATE thì MySQL cũng từ chối.
-- =====================================================================
CREATE USER IF NOT EXISTS 'aiReadonly'@'localhost' IDENTIFIED BY 'AiDoc@2026';
CREATE USER IF NOT EXISTS 'aiReadonly'@'127.0.0.1' IDENTIFIED BY 'AiDoc@2026';

-- Cấp SELECT từng bảng, KHÔNG cấp cho nguoidung (chứa matKhauMaHoa)
GRANT SELECT ON quanlydoanhnghiepthongminh.banghichamcong            TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.bangtonghopluong          TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.chitietdanhgiakpi         TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.chitieukpi                TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.chucdanh                  TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.chucdanhphongban          TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.dexuatkhenthuongkyluat    TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.dondexuatnghiphep         TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.hopdonglaodong            TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.kydanhgiakpi              TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.lichsuhopdong             TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.loainghiphep              TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.nguoidungvaitro           TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.nhanvien                  TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.nhatkyhethong             TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.phientrochuyenai          TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.phieudanhgiakpi           TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.phieuluongnhanvien        TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.phongban                  TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.quyetdinhkhenthuongkyluat TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.quyngayphep               TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.tailieuquyche             TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.vaitro                    TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.yeucaudieuchinhchamcong   TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';

-- nguoidung: chỉ cấp các cột không nhạy cảm (bỏ matKhauMaHoa)
GRANT SELECT (id, tenDangNhap, email, trangThai, ngayTao, lanDangNhapCuoi)
  ON quanlydoanhnghiepthongminh.nguoidung TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';

FLUSH PRIVILEGES;
