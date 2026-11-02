import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Pencil, Power, UserCheck, UserMinus } from 'lucide-react';
import goiApi from '../../services/goiApi';
import { useXacThuc } from '../../context/NguCanhXacThuc';
import NutBam from '../../components/NutBam';
import ChipTrangThai from '../../components/ChipTrangThai';
import BangDuLieu from '../../components/BangDuLieu';
import HopThoaiBieuMau from '../../components/HopThoaiBieuMau';
import './TrangPhongBan.css';

// Dựng cây từ danh sách phẳng theo phongBanChaId
function dungCay(danhSach) {
  const theoCha = new Map();
  danhSach.forEach((pb) => {
    const cha = pb.phongBanChaId ?? 0;
    theoCha.set(cha, [...(theoCha.get(cha) ?? []), pb]);
  });
  const coId = new Set(danhSach.map((pb) => pb.id));
  // Phòng có cha không nằm trong danh sách (bị lọc) cũng hiện ở gốc
  const goc = danhSach.filter((pb) => !pb.phongBanChaId || !coId.has(pb.phongBanChaId));
  return { goc, theoCha };
}

function NutCay({ phongBan, theoCha, dangChon, onChon, capDo = 0 }) {
  const [mo, setMo] = useState(true);
  const con = theoCha.get(phongBan.id) ?? [];
  return (
    <>
      <button
        type="button"
        className={`nutCay ${dangChon === phongBan.id ? 'dangChon' : ''}`}
        style={{ paddingLeft: 8 + capDo * 18 }}
        onClick={() => onChon(phongBan.id)}
      >
        <span className="muiTen" onClick={(e) => { e.stopPropagation(); setMo(!mo); }}>
          {con.length > 0 && (mo ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
        </span>
        <span className="tenNut">{phongBan.tenPhongBan}</span>
        {phongBan.trangThai !== 'DANG_HOAT_DONG' && <ChipTrangThai trangThai={phongBan.trangThai} />}
        <span className="chuPhu">{phongBan.tongQuanSo ?? phongBan.soNhanVien}</span>
      </button>
      {mo && con.map((c) => (
        <NutCay key={c.id} phongBan={c} theoCha={theoCha} dangChon={dangChon} onChon={onChon} capDo={capDo + 1} />
      ))}
    </>
  );
}

function TrangPhongBan() {
  const { nguoiDung } = useXacThuc();
  const laHR = nguoiDung.vaiTro.includes('HR');
  const laGiamDoc = nguoiDung.vaiTro.includes('giamDoc');
  const [danhSach, setDanhSach] = useState([]);
  const [chucDanh, setChucDanh] = useState([]);
  const [dangChon, setDangChon] = useState(null);
  const [chiTiet, setChiTiet] = useState(null);
  const [loi, setLoi] = useState('');
  const [thaoTac, setThaoTac] = useState(null); // { loai, duLieu }
  const [tab, setTab] = useState('phongBan');

  const taiDanhSach = useCallback(() => {
    goiApi.get('/phongBan').then((kq) => {
      setDanhSach(kq.data);
      setDangChon((cu) => cu ?? kq.data[0]?.id ?? null);
    }).catch((e) => setLoi(e.message));
    goiApi.get('/chucDanh').then((kq) => setChucDanh(kq.data)).catch(() => {});
  }, []);
  useEffect(taiDanhSach, [taiDanhSach]);

  const taiChiTiet = useCallback(() => {
    if (!dangChon) return;
    goiApi.get(`/phongBan/${dangChon}`).then((kq) => setChiTiet(kq.data)).catch((e) => setLoi(e.message));
  }, [dangChon]);
  useEffect(taiChiTiet, [taiChiTiet]);

  const { goc, theoCha } = useMemo(() => dungCay(danhSach), [danhSach]);
  const luaChonPhongBan = danhSach
    .filter((pb) => pb.trangThai === 'DANG_HOAT_DONG')
    .map((pb) => ({ giaTri: pb.id, nhan: `${pb.tenPhongBan} (${pb.maPhongBan})` }));
  const luaChonChucDanh = chucDanh
    .filter((cd) => cd.trangThai === 'DANG_HOAT_DONG')
    .map((cd) => ({ giaTri: cd.id, nhan: cd.tenChucDanh }));

  const xong = () => { setThaoTac(null); taiDanhSach(); taiChiTiet(); };
  const gui = (phuongThuc, duongDan) => async (giaTri) => {
    await goiApi[phuongThuc](duongDan, giaTri);
    xong();
  };
  const doiTrangThai = async (duongDan, trangThai) => {
    try {
      setLoi('');
      await goiApi.post(duongDan, { trangThai });
      xong();
    } catch (e) {
      setLoi(e.message);
    }
  };

  const moBoNhiem = () => setThaoTac({ loai: 'boNhiem' });

  const xemDinhBien = laHR || laGiamDoc;
  const cotViTri = [
    { khoa: 'tenChucDanh', tieuDe: 'Chức danh' },
    { khoa: 'capBac', tieuDe: 'Cấp bậc' },
    ...(xemDinhBien ? [
      { khoa: 'soDangGiu', tieuDe: 'Đang giữ', canPhai: true, hienThi: (d) => `${d.soDangGiu}/${d.dinhBien}` },
      { khoa: 'ghiChu', tieuDe: 'Ghi chú', hienThi: (d) => d.ghiChu || '—' },
    ] : []),
    { khoa: 'trangThai', tieuDe: 'Trạng thái', hienThi: (d) => <ChipTrangThai trangThai={d.trangThai} /> },
  ];

  const cotChucDanh = [
    { khoa: 'maChucDanh', tieuDe: 'Mã' },
    { khoa: 'tenChucDanh', tieuDe: 'Tên chức danh' },
    { khoa: 'capBac', tieuDe: 'Cấp bậc' },
    { khoa: 'trangThai', tieuDe: 'Trạng thái', hienThi: (d) => <ChipTrangThai trangThai={d.trangThai} /> },
  ];

  return (
    <div>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Cơ cấu tổ chức</h1>
          <div className="chuPhu">{danhSach.length} phòng ban · {chucDanh.length} chức danh</div>
        </div>
        {laHR && (
          <div className="hangNutPhai">
            <NutBam bieuTuong={Plus} onClick={() => setThaoTac({ loai: 'themPhongBan' })}>Thêm phòng ban</NutBam>
            <NutBam bienThe="phu" bieuTuong={Plus} onClick={() => setThaoTac({ loai: 'themChucDanh' })}>Thêm chức danh</NutBam>
          </div>
        )}
      </div>
      {loi && <div className="thongBao loi">{loi}</div>}

      {laHR && (
        <div className="tabGachChan">
          <button type="button" className={tab === 'phongBan' ? 'dangChon' : ''} onClick={() => setTab('phongBan')}>Sơ đồ phòng ban</button>
          <button type="button" className={tab === 'chucDanh' ? 'dangChon' : ''} onClick={() => setTab('chucDanh')}>Danh mục chức danh</button>
        </div>
      )}

      {tab === 'chucDanh' && (
        <BangDuLieu
          cot={cotChucDanh}
          duLieu={chucDanh}
          onHanhDong={(d) => setThaoTac({ loai: 'suaChucDanh', duLieu: d })}
        />
      )}

      {tab === 'phongBan' && (
        <div className="boCucPhongBan">
          <div className="the cayPhongBan">
            {goc.map((pb) => (
              <NutCay key={pb.id} phongBan={pb} theoCha={theoCha} dangChon={dangChon} onChon={setDangChon} />
            ))}
          </div>

          {chiTiet && (
            <div>
              <div className="the theNoiDung">
                <div className="dauThe">
                  <div>
                    <h3>{chiTiet.tenPhongBan} <span className="chuPhu">({chiTiet.maPhongBan})</span></h3>
                    <ChipTrangThai trangThai={chiTiet.trangThai} />
                  </div>
                  <div className="hangNutPhai">
                    {laHR && (
                      <>
                        <NutBam bienThe="phu" bieuTuong={Pencil} onClick={() => setThaoTac({ loai: 'suaPhongBan' })}>Sửa</NutBam>
                        <NutBam
                          bienThe="phu"
                          bieuTuong={Power}
                          onClick={() => doiTrangThai(`/phongBan/${chiTiet.id}/doiTrangThai`, chiTiet.trangThai === 'DANG_HOAT_DONG' ? 'NGUNG_HOAT_DONG' : 'DANG_HOAT_DONG')}
                        >
                          {chiTiet.trangThai === 'DANG_HOAT_DONG' ? 'Ngừng hoạt động' : 'Kích hoạt'}
                        </NutBam>
                      </>
                    )}
                    {laGiamDoc && chiTiet.trangThai === 'DANG_HOAT_DONG' && (
                      <NutBam bienThe="phu" bieuTuong={UserCheck} onClick={moBoNhiem}>Bổ nhiệm trưởng</NutBam>
                    )}
                    {laGiamDoc && chiTiet.truongBoPhanId && chiTiet.truongBoPhanId !== nguoiDung.nhanVienId && (
                      <NutBam
                        bienThe="phu"
                        bieuTuong={UserMinus}
                        onClick={async () => {
                          try { await goiApi.post(`/phongBan/${chiTiet.id}/mienNhiem`); xong(); } catch (e) { setLoi(e.message); }
                        }}
                      >
                        Miễn nhiệm
                      </NutBam>
                    )}
                  </div>
                </div>
                <div className="luoiThongTin">
                  <div className="oThongTin"><span>Trưởng bộ phận</span><strong>{chiTiet.tenTruongBoPhan ? `${chiTiet.tenTruongBoPhan} (${chiTiet.maTruongBoPhan})` : 'Chưa bổ nhiệm'}</strong></div>
                  <div className="oThongTin"><span>Phòng ban cha</span><strong>{danhSach.find((pb) => pb.id === chiTiet.phongBanChaId)?.tenPhongBan ?? '— (gốc)'}</strong></div>
                  <div className="oThongTin"><span>Quân số trực tiếp</span><strong>{chiTiet.soNhanVien}</strong></div>
                  <div className="oThongTin"><span>Tổng quân số (cả phòng con)</span><strong>{chiTiet.tongQuanSo}</strong></div>
                </div>
              </div>

              <div className="dauThe">
                <h3>Vị trí trong phòng ban</h3>
                {laHR && chiTiet.trangThai === 'DANG_HOAT_DONG' && (
                  <NutBam bienThe="phu" bieuTuong={Plus} onClick={() => setThaoTac({ loai: 'themViTri' })}>Thêm vị trí</NutBam>
                )}
              </div>
              <BangDuLieu
                cot={cotViTri}
                duLieu={chiTiet.viTri}
                onHanhDong={laHR ? (d) => setThaoTac({ loai: 'suaViTri', duLieu: d }) : undefined}
                thongBaoRong="Chưa có vị trí nào"
              />
            </div>
          )}
        </div>
      )}

      {thaoTac?.loai === 'themPhongBan' && (
        <HopThoaiBieuMau
          tieuDe="Thêm phòng ban"
          truong={[
            { ten: 'maPhongBan', nhan: 'Mã phòng ban', batBuoc: true, goiY: 'VD: PKD', ghiChu: 'Chữ in hoa, số, gạch ngang' },
            { ten: 'tenPhongBan', nhan: 'Tên phòng ban', batBuoc: true },
            { ten: 'phongBanChaId', nhan: 'Phòng ban cha', kieu: 'select', luaChon: luaChonPhongBan, rongHet: true },
          ]}
          giaTriBanDau={{ phongBanChaId: luaChonPhongBan.some((lc) => lc.giaTri === dangChon) ? dangChon : '' }}
          onGui={(g) => gui('post', '/phongBan')({ ...g, phongBanChaId: g.phongBanChaId || undefined })}
          onDong={() => setThaoTac(null)}
        />
      )}
      {thaoTac?.loai === 'suaPhongBan' && (
        <HopThoaiBieuMau
          tieuDe={`Sửa ${chiTiet.tenPhongBan}`}
          truong={[
            { ten: 'tenPhongBan', nhan: 'Tên phòng ban', batBuoc: true, rongHet: true },
            {
              ten: 'phongBanChaId', nhan: 'Phòng ban cha (bỏ trống = gốc)', kieu: 'select', rongHet: true,
              luaChon: luaChonPhongBan.filter((lc) => lc.giaTri !== chiTiet.id),
            },
          ]}
          giaTriBanDau={chiTiet}
          onGui={(g) => gui('patch', `/phongBan/${chiTiet.id}`)({
            tenPhongBan: g.tenPhongBan,
            // Không gửi lại phòng cha khi không đổi (phòng cha cũ có thể đã ngừng, không có trong lựa chọn)
            ...(Number(g.phongBanChaId || 0) !== Number(chiTiet.phongBanChaId || 0) && { phongBanChaId: g.phongBanChaId || null }),
          })}
          onDong={() => setThaoTac(null)}
        />
      )}
      {thaoTac?.loai === 'boNhiem' && (
        <HopThoaiBieuMau
          tieuDe={`Bổ nhiệm trưởng ${chiTiet.tenPhongBan}`}
          moTa="Người được bổ nhiệm tự động có vai trò Quản lý cho phòng ban này và các phòng con."
          truong={[{
            ten: 'nhanVienId', nhan: 'Nhân viên trong phòng', kieu: 'nhanVien', batBuoc: true,
            // Chỉ người đang làm việc thuộc chính phòng này; bỏ trưởng hiện tại và chính giamDoc (không tự bổ nhiệm)
            locNhanVien: {
              phongBanId: chiTiet.id,
              trangThai: ['THU_VIEC', 'CHINH_THUC'],
              boQuaIds: [chiTiet.truongBoPhanId, nguoiDung.nhanVienId].filter(Boolean),
            },
          }]}
          nhanNutGui="Bổ nhiệm"
          onGui={gui('post', `/phongBan/${chiTiet.id}/boNhiem`)}
          onDong={() => setThaoTac(null)}
        />
      )}
      {thaoTac?.loai === 'themViTri' && (
        <HopThoaiBieuMau
          tieuDe={`Thêm vị trí vào ${chiTiet.tenPhongBan}`}
          truong={[
            { ten: 'chucDanhId', nhan: 'Chức danh', kieu: 'select', luaChon: luaChonChucDanh, batBuoc: true },
            { ten: 'dinhBien', nhan: 'Định biên (người)', kieu: 'number', batBuoc: true },
            { ten: 'ghiChu', nhan: 'Ghi chú', kieu: 'textarea' },
          ]}
          onGui={(g) => gui('post', '/chucDanhPhongBan')({ ...g, phongBanId: chiTiet.id, dinhBien: Number(g.dinhBien) })}
          onDong={() => setThaoTac(null)}
        />
      )}
      {thaoTac?.loai === 'suaViTri' && (
        <HopThoaiBieuMau
          tieuDe={`Vị trí ${thaoTac.duLieu.tenChucDanh}`}
          moTa={`Đang có ${thaoTac.duLieu.soDangGiu} người giữ vị trí này. Định biên không được nhỏ hơn số này.`}
          truong={[
            { ten: 'dinhBien', nhan: 'Định biên (người)', kieu: 'number', batBuoc: true },
            {
              ten: 'trangThai', nhan: 'Trạng thái', kieu: 'select', batBuoc: true,
              luaChon: [{ giaTri: 'DANG_AP_DUNG', nhan: 'Đang áp dụng' }, { giaTri: 'NGUNG_AP_DUNG', nhan: 'Ngừng áp dụng' }],
            },
            { ten: 'ghiChu', nhan: 'Ghi chú', kieu: 'textarea' },
          ]}
          giaTriBanDau={thaoTac.duLieu}
          onGui={async (g) => {
            const vt = thaoTac.duLieu;
            // Một lời gọi duy nhất: backend sửa thông tin + trạng thái trong cùng transaction
            const thayDoi = {
              ...(Number(g.dinhBien) !== vt.dinhBien && { dinhBien: Number(g.dinhBien) }),
              ...(g.ghiChu !== (vt.ghiChu ?? '') && { ghiChu: g.ghiChu }),
              ...(g.trangThai !== vt.trangThai && { trangThai: g.trangThai }),
            };
            if (Object.keys(thayDoi).length) await goiApi.patch(`/chucDanhPhongBan/${vt.id}`, thayDoi);
            xong();
          }}
          onDong={() => setThaoTac(null)}
        />
      )}
      {thaoTac?.loai === 'themChucDanh' && (
        <HopThoaiBieuMau
          tieuDe="Thêm chức danh"
          truong={[
            { ten: 'maChucDanh', nhan: 'Mã chức danh', batBuoc: true, goiY: 'VD: KT' },
            { ten: 'tenChucDanh', nhan: 'Tên chức danh', batBuoc: true },
            { ten: 'capBac', nhan: 'Cấp bậc', batBuoc: true, rongHet: true, goiY: 'VD: Chuyên viên' },
          ]}
          onGui={gui('post', '/chucDanh')}
          onDong={() => setThaoTac(null)}
        />
      )}
      {thaoTac?.loai === 'suaChucDanh' && (
        <HopThoaiBieuMau
          tieuDe={`Chức danh ${thaoTac.duLieu.maChucDanh}`}
          truong={[
            { ten: 'tenChucDanh', nhan: 'Tên chức danh', batBuoc: true },
            { ten: 'capBac', nhan: 'Cấp bậc', batBuoc: true },
            {
              ten: 'trangThai', nhan: 'Trạng thái', kieu: 'select', batBuoc: true, rongHet: true,
              luaChon: [{ giaTri: 'DANG_HOAT_DONG', nhan: 'Hoạt động' }, { giaTri: 'NGUNG_HOAT_DONG', nhan: 'Ngừng hoạt động' }],
            },
          ]}
          giaTriBanDau={thaoTac.duLieu}
          onGui={async (g) => {
            const cd = thaoTac.duLieu;
            const thayDoi = {
              ...(g.tenChucDanh !== cd.tenChucDanh && { tenChucDanh: g.tenChucDanh }),
              ...(g.capBac !== cd.capBac && { capBac: g.capBac }),
              ...(g.trangThai !== cd.trangThai && { trangThai: g.trangThai }),
            };
            if (Object.keys(thayDoi).length) await goiApi.patch(`/chucDanh/${cd.id}`, thayDoi);
            xong();
          }}
          onDong={() => setThaoTac(null)}
        />
      )}
    </div>
  );
}

export default TrangPhongBan;
