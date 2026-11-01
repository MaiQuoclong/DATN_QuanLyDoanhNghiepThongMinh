import { useCallback, useEffect, useState } from 'react';
import { Lock, Unlock, ShieldCheck, KeyRound } from 'lucide-react';
import goiApi from '../../services/goiApi';
import { useXacThuc } from '../../context/NguCanhXacThuc';
import { NHAN_VAI_TRO } from '../../config/danhSachMenu';
import BangDuLieu from '../../components/BangDuLieu';
import ThanhLoc from '../../components/ThanhLoc';
import PhanTrang from '../../components/PhanTrang';
import NutBam from '../../components/NutBam';
import ChipTrangThai from '../../components/ChipTrangThai';
import HopThoai from '../../components/HopThoai';
import HopThoaiBieuMau from '../../components/HopThoaiBieuMau';
import { dinhDangThoiGian, locThamSo, thanhLuaChon } from '../../utils/dinhDang';

const DS_VAI_TRO = ['Admin', 'giamDoc', 'quanLy', 'HR', 'nhanVien'];

const COT = [
  { khoa: 'tenDangNhap', tieuDe: 'Tên đăng nhập' },
  { khoa: 'hoVaTen', tieuDe: 'Nhân viên', hienThi: (d) => (d.hoVaTen ? <>{d.hoVaTen} <span className="chuPhu">{d.maNhanVien}</span></> : '—') },
  { khoa: 'email', tieuDe: 'Email' },
  { khoa: 'vaiTro', tieuDe: 'Vai trò', sapXep: false, hienThi: (d) => d.vaiTro.map((vt) => NHAN_VAI_TRO[vt] ?? vt).join(', ') },
  { khoa: 'lanDangNhapCuoi', tieuDe: 'Đăng nhập cuối', hienThi: (d) => dinhDangThoiGian(d.lanDangNhapCuoi) },
  { khoa: 'trangThai', tieuDe: 'Trạng thái', hienThi: (d) => <ChipTrangThai trangThai={d.trangThai} /> },
];

// Hộp thoại phân quyền: tick các vai trò, gửi PUT thay toàn bộ
function HopThoaiVaiTro({ taiKhoan, onDong, onXong }) {
  const [chon, setChon] = useState(taiKhoan.vaiTro);
  const [loi, setLoi] = useState('');
  const doi = (vt) => setChon((cu) => (cu.includes(vt) ? cu.filter((x) => x !== vt) : [...cu, vt]));
  const luu = async () => {
    try {
      await goiApi.put(`/nguoiDung/${taiKhoan.nguoiDungId}/vaiTro`, { vaiTro: chon });
      onXong();
    } catch (e) {
      setLoi(e.message);
    }
  };
  return (
    <HopThoai
      tieuDe={`Phân quyền ${taiKhoan.tenDangNhap}`}
      onDong={onDong}
      chanTrang={<><NutBam bienThe="phu" onClick={onDong}>Hủy</NutBam><NutBam onClick={luu}>Lưu</NutBam></>}
    >
      {loi && <div className="thongBao loi">{loi}</div>}
      <div className="danhSachChon">
        {DS_VAI_TRO.map((vt) => (
          <label key={vt}>
            <input type="checkbox" checked={chon.includes(vt)} onChange={() => doi(vt)} />
            {NHAN_VAI_TRO[vt]}
          </label>
        ))}
      </div>
      <p className="chuPhu">Tài khoản có hồ sơ nhân viên luôn giữ vai trò Nhân viên. Quản lý gắn với trưởng bộ phận do Giám đốc bổ nhiệm.</p>
    </HopThoai>
  );
}

function TrangTaiKhoan() {
  const { nguoiDung } = useXacThuc();
  const [tuKhoa, setTuKhoa] = useState('');
  const [loc, setLoc] = useState({});
  const [trang, setTrang] = useState(1);
  const [ketQua, setKetQua] = useState(null);
  const [loi, setLoi] = useState('');
  const [dangChon, setDangChon] = useState(null);
  const [thaoTac, setThaoTac] = useState(null);
  const [matKhauTam, setMatKhauTam] = useState(null);

  const tai = useCallback(() => {
    goiApi
      .get('/nguoiDung', { params: locThamSo({ tuKhoa, ...loc, trang, kichThuoc: 20 }) })
      .then((kq) => { setKetQua(kq.data); setLoi(''); })
      .catch((e) => setLoi(e.message));
  }, [tuKhoa, loc, trang]);

  useEffect(() => {
    const hen = setTimeout(tai, 300);
    return () => clearTimeout(hen);
  }, [tai]);

  const dong = () => { setThaoTac(null); setDangChon(null); setMatKhauTam(null); };
  const xong = () => { dong(); tai(); };
  const laMinh = dangChon?.nguoiDungId === nguoiDung.nguoiDungId;

  const capMatKhau = async () => {
    try {
      const kq = await goiApi.post(`/nguoiDung/${dangChon.nguoiDungId}/datLaiMatKhau`);
      setMatKhauTam(kq.data.matKhauTam);
      tai();
    } catch (e) {
      setLoi(e.message);
      dong();
    }
  };

  return (
    <div>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Tài khoản người dùng</h1>
          <div className="chuPhu">Tổng {ketQua?.phanTrang.tongSo ?? 0} tài khoản</div>
        </div>
      </div>
      <ThanhLoc
        tuKhoa={tuKhoa}
        onDoiTuKhoa={(v) => { setTuKhoa(v); setTrang(1); }}
        goiYTim="Tên đăng nhập, email, họ tên..."
        boLoc={[
          { khoa: 'trangThai', nhan: 'Trạng thái', luaChon: [{ giaTri: 'DANG_HOAT_DONG', nhan: 'Hoạt động' }, { giaTri: 'KHOA', nhan: 'Bị khóa' }] },
          { khoa: 'vaiTro', nhan: 'Vai trò', luaChon: thanhLuaChon(NHAN_VAI_TRO) },
        ]}
        giaTriLoc={loc}
        onDoiLoc={(khoa, v) => { setLoc((cu) => ({ ...cu, [khoa]: v })); setTrang(1); }}
        phanPhai={<span />}
      />
      {loi && <div className="thongBao loi">{loi}</div>}
      <BangDuLieu cot={COT} khoaDong="nguoiDungId" duLieu={ketQua?.items ?? []} onHanhDong={(d) => { setDangChon(d); setThaoTac('menu'); }} />
      <PhanTrang phanTrang={ketQua?.phanTrang} onDoiTrang={setTrang} />

      {thaoTac === 'menu' && dangChon && (
        <HopThoai tieuDe={dangChon.tenDangNhap} onDong={dong} rong={420}>
          <div style={{ display: 'grid', gap: 8 }}>
            <NutBam bienThe="phu" bieuTuong={ShieldCheck} onClick={() => setThaoTac('vaiTro')}>Phân quyền</NutBam>
            {!laMinh && (
              <NutBam bienThe="phu" bieuTuong={KeyRound} onClick={() => setThaoTac('matKhau')}>Cấp mật khẩu tạm</NutBam>
            )}
            {!laMinh && dangChon.trangThai === 'DANG_HOAT_DONG' && (
              <NutBam bienThe="phu" bieuTuong={Lock} onClick={() => setThaoTac('khoa')}>Khóa tài khoản</NutBam>
            )}
            {dangChon.trangThai === 'KHOA' && (
              <NutBam bienThe="phu" bieuTuong={Unlock} onClick={() => setThaoTac('moKhoa')}>Mở khóa</NutBam>
            )}
          </div>
        </HopThoai>
      )}
      {thaoTac === 'vaiTro' && <HopThoaiVaiTro taiKhoan={dangChon} onDong={dong} onXong={xong} />}
      {['khoa', 'moKhoa'].includes(thaoTac) && (
        <HopThoaiBieuMau
          tieuDe={`${thaoTac === 'khoa' ? 'Khóa' : 'Mở khóa'} ${dangChon.tenDangNhap}`}
          truong={[{ ten: 'lyDo', nhan: 'Lý do', kieu: 'textarea', batBuoc: true }]}
          nhanNutGui={thaoTac === 'khoa' ? 'Khóa' : 'Mở khóa'}
          onGui={async (g) => { await goiApi.post(`/nguoiDung/${dangChon.nguoiDungId}/${thaoTac}`, g); xong(); }}
          onDong={dong}
        />
      )}
      {thaoTac === 'matKhau' && (
        <HopThoai
          tieuDe="Cấp mật khẩu tạm"
          onDong={dong}
          chanTrang={matKhauTam
            ? <NutBam onClick={dong}>Xong</NutBam>
            : <><NutBam bienThe="phu" onClick={dong}>Hủy</NutBam><NutBam onClick={capMatKhau}>Cấp mật khẩu</NutBam></>}
        >
          {matKhauTam ? (
            <>
              <div>Mật khẩu tạm của {dangChon.tenDangNhap} (chỉ hiển thị một lần, hết hạn sau 24 giờ):</div>
              <div className="matKhauTam">{matKhauTam}</div>
            </>
          ) : (
            <p>Mật khẩu hiện tại của <strong>{dangChon.tenDangNhap}</strong> sẽ mất hiệu lực và mọi phiên đăng nhập bị thu hồi.</p>
          )}
        </HopThoai>
      )}
    </div>
  );
}

export default TrangTaiKhoan;
