const baoCaoAiService = require('../services/baoCaoAiService');
const { thanhCong } = require('../utils/phanHoi');

async function truyVan(req, res) {
  const ketQua = await baoCaoAiService.truyVan(req.nguoiDung, req.body.cauHoi, req.ip);
  const thongBao = ketQua.loaiPhanHoi === 'KET_QUA' ? 'Lấy báo cáo thành công' : 'Không lập được báo cáo cho câu hỏi này';
  return thanhCong(res, ketQua, thongBao);
}

module.exports = { truyVan };
