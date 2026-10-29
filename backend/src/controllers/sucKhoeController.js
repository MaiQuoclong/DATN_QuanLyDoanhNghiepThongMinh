const { kiemTraKetNoi } = require('../config/ketNoiCsdl');
const { thanhCong } = require('../utils/phanHoi');

async function kiemTraSucKhoe(req, res) {
  let csdl = 'KET_NOI';
  try {
    await kiemTraKetNoi();
  } catch {
    csdl = 'MAT_KET_NOI';
  }
  return thanhCong(
    res,
    { mayChu: 'HOAT_DONG', csdl, thoiGian: new Date().toISOString() },
    'Hệ thống đang hoạt động'
  );
}

module.exports = { kiemTraSucKhoe };
