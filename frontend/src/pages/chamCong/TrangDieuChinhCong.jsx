import { useCallback, useEffect, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import goiApi from '../../services/goiApi';
import { useXacThuc } from '../../context/NguCanhXacThuc';
import BangDuLieu from '../../components/BangDuLieu';
import ChipTrangThai from '../../components/ChipTrangThai';
import HopThoai from '../../components/HopThoai';
import HopThoaiBieuMau from '../../components/HopThoaiBieuMau';
import NutBam from '../../components/NutBam';
import PhanTrang from '../../components/PhanTrang';
import ThanhLoc from '../../components/ThanhLoc';
import HopThoaiDieuChinhCong from '../../components/chamCong/HopThoaiDieuChinhCong';
import { dinhDangGio, dinhDangNgay, dinhDangThoiGian, locThamSo } from '../../utils/dinhDang';

const NGUOI_DUYET = ['HR', 'giamDoc', 'quanLy'];
const BO_LOC = [
  {
    khoa: 'trangThai',
    nhan: 'Trạng thái',
    luaChon: [
      { giaTri: 'CHO_DUYET', nhan: 'Chờ duyệt' },
      { giaTri: 'DA_DUYET', nhan: 'Đã duyệt' },
      { giaTri: 'TU_CHOI', nhan: 'Từ chối' },
    ],
  },
];

const khoangGio = (vao, ra) => `${dinhDangGio(vao)} - ${dinhDangGio(ra)}`;
const rutGon = (chuoi, doDai = 40) => (chuoi.length > doDai ? `${chuoi.slice(0, doDai)}…` : chuoi);

const COT_YEU_CAU = [
  { khoa: 'ngayCanDieuChinh', tieuDe: 'Ngày', hienThi: (d) => dinhDangNgay(d.ngayCanDieuChinh) },
  {
    khoa: 'gioVaoHienTai',
    tieuDe: 'Giờ hiện tại',
    sapXep: false,
    hienThi: (d) => (d.banGhiChamCongId ? khoangGio(d.gioVaoHienTai, d.gioRaHienTai) : <span className="chuPhu">Chưa chấm</span>),
  },
  { khoa: 'gioVaoDeXuat', tieuDe: 'Đề xuất', sapXep: false, hienThi: (d) => khoangGio(d.gioVaoDeXuat, d.gioRaDeXuat) },
  { khoa: 'lyDoGiaiTrinh', tieuDe: 'Lý do', sapXep: false, hienThi: (d) => <span title={d.lyDoGiaiTrinh}>{rutGon(d.lyDoGiaiTrinh)}</span> },
  { khoa: 'trangThai', tieuDe: 'Trạng thái', hienThi: (d) => <ChipTrangThai trangThai={d.trangThai} /> },
  { khoa: 'tenNguoiDuyet', tieuDe: 'Người duyệt', hienThi: (d) => d.tenNguoiDuyet ?? '—' },
];
const COT_CO_NHAN_VIEN = [
  { khoa: 'hoVaTen', tieuDe: 'Nhân viên', hienThi: (d) => <>{d.hoVaTen} <span className="chuPhu">{d.maNhanVien} · {d.tenPhongBan}</span></> },
  ...COT_YEU_CAU,
];

// Chi tiết một yêu cầu; người có quyền duyệt thấy nút Duyệt / Từ chối (backend vẫn kiểm tra phạm vi, không tự duyệt)
function HopThoaiChiTietYeuCau({ yeuCau, onDong, onDaXuLy }) {
  const [loi, setLoi] = useState('');
  const [dangGui, setDangGui] = useState(false);
  const [dangTuChoi, setDangTuChoi] = useState(false);

  const duyet = async () => {
    setDangGui(true);
    setLoi('');
    try {
      const kq = await goiApi.post(`/dieuChinhCong/${yeuCau.id}/duyet`);
      onDaXuLy(kq.message);
    } catch (e) {
      setLoi(e.message);
      setDangGui(false);
    }
  };

  if (dangTuChoi) {
    return (
      <HopThoaiBieuMau
        tieuDe="Từ chối yêu cầu điều chỉnh"
        truong={[{ ten: 'lyDoTuChoi', nhan: 'Lý do từ chối', kieu: 'textarea', batBuoc: true }]}
        nhanNutGui="Từ chối"
        bienTheNut="vang"
        onGui={async (giaTri) => {
          const kq = await goiApi.post(`/dieuChinhCong/${yeuCau.id}/tuChoi`, giaTri);
          onDaXuLy(kq.message);
        }}
        onDong={() => setDangTuChoi(false)}
      />
    );
  }

  return (
    <HopThoai
      tieuDe={`Yêu cầu điều chỉnh ngày ${dinhDangNgay(yeuCau.ngayCanDieuChinh)}`}
      onDong={onDong}
      chanTrang={yeuCau.duocDuyet ? (
        <>
          <NutBam bienThe="phu" bieuTuong={X} disabled={dangGui} onClick={() => setDangTuChoi(true)}>Từ chối</NutBam>
          <NutBam bieuTuong={Check} disabled={dangGui} onClick={duyet}>Duyệt</NutBam>
        </>
      ) : <NutBam bienThe="phu" onClick={onDong}>Đóng</NutBam>}
    >
      {loi && <div className="thongBao loi">{loi}</div>}
      <div className="luoiThongTin">
        <div className="oThongTin"><span>Nhân viên</span><strong>{yeuCau.hoVaTen} ({yeuCau.maNhanVien})</strong></div>
        <div className="oThongTin"><span>Phòng ban</span><strong>{yeuCau.tenPhongBan}</strong></div>
        <div className="oThongTin">
          <span>Giờ hiện tại</span>
          <strong>{yeuCau.banGhiChamCongId ? khoangGio(yeuCau.gioVaoHienTai, yeuCau.gioRaHienTai) : 'Chưa chấm công'}</strong>
        </div>
        <div className="oThongTin"><span>Đề xuất</span><strong>{khoangGio(yeuCau.gioVaoDeXuat, yeuCau.gioRaDeXuat)}</strong></div>
        <div className="oThongTin"><span>Trạng thái</span><strong><ChipTrangThai trangThai={yeuCau.trangThai} /></strong></div>
        <div className="oThongTin"><span>Ngày gửi</span><strong>{dinhDangThoiGian(yeuCau.ngayTao)}</strong></div>
        {yeuCau.tenNguoiDuyet && (
          <div className="oThongTin"><span>Người xử lý</span><strong>{yeuCau.tenNguoiDuyet} · {dinhDangThoiGian(yeuCau.thoiGianDuyet)}</strong></div>
        )}
      </div>
      <p><strong>Lý do giải trình:</strong> {yeuCau.lyDoGiaiTrinh}</p>
      {yeuCau.lyDoTuChoi && <p><strong>Lý do từ chối:</strong> {yeuCau.lyDoTuChoi}</p>}
      <div className="chuPhu">Giờ để trống (—) trong đề xuất được giữ nguyên theo giờ hiện tại.</div>
    </HopThoai>
  );
}

// cheDo 'duyet': yêu cầu trong phạm vi được duyệt; 'cuaToi': yêu cầu của chính mình
function DanhSachYeuCau({ cheDo }) {
  const laDuyet = cheDo === 'duyet';
  const [tuKhoa, setTuKhoa] = useState('');
  const [loc, setLoc] = useState(laDuyet ? { trangThai: 'CHO_DUYET' } : {});
  const [thang, setThang] = useState('');
  const [trang, setTrang] = useState(1);
  const [ketQua, setKetQua] = useState(null);
  const [loi, setLoi] = useState('');
  const [thongBao, setThongBao] = useState('');
  const [dangXem, setDangXem] = useState(null);
  const [dangTao, setDangTao] = useState(false);

  const tai = useCallback(() => {
    goiApi
      .get(laDuyet ? '/dieuChinhCong' : '/dieuChinhCong/cuaToi', {
        params: locThamSo({ tuKhoa, ...loc, thang, trang, kichThuoc: 20 }),
      })
      .then((kq) => { setKetQua(kq.data); setLoi(''); })
      .catch((e) => setLoi(e.message));
  }, [laDuyet, tuKhoa, loc, thang, trang]);

  // Chờ người dùng gõ xong mới gọi API
  useEffect(() => {
    const hen = setTimeout(tai, 300);
    return () => clearTimeout(hen);
  }, [tai]);

  return (
    <>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">{laDuyet ? 'Duyệt điều chỉnh công' : 'Yêu cầu điều chỉnh của tôi'}</h1>
          <div className="chuPhu">
            {laDuyet ? 'Không thể tự duyệt yêu cầu của chính mình' : 'Sửa giờ vào/ra khi quên hoặc chấm công sai'}
            {' · '}Tổng {ketQua?.phanTrang.tongSo ?? 0} yêu cầu
          </div>
        </div>
        {!laDuyet && <NutBam bieuTuong={Plus} onClick={() => setDangTao(true)}>Gửi yêu cầu</NutBam>}
      </div>

      <ThanhLoc
        tuKhoa={tuKhoa}
        onDoiTuKhoa={(v) => { setTuKhoa(v); setTrang(1); }}
        goiYTim={laDuyet ? 'Mã hoặc tên nhân viên...' : 'Tìm kiếm...'}
        boLoc={BO_LOC}
        giaTriLoc={loc}
        onDoiLoc={(khoa, v) => { setLoc((cu) => ({ ...cu, [khoa]: v })); setTrang(1); }}
        phanPhai={(
          <input
            type="month"
            className="oLoc"
            value={thang}
            onChange={(e) => { setThang(e.target.value); setTrang(1); }}
            title="Lọc theo tháng"
          />
        )}
      />
      {loi && <div className="thongBao loi">{loi}</div>}
      {thongBao && <div className="thongBao thanhCong">{thongBao}</div>}
      <BangDuLieu
        cot={laDuyet ? COT_CO_NHAN_VIEN : COT_YEU_CAU}
        duLieu={ketQua?.items ?? []}
        onHanhDong={(d) => setDangXem(d)}
        thongBaoRong="Không có yêu cầu phù hợp"
      />
      <PhanTrang phanTrang={ketQua?.phanTrang} onDoiTrang={setTrang} />

      {dangXem && (
        <HopThoaiChiTietYeuCau
          yeuCau={dangXem}
          onDong={() => setDangXem(null)}
          onDaXuLy={(tb) => { setDangXem(null); setThongBao(tb); tai(); }}
        />
      )}
      {dangTao && (
        <HopThoaiDieuChinhCong
          onDong={() => setDangTao(false)}
          onDaGui={() => { setDangTao(false); setThongBao('Đã gửi yêu cầu điều chỉnh, chờ duyệt'); tai(); }}
        />
      )}
    </>
  );
}

function TrangDieuChinhCong() {
  const { nguoiDung } = useXacThuc();
  const coQuyenDuyet = nguoiDung.vaiTro.some((vt) => NGUOI_DUYET.includes(vt));
  const [tab, setTab] = useState(coQuyenDuyet ? 'duyet' : 'cuaToi');

  return (
    <div>
      {coQuyenDuyet && (
        <div className="tabGachChan">
          <button type="button" className={tab === 'duyet' ? 'dangChon' : ''} onClick={() => setTab('duyet')}>Cần duyệt</button>
          <button type="button" className={tab === 'cuaToi' ? 'dangChon' : ''} onClick={() => setTab('cuaToi')}>Của tôi</button>
        </div>
      )}
      <DanhSachYeuCau key={tab} cheDo={tab} />
    </div>
  );
}

export default TrangDieuChinhCong;
