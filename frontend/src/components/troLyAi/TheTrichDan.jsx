import { useState } from 'react';
import { FileText } from 'lucide-react';

// Thẻ nguồn trích dẫn: [n] vị trí (mã tài liệu, Điều, khoản) + tiêu đề; bấm để xem đoạn trích gốc
function TheTrichDan({ nguon }) {
  const [moRong, setMoRong] = useState(false);
  return (
    <div className={`theTrichDan ${moRong ? 'moRong' : ''}`}>
      <button type="button" className="dauTrichDan" onClick={() => setMoRong((v) => !v)} aria-expanded={moRong}>
        <span className="soTrichDan">{nguon.soThuTu}</span>
        <FileText size={14} />
        <span className="viTriTrichDan">{nguon.viTri}</span>
        <span className="tieuDeTrichDan">{nguon.tieuDe}</span>
      </button>
      {moRong && <div className="doanTrich">{nguon.doanTrich}</div>}
    </div>
  );
}

export default TheTrichDan;
