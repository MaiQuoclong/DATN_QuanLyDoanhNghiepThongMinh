const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/ketNoiCsdl');
const aiClientService = require('../src/services/aiClientService');
const LoiUngDung = require('../src/utils/LoiUngDung');
const taiLieuQuyCheRepository = require('../src/repositories/taiLieuQuyCheRepository');
const phienTroChuyenRepository = require('../src/repositories/phienTroChuyenRepository');
const { gioiHanHoiDap } = require('../src/routes/troLyAiRoutes');
const { layDauPhien } = require('../src/services/troLyAiService');

// Hồi quy rà soát Module 5 (2026-11-11). Seed tài liệu 1-3: QC-NOIQUY/QC-NGHIPHEP/QC-LUONG. ai-service luôn mock.
const MAT_KHAU = 'MatKhau@123';
const THU_MUC_MAU_GOC = path.join(__dirname, '..', 'uploads', 'quyChe', 'mau');
const token = {};
const moc = {};
let thuMucTam;
let goiAi;
const aiTat = () => Promise.reject(new LoiUngDung(503, aiClientService.THONG_BAO_KHONG_KHA_DUNG));
const MD = Buffer.from('# Quy chế thử\n\nĐiều 1. Nội dung.', 'utf8');
const maMoi = () => `QA-RS-${Date.now() % 1000000}-${Math.floor(Math.random() * 1000)}`;

const goi = (phuongThuc, duongDan, tk) => request(app)[phuongThuc](`/api/v1${duongDan}`).set('Authorization', `Bearer ${tk}`);
const taiLen = (maTaiLieu = maMoi()) =>
  goi('post', '/taiLieuQuyChe', token.hr).field('maTaiLieu', maTaiLieu).field('tieuDe', 'Quy chế QA').attach('tep', MD, 'a.md');
// Tệp ngoài thư mục mẫu (tệp tải lên + tệp tạm)
const tepTaiLen = () => fs.readdirSync(thuMucTam).filter((t) => t !== 'mau');

const nguon = (taiLieuId, maTaiLieu) => ({ soThuTu: 1, taiLieuId, maTaiLieu, tieuDe: 'x', viTri: maTaiLieu, doanTrich: '...', diem: 0.9 });
function aiHoiDap(nguonTrichDan) {
  goiAi.mockImplementation(async (duongDan, { method = 'GET' } = {}) => {
    if (duongDan === '/noiBo/troLy/xuLy' && method === 'POST') {
      return { phienId: 0, traLoi: 'Trả lời [1].', nguonTrichDan, cheDo: 'LLM', thoiGian: '2026-11-11T02:00:00+00:00' };
    }
    throw new Error(`Gọi ai-service ngoài dự kiến: ${method} ${duongDan}`);
  });
}

beforeAll(async () => {
  for (const ten of ['hr', 'nhanvien']) {
    const res = await request(app).post('/api/v1/xacThuc/dangNhap').set('X-Tra-Token', '1').send({ tenDangNhap: ten, matKhau: MAT_KHAU });
    expect(res.status).toBe(200);
    token[ten] = res.body.data.token;
  }
});

beforeEach(async () => {
  for (const bang of ['tailieuquyche', 'nhatkyhethong', 'phientrochuyenai']) {
    moc[bang] = (await pool.query(`SELECT COALESCE(MAX(id), 0) AS m FROM ${bang}`))[0][0].m;
  }
  thuMucTam = fs.mkdtempSync(path.join(os.tmpdir(), 'qaRaSoat5-'));
  fs.cpSync(THU_MUC_MAU_GOC, path.join(thuMucTam, 'mau'), { recursive: true });
  process.env.THU_MUC_TAI_LIEU = thuMucTam;
  goiAi = jest.spyOn(aiClientService, 'goiAiService').mockImplementation(aiTat);
  await gioiHanHoiDap.resetKey('nguoiDung:5');
});

afterEach(async () => {
  jest.restoreAllMocks();
  for (const bang of ['tailieuquyche', 'nhatkyhethong', 'phientrochuyenai']) {
    await pool.execute(`DELETE FROM ${bang} WHERE id > ?`, [moc[bang]]);
    await pool.query(`ALTER TABLE ${bang} AUTO_INCREMENT = 1`);
  }
  delete process.env.THU_MUC_TAI_LIEU;
  fs.rmSync(thuMucTam, { recursive: true, force: true });
});

afterAll(async () => {
  await pool.end();
});

// ---------------------------------------------------------------------------
describe('TB1: khớp tài liệu theo cả id và maTaiLieu', () => {
  test('repository layTatCaIdVaMa trả đúng cặp id-mã của seed', async () => {
    const ds = await taiLieuQuyCheRepository.layTatCaIdVaMa();
    expect(ds).toEqual(expect.arrayContaining([expect.objectContaining({ id: 2, maTaiLieu: 'QC-NGHIPHEP' })]));
  });

  test('hỏi đáp gửi taiLieuHienCo; nguồn đúng id nhưng khác mã trong CSDL bị lọc', async () => {
    aiHoiDap([nguon(2, 'QC-NGHIPHEP'), { ...nguon(3, 'QC-MA-CU'), soThuTu: 2 }]);
    const res = await goi('post', '/troLyAi/hoiDap', token.nhanvien).send({ cauHoi: 'Nghỉ kết hôn?' });
    expect(res.status).toBe(200);
    expect(res.body.data.nguonTrichDan.map((n) => `${n.taiLieuId}|${n.maTaiLieu}`)).toEqual(['2|QC-NGHIPHEP']);
    const [, tuyChon] = goiAi.mock.calls.find(([d]) => d === '/noiBo/troLy/xuLy');
    expect(tuyChon.body.taiLieuHienCo).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 2, maTaiLieu: 'QC-NGHIPHEP' }),
        expect.objectContaining({ id: 3, maTaiLieu: 'QC-LUONG' }),
      ]),
    );
    expect(tuyChon.body.taiLieuIdsHienCo).toEqual(expect.arrayContaining([1, 2, 3]));
  });

  test('lập chỉ mục gửi kèm taiLieuHienCo', async () => {
    goiAi.mockResolvedValue({ soDoan: 3, soDieu: 2, theoDieuKhoan: true });
    const res = await goi('post', '/taiLieuQuyChe/1/lapChiMuc', token.hr);
    expect(res.status).toBe(200);
    const [duongDan, tuyChon] = goiAi.mock.calls[0];
    expect(duongDan).toBe('/noiBo/rag/lapChiMuc');
    expect(tuyChon.body.taiLieuHienCo).toEqual(expect.arrayContaining([expect.objectContaining({ id: 1, maTaiLieu: 'QC-NOIQUY' })]));
  });

  test('tải lên mà lập chỉ mục lỗi: gọi DELETE chỉ mục cũ cùng id, vẫn 201 kèm canhBao', async () => {
    goiAi.mockImplementation(async (duongDan, { method = 'GET' } = {}) => {
      if (method === 'DELETE') return { soDoanDaXoa: 0 };
      throw new LoiUngDung(503, aiClientService.THONG_BAO_KHONG_KHA_DUNG);
    });
    const res = await taiLen();
    expect(res.status).toBe(201);
    expect(res.body.data.canhBao).toMatch(/chưa lập được chỉ mục/);
    expect(goiAi).toHaveBeenCalledWith(`/noiBo/rag/taiLieu/${res.body.data.id}`, { method: 'DELETE' });
  });

  test('tải lên: lập chỉ mục lỗi và DELETE cũng lỗi vẫn 201 kèm canhBao', async () => {
    const res = await taiLen();
    expect(res.status).toBe(201);
    expect(res.body.data.canhBao).toBeTruthy();
    expect(goiAi.mock.calls.some(([d, t]) => d === `/noiBo/rag/taiLieu/${res.body.data.id}` && t?.method === 'DELETE')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('N1: lỗi bước phụ sau khi ai-service đã trả lời không làm hỏng câu trả lời', () => {
  test('doiTieuDe ném lỗi → vẫn 200', async () => {
    aiHoiDap([nguon(2, 'QC-NGHIPHEP')]);
    const tao = await goi('post', '/troLyAi/phien', token.nhanvien).send({});
    expect(tao.status).toBe(201);
    jest.spyOn(phienTroChuyenRepository, 'doiTieuDe').mockRejectedValue(new Error('CSDL lỗi giả lập'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await goi('post', '/troLyAi/hoiDap', token.nhanvien).send({ phienId: tao.body.data.id, cauHoi: 'Ngày trả lương?' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ traLoi: 'Trả lời [1].', phien: { id: tao.body.data.id } });
  });

  test('đọc lại danh sách tài liệu lỗi → vẫn 200, lọc theo danh sách lần đầu', async () => {
    aiHoiDap([nguon(2, 'QC-NGHIPHEP'), { ...nguon(999, 'QC-DAXOA'), soThuTu: 2 }]);
    const goc = taiLieuQuyCheRepository.layTatCaIdVaMa;
    let lan = 0;
    jest.spyOn(taiLieuQuyCheRepository, 'layTatCaIdVaMa').mockImplementation(async () => {
      lan += 1;
      if (lan === 1) return goc();
      throw new Error('CSDL lỗi giả lập');
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await goi('post', '/troLyAi/hoiDap', token.nhanvien).send({ cauHoi: 'Nghỉ kết hôn?' });
    expect(res.status).toBe(200);
    expect(lan).toBe(2);
    expect(res.body.data.nguonTrichDan.map((n) => n.maTaiLieu)).toEqual(['QC-NGHIPHEP']);
  });
});

// ---------------------------------------------------------------------------
describe('N2: layDauPhien', () => {
  test('cắt thoiGianTao còn 19 ký tự', () => {
    expect(layDauPhien({ nguoiDungId: 4, thoiGianTao: '2026-11-11 08:00:00.000' })).toBe('4|2026-11-11 08:00:00');
    expect(layDauPhien({ nguoiDungId: 4, thoiGianTao: '2026-11-11 08:00:00' })).toBe('4|2026-11-11 08:00:00');
  });
});

// ---------------------------------------------------------------------------
describe('N3: tải lên qua tệp tạm .tmp', () => {
  test('thành công: còn đúng 1 tệp thật, không còn tệp .tmp', async () => {
    const res = await taiLen();
    expect(res.status).toBe(201);
    const tep = tepTaiLen();
    expect(tep).toHaveLength(1);
    expect(tep[0]).toMatch(/^[0-9a-f-]{36}\.md$/);
    const [[d]] = await pool.execute('SELECT duongDanTep FROM tailieuquyche WHERE id = ?', [res.body.data.id]);
    expect(d.duongDanTep).toBe(tep[0]);
  });

  test('409 trùng mã không để lại tệp nào', async () => {
    const res = await taiLen('QC-NOIQUY');
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, code: 409, data: null });
    expect(tepTaiLen()).toEqual([]);
  });

  test('INSERT trùng mã (tải đồng thời) → 409, tệp .tmp bị xóa', async () => {
    const loi = Object.assign(new Error('Duplicate'), { code: 'ER_DUP_ENTRY' });
    jest.spyOn(taiLieuQuyCheRepository, 'them').mockRejectedValue(loi);
    const res = await taiLen();
    expect(res.status).toBe(409);
    expect(tepTaiLen()).toEqual([]);
  });

  test('đổi tên lỗi → 500, gỡ bản ghi vừa INSERT và tệp .tmp', async () => {
    jest.spyOn(fsp, 'rename').mockRejectedValue(new Error('EPERM giả lập'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const ma = maMoi();
    const res = await taiLen(ma);
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false, code: 500, data: null });
    expect(tepTaiLen()).toEqual([]);
    const [d] = await pool.execute('SELECT id FROM tailieuquyche WHERE maTaiLieu = ?', [ma]);
    expect(d).toHaveLength(0);
  });
});
