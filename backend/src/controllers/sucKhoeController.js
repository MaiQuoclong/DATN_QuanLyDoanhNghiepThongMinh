const { kiemTraKetNoi } = require('../config/ketNoiCsdl');
const { thanhCong } = require('../utils/phanHoi');
const { kiemTraSucKhoeAi } = require('../services/aiClientService');

async function kiemTraSucKhoe(req, res) {
  const [ketQuaCsdl, trangThaiAi] = await Promise.all([
    kiemTraKetNoi().then(
      () => 'KET_NOI',
      () => 'MAT_KET_NOI',
    ),
    kiemTraSucKhoeAi(),
  ]);
  return thanhCong(
    res,
    { mayChu: 'HOAT_DONG', csdl: ketQuaCsdl, ...trangThaiAi, thoiGian: new Date().toISOString() },
    'Hệ thống đang hoạt động',
  );
}

module.exports = { kiemTraSucKhoe };
