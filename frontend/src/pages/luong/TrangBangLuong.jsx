import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, Download, FilePlus, RefreshCw, Send, Trash2, Undo2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import goiApi from '../../services/goiApi';
import { useXacThuc } from '../../context/NguCanhXacThuc';
import BangDuLieu from '../../components/BangDuLieu';
import ChipTrangThai from '../../components/ChipTrangThai';
import HopThoai from '../../components/HopThoai';
import HopThoaiBieuMau from '../../components/HopThoaiBieuMau';
import NutBam from '../../components/NutBam';
import PhanTrang from '../../components/PhanTrang';
import TheThongKe from '../../components/TheThongKe';
import ThanhLoc from '../../components/ThanhLoc';
import ChiTietPhieuLuong from '../../components/luong/ChiTietPhieuLuong';
import { dinhDangTien, dinhDangThoiGian, locThamSo } from '../../utils/dinhDang';

const namHienTai = new Date().getFullYear();
const kyLuong = (b) => `${String(b.thang).padStart(2, '0')}/${b.nam}`;
const LUOI_THE = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 };
const trieuDong = (so) => `${Math.round(so / 1e6).toLocaleString('vi-VN')} tr`;

// ===================== Chi tiết một bảng lương =====================

function ChiTietBang({ bangId, laHR, laGiamDoc, nhanVienIdCuaToi, onQuayLai }) {
  const [ketQua, setKetQua] = useState(null);
  const [tuKhoa, setTuKhoa] = useState('');
  const [trang, setTrang] = useState(1);
  const [loi, setLoi] = useState('');
  const [thongBao, setThongBao] = useState('');
  const [dangXem, setDangXem] = useState(null);
  const [dangSua, setDangSua] = useState(null);
  const [dangTraLai, setDangTraLai] = useState(false);
  const [dangXoa, setDangXoa] = useState(false);
  const [dangDuyet, setDangDuyet] = useState(false);

  const tai = useCallback(() => {
    goiApi.get(`/bangLuong/${bangId}`, { params: locThamSo({ tuKhoa, trang, kichThuoc: 20 }) })
      .then((kq) => { setKetQua(kq.data); setLoi(''); })
      .catch((e) => setLoi(e.message));
  }, [bangId, tuKhoa, trang]);
  useEffect(() => {
    const hen = setTimeout(tai, 300);
    return () => clearTimeout(hen);
  }, [tai]);

  const bang = ketQua?.bangLuong;
  const laNhap = bang?.trangThai === 'BAN_NHAP';

  // Khóa nút khi đang gửi để bấm đúp không gửi 2 lần (lần 2 bị 409 che mất thông báo thành công)
  const [dangGui, setDangGui] = useState(false);
  const thucHien = async (hanhDong) => {
    if (hanhDong === 'tinhLai' && !window.confirm('Tính lại sẽ bỏ mọi chỉnh sửa tay trên phiếu lương. Tiếp tục?')) return;
    setDangGui(true);
    try {
      const kq = await goiApi.post(`/bangLuong/${bangId}/${hanhDong}`);
      setThongBao(kq.message);
      setLoi('');
      tai();
    } catch (e) {
      setThongBao('');
      setLoi(e.message);
    } finally {
      setDangGui(false);
    }
  };

  const taiExcel = async () => {
    try {
      const tep = await goiApi.get(`/bangLuong/${bangId}/xuatExcel`, { responseType: 'blob' });
      const url = URL.createObjectURL(tep);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bang.maBangLuong}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // responseType blob: body lỗi của backend là Blob JSON -> đọc lại để lấy thông báo tiếng Việt
      let thongBaoLoi = e.message;
      if (e instanceof Blob) {
        try { thongBaoLoi = JSON.parse(await e.text()).message; } catch { /* giữ thông báo mặc định */ }
      }
      setThongBao('');
      setLoi(thongBaoLoi ?? 'Không tải được tệp Excel');
    }
  };

  const cot = [
    { khoa: 'hoVaTen', tieuDe: 'Nhân viên', hienThi: (d) => <>{d.hoVaTen} <span className="chuPhu">{d.maNhanVien}</span></> },
    { khoa: 'tenPhongBan', tieuDe: 'Phòng ban' },
    { khoa: 'soNgayCongThucTe', tieuDe: 'Công', canPhai: true },
    { khoa: 'luongTheoCong', tieuDe: 'Lương theo công', canPhai: true, hienThi: (d) => dinhDangTien(d.luongTheoCong) },
    { khoa: 'luongLamThemOT', tieuDe: 'OT', canPhai: true, hienThi: (d) => dinhDangTien(d.luongLamThemOT) },
    {
      khoa: 'thuongKPI', tieuDe: 'Thưởng/Phạt', canPhai: true,
      hienThi: (d) => (
        <span title={d.thuongKpi !== undefined ? `Thưởng KPI ${dinhDangTien(d.thuongKpi)} · Khen thưởng − kỷ luật ${dinhDangTien(d.thuongPhatKhac)}` : undefined}>
          {dinhDangTien(d.thuongKPI)}
        </span>
      ),
    },
    { khoa: 'tongPhuCap', tieuDe: 'Phụ cấp', canPhai: true, hienThi: (d) => dinhDangTien(d.tongPhuCap) },
    { khoa: 'khauTruBaoHiem', tieuDe: 'BH', canPhai: true, hienThi: (d) => dinhDangTien(d.khauTruBaoHiem) },
    { khoa: 'khauTruThueTNCN', tieuDe: 'Thuế', canPhai: true, hienThi: (d) => dinhDangTien(d.khauTruThueTNCN) },
    { khoa: 'thucLinh', tieuDe: 'Thực lĩnh', canPhai: true, hienThi: (d) => <strong>{dinhDangTien(d.thucLinh)}</strong> },
  ];

  return (
    <>
      <div className="dauTrangNghiepVu">
        <div>
          <button type="button" className="lienKet" onClick={onQuayLai}><ArrowLeft size={14} /> Danh sách bảng lương</button>
          <h1 className="tieuDeTrang">
            Bảng lương tháng {bang ? kyLuong(bang) : ''} {bang && <ChipTrangThai trangThai={bang.trangThai} kieu="chip" />}
          </h1>
          {bang && (
            <div className="chuPhu">
              {bang.maBangLuong} · {bang.soPhieu} phiếu · công chuẩn {bang.ngayCongChuan} ngày · lập bởi {bang.tenNguoiLap}
              {bang.tenNguoiDuyet ? ` · duyệt bởi ${bang.tenNguoiDuyet}` : ''}
            </div>
          )}
        </div>
        {bang && (
          <div className="hangNutPhai">
            <NutBam bienThe="phu" bieuTuong={Download} onClick={taiExcel}>Xuất Excel</NutBam>
            {laHR && laNhap && (
              <>
                <NutBam bienThe="phu" bieuTuong={RefreshCw} disabled={dangGui} onClick={() => thucHien('tinhLai')}>Tính lại</NutBam>
                <NutBam bienThe="phu" bieuTuong={Trash2} onClick={() => setDangXoa(true)}>Xóa</NutBam>
                <NutBam bieuTuong={Send} disabled={dangGui} onClick={() => thucHien('guiDuyet')}>Gửi duyệt</NutBam>
              </>
            )}
            {laGiamDoc && bang.trangThai === 'CHO_DUYET' && (
              <>
                <NutBam bienThe="phu" bieuTuong={Undo2} onClick={() => setDangTraLai(true)}>Trả lại</NutBam>
                <NutBam bieuTuong={Check} onClick={() => setDangDuyet(true)}>Duyệt</NutBam>
              </>
            )}
          </div>
        )}
      </div>

      {bang && (
        <div style={LUOI_THE}>
          <TheThongKe tieuDe="Tổng chi phí lương" giaTri={dinhDangTien(bang.tongChiPhiLuong)} moTa="Tổng thu nhập trước khấu trừ" />
          <TheThongKe tieuDe="Số phiếu" giaTri={bang.soPhieu} moTa={laNhap && laHR ? 'Bấm một dòng để sửa phiếu' : 'Bấm một dòng để xem'} />
        </div>
      )}
      <ThanhLoc tuKhoa={tuKhoa} onDoiTuKhoa={(v) => { setTuKhoa(v); setTrang(1); }} goiYTim="Mã hoặc tên nhân viên..." phanPhai={<span />} />
      {loi && <div className="thongBao loi">{loi}</div>}
      {thongBao && <div className="thongBao thanhCong">{thongBao}</div>}
      <BangDuLieu
        cot={cot}
        duLieu={ketQua?.items ?? []}
        onHanhDong={(d) => (laHR && laNhap && d.nhanVienId !== nhanVienIdCuaToi ? setDangSua(d) : setDangXem(d))}
        thongBaoRong="Không có phiếu lương phù hợp"
      />
      <PhanTrang phanTrang={ketQua?.phanTrang} onDoiTrang={setTrang} />

      {dangXem && (
        <HopThoai tieuDe={`Phiếu lương ${dangXem.hoVaTen} (${dangXem.maNhanVien})`} onDong={() => setDangXem(null)}>
          <ChiTietPhieuLuong phieu={dangXem} />
        </HopThoai>
      )}
      {dangSua && (
        <HopThoaiBieuMau
          tieuDe={`Sửa phiếu lương ${dangSua.hoVaTen} (${dangSua.maNhanVien})`}
          moTa={`Lương cơ bản ${dinhDangTien(dangSua.luongCoBan)}, bảo hiểm ${dinhDangTien(dangSua.khauTruBaoHiem)}. Thuế TNCN tự tính lại; đổi ngày công mà giữ nguyên phụ cấp thì phụ cấp tự chia lại theo hợp đồng.`}
          truong={[
            { ten: 'soNgayCongThucTe', nhan: `Ngày công (tối đa ${dangSua.ngayCongChuan}, bước 0.5)`, kieu: 'number', batBuoc: true },
            { ten: 'luongLamThemOT', nhan: 'Lương làm thêm', kieu: 'number', batBuoc: true },
            { ten: 'thuongKPI', nhan: 'Thưởng / phạt', ghiChu: 'Tổng thưởng KPI + khen thưởng − kỷ luật; số âm nếu là khoản phạt', batBuoc: true },
            { ten: 'tongPhuCap', nhan: 'Phụ cấp', kieu: 'number', batBuoc: true },
          ]}
          giaTriBanDau={Object.fromEntries(['soNgayCongThucTe', 'luongLamThemOT', 'thuongKPI', 'tongPhuCap'].map((k) => [k, String(dangSua[k])]))}
          onGui={async (giaTri) => {
            const body = Object.fromEntries(Object.entries(giaTri)
              .map(([k, v]) => [k, Number(v)])
              .filter(([k, v]) => v !== dangSua[k]));
            if (Object.values(body).some(Number.isNaN)) throw new Error('Các khoản phải là số');
            await goiApi.patch(`/phieuLuong/${dangSua.id}`, body);
            setDangSua(null);
            setThongBao('Cập nhật phiếu lương thành công');
            tai();
          }}
          onDong={() => setDangSua(null)}
        />
      )}
      {dangTraLai && (
        <HopThoaiBieuMau
          tieuDe={`Trả lại bảng lương tháng ${kyLuong(bang)}`}
          truong={[{ ten: 'lyDo', nhan: 'Lý do trả lại', kieu: 'textarea', batBuoc: true }]}
          nhanNutGui="Trả lại"
          onGui={async (giaTri) => {
            const kq = await goiApi.post(`/bangLuong/${bangId}/traLai`, { lyDo: giaTri.lyDo });
            setDangTraLai(false);
            setThongBao(kq.message);
            tai();
          }}
          onDong={() => setDangTraLai(false)}
        />
      )}
      {dangDuyet && (
        <HopThoai
          tieuDe={`Duyệt bảng lương tháng ${kyLuong(bang)}?`}
          onDong={() => setDangDuyet(false)}
          chanTrang={(
            <>
              <NutBam bienThe="phu" onClick={() => setDangDuyet(false)}>Hủy</NutBam>
              <NutBam bieuTuong={Check} onClick={() => { setDangDuyet(false); thucHien('duyet'); }}>Duyệt</NutBam>
            </>
          )}
        >
          Sau khi duyệt, {bang.soPhieu} phiếu lương được công bố cho nhân viên và không thể sửa, tính lại hay xóa.
          Tổng chi phí lương: <strong>{dinhDangTien(bang.tongChiPhiLuong)}</strong>.
        </HopThoai>
      )}
      {dangXoa && (
        <HopThoai
          tieuDe={`Xóa bảng lương tháng ${kyLuong(bang)}?`}
          onDong={() => setDangXoa(false)}
          chanTrang={(
            <>
              <NutBam bienThe="phu" onClick={() => setDangXoa(false)}>Hủy</NutBam>
              <NutBam
                bieuTuong={Trash2}
                onClick={async () => {
                  try {
                    await goiApi.delete(`/bangLuong/${bangId}`);
                    onQuayLai('Đã xóa bảng lương nháp');
                  } catch (e) {
                    setDangXoa(false);
                    setLoi(e.message);
                  }
                }}
              >
                Xóa
              </NutBam>
            </>
          )}
        >
          Toàn bộ {bang.soPhieu} phiếu nháp sẽ bị xóa. Có thể lập lại bảng cho tháng này sau.
        </HopThoai>
      )}
    </>
  );
}

// ===================== Danh sách bảng lương =====================

function DanhSachBang({ laHR, onChon, thongBaoBanDau }) {
  const [nam, setNam] = useState('');
  const [dsBang, setDsBang] = useState([]);
  const [thangDaChot, setThangDaChot] = useState([]);
  const [loi, setLoi] = useState('');
  const [thongBao, setThongBao] = useState(thongBaoBanDau ?? '');
  const [dangLap, setDangLap] = useState(false);

  const tai = useCallback(() => {
    goiApi.get('/bangLuong', { params: locThamSo({ nam }) })
      .then((kq) => { setDsBang(kq.data); setLoi(''); })
      .catch((e) => setLoi(e.message));
  }, [nam]);
  useEffect(tai, [tai]);
  useEffect(() => {
    if (laHR) goiApi.get('/chamCong/chotCong').then((kq) => setThangDaChot(kq.data)).catch(() => {});
  }, [laHR]);

  // Tháng đã chốt công nhưng chưa có bảng lương
  const daCoBang = new Set(dsBang.map((b) => b.thangNam));
  const thangLapDuoc = thangDaChot.map((t) => t.thang).filter((t) => !daCoBang.has(t));

  const cot = [
    { khoa: 'maBangLuong', tieuDe: 'Mã bảng' },
    { khoa: 'thangNam', tieuDe: 'Kỳ lương', hienThi: kyLuong },
    { khoa: 'soPhieu', tieuDe: 'Số phiếu', canPhai: true },
    { khoa: 'tongChiPhiLuong', tieuDe: 'Tổng chi phí lương', canPhai: true, hienThi: (d) => dinhDangTien(d.tongChiPhiLuong) },
    { khoa: 'tenNguoiLap', tieuDe: 'Người lập' },
    { khoa: 'tenNguoiDuyet', tieuDe: 'Người duyệt', hienThi: (d) => d.tenNguoiDuyet ?? '—' },
    { khoa: 'ngayTao', tieuDe: 'Ngày lập', hienThi: (d) => dinhDangThoiGian(d.ngayTao) },
    { khoa: 'trangThai', tieuDe: 'Trạng thái', hienThi: (d) => <ChipTrangThai trangThai={d.trangThai} /> },
  ];

  return (
    <>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Bảng lương</h1>
          <div className="chuPhu">HR lập bảng nháp khi tháng đã chốt công → gửi duyệt → Ban Giám đốc duyệt hoặc trả lại</div>
        </div>
        <div className="hangNutPhai">
          <label className="truongForm">
            Năm
            <select value={nam} onChange={(e) => setNam(e.target.value)}>
              <option value="">Tất cả</option>
              {[namHienTai - 2, namHienTai - 1, namHienTai].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          {laHR && <NutBam bieuTuong={FilePlus} onClick={() => setDangLap(true)}>Lập bảng lương</NutBam>}
        </div>
      </div>
      {loi && <div className="thongBao loi">{loi}</div>}
      {thongBao && <div className="thongBao thanhCong">{thongBao}</div>}
      <BangDuLieu cot={cot} duLieu={dsBang} onHanhDong={(b) => onChon(b.id)} thongBaoRong="Chưa có bảng lương" />

      {dangLap && (
        <HopThoaiBieuMau
          tieuDe="Lập bảng lương"
          moTa={thangLapDuoc.length
            ? 'Phiếu được sinh từ hợp đồng hiệu lực, chấm công, đơn nghỉ đã duyệt và quyết định khen thưởng/kỷ luật trong tháng.'
            : 'Không còn tháng nào đã chốt công mà chưa có bảng lương. Hãy chốt công tháng ở mục Chấm công trước.'}
          truong={[{
            ten: 'thang', nhan: 'Tháng (đã chốt công)', kieu: 'select', batBuoc: true,
            luaChon: thangLapDuoc.map((t) => ({ giaTri: t, nhan: `${t.slice(5)}/${t.slice(0, 4)}` })),
          }]}
          giaTriBanDau={{ thang: thangLapDuoc[0] ?? '' }}
          nhanNutGui="Lập bảng"
          onGui={async (giaTri) => {
            const kq = await goiApi.post('/bangLuong', { thang: giaTri.thang });
            setDangLap(false);
            onChon(kq.data.id);
          }}
          onDong={() => setDangLap(false)}
        />
      )}
    </>
  );
}

// ===================== Báo cáo quỹ lương =====================

function BaoCaoQuyLuong() {
  const [nam, setNam] = useState(namHienTai);
  const [baoCao, setBaoCao] = useState(null);
  const [loi, setLoi] = useState('');

  useEffect(() => {
    goiApi.get('/bangLuong/baoCao', { params: { nam } })
      .then((kq) => { setBaoCao(kq.data); setLoi(''); })
      .catch((e) => setLoi(e.message));
  }, [nam]);

  const duLieuBieuDo = (baoCao?.theoThang ?? []).map((t) => ({ ten: `T${t.thang}`, tongThuNhap: t.tongThuNhap }));
  const tong = (khoa) => (baoCao?.theoThang ?? []).reduce((s, t) => s + t[khoa], 0);
  const cotPhongBan = [
    { khoa: 'tenPhongBan', tieuDe: 'Phòng ban' },
    { khoa: 'soNhanVien', tieuDe: 'Số phiếu', canPhai: true },
    { khoa: 'tongThuNhap', tieuDe: 'Tổng thu nhập', canPhai: true, hienThi: (d) => dinhDangTien(d.tongThuNhap) },
    { khoa: 'tongBaoHiem', tieuDe: 'Bảo hiểm', canPhai: true, hienThi: (d) => dinhDangTien(d.tongBaoHiem) },
    { khoa: 'tongThue', tieuDe: 'Thuế TNCN', canPhai: true, hienThi: (d) => dinhDangTien(d.tongThue) },
    { khoa: 'tongThucLinh', tieuDe: 'Thực lĩnh', canPhai: true, hienThi: (d) => dinhDangTien(d.tongThucLinh) },
  ];

  return (
    <>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Báo cáo quỹ lương {nam}</h1>
          <div className="chuPhu">Chỉ tính các bảng lương đã duyệt</div>
        </div>
        <label className="truongForm">
          Năm
          <select value={nam} onChange={(e) => setNam(Number(e.target.value))}>
            {[namHienTai - 2, namHienTai - 1, namHienTai].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      {loi && <div className="thongBao loi">{loi}</div>}
      <div style={LUOI_THE}>
        <TheThongKe tieuDe="Tổng quỹ lương" giaTri={dinhDangTien(baoCao?.tongNam ?? 0)} moTa={`${baoCao?.theoThang.length ?? 0} kỳ đã duyệt`} />
        <TheThongKe tieuDe="Bảo hiểm người lao động" giaTri={dinhDangTien(tong('tongBaoHiem'))} />
        <TheThongKe tieuDe="Thuế TNCN" giaTri={dinhDangTien(tong('tongThue'))} />
        <TheThongKe tieuDe="Tổng thực lĩnh" giaTri={dinhDangTien(tong('tongThucLinh'))} />
      </div>
      <div className="the theNoiDung" style={{ marginBottom: 16 }}>
        <div className="dauThe"><strong>Tổng thu nhập theo tháng</strong></div>
        {duLieuBieuDo.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={duLieuBieuDo}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--mauVien)" vertical={false} />
              <XAxis dataKey="ten" />
              <YAxis tickFormatter={trieuDong} width={70} />
              <Tooltip formatter={(v) => dinhDangTien(v)} />
              <Bar dataKey="tongThuNhap" name="Tổng thu nhập" fill="var(--mauChinh)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <div className="chuPhu">Chưa có bảng lương đã duyệt trong năm {nam}</div>}
      </div>
      <BangDuLieu cot={cotPhongBan} khoaDong="phongBanId" duLieu={baoCao?.theoPhongBan ?? []} thongBaoRong="Chưa có dữ liệu" />
    </>
  );
}

// Tab Bảng lương (HR, giamDoc): danh sách / chi tiết bảng lương và báo cáo quỹ lương
function TrangBangLuong() {
  const { nguoiDung } = useXacThuc();
  const laHR = nguoiDung.vaiTro.includes('HR');
  const laGiamDoc = nguoiDung.vaiTro.includes('giamDoc');
  const [tab, setTab] = useState('bang');
  const [bangDangChon, setBangDangChon] = useState(null);
  const [thongBao, setThongBao] = useState('');

  return (
    <div>
      <div className="tabGachChan">
        <button type="button" className={tab === 'bang' ? 'dangChon' : ''} onClick={() => setTab('bang')}>Bảng lương</button>
        <button type="button" className={tab === 'baoCao' ? 'dangChon' : ''} onClick={() => setTab('baoCao')}>Báo cáo quỹ lương</button>
      </div>
      {tab === 'baoCao' && <BaoCaoQuyLuong />}
      {tab === 'bang' && (bangDangChon
        ? (
          <ChiTietBang
            bangId={bangDangChon}
            laHR={laHR}
            laGiamDoc={laGiamDoc}
            nhanVienIdCuaToi={nguoiDung.nhanVienId}
            onQuayLai={(tb) => { setThongBao(typeof tb === 'string' ? tb : ''); setBangDangChon(null); }}
          />
        )
        : <DanhSachBang laHR={laHR} onChon={setBangDangChon} thongBaoBanDau={thongBao} />)}
    </div>
  );
}

export default TrangBangLuong;
