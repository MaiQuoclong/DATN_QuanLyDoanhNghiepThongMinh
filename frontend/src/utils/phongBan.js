// Tập id gồm các phòng gốc và toàn bộ phòng con cháu của chúng (duyệt theo phongBanChaId)
export function layIdNhanh(cacIdGoc, danhSach) {
  const theoCha = new Map();
  danhSach.forEach((pb) => {
    if (pb.phongBanChaId) theoCha.set(pb.phongBanChaId, [...(theoCha.get(pb.phongBanChaId) ?? []), pb.id]);
  });
  const ketQua = new Set(cacIdGoc);
  const hangDoi = [...cacIdGoc];
  while (hangDoi.length) {
    for (const idCon of theoCha.get(hangDoi.shift()) ?? []) {
      if (!ketQua.has(idCon)) {
        ketQua.add(idCon);
        hangDoi.push(idCon);
      }
    }
  }
  return ketQua;
}

// quanLy (không kiêm HR/giamDoc) chỉ thấy phòng mình làm trưởng và phòng con, khớp phạm vi lọc ở backend
export function locPhongBanTrongPhamVi(danhSach, nguoiDung) {
  const vaiTro = nguoiDung.vaiTro ?? [];
  if (!vaiTro.includes('quanLy') || vaiTro.includes('HR') || vaiTro.includes('giamDoc')) return danhSach;
  if (nguoiDung.nhanVienId == null) return [];
  const goc = danhSach.filter((pb) => pb.truongBoPhanId === nguoiDung.nhanVienId).map((pb) => pb.id);
  const phamVi = layIdNhanh(goc, danhSach);
  return danhSach.filter((pb) => phamVi.has(pb.id));
}
