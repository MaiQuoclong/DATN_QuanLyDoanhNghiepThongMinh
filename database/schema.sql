-- MySQL dump 10.13  Distrib 8.0.19, for Win64 (x86_64)
--
-- Host: localhost    Database: quanlydoanhnghiepthongminh
-- ------------------------------------------------------
-- Server version	5.5.5-10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `banghichamcong`
--

DROP TABLE IF EXISTS `banghichamcong`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `banghichamcong` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `nhanVienId` int(11) NOT NULL,
  `ngayChamCong` date NOT NULL,
  `gioVao` time DEFAULT NULL,
  `gioRa` time DEFAULT NULL,
  `soGioLamThucTe` decimal(4,2) DEFAULT 0.00,
  `soGioLamThemOT` decimal(4,2) DEFAULT 0.00,
  `diMuon` tinyint(1) DEFAULT 0,
  `veSom` tinyint(1) DEFAULT 0,
  `trangThai` varchar(30) NOT NULL DEFAULT 'HOP_LE',
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_NhanVien_NgayChamCong3` (`nhanVienId`,`ngayChamCong`),
  KEY `IX_ChamCong_NhanVien_Ngay` (`nhanVienId`,`ngayChamCong`),
  CONSTRAINT `banghichamcong_ibfk_1` FOREIGN KEY (`nhanVienId`) REFERENCES `nhanvien` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `banghichamcong`
--

LOCK TABLES `banghichamcong` WRITE;
/*!40000 ALTER TABLE `banghichamcong` DISABLE KEYS */;
/*!40000 ALTER TABLE `banghichamcong` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bangtonghopluong`
--

DROP TABLE IF EXISTS `bangtonghopluong`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bangtonghopluong` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `maBangLuong` varchar(30) NOT NULL,
  `thang` int(11) NOT NULL,
  `nam` int(11) NOT NULL,
  `tongChiPhiLuong` decimal(18,2) DEFAULT 0.00,
  `trangThai` varchar(30) NOT NULL DEFAULT 'BAN_NHAP',
  `nguoiLapId` int(11) NOT NULL,
  `nguoiDuyetId` int(11) DEFAULT NULL,
  `ngayTao` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `maBangLuong` (`maBangLuong`),
  UNIQUE KEY `UQ_BangLuong_ThangNam3` (`thang`,`nam`),
  KEY `nguoiLapId` (`nguoiLapId`),
  KEY `nguoiDuyetId` (`nguoiDuyetId`),
  CONSTRAINT `bangtonghopluong_ibfk_1` FOREIGN KEY (`nguoiLapId`) REFERENCES `nhanvien` (`id`),
  CONSTRAINT `bangtonghopluong_ibfk_2` FOREIGN KEY (`nguoiDuyetId`) REFERENCES `nhanvien` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bangtonghopluong`
--

LOCK TABLES `bangtonghopluong` WRITE;
/*!40000 ALTER TABLE `bangtonghopluong` DISABLE KEYS */;
/*!40000 ALTER TABLE `bangtonghopluong` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chitietdanhgiakpi`
--

DROP TABLE IF EXISTS `chitietdanhgiakpi`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chitietdanhgiakpi` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `phieuDanhGiaKPIId` int(11) NOT NULL,
  `chiTieuKPIId` int(11) NOT NULL,
  `trongSo` decimal(5,2) NOT NULL DEFAULT 1.00,
  `mucTieu` varchar(255) DEFAULT NULL,
  `ketQuaThucTe` varchar(255) DEFAULT NULL,
  `diemTuCham` decimal(4,2) DEFAULT NULL,
  `diemNghiemThu` decimal(4,2) DEFAULT NULL,
  `nhanXet` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_PhieuKPI_ChiTieu3` (`phieuDanhGiaKPIId`,`chiTieuKPIId`),
  KEY `chiTieuKPIId` (`chiTieuKPIId`),
  KEY `IX_ChiTietKPI_Phieu` (`phieuDanhGiaKPIId`),
  CONSTRAINT `chitietdanhgiakpi_ibfk_1` FOREIGN KEY (`phieuDanhGiaKPIId`) REFERENCES `phieudanhgiakpi` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chitietdanhgiakpi_ibfk_2` FOREIGN KEY (`chiTieuKPIId`) REFERENCES `chitieukpi` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chitietdanhgiakpi`
--

LOCK TABLES `chitietdanhgiakpi` WRITE;
/*!40000 ALTER TABLE `chitietdanhgiakpi` DISABLE KEYS */;
/*!40000 ALTER TABLE `chitietdanhgiakpi` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chitieukpi`
--

DROP TABLE IF EXISTS `chitieukpi`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chitieukpi` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `maChiTieu` varchar(30) NOT NULL,
  `tenChiTieu` varchar(150) NOT NULL,
  `moTa` text DEFAULT NULL,
  `donViDo` varchar(50) DEFAULT NULL,
  `trongSoMacDinh` decimal(5,2) NOT NULL DEFAULT 1.00,
  `chucDanhPhongBanId` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `maChiTieu` (`maChiTieu`),
  KEY `chucDanhPhongBanId` (`chucDanhPhongBanId`),
  CONSTRAINT `chitieukpi_ibfk_1` FOREIGN KEY (`chucDanhPhongBanId`) REFERENCES `chucdanhphongban` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chitieukpi`
--

LOCK TABLES `chitieukpi` WRITE;
/*!40000 ALTER TABLE `chitieukpi` DISABLE KEYS */;
/*!40000 ALTER TABLE `chitieukpi` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chucdanh`
--

DROP TABLE IF EXISTS `chucdanh`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chucdanh` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `maChucDanh` varchar(20) NOT NULL,
  `tenChucDanh` varchar(100) NOT NULL,
  `capBac` varchar(50) NOT NULL,
  `trangThai` varchar(20) NOT NULL DEFAULT 'DANG_HOAT_DONG',
  PRIMARY KEY (`id`),
  UNIQUE KEY `maChucDanh` (`maChucDanh`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chucdanh`
--

LOCK TABLES `chucdanh` WRITE;
/*!40000 ALTER TABLE `chucdanh` DISABLE KEYS */;
/*!40000 ALTER TABLE `chucdanh` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `chucdanhphongban`
--

DROP TABLE IF EXISTS `chucdanhphongban`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `chucdanhphongban` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `phongBanId` int(11) NOT NULL,
  `chucDanhId` int(11) NOT NULL,
  `dinhBien` int(11) NOT NULL DEFAULT 1,
  `ghiChu` varchar(255) DEFAULT NULL,
  `trangThai` varchar(20) NOT NULL DEFAULT 'DANG_AP_DUNG',
  `ngayTao` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_PhongBan_ChucDanh3` (`phongBanId`,`chucDanhId`),
  KEY `IX_ChucDanhPhongBan_PB` (`phongBanId`),
  KEY `IX_ChucDanhPhongBan_CD` (`chucDanhId`),
  CONSTRAINT `chucdanhphongban_ibfk_1` FOREIGN KEY (`phongBanId`) REFERENCES `phongban` (`id`),
  CONSTRAINT `chucdanhphongban_ibfk_2` FOREIGN KEY (`chucDanhId`) REFERENCES `chucdanh` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `chucdanhphongban`
--

LOCK TABLES `chucdanhphongban` WRITE;
/*!40000 ALTER TABLE `chucdanhphongban` DISABLE KEYS */;
/*!40000 ALTER TABLE `chucdanhphongban` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dexuatkhenthuongkyluat`
--

DROP TABLE IF EXISTS `dexuatkhenthuongkyluat`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dexuatkhenthuongkyluat` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nguoiDeXuatId` int(11) NOT NULL,
  `nhanVienId` int(11) NOT NULL,
  `loaiDeXuat` varchar(20) NOT NULL,
  `tieuDe` varchar(200) NOT NULL,
  `lyDo` text NOT NULL,
  `soTienDeXuat` decimal(15,2) DEFAULT 0.00,
  `trangThai` varchar(30) NOT NULL DEFAULT 'CHO_DUYET',
  `nguoiXuLyId` int(11) DEFAULT NULL,
  `ghiChuXuLy` varchar(500) DEFAULT NULL,
  `quyetDinhId` int(11) DEFAULT NULL,
  `ngayTao` datetime DEFAULT current_timestamp(),
  `ngayCapNhat` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `nguoiDeXuatId` (`nguoiDeXuatId`),
  KEY `nhanVienId` (`nhanVienId`),
  KEY `nguoiXuLyId` (`nguoiXuLyId`),
  KEY `quyetDinhId` (`quyetDinhId`),
  CONSTRAINT `dexuatkhenthuongkyluat_ibfk_1` FOREIGN KEY (`nguoiDeXuatId`) REFERENCES `nhanvien` (`id`),
  CONSTRAINT `dexuatkhenthuongkyluat_ibfk_2` FOREIGN KEY (`nhanVienId`) REFERENCES `nhanvien` (`id`),
  CONSTRAINT `dexuatkhenthuongkyluat_ibfk_3` FOREIGN KEY (`nguoiXuLyId`) REFERENCES `nhanvien` (`id`),
  CONSTRAINT `dexuatkhenthuongkyluat_ibfk_4` FOREIGN KEY (`quyetDinhId`) REFERENCES `quyetdinhkhenthuongkyluat` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dexuatkhenthuongkyluat`
--

LOCK TABLES `dexuatkhenthuongkyluat` WRITE;
/*!40000 ALTER TABLE `dexuatkhenthuongkyluat` DISABLE KEYS */;
/*!40000 ALTER TABLE `dexuatkhenthuongkyluat` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `dondexuatnghiphep`
--

DROP TABLE IF EXISTS `dondexuatnghiphep`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `dondexuatnghiphep` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `maDon` varchar(30) NOT NULL,
  `nhanVienId` int(11) NOT NULL,
  `loaiNghiPhepId` int(11) NOT NULL,
  `ngayBatDau` date NOT NULL,
  `ngayKetThuc` date NOT NULL,
  `soNgayNghi` decimal(4,1) NOT NULL,
  `lyDo` text NOT NULL,
  `phuongThucTao` varchar(20) NOT NULL DEFAULT 'FORM_GIAO_DIEN',
  `trangThai` varchar(30) NOT NULL DEFAULT 'CHO_DUYET',
  `nguoiDuyetId` int(11) DEFAULT NULL,
  `lyDoTuChoi` text DEFAULT NULL,
  `thoiGianDuyet` datetime DEFAULT NULL,
  `ngayTao` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `maDon` (`maDon`),
  KEY `loaiNghiPhepId` (`loaiNghiPhepId`),
  KEY `nguoiDuyetId` (`nguoiDuyetId`),
  KEY `IX_DonNghiPhep_NhanVien` (`nhanVienId`),
  CONSTRAINT `dondexuatnghiphep_ibfk_1` FOREIGN KEY (`nhanVienId`) REFERENCES `nhanvien` (`id`),
  CONSTRAINT `dondexuatnghiphep_ibfk_2` FOREIGN KEY (`loaiNghiPhepId`) REFERENCES `loainghiphep` (`id`),
  CONSTRAINT `dondexuatnghiphep_ibfk_3` FOREIGN KEY (`nguoiDuyetId`) REFERENCES `nhanvien` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `dondexuatnghiphep`
--

LOCK TABLES `dondexuatnghiphep` WRITE;
/*!40000 ALTER TABLE `dondexuatnghiphep` DISABLE KEYS */;
/*!40000 ALTER TABLE `dondexuatnghiphep` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `hopdonglaodong`
--

DROP TABLE IF EXISTS `hopdonglaodong`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `hopdonglaodong` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `maHopDong` varchar(50) NOT NULL,
  `nhanVienId` int(11) NOT NULL,
  `loaiHopDong` varchar(50) NOT NULL,
  `ngayBatDau` date NOT NULL,
  `ngayKetThuc` date DEFAULT NULL,
  `luongCoBan` decimal(15,2) NOT NULL,
  `mucPhuCap` decimal(15,2) DEFAULT 0.00,
  `trangThai` varchar(30) NOT NULL DEFAULT 'HIEU_LUC',
  `duongDanFileHopDong` varchar(255) DEFAULT NULL,
  `ngayTao` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `maHopDong` (`maHopDong`),
  KEY `nhanVienId` (`nhanVienId`),
  CONSTRAINT `hopdonglaodong_ibfk_1` FOREIGN KEY (`nhanVienId`) REFERENCES `nhanvien` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `hopdonglaodong`
--

LOCK TABLES `hopdonglaodong` WRITE;
/*!40000 ALTER TABLE `hopdonglaodong` DISABLE KEYS */;
/*!40000 ALTER TABLE `hopdonglaodong` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `kydanhgiakpi`
--

DROP TABLE IF EXISTS `kydanhgiakpi`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `kydanhgiakpi` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenKyDanhGia` varchar(100) NOT NULL,
  `ngayBatDau` date NOT NULL,
  `ngayKetThuc` date NOT NULL,
  `trangThai` varchar(30) NOT NULL DEFAULT 'DANG_MO',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `kydanhgiakpi`
--

LOCK TABLES `kydanhgiakpi` WRITE;
/*!40000 ALTER TABLE `kydanhgiakpi` DISABLE KEYS */;
/*!40000 ALTER TABLE `kydanhgiakpi` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lichsuhopdong`
--

DROP TABLE IF EXISTS `lichsuhopdong`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `lichsuhopdong` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `hopDongLaoDongId` int(11) NOT NULL,
  `hanhDong` varchar(50) NOT NULL,
  `loaiHopDongCu` varchar(50) DEFAULT NULL,
  `loaiHopDongMoi` varchar(50) NOT NULL,
  `luongCoBanCu` decimal(15,2) DEFAULT NULL,
  `luongCoBanMoi` decimal(15,2) NOT NULL,
  `mucPhuCapCu` decimal(15,2) DEFAULT NULL,
  `mucPhuCapMoi` decimal(15,2) NOT NULL,
  `ngayBatDauCu` date DEFAULT NULL,
  `ngayBatDauMoi` date NOT NULL,
  `ngayKetThucCu` date DEFAULT NULL,
  `ngayKetThucMoi` date DEFAULT NULL,
  `trangThaiCu` varchar(30) DEFAULT NULL,
  `trangThaiMoi` varchar(30) NOT NULL,
  `lyDoThayDoi` text DEFAULT NULL,
  `nguoiThucHienId` int(11) NOT NULL,
  `ngayGhiNhan` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `nguoiThucHienId` (`nguoiThucHienId`),
  KEY `IX_LichSuHopDong_HopDong` (`hopDongLaoDongId`),
  CONSTRAINT `lichsuhopdong_ibfk_1` FOREIGN KEY (`hopDongLaoDongId`) REFERENCES `hopdonglaodong` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lichsuhopdong_ibfk_2` FOREIGN KEY (`nguoiThucHienId`) REFERENCES `nhanvien` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lichsuhopdong`
--

LOCK TABLES `lichsuhopdong` WRITE;
/*!40000 ALTER TABLE `lichsuhopdong` DISABLE KEYS */;
/*!40000 ALTER TABLE `lichsuhopdong` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `loainghiphep`
--

DROP TABLE IF EXISTS `loainghiphep`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `loainghiphep` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `maLoai` varchar(30) NOT NULL,
  `tenLoai` varchar(100) NOT NULL,
  `soNgayToiDa` decimal(4,1) DEFAULT NULL,
  `coLuong` tinyint(1) NOT NULL DEFAULT 1,
  `truVaoQuyPhepNam` tinyint(1) NOT NULL DEFAULT 1,
  `moTa` varchar(255) DEFAULT NULL,
  `trangThai` varchar(20) NOT NULL DEFAULT 'DANG_AP_DUNG',
  PRIMARY KEY (`id`),
  UNIQUE KEY `maLoai` (`maLoai`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `loainghiphep`
--

LOCK TABLES `loainghiphep` WRITE;
/*!40000 ALTER TABLE `loainghiphep` DISABLE KEYS */;
/*!40000 ALTER TABLE `loainghiphep` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nguoidung`
--

DROP TABLE IF EXISTS `nguoidung`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nguoidung` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tenDangNhap` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `matKhauMaHoa` varchar(255) NOT NULL,
  `trangThai` varchar(20) NOT NULL DEFAULT 'DANG_HOAT_DONG',
  `ngayTao` datetime DEFAULT current_timestamp(),
  `lanDangNhapCuoi` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tenDangNhap` (`tenDangNhap`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nguoidung`
--

LOCK TABLES `nguoidung` WRITE;
/*!40000 ALTER TABLE `nguoidung` DISABLE KEYS */;
/*!40000 ALTER TABLE `nguoidung` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nguoidungvaitro`
--

DROP TABLE IF EXISTS `nguoidungvaitro`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nguoidungvaitro` (
  `nguoiDungId` int(11) NOT NULL,
  `vaiTroId` int(11) NOT NULL,
  `ngayGan` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`nguoiDungId`,`vaiTroId`),
  KEY `vaiTroId` (`vaiTroId`),
  CONSTRAINT `nguoidungvaitro_ibfk_1` FOREIGN KEY (`nguoiDungId`) REFERENCES `nguoidung` (`id`) ON DELETE CASCADE,
  CONSTRAINT `nguoidungvaitro_ibfk_2` FOREIGN KEY (`vaiTroId`) REFERENCES `vaitro` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nguoidungvaitro`
--

LOCK TABLES `nguoidungvaitro` WRITE;
/*!40000 ALTER TABLE `nguoidungvaitro` DISABLE KEYS */;
/*!40000 ALTER TABLE `nguoidungvaitro` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nhanvien`
--

DROP TABLE IF EXISTS `nhanvien`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nhanvien` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `maNhanVien` varchar(20) NOT NULL,
  `nguoiDungId` int(11) DEFAULT NULL,
  `hoVaTen` varchar(100) NOT NULL,
  `gioiTinh` varchar(10) NOT NULL,
  `ngaySinh` date NOT NULL,
  `soDienThoai` varchar(20) DEFAULT NULL,
  `diaChi` varchar(255) DEFAULT NULL,
  `soTaiKhoanNganHang` varchar(50) DEFAULT NULL,
  `tenNganHang` varchar(100) DEFAULT NULL,
  `chucDanhPhongBanId` int(11) NOT NULL,
  `ngayVaoLam` date NOT NULL,
  `trangThaiLamViec` varchar(30) NOT NULL DEFAULT 'THU_VIEC',
  `ngayTao` datetime DEFAULT current_timestamp(),
  `ngayCapNhat` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `maNhanVien` (`maNhanVien`),
  UNIQUE KEY `nguoiDungId` (`nguoiDungId`),
  KEY `IX_NhanVien_ChucDanhPhongBan` (`chucDanhPhongBanId`),
  CONSTRAINT `nhanvien_ibfk_1` FOREIGN KEY (`nguoiDungId`) REFERENCES `nguoidung` (`id`),
  CONSTRAINT `nhanvien_ibfk_2` FOREIGN KEY (`chucDanhPhongBanId`) REFERENCES `chucdanhphongban` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nhanvien`
--

LOCK TABLES `nhanvien` WRITE;
/*!40000 ALTER TABLE `nhanvien` DISABLE KEYS */;
/*!40000 ALTER TABLE `nhanvien` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nhatkyhethong`
--

DROP TABLE IF EXISTS `nhatkyhethong`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nhatkyhethong` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `nguoiDungId` int(11) DEFAULT NULL,
  `hanhDong` varchar(100) NOT NULL,
  `diaChiIP` varchar(45) DEFAULT NULL,
  `chiTiet` text DEFAULT NULL,
  `thoiGianTao` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `nguoiDungId` (`nguoiDungId`),
  CONSTRAINT `nhatkyhethong_ibfk_1` FOREIGN KEY (`nguoiDungId`) REFERENCES `nguoidung` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nhatkyhethong`
--

LOCK TABLES `nhatkyhethong` WRITE;
/*!40000 ALTER TABLE `nhatkyhethong` DISABLE KEYS */;
/*!40000 ALTER TABLE `nhatkyhethong` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `phientrochuyenai`
--

DROP TABLE IF EXISTS `phientrochuyenai`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `phientrochuyenai` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nguoiDungId` int(11) NOT NULL,
  `tieuDePhien` varchar(150) NOT NULL,
  `thoiGianTao` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `nguoiDungId` (`nguoiDungId`),
  CONSTRAINT `phientrochuyenai_ibfk_1` FOREIGN KEY (`nguoiDungId`) REFERENCES `nguoidung` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `phientrochuyenai`
--

LOCK TABLES `phientrochuyenai` WRITE;
/*!40000 ALTER TABLE `phientrochuyenai` DISABLE KEYS */;
/*!40000 ALTER TABLE `phientrochuyenai` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `phieudanhgiakpi`
--

DROP TABLE IF EXISTS `phieudanhgiakpi`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `phieudanhgiakpi` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `kyDanhGiaId` int(11) NOT NULL,
  `nhanVienId` int(11) NOT NULL,
  `giaiTrinhNhanVien` text DEFAULT NULL,
  `nhanXetQuanLy` text DEFAULT NULL,
  `xepLoaiChung` varchar(30) DEFAULT NULL,
  `nguoiDanhGiaId` int(11) DEFAULT NULL,
  `ngayNghiemThu` datetime DEFAULT NULL,
  `trangThai` varchar(30) NOT NULL DEFAULT 'BAN_NHAP',
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_NhanVien_KyKPI3` (`kyDanhGiaId`,`nhanVienId`),
  KEY `nhanVienId` (`nhanVienId`),
  KEY `nguoiDanhGiaId` (`nguoiDanhGiaId`),
  CONSTRAINT `phieudanhgiakpi_ibfk_1` FOREIGN KEY (`kyDanhGiaId`) REFERENCES `kydanhgiakpi` (`id`),
  CONSTRAINT `phieudanhgiakpi_ibfk_2` FOREIGN KEY (`nhanVienId`) REFERENCES `nhanvien` (`id`),
  CONSTRAINT `phieudanhgiakpi_ibfk_3` FOREIGN KEY (`nguoiDanhGiaId`) REFERENCES `nhanvien` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `phieudanhgiakpi`
--

LOCK TABLES `phieudanhgiakpi` WRITE;
/*!40000 ALTER TABLE `phieudanhgiakpi` DISABLE KEYS */;
/*!40000 ALTER TABLE `phieudanhgiakpi` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `phieuluongnhanvien`
--

DROP TABLE IF EXISTS `phieuluongnhanvien`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `phieuluongnhanvien` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `bangTongHopLuongId` int(11) NOT NULL,
  `nhanVienId` int(11) NOT NULL,
  `soNgayCongThucTe` decimal(4,1) NOT NULL,
  `luongCoBan` decimal(15,2) NOT NULL,
  `luongLamThemOT` decimal(15,2) DEFAULT 0.00,
  `thuongKPI` decimal(15,2) DEFAULT 0.00,
  `tongPhuCap` decimal(15,2) DEFAULT 0.00,
  `khauTruBaoHiem` decimal(15,2) DEFAULT 0.00,
  `khauTruThueTNCN` decimal(15,2) DEFAULT 0.00,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_BangLuong_NhanVien3` (`bangTongHopLuongId`,`nhanVienId`),
  KEY `nhanVienId` (`nhanVienId`),
  CONSTRAINT `phieuluongnhanvien_ibfk_1` FOREIGN KEY (`bangTongHopLuongId`) REFERENCES `bangtonghopluong` (`id`) ON DELETE CASCADE,
  CONSTRAINT `phieuluongnhanvien_ibfk_2` FOREIGN KEY (`nhanVienId`) REFERENCES `nhanvien` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `phieuluongnhanvien`
--

LOCK TABLES `phieuluongnhanvien` WRITE;
/*!40000 ALTER TABLE `phieuluongnhanvien` DISABLE KEYS */;
/*!40000 ALTER TABLE `phieuluongnhanvien` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `phongban`
--

DROP TABLE IF EXISTS `phongban`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `phongban` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `maPhongBan` varchar(20) NOT NULL,
  `tenPhongBan` varchar(100) NOT NULL,
  `truongBoPhanId` int(11) DEFAULT NULL,
  `phongBanChaId` int(11) DEFAULT NULL,
  `trangThai` varchar(20) NOT NULL DEFAULT 'DANG_HOAT_DONG',
  `ngayTao` datetime DEFAULT current_timestamp(),
  `ngayCapNhat` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `maPhongBan` (`maPhongBan`),
  KEY `phongBanChaId` (`phongBanChaId`),
  KEY `FK_PhongBan_TruongBoPhan3` (`truongBoPhanId`),
  CONSTRAINT `FK_PhongBan_TruongBoPhan3` FOREIGN KEY (`truongBoPhanId`) REFERENCES `nhanvien` (`id`),
  CONSTRAINT `phongban_ibfk_1` FOREIGN KEY (`phongBanChaId`) REFERENCES `phongban` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `phongban`
--

LOCK TABLES `phongban` WRITE;
/*!40000 ALTER TABLE `phongban` DISABLE KEYS */;
/*!40000 ALTER TABLE `phongban` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quyetdinhkhenthuongkyluat`
--

DROP TABLE IF EXISTS `quyetdinhkhenthuongkyluat`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quyetdinhkhenthuongkyluat` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `soQuyetDinh` varchar(50) NOT NULL,
  `nhanVienId` int(11) NOT NULL,
  `loaiQuyetDinh` varchar(20) NOT NULL,
  `tieuDe` varchar(200) NOT NULL,
  `soTien` decimal(15,2) DEFAULT 0.00,
  `lyDo` text NOT NULL,
  `ngayBanHanh` date NOT NULL,
  `nguoiKyDuyetId` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `soQuyetDinh` (`soQuyetDinh`),
  KEY `nhanVienId` (`nhanVienId`),
  KEY `nguoiKyDuyetId` (`nguoiKyDuyetId`),
  CONSTRAINT `quyetdinhkhenthuongkyluat_ibfk_1` FOREIGN KEY (`nhanVienId`) REFERENCES `nhanvien` (`id`),
  CONSTRAINT `quyetdinhkhenthuongkyluat_ibfk_2` FOREIGN KEY (`nguoiKyDuyetId`) REFERENCES `nhanvien` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quyetdinhkhenthuongkyluat`
--

LOCK TABLES `quyetdinhkhenthuongkyluat` WRITE;
/*!40000 ALTER TABLE `quyetdinhkhenthuongkyluat` DISABLE KEYS */;
/*!40000 ALTER TABLE `quyetdinhkhenthuongkyluat` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quyngayphep`
--

DROP TABLE IF EXISTS `quyngayphep`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quyngayphep` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nhanVienId` int(11) NOT NULL,
  `namHieuLuc` int(11) NOT NULL,
  `tongSoNgayPhep` decimal(4,1) NOT NULL DEFAULT 12.0,
  `soNgayDaNghi` decimal(4,1) NOT NULL DEFAULT 0.0,
  `ngayCapNhat` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UQ_NhanVien_NamPhep3` (`nhanVienId`,`namHieuLuc`),
  CONSTRAINT `quyngayphep_ibfk_1` FOREIGN KEY (`nhanVienId`) REFERENCES `nhanvien` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quyngayphep`
--

LOCK TABLES `quyngayphep` WRITE;
/*!40000 ALTER TABLE `quyngayphep` DISABLE KEYS */;
/*!40000 ALTER TABLE `quyngayphep` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tailieuquyche`
--

DROP TABLE IF EXISTS `tailieuquyche`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tailieuquyche` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `maTaiLieu` varchar(30) NOT NULL,
  `tieuDe` varchar(255) NOT NULL,
  `duongDanTep` varchar(255) NOT NULL,
  `nguoiTaiLenId` int(11) NOT NULL,
  `ngayTao` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `maTaiLieu` (`maTaiLieu`),
  KEY `nguoiTaiLenId` (`nguoiTaiLenId`),
  CONSTRAINT `tailieuquyche_ibfk_1` FOREIGN KEY (`nguoiTaiLenId`) REFERENCES `nhanvien` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tailieuquyche`
--

LOCK TABLES `tailieuquyche` WRITE;
/*!40000 ALTER TABLE `tailieuquyche` DISABLE KEYS */;
/*!40000 ALTER TABLE `tailieuquyche` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vaitro`
--

DROP TABLE IF EXISTS `vaitro`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vaitro` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `maVaiTro` varchar(30) NOT NULL,
  `tenVaiTro` varchar(100) NOT NULL,
  `moTa` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `maVaiTro` (`maVaiTro`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vaitro`
--

LOCK TABLES `vaitro` WRITE;
/*!40000 ALTER TABLE `vaitro` DISABLE KEYS */;
/*!40000 ALTER TABLE `vaitro` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `yeucaudieuchinhchamcong`
--

DROP TABLE IF EXISTS `yeucaudieuchinhchamcong`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `yeucaudieuchinhchamcong` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `banGhiChamCongId` bigint(20) DEFAULT NULL,
  `nhanVienId` int(11) NOT NULL,
  `ngayCanDieuChinh` date NOT NULL,
  `gioVaoDeXuat` time DEFAULT NULL,
  `gioRaDeXuat` time DEFAULT NULL,
  `lyDoGiaiTrinh` text NOT NULL,
  `nguoiDuyetId` int(11) DEFAULT NULL,
  `trangThai` varchar(30) NOT NULL DEFAULT 'CHO_DUYET',
  `lyDoTuChoi` text DEFAULT NULL,
  `thoiGianDuyet` datetime DEFAULT NULL,
  `ngayTao` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `banGhiChamCongId` (`banGhiChamCongId`),
  KEY `nhanVienId` (`nhanVienId`),
  KEY `nguoiDuyetId` (`nguoiDuyetId`),
  CONSTRAINT `yeucaudieuchinhchamcong_ibfk_1` FOREIGN KEY (`banGhiChamCongId`) REFERENCES `banghichamcong` (`id`),
  CONSTRAINT `yeucaudieuchinhchamcong_ibfk_2` FOREIGN KEY (`nhanVienId`) REFERENCES `nhanvien` (`id`),
  CONSTRAINT `yeucaudieuchinhchamcong_ibfk_3` FOREIGN KEY (`nguoiDuyetId`) REFERENCES `nhanvien` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `yeucaudieuchinhchamcong`
--

LOCK TABLES `yeucaudieuchinhchamcong` WRITE;
/*!40000 ALTER TABLE `yeucaudieuchinhchamcong` DISABLE KEYS */;
/*!40000 ALTER TABLE `yeucaudieuchinhchamcong` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'QuanLyDoanhNghiepThongMinh'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-29 11:33:14
