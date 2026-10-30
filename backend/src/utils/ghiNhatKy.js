const { themNhatKy } = require('../repositories/nhatKyRepository');

// Ghi nhatkyhethong cho thao tác nhạy cảm. Lỗi ghi log không được làm hỏng nghiệp vụ chính.
// Ví dụ: await ghiNhatKy(req.nguoiDung.nguoiDungId, 'THEM_NHAN_VIEN', req.ip, 'NV0007');
async function ghiNhatKy(nguoiDungId, hanhDong, diaChiIP, chiTiet = null) {
  try {
    await themNhatKy(nguoiDungId, hanhDong, diaChiIP ?? null, chiTiet);
  } catch (loi) {
    console.error('[NHAT_KY] Không ghi được nhật ký:', loi.message);
  }
}

module.exports = ghiNhatKy;
