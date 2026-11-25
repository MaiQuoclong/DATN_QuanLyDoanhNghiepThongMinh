const viecCanChuYService = require('../services/viecCanChuYService');
const { thanhCong } = require('../utils/phanHoi');

async function layViecCanChuY(req, res) {
  return thanhCong(res, await viecCanChuYService.layViecCanChuY(req.nguoiDung), 'Lấy danh sách việc cần chú ý thành công');
}

module.exports = { layViecCanChuY };
