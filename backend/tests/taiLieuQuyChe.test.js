const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/ketNoiCsdl');
const { noiDungKhopDuoi, layDuoiTep } = require('../src/middlewares/taiTep');
const { giaiDuongDanTep, laTepMau } = require('../src/services/taiLieuQuyCheService');

// Seed: tài liệu 1-3 (QC-NOIQUY/QC-NGHIPHEP/QC-LUONG), duongDanTep 'mau/QC-*.md', tệp thật ở uploads/quyChe/mau/.
// Mỗi test dùng THU_MUC_TAI_LIEU riêng (thư mục tạm có bản sao mau/), không ghi/xóa tệp trong repo.
const MAT_KHAU = 'MatKhau@123';
const THU_MUC_MAU_GOC = path.join(__dirname, '..', 'uploads', 'quyChe', 'mau');
const token = {};
let anhChup;
let mocNhatKy;
let thuMucTam;

const goi = (phuongThuc, duongDan, tk) => {
  const r = request(app)[phuongThuc](`/api/v1${duongDan}`);
  return tk ? r.set('Authorization', `Bearer ${tk}`) : r;
};
const maMoi = () => `QA-TL-${Date.now() % 1000000}-${Math.floor(Math.random() * 1000)}`;
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
const DOCX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('....word/document.xml....')]);
const MD = Buffer.from('# Quy chế thử\n\nĐiều 1. Nội dung.', 'utf8');

function taiLen(tk, { maTaiLieu = maMoi(), tieuDe = 'Quy chế QA', tep = MD, tenTep = 'a.md' } = {}) {
  const r = goi('post', '/taiLieuQuyChe', tk);
  if (maTaiLieu !== null) r.field('maTaiLieu', maTaiLieu);
  if (tieuDe !== null) r.field('tieuDe', tieuDe);
  if (tep !== null) r.attach('tep', tep, tenTep);
  return r;
}
async function themBanGhi(duongDanTep) {
  const [kq] = await pool.execute('INSERT INTO tailieuquyche (maTaiLieu, tieuDe, duongDanTep, nguoiTaiLenId) VALUES (?, ?, ?, 4)', [
    maMoi(),
    'Bản ghi QA',
    duongDanTep,
  ]);
  return kq.insertId;
}
async function layNhatKy(hanhDong) {
  const [d] = await pool.execute('SELECT nguoiDungId, chiTiet FROM nhatkyhethong WHERE id > ? AND hanhDong = ?', [mocNhatKy, hanhDong]);
  return d;
}

beforeAll(async () => {
  anhChup = {};
  for (const bang of ['tailieuquyche', 'nhatkyhethong']) {
    anhChup[bang] = (await pool.query(`SELECT COALESCE(MAX(id), 0) AS m FROM ${bang}`))[0][0].m;
  }
  for (const ten of ['admin', 'giamdoc', 'quanly', 'hr', 'hr2', 'nhanvien']) {
    const res = await request(app).post('/api/v1/xacThuc/dangNhap').set('X-Tra-Token', '1').send({ tenDangNhap: ten, matKhau: MAT_KHAU });
    expect(res.status).toBe(200);
    token[ten] = res.body.data.token;
  }
});

beforeEach(async () => {
  mocNhatKy = (await pool.query('SELECT COALESCE(MAX(id), 0) AS m FROM nhatkyhethong'))[0][0].m;
  thuMucTam = fs.mkdtempSync(path.join(os.tmpdir(), 'qaTaiLieu-'));
  fs.cpSync(THU_MUC_MAU_GOC, path.join(thuMucTam, 'mau'), { recursive: true });
  process.env.THU_MUC_TAI_LIEU = thuMucTam;
});

afterEach(async () => {
  await pool.execute('DELETE FROM tailieuquyche WHERE id > ?', [anhChup.tailieuquyche]);
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [mocNhatKy]);
  await pool.query(`ALTER TABLE tailieuquyche AUTO_INCREMENT = 1`);
  await pool.query(`ALTER TABLE nhatkyhethong AUTO_INCREMENT = 1`);
  delete process.env.THU_MUC_TAI_LIEU;
  fs.rmSync(thuMucTam, { recursive: true, force: true });
});

afterAll(async () => {
  await pool.end();
});

// ---------------------------------------------------------------------------
describe('Unit hàm kiểm tra tệp và đường dẫn', () => {
  test('noiDungKhopDuoi nhận đúng magic bytes pdf/docx/md', () => {
    expect(noiDungKhopDuoi('.pdf', PDF)).toBe(true);
    expect(noiDungKhopDuoi('.pdf', Buffer.from('hello'))).toBe(false);
    expect(noiDungKhopDuoi('.docx', DOCX)).toBe(true);
    expect(noiDungKhopDuoi('.docx', Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x41]))).toBe(false);
    expect(noiDungKhopDuoi('.md', MD)).toBe(true);
    expect(noiDungKhopDuoi('.md', Buffer.from([0x61, 0x00, 0x62]))).toBe(false);
    expect(noiDungKhopDuoi('.md', Buffer.from([0xff, 0xfe, 0xfd]))).toBe(false);
    expect(noiDungKhopDuoi('.exe', PDF)).toBe(false);
  });

  test('layDuoiTep trả đuôi viết thường hoặc chuỗi rỗng', () => {
    expect(layDuoiTep('Quy.Che.PDF')).toBe('.pdf');
    expect(layDuoiTep('khongduoi')).toBe('');
    expect(layDuoiTep()).toBe('');
  });

  test('giaiDuongDanTep chặn ../ và đường dẫn tuyệt đối', () => {
    expect(giaiDuongDanTep('mau/QC-NOIQUY.md')).toBe(path.join(thuMucTam, 'mau', 'QC-NOIQUY.md'));
    expect(giaiDuongDanTep('../ngoai.md')).toBeNull();
    expect(giaiDuongDanTep('mau/../../ngoai.md')).toBeNull();
    expect(giaiDuongDanTep(path.resolve(os.tmpdir(), 'tuyetDoi.md'))).toBeNull();
    expect(giaiDuongDanTep('')).toBeNull();
  });

  test('laTepMau chỉ đúng với tiền tố mau/', () => {
    expect(laTepMau('mau/QC-LUONG.md')).toBe(true);
    expect(laTepMau('mau\\QC-LUONG.md')).toBe(true);
    expect(laTepMau('abc.md')).toBe(false);
    expect(laTepMau('khac/mau/a.md')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('GET /taiLieuQuyChe danh sách', () => {
  test.each(['admin', 'giamdoc', 'quanly', 'hr', 'nhanvien'])('vai trò %s xem được danh sách chuẩn', async (ten) => {
    const res = await goi('get', '/taiLieuQuyChe', token[ten]);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, code: 200 });
    const { items, phanTrang } = res.body.data;
    expect(phanTrang).toMatchObject({ trang: 1 });
    expect(phanTrang.tongSo).toBeGreaterThanOrEqual(3);
    const noiQuy = items.find((t) => t.maTaiLieu === 'QC-NOIQUY');
    expect(noiQuy).toBeDefined();
    expect(noiQuy.loaiTep).toBe('md');
    expect(noiQuy.kichThuocTep).toBeGreaterThan(0);
    for (const t of items) expect(t).not.toHaveProperty('duongDanTep');
  });

  test('lọc theo từ khóa và phân trang', async () => {
    const res = await goi('get', '/taiLieuQuyChe?tuKhoa=QC-LUONG&trang=1&kichThuoc=1', token.nhanvien);
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].maTaiLieu).toBe('QC-LUONG');
    const r2 = await goi('get', '/taiLieuQuyChe?tuKhoa=%25', token.hr);
    expect(r2.status).toBe(200);
    expect(r2.body.data.items).toHaveLength(0);
  });

  test('tệp đã mất trên đĩa thì kichThuocTep null', async () => {
    const id = await themBanGhi('khongTonTai.pdf');
    const res = await goi('get', '/taiLieuQuyChe?kichThuoc=100', token.hr);
    const tl = res.body.data.items.find((t) => t.id === id);
    expect(tl).toMatchObject({ loaiTep: 'pdf', kichThuocTep: null });
  });

  test('chưa đăng nhập bị 401', async () => {
    const res = await goi('get', '/taiLieuQuyChe');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, code: 401, data: null });
  });
});

// ---------------------------------------------------------------------------
describe('GET /taiLieuQuyChe/:id/tep tải tệp', () => {
  test('nhân viên tải tệp mẫu seed với tên <maTaiLieu>.md', async () => {
    const res = await goi('get', '/taiLieuQuyChe/1/tep', token.nhanvien)
      .buffer(true)
      .parse((r, cb) => {
        const ds = [];
        r.on('data', (c) => ds.push(c));
        r.on('end', () => cb(null, Buffer.concat(ds)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('QC-NOIQUY.md');
    expect(res.body.equals(fs.readFileSync(path.join(THU_MUC_MAU_GOC, 'QC-NOIQUY.md')))).toBe(true);
  });

  test('tệp mất trên đĩa trả 404', async () => {
    const id = await themBanGhi('mat.md');
    const res = await goi('get', `/taiLieuQuyChe/${id}/tep`, token.hr);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: 404, data: null });
  });

  test('đường dẫn trong CSDL trỏ ra ngoài (../) trả 404', async () => {
    fs.writeFileSync(path.join(path.dirname(thuMucTam), 'ngoaiQa.md'), 'bi mat');
    const id = await themBanGhi(`../ngoaiQa.md`);
    const res = await goi('get', `/taiLieuQuyChe/${id}/tep`, token.hr);
    fs.rmSync(path.join(path.dirname(thuMucTam), 'ngoaiQa.md'), { force: true });
    expect(res.status).toBe(404);
  });

  test('id không tồn tại 404, id sai 400, chưa đăng nhập 401', async () => {
    expect((await goi('get', '/taiLieuQuyChe/999999/tep', token.hr)).status).toBe(404);
    expect((await goi('get', '/taiLieuQuyChe/abc/tep', token.hr)).status).toBe(400);
    expect((await goi('get', '/taiLieuQuyChe/1/tep')).status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
describe('POST /taiLieuQuyChe tải lên', () => {
  test.each([
    ['md', MD, 'quy che.MD'],
    ['pdf', PDF, 'a.pdf'],
    ['docx', DOCX, 'a.docx'],
  ])('HR tải lên tệp %s thành công, ghi tệp và nhật ký', async (loai, tep, tenTep) => {
    const ma = maMoi();
    const res = await taiLen(token.hr, { maTaiLieu: ma, tep, tenTep });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, code: 201 });
    expect(res.body.data).toMatchObject({ maTaiLieu: ma, tieuDe: 'Quy chế QA', loaiTep: loai, kichThuocTep: tep.length });
    expect(res.body.data).not.toHaveProperty('duongDanTep');
    const [[dong]] = await pool.execute('SELECT duongDanTep FROM tailieuquyche WHERE id = ?', [res.body.data.id]);
    expect(dong.duongDanTep.endsWith(`.${loai}`)).toBe(true);
    expect(fs.readFileSync(path.join(thuMucTam, dong.duongDanTep)).equals(tep)).toBe(true);
    const nk = await layNhatKy('TAI_LEN_TAI_LIEU');
    expect(nk).toHaveLength(1);
    expect(nk[0].chiTiet).toContain(ma);
  });

  test.each(['admin', 'giamdoc', 'quanly', 'nhanvien'])('vai trò %s tải lên bị 403', async (ten) => {
    const res = await taiLen(token[ten]);
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, code: 403, data: null });
  });

  test('chưa đăng nhập bị 401', async () => {
    expect((await taiLen(undefined)).status).toBe(401);
  });

  test('trùng mã tài liệu 409, không ghi tệp', async () => {
    const res = await taiLen(token.hr2, { maTaiLieu: 'QC-NOIQUY' });
    expect(res.status).toBe(409);
    expect(fs.readdirSync(thuMucTam)).toEqual(['mau']);
  });

  test.each([
    ['thiếu tệp', { tep: null }],
    ['sai đuôi', { tep: MD, tenTep: 'a.txt' }],
    ['pdf giả', { tep: Buffer.from('khong phai pdf'), tenTep: 'a.pdf' }],
    ['docx giả', { tep: PDF, tenTep: 'a.docx' }],
    ['md chứa NUL', { tep: Buffer.from([0x61, 0x00]), tenTep: 'a.md' }],
    ['tệp rỗng', { tep: Buffer.alloc(0), tenTep: 'a.md' }],
    ['vượt 10MB', { tep: Buffer.alloc(10 * 1024 * 1024 + 1, 0x61), tenTep: 'a.md' }],
    ['thiếu mã', { maTaiLieu: null }],
    ['mã sai mẫu', { maTaiLieu: 'qc-thuong' }],
    ['mã 1 ký tự', { maTaiLieu: 'A' }],
    ['thiếu tiêu đề', { tieuDe: null }],
    ['tiêu đề quá 255', { tieuDe: 'a'.repeat(256) }],
  ])('dữ liệu sai (%s) trả 400 và không ghi tệp', async (_, tuyChon) => {
    const res = await taiLen(token.hr, tuyChon);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: 400, data: null });
    expect(fs.readdirSync(thuMucTam)).toEqual(['mau']);
    expect(await layNhatKy('TAI_LEN_TAI_LIEU')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
describe('DELETE /taiLieuQuyChe/:id', () => {
  test('HR xóa tài liệu tải lên: xóa bản ghi, tệp và ghi nhật ký', async () => {
    const tao = await taiLen(token.hr);
    const id = tao.body.data.id;
    const [[dong]] = await pool.execute('SELECT duongDanTep FROM tailieuquyche WHERE id = ?', [id]);
    const res = await goi('delete', `/taiLieuQuyChe/${id}`, token.hr2);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, code: 200, data: { id } });
    const [con] = await pool.execute('SELECT id FROM tailieuquyche WHERE id = ?', [id]);
    expect(con).toHaveLength(0);
    expect(fs.existsSync(path.join(thuMucTam, dong.duongDanTep))).toBe(false);
    expect(await layNhatKy('XOA_TAI_LIEU')).toHaveLength(1);
  });

  test('xóa tài liệu trỏ tệp mẫu mau/ chỉ xóa bản ghi, tệp vẫn còn', async () => {
    const id = await themBanGhi('mau/QC-NOIQUY.md');
    const res = await goi('delete', `/taiLieuQuyChe/${id}`, token.hr);
    expect(res.status).toBe(200);
    expect(fs.existsSync(path.join(thuMucTam, 'mau', 'QC-NOIQUY.md'))).toBe(true);
  });

  test('xóa tài liệu đã mất tệp vẫn thành công', async () => {
    const id = await themBanGhi('daMat.md');
    expect((await goi('delete', `/taiLieuQuyChe/${id}`, token.hr)).status).toBe(200);
  });

  test.each(['admin', 'giamdoc', 'quanly', 'nhanvien'])('vai trò %s xóa bị 403', async (ten) => {
    const id = await themBanGhi('x.md');
    expect((await goi('delete', `/taiLieuQuyChe/${id}`, token[ten])).status).toBe(403);
    const [con] = await pool.execute('SELECT id FROM tailieuquyche WHERE id = ?', [id]);
    expect(con).toHaveLength(1);
  });

  test('không tồn tại 404, chưa đăng nhập 401', async () => {
    expect((await goi('delete', '/taiLieuQuyChe/999999', token.hr)).status).toBe(404);
    expect((await goi('delete', '/taiLieuQuyChe/1')).status).toBe(401);
  });
});
