import ChipTrangThai from './ChipTrangThai';
import { dinhDangNgay, NHAN_GIOI_TINH } from '../utils/dinhDang';

export function layChuCaiDau(hoVaTen = '') {
  const tu = hoVaTen.trim().split(/\s+/);
  return ((tu[0]?.[0] ?? '') + (tu.length > 1 ? tu.at(-1)[0] : '')).toUpperCase() || '?';
}

// Đầu hồ sơ: avatar chữ cái, tên, chip trạng thái lao động, mã NV - vị trí
export function DauHoSo({ hoSo }) {
  return (
    <div className="dauHoSo">
      <span className="avatarLon">{layChuCaiDau(hoSo.hoVaTen)}</span>
      <div>
        <h1 className="tieuDeTrang">{hoSo.hoVaTen}</h1>
        <div className="chuPhu">
          {hoSo.maNhanVien} · {hoSo.tenChucDanh} - {hoSo.tenPhongBan} · <ChipTrangThai trangThai={hoSo.trangThaiLamViec} />
        </div>
      </div>
    </div>
  );
}

function O({ nhan, giaTri }) {
  return (
    <div className="oThongTin">
      <span>{nhan}</span>
      <strong>{giaTri || '—'}</strong>
    </div>
  );
}

// Lưới thông tin hồ sơ. Cột ngân hàng/tài khoản chỉ hiện khi API trả về (quanLy không nhận các cột này)
export function LuoiThongTinHoSo({ hoSo }) {
  return (
    <div className="luoiThongTin">
      <O nhan="Giới tính" giaTri={NHAN_GIOI_TINH[hoSo.gioiTinh]} />
      <O nhan="Ngày sinh" giaTri={dinhDangNgay(hoSo.ngaySinh)} />
      <O nhan="Số điện thoại" giaTri={hoSo.soDienThoai} />
      <O nhan="Địa chỉ" giaTri={hoSo.diaChi} />
      <O nhan="Ngày vào làm" giaTri={dinhDangNgay(hoSo.ngayVaoLam)} />
      <O nhan="Phòng ban" giaTri={`${hoSo.tenPhongBan} (${hoSo.maPhongBan})`} />
      <O nhan="Chức danh" giaTri={hoSo.tenChucDanh} />
      {'soTaiKhoanNganHang' in hoSo && <O nhan="Số tài khoản ngân hàng" giaTri={hoSo.soTaiKhoanNganHang} />}
      {'tenNganHang' in hoSo && <O nhan="Ngân hàng" giaTri={hoSo.tenNganHang} />}
      {'tenDangNhap' in hoSo && <O nhan="Tên đăng nhập" giaTri={hoSo.tenDangNhap} />}
      {'email' in hoSo && <O nhan="Email" giaTri={hoSo.email} />}
    </div>
  );
}
