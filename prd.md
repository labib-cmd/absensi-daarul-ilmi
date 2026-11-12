# PRD: Web App Absensi Guru & Karyawan - Sekolah Islam Daarul Ilmi Depok
================================================================================
STATUS SISTEM: AKTIF & TERKINI (LOGIN REDESIGN & BUCKET SPLASH ANIMATION)
ARSITEKTUR: Decoupled Web Application (HTML5 + CSS + Modular JS + GAS Backend API)
================================================================================

================================================================================
ZONA 1: SPESIFIKASI KEBUTUHAN PRODUK (BLUEPRINT AWAL)
================================================================================

### 1. Nama Projek & Problem Statement
- **Nama Projek:** Sistem Presensi & Absensi Guru - Sekolah Islam Daarul Ilmi Depok
- **Problem Statement:** Membutuhkan sistem pencatatan kehadiran guru yang akurat, kebal kecurangan lokasi, mendukung pencatatan alasan keterlambatan/pulang cepat, pengajuan izin dinas/sakit, serta monitoring realtime dan rekapitulasi data kehadiran otomatis bagi administrator sekolah.

### 2. Peran Pengguna (User Roles)
- **Guru / Karyawan:**
  - Login menggunakan email dan sandi.
  - Melakukan Absen Masuk dan Absen Pulang dengan validasi kamera selfie dan deteksi lokasi GPS.
  - Mengisi alasan wajib jika datang terlambat (> 07:00) atau pulang terlalu cepat (< 16:00).
  - Mengajukan perizinan (Izin, Sakit, Cuti) dan memantau status persetujuan.
  - Melihat riwayat presensi pribadi (dilengkapi foto bukti dan pagination).
- **Admin Sekolah:**
  - Memantau status kehadiran guru secara realtime per hari ini.
  - Memfilter status guru (Total Guru, Sudah Datang, Sudah Pulang, Belum Absen).
  - Melakukan audit & koreksi jam presensi guru jika diperlukan.
  - Mengunduh rekapitulasi kehadiran dalam format PDF atau CSV/Excel.
  - Memberikan persetujuan (*Approve* / *Reject*) atas pengajuan perizinan guru.
  - Mengatur titik koordinat Google Maps (Latitude, Longitude), batas radius (maksimal 300 meter), jam kerja standar, dan token WhatsApp (Fonnte).

### 3. Arsitektur & Lingkungan Kerja
- **Frontend:** HTML5 murni, Tailwind CSS CDN, Lucide Icons, Google Font (Plus Jakarta Sans).
- **Struktur Berkas Antarmuka:** Standar Web Modern (Modular):
  - `index.html`: Entry point antarmuka web modern dengan animasi splash login.
  - `css/style.css`: Stylesheet terpisah (tema, tombol pill, curved header, layout kartu, animasi ember & splash).
  - `js/api.js`: Data Access Layer (Offline dev preview & Google Apps Script endpoint).
  - `js/auth.js`: Modul otentikasi & manajemen sesi.
  - `js/presensi.js`: Modul kamera live, selfie, GPS geofencing (300m), & formulir perizinan.
  - `js/admin.js`: Modul dashboard admin realtime, approval izin, dan rekap data.
  - `js/app.js`: Inisialisasi ikon Lucide, toast modal, sinkronisasi tanggal, dan kontrol replay animasi.
- **Backend Database:** Supabase Cloud (PostgreSQL 15, Storage Bucket `selfie-absen`) & Google Apps Script Fallback.

================================================================================
ZONA 2: MASTER CONTEXT & LOGIKA SISTEM TERKINI (LIVING CONTEXT)
================================================================================
- **Status Arsitektur Aktif:** Decoupled Web App (HTML5 + Supabase Cloud Database & Storage CDN).
- **Pembaruan Sistem Terkini (v6.0 - Supabase Cloud Migration):**
  1. Integrasi Database Supabase Cloud:
     - Disediakan berkas DDL otomatis `supabase-setup.sql` untuk tabel `users`, `absensi`, `perizinan`, dan `settings`.
     - Disediakan Storage Bucket `selfie-absen` untuk menyimpan foto selfie presensi via CDN.
  2. Lapisan Akses Data (`js/api.js`):
     - Telah terhubung penuh dengan Supabase Project `https://htitgfxyzpnkrtogejqn.supabase.co` menggunakan Publishable Key.
     - Operasi login, presensi harian, upload foto selfie, pengajuan izin, dan monitoring admin kini beroperasi langsung di atas PostgreSQL Supabase.
  3. Antarmuka Login Bersih (*Zero-Delay Instant*):
     - Menggunakan logo resmi **SMA Islam Daarul Ilmi Depok** (`w-24 h-24` di kartu dan `w-12 h-12` di header).
     - Judul sapaan resmi: **"Selamat Datang di"** dengan subjudul **"Sistem Presensi SMA Islam Daarul Ilmi Depok"**.
  4. Mode Produksi Bersih (v6.2):
     - Tombol bantuan akun demo resmi dihilangkan dari antarmuka login.
     - Login bersih hanya menyisakan input Email & Password resmi sekolah.
     - Dukungan auto-complete domain email (`@daarulilmi.sch.id`) aktif.
  5. Fitur Nyata Download Rekapitulasi Data (v6.4 - True .xlsx Engine):
     - Tombol "Download Excel (.xlsx)": Memproduksi berkas murni Microsoft Excel Workbook (.xlsx) dengan SheetJS. Data otomatis terpisah rapi ke kolom A s.d. K dengan auto-fit column width tanpa risiko penumpukan teks di kolom A.
     - Tombol "Download PDF": Menghasilkan pratinjau cetak resmi A4 Landscape ber-kop surat resmi SMA Islam Daarul Ilmi Depok dan kolom tanda tangan pimpinan/Kepala Sekolah siap simpan PDF.
  6. Kesiapan Mobile PWA & Pembuatan APK (v6.5):
     - Berkas `manifest.json` dan `sw.js` terpasang penuh dengan logo resmi sekolah.
     - Mendukung mode `standalone` layar penuh di Android & iOS, serta memenuhi syarat konversi APK via PWABuilder.
  7. Pengamanan Geofencing GPS & Kalkulasi Status Otomatis (v6.6):
     - Validasi ganda jarak Haversine (`hitungJarakMeter`) pada UI (`js/presensi.js`) & API (`js/api.js`) terhadap `LAT_SEKOLAH`, `LONG_SEKOLAH`, dan `MAX_RADIUS_METER` dari Supabase.
     - Menghapus fallback koordinat sekolah saat GPS nonaktif/ditolak serta mengunci tombol kirim di luar radius.
     - Perhitungan otomatis `status_masuk` (`Tepat Waktu`/`Terlambat`) dan `status_pulang` (`Tepat Waktu`/`Pulang Terlalu Cepat`) berbasis `JAM_MASUK_STD` dan `JAM_PULANG_STD`.
