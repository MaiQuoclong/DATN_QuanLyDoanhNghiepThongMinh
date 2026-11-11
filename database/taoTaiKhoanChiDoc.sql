-- =====================================================================
-- Quyền SELECT cho tài khoản chỉ đọc aiReadonly (Text-to-SQL, Module 5.6)
-- Tạo user + mật khẩu do backend/scripts/khoiTaoCsdl.js thực hiện (mật khẩu lấy từ
-- AI_CSDL_MAT_KHAU, truyền tham số, không ghi cứng trong file này).
-- Lớp bảo vệ chính: dù AI sinh ra DROP/DELETE/UPDATE thì MariaDB cũng từ chối.
-- KHÔNG cấp: nguoidung (matKhauMaHoa), nguoidungvaitro, vaitro, nhatkyhethong,
--            phientrochuyenai, tailieuquyche.
-- Bảng lương/hợp đồng được cấp ở mức DB; ai-service chặn với vai trò quanLy.
-- =====================================================================
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
GRANT SELECT ON quanlydoanhnghiepthongminh.phieudanhgiakpi           TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.phieuluongnhanvien        TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.phongban                  TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.quyetdinhkhenthuongkyluat TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.quyngayphep               TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';
GRANT SELECT ON quanlydoanhnghiepthongminh.yeucaudieuchinhchamcong   TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';

-- nhanvien: chỉ cột phục vụ báo cáo (bỏ nguoiDungId, soTaiKhoanNganHang, tenNganHang)
GRANT SELECT (id, maNhanVien, hoVaTen, gioiTinh, ngaySinh, soDienThoai, diaChi,
              chucDanhPhongBanId, ngayVaoLam, trangThaiLamViec, ngayTao, ngayCapNhat)
  ON quanlydoanhnghiepthongminh.nhanvien TO 'aiReadonly'@'localhost', 'aiReadonly'@'127.0.0.1';

FLUSH PRIVILEGES;
