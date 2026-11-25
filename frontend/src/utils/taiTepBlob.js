import goiApi from '../services/goiApi';

// Xuất tối đa vài nghìn dòng có thể lâu hơn timeout mặc định 10s của goiApi
const THOI_GIAN_CHO_TAI_TEP_MS = 60000;

// Tải tệp (CSV "Excel") từ API rồi kích hoạt lưu về máy. Lỗi: ném Error với thông báo tiếng Việt của backend
// (interceptor goiApi đã đọc lại body Blob JSON thành { message }).
export async function taiTepTuApi(duongDan, params, tenFile) {
  let tep;
  try {
    tep = await goiApi.get(duongDan, { params, responseType: 'blob', timeout: THOI_GIAN_CHO_TAI_TEP_MS });
  } catch (e) {
    throw new Error(e?.message ?? 'Không tải được tệp Excel');
  }
  const url = URL.createObjectURL(tep);
  const a = document.createElement('a');
  a.href = url;
  a.download = tenFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Thu hồi sau khi trình duyệt đã bắt đầu tải (Firefox/Safari có thể hủy nếu thu hồi ngay)
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Tên tệp mặc định kèm ngày giờ: TienTo_YYYYMMDD_HHmm.csv
export function tenTepTheoNgay(tienTo) {
  const d = new Date();
  const s = (n) => String(n).padStart(2, '0');
  return `${tienTo}_${d.getFullYear()}${s(d.getMonth() + 1)}${s(d.getDate())}_${s(d.getHours())}${s(d.getMinutes())}.csv`;
}
