const nghiPhepService = require('./nghiPhepService');
const chamCongService = require('./chamCongService');
const khenThuongKyLuatService = require('./khenThuongKyLuatService');
const kpiService = require('./kpiService');
const hopDongService = require('./hopDongService');

// Chuông "Việc cần chú ý": chỉ đếm việc người dùng hiện tại thực sự xử lý được.
// Tái dùng service sẵn có để quy tắc chuỗi duyệt / phạm vi phòng ban chỉ nằm một chỗ.
const SO_NGAY_CANH_BAO_HOP_DONG = 30;
// Đếm nội bộ (không qua phân trang API): đủ lớn với quy mô doanh nghiệp của đồ án
const SO_BAN_GHI_TOI_DA = 1000;
const TRANG_DAU = { trang: 1, kichThuoc: SO_BAN_GHI_TOI_DA };

const coVaiTro = (nguoiDung, ...vaiTro) => vaiTro.some((v) => nguoiDung.vaiTro.includes(v));
const coHoSo = (nguoiDung) => Boolean(nguoiDung.nhanVienId);

// Kết quả đếm: số, hoặc { soLuong, vuotTran } khi đếm qua danh sách bị chặn ở SO_BAN_GHI_TOI_DA
function demQuaDanhSach({ items, phanTrang }, loc) {
  return { soLuong: items.filter(loc).length, vuotTran: phanTrang.tongSo > SO_BAN_GHI_TOI_DA };
}

// Mỗi nguồn: điều kiện áp dụng + hàm đếm. Một nguồn lỗi không làm hỏng cả chuông.
const NGUON = [
  {
    loai: 'DON_NGHI_CHO_DUYET',
    tieuDe: 'Đơn nghỉ phép chờ duyệt',
    duongDan: '/nghiPhep/duyetDon',
    apDung: (nd) => coHoSo(nd) && coVaiTro(nd, 'giamDoc', 'quanLy'),
    dem: async (nd) => {
      // Quyền duyệt phụ thuộc chuỗi phòng ban (xacDinhNguoiDuyet) -> đếm qua danh sách, không COUNT SQL
      const ds = await nghiPhepService.layDanhSachDon(nd, { trangThai: 'CHO_DUYET', ...TRANG_DAU });
      return demQuaDanhSach(ds, (d) => d.duocDuyet);
    },
  },
  {
    loai: 'DIEU_CHINH_CONG_CHO_DUYET',
    tieuDe: 'Yêu cầu điều chỉnh công chờ duyệt',
    duongDan: '/chamCong/dieuChinh',
    apDung: (nd) => coHoSo(nd) && coVaiTro(nd, 'giamDoc', 'quanLy', 'HR'),
    dem: (nd) => chamCongService.demYeuCauChoDuyet(nd),
  },
  {
    loai: 'DE_XUAT_CHO_XU_LY',
    tieuDe: 'Đề xuất khen thưởng - kỷ luật chờ xử lý',
    duongDan: '/khenThuongKyLuat/deXuat',
    // HR không xử lý đề xuất về chính mình (khoaDeXuatChoXuLy trả 403); tài khoản chưa có hồ sơ không xử lý được
    apDung: (nd) => coHoSo(nd) && coVaiTro(nd, 'HR'),
    dem: (nd) => khenThuongKyLuatService.demDeXuat(nd, { trangThai: 'CHO_DUYET', boQuaNhanVienId: nd.nhanVienId }),
  },
  {
    loai: 'DE_XUAT_CHO_KY',
    tieuDe: 'Đề xuất khen thưởng - kỷ luật chờ bạn ký',
    duongDan: '/khenThuongKyLuat/deXuat',
    apDung: (nd) => coHoSo(nd) && coVaiTro(nd, 'giamDoc'),
    // Chỉ đề xuất HR trình cho chính Giám đốc này (nguoiXuLyId); không tự ký quyết định về mình
    dem: (nd) => khenThuongKyLuatService.demDeXuat(nd, { trangThai: 'CHO_KY', nguoiXuLyId: nd.nhanVienId, boQuaNhanVienId: nd.nhanVienId }),
  },
  {
    loai: 'KPI_CAN_TU_CHAM',
    tieuDe: 'Phiếu KPI cần tự chấm',
    duongDan: '/kpi',
    apDung: coHoSo,
    dem: async (nd) => {
      const ds = await kpiService.layPhieuCuaToi(nd, { trangThai: 'BAN_NHAP' });
      return ds.filter((p) => p.trangThai === 'BAN_NHAP' && p.trangThaiKy === 'DANG_MO').length;
    },
  },
  {
    loai: 'KPI_CAN_NGHIEM_THU',
    tieuDe: 'Phiếu KPI chờ nghiệm thu',
    duongDan: '/kpi/danhGia',
    apDung: (nd) => coHoSo(nd) && coVaiTro(nd, 'giamDoc', 'quanLy'),
    dem: async (nd) => {
      const ds = await kpiService.layDanhSachPhieu(nd, { trangThai: 'CHO_DUYET', ...TRANG_DAU });
      return demQuaDanhSach(ds, (p) => p.duocNghiemThu);
    },
  },
  {
    loai: 'HOP_DONG_SAP_HET_HAN',
    tieuDe: `Hợp đồng sắp hết hạn / quá hạn (${SO_NGAY_CANH_BAO_HOP_DONG} ngày)`,
    duongDan: '/nhanSu/hopDong',
    apDung: (nd) => coVaiTro(nd, 'HR', 'giamDoc'),
    dem: async (nd) => {
      const ds = await hopDongService.laySapHetHan(SO_NGAY_CANH_BAO_HOP_DONG);
      // HR thuần không gia hạn hợp đồng của chính mình (docs/phan-quyen.md) -> không tính
      const boQuaCuaMinh = !coVaiTro(nd, 'giamDoc');
      return ds.filter((hd) => !boQuaCuaMinh || hd.nhanVienId !== nd.nhanVienId).length;
    },
  },
];

// theoLoai: mọi nguồn áp dụng cho vai trò (0 nếu không có việc, null nếu nguồn lỗi) -> trang Tổng quan
// đọc cùng nguồn với chuông nên số luôn khớp; items chỉ gồm loại có việc (> 0).
async function layViecCanChuY(nguoiDung) {
  const nguonApDung = NGUON.filter((n) => n.apDung(nguoiDung));
  const ketQua = await Promise.allSettled(nguonApDung.map((n) => n.dem(nguoiDung)));
  const items = [];
  const nguonLoi = [];
  const vuotTran = [];
  const theoLoai = {};
  ketQua.forEach((kq, i) => {
    const { loai, tieuDe, duongDan } = nguonApDung[i];
    if (kq.status === 'rejected') {
      nguonLoi.push(loai);
      theoLoai[loai] = null;
      console.error(`[viecCanChuY] Lỗi nguồn ${loai}:`, kq.reason?.message ?? kq.reason);
      return;
    }
    const soLuong = typeof kq.value === 'number' ? kq.value : kq.value.soLuong;
    if (typeof kq.value === 'object' && kq.value.vuotTran) vuotTran.push(loai);
    theoLoai[loai] = soLuong;
    if (soLuong > 0) items.push({ loai, tieuDe, soLuong, duongDan });
  });
  return {
    tongSo: items.reduce((tong, m) => tong + m.soLuong, 0),
    items,
    nguonLoi,
    theoLoai,
    vuotTran,
    soNgayCanhBaoHopDong: SO_NGAY_CANH_BAO_HOP_DONG,
  };
}

module.exports = { layViecCanChuY, SO_NGAY_CANH_BAO_HOP_DONG, SO_BAN_GHI_TOI_DA };
