import HopThoaiBieuMau from '../HopThoaiBieuMau';
import goiApi from '../../services/goiApi';

const TRUONG = [
  { ten: 'ngayCanDieuChinh', nhan: 'Ngày cần điều chỉnh', kieu: 'date', batBuoc: true, rongHet: true },
  { ten: 'gioVaoDeXuat', nhan: 'Giờ vào đề xuất', kieu: 'time', ghiChu: 'Để trống nếu giữ nguyên' },
  { ten: 'gioRaDeXuat', nhan: 'Giờ ra đề xuất', kieu: 'time', ghiChu: 'Để trống nếu giữ nguyên' },
  { ten: 'lyDoGiaiTrinh', nhan: 'Lý do giải trình', kieu: 'textarea', batBuoc: true, goiY: 'Ví dụ: quên check-out do họp khách hàng' },
];

// Gửi yêu cầu điều chỉnh công của chính mình (trạng thái CHO_DUYET)
function HopThoaiDieuChinhCong({ ngay, onDong, onDaGui }) {
  const gui = async (giaTri) => {
    const kq = await goiApi.post('/dieuChinhCong', {
      ngayCanDieuChinh: giaTri.ngayCanDieuChinh,
      gioVaoDeXuat: giaTri.gioVaoDeXuat || undefined,
      gioRaDeXuat: giaTri.gioRaDeXuat || undefined,
      lyDoGiaiTrinh: giaTri.lyDoGiaiTrinh,
    });
    onDaGui(kq.data);
  };
  return (
    <HopThoaiBieuMau
      tieuDe="Yêu cầu điều chỉnh công"
      truong={TRUONG}
      giaTriBanDau={{ ngayCanDieuChinh: ngay ?? '' }}
      nhanNutGui="Gửi yêu cầu"
      moTa="Yêu cầu được gửi tới trưởng bộ phận hoặc HR duyệt. Tháng đã chốt công không thể điều chỉnh."
      onGui={gui}
      onDong={onDong}
    />
  );
}

export default HopThoaiDieuChinhCong;
