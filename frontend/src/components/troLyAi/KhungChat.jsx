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
];

// Khung chat: danh sách tin nhắn (tự cuộn xuống cuối) + ô nhập. Enter gửi, Shift+Enter xuống dòng.
function KhungChat({ tieuDe, tinNhan, dangTaiTin, dangGui, onGui }) {
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
            <div className="tieuDeChaoMung">Hỏi Trợ lý AI về nội quy, quy chế công ty</div>
            <div className="chuPhu">Câu trả lời chỉ dựa trên tài liệu quy chế và luôn kèm nguồn Điều/khoản.</div>
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
          <TinNhan key={t.id} tinNhan={t} />
        ))}
        {dangGui && <div className="trangThaiChat dangTraLoi">Trợ lý AI đang tra cứu quy chế...</div>}
        <div ref={cuoiDanhSach} />
      </div>
      <div className="oNhapChat">
        <textarea
          value={cauHoi}
          onChange={(e) => setCauHoi(e.target.value.slice(0, DO_DAI_TOI_DA))}
          onKeyDown={xuLyPhim}
          placeholder="Nhập câu hỏi về quy chế (Enter để gửi, Shift+Enter xuống dòng)"
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
