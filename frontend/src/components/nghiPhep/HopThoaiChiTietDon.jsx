import { useState } from 'react';
import { Check, Trash2, X } from 'lucide-react';
import goiApi from '../../services/goiApi';
import ChipTrangThai from '../ChipTrangThai';
import HopThoai from '../HopThoai';
import HopThoaiBieuMau from '../HopThoaiBieuMau';
import NutBam from '../NutBam';
import { dinhDangNgay, dinhDangThoiGian, moTaNguoiDuyetDuKien } from '../../utils/dinhDang';

// Chi tiết đơn nghỉ. cheDo 'cuaToi': người gửi được hủy khi còn chờ duyệt;
// 'duyet': người có quyền theo chuỗi duyệt (don.duocDuyet do backend tính) thấy Duyệt / Từ chối
function HopThoaiChiTietDon({ don, cheDo, onDong, onDaXuLy }) {
  const [loi, setLoi] = useState('');
  const [dangGui, setDangGui] = useState(false);
  const [dangTuChoi, setDangTuChoi] = useState(false);

  const thucHien = async (hanhDong) => {
    setDangGui(true);
    setLoi('');
    try {
      const kq = await goiApi.post(`/donNghiPhep/${don.id}/${hanhDong}`);
      onDaXuLy(kq.message);
    } catch (e) {
      setLoi(e.message);
      setDangGui(false);
    }
  };

  if (dangTuChoi) {
    return (
      <HopThoaiBieuMau
        tieuDe={`Từ chối đơn ${don.maDon}`}
        truong={[{ ten: 'lyDoTuChoi', nhan: 'Lý do từ chối', kieu: 'textarea', batBuoc: true }]}
        nhanNutGui="Từ chối"
        bienTheNut="vang"
        onGui={async (giaTri) => {
          const kq = await goiApi.post(`/donNghiPhep/${don.id}/tuChoi`, giaTri);
          onDaXuLy(kq.message);
        }}
        onDong={() => setDangTuChoi(false)}
      />
    );
  }

  let chanTrang = <NutBam bienThe="phu" onClick={onDong}>Đóng</NutBam>;
  if (cheDo === 'duyet' && don.duocDuyet) {
    chanTrang = (
      <>
        <NutBam bienThe="phu" bieuTuong={X} disabled={dangGui} onClick={() => setDangTuChoi(true)}>Từ chối</NutBam>
        <NutBam bieuTuong={Check} disabled={dangGui} onClick={() => thucHien('duyet')}>Duyệt</NutBam>
      </>
    );
  } else if (cheDo === 'cuaToi' && don.trangThai === 'CHO_DUYET') {
    chanTrang = (
      <>
        <NutBam bienThe="phu" onClick={onDong}>Đóng</NutBam>
        <NutBam bienThe="vang" bieuTuong={Trash2} disabled={dangGui} onClick={() => window.confirm(`Hủy đơn ${don.maDon}? Thao tác không thể hoàn tác.`) && thucHien('huy')}>Hủy đơn</NutBam>
      </>
    );
  }

  return (
    <HopThoai tieuDe={`Đơn nghỉ phép ${don.maDon}`} onDong={onDong} chanTrang={chanTrang}>
      {loi && <div className="thongBao loi">{loi}</div>}
      <div className="luoiThongTin">
        <div className="oThongTin"><span>Nhân viên</span><strong>{don.hoVaTen} ({don.maNhanVien})</strong></div>
        <div className="oThongTin"><span>Phòng ban</span><strong>{don.tenPhongBan}</strong></div>
        <div className="oThongTin">
          <span>Loại nghỉ</span>
          <strong>{don.tenLoai} · {don.coLuong ? 'có lương' : 'không lương'}{don.truVaoQuyPhepNam ? ' · trừ quỹ phép' : ''}</strong>
        </div>
        <div className="oThongTin">
          <span>Thời gian</span>
          <strong>{dinhDangNgay(don.ngayBatDau)} - {dinhDangNgay(don.ngayKetThuc)} ({don.soNgayNghi} ngày)</strong>
        </div>
        <div className="oThongTin"><span>Trạng thái</span><strong><ChipTrangThai trangThai={don.trangThai} /></strong></div>
        <div className="oThongTin"><span>Ngày gửi</span><strong>{dinhDangThoiGian(don.ngayTao)}</strong></div>
        {don.trangThai === 'CHO_DUYET' && (
          <div className="oThongTin"><span>Người duyệt dự kiến</span><strong>{moTaNguoiDuyetDuKien(don.nguoiDuyetDuKien)}</strong></div>
        )}
        {don.tenNguoiDuyet && (
          <div className="oThongTin"><span>Người xử lý</span><strong>{don.tenNguoiDuyet} · {dinhDangThoiGian(don.thoiGianDuyet)}</strong></div>
        )}
      </div>
      <p><strong>Lý do:</strong> {don.lyDo}</p>
      {don.lyDoTuChoi && <p><strong>Lý do từ chối:</strong> {don.lyDoTuChoi}</p>}
      {cheDo === 'duyet' && don.trangThai === 'CHO_DUYET' && !don.duocDuyet && (
        <div className="chuPhu">Đơn này thuộc quyền duyệt của {moTaNguoiDuyetDuKien(don.nguoiDuyetDuKien)}.</div>
      )}
    </HopThoai>
  );
}

export default HopThoaiChiTietDon;
