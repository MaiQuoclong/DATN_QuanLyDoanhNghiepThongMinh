import { useState } from 'react';
import { MessageSquarePlus, Pencil, Trash2 } from 'lucide-react';
import useTroLyAi from '../../hooks/useTroLyAi';
import HopThoai from '../../components/HopThoai';
import HopThoaiBieuMau from '../../components/HopThoaiBieuMau';
import KhungChat from '../../components/troLyAi/KhungChat';
import NutBam from '../../components/NutBam';
import { dinhDangThoiGian } from '../../utils/dinhDang';
import '../../components/troLyAi/TroLyAi.css';

// Trợ lý AI hỏi đáp quy chế (mọi vai trò): cột trái danh sách phiên của mình, bên phải khung chat
function TrangTroLyAi() {
  const troLy = useTroLyAi();
  const { dsPhien, phienDangChon, dangTaiPhien, loi } = troLy;
  const [dangDoiTen, setDangDoiTen] = useState(null);
  const [dangXoa, setDangXoa] = useState(null);
  const [dangGuiXoa, setDangGuiXoa] = useState(false);

  const xacNhanXoa = async () => {
    setDangGuiXoa(true);
    try {
      await troLy.xoaPhien(dangXoa);
    } catch (e) {
      troLy.setLoi(e.message);
    } finally {
      setDangGuiXoa(false);
      setDangXoa(null);
    }
  };

  return (
    <div>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Trợ lý AI</h1>
          <div className="chuPhu">Tra cứu nội quy, quy chế công ty; câu trả lời kèm trích dẫn Điều/khoản</div>
        </div>
        <NutBam bieuTuong={MessageSquarePlus} onClick={troLy.moPhienMoi} disabled={troLy.dangGui}>
          Cuộc trò chuyện mới
        </NutBam>
      </div>
      {loi && <div className="thongBao loi">{loi}</div>}

      <div className="boCucTroLyAi">
        <aside className="dsPhien the" aria-label="Danh sách cuộc trò chuyện">
          <div className="dauKhungChat">Cuộc trò chuyện</div>
          {dangTaiPhien && <div className="trangThaiChat">Đang tải...</div>}
          {!dangTaiPhien && dsPhien.length === 0 && <div className="trangThaiChat">Chưa có cuộc trò chuyện nào</div>}
          {dsPhien.map((p) => (
            <div key={p.id} className={`mucPhien ${phienDangChon?.id === p.id ? 'dangChon' : ''}`}>
              <button type="button" className="chonPhien" onClick={() => troLy.chonPhien(p)} disabled={troLy.dangGui} title={p.tieuDePhien}>
                <span className="tenPhien">{p.tieuDePhien}</span>
                <span className="thoiGianPhien">{dinhDangThoiGian(p.thoiGianTao)}</span>
              </button>
              <div className="thaoTacPhien">
                {/* Khóa khi đang gửi câu hỏi: xóa/đổi tên chen giữa làm phiên vừa xóa hiện lại */}
                <button
                  type="button"
                  onClick={() => setDangDoiTen(p)}
                  disabled={troLy.dangGui}
                  title="Đổi tên"
                  aria-label={`Đổi tên ${p.tieuDePhien}`}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setDangXoa(p)}
                  disabled={troLy.dangGui}
                  title="Xóa"
                  aria-label={`Xóa ${p.tieuDePhien}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </aside>

        <KhungChat
          tieuDe={phienDangChon ? phienDangChon.tieuDePhien : 'Cuộc trò chuyện mới'}
          tinNhan={troLy.tinNhan}
          dangTaiTin={troLy.dangTaiTin}
          dangGui={troLy.dangGui}
          onGui={troLy.gui}
          onXacNhanBanNhap={troLy.xacNhanBanNhap}
          onHuyBanNhap={troLy.huyBanNhap}
        />
      </div>

      {dangDoiTen && (
        <HopThoaiBieuMau
          tieuDe="Đổi tên cuộc trò chuyện"
          truong={[{ ten: 'tieuDePhien', nhan: 'Tên', batBuoc: true, ghiChu: 'Tối đa 150 ký tự' }]}
          giaTriBanDau={{ tieuDePhien: dangDoiTen.tieuDePhien }}
          onGui={async (giaTri) => {
            if (giaTri.tieuDePhien.trim().length > 150) throw new Error('Tên tối đa 150 ký tự');
            await troLy.doiTenPhien(dangDoiTen, giaTri.tieuDePhien);
            setDangDoiTen(null);
          }}
          onDong={() => setDangDoiTen(null)}
        />
      )}
      {dangXoa && (
        <HopThoai
          tieuDe="Xóa cuộc trò chuyện"
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
          Xóa cuộc trò chuyện <strong>{dangXoa.tieuDePhien}</strong> cùng toàn bộ tin nhắn?
        </HopThoai>
      )}
    </div>
  );
}

export default TrangTroLyAi;
