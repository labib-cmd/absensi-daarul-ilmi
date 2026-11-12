# LOG REVISI (revisi.md)
================================================================================
STATUS: SELESAI DITERAPKAN (ALL TASKS COMPLETED)
TANGGAL PENERAPAN: 2026-11-12
TARGET: Pemasangan Validasi Ketat Geofencing GPS (Tolak Absen di Luar Radius) & Perbaikan Status Jam Masuk/Pulang
================================================================================

### Riwayat Perubahan Terkini:
1. **Validasi Ketat Geofencing GPS di Layer Database (`js/api.js`):**
   - Menambahkan fungsi `hitungJarakMeter` (rumus Haversine) dan `API.getSettings()` untuk membaca `LAT_SEKOLAH`, `LONG_SEKOLAH`, `MAX_RADIUS_METER`, `JAM_MASUK_STD`, dan `JAM_PULANG_STD` langsung dari Supabase.
   - `API.simpanAbsen()` wajib menolak pengiriman jika koordinat tidak ada (`null`) atau jika `jarakMeter > maxRadius` dengan pesan detail jarak sebenarnya dalam meter.
   - Menambahkan perhitungan otomatis `status_masuk` (`Tepat Waktu` / `Terlambat`) dan `status_pulang` (`Tepat Waktu` / `Pulang Terlalu Cepat`), serta pencegahan presensi ganda di hari yang sama.

2. **Pencegahan Bypass & Indikator Jarak Real-Time (`js/presensi.js` & `index.html`):**
   - Menghapus fallback koordinat default sekolah saat GPS ditolak atau error sehingga pengguna tidak bisa melewati batas radius dengan mematikan GPS.
   - Menampilkan kotak status jarak real-time (`#gpsStatusAlert` & `#gpsBadge`) pada modal kamera absen: hijau jika dalam radius, merah jika di luar radius atau GPS nonaktif.
   - Mengunci tombol *"Kirim Presensi"* (`disabled`) selama lokasi berada di luar jangkauan radius atau GPS tidak aktif.
   - Memperbarui versi script cache-buster ke `?v=2.5` di `index.html`.

================================================================================
Intisari perubahan telah disinkronkan ke zona bawah prd.md.
