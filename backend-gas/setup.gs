/**
 * Setup Database & Safe Migrate untuk Web App Absensi Guru
 * Sekolah Islam Daarul Ilmi Depok (Radius 300 Meter)
 * Lokasi Arsip: backend-gas/setup.gs
 */

function setupDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Setup Sheet Users
  var sheetUsers = getOrCreateSheet(ss, 'Users');
  var userHeaders = ['id_user', 'email', 'nama_guru', 'role', 'password', 'no_hp'];
  safeUpdateHeaders(sheetUsers, userHeaders);
  
  if (sheetUsers.getLastRow() <= 1) {
    sheetUsers.appendRow(['USR-001', 'admin@daarulilmi.sch.id', 'Admin Sekolah', 'Admin Sekolah', 'admin123', '081234567890']);
    sheetUsers.appendRow(['USR-002', 'ahmad@daarulilmi.sch.id', 'Ustadz Ahmad Fauzi', 'Guru', 'guru123', '081298765432']);
    sheetUsers.appendRow(['USR-003', 'fatimah@daarulilmi.sch.id', 'Ustadzah Fatimah', 'Guru', 'guru123', '081287654321']);
    sheetUsers.appendRow(['USR-004', 'abdullah@daarulilmi.sch.id', 'Ustadz Abdullah', 'Guru', 'guru123', '081276543210']);
  }
  
  // 2. Setup Sheet Absensi
  var sheetAbsensi = getOrCreateSheet(ss, 'Absensi');
  var absensiHeaders = [
    'id_absen', 'id_user', 'nama_guru', 'tanggal', 'jam_masuk', 
    'status_masuk', 'foto_masuk', 'lat_masuk', 'long_masuk', 
    'jam_pulang', 'status_pulang', 'foto_pulang', 'lat_pulang', 'long_pulang',
    'alasan_masuk', 'alasan_pulang'
  ];
  safeUpdateHeaders(sheetAbsensi, absensiHeaders);
  
  // 3. Setup Sheet Settings
  var sheetSettings = getOrCreateSheet(ss, 'Settings');
  var settingsHeaders = ['key', 'value'];
  safeUpdateHeaders(sheetSettings, settingsHeaders);
  
  if (sheetSettings.getLastRow() <= 1) {
    sheetSettings.appendRow(['JAM_MASUK_STD', '07:00']);
    sheetSettings.appendRow(['JAM_PULANG_STD', '16:00']);
    sheetSettings.appendRow(['NAMA_SEKOLAH', 'Sekolah Islam Daarul Ilmi Depok']);
    sheetSettings.appendRow(['LAT_SEKOLAH', '-6.3982']);
    sheetSettings.appendRow(['LONG_SEKOLAH', '106.8271']);
    sheetSettings.appendRow(['MAX_RADIUS_METER', '300']);
    sheetSettings.appendRow(['WA_API_TOKEN', '']);
    sheetSettings.appendRow(['NO_WA_ADMIN', '081234567890']);
  }
  
  // 4. Setup Sheet Perizinan
  var sheetIzin = getOrCreateSheet(ss, 'Perizinan');
  var izinHeaders = [
    'id_izin', 'id_user', 'nama_guru', 'tanggal_pengajuan', 
    'jenis_izin', 'tgl_mulai', 'tgl_selesai', 'alasan', 
    'status', 'catatan_admin'
  ];
  safeUpdateHeaders(sheetIzin, izinHeaders);
  
  SpreadsheetApp.flush();
  return "Database presensi berhasil diinisialisasi (Safe Migrate)!";
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function safeUpdateHeaders(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    return;
  }
  var existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getDisplayValues()[0];
  if (existing.length < headers.length && sheet.getLastRow() === 1) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

