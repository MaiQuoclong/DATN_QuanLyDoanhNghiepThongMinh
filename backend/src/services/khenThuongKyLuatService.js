const LoiUngDung = require('../utils/LoiUngDung');
const { chayTransaction } = require('../config/ketNoiCsdl');
const ktklRepository = require('../repositories/khenThuongKyLuatRepository');
const phongBanRepository = require('../repositories/phongBanRepository');
const nhatKyRepository = require('../repositories/nhatKyRepository');
const { laNgayHopLe } = require('../middlewares/kiemTraDuLieu');
const { LOAI_QUYET_DINH } = require('../utils/trangThai');
const { ngayHomNay, khoangNgayCuaThang } = require('../utils/ngayThang');
const luongRepository = require('../repositories/luongRepository');
const luongService = require('./luongService');

// Luồng theo docs/phan-quyen.md mục 9:
// quanLy (PM, trừ mình) / giamDoc tạo đề xuất CHO_DUYET -> HR từ chối (TU_CHOI) hoặc lập quyết định
// (INSERT quyết định + đề xuất DA_DUYET trong một transaction) với người ký là một giamDoc.
// Schema không có cột trạng thái cho quyết định: bản ghi quyết định là quyết định đã ký, có hiệu lực
// và được cộng (+)/trừ (−) vào lương tháng có ngày ban hành.

const TRANG_THAI_DUOC_KTKL = ['THU_VIEC', 'CHINH_THUC'];
const SO_TIEN_TOI_DA = 9999999999999.99; // DECIMAL(15,2)

const laHR = (nd) => nd.vaiTro.includes('HR');
const laGiamDoc = (nd) => nd.vaiTro.includes('giamDoc');
const laQuanLy = (nd) => nd.vaiTro.includes('quanLy');

function canHoSo(nguoiDung) {
  if (!nguoiDung.nhanVienId) throw new LoiUngDung(403, 'Tài khoản chưa gắn hồ sơ nhân viên');
}

function layChuoi(giaTri, nhan, { batBuoc = false, toiThieu = 0, toiDa = 255 } = {}) {
  if (giaTri === undefined || giaTri === null || (typeof giaTri === 'string' && giaTri.trim() === '')) {
    if (batBuoc) throw new LoiUngDung(400, `${nhan} không được để trống`);
    return null;
  }
  if (typeof giaTri !== 'string') throw new LoiUngDung(400, `${nhan} phải là chuỗi ký tự`);
  const kq = giaTri.trim();
  if (kq.length < toiThieu) throw new LoiUngDung(400, `${nhan} phải có ít nhất ${toiThieu} ký tự`);
  if (kq.length > toiDa) throw new LoiUngDung(400, `${nhan} không được vượt quá ${toiDa} ký tự`);
  return kq;
}

function laySoTien(giaTri, nhan, macDinh = 0) {
  if (giaTri === undefined || giaTri === null || giaTri === '') return macDinh;
  if ((typeof giaTri !== 'number' && typeof giaTri !== 'string') || !/^\d{1,13}(\.\d{1,2})?$/.test(String(giaTri))) {
    throw new LoiUngDung(400, `${nhan} phải là số tiền không âm, tối đa 2 chữ số thập phân`);
  }
  const so = Number(giaTri);
  if (so > SO_TIEN_TOI_DA) throw new LoiUngDung(400, `${nhan} vượt quá giới hạn`);
  return so;
}

function layLoai(giaTri, nhan) {
  if (!LOAI_QUYET_DINH.includes(giaTri)) throw new LoiUngDung(400, `${nhan} phải là KHEN_THUONG hoặc KY_LUAT`);
  return giaTri;
}

function layIdNhanVien(giaTri, nhan) {
  if (!/^[1-9]\d{0,9}$/.test(String(giaTri ?? ''))) throw new LoiUngDung(400, `${nhan} phải là số nguyên dương`);
  return Number(giaTri);
}

const phamViQuanLy = (nguoiDung, ketNoi) => phongBanRepository.layPhongBanQuanLy(nguoiDung.nhanVienId ?? 0, ketNoi);

// ===================== Đề xuất =====================

// HR, giamDoc xem mọi đề xuất; quanLy chỉ đề xuất do mình tạo
function boLocDeXuatTheoQuyen(nguoiDung) {
  if (laHR(nguoiDung) || laGiamDoc(nguoiDung)) return {};
  return { nguoiDeXuatId: nguoiDung.nhanVienId ?? 0 };
}

async function layDanhSachDeXuat(nguoiDung, boLoc, phanTrang) {
  const { items, tongSo } = await ktklRepository.layDanhSachDeXuat({ ...boLoc, ...boLocDeXuatTheoQuyen(nguoiDung) }, phanTrang);
  return { items, phanTrang: { trang: phanTrang.trang, kichThuoc: phanTrang.kichThuoc, tongSo } };
}

function duocXemDeXuat(nguoiDung, deXuat) {
  return laHR(nguoiDung) || laGiamDoc(nguoiDung) || deXuat.nguoiDeXuatId === nguoiDung.nhanVienId;
}

async function layChiTietDeXuat(nguoiDung, id) {
  const deXuat = await ktklRepository.layDeXuatTheoId(id);
  if (!deXuat || !duocXemDeXuat(nguoiDung, deXuat)) throw new LoiUngDung(404, 'Không tìm thấy đề xuất');
  return deXuat;
}

// Kiểm tra nhân viên được đề xuất: đang làm việc, không phải chính mình, quanLy chỉ trong phòng mình
async function kiemTraNhanVienDuocDeXuat(nguoiDung, nhanVienId, ketNoi) {
  const nv = await ktklRepository.layNhanVienCoBan(nhanVienId, ketNoi);
  if (!nv) throw new LoiUngDung(404, 'Không tìm thấy nhân viên');
  if (laQuanLy(nguoiDung) && !laGiamDoc(nguoiDung)) {
    const phamVi = await phamViQuanLy(nguoiDung, ketNoi);
    if (nv.phongBanId == null || !phamVi.includes(nv.phongBanId)) throw new LoiUngDung(404, 'Không tìm thấy nhân viên');
  }
  if (nv.id === nguoiDung.nhanVienId) throw new LoiUngDung(400, 'Không thể đề xuất khen thưởng/kỷ luật cho chính mình');
  if (!TRANG_THAI_DUOC_KTKL.includes(nv.trangThaiLamViec)) {
    throw new LoiUngDung(409, `Nhân viên ${nv.maNhanVien} không còn làm việc, không thể đề xuất`);
  }
  return nv;
}

function docNoiDungDeXuat(body, cu = null) {
  const moi = {};
  if (!cu || body.loaiDeXuat !== undefined) moi.loaiDeXuat = layLoai(body.loaiDeXuat, 'Loại đề xuất');
  if (!cu || body.tieuDe !== undefined) moi.tieuDe = layChuoi(body.tieuDe, 'Tiêu đề', { batBuoc: true, toiThieu: 3, toiDa: 200 });
  if (!cu || body.lyDo !== undefined) moi.lyDo = layChuoi(body.lyDo, 'Lý do', { batBuoc: true, toiThieu: 3, toiDa: 5000 });
  if (!cu || body.soTienDeXuat !== undefined) moi.soTienDeXuat = laySoTien(body.soTienDeXuat, 'Số tiền đề xuất');
  return moi;
}

async function taoDeXuat(nguoiDung, body, diaChiIP) {
  canHoSo(nguoiDung);
  const nhanVienId = layIdNhanVien(body.nhanVienId, 'Nhân viên');
  const noiDung = docNoiDungDeXuat(body);
  return chayTransaction(async (ketNoi) => {
    const nv = await kiemTraNhanVienDuocDeXuat(nguoiDung, nhanVienId, ketNoi);
    const id = await ktklRepository.themDeXuat({ nguoiDeXuatId: nguoiDung.nhanVienId, nhanVienId, ...noiDung }, ketNoi);
    await nhatKyRepository.themNhatKy(
      nguoiDung.nguoiDungId,
      'TAO_DE_XUAT_KTKL',
      diaChiIP,
      `${noiDung.loaiDeXuat} ${nv.maNhanVien}: ${noiDung.tieuDe}`,
      ketNoi,
    );
    return ktklRepository.layDeXuatTheoId(id, ketNoi);
  });
}

// Khóa đề xuất còn CHO_DUYET do chính người dùng tạo (sửa/thu hồi)
async function khoaDeXuatCuaMinh(nguoiDung, id, ketNoi) {
  const dx = await ktklRepository.khoaDeXuat(id, ketNoi);
  if (!dx || !duocXemDeXuat(nguoiDung, dx)) throw new LoiUngDung(404, 'Không tìm thấy đề xuất');
  if (dx.nguoiDeXuatId !== nguoiDung.nhanVienId) throw new LoiUngDung(403, 'Chỉ người tạo được sửa hoặc thu hồi đề xuất');
  if (dx.trangThai !== 'CHO_DUYET') throw new LoiUngDung(409, 'Đề xuất đã được xử lý, không thể thay đổi');
  return dx;
}

async function suaDeXuat(nguoiDung, id, body, diaChiIP) {
  canHoSo(nguoiDung);
  const thayDoi = docNoiDungDeXuat(body, true);
  if (!Object.keys(thayDoi).length) throw new LoiUngDung(400, 'Không có thông tin nào thay đổi');
  return chayTransaction(async (ketNoi) => {
    const dx = await khoaDeXuatCuaMinh(nguoiDung, id, ketNoi);
    // Nhân viên có thể đã chuyển phòng/nghỉ việc sau khi tạo đề xuất: kiểm tra lại phạm vi
    await kiemTraNhanVienDuocDeXuat(nguoiDung, dx.nhanVienId, ketNoi);
    await ktklRepository.capNhatDeXuat(id, thayDoi, ketNoi);
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'SUA_DE_XUAT_KTKL', diaChiIP, `Đề xuất #${dx.id}`, ketNoi);
    return ktklRepository.layDeXuatTheoId(id, ketNoi);
  });
}

async function xoaDeXuat(nguoiDung, id, diaChiIP) {
  canHoSo(nguoiDung);
  return chayTransaction(async (ketNoi) => {
    const dx = await khoaDeXuatCuaMinh(nguoiDung, id, ketNoi);
    await ktklRepository.xoaDeXuat(id, ketNoi);
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'XOA_DE_XUAT_KTKL', diaChiIP, `Đề xuất #${dx.id}: ${dx.tieuDe}`, ketNoi);
  });
}

// HR khóa đề xuất CHO_DUYET để xử lý; không tự xử lý đề xuất về chính mình
async function khoaDeXuatChoXuLy(nguoiDung, id, ketNoi) {
  const dx = await ktklRepository.khoaDeXuat(id, ketNoi);
  if (!dx) throw new LoiUngDung(404, 'Không tìm thấy đề xuất');
  if (dx.trangThai !== 'CHO_DUYET') throw new LoiUngDung(409, 'Đề xuất đã được xử lý');
  if (dx.nhanVienId === nguoiDung.nhanVienId) throw new LoiUngDung(403, 'Không thể tự xử lý đề xuất về chính mình');
  return dx;
}

async function tuChoiDeXuat(nguoiDung, id, body, diaChiIP) {
  canHoSo(nguoiDung);
  const ghiChuXuLy = layChuoi(body?.ghiChuXuLy, 'Lý do từ chối', { batBuoc: true, toiThieu: 3, toiDa: 500 });
  return chayTransaction(async (ketNoi) => {
    const dx = await khoaDeXuatChoXuLy(nguoiDung, id, ketNoi);
    await ktklRepository.capNhatDeXuat(id, { trangThai: 'TU_CHOI', nguoiXuLyId: nguoiDung.nhanVienId, ghiChuXuLy }, ketNoi);
    await nhatKyRepository.themNhatKy(nguoiDung.nguoiDungId, 'TU_CHOI_DE_XUAT_KTKL', diaChiIP, `Đề xuất #${dx.id}`, ketNoi);
    return ktklRepository.layDeXuatTheoId(id, ketNoi);
  });
}

// ===================== Quyết định =====================

// null = toàn công ty (HR, giamDoc); quanLy: PM + của mình; nhanVien/Admin: chỉ của mình
async function layPhamViQuyetDinh(nguoiDung) {
  if (laHR(nguoiDung) || laGiamDoc(nguoiDung)) return null;
  const phongBanIds = laQuanLy(nguoiDung) ? await phamViQuanLy(nguoiDung) : [];
  return { phongBanIds, nhanVienId: nguoiDung.nhanVienId ?? 0 };
}

async function layDanhSachQuyetDinh(nguoiDung, boLoc, phanTrang) {
  const phamVi = await layPhamViQuyetDinh(nguoiDung);
  const { items, tongSo, thongKe } = await ktklRepository.layDanhSachQuyetDinh({ ...boLoc, phamVi }, phanTrang);
  return { items, thongKe, phanTrang: { trang: phanTrang.trang, kichThuoc: phanTrang.kichThuoc, tongSo } };
}

async function layChiTietQuyetDinh(nguoiDung, id) {
  const qd = await ktklRepository.layQuyetDinhTheoId(id);
  const phamVi = await layPhamViQuyetDinh(nguoiDung);
  const duocXem =
    qd && (phamVi === null || qd.nhanVienId === phamVi.nhanVienId || (qd.phongBanId != null && phamVi.phongBanIds.includes(qd.phongBanId)));
  if (!duocXem) throw new LoiUngDung(404, 'Không tìm thấy quyết định');
  return qd;
}

const layDanhSachNguoiKy = () => ktklRepository.layDanhSachNguoiKy();

// Quyết định cộng/trừ vào lương tháng ban hành: khóa bảng lương của tháng (nếu có) để chặn gửi duyệt đồng thời.
// Tháng đã gửi/duyệt lương thì không ban hành được nữa; bảng còn nháp được tính lại sau khi ghi quyết định.
async function khoaThangLuong(ngayBanHanh, ketNoi) {
  const [nam, thang] = ngayBanHanh.split('-').map(Number);
  const bang = await ktklRepository.khoaBangLuongTheoThang(thang, nam, ketNoi);
  if (bang && bang.trangThai !== 'BAN_NHAP') {
    throw new LoiUngDung(409, `Bảng lương tháng ${thang}/${nam} đã gửi duyệt hoặc đã duyệt, hãy chọn ngày ban hành ở tháng sau`);
  }
  return bang;
}

// Ngày ban hành không vượt quá cuối tháng hiện tại (tránh chiếm dãy số năm sau và khoản tiền treo)
function kiemTraNgayBanHanh(ngayBanHanh) {
  const homNay = ngayHomNay();
  const [nam, thang] = homNay.split('-').map(Number);
  const cuoiThang = new Date(Date.UTC(nam, thang, 0)).toISOString().slice(0, 10);
  if (ngayBanHanh > cuoiThang) throw new LoiUngDung(400, 'Ngày ban hành không được sau tháng hiện tại');
}

// Người ký phải là giamDoc đang làm việc và không phải người nhận quyết định
async function kiemTraNguoiKy(nguoiKyDuyetId, nhanVienId, ketNoi) {
  const nk = await ktklRepository.layNhanVienCoBan(nguoiKyDuyetId, ketNoi);
  if (!nk || !nk.laGiamDoc || !TRANG_THAI_DUOC_KTKL.includes(nk.trangThaiLamViec) || nk.trangThaiTaiKhoan !== 'DANG_HOAT_DONG') {
    throw new LoiUngDung(400, 'Người ký phải là Giám đốc đang làm việc');
  }
  if (nk.id === nhanVienId) throw new LoiUngDung(400, 'Người ký không được là người nhận quyết định');
  return nk;
}

function docNoiDungQuyetDinh(body, macDinh = {}) {
  const ngayBanHanh = body.ngayBanHanh;
  if (typeof ngayBanHanh !== 'string' || !laNgayHopLe(ngayBanHanh)) {
    throw new LoiUngDung(400, 'Ngày ban hành phải là ngày hợp lệ dạng YYYY-MM-DD');
  }
  kiemTraNgayBanHanh(ngayBanHanh);
  const soQuyetDinh = layChuoi(body.soQuyetDinh, 'Số quyết định', { toiThieu: 3, toiDa: 50 });
  return {
    soQuyetDinh,
    loaiQuyetDinh: macDinh.loaiQuyetDinh ?? layLoai(body.loaiQuyetDinh, 'Loại quyết định'),
    tieuDe: layChuoi(body.tieuDe ?? macDinh.tieuDe, 'Tiêu đề', { batBuoc: true, toiThieu: 3, toiDa: 200 }),
    lyDo: layChuoi(body.lyDo ?? macDinh.lyDo, 'Lý do', { batBuoc: true, toiThieu: 3, toiDa: 5000 }),
    soTien: laySoTien(body.soTien, 'Số tiền', macDinh.soTien ?? 0),
    ngayBanHanh,
  };
}

// Ghi quyết định (dùng chung cho lập từ đề xuất và lập trực tiếp), trong transaction của người gọi
// Số tự sinh trùng do hai request đồng thời (năm chưa có số nào nên FOR UPDATE không khóa được dòng): sinh lại vài lần.
// Mỗi lần INSERT lỗi trùng khóa chỉ hủy câu lệnh đó, transaction vẫn tiếp tục được.
const SO_LAN_THU_SINH_SO = 3;

async function ghiQuyetDinh(nguoiDung, noiDung, nhanVienId, nguoiKyDuyetId, diaChiIP, ketNoi) {
  const bangNhap = await khoaThangLuong(noiDung.ngayBanHanh, ketNoi);
  let id;
  let soQuyetDinh;
  for (let lan = 1; !id; lan += 1) {
    soQuyetDinh = noiDung.soQuyetDinh ?? (await ktklRepository.laySoQuyetDinhTiepTheo(noiDung.ngayBanHanh.slice(0, 4), ketNoi));
    try {
      id = await ktklRepository.themQuyetDinh({ ...noiDung, soQuyetDinh, nhanVienId, nguoiKyDuyetId }, ketNoi);
    } catch (loi) {
      if (loi.code !== 'ER_DUP_ENTRY') throw loi;
      if (noiDung.soQuyetDinh || lan >= SO_LAN_THU_SINH_SO) throw new LoiUngDung(409, `Số quyết định ${soQuyetDinh} đã tồn tại`);
    }
  }
  // Bảng lương tháng ban hành còn nháp: cộng/trừ ngay khoản tiền vào phiếu của người nhận (giữ chỉnh sửa tay của HR)
  let canhBao = null;
  if (bangNhap) {
    const soTienThem = noiDung.loaiQuyetDinh === 'KY_LUAT' ? -noiDung.soTien : noiDung.soTien;
    const kq = await luongService.congThuongPhatVaoPhieuNhap(bangNhap, nhanVienId, soTienThem, ketNoi);
    if (kq) {
      // Hành động riêng: không tính là "tham gia lập bảng" (daThamGiaLapBang), giamDoc lập quyết định vẫn duyệt được bảng
      await nhatKyRepository.themNhatKy(
        nguoiDung.nguoiDungId,
        'TINH_LAI_BANG_LUONG_KTKL',
        diaChiIP,
        `${bangNhap.maBangLuong} ${kq.maNhanVien}: thuongKPI ${kq.thuongCu} -> ${kq.thuongMoi} (áp dụng ${soQuyetDinh})`.slice(0, 1000),
        ketNoi,
      );
      canhBao = `Đã cập nhật phiếu lương của ${kq.maNhanVien} trong bảng lương nháp ${bangNhap.maBangLuong}`;
      // Phạt vượt thu nhập: phần vượt bị bỏ để thực lĩnh không âm, báo cho HR biết phạt không trừ đủ
      if (kq.phatBiCat) canhBao += `. Lưu ý phạt vượt thu nhập bị bỏ: ${kq.maNhanVien} ${kq.phatBiCat}`;
    }
  }
  // Lương chỉ tính cho người có hợp đồng hiệu lực trong tháng: không có thì khoản tiền không vào phiếu nào
  if (noiDung.soTien > 0) {
    const { tuNgay, denNgay } = khoangNgayCuaThang(noiDung.ngayBanHanh.slice(0, 7));
    if (!(await luongRepository.layNhanVienTinhLuong(tuNgay, denNgay, ketNoi, nhanVienId)).length) {
      canhBao = [canhBao, 'Nhân viên không có hợp đồng hiệu lực trong tháng ban hành nên số tiền sẽ không được tính vào lương']
        .filter(Boolean)
        .join('. ');
    }
  }
  return { id, soQuyetDinh, canhBao };
}

// HR lập quyết định từ đề xuất: INSERT quyết định + UPDATE đề xuất DA_DUYET (một transaction)
async function lapQuyetDinhTuDeXuat(nguoiDung, id, body, diaChiIP) {
  canHoSo(nguoiDung);
  const nguoiKyDuyetId = layIdNhanVien(body?.nguoiKyDuyetId, 'Người ký');
  const ghiChuXuLy = layChuoi(body?.ghiChuXuLy, 'Ghi chú xử lý', { toiDa: 500 });
  return chayTransaction(async (ketNoi) => {
    const dx = await khoaDeXuatChoXuLy(nguoiDung, id, ketNoi);
    const noiDung = docNoiDungQuyetDinh(body ?? {}, {
      loaiQuyetDinh: dx.loaiDeXuat,
      tieuDe: dx.tieuDe,
      lyDo: dx.lyDo,
      soTien: dx.soTienDeXuat,
    });
    const nv = await ktklRepository.layNhanVienCoBan(dx.nhanVienId, ketNoi);
    if (!nv) throw new LoiUngDung(404, 'Không tìm thấy nhân viên');
    if (!TRANG_THAI_DUOC_KTKL.includes(nv.trangThaiLamViec)) {
      throw new LoiUngDung(409, `Nhân viên ${nv.maNhanVien} không còn làm việc, hãy từ chối đề xuất`);
    }
    await kiemTraNguoiKy(nguoiKyDuyetId, dx.nhanVienId, ketNoi);
    const {
      id: quyetDinhId,
      soQuyetDinh,
      canhBao,
    } = await ghiQuyetDinh(nguoiDung, noiDung, dx.nhanVienId, nguoiKyDuyetId, diaChiIP, ketNoi);
    await ktklRepository.capNhatDeXuat(
      id,
      {
        trangThai: 'DA_DUYET',
        quyetDinhId,
        nguoiXuLyId: nguoiDung.nhanVienId,
        ghiChuXuLy,
      },
      ketNoi,
    );
    await nhatKyRepository.themNhatKy(
      nguoiDung.nguoiDungId,
      'LAP_QUYET_DINH_KTKL',
      diaChiIP,
      `${soQuyetDinh} (${noiDung.loaiQuyetDinh} ${nv.maNhanVien}, ${noiDung.soTien}) từ đề xuất #${dx.id}`,
      ketNoi,
    );
    return { quyetDinh: await ktklRepository.layQuyetDinhTheoId(quyetDinhId, ketNoi), canhBao };
  });
}

// Lập quyết định trực tiếp: HR chọn giamDoc ký; giamDoc tự ký
async function taoQuyetDinh(nguoiDung, body, diaChiIP) {
  canHoSo(nguoiDung);
  const nhanVienId = layIdNhanVien(body?.nhanVienId, 'Nhân viên');
  const noiDung = docNoiDungQuyetDinh(body ?? {});
  const nguoiKyDuyetId = laHR(nguoiDung) ? layIdNhanVien(body.nguoiKyDuyetId, 'Người ký') : nguoiDung.nhanVienId;
  return chayTransaction(async (ketNoi) => {
    const nv = await ktklRepository.layNhanVienCoBan(nhanVienId, ketNoi);
    if (!nv) throw new LoiUngDung(404, 'Không tìm thấy nhân viên');
    if (nv.id === nguoiDung.nhanVienId) throw new LoiUngDung(400, 'Không thể lập quyết định cho chính mình');
    if (!TRANG_THAI_DUOC_KTKL.includes(nv.trangThaiLamViec)) {
      throw new LoiUngDung(409, `Nhân viên ${nv.maNhanVien} không còn làm việc`);
    }
    await kiemTraNguoiKy(nguoiKyDuyetId, nhanVienId, ketNoi);
    const { id, soQuyetDinh, canhBao } = await ghiQuyetDinh(nguoiDung, noiDung, nhanVienId, nguoiKyDuyetId, diaChiIP, ketNoi);
    await nhatKyRepository.themNhatKy(
      nguoiDung.nguoiDungId,
      'LAP_QUYET_DINH_KTKL',
      diaChiIP,
      `${soQuyetDinh} (${noiDung.loaiQuyetDinh} ${nv.maNhanVien}, ${noiDung.soTien})`,
      ketNoi,
    );
    return { quyetDinh: await ktklRepository.layQuyetDinhTheoId(id, ketNoi), canhBao };
  });
}

module.exports = {
  layDanhSachDeXuat,
  layChiTietDeXuat,
  taoDeXuat,
  suaDeXuat,
  xoaDeXuat,
  tuChoiDeXuat,
  lapQuyetDinhTuDeXuat,
  layDanhSachQuyetDinh,
  layChiTietQuyetDinh,
  layDanhSachNguoiKy,
  taoQuyetDinh,
};
