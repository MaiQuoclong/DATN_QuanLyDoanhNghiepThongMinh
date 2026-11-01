import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, RefreshCw, Shuffle, KeyRound, FilePlus } from 'lucide-react';
import goiApi from '../../services/goiApi';
import { useXacThuc } from '../../context/NguCanhXacThuc';
import NutBam from '../../components/NutBam';
import HopThoai from '../../components/HopThoai';
import HopThoaiBieuMau from '../../components/HopThoaiBieuMau';
import BangDuLieu from '../../components/BangDuLieu';
import { DauHoSo, LuoiThongTinHoSo } from '../../components/TheHoSo';
import { COT_HOP_DONG, HopThoaiChiTietHopDong, HopThoaiLapHopDong } from '../../components/hopDong/HopThoaiHopDong';
import { NHAN_GIOI_TINH, NHAN_TRANG_THAI_LAM_VIEC, thanhLuaChon } from '../../utils/dinhDang';
import { layLuaChonViTri } from './TrangDanhSachNhanVien';

// Trạng thái được chuyển tới, khớp máy trạng thái ở backend (nhanVienService.CHUYEN_TRANG_THAI_HOP_LE)
const CHUYEN_TRANG_THAI = {
  THU_VIEC: ['CHINH_THUC', 'TAM_NGHI', 'DA_NGHI_VIEC'],
  CHINH_THUC: ['TAM_NGHI', 'DA_NGHI_VIEC'],
  TAM_NGHI: ['CHINH_THUC', 'DA_NGHI_VIEC'],
  DA_NGHI_VIEC: ['THU_VIEC', 'CHINH_THUC'],
};

function TabHopDong({ nhanVien, laHR }) {
  const [danhSach, setDanhSach] = useState(null);
  const [loi, setLoi] = useState('');
  const [dangXem, setDangXem] = useState(null);
  const [dangLap, setDangLap] = useState(false);

  const tai = useCallback(() => {
    goiApi
      .get('/hopDong', { params: { nhanVienId: nhanVien.id, kichThuoc: 100 } })
      .then((kq) => setDanhSach(kq.data.items))
      .catch((e) => setLoi(e.message));
  }, [nhanVien.id]);
  useEffect(tai, [tai]);

  return (
    <div className="the theNoiDung">
      <div className="dauThe">
        <h3>Hợp đồng lao động</h3>
        {laHR && nhanVien.trangThaiLamViec !== 'DA_NGHI_VIEC' && (
          <NutBam bienThe="phu" bieuTuong={FilePlus} onClick={() => setDangLap(true)}>Lập hợp đồng</NutBam>
        )}
      </div>
      {loi && <div className="thongBao loi">{loi}</div>}
      <BangDuLieu cot={COT_HOP_DONG} duLieu={danhSach ?? []} onHanhDong={(d) => setDangXem(d.id)} thongBaoRong="Chưa có hợp đồng" />
      {dangXem && <HopThoaiChiTietHopDong hopDongId={dangXem} onDong={() => setDangXem(null)} onThayDoi={tai} />}
      {dangLap && (
        <HopThoaiLapHopDong
          nhanVien={nhanVien}
          onDong={() => setDangLap(false)}
          onDaTao={(hd) => { setDangLap(false); tai(); setDangXem(hd.id); }}
        />
      )}
    </div>
  );
}

function TrangChiTietNhanVien() {
  const { id } = useParams();
  const dieuHuong = useNavigate();
  const { nguoiDung } = useXacThuc();
  const [hoSo, setHoSo] = useState(null);
  const [loi, setLoi] = useState('');
  const [tab, setTab] = useState('thongTin');
  const [thaoTac, setThaoTac] = useState(null);
  const [viTri, setViTri] = useState([]);
  const [matKhauTam, setMatKhauTam] = useState(null);

  useEffect(() => {
    setHoSo(null);
    goiApi.get(`/nhanVien/${id}`).then((kq) => setHoSo(kq.data)).catch((e) => setLoi(e.message));
  }, [id]);

  const laMinh = hoSo && hoSo.id === nguoiDung.nhanVienId;
  // HR không tự sửa hồ sơ/hợp đồng của chính mình (docs/phan-quyen.md quy tắc 1)
  const laHR = nguoiDung.vaiTro.includes('HR') && !laMinh;
  const xemHopDong = laMinh || nguoiDung.vaiTro.some((vt) => ['HR', 'giamDoc'].includes(vt));

  const capNhat = (duongDan, phuongThuc = 'post') => async (giaTri) => {
    const kq = await goiApi[phuongThuc](`/nhanVien/${id}${duongDan}`, giaTri);
    setHoSo(kq.data);
    setThaoTac(null);
  };

  const moDieuChuyen = async () => {
    try {
      setViTri((await layLuaChonViTri()).filter((vt) => vt.giaTri !== hoSo.chucDanhPhongBanId));
      setThaoTac('dieuChuyen');
    } catch (e) {
      setLoi(e.message);
    }
  };

  const capMatKhauTam = async () => {
    try {
      const kq = await goiApi.post(`/nguoiDung/${hoSo.nguoiDungId}/datLaiMatKhau`);
      setMatKhauTam(kq.data.matKhauTam);
    } catch (e) {
      setMatKhauTam(null);
      setLoi(e.message);
    }
  };

  if (loi && !hoSo) return <div className="thongBao loi">{loi}</div>;
  if (!hoSo) return <div className="chuPhu">Đang tải hồ sơ...</div>;

  return (
    <div>
      <NutBam bienThe="ma" bieuTuong={ArrowLeft} onClick={() => dieuHuong('/nhanSu/danhSach')}>Danh sách nhân viên</NutBam>
      <div className="dauTrangNghiepVu" style={{ marginTop: 8 }}>
        <DauHoSo hoSo={hoSo} />
        {laHR && (
          <div className="hangNutPhai">
            <NutBam bienThe="phu" bieuTuong={Pencil} onClick={() => setThaoTac('sua')}>Sửa</NutBam>
            <NutBam bienThe="phu" bieuTuong={RefreshCw} onClick={() => setThaoTac('trangThai')}>Đổi trạng thái</NutBam>
            {hoSo.trangThaiLamViec !== 'DA_NGHI_VIEC' && (
              <NutBam bienThe="phu" bieuTuong={Shuffle} onClick={moDieuChuyen}>Điều chuyển</NutBam>
            )}
            {hoSo.nguoiDungId && hoSo.trangThaiTaiKhoan !== 'KHOA' && (
              <NutBam bienThe="phu" bieuTuong={KeyRound} onClick={() => setThaoTac('matKhau')}>Cấp mật khẩu tạm</NutBam>
            )}
          </div>
        )}
      </div>
      {loi && <div className="thongBao loi">{loi}</div>}

      <div className="tabGachChan">
        <button type="button" className={tab === 'thongTin' ? 'dangChon' : ''} onClick={() => setTab('thongTin')}>Thông tin cá nhân</button>
        {xemHopDong && (
          <button type="button" className={tab === 'hopDong' ? 'dangChon' : ''} onClick={() => setTab('hopDong')}>Hợp đồng</button>
        )}
      </div>

      {tab === 'thongTin' && (
        <div className="the theNoiDung">
          <LuoiThongTinHoSo hoSo={hoSo} />
        </div>
      )}
      {tab === 'hopDong' && xemHopDong && <TabHopDong nhanVien={hoSo} laHR={laHR} />}

      {thaoTac === 'sua' && (
        <HopThoaiBieuMau
          tieuDe="Sửa hồ sơ nhân viên"
          giaTriBanDau={hoSo}
          truong={[
            { ten: 'hoVaTen', nhan: 'Họ và tên', batBuoc: true, rongHet: true },
            { ten: 'gioiTinh', nhan: 'Giới tính', kieu: 'select', luaChon: thanhLuaChon(NHAN_GIOI_TINH), batBuoc: true },
            { ten: 'ngaySinh', nhan: 'Ngày sinh', kieu: 'date', batBuoc: true },
            { ten: 'ngayVaoLam', nhan: 'Ngày vào làm', kieu: 'date', batBuoc: true },
            { ten: 'soDienThoai', nhan: 'Số điện thoại' },
            { ten: 'diaChi', nhan: 'Địa chỉ', rongHet: true },
            { ten: 'soTaiKhoanNganHang', nhan: 'Số tài khoản ngân hàng' },
            { ten: 'tenNganHang', nhan: 'Tên ngân hàng' },
          ]}
          onGui={(giaTri) => {
            // Chỉ gửi trường thay đổi để nhật ký SUA_NHAN_VIEN ghi đúng phần đã sửa
            const thayDoi = Object.fromEntries(Object.entries(giaTri).filter(([k, v]) => v !== (hoSo[k] ?? '')));
            if (Object.keys(thayDoi).length === 0) { setThaoTac(null); return Promise.resolve(); }
            return capNhat('', 'patch')(thayDoi);
          }}
          onDong={() => setThaoTac(null)}
        />
      )}
      {thaoTac === 'trangThai' && (
        <HopThoaiBieuMau
          tieuDe="Đổi trạng thái lao động"
          moTa="Chuyển sang Đã nghỉ việc sẽ khóa tài khoản đăng nhập; quay lại làm việc sẽ mở khóa nếu tài khoản bị khóa do nghỉ việc."
          truong={[
            {
              ten: 'trangThaiLamViec', nhan: 'Trạng thái mới', kieu: 'select', batBuoc: true, rongHet: true,
              luaChon: CHUYEN_TRANG_THAI[hoSo.trangThaiLamViec].map((tt) => ({ giaTri: tt, nhan: NHAN_TRANG_THAI_LAM_VIEC[tt] })),
            },
            { ten: 'lyDo', nhan: 'Lý do', kieu: 'textarea' },
          ]}
          onGui={capNhat('/doiTrangThai')}
          onDong={() => setThaoTac(null)}
        />
      )}
      {thaoTac === 'dieuChuyen' && (
        <HopThoaiBieuMau
          tieuDe="Điều chuyển nhân viên"
          truong={[
            { ten: 'chucDanhPhongBanId', nhan: 'Vị trí mới', kieu: 'select', luaChon: viTri, batBuoc: true, rongHet: true },
            { ten: 'lyDo', nhan: 'Lý do', kieu: 'textarea' },
          ]}
          nhanNutGui="Điều chuyển"
          onGui={capNhat('/dieuChuyen')}
          onDong={() => setThaoTac(null)}
        />
      )}
      {thaoTac === 'matKhau' && (
        <HopThoai
          tieuDe="Cấp mật khẩu tạm"
          onDong={() => { setThaoTac(null); setMatKhauTam(null); }}
          chanTrang={matKhauTam
            ? <NutBam onClick={() => { setThaoTac(null); setMatKhauTam(null); }}>Xong</NutBam>
            : (
              <>
                <NutBam bienThe="phu" onClick={() => setThaoTac(null)}>Hủy</NutBam>
                <NutBam onClick={capMatKhauTam}>Cấp mật khẩu</NutBam>
              </>
            )}
        >
          {matKhauTam ? (
            <>
              <div>Mật khẩu tạm của {hoSo.tenDangNhap} (chỉ hiển thị một lần, hết hạn sau 24 giờ):</div>
              <div className="matKhauTam">{matKhauTam}</div>
            </>
          ) : (
            <p>Mật khẩu hiện tại của <strong>{hoSo.tenDangNhap}</strong> sẽ mất hiệu lực, mọi phiên đăng nhập bị đăng xuất.</p>
          )}
        </HopThoai>
      )}
    </div>
  );
}

export default TrangChiTietNhanVien;
