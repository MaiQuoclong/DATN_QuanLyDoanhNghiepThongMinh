import { useCallback, useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import goiApi from '../../services/goiApi';
import useThongBao from '../../hooks/useThongBao';
import { useXacThuc } from '../../context/NguCanhXacThuc';
import BangDuLieu from '../../components/BangDuLieu';
import ChipTrangThai from '../../components/ChipTrangThai';
import HopThoai from '../../components/HopThoai';
import NutBam from '../../components/NutBam';
import PhanTrang from '../../components/PhanTrang';
import ThanhLoc from '../../components/ThanhLoc';
import TheThongKe from '../../components/TheThongKe';
import BangCongNgay from '../../components/chamCong/BangCongNgay';
import { ChuThichThoiGian } from '../../components/chamCong/ThanhThoiGianCong';
import { dinhDangThoiGian, locThamSo, thangHienTai } from '../../utils/dinhDang';

const COT_BANG_CONG = [
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
  { khoa: 'soNgayChamCong', tieuDe: 'Ngày công', canPhai: true },
  { khoa: 'tongGioLamThucTe', tieuDe: 'Giờ công', canPhai: true },
  { khoa: 'tongGioLamThem', tieuDe: 'Tăng ca', canPhai: true },
  { khoa: 'soLanDiMuon', tieuDe: 'Đi muộn', canPhai: true },
  { khoa: 'soLanVeSom', tieuDe: 'Về sớm', canPhai: true },
  {
    khoa: 'soNgayThieuCheckOut',
    tieuDe: 'Thiếu check-out',
    canPhai: true,
    hienThi: (d) => (d.soNgayThieuCheckOut ? <ChipTrangThai trangThai="TU_CHOI" nhan={String(d.soNgayThieuCheckOut)} /> : 0),
  },
  { khoa: 'trangThaiLamViec', tieuDe: 'Trạng thái', hienThi: (d) => <ChipTrangThai trangThai={d.trangThaiLamViec} /> },
];

function HopThoaiCongNhanVien({ nhanVienId, thang, onDong }) {
  const [cong, setCong] = useState(null);
  const [loi, setLoi] = useState('');

  useEffect(() => {
    goiApi
      .get(`/chamCong/bangCong/${nhanVienId}`, { params: { thang } })
      .then((kq) => setCong(kq.data))
      .catch((e) => setLoi(e.message));
  }, [nhanVienId, thang]);

  return (
    <HopThoai
      tieuDe={cong ? `Công tháng ${thang} · ${cong.nhanVien.hoVaTen} (${cong.nhanVien.maNhanVien})` : 'Công theo ngày'}
      onDong={onDong}
      rong={1000}
    >
      {loi && <div className="thongBao loi">{loi}</div>}
      {cong && (
        <>
          <div className="chuPhu" style={{ marginBottom: 8 }}>
            {cong.tongHop.soNgayChamCong}/{cong.soNgayCongChuan} ngày · {cong.tongHop.tongGioLamThucTe} giờ công · tăng ca{' '}
            {cong.tongHop.tongGioLamThem} giờ
          </div>
          <div style={{ marginBottom: 8 }}>
            <ChuThichThoiGian />
          </div>
          <BangCongNgay items={cong.items} />
        </>
      )}
    </HopThoai>
  );
}

function HopThoaiChotCong({ thang, onDong, onDaChot }) {
  const [loi, setLoi] = useState('');
  const [dangGui, setDangGui] = useState(false);

  const chot = async () => {
    setDangGui(true);
    setLoi('');
    try {
      const kq = await goiApi.post('/chamCong/chotCong', { thang });
      onDaChot(kq.message);
    } catch (e) {
      setLoi(e.message);
      setDangGui(false);
    }
  };

  return (
    <HopThoai
      tieuDe={`Chốt công tháng ${thang}`}
      onDong={onDong}
      chanTrang={
        <>
          <NutBam bienThe="phu" onClick={onDong}>
            Hủy
          </NutBam>
          <NutBam bienThe="vang" bieuTuong={Lock} disabled={dangGui} onClick={chot}>
            {dangGui ? 'Đang chốt...' : 'Chốt công'}
          </NutBam>
        </>
      }
    >
      {loi && <div className="thongBao loi">{loi}</div>}
      <div className="thongBao canhBao">
        Sau khi chốt, không ai có thể chấm công, gửi hoặc duyệt điều chỉnh công trong tháng {thang}. Bảng công tháng này sẽ dùng để lập bảng
        lương. Thao tác được ghi nhật ký hệ thống.
      </div>
      <div className="chuPhu">Cần xử lý hết yêu cầu điều chỉnh đang chờ duyệt của tháng trước khi chốt.</div>
    </HopThoai>
  );
}

// Bảng công tháng: HR, giamDoc toàn công ty; quanLy phòng ban mình phụ trách (lọc ở backend)
function TrangBangCong() {
  const { nguoiDung } = useXacThuc();
  const laHR = nguoiDung.vaiTro.includes('HR');
  const [thang, setThang] = useState(thangHienTai());
  const [tuKhoa, setTuKhoa] = useState('');
  const [loc, setLoc] = useState({});
  const [trang, setTrang] = useState(1);
  const [phongBan, setPhongBan] = useState([]);
  const [ketQua, setKetQua] = useState(null);
  const { loi, thongBao, baoLoi, baoThanhCong } = useThongBao();
  const [dangXem, setDangXem] = useState(null);
  const [dangChot, setDangChot] = useState(false);

  useEffect(() => {
    goiApi
      .get('/phongBan')
      .then((kq) => setPhongBan(kq.data))
      .catch(() => {});
  }, []);

  const tai = useCallback(() => {
    goiApi
      .get('/chamCong/bangCong', { params: locThamSo({ thang, tuKhoa, ...loc, trang, kichThuoc: 20 }) })
      .then((kq) => {
        setKetQua(kq.data);
        baoLoi('');
      })
      .catch((e) => baoLoi(e.message));
  }, [thang, tuKhoa, loc, trang, baoLoi]);

  // Chờ người dùng gõ xong mới gọi API
  useEffect(() => {
    const hen = setTimeout(tai, 300);
    return () => clearTimeout(hen);
  }, [tai]);

  const items = ketQua?.items ?? [];
  const tong = (khoa) => Math.round(items.reduce((s, d) => s + d[khoa], 0) * 100) / 100;
  const boLoc = [
    {
      khoa: 'phongBanId',
      nhan: 'Phòng ban',
      luaChon: phongBan.map((pb) => ({ giaTri: String(pb.id), nhan: pb.tenPhongBan })),
    },
  ];
  const thangDaKetThuc = thang < thangHienTai();

  return (
    <div>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Bảng công tháng</h1>
          <div className="chuPhu">
            {ketQua ? `${ketQua.soNgayCongChuan} ngày công chuẩn · ${ketQua.phanTrang.tongSo} nhân viên` : loi ? '' : 'Đang tải...'}
            {ketQua?.daChot && ` · Đã chốt lúc ${dinhDangThoiGian(ketQua.chot.thoiGianChot)} (${ketQua.chot.nguoiChot ?? '—'})`}
          </div>
        </div>
        <div className="hangNutPhai">
          <label className="truongForm">
            Tháng
            <input
              type="month"
              value={thang}
              max={thangHienTai()}
              onChange={(e) => {
                if (e.target.value) {
                  setThang(e.target.value);
                  setTrang(1);
                  setKetQua(null);
                }
              }}
            />
          </label>
          {laHR && ketQua && !ketQua.daChot && (
            <NutBam
              bienThe="vang"
              bieuTuong={Lock}
              disabled={!thangDaKetThuc}
              title={thangDaKetThuc ? '' : 'Chỉ chốt được tháng đã kết thúc'}
              onClick={() => setDangChot(true)}
            >
              Chốt công tháng
            </NutBam>
          )}
          {ketQua?.daChot && <ChipTrangThai trangThai="DA_DUYET" nhan="Đã chốt công" kieu="chip" />}
        </div>
      </div>

      {thongBao && <div className="thongBao thanhCong">{thongBao}</div>}
      <div className="luoiThe" style={{ marginBottom: 16 }}>
        <TheThongKe
          tieuDe="Tổng giờ công (trang này)"
          giaTri={tong('tongGioLamThucTe')}
          moTa={`Tăng ca ${tong('tongGioLamThem')} giờ`}
          trangThai="thanhCong"
        />
        <TheThongKe
          tieuDe="Lượt đi muộn"
          giaTri={tong('soLanDiMuon')}
          moTa={`Về sớm ${tong('soLanVeSom')} lượt`}
          trangThai={tong('soLanDiMuon') ? 'canhBao' : 'thanhCong'}
        />
        <TheThongKe
          tieuDe="Ngày thiếu check-out"
          giaTri={tong('soNgayThieuCheckOut')}
          moTa={tong('soNgayThieuCheckOut') ? 'Nhắc nhân viên gửi điều chỉnh' : 'Không có'}
          trangThai={tong('soNgayThieuCheckOut') ? 'loi' : 'thanhCong'}
        />
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
      <BangDuLieu
        cot={COT_BANG_CONG}
        khoaDong="nhanVienId"
        duLieu={items}
        onHanhDong={(d) => setDangXem(d.nhanVienId)}
        thongBaoRong="Không có nhân viên phù hợp"
      />
      <PhanTrang phanTrang={ketQua?.phanTrang} onDoiTrang={setTrang} />

      {dangXem && <HopThoaiCongNhanVien nhanVienId={dangXem} thang={thang} onDong={() => setDangXem(null)} />}
      {dangChot && (
        <HopThoaiChotCong
          thang={thang}
          onDong={() => setDangChot(false)}
          onDaChot={(tb) => {
            setDangChot(false);
            baoThanhCong(tb);
            tai();
          }}
        />
      )}
    </div>
  );
}

export default TrangBangCong;
