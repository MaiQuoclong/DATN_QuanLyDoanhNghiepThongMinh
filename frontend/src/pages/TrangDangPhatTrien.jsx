// Trang tạm cho các module chưa làm
function TrangDangPhatTrien({ tenModule }) {
  return (
    <div>
      <h1 className="tieuDeTrang">{tenModule}</h1>
      <p className="moTaTrang">Module đang được phát triển.</p>
    </div>
  );
}

export default TrangDangPhatTrien;
