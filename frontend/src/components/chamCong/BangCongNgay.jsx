import BangDuLieu from '../BangDuLieu';
import ChipTrangThai from '../ChipTrangThai';
import ThanhThoiGianCong from './ThanhThoiGianCong';
import { dinhDangGio, dinhDangNgay, layThu } from '../../utils/dinhDang';

// Ghi chú bất thường của một ngày công
export function GhiChuNgayCong({ banGhi }) {
  const nhan = [];
  if (!banGhi.gioRa) nhan.push(<ChipTrangThai key="ra" trangThai="TU_CHOI" nhan="Thiếu check-out" />);
  if (banGhi.diMuon) nhan.push(<ChipTrangThai key="muon" trangThai="CHO_DUYET" nhan="Đi muộn" />);
  if (banGhi.veSom) nhan.push(<ChipTrangThai key="som" trangThai="CHO_DUYET" nhan="Về sớm" />);
  return nhan.length ? <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>{nhan}</span> : <span className="chuPhu">—</span>;
}

// Bảng công từng ngày. onHanhDong (tùy chọn): mở hộp thoại điều chỉnh cho ngày đó
function BangCongNgay({ items, ca, onHanhDong, thongBaoRong = 'Chưa có dữ liệu chấm công trong tháng' }) {
  const cot = [
    {
      khoa: 'ngayChamCong',
      tieuDe: 'Ngày',
      hienThi: (d) => (
        <>
          {layThu(d.ngayChamCong)}, {dinhDangNgay(d.ngayChamCong)}
        </>
      ),
    },
    { khoa: 'gioVao', tieuDe: 'Giờ vào', hienThi: (d) => dinhDangGio(d.gioVao) },
    { khoa: 'gioRa', tieuDe: 'Giờ ra', hienThi: (d) => dinhDangGio(d.gioRa) },
    { khoa: 'thoiGian', tieuDe: 'Dòng thời gian', sapXep: false, hienThi: (d) => <ThanhThoiGianCong banGhi={d} ca={ca} /> },
    { khoa: 'soGioLamThucTe', tieuDe: 'Giờ công', canPhai: true },
    { khoa: 'soGioLamThemOT', tieuDe: 'Tăng ca', canPhai: true },
    { khoa: 'ghiChu', tieuDe: 'Ghi chú', sapXep: false, hienThi: (d) => <GhiChuNgayCong banGhi={d} /> },
    { khoa: 'trangThai', tieuDe: 'Trạng thái', hienThi: (d) => <ChipTrangThai trangThai={d.trangThai} /> },
  ];
  return <BangDuLieu cot={cot} duLieu={items} onHanhDong={onHanhDong} thongBaoRong={thongBaoRong} />;
}

export default BangCongNgay;
