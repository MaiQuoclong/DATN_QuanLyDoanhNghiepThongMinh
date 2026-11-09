const { pool } = require('../config/ketNoiCsdl');

const COT_BAN_GHI = `id, nhanVienId, ngayChamCong, gioVao, gioRa, soGioLamThucTe, soGioLamThemOT,
       diMuon, veSom, trangThai`;

// Các cột service được phép cập nhật (tên cột lấy từ code, không lấy từ request)
const COT_CAP_NHAT_BAN_GHI = ['gioVao', 'gioRa', 'soGioLamThucTe', 'soGioLamThemOT', 'diMuon', 'veSom', 'trangThai'];

function chuanHoaBanGhi(dong) {
  if (!dong) return null;
  return {
    ...dong,
    soGioLamThucTe: Number(dong.soGioLamThucTe),
    soGioLamThemOT: Number(dong.soGioLamThemOT),
    diMuon: Boolean(dong.diMuon),
    veSom: Boolean(dong.veSom),
  };
}

// Điều kiện phạm vi theo phòng ban hiện tại của nhân viên (null = toàn công ty, mảng = quanLy)
function themDieuKienPhamVi(dieuKien, thamSo, { phamViPhongBanIds, phongBanId, tuKhoa }) {
  if (phamViPhongBanIds) {
    dieuKien.push(`cdpb.phongBanId IN (${phamViPhongBanIds.map(() => '?').join(', ')})`);
    thamSo.push(...phamViPhongBanIds);
  }
  if (phongBanId) {
    dieuKien.push('cdpb.phongBanId = ?');
    thamSo.push(phongBanId);
  }
  if (tuKhoa) {
    dieuKien.push('(nv.maNhanVien LIKE ? OR nv.hoVaTen LIKE ?)');
    const mau = `%${tuKhoa.replace(/[\\%_]/g, '\\$&')}%`;
    thamSo.push(mau, mau);
  }
}

// ===================== Bản ghi chấm công =====================

async function layBanGhiTheoNgay(nhanVienId, ngay, ketNoi = pool, khoa = false) {
  const [dong] = await ketNoi.execute(
    `SELECT ${COT_BAN_GHI} FROM banghichamcong WHERE nhanVienId = ? AND ngayChamCong = ?${khoa ? ' FOR UPDATE' : ''}`,
    [nhanVienId, ngay],
  );
  return chuanHoaBanGhi(dong[0]);
}

async function layBanGhiTheoId(id, ketNoi = pool) {
  const [dong] = await ketNoi.execute(`SELECT ${COT_BAN_GHI} FROM banghichamcong WHERE id = ?`, [id]);
  return chuanHoaBanGhi(dong[0]);
}

async function themBanGhi(banGhi, ketNoi) {
  const [ketQua] = await ketNoi.execute(
    `INSERT INTO banghichamcong (nhanVienId, ngayChamCong, gioVao, gioRa, soGioLamThucTe, soGioLamThemOT, diMuon, veSom, trangThai)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      banGhi.nhanVienId,
      banGhi.ngayChamCong,
      banGhi.gioVao,
      banGhi.gioRa ?? null,
      banGhi.soGioLamThucTe,
      banGhi.soGioLamThemOT,
      banGhi.diMuon ? 1 : 0,
      banGhi.veSom ? 1 : 0,
      banGhi.trangThai,
    ],
  );
  return ketQua.insertId;
}

async function capNhatBanGhi(id, truong, ketNoi) {
  const cot = Object.keys(truong).filter((ten) => COT_CAP_NHAT_BAN_GHI.includes(ten));
  if (cot.length === 0) return;
  const giaTri = cot.map((ten) => (typeof truong[ten] === 'boolean' ? Number(truong[ten]) : truong[ten]));
  await ketNoi.execute(`UPDATE banghichamcong SET ${cot.map((ten) => `${ten} = ?`).join(', ')} WHERE id = ?`, [...giaTri, id]);
}

async function layBanGhiTrongKhoang(nhanVienId, tuNgay, denNgay) {
  const [dong] = await pool.execute(
    `SELECT ${COT_BAN_GHI} FROM banghichamcong
      WHERE nhanVienId = ? AND ngayChamCong BETWEEN ? AND ? ORDER BY ngayChamCong`,
    [nhanVienId, tuNgay, denNgay],
  );
  return dong.map(chuanHoaBanGhi);
}

// Bảng công tháng: mỗi nhân viên một dòng tổng hợp. Lấy người đã vào làm trước cuối tháng và
// còn làm việc, hoặc đã nghỉ nhưng vẫn có bản ghi trong tháng (để chốt lương tháng cuối).
async function layBangCongThang({ tuNgay, denNgay, homNay, phamViPhongBanIds, phongBanId, tuKhoa, viTri, soLuong }) {
  if (phamViPhongBanIds && phamViPhongBanIds.length === 0) return { items: [], tongSo: 0 };
  const dieuKien = [
    'nv.ngayVaoLam <= ?',
    `(nv.trangThaiLamViec <> 'DA_NGHI_VIEC' OR EXISTS (
        SELECT 1 FROM banghichamcong x WHERE x.nhanVienId = nv.id AND x.ngayChamCong BETWEEN ? AND ?))`,
  ];
  const thamSo = [denNgay, tuNgay, denNgay];
  themDieuKienPhamVi(dieuKien, thamSo, { phamViPhongBanIds, phongBanId, tuKhoa });
  const where = `WHERE ${dieuKien.join(' AND ')}`;
  const bangNoi = `FROM nhanvien nv
       JOIN chucdanhphongban cdpb ON cdpb.id = nv.chucDanhPhongBanId
       JOIN phongban pb ON pb.id = cdpb.phongBanId`;

  const [[dem]] = await pool.query(`SELECT COUNT(*) AS tongSo ${bangNoi} ${where}`, thamSo);
  const [items] = await pool.query(
    `SELECT nv.id AS nhanVienId, nv.maNhanVien, nv.hoVaTen, cdpb.phongBanId, pb.tenPhongBan, nv.trangThaiLamViec,
            COUNT(cc.id) AS soNgayChamCong,
            COALESCE(SUM(cc.gioRa IS NULL AND cc.ngayChamCong < ?), 0) AS soNgayThieuCheckOut,
            COALESCE(SUM(cc.soGioLamThucTe), 0) AS tongGioLamThucTe,
            COALESCE(SUM(cc.soGioLamThemOT), 0) AS tongGioLamThem,
            COALESCE(SUM(cc.diMuon), 0) AS soLanDiMuon,
            COALESCE(SUM(cc.veSom), 0) AS soLanVeSom
       ${bangNoi}
       LEFT JOIN banghichamcong cc ON cc.nhanVienId = nv.id AND cc.ngayChamCong BETWEEN ? AND ?
       ${where}
      GROUP BY nv.id
      ORDER BY nv.maNhanVien
      LIMIT ? OFFSET ?`,
    [homNay, tuNgay, denNgay, ...thamSo, soLuong, viTri],
  );
  return {
    items: items.map((d) => ({
      ...d,
      soNgayChamCong: Number(d.soNgayChamCong),
      soNgayThieuCheckOut: Number(d.soNgayThieuCheckOut),
      tongGioLamThucTe: Number(d.tongGioLamThucTe),
      tongGioLamThem: Number(d.tongGioLamThem),
      soLanDiMuon: Number(d.soLanDiMuon),
      soLanVeSom: Number(d.soLanVeSom),
    })),
    tongSo: Number(dem.tongSo),
  };
}

// ===================== Chốt công tháng (suy ra từ nhatkyhethong) =====================
// Schema không có bảng/cột chốt công: tháng đã chốt = có bản ghi CHOT_CONG_THANG với chiTiet = 'YYYY-MM'

async function layThongTinChot(thang, ketNoi = pool) {
  const [dong] = await ketNoi.execute(
    `SELECT nk.thoiGianTao AS thoiGianChot, nd.tenDangNhap AS nguoiChot
       FROM nhatkyhethong nk LEFT JOIN nguoidung nd ON nd.id = nk.nguoiDungId
      WHERE nk.hanhDong = 'CHOT_CONG_THANG' AND nk.chiTiet = ?
      ORDER BY nk.id LIMIT 1`,
    [thang],
  );
  return dong[0] ?? null;
}

async function layDanhSachThangDaChot() {
  const [dong] = await pool.query(
    `SELECT nk.chiTiet AS thang, MIN(nk.thoiGianTao) AS thoiGianChot
       FROM nhatkyhethong nk
      WHERE nk.hanhDong = 'CHOT_CONG_THANG'
      GROUP BY nk.chiTiet
      ORDER BY nk.chiTiet DESC`,
  );
  return dong;
}

async function demNgayThieuCheckOutTrongKhoang(tuNgay, denNgay, ketNoi) {
  const [[dong]] = await ketNoi.execute(
    'SELECT COUNT(*) AS soLuong FROM banghichamcong WHERE gioRa IS NULL AND ngayChamCong BETWEEN ? AND ?',
    [tuNgay, denNgay],
  );
  return Number(dong.soLuong);
}

async function layNgayVaoLamSomNhat() {
  const [[dong]] = await pool.query('SELECT MIN(ngayVaoLam) AS ngay FROM nhanvien');
  return dong.ngay;
}

// QUY ƯỚC cho mọi module sau (nghỉ phép, lương...): luôn khóa nhanvien TRƯỚC các bảng nghiệp vụ khác,
// vì thao tác chốt công khóa toàn bộ nhanvien rồi mới đọc banghichamcong/yeucaudieuchinhchamcong.
// Chốt công khóa toàn bộ dòng nhanvien (theo id tăng dần): mọi luồng ghi công/điều chỉnh đều khóa dòng
// nhân viên trước, nên chúng chạy tuần tự với thao tác chốt và luôn thấy đúng trạng thái đã chốt hay chưa.
async function khoaTatCaNhanVien(ketNoi) {
  await ketNoi.query('SELECT id FROM nhanvien ORDER BY id FOR UPDATE');
}

// ===================== Yêu cầu điều chỉnh công =====================

const COT_YEU_CAU = `yc.id, yc.banGhiChamCongId, yc.nhanVienId, nv.maNhanVien, nv.hoVaTen, cdpb.phongBanId, pb.tenPhongBan,
       yc.ngayCanDieuChinh, yc.gioVaoDeXuat, yc.gioRaDeXuat, yc.lyDoGiaiTrinh, yc.trangThai, yc.lyDoTuChoi,
       yc.nguoiDuyetId, nd.maNhanVien AS maNguoiDuyet, nd.hoVaTen AS tenNguoiDuyet, yc.thoiGianDuyet, yc.ngayTao,
       cc.gioVao AS gioVaoHienTai, cc.gioRa AS gioRaHienTai`;

const BANG_NOI_YEU_CAU = `FROM yeucaudieuchinhchamcong yc
       JOIN nhanvien nv ON nv.id = yc.nhanVienId
       JOIN chucdanhphongban cdpb ON cdpb.id = nv.chucDanhPhongBanId
       JOIN phongban pb ON pb.id = cdpb.phongBanId
       LEFT JOIN nhanvien nd ON nd.id = yc.nguoiDuyetId
       LEFT JOIN banghichamcong cc ON cc.id = yc.banGhiChamCongId`;

async function layYeuCauTheoId(id, ketNoi = pool) {
  const [dong] = await ketNoi.execute(`SELECT ${COT_YEU_CAU} ${BANG_NOI_YEU_CAU} WHERE yc.id = ?`, [id]);
  return dong[0] ?? null;
}

async function khoaYeuCau(id, ketNoi) {
  const [dong] = await ketNoi.execute(
    'SELECT id, nhanVienId, ngayCanDieuChinh, gioVaoDeXuat, gioRaDeXuat, trangThai FROM yeucaudieuchinhchamcong WHERE id = ? FOR UPDATE',
    [id],
  );
  return dong[0] ?? null;
}

async function timYeuCauChoDuyetTheoNgay(nhanVienId, ngay, ketNoi) {
  const [dong] = await ketNoi.execute(
    `SELECT id FROM yeucaudieuchinhchamcong
      WHERE nhanVienId = ? AND ngayCanDieuChinh = ? AND trangThai = 'CHO_DUYET' LIMIT 1`,
    [nhanVienId, ngay],
  );
  return dong[0] ?? null;
}

async function demYeuCauChoDuyetTrongKhoang(tuNgay, denNgay, ketNoi) {
  const [[dong]] = await ketNoi.execute(
    `SELECT COUNT(*) AS soLuong FROM yeucaudieuchinhchamcong
      WHERE trangThai = 'CHO_DUYET' AND ngayCanDieuChinh BETWEEN ? AND ?`,
    [tuNgay, denNgay],
  );
  return Number(dong.soLuong);
}

async function themYeuCau(yc, ketNoi) {
  const [ketQua] = await ketNoi.execute(
    `INSERT INTO yeucaudieuchinhchamcong (banGhiChamCongId, nhanVienId, ngayCanDieuChinh, gioVaoDeXuat, gioRaDeXuat, lyDoGiaiTrinh)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [yc.banGhiChamCongId ?? null, yc.nhanVienId, yc.ngayCanDieuChinh, yc.gioVaoDeXuat ?? null, yc.gioRaDeXuat ?? null, yc.lyDoGiaiTrinh],
  );
  return ketQua.insertId;
}

async function capNhatKetQuaDuyet(id, { trangThai, nguoiDuyetId, lyDoTuChoi, banGhiChamCongId }, ketNoi) {
  await ketNoi.execute(
    `UPDATE yeucaudieuchinhchamcong
        SET trangThai = ?, nguoiDuyetId = ?, lyDoTuChoi = ?, thoiGianDuyet = NOW(),
            banGhiChamCongId = COALESCE(?, banGhiChamCongId)
      WHERE id = ?`,
    [trangThai, nguoiDuyetId, lyDoTuChoi ?? null, banGhiChamCongId ?? null, id],
  );
}

// boLoc.nhanVienId: chỉ yêu cầu của một người (Của tôi); phamViPhongBanIds: null = toàn công ty
async function layDanhSachYeuCau({ nhanVienId, phamViPhongBanIds, phongBanId, tuKhoa, trangThai, tuNgay, denNgay, viTri, soLuong }) {
  if (phamViPhongBanIds && phamViPhongBanIds.length === 0) return { items: [], tongSo: 0 };
  const dieuKien = [];
  const thamSo = [];
  if (nhanVienId) {
    dieuKien.push('yc.nhanVienId = ?');
    thamSo.push(nhanVienId);
  }
  themDieuKienPhamVi(dieuKien, thamSo, { phamViPhongBanIds, phongBanId, tuKhoa });
  if (trangThai) {
    dieuKien.push('yc.trangThai = ?');
    thamSo.push(trangThai);
  }
  if (tuNgay && denNgay) {
    dieuKien.push('yc.ngayCanDieuChinh BETWEEN ? AND ?');
    thamSo.push(tuNgay, denNgay);
  }
  const where = dieuKien.length ? `WHERE ${dieuKien.join(' AND ')}` : '';
  const [[dem]] = await pool.query(`SELECT COUNT(*) AS tongSo ${BANG_NOI_YEU_CAU} ${where}`, thamSo);
  const [items] = await pool.query(
    `SELECT ${COT_YEU_CAU} ${BANG_NOI_YEU_CAU} ${where}
      ORDER BY (yc.trangThai = 'CHO_DUYET') DESC, yc.ngayTao DESC, yc.id DESC
      LIMIT ? OFFSET ?`,
    [...thamSo, soLuong, viTri],
  );
  return { items, tongSo: Number(dem.tongSo) };
}

module.exports = {
  layBanGhiTheoNgay,
  layBanGhiTheoId,
  themBanGhi,
  capNhatBanGhi,
  layBanGhiTrongKhoang,
  layBangCongThang,
  layThongTinChot,
  layDanhSachThangDaChot,
  khoaTatCaNhanVien,
  layYeuCauTheoId,
  khoaYeuCau,
  demNgayThieuCheckOutTrongKhoang,
  layNgayVaoLamSomNhat,
  timYeuCauChoDuyetTheoNgay,
  demYeuCauChoDuyetTrongKhoang,
  themYeuCau,
  capNhatKetQuaDuyet,
  layDanhSachYeuCau,
};
