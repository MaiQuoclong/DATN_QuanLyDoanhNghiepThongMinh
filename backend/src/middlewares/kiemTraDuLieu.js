const LoiUngDung = require('../utils/LoiUngDung');

// Kiểm tra req.body theo luật đơn giản, lỗi đầu tiên trả 400.
// luat: { tenTruong: { nhan, batBuoc, toiThieu, toiDa, toiDaByte, mauKiemTra: RegExp, thongBaoMau } }
function kiemTraDuLieu(luat) {
  return (req, res, next) => {
    const body = req.body ?? {};
    for (const [truong, quyTac] of Object.entries(luat)) {
      const nhan = quyTac.nhan ?? truong;
      const giaTri = body[truong];
      const rong = giaTri === undefined || giaTri === null || String(giaTri).trim() === '';
      if (rong) {
        if (quyTac.batBuoc) throw new LoiUngDung(400, `${nhan} không được để trống`);
        continue;
      }
      if (typeof giaTri !== 'string') {
        throw new LoiUngDung(400, `${nhan} phải là chuỗi ký tự`);
      }
      if (quyTac.toiThieu && giaTri.length < quyTac.toiThieu) {
        throw new LoiUngDung(400, `${nhan} phải có ít nhất ${quyTac.toiThieu} ký tự`);
      }
      if (quyTac.toiDa && giaTri.length > quyTac.toiDa) {
        throw new LoiUngDung(400, `${nhan} không được vượt quá ${quyTac.toiDa} ký tự`);
      }
      if (quyTac.toiDaByte && Buffer.byteLength(giaTri, 'utf8') > quyTac.toiDaByte) {
        throw new LoiUngDung(400, `${nhan} quá dài (tối đa ${quyTac.toiDaByte} byte)`);
      }
      if (quyTac.mauKiemTra && !quyTac.mauKiemTra.test(giaTri)) {
        throw new LoiUngDung(400, quyTac.thongBaoMau ?? `${nhan} không hợp lệ`);
      }
    }
    next();
  };
}

module.exports = kiemTraDuLieu;
