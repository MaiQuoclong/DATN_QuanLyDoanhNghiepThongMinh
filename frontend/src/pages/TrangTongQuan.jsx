import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Bot,
  CalendarDays,
  ClipboardCheck,
  Clock,
  FileWarning,
  LogIn,
  LogOut,
  ShieldCheck,
  Target,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import goiApi from '../services/goiApi';
import { useXacThuc } from '../context/NguCanhXacThuc';
import { useViecCanChuYChung } from '../context/NguCanhViecCanChuY';
import { layHienThiSoViec } from '../utils/viecCanChuY';
import { NHAN_VAI_TRO } from '../config/danhSachMenu';
import { locPhongBanTrongPhamVi } from '../utils/phongBan';
import ChipTrangThai from '../components/ChipTrangThai';
import NutBam from '../components/NutBam';
import BangDuLieu from '../components/BangDuLieu';
import { dinhDangGio, dinhDangNgay, dinhDangThoiGian, dinhDangTien, layThu, thangHienTai } from '../utils/dinhDang';
import './TrangTongQuan.css';

const MAU_BIEU_DO = ['#1f5f57', '#f5c518', '#ea8a0c', '#16a34a', '#2563eb', '#6b7280'];
const trieuDong = (so) => `${Math.round(Number(so || 0) / 1e6).toLocaleString('vi-VN')} tr`;

const COT_NHAT_KY = [
  { khoa: 'thoiGianTao', tieuDe: 'Thời gian', hienThi: (d) => dinhDangThoiGian(d.thoiGianTao) },
  { khoa: 'tenDangNhap', tieuDe: 'Tài khoản', hienThi: (d) => d.tenDangNhap ?? '—' },
  { khoa: 'hanhDong', tieuDe: 'Hành động' },
  { khoa: 'chiTiet', tieuDe: 'Chi tiết', sapXep: false, hienThi: (d) => d.chiTiet ?? '—' },
  { khoa: 'diaChiIP', tieuDe: 'IP' },
];

// Thẻ chỉ số trực quan: có icon màu sắc, thanh tiến độ (tùy chọn) và có thể bọc Link chuyển trang
// Thẻ "việc cần xử lý" lấy số từ /viecCanChuY (cùng nguồn với chuông); thứ tự hiển thị trên lưới.
// vaiTro (khớp apDung ở backend viecCanChuYService) chỉ dùng để giữ chỗ khi chưa có theoLoai; có theoLoai thì backend quyết định.
const THE_VIEC_CAN_XU_LY = [
  {
    loai: 'DON_NGHI_CHO_DUYET',
    vaiTro: ['giamDoc', 'quanLy'],
    duongDan: '/nghiPhep/duyetDon',
    tieuDe: 'Đơn nghỉ phép chờ duyệt',
    moTa: 'Mở trang Duyệt đơn nghỉ phép',
    bieuTuong: ClipboardCheck,
  },
  {
    loai: 'DIEU_CHINH_CONG_CHO_DUYET',
    vaiTro: ['giamDoc', 'quanLy', 'HR'],
    duongDan: '/chamCong/dieuChinh',
    tieuDe: 'Điều chỉnh công chờ duyệt',
    moTa: 'Mở trang Duyệt điều chỉnh công',
    bieuTuong: Clock,
  },
  {
    loai: 'KPI_CAN_NGHIEM_THU',
    vaiTro: ['giamDoc', 'quanLy'],
    duongDan: '/kpi/danhGia',
    tieuDe: 'Phiếu KPI chờ nghiệm thu',
    moTa: 'Mở trang Đánh giá KPI',
    bieuTuong: Target,
  },
  {
    loai: 'HOP_DONG_SAP_HET_HAN',
    vaiTro: ['HR', 'giamDoc'],
    duongDan: '/nhanSu/hopDong',
    tieuDe: 'Hợp đồng sắp/quá hạn',
    moTa: 'Gia hạn hoặc lập hợp đồng mới',
    bieuTuong: FileWarning,
    mauCanhBao: 'do',
  },
  {
    loai: 'DE_XUAT_CHO_XU_LY',
    vaiTro: ['HR'],
    duongDan: '/khenThuongKyLuat/deXuat',
    tieuDe: 'Đề xuất KTKL chờ HR xử lý',
    moTa: 'Mở trang Đề xuất khen thưởng - kỷ luật',
    bieuTuong: Award,
  },
  {
    loai: 'DE_XUAT_CHO_KY',
    vaiTro: ['giamDoc'],
    duongDan: '/khenThuongKyLuat/deXuat',
    tieuDe: 'Đề xuất KTKL chờ bạn ký',
    moTa: 'Mở trang Đề xuất khen thưởng - kỷ luật',
    bieuTuong: Award,
  },
];

function TheChiSo({ tieuDe, giaTri, moTa, bieuTuong: BieuTuong, mauIcon = 'xanh', trangThai, tienDo, duongDan }) {
  const noiDung = (
    <div className="the theChiSo">
      <div>
        <div className="dauTheChiSo">
          <div>
            <div className="nhanChiSo">{tieuDe}</div>
            <div className="giaTriChiSo">{giaTri}</div>
          </div>
          {BieuTuong && (
            <div className={`khungIconChiSo ${mauIcon}`}>
              <BieuTuong size={20} />
            </div>
          )}
        </div>
        {typeof tienDo === 'number' && (
          <div className={`thanhTienDo ${trangThai ?? ''}`}>
            <span style={{ width: `${Math.min(100, Math.max(0, Math.round(tienDo)))}%` }} />
          </div>
        )}
      </div>
      {moTa && (
        <div className={`chanTheChiSo ${trangThai ?? ''}`}>
          <span>{moTa}</span>
          {duongDan && <ArrowRight size={14} />}
        </div>
      )}
    </div>
  );
  return duongDan ? (
    <Link to={duongDan} className="lienKetThe">
      {noiDung}
    </Link>
  ) : (
    noiDung
  );
}

// Dashboard tổng quan theo docs/phan-quyen.md mục 10:
// - Cá nhân (mọi vai trò có hồ sơ): banner chấm công hôm nay, 4 thẻ chỉ số có progress bar + bảng công & đơn nghỉ gần đây
// - Quản lý / HR / Giám đốc: thẻ điều hành + biểu đồ cơ cấu nhân sự + biểu đồ quỹ lương / danh sách việc chờ duyệt
// - Admin / Giám đốc: thống kê tài khoản + nhật ký hệ thống mới nhất
// - Cuối trang: thanh trạng thái dịch vụ gọn đẹp
function TrangTongQuan() {
  const { nguoiDung } = useXacThuc();
  const vaiTro = nguoiDung.vaiTro ?? [];
  const laAdmin = vaiTro.includes('Admin');
  const laGiamDoc = vaiTro.includes('giamDoc');
  const laHR = vaiTro.includes('HR');
  const laQuanLy = vaiTro.includes('quanLy');
  const coHoSo = Boolean(nguoiDung.nhanVienId);
  const xemQuanTri = laGiamDoc || laHR || laQuanLy;

  const [sucKhoe, setSucKhoe] = useState(null);
  const [loiSucKhoe, setLoiSucKhoe] = useState(null);

  // Dữ liệu cá nhân
  const [homNay, setHomNay] = useState(null);
  const [congThang, setCongThang] = useState(null);
  const [quyPhep, setQuyPhep] = useState(null);
  const [donCuaToi, setDonCuaToi] = useState([]);
  const [phieuLuong, setPhieuLuong] = useState(null);
  const [phieuKpi, setPhieuKpi] = useState([]);
  const [dangChamCong, setDangChamCong] = useState(false);
  const [thongBaoChamCong, setThongBaoChamCong] = useState(null);

  // Dữ liệu quản lý / toàn công ty
  const [phongBan, setPhongBan] = useState([]);
  const [bangCongQuanLy, setBangCongQuanLy] = useState(null);
  // Chỉ dùng cho khung danh sách tóm tắt; số trên thẻ lấy từ viecCanChuY
  const [donChoDuyet, setDonChoDuyet] = useState([]);
  const [dieuChinhCho, setDieuChinhCho] = useState([]);
  // Thẻ thông tin của quanLy: đề xuất KTKL mình đã gửi (không phải việc tự xử lý nên không tính vào chuông)
  const [soDeXuatDaGui, setSoDeXuatDaGui] = useState(null);
  const viec = useViecCanChuYChung();
  const [baoCaoLuong, setBaoCaoLuong] = useState(null);

  // Dữ liệu hệ thống (Admin, giamDoc)
  const [tkHoatDong, setTkHoatDong] = useState(null);
  const [tkBiKhoa, setTkBiKhoa] = useState(null);
  const [nhatKyMoi, setNhatKyMoi] = useState([]);

  useEffect(() => {
    goiApi
      .get('/sucKhoe')
      .then((ketQua) => setSucKhoe(ketQua.data))
      .catch((loiApi) => setLoiSucKhoe(loiApi.message));
  }, []);

  const taiChamCongCaNhan = useCallback(() => {
    if (!coHoSo) return;
    goiApi
      .get('/chamCong/homNay')
      .then((kq) => setHomNay(kq.data))
      .catch(() => {});
    goiApi
      .get('/chamCong/cuaToi', { params: { thang: thangHienTai() } })
      .then((kq) => setCongThang(kq.data))
      .catch(() => {});
  }, [coHoSo]);

  useEffect(() => {
    taiChamCongCaNhan();
    if (!coHoSo) return;
    const namNay = new Date().getFullYear();
    goiApi
      .get('/quyPhep/cuaToi')
      .then((kq) => setQuyPhep(kq.data))
      .catch(() => {});
    goiApi
      .get('/donNghiPhep/cuaToi', { params: { trang: 1, kichThuoc: 5 } })
      .then((kq) => setDonCuaToi(kq.data?.items ?? []))
      .catch(() => {});
    goiApi
      .get('/phieuDanhGiaKPI/cuaToi')
      .then((kq) => setPhieuKpi(kq.data ?? []))
      .catch(() => {});
    goiApi
      .get('/phieuLuong/cuaToi', { params: { nam: namNay } })
      .then(async (kq) => {
        if (kq.data?.length) return setPhieuLuong(kq.data[0]);
        const kqTruoc = await goiApi.get('/phieuLuong/cuaToi', { params: { nam: namNay - 1 } });
        if (kqTruoc.data?.length) setPhieuLuong(kqTruoc.data[0]);
      })
      .catch(() => {});
  }, [coHoSo, taiChamCongCaNhan]);

  useEffect(() => {
    if (!xemQuanTri) return;
    const thang = thangHienTai();
    const namNay = new Date().getFullYear();

    goiApi
      .get('/phongBan')
      .then((kq) => setPhongBan(locPhongBanTrongPhamVi(kq.data ?? [], nguoiDung)))
      .catch(() => {});
    goiApi
      .get('/chamCong/bangCong', { params: { thang, trang: 1, kichThuoc: 100 } })
      .then((kq) => setBangCongQuanLy(kq.data))
      .catch(() => {});
    goiApi
      .get('/dieuChinhCong', { params: { trangThai: 'CHO_DUYET', trang: 1, kichThuoc: 20 } })
      .then((kq) => setDieuChinhCho((kq.data?.items ?? []).filter((yc) => yc.duocDuyet)))
      .catch(() => {});

    if (laGiamDoc || laQuanLy) {
      goiApi
        .get('/donNghiPhep', { params: { trangThai: 'CHO_DUYET', trang: 1, kichThuoc: 20 } })
        .then((kq) => setDonChoDuyet((kq.data?.items ?? []).filter((d) => d.duocDuyet)))
        .catch(() => {});
    }

    if (laHR || laGiamDoc) {
      goiApi
        .get('/bangLuong/baoCao', { params: { nam: namNay } })
        .then(async (kq) => {
          if (kq.data?.theoThang?.length) return setBaoCaoLuong({ nam: namNay, ...kq.data });
          const kqTruoc = await goiApi.get('/bangLuong/baoCao', { params: { nam: namNay - 1 } });
          setBaoCaoLuong({ nam: namNay - 1, ...(kqTruoc.data ?? {}) });
        })
        .catch(() => {});
    }
  }, [xemQuanTri, laGiamDoc, laHR, laQuanLy, nguoiDung]);

  // Thẻ thông tin quanLy: tải lại mỗi lần chuông làm mới (cùng nhịp 60s / đổi trang) để không đứng số.
  // quanLy chỉ thấy đề xuất do mình tạo (backend lọc theo nguoiDeXuatId).
  const chiLaQuanLy = laQuanLy && !laHR && !laGiamDoc;
  useEffect(() => {
    if (!chiLaQuanLy) return;
    goiApi
      .get('/deXuatKhenThuongKyLuat', { params: { trangThai: 'CHO_DUYET', trang: 1, kichThuoc: 1 } })
      .then((kq) => setSoDeXuatDaGui(kq.data?.phanTrang?.tongSo ?? 0))
      .catch(() => {});
  }, [chiLaQuanLy, viec?.theoLoai]);

  useEffect(() => {
    if (laAdmin) {
      goiApi
        .get('/nguoiDung', { params: { trangThai: 'DANG_HOAT_DONG', trang: 1, kichThuoc: 1 } })
        .then((kq) => setTkHoatDong(kq.data?.phanTrang?.tongSo ?? 0))
        .catch(() => {});
      goiApi
        .get('/nguoiDung', { params: { trangThai: 'KHOA', trang: 1, kichThuoc: 1 } })
        .then((kq) => setTkBiKhoa(kq.data?.phanTrang?.tongSo ?? 0))
        .catch(() => {});
    }
    if (laAdmin || laGiamDoc) {
      goiApi
        .get('/nhatKyHeThong', { params: { trang: 1, kichThuoc: 5 } })
        .then((kq) => setNhatKyMoi(kq.data?.items ?? []))
        .catch(() => {});
    }
  }, [laAdmin, laGiamDoc]);

  const xuLyChamCong = async (loai) => {
    setDangChamCong(true);
    setThongBaoChamCong(null);
    try {
      const kq = await goiApi.post(`/chamCong/${loai}`);
      setThongBaoChamCong({ loai: 'thanhCong', noiDung: kq.message });
      taiChamCongCaNhan();
    } catch (loi) {
      setThongBaoChamCong({ loai: 'loi', noiDung: loi.message });
    } finally {
      setDangChamCong(false);
    }
  };

  const csdlKetNoi = sucKhoe?.csdl === 'KET_NOI';
  const aiHoatDong = sucKhoe?.ai === 'HOAT_DONG';
  const banGhiHomNay = homNay?.banGhi;
  const tongHopCong = congThang?.tongHop;
  const kpiGanNhat = phieuKpi.find((p) => p.trangThai === 'BAN_NHAP' && p.trangThaiKy === 'DANG_MO') ?? phieuKpi[0];

  const tyLeCong = tongHopCong && congThang?.soNgayCongChuan ? (tongHopCong.soNgayChamCong / congThang.soNgayCongChuan) * 100 : undefined;
  const tyLePhep =
    quyPhep?.quy && Number(quyPhep.quy.tongSoNgayPhep) > 0
      ? (Number(quyPhep.soNgayConLai) / Number(quyPhep.quy.tongSoNgayPhep)) * 100
      : undefined;

  // 5 ngày có bản ghi chấm công gần nhất của bản thân (items theo thứ tự ngày tăng dần -> lấy 5 ngày cuối và đảo ngược)
  const congGanDay = (congThang?.items ?? []).slice(-5).reverse();

  // Thống kê phòng ban / toàn công ty
  const dsPhongHoatDong = phongBan.filter((pb) => pb.trangThai === 'DANG_HOAT_DONG');
  const duLieuNhanSuPhong = dsPhongHoatDong
    .filter((pb) => Number(pb.soNhanVien) > 0)
    .map((pb) => ({ ten: pb.tenPhongBan, soNhanVien: Number(pb.soNhanVien) }));
  const tongQuanSo = duLieuNhanSuPhong.reduce((s, d) => s + d.soNhanVien, 0);
  const tongDiMuon = (bangCongQuanLy?.items ?? []).reduce((s, d) => s + (d.soLanDiMuon ?? 0), 0);
  const tongThieuCheckOut = (bangCongQuanLy?.items ?? []).reduce((s, d) => s + (d.soNgayThieuCheckOut ?? 0), 0);

  // Biểu đồ quỹ lương theo phòng ban (nếu chỉ có 1 tháng đã duyệt thì theoPhongBan có nhiều cột đẹp và giàu thông tin hơn)
  const duLieuLuongPhongBan = (baoCaoLuong?.theoPhongBan ?? []).map((pb) => ({
    ten: pb.tenPhongBan.replace('Phòng ', 'P. '),
    tongThuNhap: pb.tongThuNhap,
    tongThucLinh: pb.tongThucLinh,
  }));

  return (
    <div>
      <div className="dauTrang">
        <div>
          <h1 className="tieuDeTrang">Xin chào, {nguoiDung.hoVaTen ?? nguoiDung.tenDangNhap}</h1>
          <div className="dongVaiTro">
            {vaiTro.map((vt) => (
              <ChipTrangThai key={vt} trangThai="DANG_HOAT_DONG" nhan={NHAN_VAI_TRO[vt] ?? vt} />
            ))}
            {nguoiDung.maNhanVien && <span className="chuPhu">· Mã NV: {nguoiDung.maNhanVien}</span>}
            {nguoiDung.lanDangNhapCuoi && <span className="chuPhu">· Đăng nhập trước: {dinhDangThoiGian(nguoiDung.lanDangNhapCuoi)}</span>}
          </div>
        </div>
        <div className="hangNutPhai" style={{ alignItems: 'center' }}>
          <div className="cumTrangThaiDauTrang" title="Trạng thái kết nối hệ thống và Trợ lý AI">
            <span className="mucDichVu">
              <span className={`chamDen ${loiSucKhoe ? 'do' : sucKhoe && csdlKetNoi ? 'xanh' : 'cam'}`} />
              Hệ thống: <strong>{loiSucKhoe || (sucKhoe && !csdlKetNoi) ? 'Gián đoạn' : sucKhoe ? 'Trực tuyến' : '...'}</strong>
            </span>
            <span className="mucDichVu">
              <span
                className={`chamDen ${!sucKhoe ? '' : aiHoatDong && sucKhoe.llm === 'DA_CAU_HINH' ? 'xanh' : aiHoatDong ? 'cam' : 'do'}`}
              />
              Trợ lý AI: <strong>{!sucKhoe ? '...' : aiHoatDong ? 'Sẵn sàng' : 'Tạm ngắt'}</strong>
            </span>
          </div>
          {coHoSo && (
            <Link to="/nghiPhep">
              <NutBam bienThe="phu" bieuTuong={CalendarDays}>
                Xin nghỉ phép
              </NutBam>
            </Link>
          )}
          <Link to="/troLyAi">
            <NutBam bienThe="phu" bieuTuong={Bot}>
              Hỏi Trợ lý AI
            </NutBam>
          </Link>
        </div>
      </div>

      {/* 1. Banner Chấm công hôm nay & 4 Thẻ chỉ số cá nhân */}
      {coHoSo && (
        <section className="khoiTongQuan">
          {homNay && (
            <div className="the theChamCongNhanh">
              <div className="cumThongTinCa">
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={18} color="var(--mauChinh)" />
                    Chấm công hôm nay · {layThu(homNay.ngay)}, {dinhDangNgay(homNay.ngay)}
                  </div>
                  <div className="chuPhu" style={{ marginTop: 4 }}>
                    Ca hành chính {dinhDangGio(homNay.thamSo.gioVaoCa)} – {dinhDangGio(homNay.thamSo.gioRaCa)} · Nghỉ trưa{' '}
                    {dinhDangGio(homNay.thamSo.batDauNghiTrua)} – {dinhDangGio(homNay.thamSo.ketThucNghiTrua)}
                  </div>
                </div>
                <div className="mocGioCa">
                  <span>Giờ vào</span>
                  <strong>{dinhDangGio(banGhiHomNay?.gioVao)}</strong>
                </div>
                <div className="mocGioCa">
                  <span>Giờ ra</span>
                  <strong>{dinhDangGio(banGhiHomNay?.gioRa)}</strong>
                </div>
                <div className="mocGioCa">
                  <span>Giờ công hôm nay</span>
                  <strong>{banGhiHomNay?.gioRa ? `${banGhiHomNay.soGioLamThucTe} giờ` : '—'}</strong>
                </div>
              </div>

              <div className="hangNutPhai" style={{ alignItems: 'center' }}>
                {!banGhiHomNay && (
                  <NutBam bieuTuong={LogIn} disabled={dangChamCong} onClick={() => xuLyChamCong('checkIn')}>
                    Check-in
                  </NutBam>
                )}
                {banGhiHomNay && !banGhiHomNay.gioRa && (
                  <NutBam bieuTuong={LogOut} bienThe="vang" disabled={dangChamCong} onClick={() => xuLyChamCong('checkOut')}>
                    Check-out
                  </NutBam>
                )}
                {banGhiHomNay?.gioRa && <ChipTrangThai trangThai="DA_DUYET" nhan="Đã hoàn thành ca" kieu="chip" />}
                <Link to="/chamCong" className="lienKet" style={{ fontSize: 13 }}>
                  Lịch công <ArrowRight size={13} style={{ verticalAlign: '-2px' }} />
                </Link>
              </div>
            </div>
          )}
          {thongBaoChamCong && <div className={`thongBao ${thongBaoChamCong.loai}`}>{thongBaoChamCong.noiDung}</div>}

          <div className="tieuDeKhoi">
            <h2>Cá nhân của tôi</h2>
          </div>
          <div className="luoiBonCot">
            <TheChiSo
              tieuDe={`Công tháng ${thangHienTai().slice(5)}/${thangHienTai().slice(0, 4)}`}
              giaTri={tongHopCong ? `${tongHopCong.soNgayChamCong}/${congThang.soNgayCongChuan} ngày` : '—'}
              moTa={
                tongHopCong
                  ? `${tongHopCong.tongGioLamThucTe} giờ · Đi muộn ${tongHopCong.soLanDiMuon} · Thiếu check-out ${tongHopCong.soNgayThieuCheckOut}`
                  : 'Đang tải lịch công...'
              }
              bieuTuong={Clock}
              mauIcon={tongHopCong?.soNgayThieuCheckOut ? 'cam' : 'xanh'}
              trangThai={!tongHopCong ? undefined : tongHopCong.soNgayThieuCheckOut ? 'canhBao' : 'thanhCong'}
              tienDo={tyLeCong}
              duongDan="/chamCong"
            />
            <TheChiSo
              tieuDe={`Quỹ phép năm ${quyPhep?.nam ?? new Date().getFullYear()}`}
              giaTri={quyPhep?.quy ? `${quyPhep.soNgayConLai} ngày` : '—'}
              moTa={
                quyPhep?.quy
                  ? `Tổng ${quyPhep.quy.tongSoNgayPhep} · Đã nghỉ ${quyPhep.quy.soNgayDaNghi} · Chờ duyệt ${quyPhep.soNgayChoDuyet}`
                  : 'Chưa cấp quỹ phép năm'
              }
              bieuTuong={CalendarDays}
              mauIcon="la"
              trangThai={!quyPhep?.quy ? undefined : quyPhep.soNgayConLai > 0 ? 'thanhCong' : 'canhBao'}
              tienDo={tyLePhep}
              duongDan="/nghiPhep"
            />
            <TheChiSo
              tieuDe="Lương thực lĩnh gần nhất"
              giaTri={phieuLuong ? dinhDangTien(phieuLuong.thucLinh) : '—'}
              moTa={
                phieuLuong
                  ? `Kỳ tháng ${String(phieuLuong.thang).padStart(2, '0')}/${phieuLuong.nam} · Công ${phieuLuong.soNgayCongThucTe}/${phieuLuong.ngayCongChuan}`
                  : 'Chưa có kỳ lương đã duyệt'
              }
              bieuTuong={Wallet}
              mauIcon="vang"
              trangThai={phieuLuong ? 'thanhCong' : undefined}
              duongDan="/luong"
            />
            <TheChiSo
              tieuDe="Đánh giá KPI gần nhất"
              giaTri={
                !kpiGanNhat
                  ? '—'
                  : kpiGanNhat.diemTong !== null
                    ? `${kpiGanNhat.diemTong}/10`
                    : kpiGanNhat.trangThai === 'BAN_NHAP'
                      ? 'Cần tự chấm'
                      : 'Chờ nghiệm thu'
              }
              moTa={kpiGanNhat ? kpiGanNhat.tenKyDanhGia : 'Chưa có phiếu KPI'}
              bieuTuong={Target}
              mauIcon={kpiGanNhat?.trangThai === 'BAN_NHAP' && kpiGanNhat?.trangThaiKy === 'DANG_MO' ? 'cam' : 'xanh'}
              trangThai={
                !kpiGanNhat
                  ? undefined
                  : kpiGanNhat.trangThai === 'BAN_NHAP' && kpiGanNhat.trangThaiKy === 'DANG_MO'
                    ? 'canhBao'
                    : 'thanhCong'
              }
              duongDan="/kpi"
            />
          </div>
        </section>
      )}

      {/* 2. Quản lý bộ phận & Điều hành toàn công ty (giamDoc, HR, quanLy) */}
      {xemQuanTri && (
        <section className="khoiTongQuan">
          <div className="tieuDeKhoi">
            <h2>{laGiamDoc || laHR ? 'Điều hành toàn công ty & Việc cần xử lý' : 'Quản lý bộ phận phụ trách'}</h2>
          </div>

          <div className={laGiamDoc || laHR ? 'luoiBaCot' : 'luoiBonCot'} style={{ marginBottom: 16 }}>
            <TheChiSo
              tieuDe={laGiamDoc || laHR ? 'Quân số đang làm việc' : 'Quân số trong phạm vi'}
              giaTri={`${tongQuanSo} người`}
              moTa={`${dsPhongHoatDong.length} phòng ban/bộ phận hoạt động`}
              bieuTuong={Users}
              mauIcon="xanh"
              trangThai="thanhCong"
              duongDan="/nhanSu/danhSach"
            />
            <TheChiSo
              tieuDe="Chấm công tháng này"
              giaTri={bangCongQuanLy ? `${tongDiMuon} lượt đi muộn` : '—'}
              moTa={bangCongQuanLy ? `${tongThieuCheckOut} ngày thiếu check-out` : 'Đang tải bảng công...'}
              bieuTuong={AlertTriangle}
              mauIcon={tongDiMuon + tongThieuCheckOut ? 'cam' : 'la'}
              trangThai={!bangCongQuanLy ? undefined : tongDiMuon + tongThieuCheckOut ? 'canhBao' : 'thanhCong'}
              duongDan="/chamCong/bangCong"
            />
            {THE_VIEC_CAN_XU_LY.map(({ loai, vaiTro: vaiTroThe, tieuDe, moTa, bieuTuong, duongDan, mauCanhBao = 'cam' }) => {
              const soViec = layHienThiSoViec(viec, loai);
              if (viec?.theoLoai ? !soViec : (!coHoSo && loai !== 'HOP_DONG_SAP_HET_HAN') || !vaiTroThe.some((v) => vaiTro.includes(v)))
                return null;
              const coSo = soViec && !soViec.loi;
              const tieuDeThe =
                loai === 'HOP_DONG_SAP_HET_HAN' && viec?.soNgayCanhBaoHopDong ? `${tieuDe} (${viec.soNgayCanhBaoHopDong} ngày)` : tieuDe;
              return (
                <TheChiSo
                  key={loai}
                  tieuDe={tieuDeThe}
                  giaTri={coSo ? soViec.hienThi : '—'}
                  moTa={soViec?.loi || (!soViec && viec?.loi) ? 'Không tải được số liệu' : moTa}
                  bieuTuong={bieuTuong}
                  mauIcon={coSo ? (soViec.so ? mauCanhBao : 'la') : 'xanh'}
                  trangThai={coSo ? (soViec.so ? 'canhBao' : 'thanhCong') : soViec?.loi || viec?.loi ? 'canhBao' : undefined}
                  duongDan={duongDan}
                />
              );
            })}
            {soDeXuatDaGui !== null && (
              <TheChiSo
                tieuDe="Đề xuất KTKL đã gửi chờ xử lý"
                giaTri={soDeXuatDaGui}
                moTa="Theo dõi (không tính vào chuông)"
                bieuTuong={Award}
                mauIcon="xanh"
                duongDan="/khenThuongKyLuat/deXuat"
              />
            )}
          </div>

          {/* Hàng 2 cột cân xứng 50% - 50%: Biểu đồ tròn nhân sự + Biểu đồ Quỹ lương theo phòng (HR/GĐ) hoặc Danh sách chờ duyệt (quanLy) */}
          <div className="luoiHaiCot">
            {duLieuNhanSuPhong.length > 0 && (
              <div className="the theBieuDo">
                <div className="dauThe">
                  <h3>Cơ cấu nhân sự theo phòng ban</h3>
                  <Link to="/nhanSu/phongBan" className="lienKet" style={{ fontSize: 12 }}>
                    Sơ đồ tổ chức →
                  </Link>
                </div>
                <div className="boCucDonut">
                  <div className="khungVongTron">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie data={duLieuNhanSuPhong} dataKey="soNhanVien" nameKey="ten" innerRadius={62} outerRadius={92} paddingAngle={3}>
                          {duLieuNhanSuPhong.map((_, i) => (
                            <Cell key={i} fill={MAU_BIEU_DO[i % MAU_BIEU_DO.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => [`${v} nhân viên`, 'Quân số']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="tamVongTron">
                      <strong>{tongQuanSo}</strong>
                      <span>nhân sự</span>
                    </div>
                  </div>
                  <div className="danhSachChuThich">
                    {duLieuNhanSuPhong.map((pb, i) => (
                      <div key={pb.ten} className="dongChuThich">
                        <span className="tenChuThich">
                          <span className="chamMau" style={{ background: MAU_BIEU_DO[i % MAU_BIEU_DO.length] }} />
                          {pb.ten}
                        </span>
                        <span className="soChuThich">
                          {pb.soNhanVien} người
                          <small>({tongQuanSo ? Math.round((pb.soNhanVien / tongQuanSo) * 100) : 0}%)</small>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {(laHR || laGiamDoc) && duLieuLuongPhongBan.length > 0 ? (
              <div className="the theBieuDo">
                <div className="dauThe">
                  <h3>Phân bổ quỹ lương theo phòng ban ({baoCaoLuong.nam})</h3>
                  <Link to="/luong/bangLuong" className="lienKet" style={{ fontSize: 12 }}>
                    Báo cáo quỹ lương →
                  </Link>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={duLieuLuongPhongBan} barGap={6}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--mauVien)" vertical={false} />
                    <XAxis dataKey="ten" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={trieuDong} width={65} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => dinhDangTien(v)} />
                    <Legend />
                    <Bar dataKey="tongThuNhap" name="Tổng thu nhập" fill="var(--mauChinh)" maxBarSize={38} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="tongThucLinh" name="Thực lĩnh" fill="var(--mauNhan)" maxBarSize={38} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="the theBieuDo">
                <div className="dauThe">
                  <h3>Đơn từ nhân viên đang chờ duyệt</h3>
                  <Link to="/nghiPhep/duyetDon" className="lienKet" style={{ fontSize: 12 }}>
                    Xử lý ngay →
                  </Link>
                </div>
                {donChoDuyet.length === 0 && dieuChinhCho.length === 0 ? (
                  <div className="trongDanhSach">Không có đơn nghỉ phép hoặc điều chỉnh công nào đang chờ duyệt</div>
                ) : (
                  <div className="danhSachTomTat">
                    {donChoDuyet.slice(0, 3).map((d) => (
                      <Link key={`don-${d.id}`} to="/nghiPhep/duyetDon" className="dongTomTat">
                        <div className="dongTomTatChinh">
                          <strong>
                            {d.hoVaTen} ({d.maNhanVien}) · {d.tenLoai}
                          </strong>
                          <span>
                            {dinhDangNgay(d.ngayBatDau)} – {dinhDangNgay(d.ngayKetThuc)} ({d.soNgayNghi} ngày)
                          </span>
                        </div>
                        <ChipTrangThai trangThai={d.trangThai} />
                      </Link>
                    ))}
                    {dieuChinhCho.slice(0, 2).map((yc) => (
                      <Link key={`dc-${yc.id}`} to="/chamCong/dieuChinh" className="dongTomTat">
                        <div className="dongTomTatChinh">
                          <strong>
                            {yc.hoVaTen} ({yc.maNhanVien}) · Điều chỉnh công
                          </strong>
                          <span>
                            Ngày {dinhDangNgay(yc.ngayCanDieuChinh)} · Đề xuất {dinhDangGio(yc.gioVaoDeXuat)} –{' '}
                            {dinhDangGio(yc.gioRaDeXuat)}
                          </span>
                        </div>
                        <ChipTrangThai trangThai={yc.trangThai} />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 3. Hoạt động gần đây của cá nhân (Chấm công 5 ngày gần nhất & Đơn nghỉ phép của tôi — hiển thị cho nhân viên không kiêm quản trị để trang đầy đặn) */}
      {coHoSo && !xemQuanTri && !laAdmin && (
        <section className="khoiTongQuan">
          <div className="luoiHaiCot">
            <div className="the theBieuDo">
              <div className="dauThe">
                <h3>Nhật ký chấm công gần đây của tôi</h3>
                <Link to="/chamCong" className="lienKet" style={{ fontSize: 12 }}>
                  Xem cả tháng →
                </Link>
              </div>
              {congGanDay.length === 0 ? (
                <div className="trongDanhSach">Chưa có bản ghi chấm công trong tháng này</div>
              ) : (
                <div className="danhSachTomTat">
                  {congGanDay.map((c) => (
                    <div key={c.ngayChamCong} className="dongTomTat">
                      <div className="dongTomTatChinh">
                        <strong>
                          {layThu(c.ngayChamCong)}, {dinhDangNgay(c.ngayChamCong)}
                        </strong>
                        <span>
                          Vào {dinhDangGio(c.gioVao)} · Ra {dinhDangGio(c.gioRa)} · {c.soGioLamThucTe ?? 0} giờ công
                        </span>
                      </div>
                      <ChipTrangThai
                        trangThai={!c.gioRa ? 'TU_CHOI' : c.diMuon || c.veSom ? 'CHO_DUYET' : 'HOP_LE'}
                        nhan={!c.gioRa ? 'Thiếu check-out' : c.diMuon ? 'Đi muộn' : c.veSom ? 'Về sớm' : 'Đúng giờ'}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="the theBieuDo">
              <div className="dauThe">
                <h3>Đơn nghỉ phép gần đây của tôi</h3>
                <Link to="/nghiPhep" className="lienKet" style={{ fontSize: 12 }}>
                  Quản lý đơn phép →
                </Link>
              </div>
              {donCuaToi.length === 0 ? (
                <div className="trongDanhSach">Bạn chưa gửi đơn nghỉ phép nào</div>
              ) : (
                <div className="danhSachTomTat">
                  {donCuaToi.slice(0, 4).map((d) => (
                    <Link key={d.id} to="/nghiPhep" className="dongTomTat">
                      <div className="dongTomTatChinh">
                        <strong>
                          {d.maDon} · {d.tenLoai}
                        </strong>
                        <span>
                          {dinhDangNgay(d.ngayBatDau)} – {dinhDangNgay(d.ngayKetThuc)} ({d.soNgayNghi} ngày)
                        </span>
                      </div>
                      <ChipTrangThai trangThai={d.trangThai} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 4. Quản trị & Nhật ký hệ thống (Admin, giamDoc) */}
      {(laAdmin || laGiamDoc) && (
        <section className="khoiTongQuan">
          <div className="tieuDeKhoi">
            <h2>{laAdmin ? 'Quản trị hệ thống & Nhật ký gần nhất' : 'Nhật ký hệ thống gần nhất'}</h2>
            <Link to="/heThong/nhatKy" className="lienKet" style={{ fontSize: 13 }}>
              Xem toàn bộ nhật ký →
            </Link>
          </div>
          {laAdmin && (
            <div className="luoiHaiCot" style={{ marginBottom: 14 }}>
              <TheChiSo
                tieuDe="Tài khoản đang hoạt động"
                giaTri={tkHoatDong ?? '—'}
                moTa="Quản lý tài khoản & phân quyền RBAC"
                bieuTuong={UserCheck}
                mauIcon="la"
                trangThai="thanhCong"
                duongDan="/heThong/taiKhoan"
              />
              <TheChiSo
                tieuDe="Tài khoản đang bị khóa"
                giaTri={tkBiKhoa ?? '—'}
                moTa={tkBiKhoa ? 'Tài khoản nghỉ việc hoặc bị khóa' : 'Không có tài khoản bị khóa'}
                bieuTuong={ShieldCheck}
                mauIcon={tkBiKhoa ? 'cam' : 'xanh'}
                trangThai={tkBiKhoa ? 'canhBao' : 'thanhCong'}
                duongDan="/heThong/taiKhoan"
              />
            </div>
          )}
          {nhatKyMoi.length > 0 && <BangDuLieu cot={COT_NHAT_KY} duLieu={nhatKyMoi} thongBaoRong="Chưa có nhật ký hệ thống" />}
        </section>
      )}
    </div>
  );
}

export default TrangTongQuan;
