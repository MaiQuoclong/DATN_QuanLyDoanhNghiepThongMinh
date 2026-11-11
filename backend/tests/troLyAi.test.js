const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/ketNoiCsdl');
const aiClientService = require('../src/services/aiClientService');
const LoiUngDung = require('../src/utils/LoiUngDung');
const { gioiHanHoiDap } = require('../src/routes/troLyAiRoutes');
const { TIEU_DE_MAC_DINH, layDauPhien } = require('../src/services/troLyAiService');

// Seed: phiên 1..7 (nguoiDungId 1,2,3,4,4,5,6). ai-service luôn mock: test không gọi ai-service/LLM thật.
// Mỗi test tự tạo phiên (id > mốc) và dọn theo mốc MAX(id), đặt lại AUTO_INCREMENT.
const MAT_KHAU = 'MatKhau@123';
const NGUOI_DUNG_ID = { admin: 1, giamdoc: 2, quanly: 3, hr: 4, nhanvien: 5, nhanvien2: 6 };
const token = {};
let mocPhien;
let goiAi;

const goi = (phuongThuc, duongDan, tk) => {
  const r = request(app)[phuongThuc](`/api/v1${duongDan}`);
  return tk ? r.set('Authorization', `Bearer ${tk}`) : r;
};

const TRA_LOI = {
  traLoi: 'Bạn được nghỉ 03 ngày [1].',
  nguonTrichDan: [
    {
      soThuTu: 1,
      taiLieuId: 2,
      maTaiLieu: 'QC-NGHIPHEP',
      tieuDe: 'Quy chế nghỉ phép',
      dieu: 2,
      khoan: 3,
      viTri: 'QC-NGHIPHEP, Điều 2 khoản 3',
      doanTrich: '...',
      diem: 0.9,
    },
    {
      soThuTu: 2,
      taiLieuId: 999,
      maTaiLieu: 'QC-DAXOA',
      tieuDe: 'Đã xóa',
      dieu: 1,
      khoan: null,
      viTri: 'QC-DAXOA, Điều 1',
      doanTrich: '...',
      diem: 0.8,
    },
  ],
  cheDo: 'LLM',
  thoiGian: '2026-11-11T02:00:00+00:00',
};

function aiChay() {
  goiAi.mockImplementation(async (duongDan, { method = 'GET' } = {}) => {
    if (duongDan === '/noiBo/troLy/xuLy' && method === 'POST') return { phienId: 0, ...TRA_LOI };
    if (duongDan.startsWith('/noiBo/lichSu/') && method === 'GET') return { tinNhan: [{ id: 1, vaiTro: 'nguoiDung', noiDung: 'x' }] };
    if (duongDan.startsWith('/noiBo/lichSu/') && method === 'DELETE') return { soTinNhanDaXoa: 2 };
    throw new Error(`Gọi ai-service ngoài dự kiến: ${method} ${duongDan}`);
  });
}
const aiTat = () => Promise.reject(new LoiUngDung(503, aiClientService.THONG_BAO_KHONG_KHA_DUNG));

async function taoPhien(tk, tieuDePhien) {
  const res = await goi('post', '/troLyAi/phien', tk).send(tieuDePhien ? { tieuDePhien } : {});
  expect(res.status).toBe(201);
  return res.body.data;
}
async function demPhienMoi() {
  const [[d]] = await pool.query('SELECT COUNT(*) AS so FROM phientrochuyenai WHERE id > ?', [mocPhien]);
  return Number(d.so);
}

beforeAll(async () => {
  for (const ten of Object.keys(NGUOI_DUNG_ID)) {
    const res = await request(app).post('/api/v1/xacThuc/dangNhap').set('X-Tra-Token', '1').send({ tenDangNhap: ten, matKhau: MAT_KHAU });
    expect(res.status).toBe(200);
    token[ten] = res.body.data.token;
  }
});

beforeEach(async () => {
  mocPhien = (await pool.query('SELECT COALESCE(MAX(id), 0) AS m FROM phientrochuyenai'))[0][0].m;
  goiAi = jest.spyOn(aiClientService, 'goiAiService').mockImplementation(aiTat);
  for (const id of Object.values(NGUOI_DUNG_ID)) await gioiHanHoiDap.resetKey(`nguoiDung:${id}`);
});

afterEach(async () => {
  goiAi.mockRestore();
  await pool.execute('DELETE FROM phientrochuyenai WHERE id > ?', [mocPhien]);
  await pool.query('ALTER TABLE phientrochuyenai AUTO_INCREMENT = 1');
});

afterAll(async () => {
  await pool.end();
});

// ---------------------------------------------------------------------------
describe('Phiên trò chuyện', () => {
  test.each(Object.keys(NGUOI_DUNG_ID))('%s chỉ thấy phiên của mình (seed)', async (ten) => {
    const res = await goi('get', '/troLyAi/phien', token[ten]);
    expect(res.status).toBe(200);
    const [mong] = await pool.query('SELECT id FROM phientrochuyenai WHERE nguoiDungId = ?', [NGUOI_DUNG_ID[ten]]);
    expect(res.body.data.map((p) => p.id).sort()).toEqual(mong.map((p) => p.id).sort());
    for (const p of res.body.data) expect(Object.keys(p).sort()).toEqual(['id', 'thoiGianTao', 'tieuDePhien']);
  });

  test('seed có phiên cho cả 5 vai trò', async () => {
    for (const ten of ['admin', 'giamdoc', 'quanly', 'hr', 'nhanvien']) {
      expect((await goi('get', '/troLyAi/phien', token[ten])).body.data.length).toBeGreaterThan(0);
    }
  });

  test('tạo phiên: mặc định tiêu đề, có tiêu đề thì dùng; quá 150 ký tự 400', async () => {
    expect((await taoPhien(token.nhanvien)).tieuDePhien).toBe(TIEU_DE_MAC_DINH);
    expect((await taoPhien(token.nhanvien, '  Hỏi lương  ')).tieuDePhien).toBe('Hỏi lương');
    expect((await goi('post', '/troLyAi/phien', token.nhanvien).send({ tieuDePhien: 'a'.repeat(151) })).status).toBe(400);
  });

  test('đổi tên, xóa phiên của mình; phiên người khác 404 và không bị đổi', async () => {
    const phien = await taoPhien(token.nhanvien);
    const r1 = await goi('patch', `/troLyAi/phien/${phien.id}`, token.nhanvien).send({ tieuDePhien: 'Tên mới' });
    expect(r1.status).toBe(200);
    expect(r1.body.data.tieuDePhien).toBe('Tên mới');

    expect((await goi('patch', `/troLyAi/phien/${phien.id}`, token.nhanvien2).send({ tieuDePhien: 'X' })).status).toBe(404);
    expect((await goi('delete', `/troLyAi/phien/${phien.id}`, token.hr)).status).toBe(404);
    expect((await goi('get', `/troLyAi/phien/${phien.id}/tinNhan`, token.admin)).status).toBe(404);
    const [[con]] = await pool.execute('SELECT tieuDePhien FROM phientrochuyenai WHERE id = ?', [phien.id]);
    expect(con.tieuDePhien).toBe('Tên mới');

    aiChay();
    const r2 = await goi('delete', `/troLyAi/phien/${phien.id}`, token.nhanvien);
    expect(r2.status).toBe(200);
    expect(goiAi).toHaveBeenCalledWith(`/noiBo/lichSu/${phien.id}`, { method: 'DELETE' });
    expect(await demPhienMoi()).toBe(0);
  });

  test('xóa phiên khi ai-service tắt vẫn xóa bản ghi', async () => {
    const phien = await taoPhien(token.hr);
    expect((await goi('delete', `/troLyAi/phien/${phien.id}`, token.hr)).status).toBe(200);
    expect(await demPhienMoi()).toBe(0);
  });

  test('dữ liệu sai: tiêu đề trống 400, id sai 400, không tồn tại 404, chưa đăng nhập 401', async () => {
    const phien = await taoPhien(token.nhanvien);
    expect((await goi('patch', `/troLyAi/phien/${phien.id}`, token.nhanvien).send({ tieuDePhien: '   ' })).status).toBe(400);
    expect((await goi('delete', '/troLyAi/phien/abc', token.nhanvien)).status).toBe(400);
    expect((await goi('delete', '/troLyAi/phien/999999', token.nhanvien)).status).toBe(404);
    expect((await goi('get', '/troLyAi/phien')).status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
describe('GET /troLyAi/phien/:id/tinNhan', () => {
  test('gửi dauPhien (nguoiDungId|thoiGianTao) để ai-service không lẫn lịch sử phiên cũ cùng id', async () => {
    aiChay();
    const phien = await taoPhien(token.nhanvien);
    const res = await goi('get', `/troLyAi/phien/${phien.id}/tinNhan`, token.nhanvien);
    expect(res.status).toBe(200);
    expect(res.body.data.phien.id).toBe(phien.id);
    expect(res.body.data.tinNhan).toHaveLength(1);
    const dau = layDauPhien({ nguoiDungId: 5, thoiGianTao: phien.thoiGianTao });
    expect(goiAi).toHaveBeenCalledWith(`/noiBo/lichSu/${phien.id}?dauPhien=${encodeURIComponent(dau)}`);
  });

  test('ai-service tắt → 503 thân thiện', async () => {
    const phien = await taoPhien(token.nhanvien);
    const res = await goi('get', `/troLyAi/phien/${phien.id}/tinNhan`, token.nhanvien);
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ success: false, message: aiClientService.THONG_BAO_KHONG_KHA_DUNG, data: null });
  });
});

// ---------------------------------------------------------------------------
describe('POST /troLyAi/hoiDap', () => {
  test.each(['admin', 'giamdoc', 'quanly', 'hr', 'nhanvien'])('%s hỏi không kèm phiên: tạo phiên tiêu đề = câu hỏi', async (ten) => {
    aiChay();
    const res = await goi('post', '/troLyAi/hoiDap', token[ten]).send({ cauHoi: '  Nghỉ kết hôn\n được mấy ngày?  ' });
    expect(res.status).toBe(200);
    expect(res.body.data.phien.tieuDePhien).toBe('Nghỉ kết hôn được mấy ngày?');
    expect(res.body.data).toMatchObject({ traLoi: TRA_LOI.traLoi, cheDo: 'LLM' });
    const [[p]] = await pool.execute('SELECT nguoiDungId FROM phientrochuyenai WHERE id = ?', [res.body.data.phien.id]);
    expect(p.nguoiDungId).toBe(NGUOI_DUNG_ID[ten]);

    const [, tuyChon] = goiAi.mock.calls.find(([d]) => d === '/noiBo/troLy/xuLy');
    expect(tuyChon.body).toMatchObject({ phienId: res.body.data.phien.id, cauHoi: 'Nghỉ kết hôn\n được mấy ngày?' });
    expect(tuyChon.body.dauPhien).toBe(`${NGUOI_DUNG_ID[ten]}|${res.body.data.phien.thoiGianTao}`);
    expect(tuyChon.body.taiLieuIdsHienCo).toEqual(expect.arrayContaining([1, 2, 3]));
    // hanChot: trước lúc backend ngừng chờ (AI_TIMEOUT_MS) để ai-service không ghi lịch sử câu hỏi đã báo lỗi
    const thoiGianCho = Number(process.env.AI_TIMEOUT_MS) || 30000;
    expect(tuyChon.body.hanChot).toBeGreaterThan(Date.now() + thoiGianCho - 10000);
    expect(tuyChon.body.hanChot).toBeLessThan(Date.now() + thoiGianCho);
  });

  test('nguồn của tài liệu không còn trong CSDL bị lọc khỏi trích dẫn', async () => {
    aiChay();
    const res = await goi('post', '/troLyAi/hoiDap', token.nhanvien).send({ cauHoi: 'Nghỉ kết hôn?' });
    expect(res.body.data.nguonTrichDan.map((n) => n.maTaiLieu)).toEqual(['QC-NGHIPHEP']);
  });

  test('hỏi trong phiên có sẵn: phiên mặc định đổi tiêu đề theo câu hỏi, phiên đã đặt tên giữ nguyên', async () => {
    aiChay();
    const macDinh = await taoPhien(token.nhanvien);
    const r1 = await goi('post', '/troLyAi/hoiDap', token.nhanvien).send({ phienId: macDinh.id, cauHoi: 'Ngày trả lương?' });
    expect(r1.status).toBe(200);
    expect(r1.body.data.phien).toMatchObject({ id: macDinh.id, tieuDePhien: 'Ngày trả lương?' });

    const coTen = await taoPhien(token.nhanvien, 'Lương');
    const r2 = await goi('post', '/troLyAi/hoiDap', token.nhanvien).send({ phienId: String(coTen.id), cauHoi: 'Thưởng Tết?' });
    expect(r2.body.data.phien.tieuDePhien).toBe('Lương');
    expect(await demPhienMoi()).toBe(2);
  });

  test('câu hỏi dài: tiêu đề cắt còn 150 ký tự', async () => {
    aiChay();
    const res = await goi('post', '/troLyAi/hoiDap', token.nhanvien).send({ cauHoi: 'ầ'.repeat(300) });
    const tieuDe = res.body.data.phien.tieuDePhien;
    expect(Array.from(tieuDe)).toHaveLength(150);
    expect(tieuDe.endsWith('…')).toBe(true);
  });

  test('phiên của người khác 404, không gọi ai-service', async () => {
    aiChay();
    const phien = await taoPhien(token.nhanvien);
    const res = await goi('post', '/troLyAi/hoiDap', token.nhanvien2).send({ phienId: phien.id, cauHoi: 'x?' });
    expect(res.status).toBe(404);
    expect(goiAi).not.toHaveBeenCalled();
  });

  test('ai-service tắt → 503, phiên vừa tạo được xóa lại; phiên có sẵn giữ nguyên', async () => {
    const res = await goi('post', '/troLyAi/hoiDap', token.nhanvien).send({ cauHoi: 'Giờ làm việc?' });
    expect(res.status).toBe(503);
    expect(res.body.message).toBe(aiClientService.THONG_BAO_KHONG_KHA_DUNG);
    expect(await demPhienMoi()).toBe(0);

    const phien = await taoPhien(token.nhanvien);
    expect((await goi('post', '/troLyAi/hoiDap', token.nhanvien).send({ phienId: phien.id, cauHoi: 'x?' })).status).toBe(503);
    const [[con]] = await pool.execute('SELECT tieuDePhien FROM phientrochuyenai WHERE id = ?', [phien.id]);
    expect(con.tieuDePhien).toBe(TIEU_DE_MAC_DINH);
  });

  test.each([
    ['thiếu câu hỏi', {}],
    ['câu hỏi rỗng', { cauHoi: '   ' }],
    ['câu hỏi quá 1000 ký tự', { cauHoi: 'a'.repeat(1001) }],
    ['phienId sai', { phienId: 'abc', cauHoi: 'x' }],
    ['phienId 0', { phienId: 0, cauHoi: 'x' }],
  ])('dữ liệu sai (%s) → 400, không gọi ai-service', async (_, body) => {
    aiChay();
    const res = await goi('post', '/troLyAi/hoiDap', token.nhanvien).send(body);
    expect(res.status).toBe(400);
    expect(goiAi).not.toHaveBeenCalled();
    expect(await demPhienMoi()).toBe(0);
  });

  test('giới hạn 20 câu hỏi/phút/người: câu thứ 21 → 429, người khác vẫn hỏi được', async () => {
    aiChay();
    const phien = await taoPhien(token.nhanvien);
    for (let i = 0; i < 20; i += 1) {
      expect((await goi('post', '/troLyAi/hoiDap', token.nhanvien).send({ phienId: phien.id, cauHoi: `Câu ${i}` })).status).toBe(200);
    }
    const res = await goi('post', '/troLyAi/hoiDap', token.nhanvien).send({ phienId: phien.id, cauHoi: 'Câu 21' });
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ success: false, code: 429 });
    expect((await goi('post', '/troLyAi/hoiDap', token.nhanvien2).send({ cauHoi: 'Tôi hỏi' })).status).toBe(200);
  });

  test('chưa đăng nhập 401', async () => {
    expect((await goi('post', '/troLyAi/hoiDap').send({ cauHoi: 'x' })).status).toBe(401);
  });

  test('hỏi trong phiên đã xóa → 404, không gọi ai-service hỏi đáp, không tạo phiên mới', async () => {
    aiChay();
    const phien = await taoPhien(token.nhanvien);
    expect((await goi('delete', `/troLyAi/phien/${phien.id}`, token.nhanvien)).status).toBe(200);
    goiAi.mockClear();
    const res = await goi('post', '/troLyAi/hoiDap', token.nhanvien).send({ phienId: phien.id, cauHoi: 'x?' });
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: 404, data: null });
    expect(goiAi).not.toHaveBeenCalled();
    expect(await demPhienMoi()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('Bổ sung QA 5.4: cô lập phiên và giới hạn tiêu đề', () => {
  test.each(['admin', 'giamdoc', 'quanly', 'hr'])('%s không xem/đổi/xóa/hỏi được phiên của nhanVien (404)', async (ten) => {
    aiChay();
    const phien = await taoPhien(token.nhanvien, 'Riêng tư');
    expect((await goi('get', `/troLyAi/phien/${phien.id}/tinNhan`, token[ten])).status).toBe(404);
    expect((await goi('patch', `/troLyAi/phien/${phien.id}`, token[ten]).send({ tieuDePhien: 'Bị đổi' })).status).toBe(404);
    expect((await goi('delete', `/troLyAi/phien/${phien.id}`, token[ten])).status).toBe(404);
    expect((await goi('post', '/troLyAi/hoiDap', token[ten]).send({ phienId: phien.id, cauHoi: 'x?' })).status).toBe(404);
    expect(goiAi).not.toHaveBeenCalled();
    const [[con]] = await pool.execute('SELECT tieuDePhien, nguoiDungId FROM phientrochuyenai WHERE id = ?', [phien.id]);
    expect(con).toEqual({ tieuDePhien: 'Riêng tư', nguoiDungId: NGUOI_DUNG_ID.nhanvien });
  });

  test('nhanVien không thấy phiên của Admin trong danh sách và không mở được (404)', async () => {
    const phien = await taoPhien(token.admin, 'Phiên admin');
    const ds = await goi('get', '/troLyAi/phien', token.nhanvien);
    expect(ds.body.data.map((p) => p.id)).not.toContain(phien.id);
    expect((await goi('get', `/troLyAi/phien/${phien.id}/tinNhan`, token.nhanvien)).status).toBe(404);
  });

  test('xóa phiên rồi GET tinNhan → 404', async () => {
    aiChay();
    const phien = await taoPhien(token.hr);
    expect((await goi('delete', `/troLyAi/phien/${phien.id}`, token.hr)).status).toBe(200);
    const res = await goi('get', `/troLyAi/phien/${phien.id}/tinNhan`, token.hr);
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: 404, data: null });
  });

  test('PATCH tiêu đề đúng 150 ký tự OK, 151 ký tự → 400 và không đổi', async () => {
    const phien = await taoPhien(token.nhanvien, 'Ban đầu');
    const dung = 'ầ'.repeat(150);
    const r1 = await goi('patch', `/troLyAi/phien/${phien.id}`, token.nhanvien).send({ tieuDePhien: dung });
    expect(r1.status).toBe(200);
    expect(r1.body.data.tieuDePhien).toBe(dung);
    const r2 = await goi('patch', `/troLyAi/phien/${phien.id}`, token.nhanvien).send({ tieuDePhien: 'a'.repeat(151) });
    expect(r2.status).toBe(400);
    const [[con]] = await pool.execute('SELECT tieuDePhien FROM phientrochuyenai WHERE id = ?', [phien.id]);
    expect(con.tieuDePhien).toBe(dung);
  });

  test('POST tạo phiên tiêu đề đúng 150 ký tự OK', async () => {
    expect((await taoPhien(token.quanly, 'b'.repeat(150))).tieuDePhien).toBe('b'.repeat(150));
  });
});
