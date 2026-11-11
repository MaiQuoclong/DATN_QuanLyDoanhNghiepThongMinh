const { randomUUID } = require('crypto');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/ketNoiCsdl');
const aiClientService = require('../src/services/aiClientService');
const LoiUngDung = require('../src/utils/LoiUngDung');
const { gioiHanHoiDap, gioiHanXacNhan } = require('../src/routes/troLyAiRoutes');

// 5.5 AI tạo đơn qua chat. ai-service luôn mock bằng kho bản nháp trong bộ nhớ (chuyển trạng thái nguyên tử
// như SQLite thật). Dữ liệu đơn dùng 12/2024 (sau ngày vào làm NV0005, ngoài quỹ seed năm hiện tại ±1), quỹ 2024 tự cấp; điều chỉnh công dùng
// tháng 2025-01 (chưa chốt, sau ngày vào làm của NV0001..NV0005). Mọi bản ghi thêm được dọn theo mốc MAX(id).
const MAT_KHAU = 'MatKhau@123';
const NGUOI_DUNG = { admin: 1, giamdoc: 2, quanly: 3, hr: 4, nhanvien: 5 }; // nguoiDungId = nhanVienId trong seed
const NAM = 2024;
const token = {};
let anhChup;
let goiAi;
let kho;
let loiGoi;
let phanHoiXuLy;

const goi = (phuongThuc, duongDan, tk) => {
  const r = request(app)[phuongThuc](`/api/v1${duongDan}`);
  return tk ? r.set('Authorization', `Bearer ${tk}`) : r;
};

const NGHI = { maLoaiNghiPhep: 'PHEP_NAM', ngayBatDau: '2024-12-02', ngayKetThuc: '2024-12-02', nuaNgay: false, lyDo: 'Việc gia đình' };
const DIEU_CHINH = { ngayCanDieuChinh: '2025-01-06', gioVaoDeXuat: '08:00', gioRaDeXuat: '17:00', lyDoGiaiTrinh: 'Quên chấm công' };

function trangThaiHienTai(bn) {
  return bn.trangThai === 'CHO_XAC_NHAN' && bn.hetHan <= Date.now() ? 'HET_HAN' : bn.trangThai;
}
const xem = (bn) => ({ ...bn, trangThai: trangThaiHienTai(bn) });
function layTrongKho(id, nguoiDungId) {
  const bn = kho.get(id);
  if (!bn || bn.nguoiDungId !== Number(nguoiDungId)) throw new LoiUngDung(404, 'Không tìm thấy bản nháp đơn');
  return bn;
}

// Mô phỏng ai-service: /troLy/xuLy trả phanHoiXuLy(body); XEM_TRUOC_DON thì lưu bản nháp vào kho
function aiGia() {
  goiAi.mockImplementation(async (duongDan, { method = 'GET', body } = {}) => {
    loiGoi.push({ duongDan, method, body });
    if (duongDan === '/noiBo/troLy/xuLy' && method === 'POST') {
      const { banNhap, ...r } = phanHoiXuLy(body);
      const ketQua = { phienId: body.phienId, traLoi: 'ok', nguonTrichDan: [], cheDo: 'LLM', thoiGian: 'x', ...r };
      if (!banNhap) return ketQua;
      const bn = {
        id: randomUUID(),
        phienId: body.phienId,
        dauPhien: body.dauPhien,
        nguoiDungId: body.nguoiDungId,
        trangThai: 'CHO_XAC_NHAN',
        ketQua: null,
        hetHan: Date.now() + 30 * 60 * 1000,
        ...banNhap,
      };
      kho.set(bn.id, bn);
      return { ...ketQua, banNhapId: bn.id, banNhap: xem(bn) };
    }
    let m = duongDan.match(/^\/noiBo\/banNhap\/([^/?]+)\?nguoiDungId=(\d+)$/);
    if (m && method === 'GET') return xem(layTrongKho(decodeURIComponent(m[1]), m[2]));
    m = duongDan.match(/^\/noiBo\/banNhap\/([^/?]+)\/chuyenTrangThai$/);
    if (m && method === 'POST') {
      const bn = layTrongKho(decodeURIComponent(m[1]), body.nguoiDungId);
      // Kiểm tra + đặt đồng bộ (không await ở giữa) = nguyên tử như UPDATE ... WHERE trangThai = tu
      const daChuyen = trangThaiHienTai(bn) === body.tu;
      if (daChuyen) {
        bn.trangThai = body.sang;
        if (body.ketQua) bn.ketQua = body.ketQua;
      }
      return { daChuyen, banNhap: xem(bn) };
    }
    if (duongDan.startsWith('/noiBo/lichSu/')) return { tinNhan: [] };
    throw new Error(`Gọi ai-service ngoài dự kiến: ${method} ${duongDan}`);
  });
}

async function taoBanNhap(tk, loai, thamSo) {
  phanHoiXuLy = () => ({ loaiPhanHoi: 'XEM_TRUOC_DON', banNhap: { loai, thamSo } });
  const res = await goi('post', '/troLyAi/hoiDap', tk).send({ cauHoi: 'xin nghỉ phép' });
  expect(res.status).toBe(200);
  expect(res.body.data.loaiPhanHoi).toBe('XEM_TRUOC_DON');
  return res.body.data.banNhap.id;
}
const xacNhan = (tk, id) => goi('post', `/troLyAi/banNhap/${id}/xacNhan`, tk);

async function capQuy(nhanVienId, tong = 12) {
  await pool.execute('INSERT INTO quyngayphep (nhanVienId, namHieuLuc, tongSoNgayPhep, soNgayDaNghi) VALUES (?, ?, ?, 0)', [
    nhanVienId,
    NAM,
    tong,
  ]);
}
const lay = async (bang) => (await pool.query(`SELECT COALESCE(MAX(id), 0) AS m FROM ${bang}`))[0][0].m;
const BANG = ['dondexuatnghiphep', 'yeucaudieuchinhchamcong', 'quyngayphep', 'nhatkyhethong', 'phientrochuyenai'];

beforeAll(async () => {
  for (const ten of Object.keys(NGUOI_DUNG)) {
    const res = await request(app).post('/api/v1/xacThuc/dangNhap').set('X-Tra-Token', '1').send({ tenDangNhap: ten, matKhau: MAT_KHAU });
    expect(res.status).toBe(200);
    token[ten] = res.body.data.token;
  }
});

beforeEach(async () => {
  anhChup = {};
  for (const b of BANG) anhChup[b] = await lay(b);
  kho = new Map();
  loiGoi = [];
  phanHoiXuLy = () => ({ loaiPhanHoi: 'TRA_LOI' });
  goiAi = jest.spyOn(aiClientService, 'goiAiService');
  aiGia();
  for (const id of Object.values(NGUOI_DUNG)) {
    await gioiHanHoiDap.resetKey(`nguoiDung:${id}`);
    await gioiHanXacNhan.resetKey(`nguoiDung:${id}`);
  }
});

afterEach(async () => {
  goiAi.mockRestore();
  for (const b of BANG) {
    await pool.execute(`DELETE FROM ${b} WHERE id > ?`, [anhChup[b]]);
    await pool.query(`ALTER TABLE ${b} AUTO_INCREMENT = 1`);
  }
});

afterAll(async () => {
  await pool.end();
});

// ---------------------------------------------------------------------------
describe('hoiDap mở rộng tạo đơn', () => {
  test.each(['TRA_LOI', 'HOI_LAI', 'QUY_PHEP'])('trả loaiPhanHoi %s, không có bản nháp', async (loai) => {
    phanHoiXuLy = () => ({ loaiPhanHoi: loai });
    const res = await goi('post', '/troLyAi/hoiDap', token.nhanvien).send({ cauHoi: 'xin nghỉ phép' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, code: 200 });
    expect(res.body.data.loaiPhanHoi).toBe(loai);
    expect(res.body.data.banNhap).toBeNull();
  });

  test('ai-service cũ không trả loaiPhanHoi → mặc định TRA_LOI', async () => {
    phanHoiXuLy = () => ({});
    const res = await goi('post', '/troLyAi/hoiDap', token.nhanvien).send({ cauHoi: 'quy chế?' });
    expect(res.body.data.loaiPhanHoi).toBe('TRA_LOI');
  });

  test('body gửi ai-service có nguoiDungId từ JWT, ngayHienTai, loaiNghiPhep, quyPhep', async () => {
    const res = await goi('post', '/troLyAi/hoiDap', token.nhanvien).send({ cauHoi: 'xin nghỉ', nguoiDungId: 1 });
    expect(res.status).toBe(200);
    const { body } = loiGoi.find((g) => g.duongDan === '/noiBo/troLy/xuLy');
    expect(body.nguoiDungId).toBe(5);
    expect(body.ngayHienTai).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.ngayHienTai).toBe(new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }));
    expect(body.loaiNghiPhep).toEqual(expect.arrayContaining([{ maLoai: 'PHEP_NAM', tenLoai: 'Nghỉ phép năm' }]));
    for (const l of body.loaiNghiPhep) expect(Object.keys(l).sort()).toEqual(['maLoai', 'tenLoai']);
    expect(body.quyPhep).toEqual(
      expect.objectContaining({ nam: expect.any(Number), tongSoNgayPhep: expect.anything(), soNgayConLai: expect.anything() }),
    );
  });

  test('XEM_TRUOC_DON trả bản nháp kèm tenLoai và soNgayNghi', async () => {
    phanHoiXuLy = () => ({
      loaiPhanHoi: 'XEM_TRUOC_DON',
      banNhap: { loai: 'NGHI_PHEP', thamSo: { ...NGHI, ngayKetThuc: '2024-12-03' } },
    });
    const res = await goi('post', '/troLyAi/hoiDap', token.nhanvien).send({ cauHoi: 'xin nghỉ phép' });
    expect(res.status).toBe(200);
    expect(res.body.data.banNhap).toMatchObject({ loai: 'NGHI_PHEP', trangThai: 'CHO_XAC_NHAN', tenLoai: 'Nghỉ phép năm', soNgayNghi: 2 });
    expect(res.body.data.banNhap.nguoiDungId).toBeUndefined();
  });

  test('ai-service tắt → 503 thân thiện', async () => {
    goiAi.mockImplementation(() => Promise.reject(new LoiUngDung(503, aiClientService.THONG_BAO_KHONG_KHA_DUNG)));
    const res = await goi('post', '/troLyAi/hoiDap', token.nhanvien).send({ cauHoi: 'xin nghỉ phép' });
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ success: false, code: 503, message: aiClientService.THONG_BAO_KHONG_KHA_DUNG, data: null });
  });
});

// ---------------------------------------------------------------------------
describe('Xác nhận bản nháp', () => {
  test('nghỉ phép → 201, đơn AI_CHAT CHO_DUYET của chính người gọi dù thamSo có nhanVienId/trangThai lạ', async () => {
    await capQuy(5);
    const id = await taoBanNhap(token.nhanvien, 'NGHI_PHEP', { ...NGHI, nhanVienId: 6, trangThai: 'DA_DUYET', nguoiDuyetId: 1 });
    const res = await xacNhan(token.nhanvien, id);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, code: 201, data: { loai: 'NGHI_PHEP', id: expect.any(Number) } });
    const [[don]] = await pool.execute('SELECT * FROM dondexuatnghiphep WHERE id = ?', [res.body.data.id]);
    expect(don).toMatchObject({ nhanVienId: 5, trangThai: 'CHO_DUYET', phuongThucTao: 'AI_CHAT', nguoiDuyetId: null });
    expect(res.body.data.maDon).toBe(don.maDon);
    expect(kho.get(id)).toMatchObject({ trangThai: 'DA_TAO', ketQua: { id: don.id, maDon: don.maDon } });
    // Nhật ký AI_TAO_DON
    const [nk] = await pool.execute("SELECT nguoiDungId, chiTiet FROM nhatkyhethong WHERE id > ? AND hanhDong = 'AI_TAO_DON'", [
      anhChup.nhatkyhethong,
    ]);
    expect(nk).toHaveLength(1);
    expect(nk[0].nguoiDungId).toBe(5);
    expect(nk[0].chiTiet).toContain(don.maDon);
  });

  test('điều chỉnh công → 201, yêu cầu CHO_DUYET của chính mình, có nhật ký', async () => {
    const id = await taoBanNhap(token.nhanvien, 'DIEU_CHINH_CONG', { ...DIEU_CHINH, nhanVienId: 6 });
    const res = await xacNhan(token.nhanvien, id);
    expect(res.status).toBe(201);
    const [[yc]] = await pool.execute('SELECT * FROM yeucaudieuchinhchamcong WHERE id = ?', [res.body.data.id]);
    expect(yc).toMatchObject({ nhanVienId: 5, trangThai: 'CHO_DUYET' });
    const [nk] = await pool.execute("SELECT chiTiet FROM nhatkyhethong WHERE id > ? AND hanhDong = 'AI_TAO_DON'", [anhChup.nhatkyhethong]);
    expect(nk[0].chiTiet).toContain('DIEU_CHINH_CONG');
  });

  test('xác nhận song song 5 lần → đúng 1 đơn, còn lại 409', async () => {
    await capQuy(5);
    const id = await taoBanNhap(token.nhanvien, 'NGHI_PHEP', NGHI);
    const kq = await Promise.all(Array.from({ length: 5 }, () => xacNhan(token.nhanvien, id)));
    expect(kq.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409]);
    const [[d]] = await pool.execute('SELECT COUNT(*) AS so FROM dondexuatnghiphep WHERE id > ?', [anhChup.dondexuatnghiphep]);
    expect(Number(d.so)).toBe(1);
    // Bấm lại sau khi đã tạo → 409 kèm mã đơn
    const lai = await xacNhan(token.nhanvien, id);
    expect(lai.status).toBe(409);
    expect(lai.body.message).toContain(kho.get(id).ketQua.maDon);
  });

  test('bản nháp người khác 404, không tạo đơn', async () => {
    await capQuy(5);
    const id = await taoBanNhap(token.nhanvien, 'NGHI_PHEP', NGHI);
    const res = await xacNhan(token.quanly, id);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: 404, data: null });
    expect((await goi('post', `/troLyAi/banNhap/${id}/huy`, token.hr)).status).toBe(404);
    expect(kho.get(id).trangThai).toBe('CHO_XAC_NHAN');
  });

  test('id không phải UUID → 404, không gọi ai-service', async () => {
    for (const id of ['abc', '1', '..%2F..%2FlichSu']) {
      expect((await xacNhan(token.nhanvien, id)).status).toBe(404);
    }
    expect(loiGoi).toHaveLength(0);
  });

  test('chưa đăng nhập → 401', async () => {
    expect((await goi('post', `/troLyAi/banNhap/${randomUUID()}/xacNhan`)).status).toBe(401);
  });

  test('bản nháp HET_HAN → 409; DA_TAO → 409', async () => {
    const id = await taoBanNhap(token.nhanvien, 'NGHI_PHEP', NGHI);
    kho.get(id).hetHan = Date.now() - 1;
    const res = await xacNhan(token.nhanvien, id);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/hết hạn/);
    const id2 = await taoBanNhap(token.nhanvien, 'NGHI_PHEP', NGHI);
    Object.assign(kho.get(id2), { trangThai: 'DA_TAO', ketQua: { maDon: 'DNP2021-9999' } });
    const r2 = await xacNhan(token.nhanvien, id2);
    expect(r2.status).toBe(409);
    expect(r2.body.message).toContain('DNP2021-9999');
  });

  test('bản nháp KHONG_RO (kẹt DANG_TAO) → 409 hướng dẫn kiểm tra Đơn của tôi', async () => {
    const id = await taoBanNhap(token.nhanvien, 'NGHI_PHEP', NGHI);
    kho.get(id).trangThai = 'KHONG_RO';
    const res = await xacNhan(token.nhanvien, id);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/Đơn của tôi/);
  });

  test('phiên chứa bản nháp đã xóa → 404', async () => {
    const id = await taoBanNhap(token.nhanvien, 'NGHI_PHEP', NGHI);
    await pool.execute('DELETE FROM phientrochuyenai WHERE id = ?', [kho.get(id).phienId]);
    expect((await xacNhan(token.nhanvien, id)).status).toBe(404);
  });

  test('vượt quỹ phép → message giống form, bản nháp LOI, không tạo đơn', async () => {
    await capQuy(5, 1);
    const thamSo = { ...NGHI, ngayKetThuc: '2024-12-03' };
    const form = await goi('post', '/donNghiPhep', token.nhanvien).send({
      loaiNghiPhepId: 1,
      ngayBatDau: thamSo.ngayBatDau,
      ngayKetThuc: thamSo.ngayKetThuc,
      lyDo: thamSo.lyDo,
    });
    expect(form.status).toBeGreaterThanOrEqual(400);
    const id = await taoBanNhap(token.nhanvien, 'NGHI_PHEP', thamSo);
    const res = await xacNhan(token.nhanvien, id);
    expect(res.status).toBe(form.status);
    expect(res.body.message).toBe(form.body.message);
    expect(kho.get(id)).toMatchObject({ trangThai: 'LOI', ketQua: { loi: form.body.message } });
    const [[d]] = await pool.execute('SELECT COUNT(*) AS so FROM dondexuatnghiphep WHERE id > ?', [anhChup.dondexuatnghiphep]);
    expect(Number(d.so)).toBe(0);
  });

  test('chồng lấn đơn đã có → message gốc, LOI', async () => {
    await capQuy(5);
    const id1 = await taoBanNhap(token.nhanvien, 'NGHI_PHEP', NGHI);
    expect((await xacNhan(token.nhanvien, id1)).status).toBe(201);
    const id2 = await taoBanNhap(token.nhanvien, 'NGHI_PHEP', NGHI);
    const res = await xacNhan(token.nhanvien, id2);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/trùng|chồng|đã có/i);
    expect(kho.get(id2).trangThai).toBe('LOI');
  });

  test('maLoai lạ → 400, LOI', async () => {
    const id = await taoBanNhap(token.nhanvien, 'NGHI_PHEP', { ...NGHI, maLoaiNghiPhep: 'LOAI_BIA' });
    const res = await xacNhan(token.nhanvien, id);
    expect(res.status).toBe(400);
    expect(kho.get(id).trangThai).toBe('LOI');
  });

  test('điều chỉnh công ngày tương lai → 400 message gốc, LOI', async () => {
    const mai = new Date(Date.now() + 2 * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
    const id = await taoBanNhap(token.nhanvien, 'DIEU_CHINH_CONG', { ...DIEU_CHINH, ngayCanDieuChinh: mai });
    const res = await xacNhan(token.nhanvien, id);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Không thể điều chỉnh công cho ngày trong tương lai');
    expect(kho.get(id)).toMatchObject({ trangThai: 'LOI', ketQua: { loi: res.body.message } });
  });

  test.each([
    ['ngày sai định dạng', { ngayCanDieuChinh: '06/01/2025' }],
    ['ngày không tồn tại', { ngayCanDieuChinh: '2025-02-30' }],
    ['giờ sai', { gioVaoDeXuat: '25:00' }],
    ['giờ dạng chữ', { gioRaDeXuat: 'năm giờ' }],
    ['lý do quá ngắn', { lyDoGiaiTrinh: 'ab' }],
  ])('điều chỉnh công %s → 400 qua AI và qua route dieuChinhCong', async (_ten, ghiDe) => {
    const thamSo = { ...DIEU_CHINH, ...ghiDe };
    const id = await taoBanNhap(token.nhanvien, 'DIEU_CHINH_CONG', thamSo);
    const res = await xacNhan(token.nhanvien, id);
    expect(res.status).toBe(400);
    expect(kho.get(id).trangThai).toBe('LOI');
    const form = await goi('post', '/dieuChinhCong', token.nhanvien).send(thamSo);
    expect(form.status).toBe(400);
    expect(res.body.message).toBe(form.body.message);
    const [[d]] = await pool.execute('SELECT COUNT(*) AS so FROM yeucaudieuchinhchamcong WHERE id > ?', [anhChup.yeucaudieuchinhchamcong]);
    expect(Number(d.so)).toBe(0);
  });

  test('ai-service tắt khi xác nhận → 503, không tạo đơn', async () => {
    goiAi.mockImplementation(() => Promise.reject(new LoiUngDung(503, aiClientService.THONG_BAO_KHONG_KHA_DUNG)));
    const res = await xacNhan(token.nhanvien, randomUUID());
    expect(res.status).toBe(503);
    expect(res.body.message).toBe(aiClientService.THONG_BAO_KHONG_KHA_DUNG);
  });

  test.each(Object.keys(NGUOI_DUNG))('vai trò %s xác nhận được đơn của chính mình', async (ten) => {
    await capQuy(NGUOI_DUNG[ten]);
    const id = await taoBanNhap(token[ten], 'NGHI_PHEP', NGHI);
    const res = await xacNhan(token[ten], id);
    expect(res.status).toBe(201);
    const [[don]] = await pool.execute('SELECT nhanVienId, trangThai, phuongThucTao FROM dondexuatnghiphep WHERE id = ?', [
      res.body.data.id,
    ]);
    expect(don).toEqual({ nhanVienId: NGUOI_DUNG[ten], trangThai: 'CHO_DUYET', phuongThucTao: 'AI_CHAT' });
  });

  test('quá 10 lần xác nhận/phút → 429', async () => {
    const ma = [];
    for (let i = 0; i < 11; i += 1) ma.push((await xacNhan(token.nhanvien, randomUUID())).status);
    expect(ma.slice(0, 10).every((s) => s === 404)).toBe(true);
    expect(ma[10]).toBe(429);
    // Người khác không bị chặn chung
    expect((await xacNhan(token.hr, randomUUID())).status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
describe('Hủy bản nháp', () => {
  test('hủy → 200 HUY; xác nhận sau hủy 409; hủy bản đã tạo 409', async () => {
    const id = await taoBanNhap(token.nhanvien, 'NGHI_PHEP', NGHI);
    const res = await goi('post', `/troLyAi/banNhap/${id}/huy`, token.nhanvien);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, code: 200, data: { id, trangThai: 'HUY' } });
    expect((await xacNhan(token.nhanvien, id)).status).toBe(409);

    await capQuy(5);
    const id2 = await taoBanNhap(token.nhanvien, 'NGHI_PHEP', NGHI);
    expect((await xacNhan(token.nhanvien, id2)).status).toBe(201);
    const huy2 = await goi('post', `/troLyAi/banNhap/${id2}/huy`, token.nhanvien);
    expect(huy2.status).toBe(409);
    expect(kho.get(id2).trangThai).toBe('DA_TAO');
  });

  test('hủy bản nháp hết hạn → 409', async () => {
    const id = await taoBanNhap(token.nhanvien, 'NGHI_PHEP', NGHI);
    kho.get(id).hetHan = Date.now() - 1;
    expect((await goi('post', `/troLyAi/banNhap/${id}/huy`, token.nhanvien)).status).toBe(409);
  });
});
