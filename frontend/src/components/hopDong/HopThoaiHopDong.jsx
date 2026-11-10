import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, SlidersHorizontal, Ban } from 'lucide-react';
import goiApi from '../../services/goiApi';
import HopThoai from '../HopThoai';
import HopThoaiBieuMau from '../HopThoaiBieuMau';
import NutBam from '../NutBam';
import ChipTrangThai from '../ChipTrangThai';
import BangDuLieu from '../BangDuLieu';
import { useXacThuc } from '../../context/NguCanhXacThuc';
import {
  dinhDangNgay,
  dinhDangThoiGian,
  dinhDangTien,
  NHAN_LOAI_HOP_DONG,
  NHAN_HANH_DONG_HOP_DONG,
  thanhLuaChon,
} from '../../utils/dinhDang';

const LUA_CHON_LOAI = thanhLuaChon(NHAN_LOAI_HOP_DONG);
const NHAN_TRANG_THAI = { HIEU_LUC: 'Hiệu lực', HET_HAN: 'Hết hạn', DA_CHAM_DUT: 'Đã chấm dứt' };

// Mô tả thay đổi của một dòng lichsuhopdong (chỉ liệt kê cột có đổi)
function moTaThayDoi(ls) {
  if (ls.hanhDong === 'TAO_MOI') {
    return `${NHAN_LOAI_HOP_DONG[ls.loaiHopDongMoi]}, ${dinhDangNgay(ls.ngayBatDauMoi)} → ${ls.ngayKetThucMoi ? dinhDangNgay(ls.ngayKetThucMoi) : 'không thời hạn'}, lương ${dinhDangTien(ls.luongCoBanMoi)}`;
  }
  const thayDoi = [];
  if (ls.luongCoBanCu !== ls.luongCoBanMoi) thayDoi.push(`Lương ${dinhDangTien(ls.luongCoBanCu)} → ${dinhDangTien(ls.luongCoBanMoi)}`);
  if (ls.mucPhuCapCu !== ls.mucPhuCapMoi) thayDoi.push(`Phụ cấp ${dinhDangTien(ls.mucPhuCapCu)} → ${dinhDangTien(ls.mucPhuCapMoi)}`);
  if (ls.ngayKetThucCu !== ls.ngayKetThucMoi)
    thayDoi.push(`Kết thúc ${dinhDangNgay(ls.ngayKetThucCu)} → ${dinhDangNgay(ls.ngayKetThucMoi)}`);
  if (ls.trangThaiCu !== ls.trangThaiMoi)
    thayDoi.push(
      `Trạng thái ${NHAN_TRANG_THAI[ls.trangThaiCu] ?? ls.trangThaiCu} → ${NHAN_TRANG_THAI[ls.trangThaiMoi] ?? ls.trangThaiMoi}`,
    );
  return thayDoi.join('; ') || '—';
}

const COT_LICH_SU = [
  { khoa: 'ngayGhiNhan', tieuDe: 'Thời gian', hienThi: (d) => dinhDangThoiGian(d.ngayGhiNhan) },
  { khoa: 'hanhDong', tieuDe: 'Hành động', hienThi: (d) => NHAN_HANH_DONG_HOP_DONG[d.hanhDong] ?? d.hanhDong },
  { khoa: 'thayDoi', tieuDe: 'Thay đổi', sapXep: false, hienThi: moTaThayDoi },
  { khoa: 'lyDoThayDoi', tieuDe: 'Lý do', sapXep: false, hienThi: (d) => d.lyDoThayDoi || '—' },
  { khoa: 'tenNguoiThucHien', tieuDe: 'Người thực hiện' },
];

// Chi tiết hợp đồng + lịch sử; HR (không phải hợp đồng của mình) có thêm gia hạn / điều chỉnh / chấm dứt.
// onThayDoi: báo nơi gọi tải lại danh sách sau khi thao tác thành công
export function HopThoaiChiTietHopDong({ hopDongId, onDong, onThayDoi }) {
  const { nguoiDung } = useXacThuc();
  const [hopDong, setHopDong] = useState(null);
  const [loi, setLoi] = useState('');
  const [thaoTac, setThaoTac] = useState(null);

  const tai = useCallback(() => {
    goiApi
      .get(`/hopDong/${hopDongId}`)
      .then((kq) => setHopDong(kq.data))
      .catch((e) => setLoi(e.message));
  }, [hopDongId]);
  useEffect(tai, [tai]);

  const laHR = nguoiDung.vaiTro.includes('HR') && hopDong && hopDong.nhanVienId !== nguoiDung.nhanVienId;
  const thucHien = (duongDan) => async (giaTri) => {
    const kq = await goiApi.post(`/hopDong/${hopDongId}/${duongDan}`, giaTri);
    setHopDong(kq.data);
    setThaoTac(null);
    onThayDoi?.();
  };

  return (
    <>
      <HopThoai tieuDe={hopDong ? `Hợp đồng ${hopDong.maHopDong}` : 'Hợp đồng'} onDong={onDong} rong={860}>
        {loi && <div className="thongBao loi">{loi}</div>}
        {!hopDong && !loi && <div className="chuPhu">Đang tải...</div>}
        {hopDong && (
          <>
            <div className="dauThe">
              <div>
                <strong>{hopDong.hoVaTen}</strong>{' '}
                <span className="chuPhu">
                  ({hopDong.maNhanVien} · {hopDong.tenChucDanh} - {hopDong.tenPhongBan})
                </span>
              </div>
              <ChipTrangThai trangThai={hopDong.trangThai} kieu="chip" />
            </div>
            <div className="luoiThongTin">
              <div className="oThongTin">
                <span>Loại hợp đồng</span>
                <strong>{NHAN_LOAI_HOP_DONG[hopDong.loaiHopDong]}</strong>
              </div>
              <div className="oThongTin">
                <span>Ngày bắt đầu</span>
                <strong>{dinhDangNgay(hopDong.ngayBatDau)}</strong>
              </div>
              <div className="oThongTin">
                <span>Ngày kết thúc</span>
                <strong>{hopDong.ngayKetThuc ? dinhDangNgay(hopDong.ngayKetThuc) : 'Không thời hạn'}</strong>
              </div>
              <div className="oThongTin">
                <span>Lương cơ bản</span>
                <strong>{dinhDangTien(hopDong.luongCoBan)}</strong>
              </div>
              <div className="oThongTin">
                <span>Phụ cấp</span>
                <strong>{dinhDangTien(hopDong.mucPhuCap)}</strong>
              </div>
              <div className="oThongTin">
                <span>File hợp đồng</span>
                <strong>{hopDong.duongDanFileHopDong || '—'}</strong>
              </div>
            </div>

            {laHR && (
              <div className="hangNutPhai" style={{ margin: '16px 0' }}>
                {hopDong.loaiHopDong === 'XAC_DINH_THOI_HAN' && hopDong.trangThai === 'HIEU_LUC' && (
                  <NutBam bienThe="phu" bieuTuong={CalendarPlus} onClick={() => setThaoTac('giaHan')}>
                    Gia hạn
                  </NutBam>
                )}
                {hopDong.trangThai === 'HIEU_LUC' && (
                  <NutBam bienThe="phu" bieuTuong={SlidersHorizontal} onClick={() => setThaoTac('dieuChinh')}>
                    Điều chỉnh
                  </NutBam>
                )}
                {hopDong.trangThai !== 'DA_CHAM_DUT' && (
                  <NutBam bienThe="phu" bieuTuong={Ban} onClick={() => setThaoTac('chamDut')}>
                    Chấm dứt
                  </NutBam>
                )}
              </div>
            )}

            <h3 style={{ fontSize: 14, margin: '16px 0 8px' }}>Lịch sử thay đổi</h3>
            <BangDuLieu cot={COT_LICH_SU} duLieu={hopDong.lichSu} thongBaoRong="Chưa có lịch sử" />
          </>
        )}
      </HopThoai>

      {thaoTac === 'giaHan' && (
        <HopThoaiBieuMau
          tieuDe="Gia hạn hợp đồng"
          moTa="Hợp đồng xác định thời hạn tối đa 36 tháng kể từ ngày bắt đầu (Bộ luật Lao động 2019, Điều 20)."
          truong={[
            { ten: 'ngayKetThucMoi', nhan: 'Ngày kết thúc mới', kieu: 'date', batBuoc: true },
            { ten: 'lyDo', nhan: 'Lý do', kieu: 'textarea' },
          ]}
          nhanNutGui="Gia hạn"
          onGui={thucHien('giaHan')}
          onDong={() => setThaoTac(null)}
        />
      )}
      {thaoTac === 'dieuChinh' && (
        <HopThoaiBieuMau
          tieuDe="Điều chỉnh hợp đồng"
          giaTriBanDau={{
            luongCoBan: Number(hopDong.luongCoBan),
            mucPhuCap: Number(hopDong.mucPhuCap),
            duongDanFileHopDong: hopDong.duongDanFileHopDong ?? '',
          }}
          truong={[
            { ten: 'luongCoBan', nhan: 'Lương cơ bản (đ)', kieu: 'number', batBuoc: true },
            { ten: 'mucPhuCap', nhan: 'Phụ cấp (đ)', kieu: 'number' },
            { ten: 'duongDanFileHopDong', nhan: 'Đường dẫn file phụ lục', rongHet: true },
            { ten: 'lyDo', nhan: 'Lý do điều chỉnh', kieu: 'textarea', batBuoc: true },
          ]}
          onGui={thucHien('dieuChinh')}
          onDong={() => setThaoTac(null)}
        />
      )}
      {thaoTac === 'chamDut' && (
        <HopThoaiBieuMau
          tieuDe="Chấm dứt hợp đồng"
          moTa="Hợp đồng chấm dứt sẽ không thể mở lại. Trạng thái lao động của nhân viên đổi riêng ở hồ sơ nhân sự."
          truong={[
            { ten: 'ngayChamDut', nhan: 'Ngày chấm dứt', kieu: 'date', batBuoc: true },
            { ten: 'lyDo', nhan: 'Lý do', kieu: 'textarea', batBuoc: true },
          ]}
          nhanNutGui="Chấm dứt"
          onGui={thucHien('chamDut')}
          onDong={() => setThaoTac(null)}
        />
      )}
    </>
  );
}

// HR lập hợp đồng mới. nhanVien: chọn sẵn (từ chi tiết nhân viên) hoặc tìm theo tên/mã.
// Bỏ người đã nghỉ việc và chính HR đang đăng nhập (backend cũng chặn: 409 / 403).
export function HopThoaiLapHopDong({ nhanVien, onDong, onDaTao }) {
  const { nguoiDung } = useXacThuc();
  const truong = [
    ...(nhanVien
      ? []
      : [
          {
            ten: 'nhanVienId',
            nhan: 'Nhân viên',
            kieu: 'nhanVien',
            batBuoc: true,
            locNhanVien: { trangThai: ['THU_VIEC', 'CHINH_THUC', 'TAM_NGHI'], boQuaIds: [nguoiDung.nhanVienId] },
          },
        ]),
    { ten: 'loaiHopDong', nhan: 'Loại hợp đồng', kieu: 'select', luaChon: LUA_CHON_LOAI, batBuoc: true },
    { ten: 'ngayBatDau', nhan: 'Ngày bắt đầu', kieu: 'date', batBuoc: true },
    { ten: 'ngayKetThuc', nhan: 'Ngày kết thúc', kieu: 'date', ghiChu: 'Bỏ trống với hợp đồng không xác định thời hạn' },
    { ten: 'luongCoBan', nhan: 'Lương cơ bản (đ)', kieu: 'number', batBuoc: true },
    { ten: 'mucPhuCap', nhan: 'Phụ cấp (đ)', kieu: 'number' },
    { ten: 'duongDanFileHopDong', nhan: 'Đường dẫn file hợp đồng', rongHet: true },
    { ten: 'lyDo', nhan: 'Ghi chú', kieu: 'textarea' },
  ];
  return (
    <HopThoaiBieuMau
      tieuDe={nhanVien ? `Lập hợp đồng cho ${nhanVien.hoVaTen}` : 'Lập hợp đồng'}
      moTa="Thử việc tối đa 180 ngày; xác định thời hạn tối đa 36 tháng. Không được chồng thời gian với hợp đồng đang hiệu lực."
      truong={truong}
      nhanNutGui="Lập hợp đồng"
      onGui={async (giaTri) => {
        const kq = await goiApi.post('/hopDong', { ...giaTri, nhanVienId: nhanVien?.id ?? giaTri.nhanVienId });
        onDaTao(kq.data);
      }}
      onDong={onDong}
    />
  );
}

export const COT_HOP_DONG = [
  { khoa: 'maHopDong', tieuDe: 'Mã hợp đồng' },
  { khoa: 'loaiHopDong', tieuDe: 'Loại', hienThi: (d) => NHAN_LOAI_HOP_DONG[d.loaiHopDong] },
  { khoa: 'ngayBatDau', tieuDe: 'Bắt đầu', hienThi: (d) => dinhDangNgay(d.ngayBatDau) },
  { khoa: 'ngayKetThuc', tieuDe: 'Kết thúc', hienThi: (d) => (d.ngayKetThuc ? dinhDangNgay(d.ngayKetThuc) : 'Không thời hạn') },
  { khoa: 'luongCoBan', tieuDe: 'Lương cơ bản', canPhai: true, hienThi: (d) => dinhDangTien(d.luongCoBan) },
  { khoa: 'trangThai', tieuDe: 'Trạng thái', hienThi: (d) => <ChipTrangThai trangThai={d.trangThai} /> },
];
