const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/ketNoiCsdl');
const aiClientService = require('../src/services/aiClientService');
const LoiUngDung = require('../src/utils/LoiUngDung');
const { gioiHanBaoCao } = require('../src/routes/baoCaoAiRoutes');

// Báo cáo AI (5.6). ai-service luôn mock: Express chỉ tính phạm vi + ghi nhật ký, không chạy SQL do LLM sinh.
// Seed: quanly (nguoiDungId 3) làm trưởng Phòng Kỹ thuật (id 3) có phòng con Nhóm Phát triển (id 4).
// Mỗi test dọn nhật ký AI_TEXT_TO_SQL theo mốc MAX(id).
const MAT_KHAU = 'MatKhau@123';
const NGUOI_DUNG_ID = { admin: 1, giamdoc: 2, quanly: 3, hr: 4, nhanvien: 5 };
const token = {};
let mocNhatKy;
let goiAi;

const guiCauHoi = (tk, body) => request(app).post('/api/v1/baoCaoAi/truyVan').set('Authorization', `Bearer ${tk}`).send(body);

const KET_QUA = {
  loaiPhanHoi: 'KET_QUA',
  sql: 'SELECT 1 LIMIT 200',
  cot: [
    { ten: 'tenPhongBan', kieu: 'CHU' },
    { ten: 'soNhanVien', kieu: 'SO' },
  ],
  dong: [['Phòng Kỹ thuật', 2]],
  soDong: 1,
  biCatBot: false,
  bieuDo: { loai: 'COT', x: 'tenPhongBan', y: ['soNhanVien'] },
  giaiThich: 'Đếm nhân viên',
  lyDo: null,
};

async function layNhatKyMoi() {
  const [dong] = await pool.execute(
    "SELECT nguoiDungId, diaChiIP, chiTiet FROM nhatkyhethong WHERE id > ? AND hanhDong = 'AI_TEXT_TO_SQL' ORDER BY id",
    [mocNhatKy],
  );
  return dong.map((d) => ({ ...d, chiTiet: JSON.parse(d.chiTiet) }));
}

beforeAll(async () => {
  for (const ten of Object.keys(NGUOI_DUNG_ID)) {
    const res = await request(app).post('/api/v1/xacThuc/dangNhap').set('X-Tra-Token', '1').send({ tenDangNhap: ten, matKhau: MAT_KHAU });
    expect(res.status).toBe(200);
    token[ten] = res.body.data.token;
  }
});

beforeEach(async () => {
  mocNhatKy = (await pool.query('SELECT COALESCE(MAX(id), 0) AS m FROM nhatkyhethong'))[0][0].m;
  goiAi = jest.spyOn(aiClientService, 'goiAiService').mockResolvedValue(KET_QUA);
  for (const id of Object.values(NGUOI_DUNG_ID)) await gioiHanBaoCao.resetKey(`nguoiDung:${id}`);
});

afterEach(async () => {
  goiAi.mockRestore();
  await pool.execute('DELETE FROM nhatkyhethong WHERE id > ?', [mocNhatKy]);
  await pool.query('ALTER TABLE nhatkyhethong AUTO_INCREMENT = 1');
});

afterAll(async () => {
  await pool.end();
});

describe('POST /baoCaoAi/truyVan – phân quyền và phạm vi', () => {
  test.each(['admin', 'nhanvien'])('%s → 403, không gọi ai-service', async (ten) => {
    const res = await guiCauHoi(token[ten], { cauHoi: 'Số nhân viên theo phòng ban' });
    expect(res.status).toBe(403);
    expect(goiAi).not.toHaveBeenCalled();
  });

  test('chưa đăng nhập → 401', async () => {
    const res = await request(app).post('/api/v1/baoCaoAi/truyVan').send({ cauHoi: 'Số nhân viên' });
    expect(res.status).toBe(401);
  });

  test.each(['giamdoc', 'hr'])('%s → phạm vi TOAN_CONG_TY', async (ten) => {
    const res = await guiCauHoi(token[ten], { cauHoi: '  Số nhân viên theo phòng ban  ' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ loaiPhanHoi: 'KET_QUA', phamVi: 'TOAN_CONG_TY', soDong: 1 });
    const [duongDan, tuyChon] = goiAi.mock.calls[0];
    expect(duongDan).toBe('/noiBo/baoCao/truyVan');
    expect(tuyChon.body).toMatchObject({ cauHoi: 'Số nhân viên theo phòng ban', cheDoPhamVi: 'TOAN_CONG_TY', phongBanIds: [] });
    expect(tuyChon.body.ngayHienTai).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(tuyChon.body.hanChot).toBeGreaterThan(Date.now());
  });

  test('quanly → PHONG_BAN với phòng mình làm trưởng + phòng con', async () => {
    const res = await guiCauHoi(token.quanly, { cauHoi: 'Danh sách nhân viên phòng tôi' });
    expect(res.status).toBe(200);
    expect(res.body.data.phamVi).toBe('PHONG_BAN');
    const { body } = goiAi.mock.calls[0][1];
    expect(body.cheDoPhamVi).toBe('PHONG_BAN');
    expect([...body.phongBanIds].sort()).toEqual([3, 4]);
  });

  test('QA: quanLy kiêm HR hoặc kiêm giamDoc → TOAN_CONG_TY (lấy phạm vi rộng nhất)', async () => {
    const { tinhPhamVi } = require('../src/services/baoCaoAiService');
    for (const vaiTro of [
      ['quanLy', 'HR'],
      ['giamDoc', 'quanLy'],
    ]) {
      expect(await tinhPhamVi({ vaiTro, nhanVienId: 3 })).toEqual({ cheDoPhamVi: 'TOAN_CONG_TY', phongBanIds: [] });
    }
  });

  test('QA: quanLy không có hồ sơ nhân viên → PHONG_BAN rỗng', async () => {
    const { tinhPhamVi } = require('../src/services/baoCaoAiService');
    expect(await tinhPhamVi({ vaiTro: ['quanLy'], nhanVienId: null })).toEqual({ cheDoPhamVi: 'PHONG_BAN', phongBanIds: [] });
  });

  test('quanLy không phụ trách phòng nào → TU_CHOI, không gọi ai-service, vẫn ghi nhật ký', async () => {
    const [[pb]] = await pool.query(
      'SELECT id, truongBoPhanId FROM phongban WHERE truongBoPhanId = (SELECT id FROM nhanvien WHERE nguoiDungId = 3) LIMIT 1',
    );
    const [cacPhong] = await pool.query('SELECT id FROM phongban WHERE truongBoPhanId = ?', [pb.truongBoPhanId]);
    await pool.query('UPDATE phongban SET truongBoPhanId = NULL WHERE truongBoPhanId = ?', [pb.truongBoPhanId]);
    try {
      const res = await guiCauHoi(token.quanly, { cauHoi: 'Danh sách nhân viên phòng tôi' });
      expect(res.status).toBe(200);
      expect(res.body.data.loaiPhanHoi).toBe('TU_CHOI');
      expect(res.body.data.lyDo).toMatch(/chưa phụ trách phòng ban/);
      expect(goiAi).not.toHaveBeenCalled();
      expect((await layNhatKyMoi())[0].chiTiet.ketQua).toBe('TU_CHOI');
    } finally {
      await pool.query('UPDATE phongban SET truongBoPhanId = ? WHERE id IN (?)', [pb.truongBoPhanId, cacPhong.map((p) => p.id)]);
    }
  });
});

describe('POST /baoCaoAi/truyVan – dữ liệu, lỗi, nhật ký', () => {
  test.each([
    [{}, 'thiếu'],
    [{ cauHoi: 'abc' }, 'dưới 5 ký tự'],
    [{ cauHoi: 'a'.repeat(501) }, 'quá 500 ký tự'],
  ])('câu hỏi %j (%s) → 400', async (body) => {
    const res = await guiCauHoi(token.hr, body);
    expect(res.status).toBe(400);
    expect(goiAi).not.toHaveBeenCalled();
  });

  test('ai-service tắt → 503 thân thiện, ghi nhật ký LOI', async () => {
    goiAi.mockRejectedValue(new LoiUngDung(503, aiClientService.THONG_BAO_KHONG_KHA_DUNG));
    const res = await guiCauHoi(token.giamdoc, { cauHoi: 'Số nhân viên theo phòng' });
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ success: false, data: null });
    const nk = await layNhatKyMoi();
    expect(nk).toHaveLength(1);
    expect(nk[0].chiTiet.ketQua).toBe('LOI');
  });

  test('ai-service TU_CHOI → 200 kèm lý do, ghi nhật ký TU_CHOI', async () => {
    goiAi.mockResolvedValue({
      ...KET_QUA,
      loaiPhanHoi: 'TU_CHOI',
      cot: [],
      dong: [],
      soDong: 0,
      lyDo: 'Chỉ hỗ trợ truy vấn đọc dữ liệu (SELECT)',
    });
    const res = await guiCauHoi(token.hr, { cauHoi: 'Xóa toàn bộ đơn nghỉ phép' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ loaiPhanHoi: 'TU_CHOI', lyDo: 'Chỉ hỗ trợ truy vấn đọc dữ liệu (SELECT)' });
    const nk = await layNhatKyMoi();
    expect(nk[0]).toMatchObject({ nguoiDungId: NGUOI_DUNG_ID.hr });
    expect(nk[0].chiTiet).toMatchObject({ cauHoi: 'Xóa toàn bộ đơn nghỉ phép', ketQua: 'TU_CHOI', phamVi: 'TOAN_CONG_TY' });
  });

  test('KET_QUA ghi nhật ký kèm SQL và số dòng', async () => {
    await guiCauHoi(token.giamdoc, { cauHoi: 'Số nhân viên theo phòng ban' });
    const nk = await layNhatKyMoi();
    expect(nk).toHaveLength(1);
    expect(nk[0].nguoiDungId).toBe(NGUOI_DUNG_ID.giamdoc);
    expect(nk[0].chiTiet).toMatchObject({ ketQua: 'KET_QUA', soDong: 1, sql: 'SELECT 1 LIMIT 200' });
  });

  test('ai-service trả quá 200 dòng hoặc loại lạ → cắt còn 200, loại thành DU_PHONG', async () => {
    goiAi.mockResolvedValue({ ...KET_QUA, dong: Array.from({ length: 250 }, (_, i) => [`P${i}`, i]), soDong: 250, loaiPhanHoi: 'XYZ' });
    const res = await guiCauHoi(token.hr, { cauHoi: 'Liệt kê tất cả nhân viên' });
    expect(res.body.data).toMatchObject({ soDong: 200, biCatBot: true, loaiPhanHoi: 'DU_PHONG' });
    expect(res.body.data.dong).toHaveLength(200);
  });

  test('QA: ai-service trả thiếu trường → điền mặc định an toàn', async () => {
    goiAi.mockResolvedValue({ loaiPhanHoi: 'KET_QUA' });
    const res = await guiCauHoi(token.hr, { cauHoi: 'Số nhân viên theo phòng' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      loaiPhanHoi: 'KET_QUA',
      sql: null,
      cot: [],
      dong: [],
      soDong: 0,
      biCatBot: false,
      bieuDo: { loai: 'BANG', x: null, y: [] },
      phamVi: 'TOAN_CONG_TY',
    });
  });

  test('QA: ai-service trả null → DU_PHONG, không 500', async () => {
    goiAi.mockResolvedValue(null);
    const res = await guiCauHoi(token.hr, { cauHoi: 'Số nhân viên theo phòng' });
    expect(res.status).toBe(200);
    expect(res.body.data.loaiPhanHoi).toBe('DU_PHONG');
  });

  test('QA: nhật ký cắt câu hỏi 300, SQL 2000, lý do 200 ký tự', async () => {
    goiAi.mockResolvedValue({ ...KET_QUA, sql: `SELECT ${'x'.repeat(5000)}`, lyDo: 'l'.repeat(1000) });
    await guiCauHoi(token.hr, { cauHoi: 'c'.repeat(500) });
    const [nk] = await layNhatKyMoi();
    expect(nk.chiTiet.cauHoi).toHaveLength(300);
    expect(nk.chiTiet.sql).toHaveLength(2000);
    expect(nk.chiTiet.lyDo).toHaveLength(200);
  });

  test('quá 10 lượt/phút/người → 429 (người khác không bị chặn)', async () => {
    for (let i = 0; i < 10; i += 1) expect((await guiCauHoi(token.hr, { cauHoi: 'Số nhân viên' })).status).toBe(200);
    expect((await guiCauHoi(token.hr, { cauHoi: 'Số nhân viên' })).status).toBe(429);
    expect((await guiCauHoi(token.giamdoc, { cauHoi: 'Số nhân viên' })).status).toBe(200);
  });
});
