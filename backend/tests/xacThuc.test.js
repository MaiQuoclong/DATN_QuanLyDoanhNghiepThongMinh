const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/ketNoiCsdl');
const { xacThucJwt } = require('../src/middlewares/xacThucJwt');
const phanQuyen = require('../src/middlewares/phanQuyen');
const { khongTimThayRoute, xuLyLoi } = require('../src/middlewares/xuLyLoi');

const MAT_KHAU = 'MatKhau@123';
const MAT_KHAU_MOI = 'MatKhauMoi123';
const ID_NHANVIEN2 = 6; // tài khoản dùng cho các test làm thay đổi dữ liệu
const choMs = (ms) => new Promise((r) => setTimeout(r, ms));

// App thử: gắn xacThucJwt + phanQuyen lên router tạm, dùng chung error middleware thật
const appThu = express();
const routerThu = express.Router();
routerThu.get('/chiCanDangNhap', xacThucJwt, (req, res) => res.json({ success: true, data: req.nguoiDung }));
for (const vt of ['Admin', 'giamDoc', 'quanLy', 'HR', 'nhanVien']) {
  routerThu.get(`/chi/${vt}`, xacThucJwt, phanQuyen([vt]), (req, res) => res.json({ success: true }));
}
routerThu.get('/hrHoacGiamDoc', xacThucJwt, phanQuyen(['HR', 'giamDoc']), (req, res) => res.json({ success: true }));
appThu.use('/thu', routerThu);
appThu.use(khongTimThayRoute);
appThu.use(xuLyLoi);

let hashGoc;
let idNhatKyMoc;

function dangNhap(tenDangNhap, matKhau = MAT_KHAU) {
  return request(app).post('/api/v1/xacThuc/dangNhap').send({ tenDangNhap, matKhau });
}
async function layToken(tenDangNhap) {
  const res = await dangNhap(tenDangNhap);
  expect(res.status).toBe(200);
  return res.body.data.token;
}
async function chenResetMatKhauTam(nguoiDungId, lui25Gio = false) {
  const thoiGian = lui25Gio ? 'NOW() - INTERVAL 25 HOUR' : 'NOW()';
  await pool.execute(
    `INSERT INTO nhatkyhethong (nguoiDungId, hanhDong, diaChiIP, chiTiet, thoiGianTao)
     VALUES (?, 'RESET_MAT_KHAU_TAM', '127.0.0.1', 'test', ${thoiGian})`,
    [nguoiDungId]
  );
}

beforeAll(async () => {
  const [dong] = await pool.execute('SELECT matKhauMaHoa FROM nguoidung WHERE id = ?', [ID_NHANVIEN2]);
  hashGoc = dong[0].matKhauMaHoa;
});

beforeEach(async () => {
  const [dong] = await pool.execute('SELECT COALESCE(MAX(id), 0) AS moc FROM nhatkyhethong');
  idNhatKyMoc = dong[0].moc;
});

// Dọn dữ liệu: khôi phục mật khẩu MatKhau@123, trạng thái, xóa bản ghi mốc mật khẩu do test sinh ra
afterEach(async () => {
  await pool.execute('UPDATE nguoidung SET matKhauMaHoa = ?, trangThai = ? WHERE id = ?', [
    hashGoc,
    'DANG_HOAT_DONG',
    ID_NHANVIEN2,
  ]);
  await pool.execute(
    `DELETE FROM nhatkyhethong WHERE id > ? AND hanhDong IN ('RESET_MAT_KHAU_TAM', 'DOI_MAT_KHAU',
       'DANG_NHAP_MAT_KHAU_TAM_HET_HAN', 'DANG_NHAP_KHONG_VAI_TRO', 'DANG_NHAP_BI_KHOA')`,
    [idNhatKyMoc]
  );
});

// Đếm bản ghi nhật ký phát sinh trong test hiện tại (sau mốc idNhatKyMoc)
async function demNhatKy(nguoiDungId, hanhDong) {
  const [dong] = await pool.execute(
    'SELECT COUNT(*) AS n FROM nhatkyhethong WHERE id > ? AND nguoiDungId = ? AND hanhDong = ?',
    [idNhatKyMoc, nguoiDungId, hanhDong]
  );
  return Number(dong[0].n);
}

afterAll(() => pool.end());

describe('POST /api/v1/xacThuc/dangNhap', () => {
  test('đăng nhập đúng trả token và thông tin người dùng, không lộ matKhauMaHoa', async () => {
    const res = await dangNhap('admin');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, code: 200, message: expect.any(String) });
    expect(typeof res.body.data.token).toBe('string');
    expect(res.body.data.nguoiDung).toMatchObject({ nguoiDungId: 1, tenDangNhap: 'admin', batBuocDoiMatKhau: false });
    expect(res.body.data.nguoiDung.vaiTro).toEqual(expect.arrayContaining(['Admin', 'nhanVien']));
    expect(JSON.stringify(res.body)).not.toMatch(/matKhauMaHoa|\$2[aby]\$/);
  });

  test('đăng nhập bằng email (gửi qua trường tenDangNhap) thành công', async () => {
    const res = await dangNhap('hr@smarthrm.local');
    expect(res.status).toBe(200);
    expect(res.body.data.nguoiDung.tenDangNhap).toBe('hr');
  });

  test('sai mật khẩu trả 401 chuẩn', async () => {
    const res = await dangNhap('admin', 'SaiMatKhau1');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, code: 401, message: expect.any(String), data: null });
  });

  test('tên đăng nhập không tồn tại trả 401 cùng thông báo như sai mật khẩu', async () => {
    const sai = await dangNhap('admin', 'SaiMatKhau1');
    const khong = await dangNhap('khongTonTai_xyz');
    expect(khong.status).toBe(401);
    expect(khong.body.message).toBe(sai.body.message);
  });

  test.each([
    [{ matKhau: MAT_KHAU }],
    [{ tenDangNhap: 'admin' }],
    [{ tenDangNhap: '   ', matKhau: MAT_KHAU }],
    [{}],
  ])('thiếu trường %j trả 400', async (body) => {
    const res = await request(app).post('/api/v1/xacThuc/dangNhap').send(body);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: 400, data: null });
  });

  test('trường không phải chuỗi trả 400', async () => {
    const res = await request(app).post('/api/v1/xacThuc/dangNhap').send({ tenDangNhap: 123, matKhau: MAT_KHAU });
    expect(res.status).toBe(400);
  });

  test('tài khoản bị khóa: đăng nhập trả 403, token đang dùng bị từ chối 401', async () => {
    const token = await layToken('nhanvien2');
    await pool.execute("UPDATE nguoidung SET trangThai = 'BI_KHOA' WHERE id = ?", [ID_NHANVIEN2]);
    const res = await dangNhap('nhanvien2');
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false, code: 403, data: null });
    const toi = await request(app).get('/api/v1/xacThuc/toi').set('Authorization', `Bearer ${token}`);
    expect(toi.status).toBe(401);
    expect(await demNhatKy(ID_NHANVIEN2, 'DANG_NHAP_BI_KHOA')).toBe(1);
  });

  test('tài khoản không có vai trò: đăng nhập trả 403 và ghi DANG_NHAP_KHONG_VAI_TRO', async () => {
    const [vaiTroGoc] = await pool.execute('SELECT vaiTroId FROM nguoidungvaitro WHERE nguoiDungId = ?', [
      ID_NHANVIEN2,
    ]);
    expect(vaiTroGoc.length).toBeGreaterThan(0);
    await pool.execute('DELETE FROM nguoidungvaitro WHERE nguoiDungId = ?', [ID_NHANVIEN2]);
    try {
      const res = await dangNhap('nhanvien2');
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ success: false, code: 403, message: expect.any(String), data: null });
      expect(await demNhatKy(ID_NHANVIEN2, 'DANG_NHAP_KHONG_VAI_TRO')).toBe(1);
      expect(await demNhatKy(ID_NHANVIEN2, 'DANG_NHAP')).toBe(0);
    } finally {
      for (const { vaiTroId } of vaiTroGoc) {
        await pool.execute('INSERT INTO nguoidungvaitro (nguoiDungId, vaiTroId) VALUES (?, ?)', [ID_NHANVIEN2, vaiTroId]);
      }
    }
    const [sau] = await pool.execute('SELECT COUNT(*) AS n FROM nguoidungvaitro WHERE nguoiDungId = ?', [ID_NHANVIEN2]);
    expect(Number(sau[0].n)).toBe(vaiTroGoc.length);
  });
});

describe('GET /api/v1/xacThuc/toi', () => {
  test('có token hợp lệ trả thông tin cá nhân, không có matKhauMaHoa', async () => {
    const token = await layToken('nhanvien');
    const res = await request(app).get('/api/v1/xacThuc/toi').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ tenDangNhap: 'nhanvien', vaiTro: ['nhanVien'], batBuocDoiMatKhau: false });
    expect(res.body.data).not.toHaveProperty('matKhauMaHoa');
  });

  test('không có token trả 401', async () => {
    const res = await request(app).get('/api/v1/xacThuc/toi');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, code: 401, data: null });
  });

  test.each(['Bearer abc.def.ghi', 'Basic xyz', 'abc'])('header "%s" trả 401', async (header) => {
    const res = await request(app).get('/api/v1/xacThuc/toi').set('Authorization', header);
    expect(res.status).toBe(401);
  });

  test('token ký bằng bí mật khác trả 401', async () => {
    const tokenGia = jwt.sign({ nguoiDungId: 1 }, 'biMatGia', { algorithm: 'HS256' });
    const res = await request(app).get('/api/v1/xacThuc/toi').set('Authorization', `Bearer ${tokenGia}`);
    expect(res.status).toBe(401);
  });

  test('token hết hạn trả 401', async () => {
    const tokenHetHan = jwt.sign({ nguoiDungId: 1, exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_BI_MAT);
    const res = await request(app).get('/api/v1/xacThuc/toi').set('Authorization', `Bearer ${tokenHetHan}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/xacThuc/doiMatKhau', () => {
  const doi = (token, body) =>
    request(app).post('/api/v1/xacThuc/doiMatKhau').set('Authorization', `Bearer ${token}`).send(body);

  test('không có token trả 401', async () => {
    const res = await request(app)
      .post('/api/v1/xacThuc/doiMatKhau')
      .send({ matKhauCu: MAT_KHAU, matKhauMoi: MAT_KHAU_MOI });
    expect(res.status).toBe(401);
  });

  test.each([
    ['thiếu mật khẩu cũ', { matKhauMoi: MAT_KHAU_MOI }],
    ['mật khẩu mới ngắn hơn 8 ký tự', { matKhauCu: MAT_KHAU, matKhauMoi: 'abc123' }],
    ['mật khẩu mới không có số', { matKhauCu: MAT_KHAU, matKhauMoi: 'abcdefghij' }],
    ['mật khẩu mới không có chữ', { matKhauCu: MAT_KHAU, matKhauMoi: '1234567890' }],
    ['mật khẩu cũ không đúng', { matKhauCu: 'SaiMatKhau1', matKhauMoi: MAT_KHAU_MOI }],
    ['mật khẩu mới trùng mật khẩu cũ', { matKhauCu: MAT_KHAU, matKhauMoi: MAT_KHAU }],
  ])('%s trả 400', async (_ten, body) => {
    const token = await layToken('nhanvien2');
    const res = await doi(token, body);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: 400, data: null });
  });

  test('đổi thành công: token mới dùng được, token cũ bị thu hồi, đăng nhập bằng mật khẩu mới', async () => {
    const tokenCu = await layToken('nhanvien2');
    await choMs(2500); // token cũ phải cũ hơn mốc DOI_MAT_KHAU quá dung sai 1 giây
    const res = await doi(tokenCu, { matKhauCu: MAT_KHAU, matKhauMoi: MAT_KHAU_MOI });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toMatch(/matKhauMaHoa/);

    const [nk] = await pool.execute(
      "SELECT COUNT(*) AS n FROM nhatkyhethong WHERE id > ? AND nguoiDungId = ? AND hanhDong = 'DOI_MAT_KHAU'",
      [idNhatKyMoc, ID_NHANVIEN2]
    );
    expect(Number(nk[0].n)).toBe(1);

    const cu = await request(app).get('/api/v1/xacThuc/toi').set('Authorization', `Bearer ${tokenCu}`);
    expect(cu.status).toBe(401);
    const moi = await request(app).get('/api/v1/xacThuc/toi').set('Authorization', `Bearer ${res.body.data.token}`);
    expect(moi.status).toBe(200);

    expect((await dangNhap('nhanvien2')).status).toBe(401);
    expect((await dangNhap('nhanvien2', MAT_KHAU_MOI)).status).toBe(200);
  }, 15000);
});

describe('Luồng mật khẩu tạm (RESET_MAT_KHAU_TAM)', () => {
  test('đăng nhập trả batBuocDoiMatKhau=true, /toi vẫn dùng được, route khác bị chặn 403', async () => {
    await chenResetMatKhauTam(ID_NHANVIEN2);
    const res = await dangNhap('nhanvien2');
    expect(res.status).toBe(200);
    expect(res.body.data.nguoiDung.batBuocDoiMatKhau).toBe(true);
    const token = res.body.data.token;

    const toi = await request(app).get('/api/v1/xacThuc/toi').set('Authorization', `Bearer ${token}`);
    expect(toi.status).toBe(200);
    expect(toi.body.data.batBuocDoiMatKhau).toBe(true);

    const khac = await request(appThu).get('/thu/chiCanDangNhap').set('Authorization', `Bearer ${token}`);
    expect(khac.status).toBe(403);
    expect(khac.body).toMatchObject({ success: false, code: 403, data: null });
  });

  test('sau khi đổi mật khẩu tạm thì gỡ cờ và truy cập route khác bình thường', async () => {
    await chenResetMatKhauTam(ID_NHANVIEN2);
    const token = (await dangNhap('nhanvien2')).body.data.token;
    const doi = await request(app)
      .post('/api/v1/xacThuc/doiMatKhau')
      .set('Authorization', `Bearer ${token}`)
      .send({ matKhauCu: MAT_KHAU, matKhauMoi: MAT_KHAU_MOI });
    expect(doi.status).toBe(200);
    expect(doi.body.data.nguoiDung.batBuocDoiMatKhau).toBe(false);

    const khac = await request(appThu).get('/thu/chiCanDangNhap').set('Authorization', `Bearer ${doi.body.data.token}`);
    expect(khac.status).toBe(200);
  });

  test('mật khẩu tạm quá 24 giờ: đăng nhập trả 401 và ghi DANG_NHAP_MAT_KHAU_TAM_HET_HAN', async () => {
    await chenResetMatKhauTam(ID_NHANVIEN2, true);
    const res = await dangNhap('nhanvien2');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, code: 401, data: null });
    expect(await demNhatKy(ID_NHANVIEN2, 'DANG_NHAP_MAT_KHAU_TAM_HET_HAN')).toBe(1);
    expect(await demNhatKy(ID_NHANVIEN2, 'DANG_NHAP')).toBe(0);
  });

  test('bản ghi DOI_MAT_KHAU mới hơn RESET thì không còn bắt buộc đổi', async () => {
    await chenResetMatKhauTam(ID_NHANVIEN2, true);
    await pool.execute(
      "INSERT INTO nhatkyhethong (nguoiDungId, hanhDong, diaChiIP, thoiGianTao) VALUES (?, 'DOI_MAT_KHAU', '127.0.0.1', NOW() - INTERVAL 1 HOUR)",
      [ID_NHANVIEN2]
    );
    const res = await dangNhap('nhanvien2');
    expect(res.status).toBe(200);
    expect(res.body.data.nguoiDung.batBuocDoiMatKhau).toBe(false);
  });
});

describe('POST /api/v1/xacThuc/dangXuat', () => {
  test('đăng xuất ghi nhật ký DANG_XUAT', async () => {
    const token = await layToken('nhanvien');
    const res = await request(app).post('/api/v1/xacThuc/dangXuat').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, code: 200, data: null });
    const [dong] = await pool.execute(
      "SELECT COUNT(*) AS n FROM nhatkyhethong WHERE id > ? AND nguoiDungId = 5 AND hanhDong = 'DANG_XUAT'",
      [idNhatKyMoc]
    );
    expect(Number(dong[0].n)).toBe(1);
  });

  test('không có token trả 401', async () => {
    expect((await request(app).post('/api/v1/xacThuc/dangXuat')).status).toBe(401);
  });
});

describe('xacThucJwt + phanQuyen cho 5 vai trò (router thử)', () => {
  const taiKhoan = { admin: 'Admin', giamdoc: 'giamDoc', quanly: 'quanLy', hr: 'HR', nhanvien: 'nhanVien' };
  const tatCaVaiTro = Object.values(taiKhoan);
  const token = {};

  beforeAll(async () => {
    for (const ten of Object.keys(taiKhoan)) {
      const res = await dangNhap(ten);
      token[ten] = res.body.data.token;
    }
  });

  const truongHop = [];
  for (const [ten, vaiTroChinh] of Object.entries(taiKhoan)) {
    for (const vt of tatCaVaiTro) {
      // mọi tài khoản đều có thêm vai trò nhanVien
      const duocPhep = vt === vaiTroChinh || vt === 'nhanVien';
      truongHop.push([ten, vt, duocPhep ? 200 : 403]);
    }
  }

  test.each(truongHop)('tài khoản %s gọi route chỉ dành cho %s -> %i', async (ten, vt, ma) => {
    const res = await request(appThu).get(`/thu/chi/${vt}`).set('Authorization', `Bearer ${token[ten]}`);
    expect(res.status).toBe(ma);
    if (ma === 403) expect(res.body).toMatchObject({ success: false, code: 403, data: null });
  });

  test.each([
    ['hr', 200],
    ['giamdoc', 200],
    ['admin', 403],
    ['quanly', 403],
    ['nhanvien', 403],
  ])('route cho [HR, giamDoc]: %s -> %i', async (ten, ma) => {
    const res = await request(appThu).get('/thu/hrHoacGiamDoc').set('Authorization', `Bearer ${token[ten]}`);
    expect(res.status).toBe(ma);
  });

  test('route có phanQuyen nhưng không có token trả 401 (không phải 403)', async () => {
    const res = await request(appThu).get('/thu/chi/Admin');
    expect(res.status).toBe(401);
  });

  test('xacThucJwt gắn req.nguoiDung đọc từ CSDL, không lộ matKhauMaHoa', async () => {
    const res = await request(appThu).get('/thu/chiCanDangNhap').set('Authorization', `Bearer ${token.quanly}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ nguoiDungId: 3, batBuocDoiMatKhau: false });
    expect(res.body.data.vaiTro).toEqual(expect.arrayContaining(['quanLy', 'nhanVien']));
    expect(res.body.data).not.toHaveProperty('matKhauMaHoa');
  });

  test('payload token chỉ chứa nguoiDungId, req.nguoiDung.nhanVienId đọc đúng theo CSDL', async () => {
    const noiDung = jwt.decode(token.quanly);
    expect(noiDung).toHaveProperty('nguoiDungId', 3);
    expect(noiDung).not.toHaveProperty('nhanVienId');
    expect(noiDung).not.toHaveProperty('vaiTro');

    const [dong] = await pool.execute('SELECT id FROM nhanvien WHERE nguoiDungId = ?', [3]);
    const nhanVienIdCsdl = dong.length ? dong[0].id : null;
    const res = await request(appThu).get('/thu/chiCanDangNhap').set('Authorization', `Bearer ${token.quanly}`);
    expect(res.status).toBe(200);
    expect(res.body.data.nhanVienId).toBe(nhanVienIdCsdl);
  });

  test('vai trò bị gỡ trong CSDL có hiệu lực ngay với token đang dùng', async () => {
    await pool.execute('DELETE FROM nguoidungvaitro WHERE nguoiDungId = 4 AND vaiTroId = 4');
    try {
      const res = await request(appThu).get('/thu/chi/HR').set('Authorization', `Bearer ${token.hr}`);
      expect(res.status).toBe(403);
    } finally {
      await pool.execute('INSERT INTO nguoidungvaitro (nguoiDungId, vaiTroId) VALUES (4, 4)');
    }
  });
});
