const LoiUngDung = require('../utils/LoiUngDung');
const { chayTransaction } = require('../config/ketNoiCsdl');
const hopDongRepository = require('../repositories/hopDongRepository');
const nhanVienRepository = require('../repositories/nhanVienRepository');
const nhatKyRepository = require('../repositories/nhatKyRepository');
const { LOAI_HOP_DONG } = require('../utils/trangThai');

// Bộ luật Lao động 2019: thử việc tối đa 180 ngày (Điều 25), hợp đồng xác định thời hạn tối đa 36 tháng (Điều 20)
const SO_NGAY_THU_VIEC_TOI_DA = 180;
const SO_THANG_XAC_DINH_TOI_DA = 36;
const SO_NGAY_BAT_DAU_TRUOC_TOI_DA = 180; // ngày bắt đầu không quá nửa năm sau hôm nay

function ngayHomNayCong(soNgay = 0) {
  const ngay = new Date();
  ngay.setDate(ngay.getDate() + soNgay);
  return ngay.toLocaleDateString('sv-SE'); // YYYY-MM-DD theo giờ máy chủ
}

function congNgay(ngay, soNgay) {
  const d = new Date(`${ngay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + soNgay);
  return d.toISOString().slice(0, 10);
}

// Cộng tháng, ngày cuối tháng không tồn tại thì lùi về ngày cuối của tháng đích (31/01 + 1 tháng = 28/02)
function congThang(ngay, soThang) {
  const [nam, thang, ngayTrongThang] = ngay.split('-').map(Number);
  const tongThang = thang - 1 + soThang;
  const namMoi = nam + Math.floor(tongThang / 12);
  const thangMoi = (tongThang % 12) + 1;
  const ngayCuoiThang = new Date(Date.UTC(namMoi, thangMoi, 0)).getUTCDate();
  return `${namMoi}-${String(thangMoi).padStart(2, '0')}-${String(Math.min(ngayTrongThang, ngayCuoiThang)).padStart(2, '0')}`;
}

function xemToanCongTy(vaiTro) {
  return vaiTro.includes('HR') || vaiTro.includes('giamDoc');
}

// HR không lập/sửa hợp đồng của chính mình (docs/phan-quyen.md quy tắc 1);
// lichsuhopdong.nguoiThucHienId bắt buộc nên người thực hiện phải có hồ sơ nhân viên
function kiemTraNguoiThucHien(nguoiDung, nhanVienId) {
  if (!nguoiDung.nhanVienId) throw new LoiUngDung(403, 'Tài khoản chưa có hồ sơ nhân viên nên không thể thao tác hợp đồng');
  if (nguoiDung.nhanVienId === nhanVienId) {
    throw new LoiUngDung(403, 'Bạn không được tự thao tác hợp đồng của chính mình, hãy nhờ HR khác thực hiện');
  }
}

// Kiểm tra thời hạn theo loại hợp đồng; trả ngayKetThuc đã chuẩn hóa (null với hợp đồng không xác định thời hạn)
function kiemTraThoiHan(loaiHopDong, ngayBatDau, ngayKetThuc) {
  if (loaiHopDong === 'KHONG_XAC_DINH_THOI_HAN') {
    if (ngayKetThuc) throw new LoiUngDung(400, 'Hợp đồng không xác định thời hạn không có ngày kết thúc');
    return null;
  }
  if (!ngayKetThuc) throw new LoiUngDung(400, 'Ngày kết thúc không được để trống với loại hợp đồng này');
  if (ngayKetThuc <= ngayBatDau) throw new LoiUngDung(400, 'Ngày kết thúc phải sau ngày bắt đầu');
  if (loaiHopDong === 'THU_VIEC' && ngayKetThuc > congNgay(ngayBatDau, SO_NGAY_THU_VIEC_TOI_DA - 1)) {
    throw new LoiUngDung(400, `Thời gian thử việc tối đa ${SO_NGAY_THU_VIEC_TOI_DA} ngày`);
  }
  if (loaiHopDong === 'XAC_DINH_THOI_HAN' && ngayKetThuc > congNgay(congThang(ngayBatDau, SO_THANG_XAC_DINH_TOI_DA), -1)) {
    throw new LoiUngDung(
      400,
      `Hợp đồng xác định thời hạn tối đa ${SO_THANG_XAC_DINH_TOI_DA} tháng, quá hạn này phải ký hợp đồng không xác định thời hạn`,
    );
  }
  return ngayKetThuc;
}

async function chanChongLan(nhanVienId, ngayBatDau, ngayKetThuc, boQuaId, ketNoi) {
  const trung = await hopDongRepository.timHopDongChongLan(nhanVienId, ngayBatDau, ngayKetThuc, boQuaId, ketNoi);
  if (trung) {
    throw new LoiUngDung(409, `Thời gian trùng với hợp đồng ${trung.maHopDong} đang hiệu lực, cần chấm dứt hoặc chọn thời gian khác`);
  }
}

async function layHopDongHoacLoi(id, ketNoi) {
  const hopDong = await hopDongRepository.layTheoId(id, ketNoi);
  if (!hopDong) throw new LoiUngDung(404, 'Không tìm thấy hợp đồng');
  return hopDong;
}

// Khóa nhân viên rồi mới khóa hợp đồng (cùng thứ tự với taoHopDong): mọi thay đổi hợp đồng của một người
// chạy tuần tự, nên kiểm tra chồng thời gian không bị lọt khi gia hạn và tạo mới cùng lúc
async function khoaVaLayHopDong(nguoiDung, id, ketNoi) {
  const nhanVienId = await hopDongRepository.layNhanVienCuaHopDong(id, ketNoi);
  if (!nhanVienId) throw new LoiUngDung(404, 'Không tìm thấy hợp đồng');
  await nhanVienRepository.khoaNhanVien(nhanVienId, ketNoi);
  if (!(await hopDongRepository.khoaHopDong(id, ketNoi))) throw new LoiUngDung(404, 'Không tìm thấy hợp đồng');
  const hopDong = await layHopDongHoacLoi(id, ketNoi);
  kiemTraNguoiThucHien(nguoiDung, hopDong.nhanVienId);
  return hopDong;
}

// Ghi lichsuhopdong + nhatkyhethong trong cùng transaction với thay đổi hợp đồng
async function ghiDauVet(nguoiDung, { hopDongCu, hopDongMoi, hanhDongLichSu, hanhDongNhatKy, lyDo, chiTiet }, diaChiIP, ketNoi) {
  await hopDongRepository.themLichSu(
    {
      hopDongLaoDongId: hopDongMoi.id,
      hanhDong: hanhDongLichSu,
      // Lịch sử ghi trạng thái thực lưu trong bảng (HIEU_LUC/DA_CHAM_DUT), không ghi HET_HAN suy ra
      cu: hopDongCu && { ...hopDongCu, trangThai: hopDongCu.trangThaiLuu ?? hopDongCu.trangThai },
      moi: hopDongMoi,
      lyDo,
      nguoiThucHienId: nguoiDung.nhanVienId,
    },
    ketNoi,
  );
  await nhatKyRepository.themNhatKy(
    nguoiDung.nguoiDungId,
    hanhDongNhatKy,
    diaChiIP,
    `${hopDongMoi.maHopDong} (${hopDongMoi.maNhanVien}): ${chiTiet}${lyDo ? `. Lý do: ${lyDo}` : ''}`,
    ketNoi,
  );
}

async function layDanhSach(boLoc) {
  const { trang, kichThuoc } = boLoc;
  const { items, tongSo } = await hopDongRepository.layDanhSach({
    ...boLoc,
    viTri: (trang - 1) * kichThuoc,
    soLuong: kichThuoc,
  });
  return { items, phanTrang: { trang, kichThuoc, tongSo } };
}

async function layCuaToi(nguoiDung) {
  if (!nguoiDung.nhanVienId) throw new LoiUngDung(404, 'Tài khoản chưa có hồ sơ nhân viên');
  return hopDongRepository.layTheoNhanVien(nguoiDung.nhanVienId);
}

// Hợp đồng là dữ liệu nhạy cảm: chỉ chính chủ, HR, giamDoc được xem (quy tắc 6; Admin, quanLy không xem của người khác)
async function layChiTiet(nguoiDung, id) {
  const hopDong = await layHopDongHoacLoi(id);
  if (hopDong.nhanVienId !== nguoiDung.nhanVienId && !xemToanCongTy(nguoiDung.vaiTro)) {
    // Ngoài phạm vi trả 404 (cùng quy ước nhanVien, lương, KPI) để không lộ id hợp đồng nào tồn tại
    throw new LoiUngDung(404, 'Không tìm thấy hợp đồng');
  }
  return { ...hopDong, lichSu: await hopDongRepository.layLichSu(id) };
}

async function laySapHetHan(soNgay) {
  return hopDongRepository.laySapHetHan(soNgay);
}

// Năm chưa có mã HDyyyy-xxxx nào thì SELECT ... FOR UPDATE chỉ đặt gap lock, hai HR tạo cùng lúc
// (cho hai nhân viên khác nhau) có thể sinh trùng mã -> ER_DUP_ENTRY: chạy lại để lấy số kế tiếp
const SO_LAN_THU_TRUNG_MA = 3;
async function taoVoiThuLaiKhiTrungMa(congViec) {
  for (let lan = 1; ; lan += 1) {
    try {
      return await congViec();
    } catch (loi) {
      if (loi.code !== 'ER_DUP_ENTRY' || lan >= SO_LAN_THU_TRUNG_MA) throw loi;
    }
  }
}

async function taoHopDong(nguoiDung, body, diaChiIP) {
  const nhanVienId = Number(body.nhanVienId);
  kiemTraNguoiThucHien(nguoiDung, nhanVienId);
  const { loaiHopDong, ngayBatDau } = body;
  const ngayKetThuc = kiemTraThoiHan(loaiHopDong, ngayBatDau, body.ngayKetThuc || null);
  if (ngayBatDau > ngayHomNayCong(SO_NGAY_BAT_DAU_TRUOC_TOI_DA)) {
    throw new LoiUngDung(400, `Ngày bắt đầu không được sau hôm nay quá ${SO_NGAY_BAT_DAU_TRUOC_TOI_DA} ngày`);
  }

  const id = await taoVoiThuLaiKhiTrungMa(() =>
    chayTransaction(async (ketNoi) => {
      if (!(await nhanVienRepository.khoaNhanVien(nhanVienId, ketNoi))) throw new LoiUngDung(404, 'Không tìm thấy nhân viên');
      const nhanVien = await nhanVienRepository.layTheoId(nhanVienId, ketNoi);
      if (nhanVien.trangThaiLamViec === 'DA_NGHI_VIEC') {
        throw new LoiUngDung(409, 'Không thể lập hợp đồng cho nhân viên đã nghỉ việc');
      }
      if (ngayBatDau < nhanVien.ngayVaoLam) throw new LoiUngDung(400, 'Ngày bắt đầu hợp đồng không được trước ngày vào làm');
      await chanChongLan(nhanVienId, ngayBatDau, ngayKetThuc, null, ketNoi);

      const nam = ngayBatDau.slice(0, 4);
      const soMa = (await hopDongRepository.laySoMaLonNhat(nam, ketNoi)) + 1;
      const hopDong = {
        maHopDong: `HD${nam}-${String(soMa).padStart(4, '0')}`,
        nhanVienId,
        loaiHopDong,
        ngayBatDau,
        ngayKetThuc,
        luongCoBan: Number(body.luongCoBan),
        mucPhuCap: Number(body.mucPhuCap ?? 0),
        duongDanFileHopDong: body.duongDanFileHopDong?.trim() || null,
      };
      const idMoi = await hopDongRepository.them(hopDong, ketNoi);
      await ghiDauVet(
        nguoiDung,
        {
          hopDongCu: null,
          hopDongMoi: { ...hopDong, id: idMoi, trangThai: 'HIEU_LUC', maNhanVien: nhanVien.maNhanVien },
          hanhDongLichSu: 'TAO_MOI',
          hanhDongNhatKy: 'THEM_HOP_DONG',
          lyDo: body.lyDo?.trim() || null,
          chiTiet: `${loaiHopDong} ${ngayBatDau} -> ${ngayKetThuc ?? 'không thời hạn'}`,
        },
        diaChiIP,
        ketNoi,
      );
      return idMoi;
    }),
  );
  return layChiTiet(nguoiDung, id);
}

// Gia hạn: chỉ hợp đồng xác định thời hạn (thử việc không được kéo dài, hết thử việc phải ký hợp đồng mới)
async function giaHanHopDong(nguoiDung, id, { ngayKetThucMoi, lyDo }, diaChiIP) {
  await chayTransaction(async (ketNoi) => {
    const hopDong = await khoaVaLayHopDong(nguoiDung, id, ketNoi);
    if (hopDong.trangThai === 'DA_CHAM_DUT') throw new LoiUngDung(409, 'Hợp đồng đã chấm dứt, không thể gia hạn');
    // Hết hạn rồi mới gia hạn sẽ hợp thức hóa ngược khoảng thời gian không có hợp đồng -> phải ký hợp đồng mới
    if (hopDong.trangThai === 'HET_HAN') throw new LoiUngDung(409, 'Hợp đồng đã hết hạn, cần lập hợp đồng mới thay vì gia hạn');
    if (hopDong.loaiHopDong !== 'XAC_DINH_THOI_HAN') {
      throw new LoiUngDung(409, 'Chỉ gia hạn được hợp đồng xác định thời hạn');
    }
    if (hopDong.trangThaiLamViec === 'DA_NGHI_VIEC') throw new LoiUngDung(409, 'Nhân viên đã nghỉ việc');
    if (ngayKetThucMoi <= hopDong.ngayKetThuc) throw new LoiUngDung(400, 'Ngày kết thúc mới phải sau ngày kết thúc hiện tại');
    kiemTraThoiHan(hopDong.loaiHopDong, hopDong.ngayBatDau, ngayKetThucMoi);
    await chanChongLan(hopDong.nhanVienId, hopDong.ngayBatDau, ngayKetThucMoi, id, ketNoi);

    await hopDongRepository.capNhat(id, { ngayKetThuc: ngayKetThucMoi }, ketNoi);
    await ghiDauVet(
      nguoiDung,
      {
        hopDongCu: hopDong,
        hopDongMoi: { ...hopDong, ngayKetThuc: ngayKetThucMoi, trangThai: 'HIEU_LUC' },
        hanhDongLichSu: 'GIA_HAN',
        hanhDongNhatKy: 'GIA_HAN_HOP_DONG',
        lyDo: lyDo?.trim() || null,
        chiTiet: `ngày kết thúc ${hopDong.ngayKetThuc} -> ${ngayKetThucMoi}`,
      },
      diaChiIP,
      ketNoi,
    );
  });
  return layChiTiet(nguoiDung, id);
}

// Điều chỉnh lương cơ bản, phụ cấp, file đính kèm của hợp đồng đang hiệu lực (phụ lục hợp đồng)
async function dieuChinhHopDong(nguoiDung, id, body, diaChiIP) {
  await chayTransaction(async (ketNoi) => {
    const hopDong = await khoaVaLayHopDong(nguoiDung, id, ketNoi);
    if (hopDong.trangThai !== 'HIEU_LUC') throw new LoiUngDung(409, 'Chỉ điều chỉnh được hợp đồng đang hiệu lực');

    const truong = {};
    const moTa = [];
    for (const cot of ['luongCoBan', 'mucPhuCap']) {
      if (body[cot] === undefined || body[cot] === null || body[cot] === '') continue;
      const giaTri = Number(body[cot]);
      if (giaTri !== Number(hopDong[cot])) {
        truong[cot] = giaTri;
        // Không ghi số tiền vào nhật ký (Admin xem được nhật ký nhưng không được xem lương); giá trị cũ/mới đã có ở lichsuhopdong
        moTa.push(`${cot}: đã thay đổi`);
      }
    }
    if (body.duongDanFileHopDong !== undefined) {
      const duongDan = body.duongDanFileHopDong?.trim() || null;
      if (duongDan !== hopDong.duongDanFileHopDong) {
        truong.duongDanFileHopDong = duongDan;
        moTa.push('duongDanFileHopDong: đã thay đổi');
      }
    }
    if (moTa.length === 0) throw new LoiUngDung(400, 'Không có thông tin nào thay đổi');

    await hopDongRepository.capNhat(id, truong, ketNoi);
    await ghiDauVet(
      nguoiDung,
      {
        hopDongCu: hopDong,
        hopDongMoi: { ...hopDong, ...truong },
        hanhDongLichSu: 'DIEU_CHINH',
        hanhDongNhatKy: 'DIEU_CHINH_HOP_DONG',
        lyDo: body.lyDo.trim(),
        chiTiet: moTa.join('; '),
      },
      diaChiIP,
      ketNoi,
    );
  });
  return layChiTiet(nguoiDung, id);
}

// Chấm dứt: ngày chấm dứt thành ngày kết thúc thực tế của hợp đồng
async function chamDutHopDong(nguoiDung, id, { ngayChamDut, lyDo }, diaChiIP) {
  await chayTransaction(async (ketNoi) => {
    const hopDong = await khoaVaLayHopDong(nguoiDung, id, ketNoi);
    if (hopDong.trangThai === 'DA_CHAM_DUT') throw new LoiUngDung(409, 'Hợp đồng đã chấm dứt trước đó');
    if (ngayChamDut < hopDong.ngayBatDau) throw new LoiUngDung(400, 'Ngày chấm dứt không được trước ngày bắt đầu hợp đồng');
    if (hopDong.ngayKetThuc && ngayChamDut > hopDong.ngayKetThuc) {
      throw new LoiUngDung(400, 'Ngày chấm dứt không được sau ngày kết thúc hợp đồng');
    }

    await hopDongRepository.capNhat(id, { ngayKetThuc: ngayChamDut, trangThai: 'DA_CHAM_DUT' }, ketNoi);
    await ghiDauVet(
      nguoiDung,
      {
        hopDongCu: hopDong,
        hopDongMoi: { ...hopDong, ngayKetThuc: ngayChamDut, trangThai: 'DA_CHAM_DUT' },
        hanhDongLichSu: 'CHAM_DUT',
        hanhDongNhatKy: 'CHAM_DUT_HOP_DONG',
        lyDo: lyDo.trim(),
        chiTiet: `chấm dứt từ ${ngayChamDut}`,
      },
      diaChiIP,
      ketNoi,
    );
  });
  return layChiTiet(nguoiDung, id);
}

module.exports = {
  LOAI_HOP_DONG,
  layDanhSach,
  layCuaToi,
  layChiTiet,
  laySapHetHan,
  taoHopDong,
  giaHanHopDong,
  dieuChinhHopDong,
  chamDutHopDong,
};
