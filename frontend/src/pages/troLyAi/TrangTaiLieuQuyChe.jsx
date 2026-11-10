import { useCallback, useEffect, useState } from 'react';
import { Download, Trash2, Upload } from 'lucide-react';
import goiApi from '../../services/goiApi';
import useThongBao from '../../hooks/useThongBao';
import { useXacThuc } from '../../context/NguCanhXacThuc';
import BangDuLieu from '../../components/BangDuLieu';
import HopThoai from '../../components/HopThoai';
import HopThoaiBieuMau from '../../components/HopThoaiBieuMau';
import NutBam from '../../components/NutBam';
import PhanTrang from '../../components/PhanTrang';
import { dinhDangThoiGian, locThamSo } from '../../utils/dinhDang';

const DINH_DANG_CHAP_NHAN = '.pdf,.docx,.md';
const KICH_THUOC_TOI_DA = 10 * 1024 * 1024;
// Tải/gửi tệp lâu hơn request JSON thường (goiApi mặc định 10 giây)
const THOI_GIAN_CHO_TEP = 60000;

function dinhDangKichThuoc(soByte) {
  if (soByte === null || soByte === undefined) return 'Mất tệp';
  if (soByte < 1024) return `${soByte} B`;
  if (soByte < 1024 * 1024) return `${(soByte / 1024).toFixed(1)} KB`;
  return `${(soByte / 1024 / 1024).toFixed(1)} MB`;
}

// Lỗi của request responseType 'blob' có body là Blob JSON -> đọc lại để lấy thông báo tiếng Việt
async function layThongBaoLoi(loi) {
  if (loi instanceof Blob) {
    try {
      return JSON.parse(await loi.text()).message ?? 'Không tải được tệp';
    } catch {
      return 'Không tải được tệp';
    }
  }
  return loi?.message ?? 'Có lỗi xảy ra';
}

// Tài liệu quy chế: mọi vai trò xem và tải về; HR tải lên, xóa (nguồn tra cứu của Trợ lý AI)
function TrangTaiLieuQuyChe() {
  const { nguoiDung } = useXacThuc();
  const laHR = nguoiDung.vaiTro.includes('HR');
  const [tuKhoa, setTuKhoa] = useState('');
  const [trang, setTrang] = useState(1);
  const [ketQua, setKetQua] = useState(null);
  const [dangTai, setDangTai] = useState(true);
  const [dangThem, setDangThem] = useState(false);
  const [dangXoa, setDangXoa] = useState(null);
  const [dangGuiXoa, setDangGuiXoa] = useState(false);
  const { loi, thongBao, baoLoi, baoThanhCong } = useThongBao();

  const tai = useCallback(() => {
    setDangTai(true);
    goiApi
      .get('/taiLieuQuyChe', { params: locThamSo({ tuKhoa, trang, kichThuoc: 20 }) })
      .then((kq) => {
        setKetQua(kq.data);
        baoLoi('');
      })
      .catch((e) => baoLoi(e.message))
      .finally(() => setDangTai(false));
  }, [tuKhoa, trang, baoLoi]);

  useEffect(() => {
    const hen = setTimeout(tai, 300);
    return () => clearTimeout(hen);
  }, [tai]);

  const taiVe = async (taiLieu) => {
    try {
      const blob = await goiApi.get(`/taiLieuQuyChe/${taiLieu.id}/tep`, { responseType: 'blob', timeout: THOI_GIAN_CHO_TEP });
      const url = URL.createObjectURL(blob);
      const the = document.createElement('a');
      the.href = url;
      the.download = `${taiLieu.maTaiLieu}.${taiLieu.loaiTep}`;
      document.body.appendChild(the);
      the.click();
      the.remove();
      // Thu hồi sau khi trình duyệt đã bắt đầu tải (thu hồi ngay có thể làm hỏng lượt tải trên Firefox/Safari)
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      baoLoi(await layThongBaoLoi(e));
    }
  };

  const xacNhanXoa = async () => {
    setDangGuiXoa(true);
    try {
      const kq = await goiApi.delete(`/taiLieuQuyChe/${dangXoa.id}`);
      baoThanhCong(kq.message);
      setDangXoa(null);
      tai();
    } catch (e) {
      baoLoi(e.message);
      setDangXoa(null);
    } finally {
      setDangGuiXoa(false);
    }
  };

  const cot = [
    { khoa: 'maTaiLieu', tieuDe: 'Mã tài liệu' },
    { khoa: 'tieuDe', tieuDe: 'Tiêu đề' },
    { khoa: 'loaiTep', tieuDe: 'Định dạng', hienThi: (d) => d.loaiTep.toUpperCase() },
    { khoa: 'kichThuocTep', tieuDe: 'Dung lượng', canPhai: true, hienThi: (d) => dinhDangKichThuoc(d.kichThuocTep) },
    { khoa: 'tenNguoiTaiLen', tieuDe: 'Người tải lên', hienThi: (d) => `${d.tenNguoiTaiLen} (${d.maNguoiTaiLen})` },
    { khoa: 'ngayTao', tieuDe: 'Ngày tải lên', hienThi: (d) => dinhDangThoiGian(d.ngayTao) },
    {
      khoa: 'thaoTac',
      tieuDe: 'Thao tác',
      sapXep: false,
      hienThi: (d) => (
        <div className="hangNutPhai">
          <NutBam bienThe="ma" bieuTuong={Download} onClick={() => taiVe(d)} disabled={d.kichThuocTep === null} title="Tải về">
            Tải về
          </NutBam>
          {laHR && (
            <NutBam bienThe="ma" bieuTuong={Trash2} onClick={() => setDangXoa(d)} title="Xóa tài liệu">
              Xóa
            </NutBam>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Tài liệu quy chế</h1>
          <div className="chuPhu">Nội quy, quy chế công ty dùng làm nguồn tra cứu cho Trợ lý AI</div>
        </div>
        {laHR && (
          <NutBam bieuTuong={Upload} onClick={() => setDangThem(true)}>
            Tải lên tài liệu
          </NutBam>
        )}
      </div>
      <div className="thanhLoc">
        <label className="oTimKiem">
          <input
            value={tuKhoa}
            onChange={(e) => {
              setTuKhoa(e.target.value);
              setTrang(1);
            }}
            placeholder="Tìm theo mã hoặc tiêu đề"
          />
        </label>
      </div>
      {loi && <div className="thongBao loi">{loi}</div>}
      {thongBao && <div className="thongBao thanhCong">{thongBao}</div>}
      <BangDuLieu cot={cot} duLieu={ketQua?.items ?? []} dangTai={dangTai} thongBaoRong="Chưa có tài liệu quy chế" />
      <PhanTrang phanTrang={ketQua?.phanTrang} onDoiTrang={setTrang} />

      {dangThem && (
        <HopThoaiBieuMau
          tieuDe="Tải lên tài liệu quy chế"
          moTa="Nên trình bày theo Điều/Khoản (VD: “Điều 3. Thời giờ làm việc”) để Trợ lý AI trích dẫn chính xác."
          truong={[
            { ten: 'maTaiLieu', nhan: 'Mã tài liệu', batBuoc: true, goiY: 'VD: QC-TUYENDUNG', ghiChu: 'Chữ in hoa, số, "-" hoặc "_"' },
            { ten: 'tieuDe', nhan: 'Tiêu đề', batBuoc: true, goiY: 'VD: Quy chế tuyển dụng' },
            {
              ten: 'tep',
              nhan: 'Tệp tài liệu',
              kieu: 'tep',
              chapNhan: DINH_DANG_CHAP_NHAN,
              batBuoc: true,
              ghiChu: '.pdf, .docx hoặc .md, tối đa 10MB',
            },
          ]}
          nhanNutGui="Tải lên"
          onGui={async (giaTri) => {
            if (!giaTri.tep) throw new Error('Vui lòng chọn tệp tài liệu');
            if (giaTri.tep.size > KICH_THUOC_TOI_DA) throw new Error('Tệp vượt quá dung lượng cho phép (tối đa 10MB)');
            const duLieu = new FormData();
            duLieu.append('maTaiLieu', giaTri.maTaiLieu.trim().toUpperCase());
            duLieu.append('tieuDe', giaTri.tieuDe);
            duLieu.append('tep', giaTri.tep);
            const kq = await goiApi.post('/taiLieuQuyChe', duLieu, { timeout: THOI_GIAN_CHO_TEP });
            setDangThem(false);
            baoThanhCong(kq.message);
            setTrang(1);
            tai();
          }}
          onDong={() => setDangThem(false)}
        />
      )}
      {dangXoa && (
        <HopThoai
          tieuDe="Xóa tài liệu quy chế"
          onDong={() => setDangXoa(null)}
          chanTrang={
            <>
              <NutBam bienThe="phu" onClick={() => setDangXoa(null)}>
                Hủy
              </NutBam>
              <NutBam bienThe="vang" onClick={xacNhanXoa} disabled={dangGuiXoa}>
                {dangGuiXoa ? 'Đang xóa...' : 'Xóa'}
              </NutBam>
            </>
          }
        >
          Xóa tài liệu <strong>{dangXoa.maTaiLieu}</strong> – {dangXoa.tieuDe}? Tệp trên máy chủ cũng bị xóa và Trợ lý AI không còn tra cứu
          được tài liệu này.
        </HopThoai>
      )}
    </div>
  );
}

export default TrangTaiLieuQuyChe;
