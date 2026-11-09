const { THAM_SO_LUONG, THAM_SO_KPI } = require('../config/thamSoNghiepVu');
const { layNgayLamViec } = require('./tinhNgayNghi');
const { khoangNgayCuaThang } = require('./ngayThang');

const lamTronDong = (so) => Math.round(so);

// Số ngày công chuẩn của tháng = số ngày thứ 2 - thứ 6 (chưa trừ ngày lễ, cùng quy ước module chấm công)
function demNgayCongChuan(thang) {
  const { tuNgay, denNgay } = khoangNgayCuaThang(thang);
  return layNgayLamViec(tuNgay, denNgay).length;
}

// Ngày công thực tế: duyệt từng ngày làm việc trong tháng
//  - có đơn nghỉ cả ngày DA_DUYET: loại có lương tính 1 công, không lương 0
//  - có đơn nghỉ nửa ngày: phần nghỉ 0.5 (có lương mới tính) + 0.5 nếu có bản ghi chấm công
//  - còn lại: có bản ghi chấm công tính 1 công
// cacNgayChamCong: Set 'YYYY-MM-DD'; cacDonNghi: [{ ngayBatDau, ngayKetThuc, soNgayNghi, coLuong }]
function tinhNgayCong(thang, cacNgayChamCong, cacDonNghi) {
  const { tuNgay, denNgay } = khoangNgayCuaThang(thang);
  const ngayChuan = layNgayLamViec(tuNgay, denNgay);
  let cong = 0;
  for (const ngay of ngayChuan) {
    const don = cacDonNghi.find((d) => d.ngayBatDau <= ngay && ngay <= d.ngayKetThuc);
    const coChamCong = cacNgayChamCong.has(ngay);
    if (!don) cong += coChamCong ? 1 : 0;
    else if (Number(don.soNgayNghi) < 1) cong += (don.coLuong ? 0.5 : 0) + (coChamCong ? 0.5 : 0);
    else cong += don.coLuong ? 1 : 0;
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

// Sinh phiếu nháp từ hợp đồng + công + OT + thưởng/phạt
function lapPhieu({ luongCoBan, mucPhuCap, soNgayCongThucTe, tongGioLamThem, thuongPhat }, ngayCongChuan) {
  const donGiaGio = ngayCongChuan ? luongCoBan / ngayCongChuan / THAM_SO_LUONG.soGioCongMotNgay : 0;
  const phieu = {
    soNgayCongThucTe,
    luongCoBan,
    luongLamThemOT: lamTronDong(tongGioLamThem * donGiaGio * THAM_SO_LUONG.heSoLamThem),
    thuongKPI: 0,
    tongPhuCap: tinhPhuCap(mucPhuCap, soNgayCongThucTe, ngayCongChuan),
    khauTruBaoHiem: tinhBaoHiem(luongCoBan, soNgayCongThucTe, ngayCongChuan),
  };
  // Quy ước đồ án: phạt kỷ luật trừ thẳng vào thu nhập (kể cả thu nhập tính thuế) và không làm thực lĩnh âm;
  // phần phạt vượt (thu nhập − bảo hiểm) bị bỏ, ghi ở phatBiCat để service ghi nhật ký.
  const truocThuong = tinhChiTietPhieu({ ...phieu, khauTruThueTNCN: 0 }, ngayCongChuan).thucLinh;
  const thuongPhatLamTron = lamTronDong(thuongPhat);
  phieu.thuongKPI = Math.max(thuongPhatLamTron, -Math.max(0, truocThuong));
  phieu.phatBiCat = phieu.thuongKPI - thuongPhatLamTron;
  phieu.khauTruThueTNCN = tinhThueChoPhieu(phieu, ngayCongChuan);
  return phieu;
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

module.exports = { demSoThangKy, tinhThuongKpi, demNgayCongChuan, tinhNgayCong, tinhBaoHiem, tinhPhuCap, tinhThueTNCN, tinhChiTietPhieu, tinhThueChoPhieu, lapPhieu };
