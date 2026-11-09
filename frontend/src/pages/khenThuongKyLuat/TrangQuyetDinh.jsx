import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import goiApi from '../../services/goiApi';
import { useXacThuc } from '../../context/NguCanhXacThuc';
import BangDuLieu from '../../components/BangDuLieu';
import ChipTrangThai from '../../components/ChipTrangThai';
import HopThoai from '../../components/HopThoai';
import HopThoaiBieuMau from '../../components/HopThoaiBieuMau';
import NutBam from '../../components/NutBam';
import PhanTrang from '../../components/PhanTrang';
import ThanhLoc from '../../components/ThanhLoc';
import TheThongKe from '../../components/TheThongKe';
import { dinhDangNgay, dinhDangTien, locThamSo, thanhLuaChon } from '../../utils/dinhDang';

export const NHAN_LOAI_KTKL = { KHEN_THUONG: 'Khen thưởng', KY_LUAT: 'Kỷ luật' };
const KICH_THUOC = 20;
const homNay = () => new Date().toLocaleDateString('en-CA');

// Trường lập quyết định; HR chọn người ký (giamDoc), giamDoc tự ký
export function truongQuyetDinh(dsNguoiKy, { coNhanVien = true, coLoai = true } = {}) {
  return [
    ...(coNhanVien ? [{ ten: 'nhanVienId', nhan: 'Nhân viên', kieu: 'nhanVien', batBuoc: true, locNhanVien: { trangThai: ['THU_VIEC', 'CHINH_THUC'] } }] : []),
    ...(coLoai ? [{ ten: 'loaiQuyetDinh', nhan: 'Loại', kieu: 'select', batBuoc: true, luaChon: thanhLuaChon(NHAN_LOAI_KTKL) }] : []),
    { ten: 'tieuDe', nhan: 'Tiêu đề', batBuoc: true, rongHet: true },
    { ten: 'soTien', nhan: 'Số tiền (VNĐ)', kieu: 'number', ghiChu: 'Khen thưởng cộng, kỷ luật trừ vào lương tháng ban hành' },
    { ten: 'ngayBanHanh', nhan: 'Ngày ban hành', kieu: 'date', batBuoc: true, ghiChu: 'Không chọn được tháng đã gửi/duyệt bảng lương' },
    ...(dsNguoiKy ? [{ ten: 'nguoiKyDuyetId', nhan: 'Người ký', kieu: 'select', batBuoc: true, luaChon: dsNguoiKy.map((n) => ({ giaTri: n.id, nhan: `${n.maNhanVien} - ${n.hoVaTen}` })) }] : []),
    { ten: 'soQuyetDinh', nhan: 'Số quyết định', goiY: 'Để trống để tự sinh QD<năm>-NNNN' },
    { ten: 'lyDo', nhan: 'Lý do', kieu: 'textarea', batBuoc: true },
  ];
}

// Tab Quyết định: HR, giamDoc xem toàn công ty và lập quyết định; quanLy xem PM + của mình; nhanVien, Admin xem của mình
function TrangQuyetDinh() {
  const { nguoiDung } = useXacThuc();
  const laHR = nguoiDung.vaiTro.includes('HR');
  const laGiamDoc = nguoiDung.vaiTro.includes('giamDoc');
  const duocLap = laHR || laGiamDoc;
  const [kq, setKq] = useState(null);
  const [tuKhoa, setTuKhoa] = useState('');
  const [loc, setLoc] = useState({});
  const [trang, setTrang] = useState(1);
  const [loi, setLoi] = useState('');
  const [thongBao, setThongBao] = useState('');
  const [chiTiet, setChiTiet] = useState(null);
  const [dsNguoiKy, setDsNguoiKy] = useState(null);
  const [dangLap, setDangLap] = useState(false);

  const tai = useCallback(() => {
    goiApi.get('/quyetDinhKhenThuongKyLuat', { params: locThamSo({ tuKhoa: tuKhoa.trim(), ...loc, trang, kichThuoc: KICH_THUOC }) })
      .then((r) => { setKq(r.data); setLoi(''); }).catch((e) => setLoi(e.message));
  }, [tuKhoa, loc, trang]);
  useEffect(() => { const hen = setTimeout(tai, 250); return () => clearTimeout(hen); }, [tai]);
  useEffect(() => {
    if (laHR) goiApi.get('/quyetDinhKhenThuongKyLuat/nguoiKy').then((r) => setDsNguoiKy(r.data)).catch((e) => setLoi(e.message));
  }, [laHR]);

  const nam = new Date().getFullYear();
  const cot = [
    { khoa: 'soQuyetDinh', tieuDe: 'Số QĐ' },
    { khoa: 'hoVaTen', tieuDe: 'Nhân viên', hienThi: (d) => `${d.maNhanVien} - ${d.hoVaTen}` },
    { khoa: 'tenPhongBan', tieuDe: 'Phòng ban', hienThi: (d) => d.tenPhongBan ?? '—' },
    { khoa: 'loaiQuyetDinh', tieuDe: 'Loại', hienThi: (d) => <ChipTrangThai trangThai={d.loaiQuyetDinh} /> },
    { khoa: 'tieuDe', tieuDe: 'Tiêu đề' },
    { khoa: 'soTien', tieuDe: 'Số tiền', canPhai: true, hienThi: (d) => dinhDangTien(d.soTien) },
    { khoa: 'ngayBanHanh', tieuDe: 'Ngày ban hành', hienThi: (d) => dinhDangNgay(d.ngayBanHanh) },
    { khoa: 'tenNguoiKy', tieuDe: 'Người ký' },
  ];
  const tk = kq?.thongKe;

  return (
    <div>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Quyết định khen thưởng - kỷ luật</h1>
          <div className="chuPhu">Quyết định do Giám đốc ký · số tiền cộng (khen thưởng) hoặc trừ (kỷ luật) vào lương tháng ban hành</div>
        </div>
        {duocLap && <NutBam bieuTuong={Plus} onClick={() => { setThongBao(''); setDangLap(true); }}>Lập quyết định</NutBam>}
      </div>
      {loi && <div className="thongBao loi">{loi}</div>}
      {thongBao && <div className="thongBao thanhCong">{thongBao}</div>}
      {tk && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          <TheThongKe tieuDe="Khen thưởng" giaTri={tk.soKhenThuong} moTa={dinhDangTien(tk.tongKhenThuong)} trangThai="thanhCong" />
          <TheThongKe tieuDe="Kỷ luật" giaTri={tk.soKyLuat} moTa={dinhDangTien(tk.tongKyLuat)} trangThai={tk.soKyLuat ? 'canhBao' : undefined} />
        </div>
      )}
      <ThanhLoc
        tuKhoa={tuKhoa}
        onDoiTuKhoa={(v) => { setTuKhoa(v); setTrang(1); }}
        goiYTim="Tìm số QĐ, mã/tên nhân viên, tiêu đề..."
        boLoc={[
          { khoa: 'loaiQuyetDinh', nhan: 'Tất cả loại', luaChon: thanhLuaChon(NHAN_LOAI_KTKL) },
          { khoa: 'nam', nhan: 'Tất cả năm', luaChon: [nam, nam - 1, nam - 2].map((n) => ({ giaTri: String(n), nhan: `Năm ${n}` })) },
        ]}
        giaTriLoc={loc}
        onDoiLoc={(k, v) => { setLoc((c) => ({ ...c, [k]: v })); setTrang(1); }}
      />
      <BangDuLieu cot={cot} duLieu={kq?.items ?? []} onHanhDong={setChiTiet} thongBaoRong="Chưa có quyết định" />
      <PhanTrang phanTrang={kq?.phanTrang} onDoiTrang={setTrang} />

      {chiTiet && (
        <HopThoai tieuDe={`Quyết định ${chiTiet.soQuyetDinh}`} onDong={() => setChiTiet(null)}>
          <div className="bieuMau">
            <div className="truongForm rongHet"><strong>{chiTiet.tieuDe}</strong> <ChipTrangThai trangThai={chiTiet.loaiQuyetDinh} /></div>
            <div className="truongForm">Nhân viên<div>{chiTiet.maNhanVien} - {chiTiet.hoVaTen}</div></div>
            <div className="truongForm">Phòng ban<div>{chiTiet.tenPhongBan ?? '—'}</div></div>
            <div className="truongForm">Số tiền<div>{dinhDangTien(chiTiet.soTien)}</div></div>
            <div className="truongForm">Ngày ban hành<div>{dinhDangNgay(chiTiet.ngayBanHanh)}</div></div>
            <div className="truongForm">Người ký<div>{chiTiet.maNguoiKy} - {chiTiet.tenNguoiKy}</div></div>
            <div className="truongForm">Nguồn<div>{chiTiet.deXuatId ? `Từ đề xuất #${chiTiet.deXuatId}` : 'Lập trực tiếp'}</div></div>
            <div className="truongForm rongHet">Lý do<div style={{ whiteSpace: 'pre-wrap' }}>{chiTiet.lyDo}</div></div>
          </div>
        </HopThoai>
      )}
      {dangLap && (
        <HopThoaiBieuMau
          tieuDe="Lập quyết định khen thưởng - kỷ luật"
          moTa={laHR ? undefined : 'Bạn là người ký quyết định này'}
          truong={truongQuyetDinh(laHR ? (dsNguoiKy ?? []) : null)}
          giaTriBanDau={{ ngayBanHanh: homNay() }}
          nhanNutGui="Ban hành"
          onGui={async (g) => {
            const r = await goiApi.post('/quyetDinhKhenThuongKyLuat', locThamSo(g));
            setDangLap(false);
            setThongBao([r.message, r.data.canhBao].filter(Boolean).join('. '));
            // Đang lọc năm khác năm ban hành thì chuyển bộ lọc sang năm đó để thấy quyết định vừa lập
            const namBanHanh = String(g.ngayBanHanh ?? '').slice(0, 4);
            if (loc.nam && namBanHanh && loc.nam !== namBanHanh) { setLoc((c) => ({ ...c, nam: namBanHanh })); setTrang(1); } else tai();
          }}
          onDong={() => setDangLap(false)}
        />
      )}
    </div>
  );
}

export default TrangQuyetDinh;
