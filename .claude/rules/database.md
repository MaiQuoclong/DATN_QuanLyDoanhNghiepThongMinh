# Quy tắc CSDL (MariaDB 10.4 / MySQL)

Nguồn chuẩn duy nhất: `database/schema.sql` (database `quanlydoanhnghiepthongminh`, 25 bảng = 24 bảng gốc + bảng mở rộng `dexuatkhenthuongkyluat`). KHÔNG sửa tên bảng, tên cột, kiểu dữ liệu.
Thêm bảng mở rộng chỉ khi người dùng đồng ý; sau đó dump lại toàn bộ database vào `database/schema.sql`.

## Quy ước trong schema
- Tên bảng viết thường liền: `nhanvien`, `quyngayphep`, `nhatkyhethong`. Tên cột camelCase: `maNhanVien`, `chucDanhPhongBanId`.
- Khóa chính `id INT AUTO_INCREMENT`, khóa ngoại dạng `<tenBang>Id`.
- Tiền tệ `DECIMAL(15,2)` (tổng quỹ lương `DECIMAL(18,2)`); số ngày `DECIMAL(4,1)`; điểm KPI `DECIMAL(4,2)`.
- Trạng thái là `VARCHAR` chữ hoa không dấu: `CHO_DUYET`, `DA_DUYET`, `TU_CHOI`, `BAN_NHAP`, `HIEU_LUC`, `DANG_HOAT_DONG`, `THU_VIEC`, `HOP_LE`, `DANG_MO`, `DANG_AP_DUNG`. Không dùng `PENDING`/`APPROVED` tiếng Anh.
- Dùng thư viện `mysql2/promise` với câu lệnh tham số hóa (`?`), không nối chuỗi SQL.

## Sơ đồ khóa ngoại
- **Tài khoản & phân quyền:** `nguoidung` ←(N-N qua `nguoidungvaitro`, CASCADE)→ `vaitro`; `nhanvien.nguoiDungId` → `nguoidung` (UNIQUE, 1-1).
- **Tổ chức:** `phongban.phongBanChaId` → `phongban` (cây); `phongban.truongBoPhanId` → `nhanvien`; `chucdanhphongban` → `phongban`, `chucdanh`; `nhanvien.chucDanhPhongBanId` → `chucdanhphongban`.
- **Hợp đồng:** `hopdonglaodong` → `nhanvien`; `lichsuhopdong` → `hopdonglaodong` (CASCADE), `nguoiThucHienId` → `nhanvien`.
- **Chấm công & phép:** `banghichamcong` → `nhanvien`; `yeucaudieuchinhchamcong` → `banghichamcong`, `nhanvien`, `nguoiDuyetId`; `dondexuatnghiphep` → `nhanvien`, `loainghiphep`, `nguoiDuyetId`; `quyngayphep` → `nhanvien`.
- **Lương:** `bangtonghopluong` (`nguoiLapId`, `nguoiDuyetId` → `nhanvien`); `phieuluongnhanvien` → `bangtonghopluong` (CASCADE), `nhanvien`.
- **KPI:** `chitieukpi` → `chucdanhphongban`; `phieudanhgiakpi` → `kydanhgiakpi`, `nhanvien`, `nguoiDanhGiaId`; `chitietdanhgiakpi` → `phieudanhgiakpi` (CASCADE), `chitieukpi`.
- **Khen thưởng/kỷ luật:** `quyetdinhkhenthuongkyluat` → `nhanvien`, `nguoiKyDuyetId`; `dexuatkhenthuongkyluat` (mở rộng): `nguoiDeXuatId`, `nhanVienId`, `nguoiXuLyId` → `nhanvien`; `quyetDinhId` → `quyetdinhkhenthuongkyluat` (SET NULL). `loaiDeXuat`: `KHEN_THUONG` / `KY_LUAT`.
- **Hệ thống & AI:** `nhatkyhethong` → `nguoidung` (SET NULL); `phientrochuyenai` → `nguoidung` (CASCADE); `tailieuquyche.nguoiTaiLenId` → `nhanvien`.

## Bắt buộc dùng transaction
- Duyệt đơn nghỉ phép: cập nhật `dondexuatnghiphep.trangThai` + cộng `quyngayphep.soNgayDaNghi`.
- Chốt lương: tạo `bangtonghopluong` + toàn bộ `phieuluongnhanvien`.
- Sửa hợp đồng: cập nhật `hopdonglaodong` + ghi `lichsuhopdong`.
- Duyệt điều chỉnh chấm công: cập nhật `yeucaudieuchinhchamcong` + `banghichamcong`.
- HR lập quyết định từ đề xuất: INSERT `quyetdinhkhenthuongkyluat` + UPDATE `dexuatkhenthuongkyluat` (`trangThai = 'DA_DUYET'`, `quyetDinhId`, `nguoiXuLyId`).

## Text-to-SQL
- AI service kết nối bằng tài khoản MySQL riêng chỉ có quyền `SELECT` (`GRANT SELECT ON quanlydoanhnghiepthongminh.* TO 'aiReadonly'@'localhost'`). Lọc từ khóa chỉ là lớp phụ; chỉ một câu lệnh; luôn thêm `LIMIT`. Không cho truy vấn `nguoidung.matKhauMaHoa`.
- Vai trò được dùng: `giamDoc`, `HR` (toàn công ty), `quanLy` (giới hạn phạm vi).
- Với `quanLy`: phân tích SQL bằng `sqlglot`, thay mọi bảng `nhanvien` và bảng có cột `nhanVienId` bằng truy vấn con lọc theo danh sách nhân viên thuộc phòng ban người đó làm trưởng (kể cả phòng ban con). Từ chối truy vấn tới `phieuluongnhanvien`, `bangtonghopluong`, `hopdonglaodong`, `lichsuhopdong`, `nguoidung`, `nhatkyhethong`; loại cột `soTaiKhoanNganHang`, `tenNganHang`.
