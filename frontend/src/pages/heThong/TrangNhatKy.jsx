import { useCallback, useEffect, useState } from 'react';
import goiApi from '../../services/goiApi';
import BangDuLieu from '../../components/BangDuLieu';
import PhanTrang from '../../components/PhanTrang';
import { dinhDangThoiGian, locThamSo } from '../../utils/dinhDang';

const COT = [
  { khoa: 'thoiGianTao', tieuDe: 'Thời gian', hienThi: (d) => dinhDangThoiGian(d.thoiGianTao) },
  { khoa: 'tenDangNhap', tieuDe: 'Tài khoản', hienThi: (d) => d.tenDangNhap ?? '—' },
  { khoa: 'hanhDong', tieuDe: 'Hành động' },
  { khoa: 'chiTiet', tieuDe: 'Chi tiết', sapXep: false, hienThi: (d) => d.chiTiet ?? '—' },
  { khoa: 'diaChiIP', tieuDe: 'IP' },
];

// Nhật ký hệ thống (Admin, giamDoc): lọc theo hành động và khoảng ngày
function TrangNhatKy() {
  const [loc, setLoc] = useState({ hanhDong: '', tuNgay: '', denNgay: '' });
  const [trang, setTrang] = useState(1);
  const [ketQua, setKetQua] = useState(null);
  const [loi, setLoi] = useState('');

  const tai = useCallback(() => {
    goiApi
      .get('/nhatKyHeThong', { params: locThamSo({ ...loc, hanhDong: loc.hanhDong.trim().toUpperCase(), trang, kichThuoc: 50 }) })
      .then((kq) => {
        setKetQua(kq.data);
        setLoi('');
      })
      .catch((e) => setLoi(e.message));
  }, [loc, trang]);

  useEffect(() => {
    const hen = setTimeout(tai, 300);
    return () => clearTimeout(hen);
  }, [tai]);

  const doi = (khoa) => (e) => {
    setLoc((cu) => ({ ...cu, [khoa]: e.target.value }));
    setTrang(1);
  };

  return (
    <div>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Nhật ký hệ thống</h1>
          <div className="chuPhu">Tổng {ketQua?.phanTrang.tongSo ?? 0} bản ghi, mới nhất trước</div>
        </div>
      </div>
      <div className="thanhLoc">
        <label className="oTimKiem">
          <input value={loc.hanhDong} onChange={doi('hanhDong')} placeholder="Mã hành động, VD: THEM_HOP_DONG" />
        </label>
        <input type="date" className="oLoc" value={loc.tuNgay} onChange={doi('tuNgay')} title="Từ ngày" />
        <input type="date" className="oLoc" value={loc.denNgay} onChange={doi('denNgay')} title="Đến ngày" />
      </div>
      {loi && <div className="thongBao loi">{loi}</div>}
      <BangDuLieu cot={COT} duLieu={ketQua?.items ?? []} thongBaoRong="Không có bản ghi" />
      <PhanTrang phanTrang={ketQua?.phanTrang} onDoiTrang={setTrang} />
    </div>
  );
}

export default TrangNhatKy;
