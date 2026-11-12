-- ====================================================================
-- SUPABASE SETUP SCRIPT: Web App Presensi Guru SMA Islam Daarul Ilmi Depok
-- File: supabase-setup.sql
-- ====================================================================
-- CARA PENGGUNAAN:
-- 1. Buka dashboard projek Anda di https://supabase.com
-- 2. Masuk ke menu "SQL Editor" di bilah samping kiri
-- 3. Klik "New Query", tempel seluruh kode di bawah ini, lalu klik "RUN"
-- ====================================================================

-- 1. TABEL: users (Data Pengguna / Guru & Admin)
CREATE TABLE IF NOT EXISTS public.users (
    id_user TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    nama_guru TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Guru', -- 'Guru' atau 'Admin Sekolah'
    password TEXT NOT NULL,
    no_hp TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('asia/jakarta', NOW())
);

-- 2. TABEL: absensi (Log Absensi Harian Guru)
CREATE TABLE IF NOT EXISTS public.absensi (
    id_absen TEXT PRIMARY KEY,
    id_user TEXT REFERENCES public.users(id_user) ON DELETE CASCADE,
    nama_guru TEXT NOT NULL,
    tanggal TEXT NOT NULL, -- Format: DD/MM/YYYY
    jam_masuk TEXT,
    status_masuk TEXT, -- 'Tepat Waktu', 'Terlambat'
    foto_masuk TEXT,
    lat_masuk TEXT,
    long_masuk TEXT,
    jam_pulang TEXT,
    status_pulang TEXT, -- 'Tepat Waktu', 'Pulang Terlalu Cepat'
    foto_pulang TEXT,
    lat_pulang TEXT,
    long_pulang TEXT,
    alasan_masuk TEXT,
    alasan_pulang TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('asia/jakarta', NOW())
);

-- 3. TABEL: perizinan (Pengajuan Izin, Sakit, & Cuti)
CREATE TABLE IF NOT EXISTS public.perizinan (
    id_izin TEXT PRIMARY KEY,
    id_user TEXT REFERENCES public.users(id_user) ON DELETE CASCADE,
    nama_guru TEXT NOT NULL,
    tanggal_pengajuan TEXT NOT NULL,
    jenis_izin TEXT NOT NULL, -- 'Izin', 'Sakit', 'Cuti'
    tgl_mulai TEXT NOT NULL,
    tgl_selesai TEXT NOT NULL,
    alasan TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    catatan_admin TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('asia/jakarta', NOW())
);

-- 4. TABEL: settings (Pengaturan Radius GPS & Jam Sekolah)
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('asia/jakarta', NOW())
);

-- ====================================================================
-- INDEKS PERFORMA QUERY
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_absensi_user_tanggal ON public.absensi(id_user, tanggal);
CREATE INDEX IF NOT EXISTS idx_absensi_tanggal ON public.absensi(tanggal);
CREATE INDEX IF NOT EXISTS idx_perizinan_user ON public.perizinan(id_user);

-- ====================================================================
-- KEBIJAKAN KEAMANAN (ROW LEVEL SECURITY & ANON KEY ACCESS)
-- ====================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absensi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perizinan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Kebijakan Akses Penuh untuk Klien Web (via Supabase Anon Key)
DROP POLICY IF EXISTS "Public users access" ON public.users;
CREATE POLICY "Public users access" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public absensi access" ON public.absensi;
CREATE POLICY "Public absensi access" ON public.absensi FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public perizinan access" ON public.perizinan;
CREATE POLICY "Public perizinan access" ON public.perizinan FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public settings access" ON public.settings;
CREATE POLICY "Public settings access" ON public.settings FOR ALL USING (true) WITH CHECK (true);

-- ====================================================================
-- STORAGE BUCKET: selfie-absen (Penyimpanan Foto Selfie)
-- ====================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('selfie-absen', 'selfie-absen', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public upload selfie-absen" ON storage.objects;
CREATE POLICY "Public upload selfie-absen" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'selfie-absen');

DROP POLICY IF EXISTS "Public view selfie-absen" ON storage.objects;
CREATE POLICY "Public view selfie-absen" ON storage.objects 
FOR SELECT USING (bucket_id = 'selfie-absen');

-- ====================================================================
-- DATA AWAL (SEED DATA SAMPLE)
-- ====================================================================
-- 1. Akun Pengguna Demo
INSERT INTO public.users (id_user, email, nama_guru, role, password, no_hp)
VALUES 
    ('USR-001', 'admin@daarulilmi.sch.id', 'Admin Sekolah', 'Admin Sekolah', 'admin123', '081234567890'),
    ('USR-002', 'ahmad@daarulilmi.sch.id', 'Ustadz Ahmad Fauzi', 'Guru', 'guru123', '081298765432'),
    ('USR-003', 'fatimah@daarulilmi.sch.id', 'Ustadzah Fatimah', 'Guru', 'guru123', '081287654321'),
    ('USR-004', 'abdullah@daarulilmi.sch.id', 'Ustadz Abdullah', 'Guru', 'guru123', '081276543210')
ON CONFLICT (id_user) DO NOTHING;

-- 2. Pengaturan Jam Kerja & Titik Koordinat GPS Sekolah (Radius 300 Meter)
INSERT INTO public.settings (key, value)
VALUES 
    ('JAM_MASUK_STD', '07:00'),
    ('JAM_PULANG_STD', '16:00'),
    ('NAMA_SEKOLAH', 'Sekolah Islam Daarul Ilmi Depok'),
    ('LAT_SEKOLAH', '-6.3982'),
    ('LONG_SEKOLAH', '106.8271'),
    ('MAX_RADIUS_METER', '300'),
    ('WA_API_TOKEN', ''),
    ('NO_WA_ADMIN', '081234567890')
ON CONFLICT (key) DO NOTHING;

