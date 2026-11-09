import { useCallback, useEffect, useState } from 'react';
import { CalendarPlus, Plus } from 'lucide-react';
import goiApi from '../../services/goiApi';
import { useXacThuc } from '../../context/NguCanhXacThuc';
import BangDuLieu from '../../components/BangDuLieu';
import ChipTrangThai from '../../components/ChipTrangThai';
import HopThoaiBieuMau from '../../components/HopThoaiBieuMau';
import NutBam from '../../components/NutBam';
import PhanTrang from '../../components/PhanTrang';
import ThanhLoc from '../../components/ThanhLoc';
import { locThamSo } from '../../utils/dinhDang';

const CO_KHONG = [
  { giaTri: 'true', nhan: 'Có' },
  { giaTri: 'false', nhan: 'Không' },
];
const namHienTai = new Date().getFullYear();

// ===================== Quỹ phép =====================

function BangQuyPhep({ laHR, nhanVienIdCuaToi }) {
  const [nam, setNam] = useState(namHienTai);
  const [tuKhoa, setTuKhoa] = useState('');
  const [loc, setLoc] = useState({});
  const [trang, setTrang] = useState(1);
  const [phongBan, setPhongBan] = useState([]);
  const [ketQua, setKetQua] = useState(null);
  const [loi, setLoi] = useState('');
  const [thongBao, setThongBao] = useState('');
  const [dangSua, setDangSua] = useState(null);
  const [dangCap, setDangCap] = useState(false);

  useEffect(() => {
    goiApi
      .get('/phongBan')
      .then((kq) => setPhongBan(kq.data))
      .catch(() => {});
  }, []);

  const tai = useCallback(() => {
    goiApi
      .get('/quyPhep', { params: locThamSo({ nam, tuKhoa, ...loc, trang, kichThuoc: 20 }) })
      .then((kq) => {
        setKetQua(kq.data);
        setLoi('');
      })
      .catch((e) => setLoi(e.message));
  }, [nam, tuKhoa, loc, trang]);

  useEffect(() => {
    const hen = setTimeout(tai, 300);
    return () => clearTimeout(hen);
  }, [tai]);

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
    { khoa: 'tenPhongBan', tieuDe: 'Phòng ban' },
    {
      khoa: 'tongSoNgayPhep',
      tieuDe: 'Tổng',
      canPhai: true,
      hienThi: (d) => (d.quyId ? d.tongSoNgayPhep : <ChipTrangThai trangThai="CHO_DUYET" nhan="Chưa cấp" />),
    },
    { khoa: 'soNgayDaNghi', tieuDe: 'Đã nghỉ', canPhai: true, hienThi: (d) => d.soNgayDaNghi ?? '—' },
    { khoa: 'soNgayChoDuyet', tieuDe: 'Chờ duyệt', canPhai: true },
    {
      khoa: 'soNgayConLai',
      tieuDe: 'Còn lại',
      canPhai: true,
      hienThi: (d) =>
        d.soNgayConLai === null ? (
          '—'
        ) : (
          <strong style={{ color: d.soNgayConLai <= 0 ? 'var(--mauLoi)' : undefined }}>{d.soNgayConLai}</strong>
        ),
    },
  ];
  const boLoc = [
    { khoa: 'phongBanId', nhan: 'Phòng ban', luaChon: phongBan.map((pb) => ({ giaTri: String(pb.id), nhan: pb.tenPhongBan })) },
  ];
  // HR sửa được quỹ đã cấp của người khác
  const suaDuoc = (d) => laHR && d.quyId && d.nhanVienId !== nhanVienIdCuaToi;

  return (
    <>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Quỹ phép năm {nam}</h1>
          <div className="chuPhu">Còn lại = tổng − đã nghỉ − đang chờ duyệt · {ketQua?.phanTrang.tongSo ?? 0} nhân viên</div>
        </div>
        <div className="hangNutPhai">
          <label className="truongForm">
            Năm
            <select
              value={nam}
              onChange={(e) => {
                setNam(Number(e.target.value));
                setTrang(1);
              }}
            >
              {[namHienTai - 1, namHienTai, namHienTai + 1].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          {laHR && (
            <NutBam bieuTuong={CalendarPlus} onClick={() => setDangCap(true)}>
              Cấp quỹ năm {nam}
            </NutBam>
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
      <BangDuLieu
        cot={cot}
        khoaDong="nhanVienId"
        duLieu={ketQua?.items ?? []}
        onHanhDong={
          laHR
            ? (d) =>
                suaDuoc(d)
                  ? setDangSua(d)
                  : setLoi(d.quyId ? 'Không thể tự sửa quỹ phép của chính mình' : 'Nhân viên chưa có quỹ năm này, dùng nút Cấp quỹ')
            : undefined
        }
        thongBaoRong="Không có nhân viên phù hợp"
      />
      <PhanTrang phanTrang={ketQua?.phanTrang} onDoiTrang={setTrang} />

      {dangCap && (
        <HopThoaiBieuMau
          tieuDe={`Cấp quỹ phép năm ${nam}`}
          moTa="Chỉ cấp cho nhân viên chưa nghỉ việc và chưa có quỹ năm này; người đã có quỹ giữ nguyên."
          truong={[{ ten: 'tongSoNgayPhep', nhan: 'Số ngày phép mỗi người', kieu: 'number', batBuoc: true, rongHet: true }]}
          giaTriBanDau={{ tongSoNgayPhep: '12' }}
          nhanNutGui="Cấp quỹ"
          onGui={async (giaTri) => {
            const kq = await goiApi.post('/quyPhep/capNam', { nam, tongSoNgayPhep: Number(giaTri.tongSoNgayPhep) });
            setDangCap(false);
            setThongBao(kq.message);
            tai();
          }}
          onDong={() => setDangCap(false)}
        />
      )}
      {dangSua && (
        <HopThoaiBieuMau
          tieuDe={`Sửa quỹ phép ${dangSua.hoVaTen} (${dangSua.maNhanVien}) năm ${nam}`}
          moTa={`Đã nghỉ ${dangSua.soNgayDaNghi} ngày, đang chờ duyệt ${dangSua.soNgayChoDuyet} ngày. Bước 0.5 ngày.`}
          truong={[
            { ten: 'tongSoNgayPhep', nhan: 'Tổng số ngày phép', kieu: 'number', batBuoc: true },
            { ten: 'lyDo', nhan: 'Lý do', goiY: 'Ví dụ: cộng thâm niên' },
          ]}
          giaTriBanDau={{ tongSoNgayPhep: String(dangSua.tongSoNgayPhep) }}
          onGui={async (giaTri) => {
            await goiApi.patch(`/quyPhep/${dangSua.quyId}`, {
              tongSoNgayPhep: Number(giaTri.tongSoNgayPhep),
              lyDo: giaTri.lyDo || undefined,
            });
            setDangSua(null);
            setThongBao('Cập nhật quỹ phép thành công');
            tai();
          }}
          onDong={() => setDangSua(null)}
        />
      )}
    </>
  );
}

// ===================== Loại nghỉ phép =====================

const TRUONG_LOAI = [
  { ten: 'tenLoai', nhan: 'Tên loại', batBuoc: true, rongHet: true },
  { ten: 'soNgayToiDa', nhan: 'Số ngày tối đa mỗi đơn', kieu: 'number', ghiChu: 'Để trống nếu không giới hạn' },
  { ten: 'coLuong', nhan: 'Hưởng lương', kieu: 'select', luaChon: CO_KHONG, batBuoc: true },
  { ten: 'truVaoQuyPhepNam', nhan: 'Trừ vào quỹ phép năm', kieu: 'select', luaChon: CO_KHONG, batBuoc: true },
  { ten: 'moTa', nhan: 'Mô tả', kieu: 'textarea' },
];

function chuyenGiaTriLoai(giaTri) {
  if (giaTri.soNgayToiDa !== '' && Number.isNaN(Number(giaTri.soNgayToiDa)))
    throw new Error('Số ngày tối đa phải là số (để trống nếu không giới hạn)');
  return {
    tenLoai: giaTri.tenLoai,
    soNgayToiDa: giaTri.soNgayToiDa === '' ? '' : Number(giaTri.soNgayToiDa),
    coLuong: giaTri.coLuong === 'true',
    truVaoQuyPhepNam: giaTri.truVaoQuyPhepNam === 'true',
    moTa: giaTri.moTa,
  };
}

function BangLoaiNghiPhep({ laHR }) {
  const [dsLoai, setDsLoai] = useState([]);
  const [loi, setLoi] = useState('');
  const [thongBao, setThongBao] = useState('');
  const [dangThem, setDangThem] = useState(false);
  const [dangSua, setDangSua] = useState(null);

  const tai = useCallback(() => {
    goiApi
      .get('/loaiNghiPhep')
      .then((kq) => {
        setDsLoai(kq.data);
        setLoi('');
      })
      .catch((e) => setLoi(e.message));
  }, []);
  useEffect(tai, [tai]);

  const cot = [
    { khoa: 'maLoai', tieuDe: 'Mã' },
    { khoa: 'tenLoai', tieuDe: 'Tên loại' },
    { khoa: 'soNgayToiDa', tieuDe: 'Tối đa/đơn', canPhai: true, hienThi: (d) => d.soNgayToiDa ?? 'Không giới hạn' },
    { khoa: 'coLuong', tieuDe: 'Lương', hienThi: (d) => (d.coLuong ? 'Có lương' : 'Không lương') },
    { khoa: 'truVaoQuyPhepNam', tieuDe: 'Trừ quỹ phép', hienThi: (d) => (d.truVaoQuyPhepNam ? 'Có' : 'Không') },
    { khoa: 'soDon', tieuDe: 'Số đơn', canPhai: true },
    { khoa: 'trangThai', tieuDe: 'Trạng thái', hienThi: (d) => <ChipTrangThai trangThai={d.trangThai} /> },
  ];

  const doiTrangThai = async (loai) => {
    try {
      const kq = await goiApi.patch(`/loaiNghiPhep/${loai.id}`, {
        trangThai: loai.trangThai === 'DANG_AP_DUNG' ? 'NGUNG_AP_DUNG' : 'DANG_AP_DUNG',
      });
      setThongBao(`${kq.data.tenLoai}: ${kq.data.trangThai === 'DANG_AP_DUNG' ? 'đã áp dụng lại' : 'đã ngừng áp dụng'}`);
      setDangSua(null);
      tai();
    } catch (e) {
      setLoi(e.message);
    }
  };

  return (
    <>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Loại nghỉ phép</h1>
          <div className="chuPhu">Loại đã có đơn không đổi được chế độ hưởng lương / trừ quỹ phép</div>
        </div>
        {laHR && (
          <NutBam bieuTuong={Plus} onClick={() => setDangThem(true)}>
            Thêm loại
          </NutBam>
        )}
      </div>
      {loi && <div className="thongBao loi">{loi}</div>}
      {thongBao && <div className="thongBao thanhCong">{thongBao}</div>}
      <BangDuLieu cot={cot} duLieu={dsLoai} onHanhDong={laHR ? (d) => setDangSua(d) : undefined} thongBaoRong="Chưa có loại nghỉ phép" />

      {dangThem && (
        <HopThoaiBieuMau
          tieuDe="Thêm loại nghỉ phép"
          truong={[
            { ten: 'maLoai', nhan: 'Mã loại', batBuoc: true, goiY: 'VD: NGHI_BU', ghiChu: 'Chữ in hoa, số, dấu gạch dưới' },
            ...TRUONG_LOAI,
          ]}
          giaTriBanDau={{ coLuong: 'true', truVaoQuyPhepNam: 'true' }}
          nhanNutGui="Thêm"
          onGui={async (giaTri) => {
            const body = chuyenGiaTriLoai(giaTri);
            const kq = await goiApi.post('/loaiNghiPhep', {
              ...body,
              maLoai: giaTri.maLoai,
              soNgayToiDa: body.soNgayToiDa === '' ? undefined : body.soNgayToiDa,
            });
            setDangThem(false);
            setThongBao(kq.message);
            tai();
          }}
          onDong={() => setDangThem(false)}
        />
      )}
      {dangSua && (
        <HopThoaiBieuMau
          tieuDe={`Sửa loại ${dangSua.maLoai}`}
          moTa={
            <>
              Trạng thái: {dangSua.trangThai === 'DANG_AP_DUNG' ? 'đang áp dụng' : 'ngừng áp dụng'}.{' '}
              <button type="button" className="lienKet" onClick={() => doiTrangThai(dangSua)}>
                {dangSua.trangThai === 'DANG_AP_DUNG' ? 'Ngừng áp dụng' : 'Áp dụng lại'}
              </button>
            </>
          }
          truong={TRUONG_LOAI}
          giaTriBanDau={{
            tenLoai: dangSua.tenLoai,
            soNgayToiDa: dangSua.soNgayToiDa === null ? '' : String(dangSua.soNgayToiDa),
            coLuong: String(dangSua.coLuong),
            truVaoQuyPhepNam: String(dangSua.truVaoQuyPhepNam),
            moTa: dangSua.moTa ?? '',
          }}
          onGui={async (giaTri) => {
            // Chỉ gửi trường thật sự đổi (backend trả 400 nếu không có gì thay đổi)
            const moi = chuyenGiaTriLoai(giaTri);
            const cu = { ...dangSua, soNgayToiDa: dangSua.soNgayToiDa ?? '', moTa: dangSua.moTa ?? '' };
            const body = Object.fromEntries(Object.entries(moi).filter(([khoa, gt]) => gt !== cu[khoa]));
            await goiApi.patch(`/loaiNghiPhep/${dangSua.id}`, body);
            setDangSua(null);
            setThongBao('Cập nhật loại nghỉ phép thành công');
            tai();
          }}
          onDong={() => setDangSua(null)}
        />
      )}
    </>
  );
}

// Tab Quỹ phép (HR, giamDoc, quanLy PM): quỹ phép năm và danh mục loại nghỉ; chỉ HR thêm/sửa
function TrangQuyPhep() {
  const { nguoiDung } = useXacThuc();
  const laHR = nguoiDung.vaiTro.includes('HR');
  const [tab, setTab] = useState('quy');
  return (
    <div>
      <div className="tabGachChan">
        <button type="button" className={tab === 'quy' ? 'dangChon' : ''} onClick={() => setTab('quy')}>
          Quỹ phép năm
        </button>
        <button type="button" className={tab === 'loai' ? 'dangChon' : ''} onClick={() => setTab('loai')}>
          Loại nghỉ phép
        </button>
      </div>
      {tab === 'quy' ? <BangQuyPhep laHR={laHR} nhanVienIdCuaToi={nguoiDung.nhanVienId} /> : <BangLoaiNghiPhep laHR={laHR} />}
    </div>
  );
}

export default TrangQuyPhep;
