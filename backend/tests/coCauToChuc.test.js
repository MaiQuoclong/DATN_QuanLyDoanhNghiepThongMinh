const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/ketNoiCsdl');

// Dữ liệu mẫu (database/seed.sql):
//  phongban 1 BGD (trưởng NV0002), 2 PNS (cha 1), 3 PKT (cha 1, trưởng NV0003), 4 PKT-PT (cha 3)
//  chucdanh 1 GD, 2 TP, 3 CVNS, 4 QTHT, 5 LTV
//  chucdanhphongban 1(1,1) 2(2,3) 3(3,2) 4(3,4) 5(4,5, dinhBien 10, NV0005 + NV0006)
//  nguoiDungId = nhanVienId = 1 admin, 2 giamdoc, 3 quanly, 4 hr, 5 nhanvien, 6 nhanvien2
const MAT_KHAU = 'MatKhau@123';
const API = '/api/v1';
const COT_NV = ['chucDanhPhongBanId', 'trangThaiLamViec'];

const token = {};
let mocNhatKyDau;
let mocNhatKy;
let anh;
let dem = 0;

const dangNhap = (ten) => request(app).post(`${API}/xacThuc/dangNhap`).set('X-Tra-Token', '1').send({ tenDangNhap: ten, matKhau: MAT_KHAU });
const goi = (pt, duongDan, tk) => {
  const r = request(app)[pt](`${API}${duongDan}`);
  return tk ? r.set('Authorization', `Bearer ${tk}`) : r;
};
const maMoi = (tienTo = 'QA') => { dem += 1; return `${tienTo}${Date.now() % 100000}${dem}`; };

async function taoPhongBan(ghiDe = {}) {
  const res = await goi('post', '/phongBan', token.hr).send({ maPhongBan: maMoi(), tenPhongBan: 'Phòng kiểm thử', phongBanChaId: 1, ...ghiDe });
  expect(res.status).toBe(201);
  return res.body.data;
}
async function taoChucDanh() {
  const res = await goi('post', '/chucDanh', token.hr).send({ maChucDanh: maMoi('CD'), tenChucDanh: 'Chức danh thử', capBac: 'Nhân viên' });
  expect(res.status).toBe(201);
  return res.body.data;
}
async function taoViTri(phongBanId, chucDanhId, dinhBien = 3) {
  const res = await goi('post', '/chucDanhPhongBan', token.hr).send({ phongBanId, chucDanhId, dinhBien });
  expect(res.status).toBe(201);
  return res.body.data;
}
const doiTrangThai = (loai, id, trangThai, tk = token.hr) => goi('post', `/${loai}/${id}/doiTrangThai`, tk).send({ trangThai });
const boNhiem = (pbId, nvId, tk = token.giamdoc) => goi('post', `/phongBan/${pbId}/boNhiem`, tk).send({ nhanVienId: nvId });
const mienNhiem = (pbId, tk = token.giamdoc) => goi('post', `/phongBan/${pbId}/mienNhiem`, tk).send({});
function duLieuNhanVien(chucDanhPhongBanId) {
  const ten = maMoi('qanv').toLowerCase();
  return { hoVaTen: 'Trần Văn Thử', gioiTinh: 'NAM', ngaySinh: '1999-01-01', ngayVaoLam: '2026-10-01', chucDanhPhongBanId, tenDangNhap: ten, email: `${ten}@smarthrm.local` };
}

async function demNhatKy(hanhDong, nguoiDungId) {
  const [d] = await pool.execute(
    'SELECT COUNT(*) AS n FROM nhatkyhethong WHERE id > ? AND hanhDong = ? AND (? IS NULL OR nguoiDungId = ?)',
    [mocNhatKy, hanhDong, nguoiDungId ?? null, nguoiDungId ?? null]
  );
  return Number(d[0].n);
}
async function layVaiTro(nguoiDungId) {
  const [d] = await pool.execute(
    'SELECT v.maVaiTro FROM nguoidungvaitro nv JOIN vaitro v ON v.id = nv.vaiTroId WHERE nv.nguoiDungId = ? ORDER BY v.maVaiTro',
    [nguoiDungId]
  );
  return d.map((x) => x.maVaiTro);
}
async function layPhongBan(id) {
  const [d] = await pool.execute('SELECT * FROM phongban WHERE id = ?', [id]);
  return d[0];
}

const BANG_AI = ['nhatkyhethong', 'nhanvien', 'nguoidung', 'chucdanhphongban', 'chucdanh', 'phongban'];
async function datLaiAutoIncrement() {
  for (const bang of BANG_AI) await pool.query(`ALTER TABLE ${bang} AUTO_INCREMENT = 1`);
}
const maxId = (ds) => Math.max(0, ...ds.map((d) => d.id));

// Tính quân số kỳ vọng trực tiếp từ CSDL (không đếm cứng theo seed):
// soNhanVien = nhân viên chưa nghỉ việc của chính phòng; tongQuanSo = cộng cả cây phòng ban con.
async function tinhQuanSoKyVong() {
  const [pb] = await pool.query('SELECT id, maPhongBan, phongBanChaId FROM phongban');
  const [dem] = await pool.query(
    `SELECT cdpb.phongBanId AS id, COUNT(*) AS n FROM nhanvien nv
     JOIN chucdanhphongban cdpb ON cdpb.id = nv.chucDanhPhongBanId
     WHERE nv.trangThaiLamViec <> 'DA_NGHI_VIEC' GROUP BY cdpb.phongBanId`
  );
  const truc = Object.fromEntries(dem.map((d) => [d.id, Number(d.n)]));
  const tong = (id) => (truc[id] || 0) + pb.filter((p) => p.phongBanChaId === id).reduce((s, p) => s + tong(p.id), 0);
  return Object.fromEntries(pb.map((p) => [p.maPhongBan, { soNhanVien: truc[p.id] || 0, tongQuanSo: tong(p.id) }]));
}

beforeAll(async () => {
  const [moc] = await pool.execute('SELECT COALESCE(MAX(id), 0) AS moc FROM nhatkyhethong');
  mocNhatKyDau = moc[0].moc;
  const [pb] = await pool.query('SELECT id, tenPhongBan, truongBoPhanId, phongBanChaId, trangThai FROM phongban');
  const [cd] = await pool.query('SELECT id, tenChucDanh, capBac, trangThai FROM chucdanh');
  const [cdpb] = await pool.query('SELECT id, dinhBien, ghiChu, trangThai FROM chucdanhphongban');
  const [nv] = await pool.query(`SELECT id, ${COT_NV.join(', ')} FROM nhanvien`);
  const [nd] = await pool.query('SELECT id, trangThai FROM nguoidung');
  const [ndvt] = await pool.query('SELECT nguoiDungId, vaiTroId FROM nguoidungvaitro');
  anh = { pb, cd, cdpb, nv, nd, ndvt };
  for (const ten of ['admin', 'giamdoc', 'quanly', 'hr', 'nhanvien', 'nhanvien2']) {
    const res = await dangNhap(ten);
    expect(res.status).toBe(200);
    token[ten] = res.body.data.token;
  }
});

beforeEach(async () => {
  const [moc] = await pool.execute('SELECT COALESCE(MAX(id), 0) AS moc FROM nhatkyhethong');
  mocNhatKy = moc[0].moc;
});

// Khôi phục toàn bộ dữ liệu gốc -> test độc lập thứ tự
afterEach(async () => {
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [mocNhatKy]);
  const maxPb = maxId(anh.pb);
  await pool.execute('UPDATE phongban SET truongBoPhanId = NULL, phongBanChaId = NULL WHERE id > ?', [maxPb]);
  for (const d of anh.pb) {
    await pool.execute(
      'UPDATE phongban SET tenPhongBan = ?, truongBoPhanId = ?, phongBanChaId = ?, trangThai = ? WHERE id = ?',
      [d.tenPhongBan, d.truongBoPhanId, d.phongBanChaId, d.trangThai, d.id]
    );
  }
  for (const d of anh.nv) {
    await pool.execute(`UPDATE nhanvien SET ${COT_NV.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...COT_NV.map((c) => d[c]), d.id]);
  }
  await pool.execute('DELETE FROM nhanvien WHERE id > ?', [maxId(anh.nv)]);
  await pool.execute('DELETE FROM nguoidungvaitro');
  await pool.execute('DELETE FROM nguoidung WHERE id > ?', [maxId(anh.nd)]);
  for (const d of anh.nd) await pool.execute('UPDATE nguoidung SET trangThai = ? WHERE id = ?', [d.trangThai, d.id]);
  for (const d of anh.ndvt) await pool.execute('INSERT INTO nguoidungvaitro (nguoiDungId, vaiTroId) VALUES (?, ?)', [d.nguoiDungId, d.vaiTroId]);
  await pool.execute('DELETE FROM chucdanhphongban WHERE id > ?', [maxId(anh.cdpb)]);
  for (const d of anh.cdpb) {
    await pool.execute('UPDATE chucdanhphongban SET dinhBien = ?, ghiChu = ?, trangThai = ? WHERE id = ?', [d.dinhBien, d.ghiChu, d.trangThai, d.id]);
  }
  await pool.execute('DELETE FROM chucdanh WHERE id > ?', [maxId(anh.cd)]);
  for (const d of anh.cd) {
    await pool.execute('UPDATE chucdanh SET tenChucDanh = ?, capBac = ?, trangThai = ? WHERE id = ?', [d.tenChucDanh, d.capBac, d.trangThai, d.id]);
  }
  await pool.execute('DELETE FROM phongban WHERE id > ?', [maxPb]);
  await datLaiAutoIncrement();
});

afterAll(async () => {
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [mocNhatKyDau]);
  await datLaiAutoIncrement();
  await pool.end();
});

// ===========================================================================
describe('Đọc cơ cấu tổ chức', () => {
  test.each(['/phongBan', '/phongBan/1', '/chucDanh', '/chucDanhPhongBan'])('chưa đăng nhập %s trả 401 chuẩn', async (duongDan) => {
    const res = await goi('get', duongDan);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, code: 401, message: expect.any(String), data: null });
  });

  test.each(['admin', 'giamdoc', 'quanly', 'hr', 'nhanvien'])('%s xem danh sách phòng ban, soNhanVien trực tiếp và tongQuanSo cộng cây', async (ten) => {
    const res = await goi('get', '/phongBan', token[ten]);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, code: 200, message: expect.any(String) });
    const theoMa = Object.fromEntries(res.body.data.map((pb) => [pb.maPhongBan, pb]));
    const kyVong = await tinhQuanSoKyVong();
    expect(Object.keys(theoMa).sort()).toEqual(Object.keys(kyVong).sort());
    expect(Object.keys(theoMa)).toEqual(expect.arrayContaining(['BGD', 'PKD', 'PKT', 'PKT-PT', 'PNS']));
    for (const ma of Object.keys(kyVong)) expect(theoMa[ma]).toMatchObject(kyVong[ma]);
    expect(theoMa.BGD).toMatchObject({ truongBoPhanId: 2, maTruongBoPhan: 'NV0002' });
    expect(theoMa.PNS).toMatchObject({ truongBoPhanId: null });
    expect(theoMa.PKT).toMatchObject({ truongBoPhanId: 3 });
    expect(theoMa.PKD).toMatchObject({ truongBoPhanId: 9, phongBanChaId: 1 });
    expect(theoMa['PKT-PT']).toMatchObject({ phongBanChaId: 3 });
  });

  test('nhân viên đã nghỉ việc không tính vào quân số', async () => {
    const truoc = await tinhQuanSoKyVong();
    await pool.execute("UPDATE nhanvien SET trangThaiLamViec = 'DA_NGHI_VIEC' WHERE id = 6");
    const res = await goi('get', '/phongBan', token.hr);
    const theoMa = Object.fromEntries(res.body.data.map((pb) => [pb.maPhongBan, pb]));
    expect(theoMa.BGD.tongQuanSo).toBe(truoc.BGD.tongQuanSo - 1);
    expect(theoMa['PKT-PT'].soNhanVien).toBe(truoc['PKT-PT'].soNhanVien - 1);
  });

  test('lọc trangThai: sai giá trị 400, NGUNG_HOAT_DONG trả rỗng', async () => {
    const sai = await goi('get', '/phongBan?trangThai=ABC', token.hr);
    expect(sai.status).toBe(400);
    expect(sai.body).toMatchObject({ success: false, code: 400, data: null });
    const ngung = await goi('get', '/phongBan?trangThai=NGUNG_HOAT_DONG', token.hr);
    expect(ngung.status).toBe(200);
    expect(ngung.body.data).toEqual([]);
  });

  test('chi tiết phòng ban: không tồn tại 404, id sai 400', async () => {
    expect((await goi('get', '/phongBan/99999', token.hr)).status).toBe(404);
    expect((await goi('get', '/phongBan/abc', token.hr)).status).toBe(400);
    expect((await goi('get', '/phongBan/0', token.hr)).status).toBe(400);
  });

  test.each(['nhanvien', 'quanly', 'admin'])('%s xem chi tiết PKT-PT nhưng không thấy dinhBien/conTrong/ghiChu', async (ten) => {
    const res = await goi('get', '/phongBan/4', token[ten]);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: 4, tongQuanSo: 2 });
    expect(res.body.data.viTri).toHaveLength(1);
    for (const cot of ['dinhBien', 'conTrong', 'ghiChu']) expect(res.body.data.viTri[0]).not.toHaveProperty(cot);
    expect(res.body.data.viTri[0]).toMatchObject({ id: 5, soDangGiu: 2 });
  });

  test.each(['hr', 'giamdoc'])('%s thấy dinhBien/conTrong/ghiChu trong viTri', async (ten) => {
    const res = await goi('get', '/phongBan/3', token[ten]);
    expect(res.status).toBe(200);
    expect(res.body.data.tongQuanSo).toBe(4);
    const vt3 = res.body.data.viTri.find((v) => v.id === 3);
    expect(vt3).toMatchObject({ dinhBien: 1, conTrong: 0, ghiChu: 'Trưởng phòng Kỹ thuật', soDangGiu: 1 });
  });

  test('mọi vai trò xem danh sách chức danh', async () => {
    const res = await goi('get', '/chucDanh', token.nhanvien);
    expect(res.status).toBe(200);
    const [ds] = await pool.query('SELECT maChucDanh FROM chucdanh');
    const kyVong = ds.map((c) => c.maChucDanh).sort();
    expect(kyVong).toEqual(expect.arrayContaining(['CVNS', 'GD', 'LTV', 'NVKD', 'PGD', 'QTHT', 'TP']));
    expect([...res.body.data.map((c) => c.maChucDanh)].sort()).toEqual(kyVong);
    expect((await goi('get', '/chucDanh?trangThai=XYZ', token.nhanvien)).status).toBe(400);
  });

  test.each(['hr', 'giamdoc'])('%s xem danh sách vị trí kèm định biên', async (ten) => {
    const res = await goi('get', '/chucDanhPhongBan?phongBanId=4', token[ten]);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ id: 5, dinhBien: 10, soDangGiu: 2, conTrong: 8 });
  });

  test.each(['admin', 'quanly', 'nhanvien'])('%s không được xem danh sách vị trí (403)', async (ten) => {
    const res = await goi('get', '/chucDanhPhongBan', token[ten]);
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, code: 403, data: null });
  });
});

// ===========================================================================
describe('Quản lý phòng ban (HR)', () => {
  test.each(['admin', 'giamdoc', 'quanly', 'nhanvien'])('%s không được thêm/sửa/đổi trạng thái phòng ban (403)', async (ten) => {
    expect((await goi('post', '/phongBan', token[ten]).send({ maPhongBan: 'QAX', tenPhongBan: 'Thử' })).status).toBe(403);
    expect((await goi('patch', '/phongBan/2', token[ten]).send({ tenPhongBan: 'Thử' })).status).toBe(403);
    expect((await doiTrangThai('phongBan', 2, 'NGUNG_HOAT_DONG', token[ten])).status).toBe(403);
  });

  test('thêm phòng ban: mã tự viết hoa, trả 201 chuẩn, ghi THEM_PHONG_BAN', async () => {
    const ma = maMoi('qa-');
    const res = await goi('post', '/phongBan', token.hr).send({ maPhongBan: ma, tenPhongBan: '  Phòng Kiểm thử  ', phongBanChaId: 3 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, code: 201 });
    expect(res.body.data).toMatchObject({
      maPhongBan: ma.toUpperCase(), tenPhongBan: 'Phòng Kiểm thử', phongBanChaId: 3,
      trangThai: 'DANG_HOAT_DONG', truongBoPhanId: null, soNhanVien: 0, tongQuanSo: 0, viTri: [],
    });
    expect(await demNhatKy('THEM_PHONG_BAN', 4)).toBe(1);
  });

  test('thêm phòng ban gốc không có cha', async () => {
    const pb = await taoPhongBan({ phongBanChaId: undefined });
    expect(pb.phongBanChaId).toBeNull();
  });

  test('thêm phòng ban trùng mã (không phân biệt hoa thường) trả 409', async () => {
    const res = await goi('post', '/phongBan', token.hr).send({ maPhongBan: 'pkt', tenPhongBan: 'Trùng' });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: 409, data: null });
    expect(await demNhatKy('THEM_PHONG_BAN')).toBe(0);
  });

  test('phòng ban cha không tồn tại 404, cha đang ngừng 409', async () => {
    expect((await goi('post', '/phongBan', token.hr).send({ maPhongBan: maMoi(), tenPhongBan: 'Thử', phongBanChaId: 99999 })).status).toBe(404);
    const cha = await taoPhongBan();
    expect((await doiTrangThai('phongBan', cha.id, 'NGUNG_HOAT_DONG')).status).toBe(200);
    const res = await goi('post', '/phongBan', token.hr).send({ maPhongBan: maMoi(), tenPhongBan: 'Thử', phongBanChaId: cha.id });
    expect(res.status).toBe(409);
  });

  test.each([
    [{ tenPhongBan: 'Thiếu mã' }],
    [{ maPhongBan: 'A', tenPhongBan: 'Mã quá ngắn' }],
    [{ maPhongBan: 'MÃ CÓ DẤU', tenPhongBan: 'Sai mẫu' }],
    [{ maPhongBan: 'X'.repeat(21), tenPhongBan: 'Mã quá dài' }],
    [{ maPhongBan: 'QAOK' }],
    [{ maPhongBan: 'QAOK', tenPhongBan: 'T' }],
    [{ maPhongBan: 'QAOK', tenPhongBan: 'Cha sai', phongBanChaId: 'abc' }],
    [{ maPhongBan: 'QAOK', tenPhongBan: 'Cha âm', phongBanChaId: -1 }],
  ])('thêm phòng ban dữ liệu sai %j trả 400', async (body) => {
    const res = await goi('post', '/phongBan', token.hr).send(body);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: 400, data: null });
  });

  test('sửa tên phòng ban ghi SUA_PHONG_BAN; body rỗng 400; không tồn tại 404', async () => {
    const pb = await taoPhongBan();
    const res = await goi('patch', `/phongBan/${pb.id}`, token.hr).send({ tenPhongBan: 'Tên mới' });
    expect(res.status).toBe(200);
    expect(res.body.data.tenPhongBan).toBe('Tên mới');
    expect(await demNhatKy('SUA_PHONG_BAN', 4)).toBe(1);
    expect((await goi('patch', `/phongBan/${pb.id}`, token.hr).send({})).status).toBe(400);
    expect((await goi('patch', '/phongBan/99999', token.hr).send({ tenPhongBan: 'Không có' })).status).toBe(404);
  });

  test('đổi cha thành phòng con cháu hoặc chính nó trả 409, cây không đổi', async () => {
    expect((await goi('patch', '/phongBan/3', token.hr).send({ phongBanChaId: 4 })).status).toBe(409);
    expect((await goi('patch', '/phongBan/1', token.hr).send({ phongBanChaId: 4 })).status).toBe(409); // cháu
    expect((await goi('patch', '/phongBan/3', token.hr).send({ phongBanChaId: 3 })).status).toBe(409);
    expect((await layPhongBan(3)).phongBanChaId).toBe(1);
    expect((await layPhongBan(1)).phongBanChaId).toBeNull();
    expect(await demNhatKy('SUA_PHONG_BAN')).toBe(0);
  });

  test('đổi cha sang phòng khác hợp lệ và null thành phòng gốc', async () => {
    const pb = await taoPhongBan({ phongBanChaId: 1 });
    const doi = await goi('patch', `/phongBan/${pb.id}`, token.hr).send({ phongBanChaId: 2 });
    expect(doi.status).toBe(200);
    expect(doi.body.data.phongBanChaId).toBe(2);
    const goc = await goi('patch', `/phongBan/${pb.id}`, token.hr).send({ phongBanChaId: null });
    expect(goc.status).toBe(200);
    expect(goc.body.data.phongBanChaId).toBeNull();
  });

  test('ngừng phòng ban còn nhân viên đang làm trả 409', async () => {
    const res = await doiTrangThai('phongBan', 4, 'NGUNG_HOAT_DONG');
    expect(res.status).toBe(409);
    expect((await layPhongBan(4)).trangThai).toBe('DANG_HOAT_DONG');
  });

  test('ngừng phòng ban còn phòng con hoạt động trả 409', async () => {
    const cha = await taoPhongBan();
    await taoPhongBan({ phongBanChaId: cha.id });
    const res = await doiTrangThai('phongBan', cha.id, 'NGUNG_HOAT_DONG');
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/phòng ban con/);
  });

  test('ngừng thành công: gỡ truongBoPhanId, ghi MIEN_NHIEM_TRUONG_BO_PHAN và NGUNG_PHONG_BAN', async () => {
    const pb = await taoPhongBan();
    await pool.execute('UPDATE phongban SET truongBoPhanId = 5 WHERE id = ?', [pb.id]);
    const res = await doiTrangThai('phongBan', pb.id, 'NGUNG_HOAT_DONG');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ trangThai: 'NGUNG_HOAT_DONG', truongBoPhanId: null });
    expect(await demNhatKy('MIEN_NHIEM_TRUONG_BO_PHAN', 4)).toBe(1);
    expect(await demNhatKy('NGUNG_PHONG_BAN', 4)).toBe(1);
  });

  test('kích hoạt lại phòng ban ghi KICH_HOAT_PHONG_BAN; khi cha đang ngừng trả 409', async () => {
    const cha = await taoPhongBan();
    const con = await taoPhongBan({ phongBanChaId: cha.id });
    expect((await doiTrangThai('phongBan', con.id, 'NGUNG_HOAT_DONG')).status).toBe(200);
    expect((await doiTrangThai('phongBan', cha.id, 'NGUNG_HOAT_DONG')).status).toBe(200);
    expect((await doiTrangThai('phongBan', con.id, 'DANG_HOAT_DONG')).status).toBe(409);
    expect((await doiTrangThai('phongBan', cha.id, 'DANG_HOAT_DONG')).status).toBe(200);
    expect((await doiTrangThai('phongBan', con.id, 'DANG_HOAT_DONG')).status).toBe(200);
    expect(await demNhatKy('KICH_HOAT_PHONG_BAN', 4)).toBe(2);
  });

  test('đổi về trạng thái hiện tại 400, giá trị trạng thái sai 400', async () => {
    expect((await doiTrangThai('phongBan', 1, 'DANG_HOAT_DONG')).status).toBe(400);
    expect((await doiTrangThai('phongBan', 1, 'PENDING')).status).toBe(400);
    expect((await goi('post', '/phongBan/1/doiTrangThai', token.hr).send({})).status).toBe(400);
    expect((await doiTrangThai('phongBan', 99999, 'NGUNG_HOAT_DONG')).status).toBe(404);
  });

  test('phòng con và cha đều ngừng: đổi tên phòng con gửi kèm phongBanChaId cũ vẫn 200', async () => {
    const cha = await taoPhongBan();
    const con = await taoPhongBan({ phongBanChaId: cha.id });
    expect((await doiTrangThai('phongBan', con.id, 'NGUNG_HOAT_DONG')).status).toBe(200);
    expect((await doiTrangThai('phongBan', cha.id, 'NGUNG_HOAT_DONG')).status).toBe(200);
    const res = await goi('patch', `/phongBan/${con.id}`, token.hr).send({ tenPhongBan: 'Tên mới phòng con', phongBanChaId: cha.id });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, code: 200 });
    expect(res.body.data).toMatchObject({ tenPhongBan: 'Tên mới phòng con', phongBanChaId: cha.id });
    expect(await demNhatKy('SUA_PHONG_BAN', 4)).toBe(1);
  });

  test('không đổi cha sang phòng đang ngừng (409)', async () => {
    const ngung = await taoPhongBan();
    await doiTrangThai('phongBan', ngung.id, 'NGUNG_HOAT_DONG');
    const pb = await taoPhongBan();
    expect((await goi('patch', `/phongBan/${pb.id}`, token.hr).send({ phongBanChaId: ngung.id })).status).toBe(409);
  });
});

// ===========================================================================
describe('Quản lý chức danh (HR)', () => {
  test('thêm chức danh: mã viết hoa, 201, ghi THEM_CHUC_DANH', async () => {
    const ma = maMoi('cd-');
    const res = await goi('post', '/chucDanh', token.hr).send({ maChucDanh: ma, tenChucDanh: 'Kiểm thử viên', capBac: 'Chuyên viên' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ maChucDanh: ma.toUpperCase(), tenChucDanh: 'Kiểm thử viên', trangThai: 'DANG_HOAT_DONG' });
    expect(await demNhatKy('THEM_CHUC_DANH', 4)).toBe(1);
  });

  test('trùng mã chức danh trả 409', async () => {
    const res = await goi('post', '/chucDanh', token.hr).send({ maChucDanh: 'ltv', tenChucDanh: 'Trùng', capBac: 'Nhân viên' });
    expect(res.status).toBe(409);
  });

  test.each([
    [{ tenChucDanh: 'Thiếu mã', capBac: 'NV' }],
    [{ maChucDanh: 'CDOK', capBac: 'NV' }],
    [{ maChucDanh: 'CDOK', tenChucDanh: 'Thiếu cấp' }],
    [{ maChucDanh: 'C D', tenChucDanh: 'Sai mẫu', capBac: 'NV' }],
  ])('thêm chức danh dữ liệu sai %j trả 400', async (body) => {
    expect((await goi('post', '/chucDanh', token.hr).send(body)).status).toBe(400);
  });

  test.each(['admin', 'giamdoc', 'quanly', 'nhanvien'])('%s không được quản lý chức danh (403)', async (ten) => {
    expect((await goi('post', '/chucDanh', token[ten]).send({ maChucDanh: 'CDX', tenChucDanh: 'Thử', capBac: 'NV' })).status).toBe(403);
    expect((await goi('patch', '/chucDanh/5', token[ten]).send({ tenChucDanh: 'Thử' })).status).toBe(403);
    expect((await doiTrangThai('chucDanh', 5, 'NGUNG_HOAT_DONG', token[ten])).status).toBe(403);
  });

  test('sửa chức danh ghi SUA_CHUC_DANH; body rỗng 400; không tồn tại 404', async () => {
    const cd = await taoChucDanh();
    const res = await goi('patch', `/chucDanh/${cd.id}`, token.hr).send({ tenChucDanh: 'Tên mới', capBac: 'Quản lý' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ tenChucDanh: 'Tên mới', capBac: 'Quản lý', maChucDanh: cd.maChucDanh });
    expect(await demNhatKy('SUA_CHUC_DANH', 4)).toBe(1);
    expect((await goi('patch', `/chucDanh/${cd.id}`, token.hr).send({})).status).toBe(400);
    expect((await goi('patch', '/chucDanh/99999', token.hr).send({ tenChucDanh: 'Không có' })).status).toBe(404);
  });

  test('ngừng chức danh còn vị trí DANG_AP_DUNG trả 409', async () => {
    const res = await doiTrangThai('chucDanh', 5, 'NGUNG_HOAT_DONG');
    expect(res.status).toBe(409);
  });

  test('ngừng rồi kích hoạt chức danh không còn vị trí áp dụng; đổi về trạng thái hiện tại 400', async () => {
    const cd = await taoChucDanh();
    const vt = await taoViTri(4, cd.id);
    expect((await doiTrangThai('chucDanh', cd.id, 'NGUNG_HOAT_DONG')).status).toBe(409);
    expect((await doiTrangThai('chucDanhPhongBan', vt.id, 'NGUNG_AP_DUNG')).status).toBe(200);
    const ngung = await doiTrangThai('chucDanh', cd.id, 'NGUNG_HOAT_DONG');
    expect(ngung.status).toBe(200);
    expect(ngung.body.data.trangThai).toBe('NGUNG_HOAT_DONG');
    expect((await doiTrangThai('chucDanh', cd.id, 'NGUNG_HOAT_DONG')).status).toBe(400);
    expect((await doiTrangThai('chucDanh', cd.id, 'DANG_HOAT_DONG')).status).toBe(200);
    expect(await demNhatKy('NGUNG_CHUC_DANH', 4)).toBe(1);
    expect(await demNhatKy('KICH_HOAT_CHUC_DANH', 4)).toBe(1);
  });
});

// ===========================================================================
describe('Quản lý vị trí (chucDanhPhongBan, HR)', () => {
  test('thêm vị trí 201, ghi THEM_VI_TRI', async () => {
    const res = await goi('post', '/chucDanhPhongBan', token.hr).send({ phongBanId: 4, chucDanhId: 2, dinhBien: 2, ghiChu: ' Trưởng nhóm ' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ phongBanId: 4, chucDanhId: 2, dinhBien: 2, ghiChu: 'Trưởng nhóm', trangThai: 'DANG_AP_DUNG', soDangGiu: 0, conTrong: 2 });
    expect(await demNhatKy('THEM_VI_TRI', 4)).toBe(1);
  });

  test('thêm vị trí vào phòng ngừng hoặc chức danh ngừng trả 409', async () => {
    const pb = await taoPhongBan();
    await doiTrangThai('phongBan', pb.id, 'NGUNG_HOAT_DONG');
    expect((await goi('post', '/chucDanhPhongBan', token.hr).send({ phongBanId: pb.id, chucDanhId: 5, dinhBien: 1 })).status).toBe(409);
    const cd = await taoChucDanh();
    await doiTrangThai('chucDanh', cd.id, 'NGUNG_HOAT_DONG');
    expect((await goi('post', '/chucDanhPhongBan', token.hr).send({ phongBanId: 4, chucDanhId: cd.id, dinhBien: 1 })).status).toBe(409);
    expect(await demNhatKy('THEM_VI_TRI')).toBe(0);
  });

  test('thêm vị trí trùng cặp phòng ban - chức danh trả 409; phòng/chức danh không tồn tại 404', async () => {
    const trung = await goi('post', '/chucDanhPhongBan', token.hr).send({ phongBanId: 4, chucDanhId: 5, dinhBien: 1 });
    expect(trung.status).toBe(409);
    expect(trung.body).toMatchObject({ success: false, code: 409, data: null });
    expect((await goi('post', '/chucDanhPhongBan', token.hr).send({ phongBanId: 99999, chucDanhId: 5, dinhBien: 1 })).status).toBe(404);
    expect((await goi('post', '/chucDanhPhongBan', token.hr).send({ phongBanId: 4, chucDanhId: 99999, dinhBien: 1 })).status).toBe(404);
  });

  test.each([0, 1001, 'abc', -5, 2.5, null])('định biên %p không hợp lệ trả 400', async (dinhBien) => {
    const res = await goi('post', '/chucDanhPhongBan', token.hr).send({ phongBanId: 4, chucDanhId: 2, dinhBien });
    expect(res.status).toBe(400);
  });

  test.each(['admin', 'giamdoc', 'quanly', 'nhanvien'])('%s không được quản lý vị trí (403)', async (ten) => {
    expect((await goi('post', '/chucDanhPhongBan', token[ten]).send({ phongBanId: 4, chucDanhId: 2, dinhBien: 1 })).status).toBe(403);
    expect((await goi('patch', '/chucDanhPhongBan/5', token[ten]).send({ dinhBien: 20 })).status).toBe(403);
    expect((await doiTrangThai('chucDanhPhongBan', 5, 'NGUNG_AP_DUNG', token[ten])).status).toBe(403);
  });

  test('sửa định biên nhỏ hơn số đang giữ 409; bằng số đang giữ 200, ghi SUA_VI_TRI', async () => {
    expect((await goi('patch', '/chucDanhPhongBan/5', token.hr).send({ dinhBien: 1 })).status).toBe(409);
    const res = await goi('patch', '/chucDanhPhongBan/5', token.hr).send({ dinhBien: 2 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ dinhBien: 2, conTrong: 0 });
    expect(await demNhatKy('SUA_VI_TRI', 4)).toBe(1);
    expect((await goi('patch', '/chucDanhPhongBan/5', token.hr).send({ dinhBien: 1001 })).status).toBe(400);
    expect((await goi('patch', '/chucDanhPhongBan/5', token.hr).send({})).status).toBe(400);
    expect((await goi('patch', '/chucDanhPhongBan/99999', token.hr).send({ dinhBien: 3 })).status).toBe(404);
  });

  test('ngừng vị trí khi còn người giữ trả 409', async () => {
    expect((await doiTrangThai('chucDanhPhongBan', 5, 'NGUNG_AP_DUNG')).status).toBe(409);
  });

  test('sau khi ngừng vị trí, HR thêm nhân viên vào vị trí đó trả 409', async () => {
    const vt = await taoViTri(4, 2, 2);
    const ngung = await doiTrangThai('chucDanhPhongBan', vt.id, 'NGUNG_AP_DUNG');
    expect(ngung.status).toBe(200);
    expect(ngung.body.data.trangThai).toBe('NGUNG_AP_DUNG');
    expect(await demNhatKy('NGUNG_VI_TRI', 4)).toBe(1);
    const res = await goi('post', '/nhanVien', token.hr).send(duLieuNhanVien(vt.id));
    expect(res.status).toBe(409);
    expect(await demNhatKy('THEM_NHAN_VIEN')).toBe(0);
  });

  test('áp dụng lại vị trí khi phòng ban đã ngừng trả 409; khi phòng hoạt động thì 200', async () => {
    const pb = await taoPhongBan();
    const vt = await taoViTri(pb.id, 5, 1);
    expect((await doiTrangThai('chucDanhPhongBan', vt.id, 'NGUNG_AP_DUNG')).status).toBe(200);
    expect((await doiTrangThai('chucDanhPhongBan', vt.id, 'NGUNG_AP_DUNG')).status).toBe(400);
    expect((await doiTrangThai('phongBan', pb.id, 'NGUNG_HOAT_DONG')).status).toBe(200);
    expect((await doiTrangThai('chucDanhPhongBan', vt.id, 'DANG_AP_DUNG')).status).toBe(409);
    expect((await doiTrangThai('phongBan', pb.id, 'DANG_HOAT_DONG')).status).toBe(200);
    expect((await doiTrangThai('chucDanhPhongBan', vt.id, 'DANG_AP_DUNG')).status).toBe(200);
    expect(await demNhatKy('AP_DUNG_VI_TRI', 4)).toBe(1);
  });
});

// ===========================================================================
describe('Bổ nhiệm / miễn nhiệm trưởng bộ phận (giamDoc)', () => {
  test.each(['admin', 'hr', 'quanly', 'nhanvien'])('%s không được bổ nhiệm/miễn nhiệm (403)', async (ten) => {
    expect((await boNhiem(4, 5, token[ten])).status).toBe(403);
    expect((await mienNhiem(3, token[ten])).status).toBe(403);
    expect((await layPhongBan(3)).truongBoPhanId).toBe(3);
  });

  test('chưa đăng nhập bổ nhiệm trả 401', async () => {
    expect((await goi('post', '/phongBan/4/boNhiem').send({ nhanVienId: 5 })).status).toBe(401);
  });

  test('người thuộc phòng khác trả 409', async () => {
    const res = await boNhiem(3, 4); // NV0004 ở PNS
    expect(res.status).toBe(409);
    expect((await layPhongBan(3)).truongBoPhanId).toBe(3);
  });

  test.each(['DA_NGHI_VIEC', 'TAM_NGHI'])('nhân viên %s không được bổ nhiệm (409)', async (trangThai) => {
    await pool.execute('UPDATE nhanvien SET trangThaiLamViec = ? WHERE id = 5', [trangThai]);
    expect((await boNhiem(4, 5)).status).toBe(409);
    expect((await layPhongBan(4)).truongBoPhanId).toBeNull();
  });

  test('tài khoản bị KHOA không được bổ nhiệm (409)', async () => {
    await pool.execute("UPDATE nguoidung SET trangThai = 'KHOA' WHERE id = 5");
    expect((await boNhiem(4, 5)).status).toBe(409);
    expect(await layVaiTro(5)).toEqual(['nhanVien']);
  });

  test('giamDoc tự bổ nhiệm chính mình trả 403', async () => {
    expect((await boNhiem(1, 2)).status).toBe(403);
  });

  test('nhân viên không tồn tại 404, phòng ban không tồn tại 404, nhanVienId sai 400', async () => {
    expect((await boNhiem(4, 99999)).status).toBe(404);
    expect((await boNhiem(99999, 5)).status).toBe(404);
    expect((await boNhiem(4, 'abc')).status).toBe(400);
    expect((await goi('post', '/phongBan/4/boNhiem', token.giamdoc).send({})).status).toBe(400);
  });

  test('bổ nhiệm người đã là trưởng bộ phận đó trả 400; miễn nhiệm phòng chưa có trưởng 400', async () => {
    expect((await boNhiem(3, 3)).status).toBe(400);
    expect((await mienNhiem(4)).status).toBe(400);
  });

  test('bổ nhiệm thành công: tự gán quanLy, ghi nhật ký, người mới chỉ thấy phòng mình', async () => {
    const res = await boNhiem(4, 5);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, code: 200 });
    expect(res.body.data).toMatchObject({ id: 4, truongBoPhanId: 5, maTruongBoPhan: 'NV0005' });
    expect(await layVaiTro(5)).toEqual(['nhanVien', 'quanLy']);
    expect(await demNhatKy('TU_DONG_GAN_QUAN_LY', 5)).toBe(1);
    expect(await demNhatKy('BO_NHIEM_TRUONG_BO_PHAN', 2)).toBe(1);

    const ds = await goi('get', '/nhanVien', token.nhanvien);
    expect(ds.status).toBe(200);
    expect(ds.body.data.items.map((nv) => nv.id).sort()).toEqual([5, 6]);
  });

  test('miễn nhiệm người được tự gán: gỡ quanLy, ghi TU_DONG_GO_QUAN_LY, mất quyền xem danh sách', async () => {
    expect((await boNhiem(4, 5)).status).toBe(200);
    const res = await mienNhiem(4);
    expect(res.status).toBe(200);
    expect(res.body.data.truongBoPhanId).toBeNull();
    expect(await layVaiTro(5)).toEqual(['nhanVien']);
    expect(await demNhatKy('TU_DONG_GO_QUAN_LY', 5)).toBe(1);
    expect(await demNhatKy('MIEN_NHIEM_TRUONG_BO_PHAN', 2)).toBe(1);
    expect((await goi('get', '/nhanVien', token.nhanvien)).status).toBe(403);
  });

  test('bổ nhiệm người thay thế: người cũ được tự gán thì bị gỡ quanLy', async () => {
    expect((await boNhiem(4, 5)).status).toBe(200);
    const res = await boNhiem(4, 6);
    expect(res.status).toBe(200);
    expect(res.body.data.truongBoPhanId).toBe(6);
    expect(await layVaiTro(5)).toEqual(['nhanVien']);
    expect(await layVaiTro(6)).toEqual(['nhanVien', 'quanLy']);
    expect(await demNhatKy('TU_DONG_GO_QUAN_LY', 5)).toBe(1);
  });

  test('thay quanly seed (NV0003) ở PKT: NV0003 vẫn giữ quanLy', async () => {
    const res = await boNhiem(3, 1); // NV0001 (admin) thuộc PKT
    expect(res.status).toBe(200);
    expect(res.body.data.truongBoPhanId).toBe(1);
    expect(await layVaiTro(3)).toEqual(['nhanVien', 'quanLy']);
    expect(await demNhatKy('TU_DONG_GO_QUAN_LY', 3)).toBe(0);
    expect(await demNhatKy('TU_DONG_GAN_QUAN_LY', 3)).toBe(0);
    expect(await layVaiTro(1)).toEqual(['Admin', 'nhanVien', 'quanLy']);
    expect(await demNhatKy('TU_DONG_GAN_QUAN_LY', 1)).toBe(1);
  });

  test('quanLy do Admin gán tay: bổ nhiệm rồi miễn nhiệm vẫn giữ quanLy', async () => {
    const gan = await goi('put', '/nguoiDung/5/vaiTro', token.admin).send({ vaiTro: ['nhanVien', 'quanLy'] });
    expect(gan.status).toBe(200);
    expect(await demNhatKy('DUOC_PHAN_QUYEN', 5)).toBe(1);
    expect((await boNhiem(4, 5)).status).toBe(200);
    expect(await demNhatKy('TU_DONG_GAN_QUAN_LY', 5)).toBe(0);
    expect((await mienNhiem(4)).status).toBe(200);
    expect(await layVaiTro(5)).toEqual(['nhanVien', 'quanLy']);
    expect(await demNhatKy('TU_DONG_GO_QUAN_LY', 5)).toBe(0);
  });

  test('Admin chỉ thêm HR cho người được tự gán quanLy: không ghi DUOC_PHAN_QUYEN, miễn nhiệm vẫn tự gỡ quanLy', async () => {
    expect((await boNhiem(4, 5)).status).toBe(200);
    expect(await layVaiTro(5)).toEqual(['nhanVien', 'quanLy']);
    const them = await goi('put', '/nguoiDung/5/vaiTro', token.admin).send({ vaiTro: ['nhanVien', 'quanLy', 'HR'] });
    expect(them.status).toBe(200);
    expect(await demNhatKy('DUOC_PHAN_QUYEN', 5)).toBe(0);
    expect((await mienNhiem(4)).status).toBe(200);
    expect(await layVaiTro(5)).toEqual(['HR', 'nhanVien']);
    expect(await demNhatKy('TU_DONG_GO_QUAN_LY', 5)).toBe(1);
  });

  test('Admin chủ động gán quanLy sau khi được tự gán: miễn nhiệm không gỡ quanLy', async () => {
    expect((await boNhiem(4, 5)).status).toBe(200);
    // Sau lần tự gỡ, Admin chủ động gán quanLy (ghi DUOC_PHAN_QUYEN) -> lần miễn nhiệm sau không được gỡ
    expect((await mienNhiem(4)).status).toBe(200);
    expect(await layVaiTro(5)).toEqual(['nhanVien']);
    const gan = await goi('put', '/nguoiDung/5/vaiTro', token.admin).send({ vaiTro: ['nhanVien', 'quanLy'] });
    expect(gan.status).toBe(200);
    expect(await demNhatKy('DUOC_PHAN_QUYEN', 5)).toBe(1);
    expect((await boNhiem(4, 5)).status).toBe(200);
    expect((await mienNhiem(4)).status).toBe(200);
    expect(await layVaiTro(5)).toEqual(['nhanVien', 'quanLy']);
    expect(await demNhatKy('TU_DONG_GO_QUAN_LY', 5)).toBe(1); // chỉ lần miễn nhiệm đầu
  });

  test('bổ nhiệm vào phòng ban đang ngừng trả 409', async () => {
    const pb = await taoPhongBan();
    await doiTrangThai('phongBan', pb.id, 'NGUNG_HOAT_DONG');
    expect((await boNhiem(pb.id, 5)).status).toBe(409);
  });
});

// ===========================================================================
describe('Ràng buộc chéo với tài khoản và hồ sơ', () => {
  test('Admin gỡ quanLy của người đang là trưởng bộ phận trả 409', async () => {
    const res = await goi('put', '/nguoiDung/3/vaiTro', token.admin).send({ vaiTro: ['nhanVien'] });
    expect(res.status).toBe(409);
    expect(await layVaiTro(3)).toEqual(['nhanVien', 'quanLy']);
  });

  test.each(['TAM_NGHI', 'DA_NGHI_VIEC'])('HR chuyển trưởng bộ phận sang %s trả 409', async (trangThaiLamViec) => {
    const res = await goi('post', '/nhanVien/3/doiTrangThai', token.hr).send({ trangThaiLamViec });
    expect(res.status).toBe(409);
    const [d] = await pool.execute('SELECT trangThaiLamViec FROM nhanvien WHERE id = 3');
    expect(d[0].trangThaiLamViec).toBe('CHINH_THUC');
  });

  test('sau khi miễn nhiệm, Admin gỡ được quanLy của quanly seed', async () => {
    expect((await boNhiem(3, 1)).status).toBe(200);
    const res = await goi('put', '/nguoiDung/3/vaiTro', token.admin).send({ vaiTro: ['nhanVien'] });
    expect(res.status).toBe(200);
    expect(await layVaiTro(3)).toEqual(['nhanVien']);
  });
});

// ===========================================================================
describe('Chạy song song', () => {
  test('ngừng phòng ban và thêm nhân viên cùng lúc không để phòng ngừng còn nhân viên', async () => {
    for (let lan = 0; lan < 3; lan += 1) {
      const pb = await taoPhongBan();
      const vt = await taoViTri(pb.id, 5, 5);
      const [ngung, them] = await Promise.all([
        doiTrangThai('phongBan', pb.id, 'NGUNG_HOAT_DONG'),
        goi('post', '/nhanVien', token.hr).send(duLieuNhanVien(vt.id)),
      ]);
      expect([200, 409]).toContain(ngung.status);
      expect([201, 409]).toContain(them.status);
      const [d] = await pool.execute(
        `SELECT pb.trangThai, (SELECT COUNT(*) FROM nhanvien nv JOIN chucdanhphongban c ON c.id = nv.chucDanhPhongBanId
           WHERE c.phongBanId = pb.id AND nv.trangThaiLamViec <> 'DA_NGHI_VIEC') AS soNv
           FROM phongban pb WHERE pb.id = ?`,
        [pb.id]
      );
      if (d[0].trangThai === 'NGUNG_HOAT_DONG') expect(Number(d[0].soNv)).toBe(0);
      expect(ngung.status === 200 && them.status === 201).toBe(false);
    }
  });

  // Đếm nhân viên đang làm trong phòng + trạng thái phòng, đọc trực tiếp CSDL
  async function trangThaiVaSoNv(pbId) {
    const [d] = await pool.execute(
      `SELECT pb.trangThai, (SELECT COUNT(*) FROM nhanvien nv JOIN chucdanhphongban c ON c.id = nv.chucDanhPhongBanId
         WHERE c.phongBanId = pb.id AND nv.trangThaiLamViec <> 'DA_NGHI_VIEC') AS soNv
         FROM phongban pb WHERE pb.id = ?`,
      [pbId]
    );
    return { trangThai: d[0].trangThai, soNv: Number(d[0].soNv) };
  }
  const dieuChuyen = (nvId, chucDanhPhongBanId) => goi('post', `/nhanVien/${nvId}/dieuChuyen`, token.hr).send({ chucDanhPhongBanId });

  test('ngừng phòng ban cùng lúc điều chuyển nhân viên RA khỏi phòng: không 500, phòng ngừng không còn nhân viên', async () => {
    for (let lan = 0; lan < 4; lan += 1) {
      const pb = await taoPhongBan();
      const vt = await taoViTri(pb.id, 5, 3);
      const them = await goi('post', '/nhanVien', token.hr).send(duLieuNhanVien(vt.id));
      expect(them.status).toBe(201);
      const nvId = them.body.data.nhanVien.id;
      const [ngung, chuyen] = await Promise.all([doiTrangThai('phongBan', pb.id, 'NGUNG_HOAT_DONG'), dieuChuyen(nvId, 5)]);
      expect([200, 409]).toContain(ngung.status);
      expect([200, 409]).toContain(chuyen.status);
      const kq = await trangThaiVaSoNv(pb.id);
      if (kq.trangThai === 'NGUNG_HOAT_DONG') expect(kq.soNv).toBe(0);
      // Ngừng thành công thì điều chuyển ra phải đã thành công trước đó
      if (ngung.status === 200) expect(chuyen.status).toBe(200);
      const [d] = await pool.execute('SELECT chucDanhPhongBanId FROM nhanvien WHERE id = ?', [nvId]);
      expect(d[0].chucDanhPhongBanId).toBe(chuyen.status === 200 ? 5 : vt.id);
    }
  });

  test('ngừng phòng ban cùng lúc điều chuyển nhân viên VÀO phòng: không 500, không cả hai cùng thành công', async () => {
    for (let lan = 0; lan < 4; lan += 1) {
      const pb = await taoPhongBan();
      const vt = await taoViTri(pb.id, 5, 3);
      const them = await goi('post', '/nhanVien', token.hr).send(duLieuNhanVien(5));
      expect(them.status).toBe(201);
      const nvId = them.body.data.nhanVien.id;
      const [ngung, chuyen] = await Promise.all([doiTrangThai('phongBan', pb.id, 'NGUNG_HOAT_DONG'), dieuChuyen(nvId, vt.id)]);
      expect([200, 409]).toContain(ngung.status);
      expect([200, 409]).toContain(chuyen.status);
      expect(ngung.status === 200 && chuyen.status === 200).toBe(false);
      const kq = await trangThaiVaSoNv(pb.id);
      if (kq.trangThai === 'NGUNG_HOAT_DONG') expect(kq.soNv).toBe(0);
      expect(kq.soNv).toBe(chuyen.status === 200 ? 1 : 0);
    }
  });
});

// ===========================================================================
describe('PATCH kèm trangThai trong cùng transaction', () => {
  const suaViTri = (id, body) => goi('patch', `/chucDanhPhongBan/${id}`, token.hr).send(body);
  const suaChucDanh = (id, body) => goi('patch', `/chucDanh/${id}`, token.hr).send(body);
  async function layViTriDb(id) {
    const [d] = await pool.execute('SELECT dinhBien, ghiChu, trangThai FROM chucdanhphongban WHERE id = ?', [id]);
    return d[0];
  }

  test('đổi ghiChu + ngừng vị trí trống: 200, ghi cả SUA_VI_TRI và NGUNG_VI_TRI', async () => {
    const vt = await taoViTri(4, 2, 2);
    const res = await suaViTri(vt.id, { ghiChu: 'Tạm ngừng tuyển', trangThai: 'NGUNG_AP_DUNG' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, code: 200 });
    expect(res.body.data).toMatchObject({ id: vt.id, ghiChu: 'Tạm ngừng tuyển', trangThai: 'NGUNG_AP_DUNG' });
    expect(await layViTriDb(vt.id)).toMatchObject({ ghiChu: 'Tạm ngừng tuyển', trangThai: 'NGUNG_AP_DUNG' });
    expect(await demNhatKy('SUA_VI_TRI', 4)).toBe(1);
    expect(await demNhatKy('NGUNG_VI_TRI', 4)).toBe(1);
  });

  test('đổi dinhBien + ngừng vị trí còn người giữ: 409, rollback dinhBien, không ghi SUA_VI_TRI', async () => {
    const truoc = await layViTriDb(5);
    const res = await suaViTri(5, { dinhBien: 20, trangThai: 'NGUNG_AP_DUNG' });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: 409, data: null });
    expect(await layViTriDb(5)).toEqual(truoc);
    expect(await demNhatKy('SUA_VI_TRI')).toBe(0);
    expect(await demNhatKy('NGUNG_VI_TRI')).toBe(0);
  });

  test('vị trí: chỉ gửi trangThai trùng hiện tại trả 400', async () => {
    const res = await suaViTri(5, { trangThai: 'DANG_AP_DUNG' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: 400, data: null });
    expect(await demNhatKy('SUA_VI_TRI')).toBe(0);
  });

  test.each(['PENDING', 'NGUNG_HOAT_DONG'])('vị trí: trangThai sai giá trị %p trả 400', async (trangThai) => {
    const truoc = await layViTriDb(5);
    const res = await suaViTri(5, { ghiChu: 'Không được lưu', trangThai });
    expect(res.status).toBe(400);
    expect(await layViTriDb(5)).toEqual(truoc);
  });

  // kiemTraDuLieu bỏ qua giá trị rỗng/null ở trường không bắt buộc, nhưng service vẫn coi body.trangThai !== undefined
  test.each(['', '  ', null])('trangThai rỗng %p: không được ghi trạng thái rỗng vào CSDL', async (trangThai) => {
    const vt = await taoViTri(4, 2, 2);
    const cd = await taoChucDanh();
    const r1 = await suaViTri(vt.id, { ghiChu: 'Ghi chú', trangThai });
    const r2 = await suaChucDanh(cd.id, { tenChucDanh: 'Tên mới', trangThai });
    expect(r1.status).toBe(400);
    expect(r2.status).toBe(400);
    expect(r1.body).toMatchObject({ success: false, code: 400, data: null });
    expect((await layViTriDb(vt.id)).trangThai).toBe('DANG_AP_DUNG');
    const [d] = await pool.execute('SELECT trangThai FROM chucdanh WHERE id = ?', [cd.id]);
    expect(d[0].trangThai).toBe('DANG_HOAT_DONG');
  });

  test('vị trí: chỉ gửi trangThai khác hiện tại thì đổi trạng thái, không ghi SUA_VI_TRI', async () => {
    const vt = await taoViTri(4, 2, 2);
    const res = await suaViTri(vt.id, { trangThai: 'NGUNG_AP_DUNG' });
    expect(res.status).toBe(200);
    expect(res.body.data.trangThai).toBe('NGUNG_AP_DUNG');
    expect(await demNhatKy('SUA_VI_TRI')).toBe(0);
    expect(await demNhatKy('NGUNG_VI_TRI', 4)).toBe(1);
  });

  test('chức danh: đổi tên + ngừng khi còn vị trí DANG_AP_DUNG trả 409, tên không đổi', async () => {
    const cd = await taoChucDanh();
    await taoViTri(4, cd.id, 1);
    const res = await suaChucDanh(cd.id, { tenChucDanh: 'Tên không được lưu', trangThai: 'NGUNG_HOAT_DONG' });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: 409, data: null });
    const [d] = await pool.execute('SELECT tenChucDanh, trangThai FROM chucdanh WHERE id = ?', [cd.id]);
    expect(d[0]).toEqual({ tenChucDanh: cd.tenChucDanh, trangThai: 'DANG_HOAT_DONG' });
    expect(await demNhatKy('SUA_CHUC_DANH')).toBe(0);
    expect(await demNhatKy('NGUNG_CHUC_DANH')).toBe(0);
  });

  test('chức danh: đổi tên + ngừng khi không còn vị trí áp dụng: 200, ghi SUA_CHUC_DANH và NGUNG_CHUC_DANH', async () => {
    const cd = await taoChucDanh();
    const res = await suaChucDanh(cd.id, { tenChucDanh: 'Tên mới', trangThai: 'NGUNG_HOAT_DONG' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ tenChucDanh: 'Tên mới', trangThai: 'NGUNG_HOAT_DONG' });
    expect(await demNhatKy('SUA_CHUC_DANH', 4)).toBe(1);
    expect(await demNhatKy('NGUNG_CHUC_DANH', 4)).toBe(1);
  });

  test('chức danh: chỉ gửi trangThai trùng hiện tại 400; trangThai sai giá trị 400', async () => {
    const cd = await taoChucDanh();
    expect((await suaChucDanh(cd.id, { trangThai: 'DANG_HOAT_DONG' })).status).toBe(400);
    const sai = await suaChucDanh(cd.id, { tenChucDanh: 'Không lưu', trangThai: 'NGUNG_AP_DUNG' });
    expect(sai.status).toBe(400);
    expect(sai.body).toMatchObject({ success: false, code: 400, data: null });
    const [d] = await pool.execute('SELECT tenChucDanh FROM chucdanh WHERE id = ?', [cd.id]);
    expect(d[0].tenChucDanh).toBe(cd.tenChucDanh);
  });
});

// ===========================================================================
describe('Chạy song song: chức danh và bổ nhiệm', () => {
  const dieuChuyenNv = (nvId, chucDanhPhongBanId) => goi('post', `/nhanVien/${nvId}/dieuChuyen`, token.hr).send({ chucDanhPhongBanId });
  async function soViTriDangApDung(chucDanhId) {
    const [d] = await pool.execute("SELECT COUNT(*) AS n FROM chucdanhphongban WHERE chucDanhId = ? AND trangThai = 'DANG_AP_DUNG'", [chucDanhId]);
    return Number(d[0].n);
  }
  async function trangThaiChucDanh(id) {
    const [d] = await pool.execute('SELECT trangThai FROM chucdanh WHERE id = ?', [id]);
    return d[0].trangThai;
  }
  async function taoNv(vtId) {
    const r = await goi('post', '/nhanVien', token.hr).send(duLieuNhanVien(vtId));
    expect(r.status).toBe(201);
    return r.body.data.nhanVien.id;
  }

  test('ngừng chức danh cùng lúc điều chuyển nhân viên vào vị trí dùng chức danh đó: không 500, nhất quán', async () => {
    for (let lan = 0; lan < 4; lan += 1) {
      const pb = await taoPhongBan();
      const cd = await taoChucDanh();
      const vt = await taoViTri(pb.id, cd.id, 3);
      const nvId = await taoNv(5);
      const [ngung, chuyen] = await Promise.all([
        lan % 2 ? goi('patch', `/chucDanh/${cd.id}`, token.hr).send({ trangThai: 'NGUNG_HOAT_DONG' }) : doiTrangThai('chucDanh', cd.id, 'NGUNG_HOAT_DONG'),
        dieuChuyenNv(nvId, vt.id),
      ]);
      expect([200, 409]).toContain(ngung.status);
      expect([200, 409]).toContain(chuyen.status);
      // Chức danh đã ngừng thì không còn vị trí DANG_AP_DUNG nào dùng nó
      if ((await trangThaiChucDanh(cd.id)) === 'NGUNG_HOAT_DONG') expect(await soViTriDangApDung(cd.id)).toBe(0);
      const [d] = await pool.execute('SELECT chucDanhPhongBanId FROM nhanvien WHERE id = ?', [nvId]);
      expect(d[0].chucDanhPhongBanId).toBe(chuyen.status === 200 ? vt.id : 5);
    }
  });

  test('ngừng chức danh cùng lúc tạo vị trí dùng chức danh đó: không 500, không cả hai cùng thành công', async () => {
    for (let lan = 0; lan < 4; lan += 1) {
      const pb = await taoPhongBan();
      const cd = await taoChucDanh();
      const [ngung, tao] = await Promise.all([
        doiTrangThai('chucDanh', cd.id, 'NGUNG_HOAT_DONG'),
        goi('post', '/chucDanhPhongBan', token.hr).send({ phongBanId: pb.id, chucDanhId: cd.id, dinhBien: 2 }),
      ]);
      expect([200, 409]).toContain(ngung.status);
      expect([201, 409]).toContain(tao.status);
      expect(ngung.status === 200 && tao.status === 201).toBe(false);
      if ((await trangThaiChucDanh(cd.id)) === 'NGUNG_HOAT_DONG') expect(await soViTriDangApDung(cd.id)).toBe(0);
    }
  });

  test('hai giám đốc bổ nhiệm ở hai phòng có cùng trưởng cũ: không 500, trạng thái cuối khớp phản hồi', async () => {
    const tk2 = (await dangNhap('giamdoc2')).body.data.token;
    for (let lan = 0; lan < 3; lan += 1) {
      const pbA = await taoPhongBan();
      const pbB = await taoPhongBan();
      const vtA = await taoViTri(pbA.id, 5, 5);
      const vtB = await taoViTri(pbB.id, 5, 5);
      const x = await taoNv(vtA.id);
      const y = await taoNv(vtA.id);
      const z = await taoNv(vtB.id);
      // Dựng trực tiếp: cùng một người (x) là trưởng cũ của cả hai phòng
      await pool.execute('UPDATE phongban SET truongBoPhanId = ? WHERE id IN (?, ?)', [x, pbA.id, pbB.id]);
      const [rA, rB] = await Promise.all([boNhiem(pbA.id, y), boNhiem(pbB.id, z, tk2)]);
      expect([200, 409]).toContain(rA.status);
      expect([200, 409]).toContain(rB.status);
      for (const r of [rA, rB]) if (r.status === 409) expect(r.body).toMatchObject({ success: false, code: 409, data: null });
      expect((await layPhongBan(pbA.id)).truongBoPhanId).toBe(rA.status === 200 ? y : x);
      expect((await layPhongBan(pbB.id)).truongBoPhanId).toBe(rB.status === 200 ? z : x);
    }
  });

  test('bổ nhiệm và miễn nhiệm cùng phòng cùng lúc: không 500, trạng thái cuối nhất quán', async () => {
    const tk2 = (await dangNhap('giamdoc2')).body.data.token;
    for (let lan = 0; lan < 4; lan += 1) {
      const pb = await taoPhongBan();
      const vt = await taoViTri(pb.id, 5, 5);
      const a = await taoNv(vt.id);
      const b = await taoNv(vt.id);
      expect((await boNhiem(pb.id, a)).status).toBe(200);
      const [bn, mn] = await Promise.all([boNhiem(pb.id, b), mienNhiem(pb.id, tk2)]);
      expect([200, 400, 409]).toContain(bn.status);
      expect([200, 400, 409]).toContain(mn.status);
      const truong = (await layPhongBan(pb.id)).truongBoPhanId;
      expect([null, a, b]).toContain(truong);
      if (bn.status !== 200 && mn.status === 200) expect(truong).toBeNull();
      if (bn.status === 200 && mn.status !== 200) expect(truong).toBe(b);
      // Người cũ không còn là trưởng thì phải bị gỡ quanLy tự gán
      const [nd] = await pool.execute('SELECT nguoiDungId FROM nhanvien WHERE id = ?', [a]);
      if (truong !== a) expect(await layVaiTro(nd[0].nguoiDungId)).not.toContain('quanLy');
    }
  });
});
