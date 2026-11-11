import { useCallback, useEffect, useRef, useState } from 'react';
import goiApi from '../services/goiApi';

// Backend chờ ai-service tối đa AI_TIMEOUT_MS (30s) → chờ dư một chút để nhận thông báo lỗi thân thiện của backend
const THOI_GIAN_CHO_HOI_DAP = 40000;

// Trạng thái trang Trợ lý AI: danh sách phiên, phiên đang mở, tin nhắn, gửi câu hỏi.
// Phiên "mới" (phienDangChon = null) chỉ được tạo ở server khi gửi câu hỏi đầu tiên, tránh sinh phiên rỗng.
export default function useTroLyAi() {
  const [dsPhien, setDsPhien] = useState([]);
  const [phienDangChon, setPhienDangChon] = useState(null);
  const [tinNhan, setTinNhan] = useState([]);
  const [dangTaiPhien, setDangTaiPhien] = useState(true);
  const [dangTaiTin, setDangTaiTin] = useState(false);
  const [dangGui, setDangGui] = useState(false);
  const [loi, setLoi] = useState('');
  // Bỏ kết quả tải tin nhắn đã lỗi thời khi người dùng chuyển phiên nhanh
  const phienYeuCau = useRef(null);

  const taiDanhSachPhien = useCallback(async () => {
    try {
      const kq = await goiApi.get('/troLyAi/phien');
      setDsPhien(kq.data);
    } catch (e) {
      setLoi(e.message);
    } finally {
      setDangTaiPhien(false);
    }
  }, []);

  // Tải sau khi render xong (không setState đồng bộ trong effect), cùng cách các trang danh sách khác
  useEffect(() => {
    const hen = setTimeout(taiDanhSachPhien, 0);
    return () => clearTimeout(hen);
  }, [taiDanhSachPhien]);

  const chonPhien = useCallback(async (phien) => {
    phienYeuCau.current = phien.id;
    setPhienDangChon(phien);
    setTinNhan([]);
    setLoi('');
    setDangTaiTin(true);
    try {
      const kq = await goiApi.get(`/troLyAi/phien/${phien.id}/tinNhan`);
      if (phienYeuCau.current === phien.id) setTinNhan(kq.data.tinNhan);
    } catch (e) {
      if (phienYeuCau.current === phien.id) setLoi(e.message);
    } finally {
      if (phienYeuCau.current === phien.id) setDangTaiTin(false);
    }
  }, []);

  const moPhienMoi = useCallback(() => {
    phienYeuCau.current = null;
    setPhienDangChon(null);
    setTinNhan([]);
    setLoi('');
    setDangTaiTin(false);
  }, []);

  const gui = useCallback(
    async (cauHoi) => {
      const noiDung = cauHoi.trim();
      if (!noiDung || dangGui) return false;
      const phienGui = phienDangChon;
      setLoi('');
      setDangGui(true);
      // Hiện ngay câu hỏi (id tạm) trong lúc chờ trả lời
      const idTam = `tam-${Date.now()}`;
      setTinNhan((ds) => [...ds, { id: idTam, vaiTro: 'nguoiDung', noiDung }]);
      try {
        const kq = await goiApi.post(
          '/troLyAi/hoiDap',
          { cauHoi: noiDung, ...(phienGui ? { phienId: phienGui.id } : {}) },
          { timeout: THOI_GIAN_CHO_HOI_DAP },
        );
        const { phien, traLoi, nguonTrichDan, cheDo, loaiPhanHoi, banNhap, thoiGian } = kq.data;
        taiDanhSachPhien();
        // Người dùng đã rời phiên trong lúc chờ (mở phiên khác/phiên mới) → không kéo màn hình về phiên cũ
        if (phienYeuCau.current !== (phienGui?.id ?? null)) return true;
        phienYeuCau.current = phien.id;
        setPhienDangChon(phien);
        setTinNhan((ds) => {
          // Bản nháp mới thay bản nháp đang chờ cũ của phiên (server đã chuyển bản cũ sang HUY)
          const capNhat = banNhap
            ? ds.map((t) => (t.banNhap?.trangThai === 'CHO_XAC_NHAN' ? { ...t, banNhap: { ...t.banNhap, trangThai: 'HUY' } } : t))
            : ds;
          return [
            ...capNhat,
            { id: `tl-${Date.now()}`, vaiTro: 'troLy', noiDung: traLoi, nguonTrichDan, cheDo, loaiPhanHoi, banNhap, thoiGian },
          ];
        });
        return true;
      } catch (e) {
        // Câu hỏi không được lưu ở server: gỡ khỏi khung chat, trả lại ô nhập để người dùng gửi lại
        setTinNhan((ds) => ds.filter((t) => t.id !== idTam));
        if (phienYeuCau.current === (phienGui?.id ?? null)) setLoi(e.message);
        return false;
      } finally {
        setDangGui(false);
      }
    },
    [dangGui, phienDangChon, taiDanhSachPhien],
  );

  const doiTenPhien = useCallback(
    async (phien, tieuDePhien) => {
      const kq = await goiApi.patch(`/troLyAi/phien/${phien.id}`, { tieuDePhien: tieuDePhien.trim() });
      if (phienDangChon?.id === phien.id) setPhienDangChon(kq.data);
      await taiDanhSachPhien();
    },
    [phienDangChon, taiDanhSachPhien],
  );

  const xoaPhien = useCallback(
    async (phien) => {
      await goiApi.delete(`/troLyAi/phien/${phien.id}`);
      if (phienDangChon?.id === phien.id) moPhienMoi();
      await taiDanhSachPhien();
    },
    [phienDangChon, moPhienMoi, taiDanhSachPhien],
  );

  // Cập nhật thẻ xem trước của đúng bản nháp trong khung chat
  const capNhatBanNhap = useCallback((banNhapId, thayDoi) => {
    setTinNhan((ds) => ds.map((t) => (t.banNhap?.id === banNhapId ? { ...t, banNhap: { ...t.banNhap, ...thayDoi } } : t)));
  }, []);

  // Lỗi ném ra để thẻ xem trước hiện ngay dưới thẻ; 409 (đã tạo/hết hạn/lỗi nghiệp vụ) tải lại phiên để thẻ đúng trạng thái
  const xacNhanBanNhap = useCallback(
    async (banNhap) => {
      try {
        const kq = await goiApi.post(`/troLyAi/banNhap/${banNhap.id}/xacNhan`);
        capNhatBanNhap(banNhap.id, { trangThai: 'DA_TAO', ketQua: kq.data });
      } catch (e) {
        if (e.code === 409) {
          if (phienDangChon) chonPhien(phienDangChon);
        } else if (e.code === 400) {
          capNhatBanNhap(banNhap.id, { trangThai: 'LOI', ketQua: { loi: e.message } });
        }
        throw e;
      }
    },
    [capNhatBanNhap, chonPhien, phienDangChon],
  );

  const huyBanNhap = useCallback(
    async (banNhap) => {
      await goiApi.post(`/troLyAi/banNhap/${banNhap.id}/huy`);
      capNhatBanNhap(banNhap.id, { trangThai: 'HUY' });
    },
    [capNhatBanNhap],
  );

  return {
    xacNhanBanNhap,
    huyBanNhap,
    dsPhien,
    phienDangChon,
    tinNhan,
    dangTaiPhien,
    dangTaiTin,
    dangGui,
    loi,
    setLoi,
    chonPhien,
    moPhienMoi,
    gui,
    doiTenPhien,
    xoaPhien,
  };
}
