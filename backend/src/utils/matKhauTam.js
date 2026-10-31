const crypto = require('crypto');
const bcrypt = require('bcrypt');

const SO_VONG_BAM = 10;
const DO_DAI_MAT_KHAU_TAM = 10;
// Bỏ các ký tự dễ nhầm khi đọc cho nhân viên (0/O, 1/l/I)
const KY_TU_MAT_KHAU_TAM = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

// Mật khẩu tạm luôn có cả chữ và số (đúng quy tắc mật khẩu mạnh của đổi mật khẩu)
function taoMatKhauTam() {
  for (;;) {
    const matKhau = Array.from(
      { length: DO_DAI_MAT_KHAU_TAM },
      () => KY_TU_MAT_KHAU_TAM[crypto.randomInt(KY_TU_MAT_KHAU_TAM.length)]
    ).join('');
    if (/[A-Za-z]/.test(matKhau) && /\d/.test(matKhau)) return matKhau;
  }
}

function bamMatKhau(matKhau) {
  return bcrypt.hash(matKhau, SO_VONG_BAM);
}

module.exports = { SO_VONG_BAM, taoMatKhauTam, bamMatKhau };
