const { pool } = require('../config/ketNoiCsdl');

// ===================== Bảng tổng hợp lương =====================

const COT_BANG = `bl.id, bl.maBangLuong, bl.thang, bl.nam, bl.tongChiPhiLuong, bl.trangThai, bl.ngayTao,
       bl.nguoiLapId, nl.maNhanVien AS maNguoiLap, nl.hoVaTen AS tenNguoiLap,
       bl.nguoiDuyetId, nd.maNhanVien AS maNguoiDuyet, nd.hoVaTen AS tenNguoiDuyet,
       (SELECT COUNT(*) FROM phieuluongnhanvien p WHERE p.bangTongHopLuongId = bl.id) AS soPhieu`;
const NOI_BANG = `FROM bangtonghopluong bl
       JOIN nhanvien nl ON nl.id = bl.nguoiLapId
       LEFT JOIN nhanvien nd ON nd.id = bl.nguoiDuyetId`;

const chuanHoaBang = (d) => d && { ...d, tongChiPhiLuong: Number(d.tongChiPhiLuong), soPhieu: Number(d.soPhieu) };

async function layDanhSachBang({ nam, trangThai }) {
  const dieuKien = [];
  const thamSo = [];
  if (nam) {
    dieuKien.push('bl.nam = ?');
    thamSo.push(nam);
  }
  if (trangThai) {
    dieuKien.push('bl.trangThai = ?');
    thamSo.push(trangThai);
  }
  const [dong] = await pool.query(
    `SELECT ${COT_BANG} ${NOI_BANG} ${dieuKien.length ? `WHERE ${dieuKien.join(' AND ')}` : ''}
      ORDER BY bl.nam DESC, bl.thang DESC`,
    thamSo,
  );
  return dong.map(chuanHoaBang);
}

async function layBangTheoId(id, ketNoi = pool) {
  const [dong] = await ketNoi.execute(`SELECT ${COT_BANG} ${NOI_BANG} WHERE bl.id = ?`, [id]);
  return chuanHoaBang(dong[0]) ?? null;
}

async function khoaBang(id, ketNoi) {
  const [dong] = await ketNoi.execute(
    'SELECT id, maBangLuong, thang, nam, trangThai, nguoiLapId, ngayTao FROM bangtonghopluong WHERE id = ? FOR UPDATE',
    [id],
  );
  return dong[0] ?? null;
}

async function themBang({ maBangLuong, thang, nam, nguoiLapId }, ketNoi) {
  const [kq] = await ketNoi.execute(
    "INSERT INTO bangtonghopluong (maBangLuong, thang, nam, trangThai, nguoiLapId) VALUES (?, ?, ?, 'BAN_NHAP', ?)",
    [maBangLuong, thang, nam, nguoiLapId],
  );
  return kq.insertId;
}

async function capNhatTrangThaiBang(id, trangThai, nguoiDuyetId, ketNoi) {
  await ketNoi.execute('UPDATE bangtonghopluong SET trangThai = ?, nguoiDuyetId = ? WHERE id = ?', [trangThai, nguoiDuyetId, id]);
}

async function capNhatTongChiPhi(id, tong, ketNoi) {
  await ketNoi.execute('UPDATE bangtonghopluong SET tongChiPhiLuong = ? WHERE id = ?', [tong, id]);
}

async function xoaBang(id, ketNoi) {
  await ketNoi.execute('DELETE FROM bangtonghopluong WHERE id = ?', [id]); // phiếu xóa theo CASCADE
}

// ===================== Phiếu lương =====================

const COT_PHIEU = `p.id, p.bangTongHopLuongId, p.nhanVienId, nv.maNhanVien, nv.hoVaTen, cdpb.phongBanId, pb.tenPhongBan,
       cd.tenChucDanh, p.soNgayCongThucTe, p.luongCoBan, p.luongLamThemOT, p.thuongKPI, p.tongPhuCap,
       p.khauTruBaoHiem, p.khauTruThueTNCN, bl.maBangLuong, bl.thang, bl.nam, bl.trangThai AS trangThaiBangLuong`;
const NOI_PHIEU = `FROM phieuluongnhanvien p
       JOIN bangtonghopluong bl ON bl.id = p.bangTongHopLuongId
       JOIN nhanvien nv ON nv.id = p.nhanVienId
       JOIN chucdanhphongban cdpb ON cdpb.id = nv.chucDanhPhongBanId
       JOIN phongban pb ON pb.id = cdpb.phongBanId
       JOIN chucdanh cd ON cd.id = cdpb.chucDanhId`;

const COT_SO = ['soNgayCongThucTe', 'luongCoBan', 'luongLamThemOT', 'thuongKPI', 'tongPhuCap', 'khauTruBaoHiem', 'khauTruThueTNCN'];
const chuanHoaPhieu = (d) => d && { ...d, ...Object.fromEntries(COT_SO.map((c) => [c, Number(d[c])])) };

function themLocPhieu(dieuKien, thamSo, { phongBanId, tuKhoa }) {
  if (phongBanId) {
    dieuKien.push('cdpb.phongBanId = ?');
    thamSo.push(phongBanId);
  }
  if (tuKhoa) {
    const mau = `%${tuKhoa.replace(/[\\%_]/g, '\\$&')}%`;
    dieuKien.push('(nv.maNhanVien LIKE ? OR nv.hoVaTen LIKE ?)');
    thamSo.push(mau, mau);
  }
}

async function layPhieuTheoBang(bangId, { phongBanId, tuKhoa, viTri, soLuong } = {}) {
  const dieuKien = ['p.bangTongHopLuongId = ?'];
  const thamSo = [bangId];
  themLocPhieu(dieuKien, thamSo, { phongBanId, tuKhoa });
  const where = `WHERE ${dieuKien.join(' AND ')}`;
  const [[dem]] = await pool.query(`SELECT COUNT(*) AS tongSo ${NOI_PHIEU} ${where}`, thamSo);
  const gioiHan = soLuong ? 'LIMIT ? OFFSET ?' : '';
  const [dong] = await pool.query(
    `SELECT ${COT_PHIEU} ${NOI_PHIEU} ${where} ORDER BY nv.maNhanVien ${gioiHan}`,
    soLuong ? [...thamSo, soLuong, viTri] : thamSo,
  );
  return { items: dong.map(chuanHoaPhieu), tongSo: Number(dem.tongSo) };
}

async function layPhieuTheoId(id, ketNoi = pool, khoa = false) {
  const [dong] = await ketNoi.execute(`SELECT ${COT_PHIEU} ${NOI_PHIEU} WHERE p.id = ?${khoa ? ' FOR UPDATE' : ''}`, [id]);
  return chuanHoaPhieu(dong[0]) ?? null;
}

// Phiếu của một nhân viên trong một bảng, khóa dòng để cộng thưởng/phạt trong transaction.
// Chỉ đọc bảng phiếu (không JOIN) để FOR UPDATE không khóa lan sang nhanvien/phongban.
async function khoaPhieuCuaNhanVienTrongBang(bangId, nhanVienId, ketNoi) {
  const [dong] = await ketNoi.execute(
    `SELECT id, nhanVienId, soNgayCongThucTe, luongCoBan, luongLamThemOT, thuongKPI, tongPhuCap, khauTruBaoHiem, khauTruThueTNCN
       FROM phieuluongnhanvien WHERE bangTongHopLuongId = ? AND nhanVienId = ? FOR UPDATE`,
    [bangId, nhanVienId],
  );
  return chuanHoaPhieu(dong[0]) ?? null;
}

// Phiếu của một nhân viên, chỉ thuộc bảng đã duyệt (bảng nháp chưa công bố cho nhân viên)
async function layPhieuDaDuyetCuaNhanVien(nhanVienId, nam) {
  const thamSo = [nhanVienId];
  let locNam = '';
  if (nam) {
    locNam = ' AND bl.nam = ?';
    thamSo.push(nam);
  }
  const [dong] = await pool.execute(
    `SELECT ${COT_PHIEU} ${NOI_PHIEU} WHERE p.nhanVienId = ? AND bl.trangThai = 'DA_DUYET'${locNam}
      ORDER BY bl.nam DESC, bl.thang DESC`,
    thamSo,
  );
  return dong.map(chuanHoaPhieu);
}

async function themPhieu(bangId, nhanVienId, phieu, ketNoi) {
  await ketNoi.execute(
    `INSERT INTO phieuluongnhanvien (bangTongHopLuongId, nhanVienId, soNgayCongThucTe, luongCoBan, luongLamThemOT,
                                     thuongKPI, tongPhuCap, khauTruBaoHiem, khauTruThueTNCN)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      bangId,
      nhanVienId,
      phieu.soNgayCongThucTe,
      phieu.luongCoBan,
      phieu.luongLamThemOT,
      phieu.thuongKPI,
      phieu.tongPhuCap,
      phieu.khauTruBaoHiem,
      phieu.khauTruThueTNCN,
    ],
  );
}

// Tên cột lấy từ danh sách cố định trong code, không từ request
const COT_SUA_PHIEU = ['soNgayCongThucTe', 'luongLamThemOT', 'thuongKPI', 'tongPhuCap', 'khauTruBaoHiem', 'khauTruThueTNCN'];
async function capNhatPhieu(id, thayDoi, ketNoi) {
  const cot = Object.keys(thayDoi).filter((c) => COT_SUA_PHIEU.includes(c));
  if (!cot.length) return;
  await ketNoi.execute(`UPDATE phieuluongnhanvien SET ${cot.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [
    ...cot.map((c) => thayDoi[c]),
    id,
  ]);
}

async function xoaPhieuTheoBang(bangId, ketNoi) {
  await ketNoi.execute('DELETE FROM phieuluongnhanvien WHERE bangTongHopLuongId = ?', [bangId]);
}

async function layTatCaPhieuCuaBang(bangId, ketNoi) {
  const [dong] = await ketNoi.execute(
    `SELECT p.id, p.soNgayCongThucTe, p.luongCoBan, p.luongLamThemOT, p.thuongKPI, p.tongPhuCap,
            p.khauTruBaoHiem, p.khauTruThueTNCN
       FROM phieuluongnhanvien p WHERE p.bangTongHopLuongId = ?`,
    [bangId],
  );
  return dong.map(chuanHoaPhieu);
}

// ===================== Dữ liệu đầu vào khi lập bảng =====================

// Nhân viên được tính lương tháng: có hợp đồng giao với tháng (kể cả DA_CHAM_DUT giữa tháng — khi chấm dứt
// ngayKetThuc = ngày chấm dứt), đã vào làm trước cuối tháng.
// Người đã nghỉ việc chỉ tính nếu còn ngày chấm công trong tháng. Mỗi người lấy hợp đồng bắt đầu muộn nhất.
async function layNhanVienTinhLuong(tuNgay, denNgay, ketNoi, nhanVienId = null) {
  const [dong] = await ketNoi.execute(
    `SELECT nv.id AS nhanVienId, nv.maNhanVien, hd.luongCoBan, hd.mucPhuCap
       FROM nhanvien nv
       JOIN hopdonglaodong hd ON hd.id = (
            SELECT h.id FROM hopdonglaodong h
             WHERE h.nhanVienId = nv.id AND h.trangThai IN ('HIEU_LUC', 'DA_CHAM_DUT')
               AND h.ngayBatDau <= ? AND (h.ngayKetThuc IS NULL OR h.ngayKetThuc >= ?)
             ORDER BY h.ngayBatDau DESC, h.id DESC LIMIT 1)
      WHERE nv.ngayVaoLam <= ?
        AND (nv.trangThaiLamViec <> 'DA_NGHI_VIEC' OR EXISTS (
             SELECT 1 FROM banghichamcong cc WHERE cc.nhanVienId = nv.id AND cc.ngayChamCong BETWEEN ? AND ?))
        ${nhanVienId ? 'AND nv.id = ?' : ''}
      ORDER BY nv.id`,
    [denNgay, tuNgay, denNgay, tuNgay, denNgay, ...(nhanVienId ? [nhanVienId] : [])],
  );
  return dong.map((d) => ({ ...d, luongCoBan: Number(d.luongCoBan), mucPhuCap: Number(d.mucPhuCap) }));
}

async function layChamCongTrongThang(tuNgay, denNgay, ketNoi) {
  const [dong] = await ketNoi.execute(
    `SELECT nhanVienId, ngayChamCong, soGioLamThemOT FROM banghichamcong
      WHERE ngayChamCong BETWEEN ? AND ? AND gioVao IS NOT NULL`,
    [tuNgay, denNgay],
  );
  return dong;
}

async function layDonNghiDaDuyetTrongThang(tuNgay, denNgay, ketNoi) {
  const [dong] = await ketNoi.execute(
    `SELECT d.nhanVienId, d.ngayBatDau, d.ngayKetThuc, d.soNgayNghi, l.coLuong
       FROM dondexuatnghiphep d JOIN loainghiphep l ON l.id = d.loaiNghiPhepId
      WHERE d.trangThai = 'DA_DUYET' AND d.ngayBatDau <= ? AND d.ngayKetThuc >= ?`,
    [denNgay, tuNgay],
  );
  return dong.map((d) => ({ ...d, coLuong: Boolean(d.coLuong) }));
}

// Khen thưởng (+) / kỷ luật (−) có ngày ban hành trong tháng.
// Đọc có khóa (luôn gọi trong transaction lập/tính lại bảng): thấy cả quyết định vừa commit khi lập bảng
// chạy đồng thời với ban hành quyết định (đọc thường dùng snapshot cũ của REPEATABLE READ sẽ bỏ sót).
async function layThuongPhatTrongThang(tuNgay, denNgay, ketNoi) {
  const [dong] = await ketNoi.execute(
    `SELECT nhanVienId,
            SUM(CASE WHEN loaiQuyetDinh = 'KHEN_THUONG' THEN soTien WHEN loaiQuyetDinh = 'KY_LUAT' THEN -soTien ELSE 0 END) AS thuongPhat
       FROM quyetdinhkhenthuongkyluat
      WHERE ngayBanHanh BETWEEN ? AND ?
      GROUP BY nhanVienId
      LOCK IN SHARE MODE`,
    [tuNgay, denNgay],
  );
  return new Map(dong.map((d) => [d.nhanVienId, Number(d.thuongPhat)]));
}

// Phiếu KPI đã nghiệm thu trong khoảng ngày (thưởng KPI trả vào lương tháng chứa ngayNghiemThu).
// khoa = true khi sinh phiếu lương: khóa chia sẻ như layThuongPhatTrongThang để số liệu không đổi giữa chừng.
async function layKpiNghiemThuTrongThang(tuNgay, denNgay, { ketNoi = pool, khoa = false, nhanVienIds = null } = {}) {
  if (nhanVienIds && !nhanVienIds.length) return [];
  const locNhanVien = nhanVienIds ? ` AND p.nhanVienId IN (${nhanVienIds.map(() => '?').join(', ')})` : '';
  const [dong] = await ketNoi.execute(
    `SELECT p.id, p.nhanVienId, p.xepLoaiChung, p.ngayNghiemThu, k.tenKyDanhGia, k.ngayBatDau, k.ngayKetThuc
       FROM phieudanhgiakpi p JOIN kydanhgiakpi k ON k.id = p.kyDanhGiaId
      WHERE p.trangThai = 'DA_DUYET' AND p.ngayNghiemThu >= ? AND p.ngayNghiemThu < DATE_ADD(?, INTERVAL 1 DAY)${locNhanVien}
      ORDER BY p.id${khoa ? ' LOCK IN SHARE MODE' : ''}`,
    [tuNgay, denNgay, ...(nhanVienIds ?? [])],
  );
  return dong;
}

// Người duyệt đã tham gia lập/tính lại/sửa phiếu của bảng hiện tại (tính từ lúc tạo bảng) -> không được duyệt
async function daThamGiaLapBang(nguoiDungId, maBangLuong, ngayTaoBang, ketNoi) {
  const [dong] = await ketNoi.execute(
    `SELECT 1 FROM nhatkyhethong
      WHERE nguoiDungId = ? AND hanhDong IN ('LAP_BANG_LUONG', 'TINH_LAI_BANG_LUONG', 'SUA_PHIEU_LUONG', 'GUI_DUYET_BANG_LUONG')
        AND chiTiet LIKE ? AND thoiGianTao >= ? LIMIT 1`,
    [nguoiDungId, `${maBangLuong}%`, ngayTaoBang],
  );
  return dong.length > 0;
}

// ===================== Đồng bộ với hợp đồng =====================

// Khóa đọc (S) các hợp đồng giao với tháng khi lập / tính lại / gửi duyệt bảng: HR sửa hợp đồng cùng lúc phải chờ
// transaction lương xong (và ngược lại), nên bảng không bị tính từ hợp đồng đang sửa dở.
// Câu riêng vì khóa ở câu ngoài không chắc khóa được dòng trong truy vấn con tương quan của layNhanVienTinhLuong.
async function khoaHopDongTrongThang(tuNgay, denNgay, ketNoi) {
  await ketNoi.execute(
    `SELECT id FROM hopdonglaodong
      WHERE trangThai IN ('HIEU_LUC', 'DA_CHAM_DUT') AND ngayBatDau <= ? AND (ngayKetThuc IS NULL OR ngayKetThuc >= ?)
      LOCK IN SHARE MODE`,
    [denNgay, tuNgay],
  );
}

// Bảng lương (mọi trạng thái) của các tháng giao khoảng [tuNgay, denNgay]; denNgay null = không giới hạn
async function layBangGiaoKhoang(tuNgay, denNgay, ketNoi) {
  const thangSo = (ngay) => Number(ngay.slice(0, 4)) * 100 + Number(ngay.slice(5, 7));
  const [dong] = await ketNoi.execute(
    `SELECT id, maBangLuong, thang, nam, trangThai FROM bangtonghopluong
      WHERE nam * 100 + thang >= ? ${denNgay ? 'AND nam * 100 + thang <= ?' : ''}
      ORDER BY nam, thang`,
    [thangSo(tuNgay), ...(denNgay ? [thangSo(denNgay)] : [])],
  );
  return dong;
}

// Id các bảng (trong danh sách) mà nhân viên đã có phiếu: một truy vấn cho mọi bảng
async function layBangCoPhieuCuaNhanVien(nhanVienId, bangIds, ketNoi) {
  if (!bangIds.length) return new Set();
  const [dong] = await ketNoi.query(
    'SELECT bangTongHopLuongId FROM phieuluongnhanvien WHERE nhanVienId = ? AND bangTongHopLuongId IN (?)',
    [nhanVienId, bangIds],
  );
  return new Set(dong.map((d) => d.bangTongHopLuongId));
}

async function layNhanVienCoPhieu(bangId, ketNoi) {
  const [dong] = await ketNoi.execute('SELECT nhanVienId FROM phieuluongnhanvien WHERE bangTongHopLuongId = ?', [bangId]);
  return new Set(dong.map((d) => d.nhanVienId));
}

// Mốc của lần tính bảng gần nhất (lập / tính lại): id + thời điểm nhật ký; bảng không có nhật ký (seed) -> ngày tạo bảng
async function layMocTinhBangGanNhat(bang, ketNoi) {
  const [dong] = await ketNoi.execute(
    `SELECT id, thoiGianTao FROM nhatkyhethong
      WHERE hanhDong IN ('LAP_BANG_LUONG', 'TINH_LAI_BANG_LUONG') AND chiTiet LIKE ? AND thoiGianTao >= ?
      ORDER BY id DESC LIMIT 1`,
    [`${bang.maBangLuong}:%`, bang.ngayTao],
  );
  return dong[0] ? { nhatKyId: dong[0].id, thoiDiem: dong[0].thoiGianTao } : { nhatKyId: 0, thoiDiem: bang.ngayTao };
}

// Thay đổi hợp đồng ghi SAU lần tính bảng gần nhất và có ảnh hưởng tới lương tháng [tuNgay, denNgay]
// (cùng quy tắc với hopDongService.khoangAnhHuong). "Sau" quyết định bằng id nhật ký: nhật ký của chính thao tác
// hợp đồng (cùng hành động, ghi ngay sau lịch sử, có thể lệch sang giây kế) phải có id lớn hơn nhật ký lần tính.
// ngayGhiNhan >= mốc chỉ để thu hẹp (thay đổi sau lần tính không thể ghi trước thời điểm đó).
// Điều chỉnh chỉ đổi file đính kèm không tính.
async function layThayDoiHopDongSauMoc(moc, tuNgay, denNgay, ketNoi) {
  const [dong] = await ketNoi.execute(
    `SELECT DISTINCT hd.nhanVienId, nv.maNhanVien, hd.maHopDong
       FROM lichsuhopdong ls
       JOIN hopdonglaodong hd ON hd.id = ls.hopDongLaoDongId
       JOIN nhanvien nv ON nv.id = hd.nhanVienId
      WHERE ls.ngayGhiNhan >= ? AND EXISTS (
              SELECT 1 FROM nhatkyhethong nk
               WHERE nk.id > ? AND nk.thoiGianTao BETWEEN ls.ngayGhiNhan AND ls.ngayGhiNhan + INTERVAL 1 SECOND
                 AND nk.chiTiet LIKE CONCAT(hd.maHopDong, ' (%')
                 AND nk.hanhDong = CASE ls.hanhDong WHEN 'TAO_MOI' THEN 'THEM_HOP_DONG' WHEN 'GIA_HAN' THEN 'GIA_HAN_HOP_DONG'
                                   WHEN 'DIEU_CHINH' THEN 'DIEU_CHINH_HOP_DONG' WHEN 'CHAM_DUT' THEN 'CHAM_DUT_HOP_DONG' END)
        AND ls.ngayBatDauMoi <= ?
        AND (
             (ls.hanhDong IN ('TAO_MOI', 'DIEU_CHINH') AND (ls.ngayKetThucMoi IS NULL OR ls.ngayKetThucMoi >= ?)
               AND (ls.hanhDong = 'TAO_MOI' OR ls.luongCoBanCu <> ls.luongCoBanMoi OR ls.mucPhuCapCu <> ls.mucPhuCapMoi))
          OR (ls.hanhDong = 'GIA_HAN' AND ls.ngayKetThucCu < ? AND ls.ngayKetThucMoi >= ?)
          OR (ls.hanhDong = 'CHAM_DUT' AND ls.ngayKetThucMoi < ? AND (ls.ngayKetThucCu IS NULL OR ls.ngayKetThucCu >= ?))
        )
      ORDER BY nv.maNhanVien`,
    [moc.thoiDiem, moc.nhatKyId, denNgay, tuNgay, tuNgay, tuNgay, tuNgay, tuNgay],
  );
  return dong;
}

// ===================== Báo cáo quỹ lương =====================

async function layPhieuDaDuyetTheoNam(nam) {
  const [dong] = await pool.execute(
    `SELECT ${COT_PHIEU} ${NOI_PHIEU} WHERE bl.trangThai = 'DA_DUYET' AND bl.nam = ? ORDER BY bl.thang, nv.maNhanVien`,
    [nam],
  );
  return dong.map(chuanHoaPhieu);
}

module.exports = {
  layDanhSachBang,
  layBangTheoId,
  khoaBang,
  themBang,
  capNhatTrangThaiBang,
  capNhatTongChiPhi,
  xoaBang,
  layPhieuTheoBang,
  layPhieuTheoId,
  khoaPhieuCuaNhanVienTrongBang,
  layPhieuDaDuyetCuaNhanVien,
  themPhieu,
  capNhatPhieu,
  xoaPhieuTheoBang,
  layTatCaPhieuCuaBang,
  layNhanVienTinhLuong,
  layChamCongTrongThang,
  layDonNghiDaDuyetTrongThang,
  layThuongPhatTrongThang,
  layKpiNghiemThuTrongThang,
  layPhieuDaDuyetTheoNam,
  daThamGiaLapBang,
  khoaHopDongTrongThang,
  layBangGiaoKhoang,
  layBangCoPhieuCuaNhanVien,
  layNhanVienCoPhieu,
  layMocTinhBangGanNhat,
  layThayDoiHopDongSauMoc,
};
