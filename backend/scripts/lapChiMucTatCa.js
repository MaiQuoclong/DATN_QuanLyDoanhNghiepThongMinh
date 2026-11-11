// Lập (lại) chỉ mục RAG cho mọi tài liệu trong bảng tailieuquyche (kể cả 3 tài liệu mẫu seed).
// Dùng sau `npm run khoiTaoCsdl` hoặc khi đổi model embedding / xóa ai-service/duLieu/chroma.
// Yêu cầu ai-service đang chạy (cùng AI_SERVICE_KEY, cùng THU_MUC_TAI_LIEU). Cách dùng: npm run lapChiMuc
require('dotenv').config();
const { pool } = require('../src/config/ketNoiCsdl');
const { goiAiService } = require('../src/services/aiClientService');
const taiLieuQuyCheRepository = require('../src/repositories/taiLieuQuyCheRepository');

const THOI_GIAN_CHO = 300000; // lần đầu ai-service còn tải/nạp model embedding

async function lapChiMucTatCa() {
  // Script quản trị chạy tay, không gắn người dùng nên không ghi nhatkyhethong (lập chỉ mục qua API mới ghi)
  const taiLieu = await taiLieuQuyCheRepository.layTatCaDeLapChiMuc();
  const ids = taiLieu.map((t) => t.id);
  let loi = 0;
  for (const t of taiLieu) {
    try {
      const kq = await goiAiService('/noiBo/rag/lapChiMuc', {
        method: 'POST',
        body: {
          taiLieuId: t.id,
          maTaiLieu: t.maTaiLieu,
          tieuDe: t.tieuDe,
          duongDanTep: t.duongDanTep.replaceAll('\\', '/'),
          taiLieuIdsHienCo: ids,
        },
        thoiGianCho: THOI_GIAN_CHO,
      });
      console.log(`✓ ${t.maTaiLieu}: ${kq.soDoan} đoạn, ${kq.soDieu} điều`);
    } catch (e) {
      loi += 1;
      console.error(`✗ ${t.maTaiLieu}: ${e.message}`);
      if (e.code === 503) {
        console.error('  Gợi ý: ai-service đã chạy chưa? AI_SERVICE_KEY hai bên có trùng? Model embedding đã tải xong chưa?');
      }
    }
  }
  console.log(`Xong: ${taiLieu.length - loi}/${taiLieu.length} tài liệu đã lập chỉ mục.`);
  return loi;
}

lapChiMucTatCa()
  .then((loi) => {
    process.exitCode = loi ? 1 : 0;
  })
  .catch((e) => {
    console.error('Lập chỉ mục thất bại:', e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
