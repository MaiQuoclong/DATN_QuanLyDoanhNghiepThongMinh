import { useState } from 'react';
import { Send } from 'lucide-react';
import goiApi from '../../services/goiApi';
import BangDuLieu from '../../components/BangDuLieu';
import NutBam from '../../components/NutBam';
import BieuDoKetQua from '../../components/baoCaoAi/BieuDoKetQua';

// Báo cáo AI tốn 1-2 lần gọi LLM + 1 truy vấn: chờ lâu hơn mặc định 10s của goiApi (backend tự cắt ở AI_TIMEOUT_MS)
const THOI_GIAN_CHO_BAO_CAO = 40000;

const GOI_Y = [
  'Số nhân viên đang làm việc theo từng phòng ban',
  'Số đơn nghỉ phép đang chờ duyệt theo phòng ban',
  'Top 10 nhân viên đi muộn nhiều nhất tháng này',
  'Điểm KPI trung bình theo kỳ đánh giá',
];

// Tab Báo cáo dữ liệu (Text-to-SQL): giamDoc, HR toàn công ty; quanLy chỉ phòng ban mình phụ trách (backend giới hạn)
function TrangBaoCaoAi() {
  const [cauHoi, setCauHoi] = useState('');
  const [dangGui, setDangGui] = useState(false);
  const [ketQua, setKetQua] = useState(null);
  const [cauHoiDaGui, setCauHoiDaGui] = useState('');
  const [loi, setLoi] = useState('');
  const [hienSql, setHienSql] = useState(false);

  const gui = async (noiDung = cauHoi) => {
    const cauHoiGon = noiDung.trim();
    if (cauHoiGon.length < 5 || dangGui) return;
    setDangGui(true);
    setLoi('');
    try {
      const kq = await goiApi.post('/baoCaoAi/truyVan', { cauHoi: cauHoiGon }, { timeout: THOI_GIAN_CHO_BAO_CAO });
      setKetQua(kq.data);
      setCauHoiDaGui(cauHoiGon);
      setHienSql(false);
    } catch (e) {
      setKetQua(null);
      setLoi(e.message);
    } finally {
      setDangGui(false);
    }
  };

  const cot = (ketQua?.cot ?? []).map((c, i) => ({ khoa: String(i), tieuDe: c.ten, canPhai: c.kieu === 'SO' }));
  const duLieu = (ketQua?.dong ?? []).map((d, i) => ({ _stt: i, ...Object.fromEntries(d.map((gt, j) => [String(j), gt ?? '—'])) }));

  return (
    <div>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Báo cáo dữ liệu bằng AI</h1>
          <div className="chuPhu">Đặt câu hỏi bằng tiếng Việt, AI lập truy vấn chỉ đọc (tối đa 200 dòng) và vẽ biểu đồ khi phù hợp</div>
        </div>
      </div>

      <form
        className="the"
        style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}
        onSubmit={(e) => {
          e.preventDefault();
          gui();
        }}
      >
        <input
          style={{ flex: '1 1 260px', minWidth: 0 }}
          value={cauHoi}
          maxLength={500}
          placeholder="VD: Số ngày nghỉ phép đã dùng theo phòng ban năm nay"
          onChange={(e) => setCauHoi(e.target.value)}
          disabled={dangGui}
        />
        <NutBam type="submit" bieuTuong={Send} disabled={dangGui || cauHoi.trim().length < 5}>
          {dangGui ? 'Đang lập báo cáo...' : 'Lập báo cáo'}
        </NutBam>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: '100%' }}>
          {GOI_Y.map((g) => (
            <NutBam
              key={g}
              type="button"
              bienThe="ma"
              disabled={dangGui}
              onClick={() => {
                setCauHoi(g);
                gui(g);
              }}
            >
              {g}
            </NutBam>
          ))}
        </div>
      </form>

      {loi && <div className="thongBao loi">{loi}</div>}

      {ketQua && ketQua.loaiPhanHoi !== 'KET_QUA' && (
        <div className={`thongBao ${ketQua.loaiPhanHoi === 'DU_PHONG' ? 'canhBao' : 'loi'}`}>
          {ketQua.lyDo || 'Không lập được báo cáo cho câu hỏi này'}
        </div>
      )}

      {ketQua?.loaiPhanHoi === 'KET_QUA' && (
        <>
          <div className="chuPhu" style={{ marginBottom: 12 }}>
            <strong>{cauHoiDaGui}</strong>
            {ketQua.giaiThich && <> · {ketQua.giaiThich}</>} · {ketQua.soDong} dòng
            {ketQua.biCatBot && ' (đã cắt bớt, hãy thu hẹp câu hỏi để xem đủ)'}
            {ketQua.phamVi === 'PHONG_BAN' && ' · phạm vi: phòng ban bạn phụ trách'}
          </div>
          <BieuDoKetQua bieuDo={ketQua.bieuDo} cot={ketQua.cot} dong={ketQua.dong} />
          <BangDuLieu cot={cot} duLieu={duLieu} khoaDong="_stt" thongBaoRong="Không có dữ liệu phù hợp" />
        </>
      )}

      {ketQua?.sql && (
        <div style={{ marginTop: 12 }}>
          <NutBam type="button" bienThe="ma" onClick={() => setHienSql((h) => !h)}>
            {hienSql ? 'Ẩn câu SQL' : 'Xem câu SQL đã chạy'}
          </NutBam>
          {hienSql && (
            <pre className="the" style={{ padding: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13 }}>
              {ketQua.sql}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export default TrangBaoCaoAi;
