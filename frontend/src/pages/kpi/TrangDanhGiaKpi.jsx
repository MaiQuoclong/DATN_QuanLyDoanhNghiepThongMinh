import { useCallback, useEffect, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import goiApi from '../../services/goiApi';
import { useXacThuc } from '../../context/NguCanhXacThuc';
import BangDuLieu from '../../components/BangDuLieu';
import ChipTrangThai from '../../components/ChipTrangThai';
import HopThoaiBieuMau from '../../components/HopThoaiBieuMau';
import NutBam from '../../components/NutBam';
import PhanTrang from '../../components/PhanTrang';
import ThanhLoc from '../../components/ThanhLoc';
import HopThoaiPhieuKpi from '../../components/kpi/HopThoaiPhieuKpi';
import { locThamSo } from '../../utils/dinhDang';

const TRANG_THAI = [
  { giaTri: 'BAN_NHAP', nhan: 'Bản nháp' },
  { giaTri: 'CHO_DUYET', nhan: 'Chờ nghiệm thu' },
  { giaTri: 'DA_DUYET', nhan: 'Đã nghiệm thu' },
];

// Tab Đánh giá (HR, giamDoc toàn công ty; quanLy phòng mình): danh sách phiếu theo kỳ,
// HR/quanLy tạo phiếu (từng người hoặc hàng loạt), quanLy/giamDoc nghiệm thu
function TrangDanhGiaKpi() {
  const { nguoiDung } = useXacThuc();
  const taoDuoc = nguoiDung.vaiTro.includes('HR') || nguoiDung.vaiTro.includes('quanLy');
  const [dsKy, setDsKy] = useState([]);
  const [kyId, setKyId] = useState('');
  const [phongBan, setPhongBan] = useState([]);
  const [tuKhoa, setTuKhoa] = useState('');
  const [loc, setLoc] = useState({});
  const [trang, setTrang] = useState(1);
  const [ketQua, setKetQua] = useState(null);
  const [loi, setLoi] = useState('');
  const [thongBao, setThongBao] = useState('');
  const [dangXem, setDangXem] = useState(null);
  const [dangTao, setDangTao] = useState(null); // 'mot' | 'hangLoat'

  useEffect(() => {
    goiApi
      .get('/kyDanhGiaKPI')
      .then((kq) => {
        setDsKy(kq.data);
        const mo = kq.data.find((k) => k.trangThai === 'DANG_MO') ?? kq.data[0];
        if (mo) setKyId(String(mo.id));
      })
      .catch((e) => setLoi(e.message));
    goiApi
      .get('/phongBan')
      .then((kq) => setPhongBan(kq.data))
      .catch(() => {});
  }, []);

  const tai = useCallback(() => {
    if (!kyId) return;
    goiApi
      .get('/phieuDanhGiaKPI', { params: locThamSo({ kyDanhGiaId: kyId, tuKhoa, ...loc, trang, kichThuoc: 20 }) })
      .then((kq) => {
        setKetQua(kq.data);
        setLoi('');
      })
      .catch((e) => setLoi(e.message));
  }, [kyId, tuKhoa, loc, trang]);

  useEffect(() => {
    const hen = setTimeout(tai, 300);
    return () => clearTimeout(hen);
  }, [tai]);

  const kyDangChon = dsKy.find((k) => String(k.id) === kyId);
  const kyMo = kyDangChon?.trangThai === 'DANG_MO';

  const cot = [
    {
      khoa: 'hoVaTen',
      tieuDe: 'Nhân viên',
      hienThi: (d) => (
        <>
          {d.hoVaTen} <span className="chuPhu">{d.maNhanVien}</span>
        </>
      ),
    },
    {
      khoa: 'tenPhongBan',
      tieuDe: 'Phòng ban',
      hienThi: (d) => (
        <>
          {d.tenPhongBan ?? '—'}
          <div className="chuPhu">
            {d.tenChucDanh}
            {d.laTruongBoPhan ? ' · Trưởng bộ phận' : ''}
          </div>
        </>
      ),
    },
    { khoa: 'diemTuChamTong', tieuDe: 'Tự chấm', canPhai: true, hienThi: (d) => d.diemTuChamTong ?? '—' },
    { khoa: 'diemTong', tieuDe: 'Nghiệm thu', canPhai: true, hienThi: (d) => (d.diemTong === null ? '—' : <strong>{d.diemTong}</strong>) },
    { khoa: 'xepLoaiChung', tieuDe: 'Xếp loại', hienThi: (d) => (d.xepLoaiChung ? <ChipTrangThai trangThai={d.xepLoaiChung} /> : '—') },
    {
      khoa: 'trangThai',
      tieuDe: 'Trạng thái',
      hienThi: (d) => <ChipTrangThai trangThai={d.trangThai} nhan={d.duocNghiemThu ? 'Chờ bạn nghiệm thu' : undefined} />,
    },
  ];
  const boLoc = [
    { khoa: 'trangThai', nhan: 'Trạng thái', luaChon: TRANG_THAI },
    { khoa: 'phongBanId', nhan: 'Phòng ban', luaChon: phongBan.map((pb) => ({ giaTri: String(pb.id), nhan: pb.tenPhongBan })) },
  ];

  const xongTao = (kq) => {
    setDangTao(null);
    setThongBao(kq.message);
    tai();
  };

  return (
    <div>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Đánh giá KPI</h1>
          <div className="chuPhu">
            Không ai nghiệm thu phiếu của chính mình · phiếu trưởng bộ phận do Ban Giám đốc nghiệm thu · {ketQua?.phanTrang.tongSo ?? 0}{' '}
            phiếu
          </div>
        </div>
        <div className="hangNutPhai">
          <label className="truongForm">
            Kỳ đánh giá
            <select
              value={kyId}
              onChange={(e) => {
                setKyId(e.target.value);
                setTrang(1);
              }}
            >
              {dsKy.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.tenKyDanhGia}
                  {k.trangThai === 'DA_DONG' ? ' (đã đóng)' : ''}
                </option>
              ))}
            </select>
          </label>
          {taoDuoc && kyMo && (
            <>
              <NutBam bienThe="phu" bieuTuong={Users} onClick={() => setDangTao('hangLoat')}>
                Tạo hàng loạt
              </NutBam>
              <NutBam bieuTuong={Plus} onClick={() => setDangTao('mot')}>
                Tạo phiếu
              </NutBam>
            </>
          )}
        </div>
      </div>

      <ThanhLoc
        tuKhoa={tuKhoa}
        onDoiTuKhoa={(v) => {
          setTuKhoa(v);
          setTrang(1);
        }}
        goiYTim="Mã hoặc tên nhân viên..."
        boLoc={boLoc}
        giaTriLoc={loc}
        onDoiLoc={(khoa, v) => {
          setLoc((cu) => ({ ...cu, [khoa]: v }));
          setTrang(1);
        }}
        phanPhai={<span />}
      />
      {loi && <div className="thongBao loi">{loi}</div>}
      {thongBao && <div className="thongBao thanhCong">{thongBao}</div>}
      {!dsKy.length && !loi && <div className="thongBao canhBao">Chưa có kỳ đánh giá nào. HR mở kỳ ở tab Kỳ đánh giá.</div>}
      <BangDuLieu
        cot={cot}
        duLieu={ketQua?.items ?? []}
        onHanhDong={(d) => setDangXem(d.id)}
        thongBaoRong="Kỳ này chưa có phiếu đánh giá"
      />
      <PhanTrang phanTrang={ketQua?.phanTrang} onDoiTrang={setTrang} />

      {dangXem && <HopThoaiPhieuKpi phieuId={dangXem} onDong={() => setDangXem(null)} onThayDoi={tai} />}
      {dangTao === 'mot' && (
        <HopThoaiBieuMau
          tieuDe={`Tạo phiếu đánh giá · ${kyDangChon.tenKyDanhGia}`}
          moTa="Chỉ tiêu được sinh từ vị trí của nhân viên và các chỉ tiêu chung (trọng số mặc định)."
          truong={[
            {
              ten: 'nhanVienId',
              nhan: 'Nhân viên',
              kieu: 'nhanVien',
              batBuoc: true,
              locNhanVien: { trangThai: ['THU_VIEC', 'CHINH_THUC'], boQuaIds: [nguoiDung.nhanVienId] },
            },
          ]}
          nhanNutGui="Tạo phiếu"
          onGui={async (giaTri) =>
            xongTao(await goiApi.post('/phieuDanhGiaKPI', { kyDanhGiaId: Number(kyId), nhanVienId: Number(giaTri.nhanVienId) }))
          }
          onDong={() => setDangTao(null)}
        />
      )}
      {dangTao === 'hangLoat' && (
        <HopThoaiBieuMau
          tieuDe={`Tạo phiếu hàng loạt · ${kyDangChon.tenKyDanhGia}`}
          moTa="Tạo cho mọi nhân viên đang làm việc trong phạm vi của bạn chưa có phiếu kỳ này (trừ chính bạn và người chưa có chỉ tiêu)."
          truong={[
            {
              ten: 'phongBanId',
              nhan: 'Phòng ban',
              kieu: 'select',
              ghiChu: 'Để trống: toàn bộ phạm vi',
              luaChon: phongBan.map((pb) => ({ giaTri: String(pb.id), nhan: pb.tenPhongBan })),
            },
          ]}
          nhanNutGui="Tạo"
          onGui={async (giaTri) =>
            xongTao(
              await goiApi.post('/phieuDanhGiaKPI/taoHangLoat', {
                kyDanhGiaId: Number(kyId),
                phongBanId: giaTri.phongBanId ? Number(giaTri.phongBanId) : undefined,
              }),
            )
          }
          onDong={() => setDangTao(null)}
        />
      )}
    </div>
  );
}

export default TrangDanhGiaKpi;
