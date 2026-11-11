const http = require('http');
const { goiAiService, kiemTraSucKhoeAi, THONG_BAO_KHONG_KHA_DUNG } = require('../src/services/aiClientService');

// Máy chủ giả lập ai-service trên cổng ngẫu nhiên; mỗi test gán hàm xử lý riêng
let mayChu;
let xuLy;
let bienMoiTruongCu;

beforeAll(async () => {
  mayChu = http.createServer((req, res) => xuLy(req, res));
  await new Promise((xong) => mayChu.listen(0, '127.0.0.1', xong));
});

afterAll(() => new Promise((xong) => mayChu.close(xong)));

beforeEach(() => {
  bienMoiTruongCu = { ...process.env };
  process.env.AI_SERVICE_URL = `http://127.0.0.1:${mayChu.address().port}`;
  process.env.AI_SERVICE_KEY = 'khoa-test-dai-toi-thieu-32-ky-tu-0123456789';
  process.env.AI_TIMEOUT_MS = '300';
});

afterEach(() => {
  process.env = bienMoiTruongCu;
});

function traJson(res, code, noiDung) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(noiDung));
}

describe('aiClientService.goiAiService', () => {
  test('gửi kèm khóa nội bộ + body JSON và trả data khi thành công', async () => {
    let yeuCau;
    xuLy = (req, res) => {
      let than = '';
      req.on('data', (manh) => (than += manh));
      req.on('end', () => {
        yeuCau = { method: req.method, url: req.url, khoa: req.headers['x-khoa-noi-bo'], than: JSON.parse(than) };
        traJson(res, 200, { success: true, code: 200, message: 'ok', data: { traLoi: 'xin chào' } });
      });
    };
    const data = await goiAiService('/noiBo/thu', { method: 'POST', body: { cauHoi: 'a' } });
    expect(data).toEqual({ traLoi: 'xin chào' });
    expect(yeuCau).toEqual({ method: 'POST', url: '/noiBo/thu', khoa: process.env.AI_SERVICE_KEY, than: { cauHoi: 'a' } });
  });

  test('timeout -> 503 thân thiện', async () => {
    xuLy = (req, res) => setTimeout(() => traJson(res, 200, { success: true, data: null }), 1000);
    await expect(goiAiService('/noiBo/cham')).rejects.toMatchObject({ code: 503, message: THONG_BAO_KHONG_KHA_DUNG });
  });

  test('gửi header rồi treo body -> 503 trong thời gian chờ', async () => {
    let phanHoiTreo;
    xuLy = (req, res) => {
      phanHoiTreo = res;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write('{"success": true, "data": ');
    };
    const batDau = Date.now();
    await expect(goiAiService('/noiBo/treo')).rejects.toMatchObject({ code: 503, message: THONG_BAO_KHONG_KHA_DUNG });
    expect(Date.now() - batDau).toBeLessThan(1500);
    phanHoiTreo.end();
  });

  test('ECONNREFUSED -> 503 thân thiện', async () => {
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:1';
    await expect(goiAiService('/noiBo/x')).rejects.toMatchObject({ code: 503, message: THONG_BAO_KHONG_KHA_DUNG });
  });

  test('ai-service báo sai khóa (401) -> 503, không lộ lỗi nội bộ', async () => {
    xuLy = (req, res) => traJson(res, 401, { success: false, code: 401, message: 'Khóa nội bộ không hợp lệ', data: null });
    await expect(goiAiService('/noiBo/x')).rejects.toMatchObject({ code: 503, message: THONG_BAO_KHONG_KHA_DUNG });
  });

  test('lỗi nghiệp vụ 400 được chuyển tiếp nguyên thông báo', async () => {
    xuLy = (req, res) => traJson(res, 400, { success: false, code: 400, message: 'Tài liệu không đọc được', data: null });
    await expect(goiAiService('/noiBo/x')).rejects.toMatchObject({ code: 400, message: 'Tài liệu không đọc được' });
  });

  test('ai-service lỗi 500 hoặc trả không phải JSON -> 503', async () => {
    xuLy = (req, res) => {
      res.writeHead(500);
      res.end('loi');
    };
    await expect(goiAiService('/noiBo/x')).rejects.toMatchObject({ code: 503 });
  });
});

describe('aiClientService.kiemTraSucKhoeAi', () => {
  test('ai-service hoạt động -> HOAT_DONG kèm trạng thái LLM', async () => {
    xuLy = (req, res) => traJson(res, 200, { success: true, code: 200, data: { mayChu: 'HOAT_DONG', llm: 'DA_CAU_HINH' } });
    await expect(kiemTraSucKhoeAi()).resolves.toEqual({ ai: 'HOAT_DONG', llm: 'DA_CAU_HINH' });
  });

  test('ai-service tắt -> MAT_KET_NOI, không ném lỗi', async () => {
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:1';
    await expect(kiemTraSucKhoeAi()).resolves.toEqual({ ai: 'MAT_KET_NOI', llm: null });
  });
});
