import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useXacThuc } from '../../context/NguCanhXacThuc';
import { layThaoTacDuocDung } from '../../config/thaoTacNhanh';
import useBamNgoai from '../../hooks/useBamNgoai';
import './ThanhDieuHuong.css';

// Nút "+" vàng: menu thao tác tạo nhanh theo vai trò, điều hướng bằng ↑/↓/Enter
function MenuTaoNhanh({ dangMo, onDoi }) {
  const { nguoiDung } = useXacThuc();
  const dieuHuong = useNavigate();
  const vung = useRef(null);
  const dong = useCallback(() => onDoi(false), [onDoi]);
  const [chon, setChon] = useState(0);
  const thaoTac = layThaoTacDuocDung(nguoiDung);
  useBamNgoai(vung, dangMo, dong);

  const chay = (t) => {
    onDoi(false);
    dieuHuong(t.duongDan);
  };
  const khiPhim = (e) => {
    if (!dangMo || !thaoTac.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setChon((c) => (c + (e.key === 'ArrowDown' ? 1 : thaoTac.length - 1)) % thaoTac.length);
    } else if (e.key === 'Enter' && thaoTac[chon]) {
      e.preventDefault();
      chay(thaoTac[chon]);
    }
  };

  return (
    <div className="vungPopover" ref={vung} onKeyDown={khiPhim}>
      <button
        type="button"
        className="nutTienIch vang"
        title="Tạo nhanh"
        aria-haspopup="menu"
        aria-expanded={dangMo}
        onClick={() => {
          setChon(0);
          onDoi(!dangMo);
        }}
      >
        <Plus size={18} />
      </button>
      {dangMo && (
        <div className="popoverTienIch the" role="menu">
          <div className="tieuDePopover">Tạo nhanh</div>
          {thaoTac.map((t, i) => {
            const BieuTuong = t.bieuTuong;
            return (
              <button
                key={t.ma}
                type="button"
                role="menuitem"
                className={i === chon ? 'mucPopover dangChon' : 'mucPopover'}
                onMouseEnter={() => setChon(i)}
                onClick={() => chay(t)}
              >
                <BieuTuong size={16} /> {t.ten}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MenuTaoNhanh;
