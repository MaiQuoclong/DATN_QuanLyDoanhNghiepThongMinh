import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronRight } from 'lucide-react';
import useBamNgoai from '../../hooks/useBamNgoai';
import './ThanhDieuHuong.css';

const SO_HIEN_THI_TOI_DA = 99;

// Chuông: badge tổng số việc + danh sách theo loại, bấm để tới trang xử lý. Dữ liệu từ useViecCanChuY (BoCucChinh).
function ChuongViecCanChuY({ dangMo, onDoi, viec }) {
  const dieuHuong = useNavigate();
  const vung = useRef(null);
  const dong = useCallback(() => onDoi(false), [onDoi]);
  useBamNgoai(vung, dangMo, dong);
  const { tongSo, items, nguonLoi, loi } = viec;

  return (
    <div className="vungPopover" ref={vung}>
      <button
        type="button"
        className="nutTienIch"
        title={tongSo ? `${tongSo} việc cần chú ý` : 'Việc cần chú ý'}
        aria-haspopup="menu"
        aria-expanded={dangMo}
        onClick={() => onDoi(!dangMo)}
      >
        <Bell size={18} />
        {tongSo > 0 && <span className="huyHieuChuong">{tongSo > SO_HIEN_THI_TOI_DA ? `${SO_HIEN_THI_TOI_DA}+` : tongSo}</span>}
      </button>
      {dangMo && (
        <div className="popoverTienIch popoverChuong the" role="menu">
          <div className="tieuDePopover">Việc cần chú ý</div>
          {items.map((m) => (
            <button
              key={m.loai}
              type="button"
              role="menuitem"
              className="mucPopover"
              onClick={() => {
                onDoi(false);
                dieuHuong(m.duongDan);
              }}
            >
              <span className="tenViec">{m.tieuDe}</span>
              <span className="soViec">{m.soLuong}</span>
              <ChevronRight size={14} />
            </button>
          ))}
          {items.length === 0 && !loi && <div className="rongPopover">Không có việc cần xử lý</div>}
          {(loi || nguonLoi.length > 0) && (
            <div className="loiPopover">Không tải được {loi ? 'danh sách' : 'một phần danh sách'}, vui lòng thử lại sau</div>
          )}
        </div>
      )}
    </div>
  );
}

export default ChuongViecCanChuY;
