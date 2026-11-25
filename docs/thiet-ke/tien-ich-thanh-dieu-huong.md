# Thiết kế: Tiện ích thanh điều hướng (`feature/tien-ich-thanh-dieu-huong`)

Người dùng duyệt 2026-11-23. Không đổi schema.

## Phương án đã chốt
1. Chuông lấy số liệu từ endpoint mới `GET /api/v1/viecCanChuY`, tái dùng service sẵn có (không viết lại quy tắc duyệt).
2. Polling 60s + tải lại khi tab được focus/hiện lại hoặc đổi trang (debounce ~1s); dừng khi tab ẩn.
3. Menu Tạo nhanh mở hộp thoại tạo qua tham số `?tao=1` (4 trang: đơn nghỉ phép, điều chỉnh công, thêm nhân viên, tài liệu quy chế).
4. Trang Tổng quan chưa chuyển sang endpoint mới — ghi "Hạn chế đã biết", làm ở nhánh sau.

## 1. Tạo nhanh (+)
| Thao tác | Đường dẫn | Vai trò | Cần hồ sơ |
|---|---|---|---|
| Tạo đơn nghỉ phép | `/nghiPhep?tao=1` | tất cả | có |
| Gửi điều chỉnh công | `/chamCong/dieuChinh?tao=1` | tất cả | có |
| Hỏi Trợ lý AI | `/troLyAi` | tất cả | không |
| Thêm nhân viên | `/nhanSu/danhSach?tao=1` | HR | không |
| Tải tài liệu quy chế | `/troLyAi/taiLieu?tao=1` | HR | không |

Trang đọc `?tao=1` → mở hộp thoại → xóa tham số (`replace`). Vai trò không có quyền: trang bị chặn như cũ, tham số bị bỏ qua.

## 2. Tìm nhanh
- Mở bằng nút, phím `/` (bỏ qua khi đang focus `input`/`textarea`/`select`/`contentEditable`) hoặc `Ctrl+K`/`Cmd+K` (luôn `preventDefault`).
- Nguồn: module + tab từ `danhSachMenu.js` lọc theo quyền (`layMucTimKiem`) + thao tác nhanh. Khớp không dấu (`boDauTiengViet`, `khopTuKhoa`: mọi từ đều phải khớp). Tối đa 8 kết quả, ↑/↓/Enter/Esc.

## 3. Chuông "Việc cần chú ý"
`GET /api/v1/viecCanChuY` — `xacThucJwt` + `phanQuyen` 5 vai trò. Trả:
```json
{ "tongSo": 3, "items": [{ "loai": "DON_NGHI_CHO_DUYET", "tieuDe": "Đơn nghỉ phép chờ duyệt", "soLuong": 2, "duongDan": "/nghiPhep/duyetDon" }], "nguonLoi": [] }
```
Chỉ trả mục `soLuong > 0`. Một nguồn lỗi → bỏ qua, ghi `loai` vào `nguonLoi` (`Promise.allSettled`), không 500.

| `loai` | Vai trò | Nguồn (tái dùng) | Đích |
|---|---|---|---|
| `DON_NGHI_CHO_DUYET` | giamDoc, quanLy | `nghiPhepService.layDanhSachDon` CHO_DUYET, đếm `duocDuyet` | `/nghiPhep/duyetDon` |
| `DIEU_CHINH_CONG_CHO_DUYET` | giamDoc, quanLy, HR | `chamCongService.layDanhSachYeuCau` CHO_DUYET, đếm `duocDuyet` | `/chamCong/dieuChinh` |
| `DE_XUAT_CHO_XU_LY` | HR | `khenThuongKyLuatService.layDanhSachDeXuat` CHO_DUYET | `/khenThuongKyLuat/deXuat` |
| `DE_XUAT_CHO_KY` | giamDoc | đề xuất CHO_KY trình cho chính mình | `/khenThuongKyLuat/deXuat` |
| `KPI_CAN_TU_CHAM` | có hồ sơ | `kpiService.layPhieuCuaToi`: BAN_NHAP trong kỳ DANG_MO | `/kpi` |
| `KPI_CAN_NGHIEM_THU` | giamDoc, quanLy | `kpiService.layDanhSachPhieu` CHO_DUYET, đếm `duocNghiemThu` | `/kpi/danhGia` |
| `HOP_DONG_SAP_HET_HAN` | HR, giamDoc | `hopDongService.laySapHetHan(30)` | `/nhanSu/hopDong` |

Chỉ đọc, không transaction, không ghi `nhatkyhethong`. Response chỉ có số lượng + đường dẫn.

## 4. UI
- Mỗi lúc một popover (`tao`/`tim`/`chuong`/`taiKhoan`); Esc, click ngoài, đổi trang → đóng.
- Badge: ẩn khi 0, `99+` khi lớn hơn 99. Lỗi tải → giữ số cũ, hiện "Không tải được".

## 5. Test
`backend/tests/viecCanChuY.test.js`: 401; 5 vai trò 200 + đúng shape; phạm vi quanLy; đơn dài ngày chuyển giamDoc; điều chỉnh công của chính mình không đếm; CHO_KY chỉ người được trình; KPI tự chấm / nghiệm thu; hợp đồng sắp hết hạn chỉ HR/giamDoc; nguồn lỗi → `nguonLoi`. Frontend: lint + `vite build` + kịch bản test tay.

## Hạn chế đã biết
- `Ctrl+K` được bắt cả khi đang gõ trong ô nhập (kể cả ô chat Trợ lý AI) — chủ ý, không chèn ký tự nên không làm hỏng nội dung đang gõ.
- Đếm bằng danh sách lọc: mỗi loại tối đa theo `kichThuoc` tối đa của API.
- Số trên chuông có thể khác thẻ trang Tổng quan (cách đếm khác) cho đến khi Tổng quan dùng chung endpoint.
