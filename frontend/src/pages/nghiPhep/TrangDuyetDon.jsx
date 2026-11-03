import DanhSachDon from '../../components/nghiPhep/DanhSachDon';

// Duyệt đơn (giamDoc, quanLy): quanLy thấy đơn phòng mình phụ trách, chỉ duyệt đơn mình là người duyệt theo chuỗi;
// giamDoc duyệt mọi đơn trừ đơn của mình, trừ khi không còn giám đốc nào khác (backend kiểm tra lại)
function TrangDuyetDon() {
  return (
    <div>
      <div className="dauTrangNghiepVu">
        <div>
          <h1 className="tieuDeTrang">Duyệt đơn nghỉ phép</h1>
          <div className="chuPhu">Duyệt sẽ trừ quỹ phép năm của nhân viên (với loại trừ quỹ). Không tự duyệt đơn của mình (trừ giám đốc duy nhất đang hoạt động).</div>
        </div>
      </div>
      <DanhSachDon cheDo="duyet" />
    </div>
  );
}

export default TrangDuyetDon;
