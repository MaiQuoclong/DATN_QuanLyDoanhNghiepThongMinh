const { laCuoiTuan, laNgayNghiChung } = require('./ngayLe');
const { THAM_SO_CHAM_CONG } = require('../config/thamSoNghiepVu');

// Đổi 'HH:MM[:SS]' sang số phút trong ngày
function doiPhut(gio) {
  const [h, m, s = 0] = gio.split(':').map(Number);
  return h * 60 + m + s / 60;
}

function chongLap(batDau1, ketThuc1, batDau2, ketThuc2) {
  return Math.max(0, Math.min(ketThuc1, ketThuc2) - Math.max(batDau1, batDau2));
}

const lamTronGio = (phut) => Math.round((phut / 60) * 100) / 100;

// Tính chỉ số một ngày công từ giờ vào/ra:
// - Ngày thường: giờ thực tế = phần giao với ca 08:00-17:00 trừ nghỉ trưa; OT = phần sau giờ ra ca (đủ ngưỡng);
//   đi muộn khi vào sau giờ vào ca + ngưỡng; về sớm khi ra trước giờ ra ca.
// - Thứ 7, Chủ nhật, ngày lễ: toàn bộ thời gian (trừ nghỉ trưa) là làm thêm, không xét đi muộn/về sớm.
// Chưa check-out (gioRa null) thì chưa có giờ công.
function tinhChiSoCong(ngay, gioVao, gioRa) {
  const ts = THAM_SO_CHAM_CONG;
  const vao = doiPhut(gioVao);
  const cuoiTuan = laNgayNghiChung(ngay); // T7, CN hoặc ngày lễ
  const ketQua = {
    soGioLamThucTe: 0,
    soGioLamThemOT: 0,
    diMuon: !cuoiTuan && vao > doiPhut(ts.gioVaoCa) + ts.nguongDiMuonPhut,
    veSom: false,
  };
  if (!gioRa) return ketQua;

  const ra = doiPhut(gioRa);
  const nghiTrua = chongLap(vao, ra, doiPhut(ts.batDauNghiTrua), doiPhut(ts.ketThucNghiTrua));
  if (cuoiTuan) {
    ketQua.soGioLamThemOT = lamTronGio(ra - vao - nghiTrua);
    return ketQua;
  }
  ketQua.soGioLamThucTe = lamTronGio(chongLap(vao, ra, doiPhut(ts.gioVaoCa), doiPhut(ts.gioRaCa)) - nghiTrua);
  const phutLamThem = ra - Math.max(vao, doiPhut(ts.gioRaCa));
  ketQua.soGioLamThemOT = phutLamThem >= ts.nguongLamThemPhut ? lamTronGio(phutLamThem) : 0;
  ketQua.veSom = ra < doiPhut(ts.gioRaCa);
  return ketQua;
}

module.exports = { tinhChiSoCong, laCuoiTuan, doiPhut };
