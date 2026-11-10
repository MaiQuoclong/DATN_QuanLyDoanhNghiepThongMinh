const LoiUngDung = require('../utils/LoiUngDung');

// Cầu nối Express -> ai-service (FastAPI). Mọi lỗi mạng/timeout/khóa nội bộ sai đều quy về 503 thân thiện
// để backend không sập; lỗi nghiệp vụ 4xx (trừ 401/403) của ai-service được chuyển tiếp nguyên thông báo.
const THONG_BAO_KHONG_KHA_DUNG = 'Trợ lý AI tạm thời không khả dụng, vui lòng thử lại sau';

function layCauHinhAi() {
  return {
    duongDanGoc: (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/+$/, ''),
    khoaNoiBo: process.env.AI_SERVICE_KEY || '',
    thoiGianCho: Number(process.env.AI_TIMEOUT_MS) || 30000,
  };
}

async function goiAiService(duongDan, { method = 'GET', body, thoiGianCho } = {}) {
  const cauHinh = layCauHinhAi();
  const boHuy = new AbortController();
  const hen = setTimeout(() => boHuy.abort(), thoiGianCho || cauHinh.thoiGianCho);
  let phanHoi;
  try {
    phanHoi = await fetch(`${cauHinh.duongDanGoc}${duongDan}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Khoa-Noi-Bo': cauHinh.khoaNoiBo },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: boHuy.signal,
    });
  } catch (loi) {
    // ECONNREFUSED, DNS, timeout (AbortError)...
    console.error(`[aiClientService] ${method} ${duongDan} thất bại: ${loi.name} ${loi.cause?.code || loi.message}`);
    throw new LoiUngDung(503, THONG_BAO_KHONG_KHA_DUNG);
  } finally {
    clearTimeout(hen);
  }

  let duLieu = null;
  try {
    duLieu = await phanHoi.json();
  } catch {
    duLieu = null;
  }

  if (phanHoi.ok && duLieu?.success) return duLieu.data;

  const laLoiNghiepVu = phanHoi.status >= 400 && phanHoi.status < 500 && ![401, 403].includes(phanHoi.status);
  if (laLoiNghiepVu && typeof duLieu?.message === 'string') {
    throw new LoiUngDung(phanHoi.status, duLieu.message);
  }
  console.error(`[aiClientService] ${method} ${duongDan} trả HTTP ${phanHoi.status}`);
  throw new LoiUngDung(503, THONG_BAO_KHONG_KHA_DUNG);
}

// Kiểm tra nhanh ai-service cho trang tổng quan: không ném lỗi, chỉ trả trạng thái
async function kiemTraSucKhoeAi() {
  try {
    const duLieu = await goiAiService('/suKhoe', { thoiGianCho: 2000 });
    return { ai: 'HOAT_DONG', llm: duLieu?.llm || 'CHUA_CAU_HINH' };
  } catch {
    return { ai: 'MAT_KET_NOI', llm: null };
  }
}

module.exports = { goiAiService, kiemTraSucKhoeAi, THONG_BAO_KHONG_KHA_DUNG };
