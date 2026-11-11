const LoiUngDung = require('../utils/LoiUngDung');
const aiClientService = require('./aiClientService');
const phienTroChuyenRepository = require('../repositories/phienTroChuyenRepository');
const taiLieuQuyCheRepository = require('../repositories/taiLieuQuyCheRepository');
const nghiPhepService = require('./nghiPhepService');
const chamCongService = require('./chamCongService');
const ghiNhatKy = require('../utils/ghiNhatKy');
const { ngayHomNay } = require('../utils/ngayThang');
const { tinhSoNgayNghi } = require('../utils/tinhNgayNghi');

// Trợ lý AI hỏi đáp quy chế (RAG). MySQL giữ phiên (chủ sở hữu, tiêu đề); nội dung tin nhắn ở SQLite của ai-service.
const TIEU_DE_MAC_DINH = 'Cuộc trò chuyện mới';
const DO_DAI_TIEU_DE = 150;

// Khóa phụ của phiên bên ai-service: id phiên bị dùng lại sau `npm run khoiTaoCsdl` (AUTO_INCREMENT đếm lại)
// thì nguoiDungId/thoiGianTao khác → không đọc nhầm lịch sử của phiên cũ cùng id.
// Ràng buộc: thoiGianTao là chuỗi 'YYYY-MM-DD HH:mm:ss' nhờ `dateStrings: true` (config/ketNoiCsdl.js).
// Bỏ cấu hình đó thì giá trị thành Date (chuỗi phụ thuộc múi giờ) → dauPhien đổi, mất toàn bộ lịch sử cũ.
function layDauPhien(phien) {
  return `${phien.nguoiDungId}|${String(phien.thoiGianTao).slice(0, 19)}`;
}

// Khóa so khớp tài liệu theo cả id và mã (id có thể bị cấp lại cho tài liệu khác sau khoiTaoCsdl)
const khoaTaiLieu = (id, maTaiLieu) => `${id}|${maTaiLieu}`;

// Cùng giá trị aiClientService dùng làm thời gian chờ mặc định
function layThoiGianChoAi() {
  return Number(process.env.AI_TIMEOUT_MS) || 30000;
}

function dinhDangPhien({ id, tieuDePhien, thoiGianTao }) {
  return { id, tieuDePhien, thoiGianTao };
}

// Phiên của người khác trả 404 (không lộ phiên đó tồn tại)
async function layPhienCuaMinh(nguoiDung, id) {
  const phien = await phienTroChuyenRepository.layCuaNguoiDung(id, nguoiDung.nguoiDungId);
  if (!phien) throw new LoiUngDung(404, 'Không tìm thấy phiên trò chuyện');
  return phien;
}

// Tiêu đề tự đặt từ câu hỏi đầu tiên: gọn một dòng, cắt theo ký tự (không cắt đôi cặp surrogate)
function taoTieuDeTuCauHoi(cauHoi) {
  const motDong = cauHoi.replace(/\s+/g, ' ').trim();
  const kyTu = Array.from(motDong);
  return kyTu.length <= DO_DAI_TIEU_DE ? motDong : `${kyTu.slice(0, DO_DAI_TIEU_DE - 1).join('')}…`;
}

async function layDanhSachPhien(nguoiDung) {
  return (await phienTroChuyenRepository.layTheoNguoiDung(nguoiDung.nguoiDungId)).map(dinhDangPhien);
}

async function taoPhien(nguoiDung, { tieuDePhien } = {}) {
  const id = await phienTroChuyenRepository.them(nguoiDung.nguoiDungId, tieuDePhien || TIEU_DE_MAC_DINH);
  return dinhDangPhien(await layPhienCuaMinh(nguoiDung, id));
}

async function doiTieuDe(nguoiDung, id, tieuDePhien) {
  await layPhienCuaMinh(nguoiDung, id);
  await phienTroChuyenRepository.doiTieuDe(id, nguoiDung.nguoiDungId, tieuDePhien);
  return dinhDangPhien(await layPhienCuaMinh(nguoiDung, id));
}

// Xóa phiên MySQL trước (nguồn chuẩn); xóa lịch sử SQLite sau. ai-service tắt thì chỉ ghi log: tin sót lại
// không hiển thị được nữa vì phiên mới trùng id có dauPhien khác.
async function xoaPhien(nguoiDung, id) {
  await layPhienCuaMinh(nguoiDung, id);
  await phienTroChuyenRepository.xoa(id, nguoiDung.nguoiDungId);
  try {
    await aiClientService.goiAiService(`/noiBo/lichSu/${id}`, { method: 'DELETE' });
  } catch (loi) {
    console.error(`[troLyAi] Chưa xóa được lịch sử phiên ${id}: ${loi.message}`);
  }
  return { id };
}

async function layTinNhan(nguoiDung, id) {
  const phien = await layPhienCuaMinh(nguoiDung, id);
  const duLieu = await aiClientService.goiAiService(`/noiBo/lichSu/${id}?dauPhien=${encodeURIComponent(layDauPhien(phien))}`);
  const tinNhan = await Promise.all(
    (duLieu?.tinNhan ?? []).map(async ({ banNhap, duLieu: duLieuTin, ...tin }) => ({
      ...tin,
      loaiPhanHoi: duLieuTin?.loaiPhanHoi ?? (tin.vaiTro === 'troLy' ? 'TRA_LOI' : undefined),
      banNhap: banNhap ? await dinhDangBanNhap(banNhap) : null,
    })),
  );
  return { phien: dinhDangPhien(phien), tinNhan };
}

// Hỏi đáp: không có phienId thì tạo phiên mới (tiêu đề = câu hỏi). Phiên vừa tạo mà ai-service lỗi thì xóa lại
// để không sinh phiên rỗng; phiên đang có giữ nguyên.
async function hoiDap(nguoiDung, { phienId, cauHoi }) {
  let phien;
  let phienMoi = false;
  if (phienId) {
    phien = await layPhienCuaMinh(nguoiDung, phienId);
  } else {
    const id = await phienTroChuyenRepository.them(nguoiDung.nguoiDungId, taoTieuDeTuCauHoi(cauHoi));
    phien = await layPhienCuaMinh(nguoiDung, id);
    phienMoi = true;
  }

  let ketQua;
  let taiLieuHienCo;
  try {
    taiLieuHienCo = await taiLieuQuyCheRepository.layTatCaIdVaMa();
    ketQua = await aiClientService.goiAiService('/noiBo/troLy/xuLy', {
      method: 'POST',
      body: {
        phienId: phien.id,
        dauPhien: layDauPhien(phien),
        nguoiDungId: nguoiDung.nguoiDungId,
        cauHoi,
        // Ngữ cảnh tạo đơn: ngày theo giờ VN do Express tính (ai-service không dùng giờ máy mình),
        // loại nghỉ đang áp dụng (enum cho LLM), quỹ phép (ai-service không đọc MySQL)
        ngayHienTai: ngayHomNay(),
        loaiNghiPhep: (await nghiPhepService.layDanhSachLoai({ trangThai: 'DANG_AP_DUNG' })).map(({ maLoai, tenLoai }) => ({
          maLoai,
          tenLoai,
        })),
        quyPhep: await layQuyPhepChoAi(nguoiDung),
        taiLieuIdsHienCo: taiLieuHienCo.map((t) => t.id),
        taiLieuHienCo,
        // ai-service bỏ (không gọi LLM, không ghi lịch sử) nếu xử lý xong sau lúc backend đã ngừng chờ:
        // tránh câu hỏi người dùng thấy là lỗi lại xuất hiện trong lịch sử. Trừ 2s dự phòng truyền mạng.
        hanChot: Date.now() + layThoiGianChoAi() - 2000,
      },
    });
  } catch (loi) {
    if (phienMoi) {
      // Dọn phiên rỗng; dọn lỗi chỉ ghi log để không che mất lỗi gốc (503 thân thiện)
      try {
        await phienTroChuyenRepository.xoa(phien.id, nguoiDung.nguoiDungId);
      } catch (loiDon) {
        console.error(`[troLyAi] Không dọn được phiên ${phien.id}: ${loiDon.message}`);
      }
    }
    throw loi;
  }

  // Từ đây ai-service ĐÃ ghi lịch sử: lỗi CSDL ở các bước phụ chỉ ghi log, vẫn trả câu trả lời
  // (trả 500 thì màn hình gỡ câu hỏi trong khi mở lại phiên vẫn thấy → lệch lịch sử).
  // Phiên tạo trống (tiêu đề mặc định) đổi tiêu đề theo câu hỏi đầu tiên
  if (!phienMoi && phien.tieuDePhien === TIEU_DE_MAC_DINH) {
    try {
      await phienTroChuyenRepository.doiTieuDe(phien.id, nguoiDung.nguoiDungId, taoTieuDeTuCauHoi(cauHoi));
      phien = await layPhienCuaMinh(nguoiDung, phien.id);
    } catch (loi) {
      console.error(`[troLyAi] Không đổi được tiêu đề phiên ${phien.id}: ${loi.message}`);
    }
  }

  // Lọc lại nguồn theo CSDL: tài liệu bị xóa trong lúc đang hỏi không được trích dẫn
  try {
    taiLieuHienCo = await taiLieuQuyCheRepository.layTatCaIdVaMa();
  } catch (loi) {
    console.error(`[troLyAi] Không đọc lại được danh sách tài liệu: ${loi.message}`);
  }
  const conLai = new Set(taiLieuHienCo.map((t) => khoaTaiLieu(t.id, t.maTaiLieu)));
  return {
    phien: dinhDangPhien(phien),
    traLoi: ketQua.traLoi,
    nguonTrichDan: (ketQua.nguonTrichDan ?? []).filter((n) => conLai.has(khoaTaiLieu(n.taiLieuId, n.maTaiLieu))),
    cheDo: ketQua.cheDo,
    loaiPhanHoi: ketQua.loaiPhanHoi ?? 'TRA_LOI',
    banNhap: ketQua.banNhap ? await dinhDangBanNhap(ketQua.banNhap) : null,
    thoiGian: ketQua.thoiGian,
  };
}

// ===================== Tạo đơn qua chat (5.5) =====================
// ai-service chỉ soạn bản nháp (SQLite); đơn trong MySQL do service nghiệp vụ sẵn có tạo khi người dùng xác nhận,
// nên mọi kiểm tra (quỹ phép, chồng lấn, ngày lễ, tháng đã chốt...) giống hệt tạo qua form.

// Quỹ phép năm hiện tại gửi ai-service để trả lời "còn mấy ngày phép"; không có hồ sơ/quỹ → null
async function layQuyPhepChoAi(nguoiDung) {
  if (!nguoiDung.nhanVienId) return null;
  try {
    const { nam, quy, soNgayChoDuyet, soNgayConLai } = await nghiPhepService.layQuyCuaToi(nguoiDung);
    if (!quy) return null;
    return { nam, tongSoNgayPhep: quy.tongSoNgayPhep, soNgayDaNghi: quy.soNgayDaNghi, soNgayChoDuyet, soNgayConLai };
  } catch (loi) {
    console.error(`[troLyAi] Không đọc được quỹ phép: ${loi.message}`);
    return null;
  }
}

const SO_LAN_GHI_DA_TAO = 3;

// Thông tin hiển thị thẻ xem trước: tên loại, số ngày nghỉ dự kiến (tính như service thật)
async function dinhDangBanNhap(banNhap) {
  const { id, loai, thamSo, trangThai, ketQua, hetHan } = banNhap;
  const moTa = { id, loai, thamSo, trangThai, ketQua, hetHan };
  if (loai === 'NGHI_PHEP') {
    try {
      const cacLoai = await nghiPhepService.layDanhSachLoai({});
      moTa.tenLoai = cacLoai.find((l) => l.maLoai === thamSo.maLoaiNghiPhep)?.tenLoai ?? thamSo.maLoaiNghiPhep;
      moTa.soNgayNghi = tinhSoNgayNghi(thamSo.ngayBatDau, thamSo.ngayKetThuc, Boolean(thamSo.nuaNgay));
    } catch (loi) {
      console.error(`[troLyAi] Không mô tả được bản nháp ${id}: ${loi.message}`);
    }
  }
  return moTa;
}

async function layBanNhapCuaMinh(nguoiDung, banNhapId) {
  const banNhap = await aiClientService.goiAiService(
    `/noiBo/banNhap/${encodeURIComponent(banNhapId)}?nguoiDungId=${nguoiDung.nguoiDungId}`,
  );
  if (!banNhap?.phienId) throw new LoiUngDung(404, 'Không tìm thấy bản nháp đơn');
  // Phiên chứa bản nháp phải còn và đúng dauPhien (id phiên dùng lại sau khoiTaoCsdl → bản nháp cũ vô hiệu)
  const phien = await phienTroChuyenRepository.layCuaNguoiDung(banNhap.phienId, nguoiDung.nguoiDungId);
  if (!phien || layDauPhien(phien) !== banNhap.dauPhien) throw new LoiUngDung(404, 'Không tìm thấy bản nháp đơn');
  return banNhap;
}

async function chuyenTrangThai(nguoiDung, banNhapId, tu, sang, ketQua) {
  const kq = await aiClientService.goiAiService(`/noiBo/banNhap/${encodeURIComponent(banNhapId)}/chuyenTrangThai`, {
    method: 'POST',
    body: { nguoiDungId: nguoiDung.nguoiDungId, tu, sang, ...(ketQua ? { ketQua } : {}) },
  });
  return kq.daChuyen;
}

// Bản nháp không còn ở CHO_XAC_NHAN: báo đúng lý do
function loiTrangThaiBanNhap(banNhap) {
  switch (banNhap.trangThai) {
    case 'DA_TAO':
      return new LoiUngDung(409, `Đơn này đã được tạo (${banNhap.ketQua?.maDon ?? 'đang chờ duyệt'})`);
    case 'DANG_TAO':
      return new LoiUngDung(409, 'Đơn đang được tạo, vui lòng đợi');
    case 'HET_HAN':
      return new LoiUngDung(409, 'Bản nháp đã hết hạn, vui lòng yêu cầu Trợ lý soạn lại');
    case 'KHONG_RO':
      return new LoiUngDung(409, 'Chưa rõ đơn đã được tạo hay chưa, vui lòng kiểm tra trang Đơn của tôi');
    case 'HUY':
      return new LoiUngDung(409, 'Bản nháp đã bị hủy hoặc thay bằng bản nháp mới hơn');
    default:
      return new LoiUngDung(409, 'Bản nháp không còn dùng được, vui lòng yêu cầu Trợ lý soạn lại');
  }
}

// Gọi đúng service nghiệp vụ như form; LLM không đặt được nhanVienId/trangThai (service tự gán, đơn CHO_DUYET)
async function taoDonTuBanNhap(nguoiDung, { loai, thamSo }) {
  if (loai === 'NGHI_PHEP') {
    const cacLoai = await nghiPhepService.layDanhSachLoai({ trangThai: 'DANG_AP_DUNG' });
    const loaiNghi = cacLoai.find((l) => l.maLoai === thamSo.maLoaiNghiPhep);
    if (!loaiNghi) throw new LoiUngDung(400, 'Loại nghỉ phép không tồn tại hoặc đã ngừng áp dụng');
    const don = await nghiPhepService.taoDon(
      nguoiDung,
      {
        loaiNghiPhepId: loaiNghi.id,
        ngayBatDau: thamSo.ngayBatDau,
        ngayKetThuc: thamSo.ngayKetThuc,
        nuaNgay: Boolean(thamSo.nuaNgay),
        lyDo: thamSo.lyDo,
      },
      'AI_CHAT',
    );
    return { loai, id: don.id, maDon: don.maDon, thongBao: 'Tạo đơn nghỉ phép thành công, đang chờ duyệt' };
  }
  if (loai === 'DIEU_CHINH_CONG') {
    const yeuCau = await chamCongService.taoYeuCau(nguoiDung, {
      ngayCanDieuChinh: thamSo.ngayCanDieuChinh,
      gioVaoDeXuat: thamSo.gioVaoDeXuat,
      gioRaDeXuat: thamSo.gioRaDeXuat,
      lyDoGiaiTrinh: thamSo.lyDoGiaiTrinh,
    });
    return {
      loai,
      id: yeuCau.id,
      maDon: `Yêu cầu #${yeuCau.id}`,
      thongBao: 'Tạo yêu cầu điều chỉnh công thành công, đang chờ duyệt',
    };
  }
  throw new LoiUngDung(400, 'Loại bản nháp không hợp lệ');
}

async function xacNhanBanNhap(nguoiDung, banNhapId, diaChiIP) {
  canHoSoNhanVien(nguoiDung);
  const banNhap = await layBanNhapCuaMinh(nguoiDung, banNhapId);
  if (banNhap.trangThai !== 'CHO_XAC_NHAN') throw loiTrangThaiBanNhap(banNhap);
  // Giữ chỗ nguyên tử: hai lần bấm đồng thời chỉ một lần qua được → chỉ một đơn được tạo
  if (!(await chuyenTrangThai(nguoiDung, banNhapId, 'CHO_XAC_NHAN', 'DANG_TAO'))) {
    throw loiTrangThaiBanNhap(await layBanNhapCuaMinh(nguoiDung, banNhapId));
  }

  let ketQua;
  try {
    ketQua = await taoDonTuBanNhap(nguoiDung, banNhap);
  } catch (loi) {
    const thongBao = loi instanceof LoiUngDung ? loi.message : 'Lỗi hệ thống';
    try {
      await chuyenTrangThai(nguoiDung, banNhapId, 'DANG_TAO', 'LOI', { loi: thongBao });
    } catch (loiCapNhat) {
      console.error(`[troLyAi] Không đánh dấu LOI bản nháp ${banNhapId}: ${loiCapNhat.message}`);
    }
    throw loi;
  }

  // Đơn đã nằm trong MySQL: lỗi cập nhật bản nháp chỉ ghi log (sau 2 phút bản nháp tự coi là LOI,
  // tạo lại sẽ bị service chặn trùng nhờ kiểm tra chồng lấn / yêu cầu chờ duyệt cùng ngày)
  const { thongBao, ...ketQuaLuu } = ketQua;
  // Thử lại tối đa 3 lần: ai-service chập chờn không được để thẻ kẹt ở "đang tạo" trong khi đơn đã có
  for (let lan = 1; lan <= SO_LAN_GHI_DA_TAO; lan += 1) {
    try {
      await chuyenTrangThai(nguoiDung, banNhapId, 'DANG_TAO', 'DA_TAO', ketQuaLuu);
      break;
    } catch (loi) {
      console.error(`[troLyAi] Đã tạo ${ketQua.maDon} nhưng chưa cập nhật bản nháp ${banNhapId} (lần ${lan}): ${loi.message}`);
    }
  }
  // yeucaudieuchinhchamcong không có cột nguồn tạo: nhật ký là dấu vết duy nhất đơn do AI tạo
  await ghiNhatKy(nguoiDung.nguoiDungId, 'AI_TAO_DON', diaChiIP, `${ketQua.loai} ${ketQua.maDon} (id ${ketQua.id})`);
  return { ketQua: ketQuaLuu, thongBao };
}

async function huyBanNhap(nguoiDung, banNhapId) {
  const banNhap = await layBanNhapCuaMinh(nguoiDung, banNhapId);
  if (banNhap.trangThai !== 'CHO_XAC_NHAN' || !(await chuyenTrangThai(nguoiDung, banNhapId, 'CHO_XAC_NHAN', 'HUY'))) {
    throw loiTrangThaiBanNhap(await layBanNhapCuaMinh(nguoiDung, banNhapId));
  }
  return { id: banNhapId, trangThai: 'HUY' };
}

function canHoSoNhanVien(nguoiDung) {
  if (!nguoiDung.nhanVienId) throw new LoiUngDung(403, 'Tài khoản chưa gắn hồ sơ nhân viên nên không thể tạo đơn');
}

module.exports = {
  layDanhSachPhien,
  taoPhien,
  doiTieuDe,
  xoaPhien,
  layTinNhan,
  hoiDap,
  xacNhanBanNhap,
  huyBanNhap,
  TIEU_DE_MAC_DINH,
  layDauPhien,
};
