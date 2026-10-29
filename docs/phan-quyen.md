# Ma trận phân quyền Smart HRM

Căn cứ để code middleware `phanQuyen`, kiểm tra phạm vi dữ liệu và viết test. Vai trò: `Admin`, `giamDoc`, `quanLy`, `HR`, `nhanVien`.

## Quy tắc chung
1. **Không tự duyệt:** không ai duyệt đơn, điều chỉnh công, KPI, đề xuất của chính mình. HR không sửa hồ sơ, hợp đồng, phiếu lương của chính mình.
2. **Người lập ≠ người duyệt:** ví dụ `bangtonghopluong.nguoiLapId <> nguoiDuyetId`.
3. **Đa vai trò:** quyền = hợp quyền các vai trò trong `nguoidungvaitro`. Ai có hồ sơ `nhanvien` đều có quyền `nhanVien` trên dữ liệu của chính mình.
4. **Phạm vi quanLy:** phòng ban có `truongBoPhanId` = mình và đệ quy các phòng ban con (`phongBanChaId`).
5. **Chuỗi duyệt theo tổ chức (một cấp):** trưởng bộ phận của người gửi → nếu người gửi là trưởng bộ phận thì trưởng phòng ban cha → cấp cao nhất là `giamDoc`. Đơn nghỉ dài hơn N ngày (cấu hình) chuyển thẳng `giamDoc`.
6. **Dữ liệu nhạy cảm** (lương, hợp đồng, `soTaiKhoanNganHang`, `tenNganHang`) của người khác: chỉ `HR` và `giamDoc` được xem. `quanLy` và `Admin` không xem.
7. **Ghi nhật ký** `nhatkyhethong` cho mọi thao tác thêm/sửa/xóa nhân sự, hợp đồng, lương, phân quyền, bổ nhiệm, quyết định khen thưởng/kỷ luật, reset mật khẩu.
8. **Admin cũng là nhân viên:** tài khoản Admin có hồ sơ `nhanvien` và vai trò `nhanVien`, nên có đủ quyền cá nhân (chấm công, điều chỉnh công, đơn nghỉ, tự chấm KPI, dashboard/phiếu lương/hợp đồng của mình). Đơn của Admin đi theo chuỗi duyệt tổ chức như mọi người.
9. **Phân cấp reset mật khẩu:** Admin là quyền cao nhất, reset được mọi tài khoản. HR chỉ đặt **mật khẩu tạm** cho tài khoản không có vai trò `Admin`, `giamDoc`, `HR`. Mật khẩu tạm hết hạn sau 24 giờ và người dùng bắt buộc đổi ở lần đăng nhập kế tiếp. Schema không có cột cờ, nên suy ra từ `nhatkyhethong`: nếu bản ghi `RESET_MAT_KHAU_TAM` mới hơn `DOI_MAT_KHAU` của cùng người dùng thì bắt buộc đổi.

Ký hiệu: ✓ toàn bộ · **PM** phòng mình (theo quy tắc 4) · **Mình** chỉ dữ liệu của chính mình · trống = không có quyền.

## 1. Tài khoản & Hệ thống
| Chức năng | Admin | giamDoc | quanLy | HR | nhanVien |
|---|---|---|---|---|---|
| Đăng nhập, đăng xuất, đổi mật khẩu | ✓ | ✓ | ✓ | ✓ | ✓ |
| Bắt buộc đổi mật khẩu tạm khi đăng nhập | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tạo, khóa, mở khóa tài khoản | ✓ | | | Tạo kèm hồ sơ NV | |
| Reset mật khẩu người khác | ✓ (mọi tài khoản) | | | Mật khẩu tạm, chỉ tài khoản nhanVien/quanLy | |
| Gán / thu hồi vai trò, quản lý `vaitro` | ✓ | | | | |
| Xem nhật ký hệ thống | ✓ | ✓ | | | |

## 2. Cơ cấu tổ chức
| Chức năng | Admin | giamDoc | quanLy | HR | nhanVien |
|---|---|---|---|---|---|
| Xem sơ đồ phòng ban | ✓ | ✓ | ✓ | ✓ | ✓ |
| Thêm, sửa, ngừng phòng ban | | | | ✓ | |
| Bổ nhiệm trưởng bộ phận (cập nhật `truongBoPhanId`) | | ✓ | | Xem, hỗ trợ hồ sơ | |
| Quản lý chức danh, gán chức danh vào phòng ban | | | | ✓ | |

Quy trình bổ nhiệm: HR tiếp nhận tờ trình đề xuất, kiểm tra tiêu chuẩn và điều kiện của nhân sự, soạn quyết định bổ nhiệm, trình Ban Giám đốc ký và lưu hồ sơ (ngoài hệ thống). Trên hệ thống, chỉ giamDoc thực hiện bổ nhiệm, có ghi nhật ký.

## 3. Hồ sơ nhân sự & Trạng thái lao động
| Chức năng | Admin | giamDoc | quanLy | HR | nhanVien |
|---|---|---|---|---|---|
| Danh sách nhân viên (tìm, lọc, phân trang) | | ✓ | PM | ✓ | |
| Xem hồ sơ cơ bản | Mình | ✓ | PM | ✓ | Mình |
| Xem thông tin ngân hàng | Mình | ✓ | | ✓ | Mình |
| Thêm nhân viên (sinh `maNhanVien`, tạo tài khoản – transaction) | | | | ✓ | |
| Sửa hồ sơ | SĐT, địa chỉ, ngân hàng của mình | | | ✓ (trừ mình) | SĐT, địa chỉ, ngân hàng của mình |
| Đổi trạng thái lao động, điều chuyển | | | | ✓ (ghi nhật ký) | |
| Xuất Excel | | ✓ | PM | ✓ | |

## 4. Hợp đồng lao động
| Chức năng | Admin | giamDoc | quanLy | HR | nhanVien |
|---|---|---|---|---|---|
| Xem hợp đồng & lịch sử | Mình | ✓ | | ✓ | Mình |
| Tạo, gia hạn, điều chỉnh, chấm dứt (ghi `lichsuhopdong` – transaction) | | | | ✓ (trừ mình) | |
| Cảnh báo hợp đồng sắp hết hạn | | ✓ | | ✓ | |

## 5. Chấm công
| Chức năng | Admin | giamDoc | quanLy | HR | nhanVien |
|---|---|---|---|---|---|
| Check-in / check-out, xem lịch công | Mình | Mình | Mình | Mình | Mình |
| Gửi yêu cầu điều chỉnh công | Mình | Mình | Mình | Mình | Mình |
| Duyệt / từ chối điều chỉnh công | | ✓ | PM | ✓ (trừ mình) | |
| Bảng công tháng | | ✓ | PM | ✓ | |
| Chốt công tháng (khóa điều chỉnh) | | | | ✓ | |

## 6. Nghỉ phép
| Chức năng | Admin | giamDoc | quanLy | HR | nhanVien |
|---|---|---|---|---|---|
| Quản lý loại nghỉ phép, cấp quỹ phép năm | | | | ✓ | |
| Xem quỹ phép | Mình | ✓ | PM | ✓ | Mình |
| Tạo đơn (`CHO_DUYET`, kiểm tra quỹ phép), hủy khi chưa duyệt | Mình | Mình | Mình | Mình | Mình |
| Duyệt / từ chối (trừ quỹ phép – transaction, theo chuỗi duyệt) | | ✓ | PM | | |
| Lịch nghỉ | | ✓ | PM | ✓ | |

## 7. Lương
| Chức năng | Admin | giamDoc | quanLy | HR | nhanVien |
|---|---|---|---|---|---|
| Lập bảng lương `BAN_NHAP` (yêu cầu đã chốt công), sinh phiếu | | | | ✓ | |
| Rà soát, sửa phiếu khi còn nháp (trừ phiếu của mình) | | | | ✓ | |
| Duyệt / trả lại, chốt bảng lương (`nguoiDuyetId` ≠ `nguoiLapId`) | | ✓ | | | |
| Xem phiếu lương | Mình | ✓ | Mình | ✓ | Mình |
| Báo cáo quỹ lương, xuất Excel | | ✓ | | ✓ | |

Tham số cấu hình (không viết cứng): tỷ lệ BHXH/BHYT/BHTN người lao động, mức giảm trừ gia cảnh, biểu thuế TNCN lũy tiến. Khoản khen thưởng (+) / kỷ luật (−) có `ngayBanHanh` trong tháng tự đưa vào phiếu lương.

## 8. Đánh giá KPI
| Chức năng | Admin | giamDoc | quanLy | HR | nhanVien |
|---|---|---|---|---|---|
| Mở / đóng kỳ đánh giá | | | | ✓ | |
| Định nghĩa chỉ tiêu, trọng số | | | PM | ✓ | |
| Tạo phiếu đánh giá | | | PM | ✓ | |
| Tự chấm | Mình | Mình | Mình | Mình | Mình |
| Nghiệm thu, chấm điểm | | Chấm trưởng bộ phận | PM (trừ mình) | | |
| Xem kết quả | Mình | ✓ | PM | ✓ | Mình |
| Báo cáo xếp loại | | ✓ | PM | ✓ | |

## 9. Khen thưởng & Kỷ luật
Luồng: **quanLy đề xuất** (`dexuatkhenthuongkyluat`, `CHO_DUYET`) → **HR xử lý**: từ chối (`TU_CHOI`, ghi chú) hoặc lập quyết định (`quyetdinhkhenthuongkyluat` + đề xuất `DA_DUYET` – transaction) → **giamDoc** là người ký (`nguoiKyDuyetId`).

| Chức năng | Admin | giamDoc | quanLy | HR | nhanVien |
|---|---|---|---|---|---|
| Tạo đề xuất cho nhân viên | | ✓ | PM (trừ mình) | | |
| Xem đề xuất | | ✓ | Do mình tạo | ✓ | |
| Từ chối / chuyển thành quyết định | | | | ✓ | |
| Ký quyết định | | ✓ | | | |
| Xem quyết định | Mình | ✓ | PM | ✓ | Mình |

## 10. Dashboard
| Nội dung | Admin | giamDoc | quanLy | HR | nhanVien |
|---|---|---|---|---|---|
| Thống kê hệ thống (tài khoản, đăng nhập, log) | ✓ | | | | |
| Toàn công ty: nhân sự, biến động, quỹ lương, KPI | | ✓ | | ✓ | |
| Phòng ban: quân số, đi muộn, đơn chờ duyệt, KPI | | | PM | | |
| Cá nhân: công, phép còn lại, lương gần nhất, KPI | ✓ | ✓ | ✓ | ✓ | ✓ |

## 11. AI Agent
| Chức năng | Admin | giamDoc | quanLy | HR | nhanVien |
|---|---|---|---|---|---|
| Tải lên / quản lý tài liệu quy chế | | | | ✓ | |
| Hỏi đáp quy chế (RAG, trích dẫn điều khoản) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tạo đơn qua chat (Function Calling, `CHO_DUYET`) | Mình | Mình | Mình | Mình | Mình |
| Text-to-SQL (chỉ đọc, user `aiReadonly`) | | ✓ | PM, không bảng lương/hợp đồng | ✓ | |
| Lịch sử hội thoại | Mình | Mình | Mình | Mình | Mình |

Function Calling không bao giờ tạo đơn hộ người khác và không duyệt đơn. Chi tiết lọc Text-to-SQL cho quanLy: xem `.claude/rules/database.md`.
