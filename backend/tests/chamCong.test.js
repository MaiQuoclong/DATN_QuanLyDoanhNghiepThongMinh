const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/ketNoiCsdl');
const { tinhChiSoCong, laCuoiTuan } = require('../src/utils/tinhCong');

// Dữ liệu mẫu (database/seed.sql): quanly (NV0003) trưởng PKT (gồm PKT-PT), quanly2 (NV0009) trưởng PKD.
// cdpb 5 = Lập trình viên / Nhóm Phát triển (PKT-PT), cdpb 8 = NV kinh doanh / PKD.
// Test dùng các tháng cũ cố định (2020-2021) để không đụng dữ liệu seed theo CURDATE().
const MAT_KHAU = 'MatKhau@123';
const VAI_TRO_HR_ID = 4;
const NGAY_VAO_LAM = '2020-01-06';
const NGAY_DC = '2021-06-15'; // thứ 3
const NGAY_DC_2 = '2021-06-16';

const token = {};
let anhChup;
let mocNhatKy;
let demTen = 0;

function ngay(soNgay = 0) {
  const d = new Date();
  d.setDate(d.getDate() + soNgay);
  return d.toLocaleDateString('sv-SE');
}
const thangHienTai = () => ngay(0).slice(0, 7);

function dangNhap(tenDangNhap, matKhau = MAT_KHAU) {
  return request(app).post('/api/v1/xacThuc/dangNhap').set('X-Tra-Token', '1').send({ tenDangNhap, matKhau });
}
const goi = (phuongThuc, duongDan, tk) => {
  const r = request(app)[phuongThuc](`/api/v1${duongDan}`);
  return tk ? r.set('Authorization', `Bearer ${tk}`) : r;
};

// Tạo nhân viên mới qua API HR rồi đổi mật khẩu tạm để có token dùng được
async function taoNhanVien(ghiDe = {}, laHr = false) {
  demTen += 1;
  const ten = `qacc${Date.now() % 100000}${demTen}`;
  const res = await goi('post', '/nhanVien', token.hr).send({
    hoVaTen: 'Lê Chấm Công',
    gioiTinh: 'NAM',
    ngaySinh: '1995-05-20',
    ngayVaoLam: NGAY_VAO_LAM,
    chucDanhPhongBanId: 5,
    tenDangNhap: ten,
    email: `${ten}@smarthrm.local`,
    ...ghiDe,
  });
  expect(res.status).toBe(201);
  const { nhanVien, taiKhoan } = res.body.data;
  if (laHr) {
    await pool.execute('INSERT INTO nguoidungvaitro (nguoiDungId, vaiTroId) VALUES (?, ?)', [nhanVien.nguoiDungId, VAI_TRO_HR_ID]);
  }
  const dn = await dangNhap(taiKhoan.tenDangNhap, taiKhoan.matKhauTam);
  expect(dn.status).toBe(200);
  const doi = await goi('post', '/xacThuc/doiMatKhau', dn.body.data.token).send({
    matKhauCu: taiKhoan.matKhauTam,
    matKhauMoi: 'ChamCong123',
  });
  expect(doi.status).toBe(200);
  const dn2 = await dangNhap(taiKhoan.tenDangNhap, 'ChamCong123');
  expect(dn2.status).toBe(200);
  return { nhanVien, tk: dn2.body.data.token };
}

const taoYeuCau = (tk, body) =>
  goi('post', '/dieuChinhCong', tk).send({
    ngayCanDieuChinh: NGAY_DC,
    lyDoGiaiTrinh: 'Quên chấm công do đi công tác',
    ...body,
  });
async function taoYeuCauOk(tk, body) {
  const res = await taoYeuCau(tk, body);
  expect(res.status).toBe(201);
  return res.body.data;
}
async function chenBanGhi(nhanVienId, ngayCong, gioVao, gioRa) {
  const cs = gioRa ? tinhChiSoCong(ngayCong, gioVao, gioRa) : tinhChiSoCong(ngayCong, gioVao, null);
  const [kq] = await pool.execute(
    `INSERT INTO banghichamcong (nhanVienId, ngayChamCong, gioVao, gioRa, soGioLamThucTe, soGioLamThemOT, diMuon, veSom, trangThai)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'HOP_LE')`,
    [nhanVienId, ngayCong, gioVao, gioRa, cs.soGioLamThucTe, cs.soGioLamThemOT, cs.diMuon ? 1 : 0, cs.veSom ? 1 : 0],
  );
  return kq.insertId;
}
async function chenChot(thang) {
  await pool.execute("INSERT INTO nhatkyhethong (nguoiDungId, hanhDong, chiTiet) VALUES (4, 'CHOT_CONG_THANG', ?)", [thang]);
}
async function layNhatKy(hanhDong) {
  const [d] = await pool.execute('SELECT nguoiDungId, chiTiet FROM nhatkyhethong WHERE id > ? AND hanhDong = ? ORDER BY id', [
    mocNhatKy,
    hanhDong,
  ]);
  return d;
}

async function datLaiAutoIncrement() {
  for (const bang of ['yeucaudieuchinhchamcong', 'banghichamcong', 'nhanvien', 'nguoidung', 'nhatkyhethong']) {
    await pool.query(`ALTER TABLE ${bang} AUTO_INCREMENT = 1`);
  }
}

beforeAll(async () => {
  const lay = async (bang) => (await pool.query(`SELECT COALESCE(MAX(id), 0) AS m FROM ${bang}`))[0][0].m;
  const [nvTt] = await pool.query('SELECT id, trangThaiLamViec FROM nhanvien');
  anhChup = {
    nvTt,
    maxYc: await lay('yeucaudieuchinhchamcong'),
    maxCc: await lay('banghichamcong'),
    maxNv: await lay('nhanvien'),
    maxNd: await lay('nguoidung'),
    maxNk: await lay('nhatkyhethong'),
  };
  for (const ten of ['admin', 'giamdoc', 'quanly', 'quanly2', 'hr', 'hr2', 'nhanvien']) {
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
  jest.restoreAllMocks();
  await pool.execute('DELETE FROM yeucaudieuchinhchamcong WHERE id > ?', [anhChup.maxYc]);
  await pool.execute('DELETE FROM banghichamcong WHERE id > ?', [anhChup.maxCc]);
  for (const d of anhChup.nvTt) {
    await pool.execute('UPDATE nhanvien SET trangThaiLamViec = ? WHERE id = ?', [d.trangThaiLamViec, d.id]);
  }
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [mocNhatKy]);
  await pool.execute('DELETE FROM nhanvien WHERE id > ?', [anhChup.maxNv]);
  await pool.execute('DELETE FROM nguoidungvaitro WHERE nguoiDungId > ?', [anhChup.maxNd]);
  await pool.execute('DELETE FROM nguoidung WHERE id > ?', [anhChup.maxNd]);
  await datLaiAutoIncrement();
});

afterAll(async () => {
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [anhChup.maxNk]);
  await datLaiAutoIncrement();
  await pool.end();
});

// ---------------------------------------------------------------------------
describe('Unit tinhChiSoCong (ca 08:00-17:00, nghỉ trưa 12:00-13:00)', () => {
  const T = '2021-06-15'; // thứ 3
  test('đúng giờ đủ 8 tiếng, không đi muộn/về sớm/OT', () => {
    expect(tinhChiSoCong(T, '08:00:00', '17:00:00')).toEqual({ soGioLamThucTe: 8, soGioLamThemOT: 0, diMuon: false, veSom: false });
  });
  test('vào 08:05 chưa tính muộn, 08:06 tính đi muộn', () => {
    expect(tinhChiSoCong(T, '08:05:00', '17:00:00').diMuon).toBe(false);
    expect(tinhChiSoCong(T, '08:06:00', '17:00:00')).toMatchObject({ diMuon: true, soGioLamThucTe: 7.9 });
  });
  test('về sớm 16:30 trừ giờ công và đánh dấu veSom', () => {
    expect(tinhChiSoCong(T, '08:00:00', '16:30:00')).toEqual({ soGioLamThucTe: 7.5, soGioLamThemOT: 0, diMuon: false, veSom: true });
  });
  test('OT đủ ngưỡng 30 phút được tính, dưới ngưỡng thì 0', () => {
    expect(tinhChiSoCong(T, '08:00:00', '17:30:00').soGioLamThemOT).toBe(0.5);
    expect(tinhChiSoCong(T, '08:00:00', '18:45:00')).toMatchObject({ soGioLamThucTe: 8, soGioLamThemOT: 1.75 });
    expect(tinhChiSoCong(T, '08:00:00', '17:29:00').soGioLamThemOT).toBe(0);
  });
  test('nghỉ trưa không tính giờ công, làm trong giờ trưa cũng không cộng', () => {
    expect(tinhChiSoCong(T, '08:00:00', '12:30:00').soGioLamThucTe).toBe(4);
    expect(tinhChiSoCong(T, '12:15:00', '17:00:00')).toMatchObject({ soGioLamThucTe: 4, diMuon: true });
    expect(tinhChiSoCong(T, '13:00:00', '17:00:00').soGioLamThucTe).toBe(4);
  });
  test('cuối tuần: toàn bộ là OT (trừ nghỉ trưa), không xét muộn/sớm', () => {
    expect(laCuoiTuan('2021-06-19')).toBe(true);
    expect(laCuoiTuan('2021-06-20')).toBe(true);
    expect(laCuoiTuan(T)).toBe(false);
    expect(tinhChiSoCong('2021-06-19', '09:00:00', '15:00:00')).toEqual({
      soGioLamThucTe: 0,
      soGioLamThemOT: 5,
      diMuon: false,
      veSom: false,
    });
  });
  test('chưa check-out: chưa có giờ công nhưng vẫn xét đi muộn', () => {
    expect(tinhChiSoCong(T, '09:00:00', null)).toEqual({ soGioLamThucTe: 0, soGioLamThemOT: 0, diMuon: true, veSom: false });
  });
});

// ---------------------------------------------------------------------------
describe('Phân quyền', () => {
  test('chưa đăng nhập trả 401 chuẩn', async () => {
    for (const [pt, dd] of [
      ['get', '/chamCong/homNay'],
      ['post', '/chamCong/checkIn'],
      ['post', '/chamCong/checkOut'],
      ['get', '/chamCong/cuaToi'],
      ['get', '/chamCong/bangCong'],
      ['get', '/chamCong/bangCong/5'],
      ['get', '/chamCong/chotCong'],
      ['post', '/chamCong/chotCong'],
      ['get', '/dieuChinhCong'],
      ['get', '/dieuChinhCong/cuaToi'],
      ['post', '/dieuChinhCong'],
      ['post', '/dieuChinhCong/1/duyet'],
      ['post', '/dieuChinhCong/1/tuChoi'],
    ]) {
      const res = await goi(pt, dd);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ success: false, code: 401, message: expect.any(String), data: null });
    }
  });

  test('nhanVien và Admin không xem bảng công/danh sách yêu cầu (403)', async () => {
    for (const ten of ['nhanvien', 'admin']) {
      for (const dd of ['/chamCong/bangCong', '/dieuChinhCong', '/chamCong/chotCong']) {
        const res = await goi('get', dd, token[ten]);
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ success: false, code: 403, data: null });
      }
    }
  });

  test('chỉ HR được chốt công (403 với vai trò khác)', async () => {
    for (const ten of ['admin', 'giamdoc', 'quanly', 'nhanvien']) {
      const res = await goi('post', '/chamCong/chotCong', token[ten]).send({ thang: '2020-01' });
      expect(res.status).toBe(403);
    }
    expect(await layNhatKy('CHOT_CONG_THANG')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
describe('Check-in / check-out', () => {
  test('check-in 201, lần 2 409, check-out 200, check-out lần 2 409', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    const vao = await goi('post', '/chamCong/checkIn', tk);
    expect(vao.status).toBe(201);
    expect(vao.body).toMatchObject({ success: true, code: 201, message: expect.any(String) });
    expect(vao.body.data).toMatchObject({ nhanVienId: nhanVien.id, gioRa: null, trangThai: 'HOP_LE', soGioLamThucTe: 0 });
    expect(vao.body.data.gioVao).toMatch(/^\d{2}:\d{2}:\d{2}$/);

    expect((await goi('post', '/chamCong/checkIn', tk)).status).toBe(409);

    const ra = await goi('post', '/chamCong/checkOut', tk);
    expect(ra.status).toBe(200);
    expect(ra.body.data.id).toBe(vao.body.data.id);
    expect(ra.body.data.gioRa).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    // Chỉ số khớp với hàm tính (không phụ thuộc giờ chạy thực tế)
    expect(ra.body.data).toMatchObject(tinhChiSoCong(ngay(0), ra.body.data.gioVao, ra.body.data.gioRa));
    expect((await goi('post', '/chamCong/checkOut', tk)).status).toBe(409);

    const homNay = await goi('get', '/chamCong/homNay', tk);
    expect(homNay.status).toBe(200);
    expect(homNay.body.data).toMatchObject({ ngay: ngay(0), banGhi: { id: vao.body.data.id } });
    expect(homNay.body.data.thamSo).toMatchObject({ gioVaoCa: '08:00:00' });
  });

  test('chưa check-in mà check-out trả 409', async () => {
    const { tk } = await taoNhanVien();
    const res = await goi('post', '/chamCong/checkOut', tk);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: 409, data: null });
  });

  test('nhân viên TAM_NGHI không check-in được (409)', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    await pool.execute("UPDATE nhanvien SET trangThaiLamViec = 'TAM_NGHI' WHERE id = ?", [nhanVien.id]);
    expect((await goi('post', '/chamCong/checkIn', tk)).status).toBe(409);
    const [d] = await pool.execute('SELECT id FROM banghichamcong WHERE nhanVienId = ?', [nhanVien.id]);
    expect(d).toHaveLength(0);
  });

  test('chưa đến ngày vào làm không check-in được (409)', async () => {
    const { tk } = await taoNhanVien({ ngayVaoLam: ngay(3) });
    expect((await goi('post', '/chamCong/checkIn', tk)).status).toBe(409);
  });

  test('cuaToi trả lịch công tháng kèm tổng hợp', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    await chenBanGhi(nhanVien.id, NGAY_DC, '08:30:00', '17:45:00');
    await chenBanGhi(nhanVien.id, NGAY_DC_2, '08:00:00', null);
    const res = await goi('get', '/chamCong/cuaToi?thang=2021-06', tk);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      thang: '2021-06',
      soNgayCongChuan: 22,
      daChot: false,
      tongHop: { soNgayChamCong: 2, soNgayThieuCheckOut: 1, tongGioLamThucTe: 7.5, tongGioLamThem: 0.75, soLanDiMuon: 1, soLanVeSom: 0 },
    });
    expect(res.body.data.items).toHaveLength(2);
    expect((await goi('get', '/chamCong/cuaToi?thang=2021-13', tk)).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
describe('Bảng công theo vai trò', () => {
  async function chuanBi() {
    const pm = await taoNhanVien(); // PKT-PT
    const kd = await taoNhanVien({ chucDanhPhongBanId: 8 }); // PKD
    return { pm: pm.nhanVien, kd: kd.nhanVien, tkPm: pm.tk };
  }
  const coNv = (res, id) => res.body.data.items.some((d) => d.nhanVienId === id);

  test('HR và giamDoc xem toàn công ty, có phân trang', async () => {
    const { pm, kd } = await chuanBi();
    for (const ten of ['hr', 'giamdoc']) {
      const res = await goi('get', `/chamCong/bangCong?thang=${thangHienTai()}&kichThuoc=100`, token[ten]);
      expect(res.status).toBe(200);
      expect(res.body.data.phanTrang).toMatchObject({ trang: 1, kichThuoc: 100 });
      expect(coNv(res, pm.id)).toBe(true);
      expect(coNv(res, kd.id)).toBe(true);
    }
  });

  test('quanly chỉ thấy PKT gồm phòng con, quanly2 chỉ thấy PKD', async () => {
    const { pm, kd } = await chuanBi();
    const r1 = await goi('get', '/chamCong/bangCong?kichThuoc=100', token.quanly);
    expect(r1.status).toBe(200);
    expect(coNv(r1, pm.id)).toBe(true);
    expect(coNv(r1, kd.id)).toBe(false);
    expect(r1.body.data.items.every((d) => [3, 4].includes(d.phongBanId))).toBe(true);
    const r2 = await goi('get', '/chamCong/bangCong?kichThuoc=100', token.quanly2);
    expect(coNv(r2, kd.id)).toBe(true);
    expect(coNv(r2, pm.id)).toBe(false);
    expect(r2.body.data.items.every((d) => d.phongBanId === 5)).toBe(true);
  });

  test('bangCong/:id: chính chủ, HR, quanLy phạm vi được xem; ngoài phạm vi 404 như không tồn tại', async () => {
    const { pm, tkPm } = await chuanBi();
    for (const tk of [tkPm, token.hr, token.giamdoc, token.quanly]) {
      const res = await goi('get', `/chamCong/bangCong/${pm.id}`, tk);
      expect(res.status).toBe(200);
      expect(res.body.data.nhanVien).toMatchObject({ id: pm.id });
    }
    expect((await goi('get', `/chamCong/bangCong/${pm.id}`, token.quanly2)).status).toBe(404);
    expect((await goi('get', `/chamCong/bangCong/${pm.id}`, token.nhanvien)).status).toBe(404);
    expect((await goi('get', '/chamCong/bangCong/999999', token.hr)).status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
describe('Tạo yêu cầu điều chỉnh công', () => {
  test('tạo thành công trạng thái CHO_DUYET, xuất hiện trong cuaToi', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    const yc = await taoYeuCauOk(tk, { gioVaoDeXuat: '08:00', gioRaDeXuat: '17:00' });
    expect(yc).toMatchObject({
      nhanVienId: nhanVien.id,
      trangThai: 'CHO_DUYET',
      gioVaoDeXuat: '08:00:00',
      gioRaDeXuat: '17:00:00',
      banGhiChamCongId: null,
    });
    const ds = await goi('get', '/dieuChinhCong/cuaToi', tk);
    expect(ds.status).toBe(200);
    expect(ds.body.data.items.map((d) => d.id)).toEqual([yc.id]);
  });

  test('dữ liệu sai trả 400', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    await chenBanGhi(nhanVien.id, NGAY_DC_2, '09:00:00', '17:00:00');
    const sai = [
      { gioVaoDeXuat: '25:00' },
      { gioVaoDeXuat: '8h' },
      {}, // thiếu cả hai giờ
      { gioVaoDeXuat: '08:00', ngayCanDieuChinh: ngay(1) }, // tương lai
      { gioVaoDeXuat: '17:00', gioRaDeXuat: '08:00' },
      { gioVaoDeXuat: '08:00', gioRaDeXuat: '08:00' },
      { gioRaDeXuat: '17:00' }, // chưa có bản ghi mà chỉ đề xuất giờ ra
      { gioVaoDeXuat: '08:00', lyDoGiaiTrinh: '' },
      { gioVaoDeXuat: '08:00', ngayCanDieuChinh: '2019-12-31' }, // trước ngày vào làm
      { gioRaDeXuat: '08:30', ngayCanDieuChinh: NGAY_DC_2 }, // giờ ra mới <= giờ vào hiện có
    ];
    for (const body of sai) {
      const res = await taoYeuCau(tk, body);
      expect([res.status, body]).toEqual([400, body]);
      expect(res.body).toMatchObject({ success: false, code: 400, data: null });
    }
    const [d] = await pool.execute('SELECT id FROM yeucaudieuchinhchamcong WHERE nhanVienId = ?', [nhanVien.id]);
    expect(d).toHaveLength(0);
  });

  test('trùng ngày đang chờ duyệt trả 409', async () => {
    const { tk } = await taoNhanVien();
    await taoYeuCauOk(tk, { gioVaoDeXuat: '08:00' });
    expect((await taoYeuCau(tk, { gioVaoDeXuat: '07:50' })).status).toBe(409);
  });

  test('tháng đã chốt trả 409', async () => {
    const { tk } = await taoNhanVien();
    await chenChot('2021-06');
    expect((await taoYeuCau(tk, { gioVaoDeXuat: '08:00' })).status).toBe(409);
  });

  test('nhân viên TAM_NGHI vẫn gửi được cho ngày đã làm', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    await pool.execute("UPDATE nhanvien SET trangThaiLamViec = 'TAM_NGHI' WHERE id = ?", [nhanVien.id]);
    await taoYeuCauOk(tk, { gioVaoDeXuat: '08:00', gioRaDeXuat: '17:00' });
  });
});

// ---------------------------------------------------------------------------
describe('Duyệt / từ chối yêu cầu', () => {
  test('duyệt khi chưa có bản ghi: tạo bản ghi DA_DIEU_CHINH, ghi nhật ký', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    const yc = await taoYeuCauOk(tk, { gioVaoDeXuat: '08:30', gioRaDeXuat: '17:45' });
    const res = await goi('post', `/dieuChinhCong/${yc.id}/duyet`, token.quanly);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ trangThai: 'DA_DUYET', nguoiDuyetId: 3 });
    const [[bg]] = await pool.execute('SELECT * FROM banghichamcong WHERE nhanVienId = ? AND ngayChamCong = ?', [nhanVien.id, NGAY_DC]);
    expect(bg).toMatchObject({ gioVao: '08:30:00', gioRa: '17:45:00', trangThai: 'DA_DIEU_CHINH', diMuon: 1, veSom: 0 });
    expect(Number(bg.soGioLamThucTe)).toBe(7.5);
    expect(Number(bg.soGioLamThemOT)).toBe(0.75);
    expect(res.body.data.banGhiChamCongId).toBe(bg.id);
    const nk = await layNhatKy('DUYET_DIEU_CHINH_CONG');
    expect(nk).toEqual([{ nguoiDungId: 3, chiTiet: expect.stringContaining(`#${yc.id}`) }]);
  });

  test('duyệt khi đã có bản ghi: cập nhật giờ ra và tính lại chỉ số', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    const id = await chenBanGhi(nhanVien.id, NGAY_DC, '08:00:00', null);
    const yc = await taoYeuCauOk(tk, { gioRaDeXuat: '16:30' });
    expect(yc.banGhiChamCongId).toBe(id);
    expect((await goi('post', `/dieuChinhCong/${yc.id}/duyet`, token.hr)).status).toBe(200);
    const [[bg]] = await pool.execute('SELECT * FROM banghichamcong WHERE id = ?', [id]);
    expect(bg).toMatchObject({ gioVao: '08:00:00', gioRa: '16:30:00', trangThai: 'DA_DIEU_CHINH', veSom: 1, diMuon: 0 });
    expect(Number(bg.soGioLamThucTe)).toBe(7.5);
  });

  test('tự duyệt 403, quanLy ngoài phạm vi 403, nhanVien 403, HR duyệt người khác được', async () => {
    const yHr = await taoYeuCauOk(token.hr, { gioVaoDeXuat: '08:00' });
    expect((await goi('post', `/dieuChinhCong/${yHr.id}/duyet`, token.hr)).status).toBe(403);
    expect((await goi('post', `/dieuChinhCong/${yHr.id}/duyet`, token.hr2)).status).toBe(200);

    const { tk } = await taoNhanVien();
    const yc = await taoYeuCauOk(tk, { gioVaoDeXuat: '08:00' });
    expect((await goi('post', `/dieuChinhCong/${yc.id}/duyet`, token.quanly2)).status).toBe(403);
    expect((await goi('post', `/dieuChinhCong/${yc.id}/tuChoi`, token.quanly2).send({ lyDoTuChoi: 'Không' })).status).toBe(403);
    expect((await goi('post', `/dieuChinhCong/${yc.id}/duyet`, token.nhanvien)).status).toBe(403);
    expect((await goi('post', '/dieuChinhCong/999999/duyet', token.hr)).status).toBe(404);
    const [[d]] = await pool.execute('SELECT trangThai FROM yeucaudieuchinhchamcong WHERE id = ?', [yc.id]);
    expect(d.trangThai).toBe('CHO_DUYET');
  });

  test('danh sách yêu cầu theo phạm vi quanLy', async () => {
    const { tk } = await taoNhanVien();
    const yc = await taoYeuCauOk(tk, { gioVaoDeXuat: '08:00' });
    const co = async (ten) => (await goi('get', '/dieuChinhCong?kichThuoc=100', token[ten])).body.data.items.some((d) => d.id === yc.id);
    expect(await co('quanly')).toBe(true);
    expect(await co('hr')).toBe(true);
    expect(await co('quanly2')).toBe(false);
  });

  test('từ chối thiếu lý do 400; từ chối xong thì duyệt/từ chối lại 409', async () => {
    const { tk } = await taoNhanVien();
    const yc = await taoYeuCauOk(tk, { gioVaoDeXuat: '08:00' });
    expect((await goi('post', `/dieuChinhCong/${yc.id}/tuChoi`, token.hr).send({})).status).toBe(400);
    const tc = await goi('post', `/dieuChinhCong/${yc.id}/tuChoi`, token.hr).send({ lyDoTuChoi: 'Không có xác nhận' });
    expect(tc.status).toBe(200);
    expect(tc.body.data).toMatchObject({ trangThai: 'TU_CHOI', lyDoTuChoi: 'Không có xác nhận' });
    expect((await goi('post', `/dieuChinhCong/${yc.id}/duyet`, token.hr)).status).toBe(409);
    expect((await goi('post', `/dieuChinhCong/${yc.id}/tuChoi`, token.hr).send({ lyDoTuChoi: 'Lại' })).status).toBe(409);
  });

  test('lỗi ghi nhật ký giữa chừng thì rollback (yêu cầu vẫn CHO_DUYET, không tạo bản ghi)', async () => {
    const { nhanVien, tk } = await taoNhanVien();
    const yc = await taoYeuCauOk(tk, { gioVaoDeXuat: '08:00', gioRaDeXuat: '17:00' });
    const nhatKyRepository = require('../src/repositories/nhatKyRepository');
    jest.spyOn(nhatKyRepository, 'themNhatKy').mockRejectedValueOnce(new Error('loi gia lap'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await goi('post', `/dieuChinhCong/${yc.id}/duyet`, token.hr);
    expect(res.status).toBe(500);
    const [[d]] = await pool.execute('SELECT trangThai FROM yeucaudieuchinhchamcong WHERE id = ?', [yc.id]);
    expect(d.trangThai).toBe('CHO_DUYET');
    const [bg] = await pool.execute('SELECT id FROM banghichamcong WHERE nhanVienId = ?', [nhanVien.id]);
    expect(bg).toHaveLength(0);
  });

  test('sau khi chốt tháng thì duyệt yêu cầu tháng đó 409', async () => {
    const { tk } = await taoNhanVien();
    const yc = await taoYeuCauOk(tk, { gioVaoDeXuat: '08:00' });
    await chenChot('2021-06');
    expect((await goi('post', `/dieuChinhCong/${yc.id}/duyet`, token.hr)).status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
describe('Chốt công tháng', () => {
  test('chốt thành công ghi CHOT_CONG_THANG, chốt lại 409, có trong danh sách', async () => {
    const res = await goi('post', '/chamCong/chotCong', token.hr).send({ thang: '2020-01' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, code: 200, data: { thang: '2020-01', chot: { nguoiChot: 'hr' } } });
    expect(await layNhatKy('CHOT_CONG_THANG')).toEqual([{ nguoiDungId: 4, chiTiet: '2020-01' }]);
    expect((await goi('post', '/chamCong/chotCong', token.hr).send({ thang: '2020-01' })).status).toBe(409);
    const ds = await goi('get', '/chamCong/chotCong', token.giamdoc);
    expect(ds.body.data.some((d) => d.thang === '2020-01')).toBe(true);
  });

  test('sai định dạng 400; tháng hiện tại/tương lai 409; trước khi có nhân viên 409', async () => {
    expect((await goi('post', '/chamCong/chotCong', token.hr).send({ thang: '2020-1' })).status).toBe(400);
    expect((await goi('post', '/chamCong/chotCong', token.hr).send({})).status).toBe(400);
    expect((await goi('post', '/chamCong/chotCong', token.hr).send({ thang: thangHienTai() })).status).toBe(409);
    expect((await goi('post', '/chamCong/chotCong', token.hr).send({ thang: '2099-01' })).status).toBe(409);
    const [[m]] = await pool.query("SELECT DATE_FORMAT(DATE_SUB(MIN(ngayVaoLam), INTERVAL 1 MONTH), '%Y-%m') AS t FROM nhanvien");
    expect((await goi('post', '/chamCong/chotCong', token.hr).send({ thang: m.t })).status).toBe(409);
    expect(await layNhatKy('CHOT_CONG_THANG')).toHaveLength(0);
  });

  test('còn yêu cầu CHO_DUYET trong tháng thì 409', async () => {
    const { tk } = await taoNhanVien();
    await taoYeuCauOk(tk, { gioVaoDeXuat: '08:00' });
    expect((await goi('post', '/chamCong/chotCong', token.hr).send({ thang: '2021-06' })).status).toBe(409);
    expect(await layNhatKy('CHOT_CONG_THANG')).toHaveLength(0);
  });

  test('còn ngày thiếu check-out thì 409', async () => {
    const { nhanVien } = await taoNhanVien();
    await chenBanGhi(nhanVien.id, NGAY_DC, '08:00:00', null);
    expect((await goi('post', '/chamCong/chotCong', token.hr).send({ thang: '2021-06' })).status).toBe(409);
  });

  test('sau chốt thì tạo yêu cầu tháng đó 409', async () => {
    const { tk } = await taoNhanVien();
    expect((await goi('post', '/chamCong/chotCong', token.hr).send({ thang: '2021-06' })).status).toBe(200);
    expect((await taoYeuCau(tk, { gioVaoDeXuat: '08:00' })).status).toBe(409);
  });

  test('2 HR chốt cùng tháng song song: đúng 1 thành công', async () => {
    const kq = await Promise.all([
      goi('post', '/chamCong/chotCong', token.hr).send({ thang: '2020-05' }),
      goi('post', '/chamCong/chotCong', token.hr2).send({ thang: '2020-05' }),
    ]);
    expect(kq.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await layNhatKy('CHOT_CONG_THANG')).toHaveLength(1);
  });
});
