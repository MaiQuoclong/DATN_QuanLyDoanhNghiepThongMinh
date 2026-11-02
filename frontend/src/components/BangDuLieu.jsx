import { useMemo, useState } from 'react';
import { ArrowUpDown, MoreHorizontal } from 'lucide-react';
import './BangDuLieu.css';

// Bảng dữ liệu chung: header sticky, bấm tiêu đề cột để sắp xếp.
// cot: [{ khoa, tieuDe, bieuTuong?, canPhai?, hienThi?: (dong) => node, sapXep?: false }]
function BangDuLieu({ cot, duLieu, khoaDong = 'id', onHanhDong, thongBaoRong = 'Không có dữ liệu' }) {
  const [sapXep, setSapXep] = useState({ khoa: null, tang: true });

  const duLieuDaXep = useMemo(() => {
    if (!sapXep.khoa) return duLieu;
    return [...duLieu].sort((a, b) => {
      const x = a[sapXep.khoa];
      const y = b[sapXep.khoa];
      const ketQua = x > y ? 1 : x < y ? -1 : 0;
      return sapXep.tang ? ketQua : -ketQua;
    });
  }, [duLieu, sapXep]);

  const doiSapXep = (khoa) =>
    setSapXep((cu) => ({ khoa, tang: cu.khoa === khoa ? !cu.tang : true }));

  return (
    <div className="bangBoc the">
      <table className="bangDuLieu">
        <thead>
          <tr>
            {cot.map(({ khoa, tieuDe, bieuTuong: BieuTuong, canPhai, sapXep: choSapXep = true }) => (
              <th key={khoa} className={canPhai ? 'canPhai' : ''}>
                <button
                  type="button"
                  className="tieuDeCot"
                  disabled={!choSapXep}
                  onClick={() => doiSapXep(khoa)}
                >
                  {BieuTuong && <BieuTuong size={14} />}
                  {tieuDe}
                  {choSapXep && <ArrowUpDown size={12} className="iconSapXep" />}
                </button>
              </th>
            ))}
            {onHanhDong && <th className="cotHanhDong" />}
          </tr>
        </thead>
        <tbody>
          {duLieuDaXep.length === 0 && (
            <tr>
              <td colSpan={cot.length + 1} className="oRong">{thongBaoRong}</td>
            </tr>
          )}
          {duLieuDaXep.map((dong) => (
            <tr key={dong[khoaDong]}>
              {cot.map(({ khoa, canPhai, hienThi }) => (
                <td key={khoa} className={canPhai ? 'canPhai' : ''}>
                  {hienThi ? hienThi(dong) : dong[khoa]}
                </td>
              ))}
              {onHanhDong && (
                <td className="cotHanhDong">
                  <button type="button" className="nutHanhDong" onClick={(e) => onHanhDong(dong, e)}>
                    <MoreHorizontal size={16} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default BangDuLieu;
