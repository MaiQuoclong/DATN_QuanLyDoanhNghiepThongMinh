import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import goiApi from '../../services/goiApi';
import useThongBao from '../../hooks/useThongBao';
import { useXacThuc } from '../../context/NguCanhXacThuc';
import BangDuLieu from '../../components/BangDuLieu';
import ChipTrangThai from '../../components/ChipTrangThai';
import HopThoaiBieuMau from '../../components/HopThoaiBieuMau';
import NutBam from '../../components/NutBam';
import PhanTrang from '../../components/PhanTrang';
import ThanhLoc from '../../components/ThanhLoc';
import { dinhDangThoiGian, dinhDangTien, locThamSo, thanhLuaChon } from '../../utils/dinhDang';
import { NHAN_LOAI_KTKL } from './TrangQuyetDinh';

const KICH_THUOC = 20;
const NHAN_TRANG_THAI = { CHO_DUYET: 'Chờ HR xử lý', CHO_KY: 'Chờ Giám đốc ký', DA_DUYET: 'Đã ký quyết định', TU_CHOI: 'Từ chối' };

const truongNoiDung = [
  { ten: 'soTienDeXuat', nhan: 'Số tiền (VNĐ)', kieu: 'number', ghiChu: 'Để trống = 0. Khen thưởng cộng, kỷ luật trừ vào lương tháng ký' },
  { ten: 'tieuDe', nhan: 'Tiêu đề', batBuoc: true, rongHet: true },
  { ten: 'lyDo', nhan: 'Lý do', kieu: 'textarea', batBuoc: true },
];

const truongNguoiKy = (dsNguoiKy) => ({
  ten: 'nguoiKyDuyetId',
  nhan: 'Giám đốc ký',
  kieu: 'select',
  batBuoc: true,
  rongHet: true,
  luaChon: dsNguoiKy.map((n) => ({ giaTri: n.id, nhan: `${n.maNhanVien} - ${n.hoVaTen}` })),
});

const truongDeXuat = ({ coNhanVien, dsNguoiKy }) => [
  ...(coNhanVien
    ? [{ ten: 'nhanVienId', nhan: 'Nhân viên', kieu: 'nhanVien', batBuoc: true, locNhanVien: { trangThai: ['THU_VIEC', 'CHINH_THUC'] } }]
    : []),
  ...(coNhanVien ? [{ ten: 'loaiDeXuat', nhan: 'Loại', kieu: 'select', batBuoc: true, luaChon: thanhLuaChon(NHAN_LOAI_KTKL) }] : []),
  ...truongNoiDung,
  ...(dsNguoiKy ? [truongNguoiKy(dsNguoiKy)] : []),
];

// Số tiền API trả dạng "1000000.00": so sánh theo giá trị số để không coi là đã đổi
const khacGoc = (goc) => (k, v) => (k === 'soTienDeXuat' ? Number(v || 0) !== Number(goc[k] || 0) : String(v) !== String(goc[k] ?? ''));

// Tab Đề xuất (docs/phan-quyen.md mục 9):
// quanLy (PM) / giamDoc tạo đề xuất -> HR từ chối hoặc trình Giám đốc ký (chọn đích danh, có thể chỉnh nội dung)
// -> Giám đốc được trình ký (quyết định sinh lúc ký) / trả lại / từ chối. HR lập trực tiếp = đề xuất vào thẳng chờ ký.
function TrangDeXuat() {
  const { nguoiDung } = useXacThuc();
  const laHR = nguoiDung.vaiTro.includes('HR');
  const laGiamDoc = nguoiDung.vaiTro.includes('giamDoc');
  const duocTao = laHR || nguoiDung.vaiTro.some((v) => ['quanLy', 'giamDoc'].includes(v));
  const [kq, setKq] = useState(null);
  const [tuKhoa, setTuKhoa] = useState('');
  const [loc, setLoc] = useState({ trangThai: laGiamDoc && !laHR ? 'CHO_KY' : 'CHO_DUYET' });
  const [trang, setTrang] = useState(1);
  const { loi, thongBao, baoLoi, baoThanhCong } = useThongBao();
  const [dangTao, setDangTao] = useState(false);
  const [dangXem, setDangXem] = useState(null);
  const [cheDo, setCheDo] = useState(null); // 'sua' | 'tuChoi' | 'trinhKy' | 'ky' | 'traLai'
  const [dsNguoiKy, setDsNguoiKy] = useState([]);

  const tai = useCallback(() => {
    goiApi
      .get('/deXuatKhenThuongKyLuat', { params: locThamSo({ tuKhoa: tuKhoa.trim(), ...loc, trang, kichThuoc: KICH_THUOC }) })
      .then((r) => {
        setKq(r.data);
        baoLoi('');
      })
      .catch((e) => baoLoi(e.message));
  }, [tuKhoa, loc, trang, baoLoi]);
  useEffect(() => {
    const hen = setTimeout(tai, 250);
    return () => clearTimeout(hen);
  }, [tai]);
  useEffect(() => {
    if (laHR)
      goiApi
        .get('/quyetDinhKhenThuongKyLuat/nguoiKy')
        .then((r) => setDsNguoiKy(r.data))
        .catch((e) => baoLoi(e.message));
  }, [laHR, baoLoi]);

  const xong = (thongDiep) => {
    setDangTao(false);
    setDangXem(null);
    setCheDo(null);
    baoThanhCong(thongDiep);
    tai();
  };
  const laCuaToi = (d) => d.nguoiDeXuatId === nguoiDung.nhanVienId;
  const veToi = (d) => d.nhanVienId === nguoiDung.nhanVienId;
  // Giám đốc được chọn ký và không phải người nhận
  const toiDuocKy = (d) => laGiamDoc && d.trangThai === 'CHO_KY' && d.nguoiXuLyId === nguoiDung.nhanVienId && !veToi(d);
  // Giám đốc ký không được là người nhận và không phải chính người trình
  const dsKyDuoc = dsNguoiKy.filter((n) => n.id !== nguoiDung.nhanVienId);
  const nguoiKyCho = (d) => dsKyDuoc.filter((n) => n.id !== d.nhanVienId);

  const cot = [
    { khoa: 'hoVaTen', tieuDe: 'Nhân viên', hienThi: (d) => `${d.maNhanVien} - ${d.hoVaTen}` },
    { khoa: 'tenPhongBan', tieuDe: 'Phòng ban', hienThi: (d) => d.tenPhongBan ?? '—' },
    { khoa: 'loaiDeXuat', tieuDe: 'Loại', hienThi: (d) => <ChipTrangThai trangThai={d.loaiDeXuat} /> },
    { khoa: 'tieuDe', tieuDe: 'Tiêu đề' },
    { khoa: 'soTienDeXuat', tieuDe: 'Số tiền', canPhai: true, hienThi: (d) => dinhDangTien(d.soTienDeXuat) },
    { khoa: 'tenNguoiDeXuat', tieuDe: 'Người đề xuất' },
    { khoa: 'ngayTao', tieuDe: 'Ngày tạo', hienThi: (d) => dinhDangThoiGian(d.ngayTao) },
    {
      khoa: 'trangThai',
      tieuDe: 'Trạng thái',
      hienThi: (d) => <ChipTrangThai trangThai={d.trangThai} nhan={NHAN_TRANG_THAI[d.trangThai]} />,
    },
  ];

  const lienKet = (nhan, cheDoMoi) => (
    <button type="button" className="lienKet" onClick={() => setCheDo(cheDoMoi)}>
      {nhan}
    </button>
  );
  const noi = (cacNut) => cacNut.filter(Boolean).flatMap((n, i) => (i ? [' · ', n] : [n]));

  // Thông tin đề xuất + các thao tác được phép, hiển thị trong hộp thoại xem
  const moTaDeXuat = (d) => {
    const cacNut = [];
    if (d.trangThai === 'CHO_DUYET' && laHR && !veToi(d))
      cacNut.push(lienKet('Trình Giám đốc ký', 'trinhKy'), lienKet('Từ chối', 'tuChoi'));
    if (d.trangThai === 'CHO_KY' && laHR && !veToi(d)) cacNut.push(lienKet('Đổi Giám đốc ký', 'trinhKy'));
    if (toiDuocKy(d)) cacNut.push(lienKet('Ký quyết định', 'ky'), lienKet('Trả lại', 'traLai'), lienKet('Từ chối', 'tuChoi'));
    if (d.trangThai === 'CHO_DUYET' && laCuaToi(d)) {
      cacNut.push(
        lienKet('Sửa', 'sua'),
        <button
          key="thuHoi"
          type="button"
          className="lienKet"
          onClick={async () => {
            if (!window.confirm('Thu hồi đề xuất này?')) return;
            try {
              xong((await goiApi.delete(`/deXuatKhenThuongKyLuat/${d.id}`)).message);
            } catch (e) {
              setDangXem(null);
              baoLoi(e.message);
            }
          }}
        >
          Thu hồi
        </button>,
      );
    }
    return (
      <>
        <div>
          <strong>{d.tieuDe}</strong> · {NHAN_LOAI_KTKL[d.loaiDeXuat]} · {dinhDangTien(d.soTienDeXuat)}
        </div>
        <div>
          Nhân viên: {d.maNhanVien} - {d.hoVaTen} · Người đề xuất: {d.tenNguoiDeXuat}
        </div>
        <div style={{ whiteSpace: 'pre-wrap' }}>Lý do: {d.lyDo}</div>
        {d.trangThai === 'CHO_KY' && <div>Chờ ký: {d.tenNguoiXuLy ?? '—'}</div>}
        {(d.ghiChuXuLy || ['DA_DUYET', 'TU_CHOI'].includes(d.trangThai)) && (
          <div>
            {d.trangThai === 'CHO_KY' ? 'Ghi chú trình ký' : `Xử lý: ${d.tenNguoiXuLy ?? '—'}`}
            {d.ghiChuXuLy ? ` · ${d.ghiChuXuLy}` : ''}
            {d.soQuyetDinh ? ` · Quyết định ${d.soQuyetDinh}` : ''}
          </div>
        )}
        {cacNut.length > 0 && <div style={{ marginTop: 8 }}>{noi(cacNut)}</div>}
      </>
    );
  };

  return (
    <div>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Đề xuất khen thưởng - kỷ luật</h1>
          <div className="chuPhu">HR xem xét và trình Giám đốc ký · quyết định chỉ được ban hành khi Giám đốc ký</div>
        </div>
        {duocTao && (
          <NutBam
            bieuTuong={Plus}
            onClick={() => {
              baoThanhCong('');
              setDangTao(true);
            }}
          >
            {laHR ? 'Lập và trình ký' : 'Tạo đề xuất'}
          </NutBam>
        )}
      </div>
      {loi && <div className="thongBao loi">{loi}</div>}
      {thongBao && <div className="thongBao thanhCong">{thongBao}</div>}
      <ThanhLoc
        tuKhoa={tuKhoa}
        onDoiTuKhoa={(v) => {
          setTuKhoa(v);
          setTrang(1);
        }}
        goiYTim="Tìm mã/tên nhân viên, tiêu đề..."
        boLoc={[
          { khoa: 'trangThai', nhan: 'Tất cả trạng thái', luaChon: thanhLuaChon(NHAN_TRANG_THAI) },
          { khoa: 'loaiDeXuat', nhan: 'Tất cả loại', luaChon: thanhLuaChon(NHAN_LOAI_KTKL) },
        ]}
        giaTriLoc={loc}
        onDoiLoc={(k, v) => {
          setLoc((c) => ({ ...c, [k]: v }));
          setTrang(1);
        }}
      />
      <BangDuLieu
        cot={cot}
        duLieu={kq?.items ?? []}
        onHanhDong={(d) => {
          baoLoi('');
          setCheDo(null);
          setDangXem(d);
        }}
        thongBaoRong="Không có đề xuất"
      />
      <PhanTrang phanTrang={kq?.phanTrang} onDoiTrang={setTrang} />

      {dangTao && (
        <HopThoaiBieuMau
          tieuDe={laHR ? 'Lập khen thưởng - kỷ luật và trình Giám đốc ký' : 'Tạo đề xuất khen thưởng - kỷ luật'}
          moTa={laHR ? 'Quyết định chỉ được ban hành (và tính vào lương) khi Giám đốc được chọn ký.' : undefined}
          truong={truongDeXuat({ coNhanVien: true, dsNguoiKy: laHR ? dsKyDuoc : null })}
          nhanNutGui={laHR ? 'Trình ký' : 'Gửi đề xuất'}
          onGui={async (g) => xong((await goiApi.post('/deXuatKhenThuongKyLuat', locThamSo(g))).message)}
          onDong={() => setDangTao(false)}
        />
      )}
      {dangXem && !cheDo && (
        <HopThoaiBieuMau
          tieuDe={`Đề xuất #${dangXem.id}`}
          moTa={moTaDeXuat(dangXem)}
          loiNgoai={loi}
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
          truong={[
            { ten: 'loaiDeXuat', nhan: 'Loại', kieu: 'select', batBuoc: true, luaChon: thanhLuaChon(NHAN_LOAI_KTKL) },
            ...truongNoiDung,
          ]}
          giaTriBanDau={dangXem}
          onGui={async (g) => {
            const khac = khacGoc(dangXem);
            const body = Object.fromEntries(Object.entries(g).filter(([k, v]) => khac(k, v)));
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
      {dangXem && cheDo === 'trinhKy' && (
        <HopThoaiBieuMau
          tieuDe={`Trình Giám đốc ký đề xuất #${dangXem.id}`}
          moTa={`${NHAN_LOAI_KTKL[dangXem.loaiDeXuat]} cho ${dangXem.maNhanVien} - ${dangXem.hoVaTen}. Có thể chỉnh nội dung trước khi trình; nội dung gốc được lưu ở nhật ký.`}
          truong={[...truongNoiDung, truongNguoiKy(nguoiKyCho(dangXem)), { ten: 'ghiChuXuLy', nhan: 'Ghi chú trình ký', rongHet: true }]}
          giaTriBanDau={{ tieuDe: dangXem.tieuDe, lyDo: dangXem.lyDo, soTienDeXuat: dangXem.soTienDeXuat }}
          nhanNutGui="Trình ký"
          onGui={async (g) => {
            const khac = khacGoc(dangXem);
            const body = {
              ...Object.fromEntries(['tieuDe', 'lyDo', 'soTienDeXuat'].filter((k) => khac(k, g[k])).map((k) => [k, g[k]])),
              nguoiKyDuyetId: g.nguoiKyDuyetId,
              ...(g.ghiChuXuLy ? { ghiChuXuLy: g.ghiChuXuLy } : {}),
            };
            xong((await goiApi.post(`/deXuatKhenThuongKyLuat/${dangXem.id}/trinhKy`, body)).message);
          }}
          onDong={() => setCheDo(null)}
        />
      )}
      {dangXem && cheDo === 'ky' && (
        <HopThoaiBieuMau
          tieuDe={`Ký quyết định từ đề xuất #${dangXem.id}`}
          moTa={`${NHAN_LOAI_KTKL[dangXem.loaiDeXuat]} ${dinhDangTien(dangXem.soTienDeXuat)} cho ${dangXem.maNhanVien} - ${dangXem.hoVaTen}. Ngày ban hành là hôm nay; số tiền tính vào lương tháng này (nếu bảng lương tháng này đã gửi duyệt thì chỉ ký được từ tháng sau).`}
          truong={[
            { ten: 'soQuyetDinh', nhan: 'Số quyết định', goiY: 'Để trống để tự sinh QD<năm>-NNNN', rongHet: true },
            { ten: 'ghiChuXuLy', nhan: 'Ghi chú', rongHet: true },
          ]}
          nhanNutGui="Ký và ban hành"
          onGui={async (g) => {
            // Gửi kèm phiên bản đã xem: HR vừa chỉnh nội dung thì backend trả 409, không ký nội dung chưa xem
            const r = await goiApi.post(`/deXuatKhenThuongKyLuat/${dangXem.id}/ky`, { ...locThamSo(g), ngayCapNhat: dangXem.ngayCapNhat });
            xong([r.message, r.data.canhBao].filter(Boolean).join('. '));
          }}
          onDong={() => setCheDo(null)}
        />
      )}
      {dangXem && cheDo === 'traLai' && (
        <HopThoaiBieuMau
          tieuDe={`Trả lại đề xuất #${dangXem.id}`}
          truong={[{ ten: 'ghiChuXuLy', nhan: 'Lý do trả lại', kieu: 'textarea', batBuoc: true }]}
          nhanNutGui="Trả lại"
          bienTheNut="vang"
          onGui={async (g) => xong((await goiApi.post(`/deXuatKhenThuongKyLuat/${dangXem.id}/traLai`, g)).message)}
          onDong={() => setCheDo(null)}
        />
      )}
    </div>
  );
}

export default TrangDeXuat;
