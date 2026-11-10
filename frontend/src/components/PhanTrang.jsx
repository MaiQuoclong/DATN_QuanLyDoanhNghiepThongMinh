import { ChevronLeft, ChevronRight } from 'lucide-react';
import './PhanTrang.css';

// phanTrang: { trang, kichThuoc, tongSo } theo chuẩn API
function PhanTrang({ phanTrang, onDoiTrang }) {
  if (!phanTrang) return null;
  const { trang, kichThuoc, tongSo } = phanTrang;
  const soTrang = Math.max(1, Math.ceil(tongSo / kichThuoc));
  const tu = tongSo === 0 ? 0 : (trang - 1) * kichThuoc + 1;
  const den = Math.min(trang * kichThuoc, tongSo);
  return (
    <div className="phanTrang">
      <span>
        {tu}–{den} / {tongSo}
      </span>
      <button type="button" disabled={trang <= 1} onClick={() => onDoiTrang(trang - 1)} aria-label="Trang trước">
        <ChevronLeft size={16} />
      </button>
      <span>
        {trang}/{soTrang}
      </span>
      <button type="button" disabled={trang >= soTrang} onClick={() => onDoiTrang(trang + 1)} aria-label="Trang sau">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

export default PhanTrang;
