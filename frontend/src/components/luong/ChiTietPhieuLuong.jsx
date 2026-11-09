import { dinhDangTien } from '../../utils/dinhDang';

// Bảng chi tiết một phiếu lương: các số dẫn xuất (lương theo công, tổng thu nhập, thực lĩnh) do backend tính
function ChiTietPhieuLuong({ phieu }) {
  const dong = [
    ['Lương cơ bản (hợp đồng)', dinhDangTien(phieu.luongCoBan)],
    ['Ngày công thực tế / chuẩn', `${phieu.soNgayCongThucTe} / ${phieu.ngayCongChuan}`],
    ['Lương theo ngày công', dinhDangTien(phieu.luongTheoCong)],
    ['Lương làm thêm (OT)', dinhDangTien(phieu.luongLamThemOT)],
    // Cột thuongKPI gộp: backend tách lại phần thưởng KPI (phiếu KPI nghiệm thu trong tháng) khi đọc
    ...(phieu.thuongKpi !== undefined
      ? [
        ['Thưởng KPI (nghiệm thu trong tháng)', dinhDangTien(phieu.thuongKpi)],
        ['Khen thưởng − kỷ luật / điều chỉnh', dinhDangTien(phieu.thuongPhatKhac)],
        ['Tổng thưởng / phạt', dinhDangTien(phieu.thuongKPI)],
      ]
      : [['Thưởng / phạt (KPI, khen thưởng, kỷ luật)', dinhDangTien(phieu.thuongKPI)]]),
    ['Phụ cấp', dinhDangTien(phieu.tongPhuCap)],
    ['Tổng thu nhập', <strong key="tn">{dinhDangTien(phieu.tongThuNhap)}</strong>],
    ['Bảo hiểm (BHXH, BHYT, BHTN)', `− ${dinhDangTien(phieu.khauTruBaoHiem)}`],
    ['Thuế TNCN', `− ${dinhDangTien(phieu.khauTruThueTNCN)}`],
  ];
  return (
    <div>
      <div className="luoiThongTin" style={{ gridTemplateColumns: '1fr auto' }}>
        {dong.map(([nhan, giaTri]) => (
          <div key={nhan} style={{ display: 'contents' }}>
            <span className="chuPhu">{nhan}</span>
            <span style={{ textAlign: 'right' }}>{giaTri}</span>
          </div>
        ))}
      </div>
      <div className="dauThe" style={{ marginTop: 12, borderTop: '1px solid var(--mauVien)', paddingTop: 12 }}>
        <span>Thực lĩnh</span>
        <strong style={{ fontSize: 20, color: 'var(--mauChinh)' }}>{dinhDangTien(phieu.thucLinh)}</strong>
      </div>
    </div>
  );
}

export default ChiTietPhieuLuong;
