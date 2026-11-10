const { THAM_SO_LUONG, THAM_SO_KPI } = require('../config/thamSoNghiepVu');
const { layNgayLamViec } = require('./tinhNgayNghi');
const { laCuoiTuan, laNgayLe } = require('./ngayLe');

// Hệ số làm thêm theo loại ngày của bản ghi chấm công (Điều 98)
function heSoLamThemCuaNgay(ngay) {
  if (laNgayLe(ngay)) return THAM_SO_LUONG.heSoLamThemNgayLe;
  if (laCuoiTuan(ngay)) return THAM_SO_LUONG.heSoLamThemCuoiTuan;
  return THAM_SO_LUONG.heSoLamThem;
}

// Giờ làm thêm quy đổi = Σ giờ OT × hệ số của ngày; banGhi: [{ ngayChamCong, soGioLamThemOT }]
function tinhGioLamThemQuyDoi(banGhi) {
  return banGhi.reduce((tong, b) => tong + Number(b.soGioLamThemOT) * heSoLamThemCuaNgay(b.ngayChamCong), 0);
}
const { khoangNgayCuaThang } = require('./ngayThang');

const lamTronDong = (so) => Math.round(so);

// Số ngày công chuẩn của tháng = số ngày thứ 2 - thứ 6 trừ ngày lễ (cùng quy ước module chấm công)
function demNgayCongChuan(thang) {
  const { tuNgay, denNgay } = khoangNgayCuaThang(thang);
  return layNgayLamViec(tuNgay, denNgay).length;
}

// Ngày công thực tế: duyệt từng ngày làm việc trong tháng
//  - có đơn nghỉ cả ngày DA_DUYET: loại có lương tính 1 công, không lương 0
//  - có đơn nghỉ nửa ngày: mỗi đơn 0.5 (có lương mới tính) + buổi còn lại 0.5 nếu có bản ghi chấm công
//    (2 đơn nửa ngày sáng + chiều thì không còn buổi làm)
//  - còn lại: có bản ghi chấm công tính 1 công
// cacNgayChamCong: Set 'YYYY-MM-DD'; cacDonNghi: [{ ngayBatDau, ngayKetThuc, soNgayNghi, coLuong }]
function tinhNgayCong(thang, cacNgayChamCong, cacDonNghi) {
  const { tuNgay, denNgay } = khoangNgayCuaThang(thang);
  const ngayChuan = layNgayLamViec(tuNgay, denNgay);
  let cong = 0;
  for (const ngay of ngayChuan) {
    const cacDon = cacDonNghi.filter((d) => d.ngayBatDau <= ngay && ngay <= d.ngayKetThuc);
    const coChamCong = cacNgayChamCong.has(ngay);
    const caNgay = cacDon.find((d) => Number(d.soNgayNghi) >= 1);
    if (caNgay) cong += caNgay.coLuong ? 1 : 0;
    else {
      // 0, 1 hoặc 2 đơn nửa ngày: mỗi đơn có lương 0.5; buổi còn lại (nếu còn) có chấm công thì 0.5
      const nuaNgayCoLuong = cacDon.filter((d) => d.coLuong).length * 0.5;
      const buoiConLai = 1 - cacDon.length * 0.5;
      cong += nuaNgayCoLuong + (coChamCong ? (cacDon.length === 0 ? 1 : buoiConLai) : 0);
    }
  }
  return Math.min(cong, ngayChuan.length);
}

// Số ngày không có công (nghỉ không lương, chưa vào làm, nghỉ việc) >= 14 thì không đóng bảo hiểm tháng đó.
// Khi có đóng, số công còn lại luôn >= công chuẩn - 13 nên lương theo công (>= ~30%) luôn lớn hơn 10.5% bảo hiểm.
function tinhBaoHiem(luongCoBan, soNgayCong, ngayCongChuan) {
  if (ngayCongChuan - soNgayCong >= THAM_SO_LUONG.soNgayNghiKhongDongBaoHiem) return 0;
  const { bhxh, bhyt, bhtn } = THAM_SO_LUONG.tyLeBaoHiem;
  const mucDong = Math.min(luongCoBan, THAM_SO_LUONG.mucTranDongBaoHiem);
  return lamTronDong(mucDong * (bhxh + bhyt + bhtn));
}

// Thuế TNCN lũy tiến từng phần trên thu nhập tính thuế (đã trừ bảo hiểm và giảm trừ bản thân)
function tinhThueTNCN(thuNhapTinhThue) {
  if (thuNhapTinhThue <= 0) return 0;
  let thue = 0;
  let mucDuoi = 0;
  for (const [mucTren, thueSuat] of THAM_SO_LUONG.bieuThueTNCN) {
    if (thuNhapTinhThue <= mucDuoi) break;
    thue += (Math.min(thuNhapTinhThue, mucTren) - mucDuoi) * thueSuat;
    mucDuoi = mucTren;
  }
  return lamTronDong(thue);
}

// Phiếu lương lưu các khoản thành phần; các số dẫn xuất (lương theo công, tổng thu nhập, thực lĩnh)
// luôn tính lại từ đây để mọi màn hình/Excel thống nhất.
// thuongKPI: khoản thưởng/phạt trong tháng (thưởng KPI + khen thưởng − kỷ luật), có thể âm.
function tinhChiTietPhieu(phieu, ngayCongChuan) {
  const luongCoBan = Number(phieu.luongCoBan);
  const soNgayCong = Number(phieu.soNgayCongThucTe);
  const luongTheoCong = ngayCongChuan ? lamTronDong((luongCoBan * soNgayCong) / ngayCongChuan) : 0;
  const luongLamThemOT = Number(phieu.luongLamThemOT);
  const thuongKPI = Number(phieu.thuongKPI);
  const tongPhuCap = Number(phieu.tongPhuCap);
  const khauTruBaoHiem = Number(phieu.khauTruBaoHiem);
  const khauTruThueTNCN = Number(phieu.khauTruThueTNCN);
  const tongThuNhap = luongTheoCong + luongLamThemOT + thuongKPI + tongPhuCap;
  return {
    ngayCongChuan,
    luongTheoCong,
    tongThuNhap,
    thucLinh: tongThuNhap - khauTruBaoHiem - khauTruThueTNCN,
  };
}

// Thuế tính trên tổng thu nhập hiện tại của phiếu (gọi lại sau mỗi lần HR sửa khoản thu nhập)
function tinhThueChoPhieu(phieu, ngayCongChuan) {
  const { tongThuNhap } = tinhChiTietPhieu({ ...phieu, khauTruThueTNCN: 0 }, ngayCongChuan);
  return tinhThueTNCN(tongThuNhap - Number(phieu.khauTruBaoHiem) - THAM_SO_LUONG.giamTruBanThan);
}

// Phụ cấp theo hợp đồng chia theo ngày công thực tế
function tinhPhuCap(mucPhuCap, soNgayCong, ngayCongChuan) {
  return ngayCongChuan ? lamTronDong((mucPhuCap * soNgayCong) / ngayCongChuan) : 0;
}

// Đặt khoản thưởng/phạt (cột thuongKPI) cho phiếu rồi tính lại thuế. Dùng khi lập phiếu và khi cộng dồn vào phiếu nháp.
// Quy ước đồ án: phạt kỷ luật trừ thẳng vào thu nhập (kể cả thu nhập tính thuế) và không làm thực lĩnh âm;
// phần phạt vượt (thu nhập − bảo hiểm) bị bỏ, ghi ở phatBiCat (số dương) để service ghi nhật ký/cảnh báo.
function apThuongPhat(phieu, thuongPhat, ngayCongChuan) {
  const truocThuong = tinhChiTietPhieu({ ...phieu, thuongKPI: 0, khauTruThueTNCN: 0 }, ngayCongChuan).thucLinh;
  const thuongPhatLamTron = lamTronDong(thuongPhat);
  const thuongKPI = Math.max(thuongPhatLamTron, -Math.max(0, truocThuong));
  const ketQua = { ...phieu, thuongKPI, phatBiCat: thuongKPI - thuongPhatLamTron };
  ketQua.khauTruThueTNCN = tinhThueChoPhieu(ketQua, ngayCongChuan);
  return ketQua;
}

// Sinh phiếu nháp từ hợp đồng + công + OT + thưởng/phạt.
// gioLamThemQuyDoi (đã nhân hệ số theo loại ngày, xem tinhGioLamThemQuyDoi); không truyền thì tongGioLamThem × 150%
function lapPhieu({ luongCoBan, mucPhuCap, soNgayCongThucTe, tongGioLamThem = 0, gioLamThemQuyDoi, thuongPhat }, ngayCongChuan) {
  const donGiaGio = ngayCongChuan ? luongCoBan / ngayCongChuan / THAM_SO_LUONG.soGioCongMotNgay : 0;
  const phieu = {
    soNgayCongThucTe,
    luongCoBan,
    luongLamThemOT: lamTronDong((gioLamThemQuyDoi ?? tongGioLamThem * THAM_SO_LUONG.heSoLamThem) * donGiaGio),
    thuongKPI: 0,
    tongPhuCap: tinhPhuCap(mucPhuCap, soNgayCongThucTe, ngayCongChuan),
    khauTruBaoHiem: tinhBaoHiem(luongCoBan, soNgayCongThucTe, ngayCongChuan),
  };
  return apThuongPhat(phieu, thuongPhat, ngayCongChuan);
}

// Số tháng dương lịch kỳ KPI trải qua (quý 01/01-31/03 -> 3); tối thiểu 1
function demSoThangKy(ngayBatDau, ngayKetThuc) {
  const [n1, t1] = String(ngayBatDau).split('-').map(Number);
  const [n2, t2] = String(ngayKetThuc).split('-').map(Number);
  return Math.max(1, (n2 - n1) * 12 + (t2 - t1) + 1);
}

// Thưởng KPI một phiếu đã nghiệm thu: K(xếp loại) × lương HĐ × tỷ lệ mục tiêu × số tháng kỳ, làm tròn đồng
function tinhThuongKpi(xepLoai, luongCoBan, soThangKy) {
  const heSo = THAM_SO_KPI.heSoThuong[xepLoai] ?? 0;
  return lamTronDong(heSo * Number(luongCoBan) * THAM_SO_KPI.tyLeThuongMucTieu * soThangKy);
}

module.exports = {
  demSoThangKy,
  tinhThuongKpi,
  demNgayCongChuan,
  tinhNgayCong,
  tinhBaoHiem,
  tinhPhuCap,
  tinhThueTNCN,
  tinhChiTietPhieu,
  tinhThueChoPhieu,
  lapPhieu,
  apThuongPhat,
  heSoLamThemCuaNgay,
  tinhGioLamThemQuyDoi,
};
