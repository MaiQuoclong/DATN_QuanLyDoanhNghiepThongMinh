import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import goiApi from '../../services/goiApi';
import { useXacThuc } from '../../context/NguCanhXacThuc';
import BangDuLieu from '../../components/BangDuLieu';
import HopThoaiBieuMau from '../../components/HopThoaiBieuMau';
import NutBam from '../../components/NutBam';
import ThanhLoc from '../../components/ThanhLoc';
import { locThamSo } from '../../utils/dinhDang';

const CHUNG = 'CHUNG';

// Tab Chỉ tiêu: HR định nghĩa chỉ tiêu chung + mọi vị trí; quanLy định nghĩa cho vị trí thuộc phòng mình; giamDoc xem
function TrangChiTieuKpi() {
  const { nguoiDung } = useXacThuc();
  const laHR = nguoiDung.vaiTro.includes('HR');
  const quanTri = laHR || nguoiDung.vaiTro.includes('quanLy');
  const [ds, setDs] = useState([]);
  const [dsViTri, setDsViTri] = useState([]);
  const [phongBan, setPhongBan] = useState([]);
  const [tuKhoa, setTuKhoa] = useState('');
  const [loc, setLoc] = useState({});
  const [loi, setLoi] = useState('');
  const [thongBao, setThongBao] = useState('');
  const [dangThem, setDangThem] = useState(false);
  const [dangSua, setDangSua] = useState(null);

  useEffect(() => {
    goiApi
      .get('/phongBan')
      .then((kq) => setPhongBan(kq.data))
      .catch(() => {});
    if (quanTri)
      goiApi
        .get('/chiTieuKPI/viTri')
        .then((kq) => setDsViTri(kq.data))
        .catch(() => {});
  }, [quanTri]);

  const tai = useCallback(() => {
    goiApi
      .get('/chiTieuKPI', { params: locThamSo({ tuKhoa, ...loc }) })
      .then((kq) => {
        setDs(kq.data);
        setLoi('');
      })
      .catch((e) => setLoi(e.message));
  }, [tuKhoa, loc]);
  useEffect(() => {
    const hen = setTimeout(tai, 300);
    return () => clearTimeout(hen);
  }, [tai]);

  const luaChonViTri = [
    ...(laHR ? [{ giaTri: CHUNG, nhan: 'Chỉ tiêu chung (mọi vị trí)' }] : []),
    ...dsViTri.map((v) => ({ giaTri: String(v.id), nhan: `${v.tenChucDanh} · ${v.tenPhongBan}` })),
  ];
  const truong = (laThem) => [
    ...(laThem ? [{ ten: 'maChiTieu', nhan: 'Mã chỉ tiêu', batBuoc: true, goiY: 'VD: LTV-03', ghiChu: 'Chữ, số, - và _' }] : []),
    { ten: 'tenChiTieu', nhan: 'Tên chỉ tiêu', batBuoc: true, rongHet: true },
    { ten: 'chucDanhPhongBanId', nhan: 'Áp dụng cho', kieu: 'select', batBuoc: true, luaChon: luaChonViTri, rongHet: true },
    { ten: 'donViDo', nhan: 'Đơn vị đo', goiY: '%, Triệu đồng, Lỗi...' },
    { ten: 'trongSoMacDinh', nhan: 'Trọng số mặc định', kieu: 'number', batBuoc: true, ghiChu: '0.01 – 100' },
    { ten: 'moTa', nhan: 'Mô tả', kieu: 'textarea' },
  ];
  const chuyen = (g) => ({
    tenChiTieu: g.tenChiTieu,
    chucDanhPhongBanId: g.chucDanhPhongBanId === CHUNG ? null : Number(g.chucDanhPhongBanId),
    donViDo: g.donViDo,
    trongSoMacDinh: Number(g.trongSoMacDinh),
    moTa: g.moTa,
  });
  // Không gửi lại vị trí nếu không đổi (backend chặn đổi vị trí khi chỉ tiêu đã được dùng)
  const suaDuoc = (d) => quanTri && (d.chucDanhPhongBanId === null ? laHR : dsViTri.some((v) => v.id === d.chucDanhPhongBanId));

  const cot = [
    { khoa: 'maChiTieu', tieuDe: 'Mã' },
    {
      khoa: 'tenChiTieu',
      tieuDe: 'Tên chỉ tiêu',
      hienThi: (d) => (
        <>
          {d.tenChiTieu}
          {d.moTa && <div className="chuPhu">{d.moTa}</div>}
        </>
      ),
    },
    {
      khoa: 'tenPhongBan',
      tieuDe: 'Áp dụng cho',
      hienThi: (d) => (d.chucDanhPhongBanId === null ? <strong>Chung toàn công ty</strong> : `${d.tenChucDanh} · ${d.tenPhongBan}`),
    },
    { khoa: 'donViDo', tieuDe: 'Đơn vị', hienThi: (d) => d.donViDo ?? '—' },
    { khoa: 'trongSoMacDinh', tieuDe: 'Trọng số', canPhai: true },
    { khoa: 'soLanSuDung', tieuDe: 'Số phiếu dùng', canPhai: true },
  ];

  const xoa = async (d) => {
    if (!window.confirm(`Xóa chỉ tiêu ${d.maChiTieu}?`)) return;
    try {
      const kq = await goiApi.delete(`/chiTieuKPI/${d.id}`);
      setDangSua(null);
      setThongBao(kq.message);
      tai();
    } catch (e) {
      setLoi(e.message);
    }
  };

  return (
    <div>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Chỉ tiêu KPI</h1>
          <div className="chuPhu">
            Phiếu đánh giá lấy chỉ tiêu của vị trí nhân viên + chỉ tiêu chung · sửa trọng số không ảnh hưởng phiếu đã tạo
          </div>
        </div>
        {quanTri && (
          <NutBam bieuTuong={Plus} onClick={() => setDangThem(true)}>
            Thêm chỉ tiêu
          </NutBam>
        )}
      </div>
      <ThanhLoc
        tuKhoa={tuKhoa}
        onDoiTuKhoa={setTuKhoa}
        goiYTim="Mã hoặc tên chỉ tiêu..."
        boLoc={[
          { khoa: 'phongBanId', nhan: 'Phòng ban', luaChon: phongBan.map((pb) => ({ giaTri: String(pb.id), nhan: pb.tenPhongBan })) },
        ]}
        giaTriLoc={loc}
        onDoiLoc={(khoa, v) => setLoc((cu) => ({ ...cu, [khoa]: v }))}
        phanPhai={<span />}
      />
      {loi && <div className="thongBao loi">{loi}</div>}
      {thongBao && <div className="thongBao thanhCong">{thongBao}</div>}
      <BangDuLieu
        cot={cot}
        duLieu={ds}
        onHanhDong={quanTri ? (d) => (suaDuoc(d) ? setDangSua(d) : setLoi('Bạn không có quyền sửa chỉ tiêu này')) : undefined}
        thongBaoRong="Chưa có chỉ tiêu KPI"
      />

      {dangThem && (
        <HopThoaiBieuMau
          tieuDe="Thêm chỉ tiêu KPI"
          truong={truong(true)}
          giaTriBanDau={{ trongSoMacDinh: '1' }}
          nhanNutGui="Thêm"
          onGui={async (g) => {
            const kq = await goiApi.post('/chiTieuKPI', { ...chuyen(g), maChiTieu: g.maChiTieu });
            setDangThem(false);
            setThongBao(kq.message);
            tai();
          }}
          onDong={() => setDangThem(false)}
        />
      )}
      {dangSua && (
        <HopThoaiBieuMau
          tieuDe={`Sửa chỉ tiêu ${dangSua.maChiTieu}`}
          moTa={
            <>
              Đã dùng trong {dangSua.soLanSuDung} phiếu{dangSua.soLanSuDung ? ' (không đổi được vị trí, không xóa được)' : ''}.{' '}
              {!dangSua.soLanSuDung && (
                <button type="button" className="lienKet" onClick={() => xoa(dangSua)}>
                  Xóa chỉ tiêu
                </button>
              )}
            </>
          }
          truong={truong(false)}
          giaTriBanDau={{
            tenChiTieu: dangSua.tenChiTieu,
            chucDanhPhongBanId: dangSua.chucDanhPhongBanId === null ? CHUNG : String(dangSua.chucDanhPhongBanId),
            donViDo: dangSua.donViDo ?? '',
            trongSoMacDinh: String(Number(dangSua.trongSoMacDinh)),
            moTa: dangSua.moTa ?? '',
          }}
          onGui={async (g) => {
            const moi = chuyen(g);
            const cu = {
              ...dangSua,
              trongSoMacDinh: Number(dangSua.trongSoMacDinh),
              donViDo: dangSua.donViDo ?? '',
              moTa: dangSua.moTa ?? '',
            };
            const body = Object.fromEntries(Object.entries(moi).filter(([k, v]) => v !== cu[k]));
            await goiApi.patch(`/chiTieuKPI/${dangSua.id}`, body);
            setDangSua(null);
            setThongBao('Cập nhật chỉ tiêu KPI thành công');
            tai();
          }}
          onDong={() => setDangSua(null)}
        />
      )}
    </div>
  );
}

export default TrangChiTieuKpi;
