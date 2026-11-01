import { useEffect } from 'react';
import { X } from 'lucide-react';
import './HopThoai.css';

// Hộp thoại (modal) chung: bấm nền tối hoặc Esc để đóng. chanTrang: các nút ở chân hộp thoại
function HopThoai({ tieuDe, onDong, children, chanTrang, rong = 520 }) {
  useEffect(() => {
    const dongKhiEsc = (e) => e.key === 'Escape' && onDong();
    document.addEventListener('keydown', dongKhiEsc);
    return () => document.removeEventListener('keydown', dongKhiEsc);
  }, [onDong]);

  return (
    <div className="nenHopThoai" onMouseDown={(e) => e.target === e.currentTarget && onDong()}>
      <div className="hopThoai the" style={{ maxWidth: rong }} role="dialog" aria-modal="true">
        <div className="dauHopThoai">
          <h2>{tieuDe}</h2>
          <button type="button" className="nutDong" onClick={onDong} aria-label="Đóng"><X size={18} /></button>
        </div>
        <div className="thanHopThoai">{children}</div>
        {chanTrang && <div className="chanHopThoai">{chanTrang}</div>}
      </div>
    </div>
  );
}

export default HopThoai;
