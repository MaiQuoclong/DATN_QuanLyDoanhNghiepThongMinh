import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import NutBam from '../NutBam';
import ChipTrangThai from '../ChipTrangThai';
import { dinhDangNgay, layThu } from '../../utils/dinhDang';

// Trạng thái bản nháp (SQLite ai-service) → nhãn + màu chip
const NHAN_TRANG_THAI = {
  CHO_XAC_NHAN: ['Chờ bạn xác nhận', 'CHO_DUYET'],
  DANG_TAO: ['Đang tạo...', 'CHO_DUYET'],
  DA_TAO: ['Đã gửi, chờ duyệt', 'DA_DUYET'],
  HUY: ['Đã hủy', 'DA_HUY'],
  HET_HAN: ['Hết hạn', 'HET_HAN'],
  LOI: ['Không tạo được', 'TU_CHOI'],
  KHONG_RO: ['Chưa rõ kết quả, kiểm tra Đơn của tôi', 'HET_HAN'],
};

const ngayKemThu = (ngay) => `${layThu(ngay)}, ${dinhDangNgay(ngay)}`;

function DongThongTin({ nhan, children }) {
  return (
    <div className="dongXemTruoc">
      <span className="nhanXemTruoc">{nhan}</span>
      <span>{children}</span>
    </div>
  );
}

// Thẻ xem trước đơn do Trợ lý AI soạn. Đơn chỉ được tạo (CHO_DUYET) khi người dùng bấm Xác nhận.
function TheXemTruocDon({ banNhap, onXacNhan, onHuy }) {
  const [dangXuLy, setDangXuLy] = useState(false);
  const [loi, setLoi] = useState('');
  const { loai, thamSo, trangThai, ketQua } = banNhap;
  const laNghiPhep = loai === 'NGHI_PHEP';
  const [nhanTrangThai, maMau] = NHAN_TRANG_THAI[trangThai] ?? [trangThai, 'BAN_NHAP'];

  const thucHien = async (hanhDong) => {
    setDangXuLy(true);
    setLoi('');
    try {
      await hanhDong(banNhap);
    } catch (e) {
      setLoi(e.message);
    } finally {
      setDangXuLy(false);
    }
  };

  return (
    <div className="theXemTruocDon">
      <div className="dauXemTruoc">
        <strong>{laNghiPhep ? 'Đơn nghỉ phép' : 'Yêu cầu điều chỉnh công'}</strong>
        <ChipTrangThai trangThai={maMau} nhan={nhanTrangThai} kieu="chip" />
      </div>
      {laNghiPhep ? (
        <>
          <DongThongTin nhan="Loại nghỉ">{banNhap.tenLoai ?? thamSo.maLoaiNghiPhep}</DongThongTin>
          <DongThongTin nhan="Thời gian">
            {ngayKemThu(thamSo.ngayBatDau)}
            {thamSo.ngayKetThuc !== thamSo.ngayBatDau && ` → ${ngayKemThu(thamSo.ngayKetThuc)}`}
            {thamSo.nuaNgay && ' (nửa ngày)'}
          </DongThongTin>
          {banNhap.soNgayNghi !== undefined && <DongThongTin nhan="Số ngày dự kiến">{banNhap.soNgayNghi}</DongThongTin>}
          <DongThongTin nhan="Lý do">{thamSo.lyDo}</DongThongTin>
        </>
      ) : (
        <>
          <DongThongTin nhan="Ngày">{ngayKemThu(thamSo.ngayCanDieuChinh)}</DongThongTin>
          {thamSo.gioVaoDeXuat && <DongThongTin nhan="Giờ vào">{thamSo.gioVaoDeXuat}</DongThongTin>}
          {thamSo.gioRaDeXuat && <DongThongTin nhan="Giờ ra">{thamSo.gioRaDeXuat}</DongThongTin>}
          <DongThongTin nhan="Lý do">{thamSo.lyDoGiaiTrinh}</DongThongTin>
        </>
      )}
      {trangThai === 'DA_TAO' && ketQua?.maDon && <DongThongTin nhan="Mã đơn">{ketQua.maDon}</DongThongTin>}
      {trangThai === 'LOI' && ketQua?.loi && <div className="loiXemTruoc">{ketQua.loi}</div>}
      {loi && <div className="loiXemTruoc">{loi}</div>}
      <div className="thaoTacXemTruoc">
        {trangThai === 'CHO_XAC_NHAN' && (
          <>
            <NutBam bieuTuong={Check} onClick={() => thucHien(onXacNhan)} disabled={dangXuLy}>
              Xác nhận gửi
            </NutBam>
            <NutBam bieuTuong={X} bienThe="phu" onClick={() => thucHien(onHuy)} disabled={dangXuLy}>
              Hủy
            </NutBam>
          </>
        )}
        <Link className="lienKetXemTruoc" to={laNghiPhep ? '/nghiPhep' : '/chamCong/dieuChinh'}>
          {['DA_TAO', 'KHONG_RO'].includes(trangThai) ? 'Xem đơn của tôi' : 'Tự tạo bằng form'}
        </Link>
      </div>
    </div>
  );
}

export default TheXemTruocDon;
