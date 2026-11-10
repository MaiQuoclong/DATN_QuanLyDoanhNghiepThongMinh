const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/ketNoiCsdl');
const { tinhThuongKpi, demSoThangKy } = require('../src/utils/tinhLuong');

// Nối thưởng KPI vào lương: thưởng = K(xếp loại) × lương HĐ × 0.1 × số tháng kỳ, trả vào bảng lương tháng chứa ngayNghiemThu.
// Dữ liệu dùng tháng năm 2020 (seed không có bảng lương/KPI năm này) và kỳ KPI năm 2061+; mỗi test tự dọn.
// Riêng kịch bản nghiệm thu thật (API) phải dùng bảng lương tháng hiện tại, chèn trực tiếp DB và xóa ngay sau test.
const MAT_KHAU = 'MatKhau@123';
const NV_NHANVIEN = 5;

const token = {};
let anhChup;
let mocNhatKy;
let demMa = 0;

const goi = (phuongThuc, duongDan, tk) => {
  const r = request(app)[phuongThuc](`/api/v1${duongDan}`);
  return tk ? r.set('Authorization', `Bearer ${tk}`) : r;
};
const docText = (r) =>
  r.buffer(true).parse((res, cb) => {
    let s = '';
    res.setEncoding('utf8');
    res.on('data', (c) => {
      s += c;
    });
    res.on('end', () => cb(null, s));
  });

async function layNhatKy(hanhDong) {
  const [d] = await pool.execute('SELECT nguoiDungId, chiTiet FROM nhatkyhethong WHERE id > ? AND hanhDong = ? ORDER BY id', [
    mocNhatKy,
    hanhDong,
  ]);
  return d;
}
async function chenChot(thang) {
  await pool.execute("INSERT INTO nhatkyhethong (nguoiDungId, hanhDong, chiTiet) VALUES (4, 'CHOT_CONG_THANG', ?)", [thang]);
}
async function chenNhanVien(luong = 10000000) {
  demMa += 1;
  const ma = `QK${Date.now() % 100000}${demMa}`;
  const [kq] = await pool.execute(
    `INSERT INTO nhanvien (maNhanVien, hoVaTen, gioiTinh, ngaySinh, chucDanhPhongBanId, ngayVaoLam, trangThaiLamViec)
     VALUES (?, 'QA Thưởng KPI', 'NAM', '1995-01-01', 5, '2020-01-06', 'CHINH_THUC')`,
    [ma],
  );
  await pool.execute(
    `INSERT INTO hopdonglaodong (maHopDong, nhanVienId, loaiHopDong, ngayBatDau, ngayKetThuc, luongCoBan, mucPhuCap, trangThai)
     VALUES (?, ?, 'XAC_DINH_THOI_HAN', '2020-01-06', NULL, ?, 1000000, 'HIEU_LUC')`,
    [`HD${ma}`, kq.insertId, luong],
  );
  return { id: kq.insertId, maNhanVien: ma };
}
async function chenKy(ngayBatDau, ngayKetThuc, trangThai = 'DA_DONG') {
  demMa += 1;
  const [kq] = await pool.execute('INSERT INTO kydanhgiakpi (tenKyDanhGia, ngayBatDau, ngayKetThuc, trangThai) VALUES (?, ?, ?, ?)', [
    `QA thưởng KPI ${Date.now() % 100000}-${demMa}`,
    ngayBatDau,
    ngayKetThuc,
    trangThai,
  ]);
  return kq.insertId;
}
async function chenPhieuKpi(kyId, nhanVienId, xepLoai, ngayNghiemThu, trangThai = 'DA_DUYET') {
  const [kq] = await pool.execute(
    `INSERT INTO phieudanhgiakpi (kyDanhGiaId, nhanVienId, xepLoaiChung, nguoiDanhGiaId, ngayNghiemThu, trangThai)
     VALUES (?, ?, ?, 3, ?, ?)`,
    [kyId, nhanVienId, xepLoai, ngayNghiemThu, trangThai],
  );
  return kq.insertId;
}
async function chenQuyetDinh(nhanVienId, loai, soTien, ngay) {
  demMa += 1;
  await pool.execute(
    `INSERT INTO quyetdinhkhenthuongkyluat (soQuyetDinh, nhanVienId, loaiQuyetDinh, tieuDe, soTien, lyDo, ngayBanHanh, nguoiKyDuyetId)
     VALUES (?, ?, ?, 'Test', ?, 'Test thưởng KPI', ?, 2)`,
    [`QAKP${Date.now() % 100000}${demMa}`, nhanVienId, loai, soTien, ngay],
  );
}
async function lapBangOk(thang) {
  await chenChot(thang);
  const res = await goi('post', '/bangLuong', token.hr).send({ thang });
  expect(res.status).toBe(201);
  return res.body.data;
}
async function layPhieuTrongBang(bangId, nhanVienId) {
  const res = await goi('get', `/bangLuong/${bangId}?kichThuoc=100`, token.hr);
  expect(res.status).toBe(200);
  return res.body.data.items.find((p) => p.nhanVienId === nhanVienId);
}
async function thangHienTaiDb() {
  const [[d]] = await pool.query("SELECT DATE_FORMAT(NOW(), '%Y-%m') AS t");
  return d.t;
}
async function chenBangThangHienTai(trangThai) {
  const thang = await thangHienTaiDb();
  const [nam, so] = thang.split('-').map(Number);
  const [kq] = await pool.execute('INSERT INTO bangtonghopluong (maBangLuong, thang, nam, trangThai, nguoiLapId) VALUES (?, ?, ?, ?, 4)', [
    `BL${thang}`,
    so,
    nam,
    trangThai,
  ]);
  return { id: kq.insertId, thang };
}

// Phiếu KPI CHO_DUYET qua API: kỳ quý 2061+ (3 tháng), NV0005 tự chấm và gửi
async function phieuKpiChoDuyetQuaApi() {
  demMa += 1;
  const nam = 2060 + demMa;
  const ky = await goi('post', '/kyDanhGiaKPI', token.hr).send({
    tenKyDanhGia: `QA KPI lương ${Date.now() % 100000}-${demMa}`,
    ngayBatDau: `${nam}-01-01`,
    ngayKetThuc: `${nam}-03-31`,
  });
  expect(ky.status).toBe(201);
  const tao = await goi('post', '/phieuDanhGiaKPI', token.hr).send({ kyDanhGiaId: ky.body.data.id, nhanVienId: NV_NHANVIEN });
  expect(tao.status).toBe(201);
  const phieu = tao.body.data;
  const r1 = await goi('patch', `/phieuDanhGiaKPI/${phieu.id}/tuCham`, token.nhanvien).send({
    giaiTrinhNhanVien: 'Đã làm',
    chiTiet: phieu.chiTiet.map((c) => ({ id: c.id, diemTuCham: 8, ketQuaThucTe: 'Đạt' })),
  });
  expect(r1.status).toBe(200);
  const r2 = await goi('post', `/phieuDanhGiaKPI/${phieu.id}/guiDuyet`, token.nhanvien);
  expect(r2.status).toBe(200);
  return { ky: ky.body.data, phieu: r2.body.data };
}
// Điểm 9 mọi mục -> XUAT_SAC
const bodyNghiemThu = (phieu) => ({
  nhanXetQuanLy: 'Tốt',
  chiTiet: phieu.chiTiet.map((c) => ({ id: c.id, diemNghiemThu: 9, nhanXet: 'OK' })),
});

const BANG_DAT_LAI = [
  'bangtonghopluong',
  'phieuluongnhanvien',
  'quyetdinhkhenthuongkyluat',
  'chitietdanhgiakpi',
  'phieudanhgiakpi',
  'kydanhgiakpi',
  'hopdonglaodong',
  'nhanvien',
  'banghichamcong',
  'nhatkyhethong',
];
async function datLaiAutoIncrement() {
  for (const bang of BANG_DAT_LAI) await pool.query(`ALTER TABLE ${bang} AUTO_INCREMENT = 1`);
}

beforeAll(async () => {
  anhChup = {};
  for (const bang of BANG_DAT_LAI) anhChup[bang] = (await pool.query(`SELECT COALESCE(MAX(id), 0) AS m FROM ${bang}`))[0][0].m;
  for (const ten of ['hr', 'giamdoc', 'quanly', 'nhanvien']) {
    const res = await request(app).post('/api/v1/xacThuc/dangNhap').set('X-Tra-Token', '1').send({ tenDangNhap: ten, matKhau: MAT_KHAU });
    expect(res.status).toBe(200);
    token[ten] = res.body.data.token;
  }
});

beforeEach(async () => {
  const [[m]] = await pool.query('SELECT COALESCE(MAX(id), 0) AS m FROM nhatkyhethong');
  mocNhatKy = m.m;
});

afterEach(async () => {
  await pool.execute('DELETE FROM bangtonghopluong WHERE id > ?', [anhChup.bangtonghopluong]); // phiếu CASCADE
  await pool.execute('DELETE FROM phieuluongnhanvien WHERE id > ?', [anhChup.phieuluongnhanvien]);
  await pool.execute('DELETE FROM phieudanhgiakpi WHERE id > ?', [anhChup.phieudanhgiakpi]); // chi tiết CASCADE
  for (const bang of ['chitietdanhgiakpi', 'kydanhgiakpi', 'quyetdinhkhenthuongkyluat', 'banghichamcong', 'hopdonglaodong', 'nhanvien']) {
    await pool.execute(`DELETE FROM ${bang} WHERE id > ?`, [anhChup[bang]]);
  }
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [mocNhatKy]);
  await datLaiAutoIncrement();
});

afterAll(async () => {
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [anhChup.nhatkyhethong]);
  await datLaiAutoIncrement();
  await pool.end();
});

// ---------------------------------------------------------------------------
describe('Unit tinhThuongKpi / demSoThangKy', () => {
  test('hệ số từng xếp loại với kỳ 1 tháng, lương 10 triệu', () => {
    expect(tinhThuongKpi('XUAT_SAC', 10000000, 1)).toBe(1300000);
    expect(tinhThuongKpi('TOT', 10000000, 1)).toBe(1100000);
    expect(tinhThuongKpi('KHA', 10000000, 1)).toBe(1000000);
    expect(tinhThuongKpi('TRUNG_BINH', 10000000, 1)).toBe(500000);
    expect(tinhThuongKpi('YEU', 10000000, 1)).toBe(0);
  });
  test('kỳ quý nhân 3, lương dạng chuỗi DECIMAL, làm tròn đồng', () => {
    expect(tinhThuongKpi('XUAT_SAC', '10000000.00', 3)).toBe(3900000);
    expect(tinhThuongKpi('TOT', 12345678, 3)).toBe(Math.round(1.1 * 12345678 * 0.1 * 3));
  });
  test('xếp loại lạ / null -> 0', () => {
    expect(tinhThuongKpi('LA_LUNG', 10000000, 3)).toBe(0);
    expect(tinhThuongKpi(null, 10000000, 3)).toBe(0);
    expect(tinhThuongKpi(undefined, 10000000, 3)).toBe(0);
  });
  test('đếm số tháng kỳ: quý = 3, một tháng = 1, qua năm, tối thiểu 1', () => {
    expect(demSoThangKy('2020-01-01', '2020-03-31')).toBe(3);
    expect(demSoThangKy('2020-03-01', '2020-03-31')).toBe(1);
    expect(demSoThangKy('2020-11-01', '2021-01-31')).toBe(3);
    expect(demSoThangKy('2020-01-01', '2020-12-31')).toBe(12);
    expect(demSoThangKy('2020-05-10', '2020-05-10')).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe('Lập bảng lương cộng thưởng KPI', () => {
  test('thuongKPI = thưởng KPI (2 phiếu trong tháng) + khen thưởng − kỷ luật; bỏ phiếu CHO_DUYET và nghiệm thu tháng khác', async () => {
    const nv = await chenNhanVien(10000000);
    const nvKhac = await chenNhanVien(20000000);
    await chenPhieuKpi(await chenKy('2020-01-01', '2020-03-31'), nv.id, 'XUAT_SAC', '2020-04-10 09:00:00'); // 3.900.000
    await chenPhieuKpi(await chenKy('2020-03-01', '2020-03-31'), nv.id, 'KHA', '2020-04-30 23:30:00'); // 1.000.000 (cuối tháng)
    await chenPhieuKpi(await chenKy('2019-10-01', '2019-12-31'), nv.id, 'TOT', '2020-04-15 09:00:00', 'CHO_DUYET'); // không tính
    await chenPhieuKpi(await chenKy('2019-07-01', '2019-09-30'), nv.id, 'TOT', '2020-05-01 00:00:00'); // tháng khác
    await chenPhieuKpi(await chenKy('2019-04-01', '2019-06-30'), nv.id, 'TOT', '2020-03-31 23:59:59'); // tháng khác
    await chenPhieuKpi(await chenKy('2019-01-01', '2019-03-31'), nvKhac.id, 'TRUNG_BINH', '2020-04-05 09:00:00'); // 3.000.000
    await chenQuyetDinh(nv.id, 'KHEN_THUONG', 500000, '2020-04-12');
    await chenQuyetDinh(nv.id, 'KY_LUAT', 200000, '2020-04-13');

    const bang = await lapBangOk('2020-04');
    const [[p]] = await pool.execute('SELECT thuongKPI FROM phieuluongnhanvien WHERE bangTongHopLuongId = ? AND nhanVienId = ?', [
      bang.id,
      nv.id,
    ]);
    expect(Number(p.thuongKPI)).toBe(3900000 + 1000000 + 500000 - 200000);
    const [[pk]] = await pool.execute('SELECT thuongKPI FROM phieuluongnhanvien WHERE bangTongHopLuongId = ? AND nhanVienId = ?', [
      bang.id,
      nvKhac.id,
    ]);
    expect(Number(pk.thuongKPI)).toBe(3000000);

    const doc = await layPhieuTrongBang(bang.id, nv.id);
    expect(doc).toMatchObject({ thuongKpi: 4900000, thuongPhatKhac: 300000 });
    expect(Number(doc.thuongKPI)).toBe(5200000);
    expect(await layPhieuTrongBang(bang.id, nvKhac.id)).toMatchObject({ thuongKpi: 3000000, thuongPhatKhac: 0 });
  });

  test('tính lại bảng nháp vẫn giữ thưởng KPI; nhân viên không có phiếu KPI -> thuongKpi 0', async () => {
    const nv = await chenNhanVien(10000000);
    const nvKhong = await chenNhanVien(10000000);
    await chenPhieuKpi(await chenKy('2020-04-01', '2020-04-30'), nv.id, 'TOT', '2020-05-08 10:00:00');
    const bang = await lapBangOk('2020-05');
    const tl = await goi('post', `/bangLuong/${bang.id}/tinhLai`, token.hr);
    expect(tl.status).toBe(200);
    expect(await layPhieuTrongBang(bang.id, nv.id)).toMatchObject({ thuongKpi: 1100000, thuongPhatKhac: 0 });
    expect(await layPhieuTrongBang(bang.id, nvKhong.id)).toMatchObject({ thuongKpi: 0, thuongPhatKhac: 0 });
  });
});

// ---------------------------------------------------------------------------
describe('Đọc phiếu lương có tách thưởng KPI', () => {
  test('HR PATCH sửa tay thuongKPI: thuongKpi giữ nguyên, thuongPhatKhac = phần chênh; GET phiếu đúng', async () => {
    const nv = await chenNhanVien(10000000);
    await chenPhieuKpi(await chenKy('2020-01-01', '2020-03-31'), nv.id, 'XUAT_SAC', '2020-04-10 09:00:00');
    const bang = await lapBangOk('2020-04');
    const truoc = await layPhieuTrongBang(bang.id, nv.id);
    const sua = await goi('patch', `/phieuLuong/${truoc.id}`, token.hr).send({ thuongKPI: 4500000 });
    expect(sua.status).toBe(200);
    expect(sua.body.data).toMatchObject({ thuongKpi: 3900000, thuongPhatKhac: 600000 });
    const get = await goi('get', `/phieuLuong/${truoc.id}`, token.hr);
    expect(get.status).toBe(200);
    expect(get.body).toMatchObject({ success: true, code: 200, data: { thuongKpi: 3900000, thuongPhatKhac: 600000 } });
    // Sửa tay xuống dưới thưởng KPI -> phần khác âm
    const sua2 = await goi('patch', `/phieuLuong/${truoc.id}`, token.hr).send({ thuongKPI: 3000000 });
    expect(sua2.body.data).toMatchObject({ thuongKpi: 3900000, thuongPhatKhac: -900000 });
  });

  test('nhanVien chỉ thấy phiếu của mình khi bảng DA_DUYET, có tách thưởng; phiếu người khác 404', async () => {
    const nvKhac = await chenNhanVien(10000000);
    const [bq] = await pool.execute(
      "INSERT INTO bangtonghopluong (maBangLuong, thang, nam, trangThai, nguoiLapId) VALUES ('BL2020-06', 6, 2020, 'BAN_NHAP', 4)",
    );
    const chenPhieuLuong = async (nhanVienId, luong, thuong) =>
      (
        await pool.execute(
          `INSERT INTO phieuluongnhanvien (bangTongHopLuongId, nhanVienId, soNgayCongThucTe, luongCoBan, luongLamThemOT, thuongKPI,
         tongPhuCap, khauTruBaoHiem, khauTruThueTNCN) VALUES (?, ?, 22, ?, 0, ?, 0, 0, 0)`,
          [bq.insertId, nhanVienId, luong, thuong],
        )
      )[0].insertId;
    const phieuToi = await chenPhieuLuong(NV_NHANVIEN, 12000000, 1820000);
    const phieuKhac = await chenPhieuLuong(nvKhac.id, 10000000, 0);
    await chenPhieuKpi(await chenKy('2020-05-01', '2020-05-31'), NV_NHANVIEN, 'TOT', '2020-06-15 10:00:00'); // 1.320.000

    expect((await goi('get', `/phieuLuong/${phieuToi}`, token.nhanvien)).status).toBe(404); // bảng chưa duyệt
    await pool.execute("UPDATE bangtonghopluong SET trangThai = 'DA_DUYET', nguoiDuyetId = 2 WHERE id = ?", [bq.insertId]);
    const toi = await goi('get', `/phieuLuong/${phieuToi}`, token.nhanvien);
    expect(toi.status).toBe(200);
    expect(toi.body.data).toMatchObject({ nhanVienId: NV_NHANVIEN, thuongKpi: 1320000, thuongPhatKhac: 500000 });
    const ds = await goi('get', '/phieuLuong/cuaToi?nam=2020', token.nhanvien);
    expect(ds.status).toBe(200);
    expect(ds.body.data).toHaveLength(1);
    expect(ds.body.data[0]).toMatchObject({ id: phieuToi, thuongKpi: 1320000, thuongPhatKhac: 500000 });
    const khac = await goi('get', `/phieuLuong/${phieuKhac}`, token.nhanvien);
    expect(khac.status).toBe(404);
    expect(khac.body).toMatchObject({ success: false, code: 404, data: null });
  });

  test('xuất CSV có 2 cột "Trong đó thưởng KPI", "Trong đó khen thưởng - kỷ luật" đúng giá trị', async () => {
    const nv = await chenNhanVien(10000000);
    await chenPhieuKpi(await chenKy('2020-01-01', '2020-03-31'), nv.id, 'XUAT_SAC', '2020-04-10 09:00:00');
    await chenQuyetDinh(nv.id, 'KY_LUAT', 400000, '2020-04-20');
    const bang = await lapBangOk('2020-04');
    const res = await docText(goi('get', `/bangLuong/${bang.id}/xuatExcel`, token.giamdoc));
    expect(res.status).toBe(200);
    const dong = res.body
      .replace(/^\uFEFF/, '')
      .trim()
      .split('\r\n')
      .map((d) => d.split(','));
    const tieuDe = dong[0];
    const iThuong = tieuDe.indexOf('Thưởng/Phạt');
    expect(tieuDe.slice(iThuong, iThuong + 3)).toEqual(['Thưởng/Phạt', 'Trong đó thưởng KPI', 'Trong đó khen thưởng - kỷ luật']);
    expect(tieuDe).toHaveLength(17);
    const cua = dong.find((d) => d[0] === nv.maNhanVien);
    expect(cua).toBeDefined();
    expect(cua.slice(iThuong, iThuong + 3).map(Number)).toEqual([3500000, 3900000, -400000]);
  });
});

// ---------------------------------------------------------------------------
describe('Nghiệm thu KPI khi đã có bảng lương tháng hiện tại', () => {
  test('bảng BAN_NHAP -> cộng thưởng KPI vào đúng phiếu, giữ chỉnh sửa tay, nhật ký TINH_LAI_BANG_LUONG_KPI', async () => {
    const { phieu } = await phieuKpiChoDuyetQuaApi();
    const bang = await chenBangThangHienTai('BAN_NHAP');
    // Phiếu lương nháp của NV0005 với phụ cấp HR đã sửa tay (123456) và thưởng/phạt có sẵn 50000
    const [[hd]] = await pool.execute(
      "SELECT luongCoBan FROM hopdonglaodong WHERE nhanVienId = ? AND trangThai = 'HIEU_LUC' ORDER BY ngayBatDau DESC LIMIT 1",
      [NV_NHANVIEN],
    );
    await pool.execute(
      `INSERT INTO phieuluongnhanvien (bangTongHopLuongId, nhanVienId, soNgayCongThucTe, luongCoBan, luongLamThemOT, thuongKPI, tongPhuCap,
        khauTruBaoHiem, khauTruThueTNCN) VALUES (?, ?, 20, ?, 0, 50000, 123456, 0, 0)`,
      [bang.id, NV_NHANVIEN, hd.luongCoBan],
    );
    const res = await goi('post', `/phieuDanhGiaKPI/${phieu.id}/nghiemThu`, token.quanly).send(bodyNghiemThu(phieu));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ trangThai: 'DA_DUYET', xepLoaiChung: 'XUAT_SAC' });
    expect(res.body.message).toContain(`bảng lương nháp BL${bang.thang}`);
    expect(await layNhatKy('TINH_LAI_BANG_LUONG_KPI')).toHaveLength(1);

    const p = await layPhieuTrongBang(bang.id, NV_NHANVIEN);
    expect(p).toBeDefined();
    // Kỳ quý 3 tháng, XUAT_SAC: chỉ cộng thêm đúng thưởng của phiếu vừa nghiệm thu
    expect(Number(p.thuongKPI)).toBe(50000 + tinhThuongKpi('XUAT_SAC', p.luongCoBan, 3));
    expect(Number(p.tongPhuCap)).toBe(123456);
    expect(Number(p.soNgayCongThucTe)).toBe(20);
  });

  test('bảng CHO_DUYET -> 409, phiếu KPI giữ CHO_DUYET, không sinh phiếu lương', async () => {
    const { phieu } = await phieuKpiChoDuyetQuaApi();
    const bang = await chenBangThangHienTai('CHO_DUYET');
    const res = await goi('post', `/phieuDanhGiaKPI/${phieu.id}/nghiemThu`, token.quanly).send(bodyNghiemThu(phieu));
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: 409, data: null });
    const [[k]] = await pool.execute('SELECT trangThai, ngayNghiemThu FROM phieudanhgiakpi WHERE id = ?', [phieu.id]);
    expect(k).toEqual({ trangThai: 'CHO_DUYET', ngayNghiemThu: null });
    const [[d]] = await pool.execute('SELECT COUNT(*) AS n FROM phieuluongnhanvien WHERE bangTongHopLuongId = ?', [bang.id]);
    expect(d.n).toBe(0);
    expect(await layNhatKy('NGHIEM_THU_KPI')).toHaveLength(0);
  });

  test('bảng DA_DUYET -> 409', async () => {
    const { phieu } = await phieuKpiChoDuyetQuaApi();
    await chenBangThangHienTai('DA_DUYET');
    const res = await goi('post', `/phieuDanhGiaKPI/${phieu.id}/nghiemThu`, token.quanly).send(bodyNghiemThu(phieu));
    expect(res.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
describe('Sửa kỳ KPI đã có phiếu nghiệm thu', () => {
  test('đổi ngày -> 409, ngày không đổi; đổi tên vẫn được', async () => {
    const { ky } = await phieuKpiChoDuyetQuaApi();
    await pool.execute(
      "UPDATE phieudanhgiakpi SET trangThai = 'DA_DUYET', xepLoaiChung = 'TOT', ngayNghiemThu = '2020-04-10 09:00:00' WHERE kyDanhGiaId = ?",
      [ky.id],
    );
    const nam = ky.ngayBatDau.slice(0, 4);
    const r1 = await goi('patch', `/kyDanhGiaKPI/${ky.id}`, token.hr).send({ ngayKetThuc: `${nam}-06-30` });
    expect(r1.status).toBe(409);
    expect(r1.body).toMatchObject({ success: false, code: 409, data: null });
    expect((await goi('patch', `/kyDanhGiaKPI/${ky.id}`, token.hr).send({ ngayBatDau: `${nam}-02-01` })).status).toBe(409);
    const [[k]] = await pool.execute('SELECT ngayBatDau, ngayKetThuc FROM kydanhgiakpi WHERE id = ?', [ky.id]);
    expect(k).toEqual({ ngayBatDau: `${nam}-01-01`, ngayKetThuc: `${nam}-03-31` });
    const r2 = await goi('patch', `/kyDanhGiaKPI/${ky.id}`, token.hr).send({ tenKyDanhGia: `${ky.tenKyDanhGia} đổi tên` });
    expect(r2.status).toBe(200);
    expect(r2.body.data.tenKyDanhGia).toBe(`${ky.tenKyDanhGia} đổi tên`);
  });

  test('kỳ chỉ có phiếu CHO_DUYET vẫn đổi ngày được', async () => {
    const { ky } = await phieuKpiChoDuyetQuaApi();
    const nam = ky.ngayBatDau.slice(0, 4);
    const res = await goi('patch', `/kyDanhGiaKPI/${ky.id}`, token.hr).send({ ngayKetThuc: `${nam}-06-30` });
    expect(res.status).toBe(200);
  });
});
