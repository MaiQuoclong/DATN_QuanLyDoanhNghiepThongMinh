// Bọc controller async: lỗi (kể cả từ await) tự chuyển tới global error middleware qua next()
// Dùng trong routes: router.get('/nhanVien', batLoiBatDongBo(layDanhSachNhanVien));
const batLoiBatDongBo = (xuLy) => (req, res, next) => {
  Promise.resolve(xuLy(req, res, next)).catch(next);
};

module.exports = batLoiBatDongBo;
