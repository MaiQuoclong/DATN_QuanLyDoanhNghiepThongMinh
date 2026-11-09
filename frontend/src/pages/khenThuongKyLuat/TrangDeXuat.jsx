import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import goiApi from '../../services/goiApi';
import { useXacThuc } from '../../context/NguCanhXacThuc';
import BangDuLieu from '../../components/BangDuLieu';
import ChipTrangThai from '../../components/ChipTrangThai';
import HopThoaiBieuMau from '../../components/HopThoaiBieuMau';
import NutBam from '../../components/NutBam';
import PhanTrang from '../../components/PhanTrang';
import ThanhLoc from '../../components/ThanhLoc';
import { dinhDangThoiGian, dinhDangTien, locThamSo, thanhLuaChon } from '../../utils/dinhDang';
import { NHAN_LOAI_KTKL, truongQuyetDinh } from './TrangQuyetDinh';

const KICH_THUOC = 20;
const NHAN_TRANG_THAI = { CHO_DUYET: 'Chờ xử lý', DA_DUYET: 'Đã lập quyết định', TU_CHOI: 'Từ chối' };
const homNay = () => new Date().toLocaleDateString('en-CA');

const truongDeXuat = (coNhanVien) => [
  ...(coNhanVien ? [{ ten: 'nhanVienId', nhan: 'Nhân viên', kieu: 'nhanVien', batBuoc: true, locNhanVien: { trangThai: ['THU_VIEC', 'CHINH_THUC'] } }] : []),
  { ten: 'loaiDeXuat', nhan: 'Loại', kieu: 'select', batBuoc: true, luaChon: thanhLuaChon(NHAN_LOAI_KTKL) },
  { ten: 'soTienDeXuat', nhan: 'Số tiền đề xuất (VNĐ)', kieu: 'number', ghiChu: 'Để trống = 0' },
  { ten: 'tieuDe', nhan: 'Tiêu đề', batBuoc: true, rongHet: true },
  { ten: 'lyDo', nhan: 'Lý do', kieu: 'textarea', batBuoc: true },
];

// Tab Đề xuất: quanLy (PM) / giamDoc tạo, sửa, thu hồi đề xuất của mình khi còn chờ;
// HR từ chối hoặc lập quyết định (chọn Giám đốc ký); giamDoc xem toàn bộ
function TrangDeXuat() {
  const { nguoiDung } = useXacThuc();
  const laHR = nguoiDung.vaiTro.includes('HR');
  const duocTao = nguoiDung.vaiTro.some((v) => ['quanLy', 'giamDoc'].includes(v));
  const [kq, setKq] = useState(null);
  const [tuKhoa, setTuKhoa] = useState('');
  const [loc, setLoc] = useState({ trangThai: 'CHO_DUYET' });
  const [trang, setTrang] = useState(1);
  const [loi, setLoi] = useState('');
  const [thongBao, setThongBao] = useState('');
  const [dangTao, setDangTao] = useState(false);
  const [dangXem, setDangXem] = useState(null);
  const [cheDo, setCheDo] = useState(null); // 'sua' | 'tuChoi' | 'lapQuyetDinh'
  const [dsNguoiKy, setDsNguoiKy] = useState([]);

  const tai = useCallback(() => {
    goiApi.get('/deXuatKhenThuongKyLuat', { params: locThamSo({ tuKhoa: tuKhoa.trim(), ...loc, trang, kichThuoc: KICH_THUOC }) })
      .then((r) => { setKq(r.data); setLoi(''); }).catch((e) => setLoi(e.message));
  }, [tuKhoa, loc, trang]);
  useEffect(() => { const hen = setTimeout(tai, 250); return () => clearTimeout(hen); }, [tai]);
  useEffect(() => {
    if (laHR) goiApi.get('/quyetDinhKhenThuongKyLuat/nguoiKy').then((r) => setDsNguoiKy(r.data)).catch((e) => setLoi(e.message));
  }, [laHR]);

  const xong = (thongDiep) => { setDangTao(false); setDangXem(null); setCheDo(null); setThongBao(thongDiep); tai(); };
  const laCuaToi = (d) => d.nguoiDeXuatId === nguoiDung.nhanVienId;

  const cot = [
    { khoa: 'hoVaTen', tieuDe: 'Nhân viên', hienThi: (d) => `${d.maNhanVien} - ${d.hoVaTen}` },
    { khoa: 'tenPhongBan', tieuDe: 'Phòng ban', hienThi: (d) => d.tenPhongBan ?? '—' },
    { khoa: 'loaiDeXuat', tieuDe: 'Loại', hienThi: (d) => <ChipTrangThai trangThai={d.loaiDeXuat} /> },
    { khoa: 'tieuDe', tieuDe: 'Tiêu đề' },
    { khoa: 'soTienDeXuat', tieuDe: 'Số tiền', canPhai: true, hienThi: (d) => dinhDangTien(d.soTienDeXuat) },
    { khoa: 'tenNguoiDeXuat', tieuDe: 'Người đề xuất' },
    { khoa: 'ngayTao', tieuDe: 'Ngày tạo', hienThi: (d) => dinhDangThoiGian(d.ngayTao) },
    { khoa: 'trangThai', tieuDe: 'Trạng thái', hienThi: (d) => <ChipTrangThai trangThai={d.trangThai} nhan={NHAN_TRANG_THAI[d.trangThai]} /> },
  ];

  // Thông tin đề xuất + các thao tác được phép, hiển thị trong hộp thoại xem
  const moTaDeXuat = (d) => (
    <>
      <div><strong>{d.tieuDe}</strong> · {NHAN_LOAI_KTKL[d.loaiDeXuat]} · {dinhDangTien(d.soTienDeXuat)}</div>
      <div>Nhân viên: {d.maNhanVien} - {d.hoVaTen} · Người đề xuất: {d.tenNguoiDeXuat}</div>
      <div style={{ whiteSpace: 'pre-wrap' }}>Lý do: {d.lyDo}</div>
      {d.trangThai !== 'CHO_DUYET' && (
        <div>Xử lý: {d.tenNguoiXuLy ?? '—'}{d.ghiChuXuLy ? ` · ${d.ghiChuXuLy}` : ''}{d.soQuyetDinh ? ` · Quyết định ${d.soQuyetDinh}` : ''}</div>
      )}
      {d.trangThai === 'CHO_DUYET' && (
        <div style={{ marginTop: 8 }}>
          {laHR && d.nhanVienId !== nguoiDung.nhanVienId && (
            <>
              <button type="button" className="lienKet" onClick={() => setCheDo('lapQuyetDinh')}>Lập quyết định</button>
              {' · '}
              <button type="button" className="lienKet" onClick={() => setCheDo('tuChoi')}>Từ chối</button>
            </>
          )}
          {laCuaToi(d) && (
            <>
              <button type="button" className="lienKet" onClick={() => setCheDo('sua')}>Sửa</button>
              {' · '}
              <button
                type="button"
                className="lienKet"
                onClick={async () => {
                  if (!window.confirm('Thu hồi đề xuất này?')) return;
                  try { xong((await goiApi.delete(`/deXuatKhenThuongKyLuat/${d.id}`)).message); } catch (e) { setDangXem(null); setLoi(e.message); }
                }}
              >
                Thu hồi
              </button>
            </>
          )}
        </div>
      )}
    </>
  );

  return (
    <div>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Đề xuất khen thưởng - kỷ luật</h1>
          <div className="chuPhu">Quản lý đề xuất cho nhân viên phòng mình · HR từ chối hoặc lập quyết định để Giám đốc ký</div>
        </div>
        {duocTao && <NutBam bieuTuong={Plus} onClick={() => { setThongBao(''); setDangTao(true); }}>Tạo đề xuất</NutBam>}
      </div>
      {loi && <div className="thongBao loi">{loi}</div>}
      {thongBao && <div className="thongBao thanhCong">{thongBao}</div>}
      <ThanhLoc
        tuKhoa={tuKhoa}
        onDoiTuKhoa={(v) => { setTuKhoa(v); setTrang(1); }}
        goiYTim="Tìm mã/tên nhân viên, tiêu đề..."
        boLoc={[
          { khoa: 'trangThai', nhan: 'Tất cả trạng thái', luaChon: thanhLuaChon(NHAN_TRANG_THAI) },
          { khoa: 'loaiDeXuat', nhan: 'Tất cả loại', luaChon: thanhLuaChon(NHAN_LOAI_KTKL) },
        ]}
        giaTriLoc={loc}
        onDoiLoc={(k, v) => { setLoc((c) => ({ ...c, [k]: v })); setTrang(1); }}
      />
      <BangDuLieu cot={cot} duLieu={kq?.items ?? []} onHanhDong={(d) => { setLoi(''); setCheDo(null); setDangXem(d); }} thongBaoRong="Không có đề xuất" />
      <PhanTrang phanTrang={kq?.phanTrang} onDoiTrang={setTrang} />

      {dangTao && (
        <HopThoaiBieuMau
          tieuDe="Tạo đề xuất khen thưởng - kỷ luật"
          truong={truongDeXuat(true)}
          nhanNutGui="Gửi đề xuất"
          onGui={async (g) => xong((await goiApi.post('/deXuatKhenThuongKyLuat', locThamSo(g))).message)}
          onDong={() => setDangTao(false)}
        />
      )}
      {dangXem && !cheDo && (
        <HopThoaiBieuMau
          tieuDe={`Đề xuất #${dangXem.id}`}
          moTa={moTaDeXuat(dangXem)}
          truong={[]}
          nhanNutGui="Đóng"
          bienTheNut="phu"
          onGui={async () => setDangXem(null)}
          onDong={() => setDangXem(null)}
        />
      )}
      {dangXem && cheDo === 'sua' && (
        <HopThoaiBieuMau
          tieuDe={`Sửa đề xuất #${dangXem.id}`}
          truong={truongDeXuat(false)}
          giaTriBanDau={dangXem}
          onGui={async (g) => {
            // Số tiền API trả dạng "1000000.00": so sánh theo giá trị số để không coi là đã đổi
            const khacNhau = (k, v) => (k === 'soTienDeXuat'
              ? Number(v || 0) !== Number(dangXem[k] || 0)
              : String(v) !== String(dangXem[k] ?? ''));
            const body = Object.fromEntries(Object.entries(g).filter(([k, v]) => khacNhau(k, v)));
            if (!Object.keys(body).length) throw new Error('Không có thông tin nào thay đổi');
            xong((await goiApi.patch(`/deXuatKhenThuongKyLuat/${dangXem.id}`, body)).message);
          }}
          onDong={() => setCheDo(null)}
        />
      )}
      {dangXem && cheDo === 'tuChoi' && (
        <HopThoaiBieuMau
          tieuDe={`Từ chối đề xuất #${dangXem.id}`}
          truong={[{ ten: 'ghiChuXuLy', nhan: 'Lý do từ chối', kieu: 'textarea', batBuoc: true }]}
          nhanNutGui="Từ chối"
          bienTheNut="vang"
          onGui={async (g) => xong((await goiApi.post(`/deXuatKhenThuongKyLuat/${dangXem.id}/tuChoi`, g)).message)}
          onDong={() => setCheDo(null)}
        />
      )}
      {dangXem && cheDo === 'lapQuyetDinh' && (
        <HopThoaiBieuMau
          tieuDe={`Lập quyết định từ đề xuất #${dangXem.id}`}
          moTa={`${NHAN_LOAI_KTKL[dangXem.loaiDeXuat]} cho ${dangXem.maNhanVien} - ${dangXem.hoVaTen}`}
          truong={[...truongQuyetDinh(dsNguoiKy, { coNhanVien: false, coLoai: false }),
            { ten: 'ghiChuXuLy', nhan: 'Ghi chú xử lý', rongHet: true }]}
          giaTriBanDau={{ tieuDe: dangXem.tieuDe, lyDo: dangXem.lyDo, soTien: dangXem.soTienDeXuat, ngayBanHanh: homNay() }}
          nhanNutGui="Ban hành"
          onGui={async (g) => {
            const r = await goiApi.post(`/deXuatKhenThuongKyLuat/${dangXem.id}/lapQuyetDinh`, locThamSo(g));
            xong([r.message, r.data.canhBao].filter(Boolean).join('. '));
          }}
          onDong={() => setCheDo(null)}
        />
      )}
    </div>
  );
}

export default TrangDeXuat;
