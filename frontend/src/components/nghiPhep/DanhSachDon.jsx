import { useCallback, useEffect, useState } from 'react';
import goiApi from '../../services/goiApi';
import BangDuLieu from '../BangDuLieu';
import ChipTrangThai from '../ChipTrangThai';
import PhanTrang from '../PhanTrang';
import ThanhLoc from '../ThanhLoc';
import HopThoaiChiTietDon from './HopThoaiChiTietDon';
import { dinhDangNgay, locThamSo, moTaNguoiDuyetDuKien, NHAN_TRANG_THAI_DON, thanhLuaChon } from '../../utils/dinhDang';

const COT_DON = [
  { khoa: 'maDon', tieuDe: 'Mã đơn' },
  { khoa: 'tenLoai', tieuDe: 'Loại nghỉ' },
  { khoa: 'ngayBatDau', tieuDe: 'Thời gian', hienThi: (d) => `${dinhDangNgay(d.ngayBatDau)} - ${dinhDangNgay(d.ngayKetThuc)}` },
  { khoa: 'soNgayNghi', tieuDe: 'Số ngày', canPhai: true },
  { khoa: 'trangThai', tieuDe: 'Trạng thái', hienThi: (d) => <ChipTrangThai trangThai={d.trangThai} /> },
  {
    khoa: 'tenNguoiDuyet',
    tieuDe: 'Người duyệt',
    sapXep: false,
    hienThi: (d) =>
      d.trangThai === 'CHO_DUYET' ? (
        <span className="chuPhu">Chờ {moTaNguoiDuyetDuKien(d.nguoiDuyetDuKien)}</span>
      ) : (
        (d.tenNguoiDuyet ?? '—')
      ),
  },
];
const COT_CO_NHAN_VIEN = [
  {
    khoa: 'hoVaTen',
    tieuDe: 'Nhân viên',
    hienThi: (d) => (
      <>
        {d.hoVaTen}{' '}
        <span className="chuPhu">
          {d.maNhanVien} · {d.tenPhongBan}
        </span>
      </>
    ),
  },
  ...COT_DON,
];

// cheDo 'cuaToi': đơn của mình (/donNghiPhep/cuaToi); 'duyet': đơn trong phạm vi (/donNghiPhep).
// lamMoi: đổi giá trị để tải lại từ bên ngoài (vd. vừa tạo đơn); onDaXuLy báo trang cha cập nhật số liệu
function DanhSachDon({ cheDo, lamMoi, onDaXuLy }) {
  const laDuyet = cheDo === 'duyet';
  const [tuKhoa, setTuKhoa] = useState('');
  const [loc, setLoc] = useState(laDuyet ? { trangThai: 'CHO_DUYET' } : {});
  const [thang, setThang] = useState('');
  const [trang, setTrang] = useState(1);
  const [dsLoai, setDsLoai] = useState([]);
  const [ketQua, setKetQua] = useState(null);
  const [loi, setLoi] = useState('');
  const [thongBao, setThongBao] = useState('');
  const [dangXem, setDangXem] = useState(null);

  useEffect(() => {
    goiApi
      .get('/loaiNghiPhep')
      .then((kq) => setDsLoai(kq.data))
      .catch(() => {});
  }, []);

  const tai = useCallback(
    (laHienHanh = () => true) => {
      goiApi
        .get(laDuyet ? '/donNghiPhep' : '/donNghiPhep/cuaToi', {
          params: locThamSo({ tuKhoa, ...loc, thang, trang, kichThuoc: 20 }),
        })
        .then((kq) => {
          if (laHienHanh()) {
            setKetQua(kq.data);
            setLoi('');
          }
        })
        .catch((e) => {
          if (laHienHanh()) setLoi(e.message);
        });
    },
    [laDuyet, tuKhoa, loc, thang, trang],
  );

  // Chờ người dùng gõ xong mới gọi API
  useEffect(() => {
    // Bỏ qua phản hồi cũ khi đổi bộ lọc nhanh
    let daHuy = false;
    const hen = setTimeout(() => tai(() => !daHuy), 300);
    return () => {
      daHuy = true;
      clearTimeout(hen);
    };
  }, [tai, lamMoi]);

  const boLoc = [
    { khoa: 'trangThai', nhan: 'Trạng thái', luaChon: thanhLuaChon(NHAN_TRANG_THAI_DON) },
    { khoa: 'loaiNghiPhepId', nhan: 'Loại nghỉ', luaChon: dsLoai.map((l) => ({ giaTri: String(l.id), nhan: l.tenLoai })) },
  ];

  return (
    <>
      <ThanhLoc
        tuKhoa={tuKhoa}
        onDoiTuKhoa={(v) => {
          setTuKhoa(v);
          setTrang(1);
        }}
        goiYTim={laDuyet ? 'Mã hoặc tên nhân viên...' : 'Tìm kiếm...'}
        boLoc={boLoc}
        giaTriLoc={loc}
        onDoiLoc={(khoa, v) => {
          setLoc((cu) => ({ ...cu, [khoa]: v }));
          setTrang(1);
        }}
        phanPhai={
          <input
            type="month"
            className="oLoc"
            value={thang}
            onChange={(e) => {
              setThang(e.target.value);
              setTrang(1);
            }}
            title="Lọc theo tháng có ngày nghỉ"
          />
        }
      />
      {loi && <div className="thongBao loi">{loi}</div>}
      {thongBao && <div className="thongBao thanhCong">{thongBao}</div>}
      <BangDuLieu
        cot={laDuyet ? COT_CO_NHAN_VIEN : COT_DON}
        duLieu={ketQua?.items ?? []}
        onHanhDong={(d) => setDangXem(d)}
        thongBaoRong="Không có đơn nghỉ phép phù hợp"
      />
      <PhanTrang phanTrang={ketQua?.phanTrang} onDoiTrang={setTrang} />

      {dangXem && (
        <HopThoaiChiTietDon
          don={dangXem}
          cheDo={cheDo}
          onDong={() => setDangXem(null)}
          onDaXuLy={(tb) => {
            setDangXem(null);
            setThongBao(tb);
            tai();
            onDaXuLy?.();
          }}
        />
      )}
    </>
  );
}

export default DanhSachDon;
