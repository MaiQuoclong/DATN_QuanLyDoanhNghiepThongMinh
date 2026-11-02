import { Search, SlidersHorizontal } from 'lucide-react';
import './ThanhLoc.css';

// Thanh lọc trên bảng: ô tìm kiếm + các dropdown lọc
// boLoc: [{ khoa, nhan, luaChon: [{ giaTri, nhan }] }], giaTriLoc: { [khoa]: giaTri }
function ThanhLoc({ tuKhoa, onDoiTuKhoa, goiYTim = 'Tìm kiếm...', boLoc = [], giaTriLoc = {}, onDoiLoc, phanPhai }) {
  return (
    <div className="thanhLoc">
      <label className="oTimKiem">
        <Search size={15} />
        <input value={tuKhoa} onChange={(e) => onDoiTuKhoa(e.target.value)} placeholder={goiYTim} />
      </label>
      {boLoc.map(({ khoa, nhan, luaChon }) => (
        <select
          key={khoa}
          className="oLoc"
          value={giaTriLoc[khoa] ?? ''}
          onChange={(e) => onDoiLoc?.(khoa, e.target.value)}
        >
          <option value="">{nhan}</option>
          {luaChon.map((lc) => (
            <option key={lc.giaTri} value={lc.giaTri}>{lc.nhan}</option>
          ))}
        </select>
      ))}
      <div className="thanhLocPhai">
        {phanPhai ?? (
          <span className="locNangCao">
            <SlidersHorizontal size={14} /> Bộ lọc nâng cao
          </span>
        )}
      </div>
    </div>
  );
}

export default ThanhLoc;
