import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import goiApi from '../../services/goiApi';
import { useXacThuc } from '../../context/NguCanhXacThuc';
import BangDuLieu from '../../components/BangDuLieu';
import ThanhLoc from '../../components/ThanhLoc';
import PhanTrang from '../../components/PhanTrang';
import NutBam from '../../components/NutBam';
import ChipTrangThai from '../../components/ChipTrangThai';
import HopThoai from '../../components/HopThoai';
import HopThoaiBieuMau from '../../components/HopThoaiBieuMau';
import { dinhDangNgay, locThamSo, NHAN_GIOI_TINH, NHAN_TRANG_THAI_LAM_VIEC, thanhLuaChon } from '../../utils/dinhDang';

const COT = [
  { khoa: 'maNhanVien', tieuDe: 'Mã NV' },
  { khoa: 'hoVaTen', tieuDe: 'Họ và tên' },
  { khoa: 'tenPhongBan', tieuDe: 'Phòng ban' },
  { khoa: 'tenChucDanh', tieuDe: 'Chức danh' },
  { khoa: 'soDienThoai', tieuDe: 'Điện thoại' },
  { khoa: 'ngayVaoLam', tieuDe: 'Ngày vào làm', hienThi: (d) => dinhDangNgay(d.ngayVaoLam) },
  { khoa: 'trangThaiLamViec', tieuDe: 'Trạng thái', hienThi: (d) => <ChipTrangThai trangThai={d.trangThaiLamViec} /> },
];

// Vị trí còn trống (đang áp dụng, chưa đủ định biên) cho form thêm nhân viên / điều chuyển
export async function layLuaChonViTri() {
  const kq = await goiApi.get('/chucDanhPhongBan', { params: { trangThai: 'DANG_AP_DUNG' } });
  // Chỉ vị trí còn chỗ, thuộc phòng ban và chức danh đang hoạt động (backend chặn các trường hợp khác bằng 409)
  return kq.data.filter((vt) => (vt.conTrong ?? vt.dinhBien - vt.soDangGiu) > 0
    && vt.trangThaiPhongBan !== 'NGUNG_HOAT_DONG' && vt.trangThaiChucDanh !== 'NGUNG_HOAT_DONG').map((vt) => ({
    giaTri: vt.id,
    nhan: `${vt.tenChucDanh} - ${vt.tenPhongBan} (còn ${vt.conTrong ?? vt.dinhBien - vt.soDangGiu}/${vt.dinhBien})`,
  }));
}

function TrangDanhSachNhanVien() {
  const { nguoiDung } = useXacThuc();
  const dieuHuong = useNavigate();
  const laHR = nguoiDung.vaiTro.includes('HR');
  const [tuKhoa, setTuKhoa] = useState('');
  const [loc, setLoc] = useState({});
  const [trang, setTrang] = useState(1);
  const [ketQua, setKetQua] = useState(null);
  const [loi, setLoi] = useState('');
  const [phongBan, setPhongBan] = useState([]);
  const [viTri, setViTri] = useState(null);
  const [taiKhoanMoi, setTaiKhoanMoi] = useState(null);

  useEffect(() => {
    goiApi.get('/phongBan').then((kq) => setPhongBan(kq.data)).catch(() => {});
  }, []);

  const tai = useCallback(() => {
    goiApi
      .get('/nhanVien', { params: locThamSo({ tuKhoa, ...loc, trang, kichThuoc: 20 }) })
      .then((kq) => { setKetQua(kq.data); setLoi(''); })
      .catch((e) => setLoi(e.message));
  }, [tuKhoa, loc, trang]);

  useEffect(() => {
    const hen = setTimeout(tai, 300);
    return () => clearTimeout(hen);
  }, [tai]);

  const moThem = async () => {
    try {
      setViTri(await layLuaChonViTri());
    } catch (e) {
      setLoi(e.message);
    }
  };

  const boLoc = [
    { khoa: 'phongBanId', nhan: 'Phòng ban', luaChon: phongBan.map((pb) => ({ giaTri: pb.id, nhan: pb.tenPhongBan })) },
    { khoa: 'trangThaiLamViec', nhan: 'Trạng thái', luaChon: thanhLuaChon(NHAN_TRANG_THAI_LAM_VIEC) },
  ];

  return (
    <div>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Nhân viên</h1>
          <div className="chuPhu">
            {nguoiDung.vaiTro.some((vt) => ['HR', 'giamDoc'].includes(vt)) ? 'Toàn công ty' : 'Phòng ban bạn phụ trách'}
            {' · '}Tổng {ketQua?.phanTrang.tongSo ?? 0} người
          </div>
        </div>
        {laHR && <NutBam bieuTuong={UserPlus} onClick={moThem}>Thêm nhân viên</NutBam>}
      </div>

      <ThanhLoc
        tuKhoa={tuKhoa}
        onDoiTuKhoa={(v) => { setTuKhoa(v); setTrang(1); }}
        goiYTim="Mã, họ tên, số điện thoại..."
        boLoc={boLoc}
        giaTriLoc={loc}
        onDoiLoc={(khoa, v) => { setLoc((cu) => ({ ...cu, [khoa]: v })); setTrang(1); }}
        phanPhai={<span />}
      />
      {loi && <div className="thongBao loi">{loi}</div>}
      <BangDuLieu
        cot={COT}
        duLieu={ketQua?.items ?? []}
        onHanhDong={(d) => dieuHuong(`/nhanSu/danhSach/${d.id}`)}
        thongBaoRong="Không có nhân viên phù hợp"
      />
      <PhanTrang phanTrang={ketQua?.phanTrang} onDoiTrang={setTrang} />

      {viTri && (
        <HopThoaiBieuMau
          tieuDe="Thêm nhân viên"
          moTa="Hệ thống tạo tài khoản với mật khẩu tạm (hết hạn sau 24 giờ), nhân viên phải đổi ở lần đăng nhập đầu."
          truong={[
            { ten: 'hoVaTen', nhan: 'Họ và tên', batBuoc: true, rongHet: true },
            { ten: 'gioiTinh', nhan: 'Giới tính', kieu: 'select', luaChon: thanhLuaChon(NHAN_GIOI_TINH), batBuoc: true },
            { ten: 'ngaySinh', nhan: 'Ngày sinh', kieu: 'date', batBuoc: true },
            { ten: 'chucDanhPhongBanId', nhan: 'Vị trí', kieu: 'select', luaChon: viTri, batBuoc: true, rongHet: true },
            { ten: 'ngayVaoLam', nhan: 'Ngày vào làm', kieu: 'date', batBuoc: true },
            {
              ten: 'trangThaiLamViec', nhan: 'Trạng thái', kieu: 'select', batBuoc: true,
              luaChon: [{ giaTri: 'THU_VIEC', nhan: 'Thử việc' }, { giaTri: 'CHINH_THUC', nhan: 'Chính thức' }],
            },
            { ten: 'tenDangNhap', nhan: 'Tên đăng nhập', batBuoc: true },
            { ten: 'email', nhan: 'Email', kieu: 'email', batBuoc: true },
            { ten: 'soDienThoai', nhan: 'Số điện thoại' },
            { ten: 'diaChi', nhan: 'Địa chỉ' },
          ]}
          giaTriBanDau={{ trangThaiLamViec: 'THU_VIEC' }}
          nhanNutGui="Thêm nhân viên"
          onGui={async (giaTri) => {
            const kq = await goiApi.post('/nhanVien', giaTri);
            setViTri(null);
            setTaiKhoanMoi(kq.data);
            tai();
          }}
          onDong={() => setViTri(null)}
        />
      )}

      {taiKhoanMoi && (
        <HopThoai
          tieuDe="Đã thêm nhân viên"
          onDong={() => setTaiKhoanMoi(null)}
          chanTrang={(
            <>
              <NutBam bienThe="phu" onClick={() => setTaiKhoanMoi(null)}>Đóng</NutBam>
              <NutBam onClick={() => dieuHuong(`/nhanSu/danhSach/${taiKhoanMoi.nhanVien.id}`)}>Xem hồ sơ</NutBam>
            </>
          )}
        >
          <p>
            {taiKhoanMoi.nhanVien.maNhanVien} - {taiKhoanMoi.nhanVien.hoVaTen}<br />
            Tên đăng nhập: <strong>{taiKhoanMoi.taiKhoan.tenDangNhap}</strong>
          </p>
          <div>Mật khẩu tạm (chỉ hiển thị một lần):</div>
          <div className="matKhauTam">{taiKhoanMoi.taiKhoan.matKhauTam}</div>
          <p className="chuPhu">Hãy bàn giao trực tiếp cho nhân viên. Tiếp theo nên lập hợp đồng trong hồ sơ nhân viên.</p>
        </HopThoai>
      )}
    </div>
  );
}

export default TrangDanhSachNhanVien;
