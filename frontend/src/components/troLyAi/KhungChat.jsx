import { useEffect, useRef, useState } from 'react';
import { Bot, SendHorizontal } from 'lucide-react';
import NutBam from '../NutBam';
import TinNhan from './TinNhan';

const DO_DAI_TOI_DA = 1000;
const GOI_Y = [
  'Nghỉ kết hôn được mấy ngày?',
  'Đơn nghỉ phép dài hơn 5 ngày do ai duyệt?',
  'Đi làm muộn bị xử lý thế nào?',
  'Ngày nào trả lương hằng tháng?',
  'Tôi còn mấy ngày phép?',
  'Xin nghỉ phép năm thứ 6 tuần sau vì việc gia đình',
  'Hôm qua tôi quên check-out lúc 17:30',
];

// Khung chat: danh sách tin nhắn (tự cuộn xuống cuối) + ô nhập. Enter gửi, Shift+Enter xuống dòng.
function KhungChat({ tieuDe, tinNhan, dangTaiTin, dangGui, onGui, onXacNhanBanNhap, onHuyBanNhap }) {
  const [cauHoi, setCauHoi] = useState('');
  const cuoiDanhSach = useRef(null);

  useEffect(() => {
    cuoiDanhSach.current?.scrollIntoView({ block: 'end' });
  }, [tinNhan, dangGui]);

  const gui = async (noiDung = cauHoi) => {
    if (!noiDung.trim() || dangGui) return;
    const daGui = await onGui(noiDung);
    if (daGui) setCauHoi('');
  };

  const xuLyPhim = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      gui();
    }
  };

  return (
    <section className="khungChat the">
      <div className="dauKhungChat">{tieuDe}</div>
      <div className="dsTinNhan" aria-live="polite">
        {dangTaiTin && <div className="trangThaiChat">Đang tải tin nhắn...</div>}
        {!dangTaiTin && tinNhan.length === 0 && (
          <div className="chaoMungChat">
            <Bot size={32} />
            <div className="tieuDeChaoMung">Hỏi Trợ lý AI về quy chế, hoặc nhờ soạn đơn nghỉ phép / điều chỉnh công</div>
            <div className="chuPhu">Câu trả lời quy chế luôn kèm nguồn Điều/khoản. Đơn do AI soạn chỉ được gửi khi bạn bấm Xác nhận.</div>
            <div className="dsGoiY">
              {GOI_Y.map((g) => (
                <button key={g} type="button" className="goiY" onClick={() => gui(g)} disabled={dangGui}>
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}
        {tinNhan.map((t) => (
          <TinNhan key={t.id} tinNhan={t} onXacNhanBanNhap={onXacNhanBanNhap} onHuyBanNhap={onHuyBanNhap} />
        ))}
        {dangGui && <div className="trangThaiChat dangTraLoi">Trợ lý AI đang xử lý...</div>}
        <div ref={cuoiDanhSach} />
      </div>
      <div className="oNhapChat">
        <textarea
          value={cauHoi}
          onChange={(e) => setCauHoi(e.target.value.slice(0, DO_DAI_TOI_DA))}
          onKeyDown={xuLyPhim}
          placeholder="Hỏi về quy chế hoặc nhờ soạn đơn (Enter để gửi, Shift+Enter xuống dòng)"
          rows={2}
          maxLength={DO_DAI_TOI_DA}
          disabled={dangGui}
          aria-label="Câu hỏi cho Trợ lý AI"
        />
        <div className="chanONhap">
          <span className="chuPhu">
            {cauHoi.length}/{DO_DAI_TOI_DA}
          </span>
          <NutBam bieuTuong={SendHorizontal} onClick={() => gui()} disabled={dangGui || !cauHoi.trim()}>
            Gửi
          </NutBam>
        </div>
      </div>
    </section>
  );
}

export default KhungChat;
