# Design System - Smart HRM (Frontend ReactJS)

## Phong cách
Clean Dashboard kiểu SaaS HR/Finance hiện đại (tham khảo mẫu "tiimi"): nền xám nhạt, thẻ trắng viền mảnh, mật độ dữ liệu cao, nhấn bằng teal đậm và vàng.

## Bố cục
- **Thanh trên cùng** (cao 52px, nền tối `--mauThanhTren`): logo + tên module, tab con dạng pill (vd. Lương: Bảng lương | Phiếu lương), bên phải: nút "+" vàng, tìm kiếm, thông báo, avatar (menu đổi mật khẩu / đăng xuất).
- **Thanh icon trái** (rộng 60px, nền trắng): chỉ icon `lucide-react`, có tooltip; mục đang chọn nền teal nhạt.
- **Nội dung:** padding 24px, tiêu đề trang 22px đậm, dòng đếm trạng thái ngay dưới (`● Đã duyệt 3 · ● Chờ duyệt 5`), nút hành động bên phải tiêu đề.

## Màu sắc (`frontend/src/styles/bienMau.css`)
| Token | Giá trị | Dùng cho |
|---|---|---|
| `--mauChinh` | `#1F5F57` | nút chính, tab đang chọn, liên kết |
| `--mauNhan` | `#F5C518` | nút "+", điểm nhấn |
| `--mauThanhTren` | `#1F2329` | thanh trên cùng |
| `--mauNen` | `#F4F5F7` | nền trang |
| `--mauVien` | `#E8EAED` | viền thẻ, đường kẻ bảng |
| Trạng thái | xanh lá / cam / đỏ / xám | `DA_DUYET`,`HIEU_LUC` / `CHO_DUYET` / `TU_CHOI` / `BAN_NHAP` |

## Thành phần dùng chung (`frontend/src/components/`)
- `NutBam`: biến thể `chinh` (teal), `phu` (trắng viền), `vang`, `ma` (không nền).
- `ChipTrangThai`: nhận mã trạng thái theo schema, hiển thị chấm tròn + nhãn tiếng Việt (`kieu="chip"` cho dạng nền nhạt như "Active").
- `BangDuLieu`: bảng dày, header sticky có sort, cột hành động "···".
- `ThanhLoc`: ô tìm kiếm + các dropdown lọc + "Bộ lọc nâng cao".
- `TheThongKe`: thẻ số liệu (nhãn nhỏ xám, số lớn, so sánh kỳ trước).

## Mẫu trang
- **Chi tiết nhân viên:** header (avatar, tên, chip trạng thái, mã NV, điều hướng `1/32`), tabs gạch chân (Thông tin cá nhân, Hợp đồng, Lương, Chấm công, Tài liệu, KPI), lưới thẻ 2 cột có nút "Sửa".
- **Wizard (chốt lương):** stepper dọc bên trái, nội dung giữa, ô "Gợi ý" xám bên phải, chân trang Hủy / Tiếp tục.
- **Chấm công:** timeline theo ngày dạng thanh màu (làm việc xanh dương, nghỉ giữa giờ teal, đi muộn đỏ cam, tăng ca cam, nghỉ phép vàng).
- **Biểu đồ (Recharts):** donut tổng chi lương, thanh ngang tổng giờ công; dùng màu token, không màu tự do.

## Kiểu chữ
Inter (fallback Segoe UI, Roboto); `font-variant-numeric: tabular-nums`; cỡ chữ cơ bản 13–14px, nhãn phụ 12px xám.

## AI
Chat Drawer bên phải màn hình (dark mode riêng cho khung chat).
