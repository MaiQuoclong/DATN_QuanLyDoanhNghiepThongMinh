const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/ketNoiCsdl');

// Dữ liệu mẫu (database/seed.sql mục 12, 14): quyết định 1 (NV0005), 2 (NV0010), 3 (NV0007) ngày @thu2ThangChot;
// đề xuất 1 (quanly -> NV5, CHO_DUYET), 2 (quanly2 -> NV10, CHO_DUYET), 3 TU_CHOI, 4 DA_DUYET -> quyết định 3.
// Test tự tạo dữ liệu riêng, ngày ban hành năm 2020/2021 (seed không có bảng lương các năm này) và dọn trong afterEach.
const MAT_KHAU = 'MatKhau@123';
const NV_ADMIN = 1;
const NV_GIAMDOC = 2;
const NV_QUANLY = 3;
const NV_HR = 4;
const NV_NHANVIEN = 5;
const NV_NHANVIEN2 = 6;
const NV_GIAMDOC2 = 8;
const NV_NHANVIEN3 = 10;
const NGAY_QUA_KHU = '2021-03-15';

const token = {};
let anhChup;
let mocNhatKy;

function dangNhap(tenDangNhap) {
  return request(app).post('/api/v1/xacThuc/dangNhap').set('X-Tra-Token', '1').send({ tenDangNhap, matKhau: MAT_KHAU });
}
const goi = (phuongThuc, duongDan, tk) => {
  const r = request(app)[phuongThuc](`/api/v1${duongDan}`);
  return tk ? r.set('Authorization', `Bearer ${tk}`) : r;
};
// Ký như frontend: lấy ngayCapNhat của bản đang xem rồi gửi kèm
async function kyDaXem(id, tk, body = {}) {
  const xem = await goi('get', `/deXuatKhenThuongKyLuat/${id}`, tk);
  return goi('post', `/deXuatKhenThuongKyLuat/${id}/ky`, tk).send({ ...body, ngayCapNhat: xem.body.data?.ngayCapNhat });
}
async function layNhatKy(hanhDong) {
  const [d] = await pool.execute('SELECT nguoiDungId, chiTiet FROM nhatkyhethong WHERE id > ? AND hanhDong = ? ORDER BY id', [
    mocNhatKy,
    hanhDong,
  ]);
  return d;
}
const bodyDeXuat = (ghiDe = {}) => ({
  nhanVienId: NV_NHANVIEN,
  loaiDeXuat: 'KHEN_THUONG',
  tieuDe: 'QA khen thưởng',
  lyDo: 'Hoàn thành tốt nhiệm vụ',
  soTienDeXuat: 700000,
  ...ghiDe,
});
async function taoDeXuat(tk = token.quanly, ghiDe = {}) {
  const res = await goi('post', '/deXuatKhenThuongKyLuat', tk).send(bodyDeXuat(ghiDe));
  expect(res.status).toBe(201);
  return res.body.data;
}
const bodyQuyetDinh = (ghiDe = {}) => ({
  nhanVienId: NV_NHANVIEN,
  loaiQuyetDinh: 'KHEN_THUONG',
  tieuDe: 'QA quyết định',
  lyDo: 'Thành tích tốt',
  soTien: 400000,
  ngayBanHanh: NGAY_QUA_KHU,
  nguoiKyDuyetId: NV_GIAMDOC,
  ...ghiDe,
});
// HR trình Giám đốc ký đề xuất
const trinhKy = (id, nguoiKyDuyetId = NV_GIAMDOC, ghiDe = {}, tk = token.hr) =>
  goi('post', `/deXuatKhenThuongKyLuat/${id}/trinhKy`, tk).send({ nguoiKyDuyetId, ...ghiDe });
const homNay = () => new Date().toLocaleDateString('sv-SE');
async function layDeXuatDb(id) {
  const [[d]] = await pool.execute('SELECT * FROM dexuatkhenthuongkyluat WHERE id = ?', [id]);
  return d;
}
async function demQuyetDinh() {
  const [[d]] = await pool.query('SELECT COUNT(*) AS n FROM quyetdinhkhenthuongkyluat');
  return Number(d.n);
}

const BANG_DAT_LAI = ['dexuatkhenthuongkyluat', 'quyetdinhkhenthuongkyluat', 'phieuluongnhanvien', 'bangtonghopluong', 'nhatkyhethong'];
async function datLaiAutoIncrement() {
  for (const bang of BANG_DAT_LAI) await pool.query(`ALTER TABLE ${bang} AUTO_INCREMENT = 1`);
}

beforeAll(async () => {
  anhChup = {};
  for (const bang of BANG_DAT_LAI) {
    anhChup[bang] = (await pool.query(`SELECT COALESCE(MAX(id), 0) AS m FROM ${bang}`))[0][0].m;
  }
  const [dx] = await pool.query('SELECT * FROM dexuatkhenthuongkyluat WHERE id <= ?', [anhChup.dexuatkhenthuongkyluat]);
  anhChup.deXuatSeed = dx;
  for (const ten of ['admin', 'giamdoc', 'giamdoc2', 'quanly', 'quanly2', 'hr', 'hr2', 'nhanvien', 'nhanvien2', 'nhanvien3']) {
    const res = await dangNhap(ten);
    expect(res.status).toBe(200);
    token[ten] = res.body.data.token;
  }
});

beforeEach(async () => {
  const [[m]] = await pool.query('SELECT COALESCE(MAX(id), 0) AS m FROM nhatkyhethong');
  mocNhatKy = m.m;
});

afterEach(async () => {
  await pool.execute('DELETE FROM dexuatkhenthuongkyluat WHERE id > ?', [anhChup.dexuatkhenthuongkyluat]);
  await pool.execute('DELETE FROM quyetdinhkhenthuongkyluat WHERE id > ?', [anhChup.quyetdinhkhenthuongkyluat]);
  await pool.execute('DELETE FROM phieuluongnhanvien WHERE id > ?', [anhChup.phieuluongnhanvien]);
  await pool.execute('DELETE FROM bangtonghopluong WHERE id > ?', [anhChup.bangtonghopluong]);
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [mocNhatKy]);
  // Khôi phục đề xuất seed nếu test có đổi
  for (const d of anhChup.deXuatSeed) {
    await pool.execute(
      'UPDATE dexuatkhenthuongkyluat SET trangThai = ?, nguoiXuLyId = ?, ghiChuXuLy = ?, quyetDinhId = ?, tieuDe = ?, lyDo = ?, soTienDeXuat = ? WHERE id = ?',
      [d.trangThai, d.nguoiXuLyId, d.ghiChuXuLy, d.quyetDinhId, d.tieuDe, d.lyDo, d.soTienDeXuat, d.id],
    );
  }
  await datLaiAutoIncrement();
});

afterAll(async () => {
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [anhChup.nhatkyhethong]);
  await datLaiAutoIncrement();
  await pool.end();
});

// ---------------------------------------------------------------------------
describe('Đề xuất khen thưởng/kỷ luật - quyền và xem', () => {
  test('chưa đăng nhập 401, nhanVien/Admin bị 403', async () => {
    const r = await goi('get', '/deXuatKhenThuongKyLuat');
    expect(r.status).toBe(401);
    expect(r.body).toMatchObject({ success: false, code: 401, data: null });
    expect((await goi('get', '/deXuatKhenThuongKyLuat', token.nhanvien)).status).toBe(403);
    expect((await goi('get', '/deXuatKhenThuongKyLuat', token.admin)).status).toBe(403);
    // HR lập trực tiếp bắt buộc chọn Giám đốc ký
    expect((await goi('post', '/deXuatKhenThuongKyLuat', token.hr).send(bodyDeXuat())).status).toBe(400);
    expect((await goi('post', '/deXuatKhenThuongKyLuat', token.nhanvien).send(bodyDeXuat({ nhanVienId: NV_NHANVIEN2 }))).status).toBe(403);
  });

  test('HR/giamDoc xem toàn bộ, quanLy chỉ đề xuất do mình tạo, có phân trang', async () => {
    const hr = await goi('get', '/deXuatKhenThuongKyLuat', token.hr);
    expect(hr.status).toBe(200);
    expect(hr.body).toMatchObject({ success: true, code: 200 });
    expect(hr.body.data.phanTrang).toMatchObject({ trang: 1 });
    const idsHr = hr.body.data.items.map((d) => d.id);
    expect(idsHr).toEqual(expect.arrayContaining([1, 2, 3, 4]));
    const gd = await goi('get', '/deXuatKhenThuongKyLuat', token.giamdoc);
    expect(gd.body.data.items.map((d) => d.id)).toEqual(expect.arrayContaining([1, 2, 3, 4]));
    const ql = await goi('get', '/deXuatKhenThuongKyLuat', token.quanly);
    const idsQl = ql.body.data.items.map((d) => d.id);
    expect(idsQl).toEqual(expect.arrayContaining([1, 3]));
    expect(idsQl).not.toContain(2);
    expect(ql.body.data.items.every((d) => d.nguoiDeXuatId === NV_QUANLY)).toBe(true);
    const loc = await goi('get', '/deXuatKhenThuongKyLuat?trangThai=TU_CHOI', token.hr);
    expect(loc.body.data.items.every((d) => d.trangThai === 'TU_CHOI')).toBe(true);
    expect((await goi('get', '/deXuatKhenThuongKyLuat?trangThai=PENDING', token.hr)).status).toBe(400);
  });

  test('GET /:id ngoài phạm vi 404, id sai 400', async () => {
    expect((await goi('get', '/deXuatKhenThuongKyLuat/1', token.quanly)).status).toBe(200);
    expect((await goi('get', '/deXuatKhenThuongKyLuat/2', token.quanly)).status).toBe(404);
    expect((await goi('get', '/deXuatKhenThuongKyLuat/2', token.hr)).status).toBe(200);
    expect((await goi('get', '/deXuatKhenThuongKyLuat/999999', token.hr)).status).toBe(404);
    expect((await goi('get', '/deXuatKhenThuongKyLuat/abc', token.hr)).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
describe('Đề xuất - tạo, sửa, thu hồi', () => {
  test('quanLy tạo đề xuất trong PM thành công 201, CHO_DUYET, ghi nhật ký', async () => {
    const res = await goi('post', '/deXuatKhenThuongKyLuat', token.quanly).send(bodyDeXuat());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, code: 201 });
    expect(res.body.data).toMatchObject({
      nguoiDeXuatId: NV_QUANLY,
      nhanVienId: NV_NHANVIEN,
      trangThai: 'CHO_DUYET',
      loaiDeXuat: 'KHEN_THUONG',
    });
    const nk = await layNhatKy('TAO_DE_XUAT_KTKL');
    expect(nk).toHaveLength(1);
    expect(nk[0].nguoiDungId).toBe(3);
  });

  test('giamDoc đề xuất cho nhân viên bất kỳ phòng ban', async () => {
    const dx = await taoDeXuat(token.giamdoc, { nhanVienId: NV_NHANVIEN3, loaiDeXuat: 'KY_LUAT' });
    expect(dx).toMatchObject({ nguoiDeXuatId: NV_GIAMDOC, nhanVienId: NV_NHANVIEN3, loaiDeXuat: 'KY_LUAT' });
  });

  test('dữ liệu sai 400', async () => {
    const sai = [
      { nhanVienId: 'x' },
      { loaiDeXuat: 'THUONG' },
      { tieuDe: '' },
      { tieuDe: 'ab' },
      { lyDo: '' },
      { soTienDeXuat: -1 },
      { soTienDeXuat: '1.234' },
      { soTienDeXuat: 'abc' },
      { tieuDe: 'a'.repeat(201) },
    ];
    for (const ghiDe of sai) {
      const res = await goi('post', '/deXuatKhenThuongKyLuat', token.quanly).send(bodyDeXuat(ghiDe));
      expect([ghiDe, res.status]).toEqual([ghiDe, 400]);
      expect(res.body).toMatchObject({ success: false, code: 400, data: null });
    }
    expect((await goi('post', '/deXuatKhenThuongKyLuat', token.quanly).send(bodyDeXuat({ nhanVienId: NV_QUANLY }))).status).toBe(400);
  });

  test('quanLy đề xuất nhân viên ngoài phòng 404, không tồn tại 404', async () => {
    expect((await goi('post', '/deXuatKhenThuongKyLuat', token.quanly).send(bodyDeXuat({ nhanVienId: NV_NHANVIEN3 }))).status).toBe(404);
    expect((await goi('post', '/deXuatKhenThuongKyLuat', token.quanly2).send(bodyDeXuat({ nhanVienId: NV_NHANVIEN }))).status).toBe(404);
    expect((await goi('post', '/deXuatKhenThuongKyLuat', token.giamdoc).send(bodyDeXuat({ nhanVienId: 999999 }))).status).toBe(404);
  });

  test('nhân viên đã nghỉ việc 409', async () => {
    const [kq] = await pool.execute(
      `INSERT INTO nhanvien (maNhanVien, hoVaTen, gioiTinh, ngaySinh, chucDanhPhongBanId, ngayVaoLam, trangThaiLamViec)
       VALUES (?, 'QA Nghỉ việc', 'NAM', '1995-01-01', 5, '2020-01-06', 'DA_NGHI_VIEC')`,
      [`QK${Date.now() % 100000}`],
    );
    try {
      const res = await goi('post', '/deXuatKhenThuongKyLuat', token.quanly).send(bodyDeXuat({ nhanVienId: kq.insertId }));
      expect(res.status).toBe(409);
      expect((await goi('post', '/quyetDinhKhenThuongKyLuat', token.giamdoc).send(bodyQuyetDinh({ nhanVienId: kq.insertId }))).status).toBe(
        409,
      );
    } finally {
      await pool.execute('DELETE FROM nhanvien WHERE id = ?', [kq.insertId]);
      await pool.query('ALTER TABLE nhanvien AUTO_INCREMENT = 1');
    }
  });

  test('PATCH: người tạo sửa được, người khác 403, ngoài phạm vi 404, đã xử lý 409', async () => {
    const dx = await taoDeXuat();
    const ok = await goi('patch', `/deXuatKhenThuongKyLuat/${dx.id}`, token.quanly).send({ tieuDe: 'Tiêu đề mới', soTienDeXuat: 900000 });
    expect(ok.status).toBe(200);
    expect(ok.body.data.tieuDe).toBe('Tiêu đề mới');
    expect(Number(ok.body.data.soTienDeXuat)).toBe(900000);
    expect(await layNhatKy('SUA_DE_XUAT_KTKL')).toHaveLength(1);
    expect((await goi('patch', `/deXuatKhenThuongKyLuat/${dx.id}`, token.quanly).send({})).status).toBe(400);
    expect((await goi('patch', `/deXuatKhenThuongKyLuat/${dx.id}`, token.giamdoc).send({ tieuDe: 'GĐ sửa' })).status).toBe(403);
    expect((await goi('patch', `/deXuatKhenThuongKyLuat/${dx.id}`, token.quanly2).send({ tieuDe: 'QL2 sửa' })).status).toBe(404);
    expect((await goi('patch', `/deXuatKhenThuongKyLuat/${dx.id}`, token.hr).send({ tieuDe: 'HR sửa' })).status).toBe(403);
    expect((await goi('patch', '/deXuatKhenThuongKyLuat/3', token.quanly).send({ tieuDe: 'Sửa đề xuất đã từ chối' })).status).toBe(409);
    expect((await layDeXuatDb(3)).tieuDe).toBe(anhChup.deXuatSeed.find((d) => d.id === 3).tieuDe);
  });

  test('DELETE: người tạo thu hồi CHO_DUYET, đã xử lý 409, người khác 403', async () => {
    const dx = await taoDeXuat();
    expect((await goi('delete', `/deXuatKhenThuongKyLuat/${dx.id}`, token.giamdoc)).status).toBe(403);
    const ok = await goi('delete', `/deXuatKhenThuongKyLuat/${dx.id}`, token.quanly);
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ success: true, data: null });
    expect(await layDeXuatDb(dx.id)).toBeUndefined();
    expect(await layNhatKy('XOA_DE_XUAT_KTKL')).toHaveLength(1);
    expect((await goi('delete', '/deXuatKhenThuongKyLuat/3', token.quanly)).status).toBe(409);
    expect((await goi('delete', '/deXuatKhenThuongKyLuat/4', token.giamdoc)).status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
describe('Đề xuất - HR từ chối và lập quyết định', () => {
  test('từ chối: bắt buộc ghiChuXuLy 400, thành công TU_CHOI, lần 2 409, sai vai trò 403', async () => {
    const dx = await taoDeXuat();
    expect((await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/tuChoi`, token.hr).send({})).status).toBe(400);
    expect(
      (await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/tuChoi`, token.giamdoc).send({ ghiChuXuLy: 'Không đủ căn cứ' })).status,
    ).toBe(403);
    const ok = await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/tuChoi`, token.hr).send({ ghiChuXuLy: 'Không đủ căn cứ' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ trangThai: 'TU_CHOI', nguoiXuLyId: NV_HR, ghiChuXuLy: 'Không đủ căn cứ' });
    expect(await layNhatKy('TU_CHOI_DE_XUAT_KTKL')).toHaveLength(1);
    expect((await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/tuChoi`, token.hr).send({ ghiChuXuLy: 'Lần hai' })).status).toBe(409);
    expect((await goi('post', '/deXuatKhenThuongKyLuat/999999/tuChoi', token.hr).send({ ghiChuXuLy: 'Không có' })).status).toBe(404);
  });

  test('lập quyết định từ đề xuất qua trinhKy -> ky 201: số QĐ tự sinh, đề xuất DA_DUYET', async () => {
    const dx = await taoDeXuat();
    expect((await trinhKy(dx.id)).status).toBe(200);
    const res = await kyDaXem(dx.id, token.giamdoc, { ghiChuXuLy: 'Đồng ý' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, code: 201 });
    const qd = res.body.data.quyetDinh;
    expect(qd).toMatchObject({
      nhanVienId: NV_NHANVIEN,
      loaiQuyetDinh: 'KHEN_THUONG',
      tieuDe: 'QA khen thưởng',
      nguoiKyDuyetId: NV_GIAMDOC,
    });
    expect(qd.soQuyetDinh).toMatch(new RegExp(`^QD${homNay().slice(0, 4)}-\\d{4}$`));
    expect(Number(qd.soTien)).toBe(700000);
    expect(await layDeXuatDb(dx.id)).toMatchObject({
      trangThai: 'DA_DUYET',
      quyetDinhId: qd.id,
      nguoiXuLyId: NV_GIAMDOC,
      ghiChuXuLy: 'Đồng ý',
    });
    expect((await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/ky`, token.giamdoc).send({})).status).toBe(409);
  });

  test('ký: số quyết định nhập trùng 409 và rollback (đề xuất vẫn CHO_KY)', async () => {
    const dx = await taoDeXuat();
    expect((await trinhKy(dx.id)).status).toBe(200);
    const [[seed]] = await pool.query('SELECT soQuyetDinh FROM quyetdinhkhenthuongkyluat WHERE id = 1');
    const truoc = await demQuyetDinh();
    const res = await kyDaXem(dx.id, token.giamdoc, { soQuyetDinh: seed.soQuyetDinh });
    expect(res.status).toBe(409);
    expect(await demQuyetDinh()).toBe(truoc);
    expect((await layDeXuatDb(dx.id)).trangThai).toBe('CHO_KY');
  });
});

// ---------------------------------------------------------------------------
describe('Trình ký (HR)', () => {
  test('trình ký thành công: CHO_KY, nguoiXuLyId = Giám đốc, nội dung chỉnh, nhật ký ghi nội dung gốc', async () => {
    const dx = await taoDeXuat();
    const res = await trinhKy(dx.id, NV_GIAMDOC, { tieuDe: 'Tiêu đề HR chỉnh', soTienDeXuat: 650000, loaiDeXuat: 'KY_LUAT' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, code: 200 });
    expect(res.body.data).toMatchObject({
      trangThai: 'CHO_KY',
      nguoiXuLyId: NV_GIAMDOC,
      tieuDe: 'Tiêu đề HR chỉnh',
      loaiDeXuat: 'KHEN_THUONG',
    });
    expect(Number(res.body.data.soTienDeXuat)).toBe(650000);
    const nk = await layNhatKy('TRINH_KY_KTKL');
    expect(nk).toHaveLength(1);
    expect(nk[0].nguoiDungId).toBe(4);
    expect(nk[0].chiTiet).toContain('nội dung gốc');
    expect(nk[0].chiTiet).toContain('tieuDe=QA khen thưởng');
    expect(nk[0].chiTiet).toContain('NV0002');
  });

  test('đang CHO_KY trình lại được để đổi Giám đốc ký', async () => {
    const dx = await taoDeXuat();
    expect((await trinhKy(dx.id, NV_GIAMDOC)).status).toBe(200);
    const doi = await trinhKy(dx.id, NV_GIAMDOC2);
    expect(doi.status).toBe(200);
    expect(doi.body.data).toMatchObject({ trangThai: 'CHO_KY', nguoiXuLyId: NV_GIAMDOC2 });
    // Giám đốc cũ không còn ký được
    expect((await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/ky`, token.giamdoc).send({})).status).toBe(403);
  });

  test('dữ liệu sai 400: thiếu Giám đốc, trình chính mình, người không phải Giám đốc, người nhận làm người ký', async () => {
    const dx = await taoDeXuat();
    expect((await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/trinhKy`, token.hr).send({})).status).toBe(400);
    const chinhMinh = await trinhKy(dx.id, NV_HR);
    expect(chinhMinh.status).toBe(400);
    expect(chinhMinh.body).toMatchObject({ success: false, code: 400, data: null });
    expect((await trinhKy(dx.id, NV_QUANLY)).status).toBe(400);
    expect((await layDeXuatDb(dx.id)).trangThai).toBe('CHO_DUYET');
    const dx2 = await taoDeXuat(token.giamdoc, { nhanVienId: NV_GIAMDOC2 });
    expect((await trinhKy(dx2.id, NV_GIAMDOC2)).status).toBe(400);
    expect(await layNhatKy('TRINH_KY_KTKL')).toHaveLength(0);
  });

  test('đề xuất về chính HR 403, hr2 trình được', async () => {
    const dx = await taoDeXuat(token.giamdoc, { nhanVienId: NV_HR });
    expect((await trinhKy(dx.id, NV_GIAMDOC2)).status).toBe(403);
    const ok = await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/trinhKy`, token.hr2).send({ nguoiKyDuyetId: NV_GIAMDOC2 });
    expect(ok.status).toBe(200);
  });

  test('quanLy / giamDoc gọi trinhKy 403, chưa đăng nhập 401, đã xử lý 409, không tồn tại 404', async () => {
    const dx = await taoDeXuat();
    for (const tk of ['quanly', 'giamdoc', 'nhanvien']) {
      expect((await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/trinhKy`, token[tk]).send({ nguoiKyDuyetId: NV_GIAMDOC2 })).status).toBe(
        403,
      );
    }
    expect((await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/trinhKy`).send({ nguoiKyDuyetId: NV_GIAMDOC })).status).toBe(401);
    expect((await trinhKy(3)).status).toBe(409);
    expect((await trinhKy(4)).status).toBe(409);
    expect((await trinhKy(999999)).status).toBe(404);
  });

  test('HR lập trực tiếp: POST đề xuất -> CHO_KY, message "Đã trình Giám đốc ký", nhật ký TRINH_KY_KTKL', async () => {
    const res = await goi('post', '/deXuatKhenThuongKyLuat', token.hr).send(bodyDeXuat({ nguoiKyDuyetId: NV_GIAMDOC2 }));
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Đã trình Giám đốc ký');
    expect(res.body.data).toMatchObject({ trangThai: 'CHO_KY', nguoiDeXuatId: NV_HR, nguoiXuLyId: NV_GIAMDOC2 });
    expect(await layNhatKy('TRINH_KY_KTKL')).toHaveLength(1);
    expect(await layNhatKy('TAO_DE_XUAT_KTKL')).toHaveLength(0);
    // Trình chính mình / người không phải Giám đốc -> 400
    expect((await goi('post', '/deXuatKhenThuongKyLuat', token.hr).send(bodyDeXuat({ nguoiKyDuyetId: NV_HR }))).status).toBe(400);
    expect((await goi('post', '/deXuatKhenThuongKyLuat', token.hr).send(bodyDeXuat({ nguoiKyDuyetId: NV_QUANLY }))).status).toBe(400);
  });

  test('HR kiêm quanLy lập trực tiếp cho nhân viên ngoài phòng mình phụ trách thành công', async () => {
    await pool.execute('INSERT INTO nguoidungvaitro (nguoiDungId, vaiTroId) VALUES (4, 3)');
    try {
      const dn = await dangNhap('hr');
      expect(dn.status).toBe(200);
      const res = await goi('post', '/deXuatKhenThuongKyLuat', dn.body.data.token).send(
        bodyDeXuat({ nhanVienId: NV_NHANVIEN3, nguoiKyDuyetId: NV_GIAMDOC }),
      );
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ trangThai: 'CHO_KY', nhanVienId: NV_NHANVIEN3 });
    } finally {
      await pool.execute('DELETE FROM nguoidungvaitro WHERE nguoiDungId = 4 AND vaiTroId = 3');
    }
  });
});

// ---------------------------------------------------------------------------
describe('Giám đốc ký / trả lại / từ chối', () => {
  async function taoChoKy(nguoiKy = NV_GIAMDOC, ghiDe = {}) {
    const dx = await taoDeXuat(token.quanly, ghiDe);
    expect((await trinhKy(dx.id, nguoiKy)).status).toBe(200);
    return dx;
  }

  test('đúng Giám đốc ký 201: ngày ban hành hôm nay, người ký = mình, DA_DUYET + quyetDinhId, nhật ký KY_QUYET_DINH_KTKL', async () => {
    const dx = await taoChoKy();
    const res = await kyDaXem(dx.id, token.giamdoc);
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Đã ký và ban hành quyết định');
    const qd = res.body.data.quyetDinh;
    expect(qd).toMatchObject({ nhanVienId: NV_NHANVIEN, nguoiKyDuyetId: NV_GIAMDOC });
    const [[db]] = await pool.execute(
      'SELECT DATE_FORMAT(ngayBanHanh, "%Y-%m-%d") AS ngay, nguoiKyDuyetId FROM quyetdinhkhenthuongkyluat WHERE id = ?',
      [qd.id],
    );
    expect(db).toEqual({ ngay: homNay(), nguoiKyDuyetId: NV_GIAMDOC });
    expect(await layDeXuatDb(dx.id)).toMatchObject({ trangThai: 'DA_DUYET', quyetDinhId: qd.id, nguoiXuLyId: NV_GIAMDOC });
    const nk = await layNhatKy('KY_QUYET_DINH_KTKL');
    expect(nk).toHaveLength(1);
    expect(nk[0].nguoiDungId).toBe(2);
    expect(nk[0].chiTiet).toContain(`đề xuất #${dx.id}`);
  });

  test('Giám đốc khác 403, HR / quanLy gọi ký 403, không ghi quyết định', async () => {
    const dx = await taoChoKy(NV_GIAMDOC2);
    const truoc = await demQuyetDinh();
    expect((await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/ky`, token.giamdoc).send({})).status).toBe(403);
    expect((await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/ky`, token.hr).send({})).status).toBe(403);
    expect((await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/ky`, token.quanly).send({})).status).toBe(403);
    expect(await demQuyetDinh()).toBe(truoc);
    expect((await kyDaXem(dx.id, token.giamdoc2)).status).toBe(201);
  });

  test('ký đề xuất chưa trình (CHO_DUYET) 409', async () => {
    const dx = await taoDeXuat();
    expect((await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/ky`, token.giamdoc).send({})).status).toBe(409);
  });

  test('ngayCapNhat đúng bản đang xem ký được; lệch (HR vừa chỉnh) 409', async () => {
    const dx = await taoChoKy();
    const xem = await goi('get', `/deXuatKhenThuongKyLuat/${dx.id}`, token.giamdoc);
    expect(xem.status).toBe(200);
    const lech = await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/ky`, token.giamdoc).send({ ngayCapNhat: '2000-01-01T00:00:00.000Z' });
    expect(lech.status).toBe(409);
    expect((await layDeXuatDb(dx.id)).trangThai).toBe('CHO_KY');
    // Gọi API trực tiếp không kèm phiên bản đã xem -> 400, không ký, không tạo quyết định
    const truoc = await demQuyetDinh();
    for (const body of [{}, { ngayCapNhat: '' }, { ngayCapNhat: null }]) {
      const thieu = await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/ky`, token.giamdoc).send(body);
      expect(thieu.body).toMatchObject({ success: false, code: 400, data: null });
    }
    expect(await demQuyetDinh()).toBe(truoc);
    expect((await layDeXuatDb(dx.id)).trangThai).toBe('CHO_KY');
    const dung = await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/ky`, token.giamdoc).send({ ngayCapNhat: xem.body.data.ngayCapNhat });
    expect([dung.status, dung.body.message]).toEqual([201, 'Đã ký và ban hành quyết định']);
  });

  test('nhân viên đã nghỉ việc khi ký 409, rollback', async () => {
    const dx = await taoChoKy();
    const [[goc]] = await pool.execute('SELECT trangThaiLamViec FROM nhanvien WHERE id = ?', [NV_NHANVIEN]);
    const truoc = await demQuyetDinh();
    await pool.execute("UPDATE nhanvien SET trangThaiLamViec = 'DA_NGHI_VIEC' WHERE id = ?", [NV_NHANVIEN]);
    try {
      expect((await kyDaXem(dx.id, token.giamdoc)).status).toBe(409);
      expect(await demQuyetDinh()).toBe(truoc);
      expect((await layDeXuatDb(dx.id)).trangThai).toBe('CHO_KY');
    } finally {
      await pool.execute('UPDATE nhanvien SET trangThaiLamViec = ? WHERE id = ?', [goc.trangThaiLamViec, NV_NHANVIEN]);
    }
  });

  test('bảng lương tháng hiện tại đã CHO_DUYET -> 409 "ký từ ngày 01 tháng sau", rollback', async () => {
    const [nam, thang] = homNay().split('-').map(Number);
    const [bl] = await pool.execute(
      `INSERT INTO bangtonghopluong (maBangLuong, thang, nam, tongChiPhiLuong, trangThai, nguoiLapId) VALUES (?, ?, ?, 0, 'CHO_DUYET', 4)`,
      [`QABL${nam}-${thang}`, thang, nam],
    );
    expect(bl.insertId).toBeGreaterThan(0);
    const dx = await taoChoKy();
    const truoc = await demQuyetDinh();
    const res = await kyDaXem(dx.id, token.giamdoc);
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('ký từ ngày 01 tháng sau');
    expect(await demQuyetDinh()).toBe(truoc);
    expect((await layDeXuatDb(dx.id)).trangThai).toBe('CHO_KY');
  });

  test('bảng lương nháp tháng hiện tại -> phiếu của người nhận được cộng tiền thưởng', async () => {
    const [nam, thang] = homNay().split('-').map(Number);
    const [bl] = await pool.execute(
      `INSERT INTO bangtonghopluong (maBangLuong, thang, nam, tongChiPhiLuong, trangThai, nguoiLapId) VALUES (?, ?, ?, 0, 'BAN_NHAP', 4)`,
      [`QABL${nam}-${thang}`, thang, nam],
    );
    await pool.execute(
      `INSERT INTO phieuluongnhanvien (bangTongHopLuongId, nhanVienId, soNgayCongThucTe, luongCoBan, luongLamThemOT, thuongKPI,
         tongPhuCap, khauTruBaoHiem, khauTruThueTNCN) VALUES (?, ?, 20, 10000000, 0, 0, 0, 0, 0)`,
      [bl.insertId, NV_NHANVIEN],
    );
    const dx = await taoChoKy();
    const res = await kyDaXem(dx.id, token.giamdoc);
    expect(res.status).toBe(201);
    expect(res.body.data.canhBao).toEqual(expect.stringContaining('NV0005'));
    const [[p]] = await pool.execute('SELECT thuongKPI FROM phieuluongnhanvien WHERE bangTongHopLuongId = ? AND nhanVienId = ?', [
      bl.insertId,
      NV_NHANVIEN,
    ]);
    expect(Number(p.thuongKPI)).toBe(700000);
    expect(await layNhatKy('TINH_LAI_BANG_LUONG_KTKL')).toHaveLength(1);
  });

  test('trả lại: CHO_DUYET, ghiChuXuLy "Trả lại: ...", người đề xuất sửa lại được; thiếu lý do 400; Giám đốc khác 403', async () => {
    const dx = await taoChoKy();
    expect((await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/traLai`, token.giamdoc).send({})).status).toBe(400);
    expect(
      (await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/traLai`, token.giamdoc2).send({ ghiChuXuLy: 'Bổ sung hồ sơ' })).status,
    ).toBe(403);
    expect((await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/traLai`, token.hr).send({ ghiChuXuLy: 'Bổ sung hồ sơ' })).status).toBe(403);
    // Đang chờ ký thì người đề xuất không sửa được
    expect((await goi('patch', `/deXuatKhenThuongKyLuat/${dx.id}`, token.quanly).send({ tieuDe: 'Sửa khi chờ ký' })).status).toBe(409);
    const res = await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/traLai`, token.giamdoc).send({ ghiChuXuLy: 'Bổ sung hồ sơ' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ trangThai: 'CHO_DUYET', nguoiXuLyId: NV_GIAMDOC, ghiChuXuLy: 'Trả lại: Bổ sung hồ sơ' });
    expect(await layNhatKy('TRA_LAI_DE_XUAT_KTKL')).toHaveLength(1);
    const sua = await goi('patch', `/deXuatKhenThuongKyLuat/${dx.id}`, token.quanly).send({ lyDo: 'Đã bổ sung hồ sơ chấm công' });
    expect(sua.status).toBe(200);
    expect((await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/traLai`, token.giamdoc).send({ ghiChuXuLy: 'Lần hai' })).status).toBe(409);
  });

  test('từ chối khi CHO_KY: Giám đốc được trình 200, Giám đốc khác 403, HR bị chặn', async () => {
    const dx = await taoChoKy();
    expect((await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/tuChoi`, token.giamdoc2).send({ ghiChuXuLy: 'Không đồng ý' })).status).toBe(
      403,
    );
    const hr = await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/tuChoi`, token.hr).send({ ghiChuXuLy: 'HR từ chối' });
    expect([403, 409]).toContain(hr.status);
    expect((await layDeXuatDb(dx.id)).trangThai).toBe('CHO_KY');
    const ok = await goi('post', `/deXuatKhenThuongKyLuat/${dx.id}/tuChoi`, token.giamdoc).send({ ghiChuXuLy: 'Không đồng ý' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ trangThai: 'TU_CHOI', nguoiXuLyId: NV_GIAMDOC, ghiChuXuLy: 'Không đồng ý' });
  });

  test('seed: đề xuất 5 CHO_KY trình giamdoc, đề xuất 6 đã trả lại', async () => {
    expect(await layDeXuatDb(5)).toMatchObject({ trangThai: 'CHO_KY', nguoiXuLyId: NV_GIAMDOC });
    expect((await layDeXuatDb(6)).ghiChuXuLy).toMatch(/^Trả lại: /);
  });
});

// ---------------------------------------------------------------------------
describe('Quyết định khen thưởng/kỷ luật - xem', () => {
  test('chưa đăng nhập 401', async () => {
    expect((await goi('get', '/quyetDinhKhenThuongKyLuat')).status).toBe(401);
  });

  test('HR/giamDoc toàn bộ kèm thongKe; quanLy PM + của mình; nhanVien/Admin chỉ của mình', async () => {
    const hr = await goi('get', '/quyetDinhKhenThuongKyLuat', token.hr);
    expect(hr.status).toBe(200);
    expect(hr.body.data).toHaveProperty('thongKe');
    expect(hr.body.data).toHaveProperty('phanTrang');
    expect(hr.body.data.items.map((q) => q.id)).toEqual(expect.arrayContaining([1, 2, 3]));
    const gd = await goi('get', '/quyetDinhKhenThuongKyLuat', token.giamdoc);
    expect(gd.body.data.items.map((q) => q.id)).toEqual(expect.arrayContaining([1, 2, 3]));
    const ql = (await goi('get', '/quyetDinhKhenThuongKyLuat', token.quanly)).body.data.items.map((q) => q.id);
    expect(ql).toContain(1);
    expect(ql).not.toContain(2);
    expect(ql).not.toContain(3);
    const nv = (await goi('get', '/quyetDinhKhenThuongKyLuat', token.nhanvien)).body.data.items;
    expect(nv.length).toBeGreaterThan(0);
    expect(nv.every((q) => q.nhanVienId === NV_NHANVIEN)).toBe(true);
    const nv3 = (await goi('get', '/quyetDinhKhenThuongKyLuat', token.nhanvien3)).body.data.items;
    expect(nv3.every((q) => q.nhanVienId === NV_NHANVIEN3)).toBe(true);
    const ad = await goi('get', '/quyetDinhKhenThuongKyLuat', token.admin);
    expect(ad.status).toBe(200);
    expect(ad.body.data.items.every((q) => q.nhanVienId === NV_ADMIN)).toBe(true);
  });

  test('GET /:id ngoài phạm vi 404 (nhanVien xem của người khác)', async () => {
    expect((await goi('get', '/quyetDinhKhenThuongKyLuat/1', token.nhanvien)).status).toBe(200);
    expect((await goi('get', '/quyetDinhKhenThuongKyLuat/2', token.nhanvien)).status).toBe(404);
    expect((await goi('get', '/quyetDinhKhenThuongKyLuat/1', token.nhanvien2)).status).toBe(404);
    expect((await goi('get', '/quyetDinhKhenThuongKyLuat/1', token.quanly)).status).toBe(200);
    expect((await goi('get', '/quyetDinhKhenThuongKyLuat/2', token.quanly)).status).toBe(404);
    expect((await goi('get', '/quyetDinhKhenThuongKyLuat/3', token.giamdoc)).status).toBe(200);
    expect((await goi('get', '/quyetDinhKhenThuongKyLuat/999999', token.hr)).status).toBe(404);
  });

  test('GET /nguoiKy: chỉ HR, trả danh sách giamDoc', async () => {
    const res = await goi('get', '/quyetDinhKhenThuongKyLuat/nguoiKy', token.hr);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((n) => n.id);
    expect(ids).toEqual(expect.arrayContaining([NV_GIAMDOC, NV_GIAMDOC2]));
    expect(ids).not.toContain(NV_HR);
    expect((await goi('get', '/quyetDinhKhenThuongKyLuat/nguoiKy', token.giamdoc)).status).toBe(403);
    expect((await goi('get', '/quyetDinhKhenThuongKyLuat/nguoiKy', token.nhanvien)).status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
describe('Quyết định - lập trực tiếp', () => {
  test('giamDoc lập trực tiếp 201; số tự sinh tăng dần; nhật ký', async () => {
    const r1 = await goi('post', '/quyetDinhKhenThuongKyLuat', token.giamdoc).send(bodyQuyetDinh());
    expect(r1.status).toBe(201);
    expect(r1.body.data.quyetDinh).toMatchObject({ nhanVienId: NV_NHANVIEN, nguoiKyDuyetId: NV_GIAMDOC });
    // NV 5 chỉ có hợp đồng từ 2024 -> tháng 03/2021 không có HĐ hiệu lực, phải cảnh báo tiền không vào lương
    expect(r1.body.data.canhBao).toEqual(expect.stringContaining('không có hợp đồng hiệu lực'));
    const r2 = await goi('post', '/quyetDinhKhenThuongKyLuat', token.giamdoc).send(bodyQuyetDinh({ loaiQuyetDinh: 'KY_LUAT' }));
    expect(r2.status).toBe(201);
    const so = (r) => Number(r.body.data.quyetDinh.soQuyetDinh.split('-')[1]);
    expect(r1.body.data.quyetDinh.soQuyetDinh).toMatch(/^QD2021-\d{4}$/);
    expect(so(r2)).toBe(so(r1) + 1);
    expect(await layNhatKy('LAP_QUYET_DINH_KTKL')).toHaveLength(2);
  });

  test('giamDoc tự ký (bỏ qua nguoiKyDuyetId gửi lên); không lập cho chính mình 400', async () => {
    const res = await goi('post', '/quyetDinhKhenThuongKyLuat', token.giamdoc).send(bodyQuyetDinh({ nguoiKyDuyetId: NV_GIAMDOC2 }));
    expect(res.status).toBe(201);
    expect(res.body.data.quyetDinh.nguoiKyDuyetId).toBe(NV_GIAMDOC);
    expect((await goi('post', '/quyetDinhKhenThuongKyLuat', token.giamdoc).send(bodyQuyetDinh({ nhanVienId: NV_GIAMDOC }))).status).toBe(
      400,
    );
  });

  test('sai vai trò 403 (HR không lập trực tiếp quyết định, phải trình ký)', async () => {
    const truoc = await demQuyetDinh();
    for (const tk of ['hr', 'hr2', 'quanly', 'nhanvien', 'admin']) {
      const res = await goi('post', '/quyetDinhKhenThuongKyLuat', token[tk]).send(bodyQuyetDinh());
      expect([tk, res.status]).toEqual([tk, 403]);
    }
    expect(await demQuyetDinh()).toBe(truoc);
  });

  test('dữ liệu sai 400, nhân viên không tồn tại 404, số trùng 409', async () => {
    const truoc = await demQuyetDinh();
    const sai = [
      { nhanVienId: 'x' },
      { loaiQuyetDinh: 'THUONG' },
      { ngayBanHanh: '15/03/2021' },
      { ngayBanHanh: '2099-12-01' },
      { soTien: -5 },
      { tieuDe: '' },
      { soQuyetDinh: 'ab' },
    ];
    for (const ghiDe of sai) {
      const res = await goi('post', '/quyetDinhKhenThuongKyLuat', token.giamdoc).send(bodyQuyetDinh(ghiDe));
      expect([ghiDe, res.status]).toEqual([ghiDe, 400]);
    }
    expect((await goi('post', '/quyetDinhKhenThuongKyLuat', token.giamdoc).send(bodyQuyetDinh({ nhanVienId: 999999 }))).status).toBe(404);
    const [[seed]] = await pool.query('SELECT soQuyetDinh FROM quyetdinhkhenthuongkyluat WHERE id = 2');
    const trung = await goi('post', '/quyetDinhKhenThuongKyLuat', token.giamdoc).send(bodyQuyetDinh({ soQuyetDinh: seed.soQuyetDinh }));
    expect(trung.status).toBe(409);
    expect(trung.body).toMatchObject({ success: false, code: 409, data: null });
    expect(await demQuyetDinh()).toBe(truoc);
  });

  test('ngày ban hành cuối tháng hiện tại hợp lệ, đầu tháng sau 400', async () => {
    const d = new Date();
    const cuoi = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0)).toISOString().slice(0, 10);
    const dauSau = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 1)).toISOString().slice(0, 10);
    expect((await goi('post', '/quyetDinhKhenThuongKyLuat', token.giamdoc).send(bodyQuyetDinh({ ngayBanHanh: dauSau }))).status).toBe(400);
    // Tháng hiện tại có thể đã có bảng lương seed? seed chỉ có bảng tháng chốt (quá khứ) nên cuối tháng này hợp lệ
    const ok = await goi('post', '/quyetDinhKhenThuongKyLuat', token.giamdoc).send(bodyQuyetDinh({ ngayBanHanh: cuoi }));
    expect(ok.status).toBe(201);
  });
});

// ---------------------------------------------------------------------------
describe('Quyết định và bảng lương tháng ban hành', () => {
  test('tháng có bảng lương CHO_DUYET/DA_DUYET -> 409, không ghi quyết định', async () => {
    for (const [thang, trangThai] of [
      [7, 'CHO_DUYET'],
      [8, 'DA_DUYET'],
    ]) {
      await pool.execute(
        `INSERT INTO bangtonghopluong (maBangLuong, thang, nam, tongChiPhiLuong, trangThai, nguoiLapId)
         VALUES (?, ?, 2020, 0, ?, 4)`,
        [`QABL2020-0${thang}`, thang, trangThai],
      );
    }
    const truoc = await demQuyetDinh();
    for (const ngay of ['2020-07-10', '2020-08-10']) {
      expect((await goi('post', '/quyetDinhKhenThuongKyLuat', token.giamdoc).send(bodyQuyetDinh({ ngayBanHanh: ngay }))).status).toBe(409);
    }
    expect(await demQuyetDinh()).toBe(truoc);
  });

  test('tháng có bảng lương BAN_NHAP -> tự tính lại phiếu (thưởng +, kỷ luật -), canhBao, nhật ký TINH_LAI_BANG_LUONG', async () => {
    const thang = '2020-06';
    await pool.execute("INSERT INTO nhatkyhethong (nguoiDungId, hanhDong, chiTiet) VALUES (4, 'CHOT_CONG_THANG', ?)", [thang]);
    const lap = await goi('post', '/bangLuong', token.hr).send({ thang });
    expect(lap.status).toBe(201);
    const bangId = lap.body.data.id ?? lap.body.data.bangLuong?.id;
    const layThuong = async () => {
      const [[p]] = await pool.execute('SELECT thuongKPI FROM phieuluongnhanvien WHERE bangTongHopLuongId = ? AND nhanVienId = ?', [
        bangId,
        NV_QUANLY,
      ]);
      return Number(p.thuongKPI);
    };
    const goc = await layThuong();

    const khen = await goi('post', '/quyetDinhKhenThuongKyLuat', token.giamdoc).send(
      bodyQuyetDinh({ nhanVienId: NV_QUANLY, soTien: 1000000, ngayBanHanh: '2020-06-15' }),
    );
    expect(khen.status).toBe(201);
    expect(khen.body.data.canhBao).toEqual(expect.stringContaining('BL'));
    expect(await layThuong()).toBe(goc + 1000000);
    expect(await layNhatKy('TINH_LAI_BANG_LUONG_KTKL')).toHaveLength(1);
    expect(await layNhatKy('TINH_LAI_BANG_LUONG')).toHaveLength(0);

    const phat = await goi('post', '/quyetDinhKhenThuongKyLuat', token.giamdoc).send(
      bodyQuyetDinh({ nhanVienId: NV_QUANLY, loaiQuyetDinh: 'KY_LUAT', soTien: 300000, ngayBanHanh: '2020-06-20' }),
    );
    expect(phat.status).toBe(201);
    expect(await layThuong()).toBe(goc + 700000);
    const [[b]] = await pool.execute('SELECT trangThai FROM bangtonghopluong WHERE id = ?', [bangId]);
    expect(b.trangThai).toBe('BAN_NHAP');
  });

  test('giamDoc lập quyết định vào tháng có bảng nháp vẫn duyệt được bảng lương đó (200)', async () => {
    const thang = '2020-09';
    await pool.execute("INSERT INTO nhatkyhethong (nguoiDungId, hanhDong, chiTiet) VALUES (4, 'CHOT_CONG_THANG', ?)", [thang]);
    const lap = await goi('post', '/bangLuong', token.hr).send({ thang });
    expect(lap.status).toBe(201);
    const bangId = lap.body.data.id ?? lap.body.data.bangLuong?.id;
    const qd = await goi('post', '/quyetDinhKhenThuongKyLuat', token.giamdoc).send(
      bodyQuyetDinh({ nhanVienId: NV_QUANLY, ngayBanHanh: '2020-09-15' }),
    );
    expect(qd.status).toBe(201);
    expect(qd.body.data.canhBao).toEqual(expect.any(String));
    expect(await layNhatKy('TINH_LAI_BANG_LUONG_KTKL')).toHaveLength(1);
    expect((await goi('post', `/bangLuong/${bangId}/guiDuyet`, token.hr)).status).toBe(200);
    const duyet = await goi('post', `/bangLuong/${bangId}/duyet`, token.giamdoc);
    expect(duyet.status).toBe(200);
    const [[b]] = await pool.execute('SELECT trangThai FROM bangtonghopluong WHERE id = ?', [bangId]);
    expect(b.trangThai).toBe('DA_DUYET');
  });

  test('kỷ luật phạt vượt thu nhập trên bảng BAN_NHAP: canhBao chứa "phạt vượt thu nhập bị bỏ" kèm mã NV', async () => {
    const thang = '2020-05';
    await pool.execute("INSERT INTO nhatkyhethong (nguoiDungId, hanhDong, chiTiet) VALUES (4, 'CHOT_CONG_THANG', ?)", [thang]);
    const lap = await goi('post', '/bangLuong', token.hr).send({ thang });
    expect(lap.status).toBe(201);
    const phat = await goi('post', '/quyetDinhKhenThuongKyLuat', token.giamdoc).send(
      bodyQuyetDinh({ nhanVienId: NV_QUANLY, loaiQuyetDinh: 'KY_LUAT', soTien: 500000000, ngayBanHanh: '2020-05-20' }),
    );
    expect(phat.status).toBe(201);
    expect(phat.body.data.canhBao).toEqual(expect.stringContaining('phạt vượt thu nhập bị bỏ'));
    expect(phat.body.data.canhBao).toEqual(expect.stringContaining('NV0003'));
    // Quyết định sau cho người khác chỉ chạm phiếu của người đó (không sinh lại cả bảng) nên không cảnh báo lại NV0003
    const khen = await goi('post', '/quyetDinhKhenThuongKyLuat', token.giamdoc).send(
      bodyQuyetDinh({ nhanVienId: NV_NHANVIEN, soTien: 100000, ngayBanHanh: '2020-05-21' }),
    );
    expect(khen.status).toBe(201);
    expect(String(khen.body.data.canhBao ?? '')).not.toContain('NV0003');
  });
});

// ---------------------------------------------------------------------------
// Giữ chỉnh sửa tay của HR khi quyết định KTKL rơi vào tháng có bảng nháp (luongService.congThuongPhatVaoPhieuNhap)
describe('Quyết định KTKL vào bảng nháp giữ chỉnh sửa tay', () => {
  const { tinhThueChoPhieu, demNgayCongChuan } = require('../src/utils/tinhLuong');

  async function lapBangNhap(thang) {
    await pool.execute("INSERT INTO nhatkyhethong (nguoiDungId, hanhDong, chiTiet) VALUES (4, 'CHOT_CONG_THANG', ?)", [thang]);
    const lap = await goi('post', '/bangLuong', token.hr).send({ thang });
    expect(lap.status).toBe(201);
    return lap.body.data.id ?? lap.body.data.bangLuong?.id;
  }
  async function layPhieuDb(bangId, nhanVienId) {
    const [[p]] = await pool.execute('SELECT * FROM phieuluongnhanvien WHERE bangTongHopLuongId = ? AND nhanVienId = ?', [
      bangId,
      nhanVienId,
    ]);
    return p;
  }
  const so = (p, cot) => Number(p[cot]);
  const banHanh = (ghiDe) => goi('post', '/quyetDinhKhenThuongKyLuat', token.giamdoc).send(bodyQuyetDinh(ghiDe));

  test('sửa tay phụ cấp A, OT B rồi khen thưởng A: chỉ thuongKPI + thuế của A đổi, giữ sửa tay, tổng bảng khớp, nhật ký', async () => {
    const thang = '2020-10';
    const bangId = await lapBangNhap(thang);
    const [ds] = await pool.execute('SELECT nhanVienId FROM phieuluongnhanvien WHERE bangTongHopLuongId = ? AND nhanVienId NOT IN (?, ?)', [
      bangId,
      NV_QUANLY,
      NV_HR,
    ]);
    expect(ds.length).toBeGreaterThan(0);
    const nvB = ds[0].nhanVienId;
    const a0 = await layPhieuDb(bangId, NV_QUANLY);
    const b0 = await layPhieuDb(bangId, nvB);
    const suaA = await goi('patch', `/phieuLuong/${a0.id}`, token.hr).send({ tongPhuCap: so(a0, 'tongPhuCap') + 123000 });
    expect(suaA.status).toBe(200);
    const suaB = await goi('patch', `/phieuLuong/${b0.id}`, token.hr).send({ luongLamThemOT: so(b0, 'luongLamThemOT') + 50000 });
    expect(suaB.status).toBe(200);
    const a1 = await layPhieuDb(bangId, NV_QUANLY);
    const b1 = await layPhieuDb(bangId, nvB);

    const khen = await banHanh({ nhanVienId: NV_QUANLY, soTien: 800000, ngayBanHanh: '2020-10-15' });
    expect(khen.status).toBe(201);
    const a2 = await layPhieuDb(bangId, NV_QUANLY);
    const b2 = await layPhieuDb(bangId, nvB);
    expect(so(a2, 'thuongKPI')).toBe(so(a1, 'thuongKPI') + 800000);
    expect(so(a2, 'tongPhuCap')).toBe(so(a0, 'tongPhuCap') + 123000);
    for (const cot of ['soNgayCongThucTe', 'luongLamThemOT', 'khauTruBaoHiem', 'luongCoBan']) expect(so(a2, cot)).toBe(so(a1, cot));
    expect(so(a2, 'khauTruThueTNCN')).toBe(tinhThueChoPhieu(a2, demNgayCongChuan(thang)));
    for (const cot of ['thuongKPI', 'tongPhuCap', 'luongLamThemOT', 'khauTruThueTNCN', 'soNgayCongThucTe'])
      expect(so(b2, cot)).toBe(so(b1, cot));
    expect(so(b2, 'luongLamThemOT')).toBe(so(b0, 'luongLamThemOT') + 50000);

    const ngayCongChuan = demNgayCongChuan(thang);
    const [tatCa] = await pool.execute('SELECT * FROM phieuluongnhanvien WHERE bangTongHopLuongId = ?', [bangId]);
    const { tinhChiTietPhieu } = require('../src/utils/tinhLuong');
    const tong = tatCa.reduce((s, p) => s + tinhChiTietPhieu(p, ngayCongChuan).tongThuNhap, 0);
    const [[bang]] = await pool.execute('SELECT tongChiPhiLuong FROM bangtonghopluong WHERE id = ?', [bangId]);
    expect(Number(bang.tongChiPhiLuong)).toBe(tong);
    const nk = await layNhatKy('TINH_LAI_BANG_LUONG_KTKL');
    expect(nk).toHaveLength(1);
    expect(nk[0].chiTiet).toContain('NV0003');
  });

  test('sửa tay thuongKPI A (+200000) rồi kỷ luật 100000: thuongKPI = giá trị sửa tay − 100000', async () => {
    const bangId = await lapBangNhap('2020-11');
    const a0 = await layPhieuDb(bangId, NV_QUANLY);
    const suaTay = so(a0, 'thuongKPI') + 200000;
    expect((await goi('patch', `/phieuLuong/${a0.id}`, token.hr).send({ thuongKPI: suaTay })).status).toBe(200);
    const phat = await banHanh({ nhanVienId: NV_QUANLY, loaiQuyetDinh: 'KY_LUAT', soTien: 100000, ngayBanHanh: '2020-11-10' });
    expect(phat.status).toBe(201);
    expect(so(await layPhieuDb(bangId, NV_QUANLY), 'thuongKPI')).toBe(suaTay - 100000);
  });

  test('phạt vượt thu nhập bị cắt rồi khen (và ngược thứ tự): thuongKPI bằng kết quả nút Tính lại', async () => {
    const bangId = await lapBangNhap('2020-12');
    const chay = async (thuTu) => {
      for (const loai of thuTu) {
        const r =
          loai === 'phat'
            ? await banHanh({ nhanVienId: NV_QUANLY, loaiQuyetDinh: 'KY_LUAT', soTien: 500000000, ngayBanHanh: '2020-12-10' })
            : await banHanh({ nhanVienId: NV_QUANLY, soTien: 1000000, ngayBanHanh: '2020-12-11' });
        expect(r.status).toBe(201);
        if (loai === 'phat' && thuTu[0] === 'phat')
          expect(r.body.data.canhBao).toEqual(expect.stringContaining('phạt vượt thu nhập bị bỏ'));
      }
      const sauQd = await layPhieuDb(bangId, NV_QUANLY);
      expect((await goi('post', `/bangLuong/${bangId}/tinhLai`, token.hr)).status).toBe(200);
      const sauTinhLai = await layPhieuDb(bangId, NV_QUANLY);
      expect(so(sauQd, 'thuongKPI')).toBe(so(sauTinhLai, 'thuongKPI'));
      expect(so(sauQd, 'khauTruThueTNCN')).toBe(so(sauTinhLai, 'khauTruThueTNCN'));
      return so(sauQd, 'thuongKPI');
    };
    const phatTruoc = await chay(['phat', 'khen']);
    // Xóa 2 quyết định vừa tạo, tính lại để phiếu về trạng thái gốc, rồi chạy thứ tự ngược trên cùng dữ liệu
    await pool.execute('DELETE FROM quyetdinhkhenthuongkyluat WHERE id > ?', [anhChup.quyetdinhkhenthuongkyluat]);
    expect((await goi('post', `/bangLuong/${bangId}/tinhLai`, token.hr)).status).toBe(200);
    const khenTruoc = await chay(['khen', 'phat']);
    expect(khenTruoc).toBe(phatTruoc);
  });

  test('quyết định cho nhân viên không có phiếu trong bảng nháp: 201, không ghi TINH_LAI_BANG_LUONG_KTKL', async () => {
    const bangId = await lapBangNhap('2020-02');
    expect(await layPhieuDb(bangId, NV_NHANVIEN)).toBeUndefined();
    const res = await banHanh({ nhanVienId: NV_NHANVIEN, soTien: 300000, ngayBanHanh: '2020-02-14' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, code: 201 });
    expect(await layNhatKy('TINH_LAI_BANG_LUONG_KTKL')).toHaveLength(0);
  });

  test('nút Tính lại vẫn bỏ chỉnh sửa tay (tongPhuCap về giá trị tự động)', async () => {
    const bangId = await lapBangNhap('2020-10');
    const a0 = await layPhieuDb(bangId, NV_QUANLY);
    expect((await goi('patch', `/phieuLuong/${a0.id}`, token.hr).send({ tongPhuCap: so(a0, 'tongPhuCap') + 99000 })).status).toBe(200);
    expect(so(await layPhieuDb(bangId, NV_QUANLY), 'tongPhuCap')).toBe(so(a0, 'tongPhuCap') + 99000);
    const tl = await goi('post', `/bangLuong/${bangId}/tinhLai`, token.hr);
    expect(tl.status).toBe(200);
    expect(so(await layPhieuDb(bangId, NV_QUANLY), 'tongPhuCap')).toBe(so(a0, 'tongPhuCap'));
    expect(await layNhatKy('TINH_LAI_BANG_LUONG')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
describe('Kiểm tra lại điều kiện tại thời điểm xử lý', () => {
  test('trình ký Giám đốc có tài khoản bị khóa -> 400, đề xuất giữ nguyên; mở lại thì trình và ký được', async () => {
    const [[nk]] = await pool.execute(
      'SELECT nd.id, nd.trangThai FROM nhanvien nv JOIN nguoidung nd ON nd.id = nv.nguoiDungId WHERE nv.id = ?',
      [NV_GIAMDOC2],
    );
    const dx = await taoDeXuat();
    const truoc = await demQuyetDinh();
    await pool.execute("UPDATE nguoidung SET trangThai = 'BI_KHOA' WHERE id = ?", [nk.id]);
    try {
      const r1 = await trinhKy(dx.id, NV_GIAMDOC2);
      expect(r1.status).toBe(400);
      expect(r1.body).toMatchObject({ success: false, code: 400, data: null });
      const r2 = await goi('post', '/deXuatKhenThuongKyLuat', token.hr).send(bodyDeXuat({ nguoiKyDuyetId: NV_GIAMDOC2 }));
      expect(r2.status).toBe(400);
      expect(await demQuyetDinh()).toBe(truoc);
      expect((await layDeXuatDb(dx.id)).trangThai).toBe('CHO_DUYET');
      const nguoiKy = await goi('get', '/quyetDinhKhenThuongKyLuat/nguoiKy', token.hr);
      expect(nguoiKy.status).toBe(200);
      const dsNguoiKy = Array.isArray(nguoiKy.body.data) ? nguoiKy.body.data : nguoiKy.body.data.items;
      expect(dsNguoiKy.map((n) => n.id)).not.toContain(NV_GIAMDOC2);
    } finally {
      await pool.execute('UPDATE nguoidung SET trangThai = ? WHERE id = ?', [nk.trangThai, nk.id]);
    }
    expect((await trinhKy(dx.id, NV_GIAMDOC2)).status).toBe(200);
    expect((await kyDaXem(dx.id, token.giamdoc2)).status).toBe(201);
  });

  test('quanLy sửa đề xuất khi nhân viên đã chuyển ra khỏi phòng mình -> bị chặn, không đổi dữ liệu', async () => {
    const dx = await taoDeXuat();
    const [[goc]] = await pool.execute('SELECT chucDanhPhongBanId FROM nhanvien WHERE id = ?', [NV_NHANVIEN]);
    const [[khac]] = await pool.execute('SELECT chucDanhPhongBanId FROM nhanvien WHERE id = ?', [NV_NHANVIEN3]);
    expect(khac.chucDanhPhongBanId).not.toBe(goc.chucDanhPhongBanId);
    await pool.execute('UPDATE nhanvien SET chucDanhPhongBanId = ? WHERE id = ?', [khac.chucDanhPhongBanId, NV_NHANVIEN]);
    try {
      const res = await goi('patch', `/deXuatKhenThuongKyLuat/${dx.id}`, token.quanly).send({ tieuDe: 'Sửa sau khi chuyển phòng' });
      expect([403, 404]).toContain(res.status);
      expect(res.body).toMatchObject({ success: false, data: null });
      expect((await layDeXuatDb(dx.id)).tieuDe).toBe('QA khen thưởng');
      expect(await layNhatKy('SUA_DE_XUAT_KTKL')).toHaveLength(0);
    } finally {
      await pool.execute('UPDATE nhanvien SET chucDanhPhongBanId = ? WHERE id = ?', [goc.chucDanhPhongBanId, NV_NHANVIEN]);
    }
    const ok = await goi('patch', `/deXuatKhenThuongKyLuat/${dx.id}`, token.quanly).send({ tieuDe: 'Sửa khi đã về phòng' });
    expect(ok.status).toBe(200);
  });
});
