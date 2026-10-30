const LoiUngDung = require('../utils/LoiUngDung');

// Đa vai trò: quyền = hợp quyền các vai trò (docs/phan-quyen.md quy tắc 3).
// Dùng sau xacThucJwt: router.get('/nhanVien', xacThucJwt, phanQuyen(['HR', 'giamDoc', 'quanLy']), ...)
// Phạm vi dữ liệu (Mình / Phòng mình) kiểm tra tiếp ở service.
function phanQuyen(vaiTroChoPhep) {
  return (req, res, next) => {
    const vaiTro = req.nguoiDung?.vaiTro ?? [];
    if (!vaiTro.some((vt) => vaiTroChoPhep.includes(vt))) {
      throw new LoiUngDung(403, 'Bạn không có quyền thực hiện thao tác này');
    }
    next();
  };
}

module.exports = phanQuyen;
