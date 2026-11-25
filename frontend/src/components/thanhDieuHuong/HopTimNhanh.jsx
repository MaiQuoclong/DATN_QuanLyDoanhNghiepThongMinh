import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft } from 'lucide-react';
import { useXacThuc } from '../../context/NguCanhXacThuc';
import { layMucTimKiem } from '../../config/danhSachMenu';
import { layThaoTacDuocDung } from '../../config/thaoTacNhanh';
import { khopTuKhoa } from '../../utils/timKiem';
import useBamNgoai from '../../hooks/useBamNgoai';
import './ThanhDieuHuong.css';

const SO_KET_QUA_TOI_DA = 8;

// Hộp Tìm nhanh chức năng (nút kính lúp, phím / hoặc Ctrl+K): chỉ gồm trang/tab và thao tác người dùng có quyền
function HopTimNhanh({ onDong }) {
  const { nguoiDung } = useXacThuc();
  const dieuHuong = useNavigate();
  const vung = useRef(null);
  const [tuKhoa, setTuKhoa] = useState('');
  const [chon, setChon] = useState(0);
  useBamNgoai(vung, true, onDong);

  const tatCa = useMemo(
    () => [
      ...layMucTimKiem(nguoiDung.vaiTro),
      ...layThaoTacDuocDung(nguoiDung).map((t) => ({ ten: t.ten, nhom: 'Tạo nhanh', duongDan: t.duongDan, bieuTuong: t.bieuTuong })),
    ],
    [nguoiDung],
  );
  const ketQua = tatCa.filter((m) => khopTuKhoa(`${m.nhom} ${m.ten}`, tuKhoa)).slice(0, SO_KET_QUA_TOI_DA);
  const viTriChon = Math.min(chon, Math.max(ketQua.length - 1, 0));

  const mo = (m) => {
    onDong();
    dieuHuong(m.duongDan);
  };
  const khiPhim = (e) => {
    // Esc chỉ đóng hộp tìm, không lan tới hộp thoại của trang bên dưới
    if (e.key === 'Escape') {
      e.preventDefault();
      e.nativeEvent.stopImmediatePropagation();
      onDong();
      return;
    }
    if (!ketQua.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setChon((viTriChon + (e.key === 'ArrowDown' ? 1 : ketQua.length - 1)) % ketQua.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      mo(ketQua[viTriChon]);
    }
  };

  return (
    <div className="lopPhuTimNhanh">
      <div className="hopTimNhanh the" ref={vung} role="dialog" aria-label="Tìm nhanh chức năng">
        <div className="oTimNhanh">
          <Search size={18} />
          <input
            autoFocus
            value={tuKhoa}
            placeholder="Tìm chức năng, ví dụ: duyet don, bang luong..."
            onChange={(e) => {
              setTuKhoa(e.target.value);
              setChon(0);
            }}
            onKeyDown={khiPhim}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="ketQuaTimNhanh">
          {ketQua.length === 0 && <div className="rongPopover">Không tìm thấy chức năng phù hợp</div>}
          {ketQua.map((m, i) => {
            const BieuTuong = m.bieuTuong;
            return (
              <button
                key={`${m.nhom}-${m.duongDan}`}
                type="button"
                className={i === viTriChon ? 'mucPopover dangChon' : 'mucPopover'}
                onMouseEnter={() => setChon(i)}
                onClick={() => mo(m)}
              >
                <BieuTuong size={16} />
                <span className="nhomKetQua">{m.nhom}</span>
                {m.nhom !== m.ten && <span>› {m.ten}</span>}
                {i === viTriChon && <CornerDownLeft size={14} className="phimEnter" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default HopTimNhanh;
