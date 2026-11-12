/**
 * ====================================================================
 * BACKEND GOOGLE APPS SCRIPT (REST API & DATABASE CONTROLLER)
 * Lokasi Arsip: backend-gas/code.gs
 * ====================================================================
 */

var COL_USER = { ID: 0, EMAIL: 1, NAMA: 2, ROLE: 3, PASSWORD: 4, NO_HP: 5 };
var COL_ABSEN = {
  ID: 0, USER_ID: 1, NAMA: 2, TANGGAL: 3,
  JAM_MASUK: 4, STATUS_MASUK: 5, FOTO_MASUK: 6, LAT_MASUK: 7, LONG_MASUK: 8,
  JAM_PULANG: 9, STATUS_PULANG: 10, FOTO_PULANG: 11, LAT_PULANG: 12, LONG_PULANG: 13,
  ALASAN_MASUK: 14, ALASAN_PULANG: 15
};
var COL_IZIN = {
  ID: 0, USER_ID: 1, NAMA: 2, TGL_PENGAJUAN: 3,
  JENIS: 4, TGL_MULAI: 5, TGL_SELESAI: 6, ALASAN: 7, STATUS: 8, CATATAN: 9
};

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'status';
  return ContentService.createTextOutput(JSON.stringify({ status: 'API Active', action: action }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var response = { success: false, message: 'Invalid Request' };
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;

    if (action === 'login') response = loginUser(body.email, body.password);
    else if (action === 'getTodayStatus') response = getTodayStatus(body.userId);
    else if (action === 'getRiwayatPribadi') response = getRiwayatPribadi(body.userId, body.page, body.limit, body.search);
    else if (action === 'simpanAbsenMasuk') response = simpanAbsenMasuk(body.payload);
    else if (action === 'simpanAbsenPulang') response = simpanAbsenPulang(body.payload);
    else if (action === 'simpanPengajuanIzin') response = simpanPengajuanIzin(body.payload);
    else if (action === 'getRiwayatIzinGuru') response = getRiwayatIzinGuru(body.userId);
    else if (action === 'getAdminDashboardData') response = getAdminDashboardData(body.range, body.search, body.page, body.limit, body.filterGuru);
    else if (action === 'simpanEditJamGuruAdmin') response = simpanEditJamGuruAdmin(body.payload);
    else if (action === 'simpanSettingsAdmin') response = simpanSettingsAdmin(body.payload);
    else if (action === 'getDaftarIzinAdmin') response = getDaftarIzinAdmin();
    else if (action === 'prosesApprovalIzin') response = prosesApprovalIzin(body.payload);
    else if (action === 'generatePdfRekap') response = generatePdfRekap(body.range, body.search, body.filterGuru);
    else if (action === 'generateCsvRekap') response = generateCsvRekap(body.range, body.search, body.filterGuru);
  } catch (err) {
    response = { success: false, message: err.message };
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function loginUser(email, password) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Users');
    if (!sheet) {
      setupDatabase();
      sheet = ss.getSheetByName('Users');
    }

    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: false, message: 'Data pengguna belum diinisialisasi.' };

    var data = sheet.getRange(2, 1, lastRow - 1, 6).getDisplayValues();
    var cleanEmail = String(email || '').trim().toLowerCase();
    var cleanPass = String(password || '').trim();

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (String(row[1]).trim().toLowerCase() === cleanEmail && String(row[4]).trim() === cleanPass) {
        var userData = {
          id_user: row[0],
          email: row[1],
          nama_guru: row[2],
          role: row[3],
          no_hp: row[5] || ''
        };
        return { success: true, user: userData };
      }
    }
    return { success: false, message: 'Email atau kata sandi tidak sesuai.' };
  } catch (err) {
    return { success: false, message: 'Gagal login: ' + err.message };
  }
}

function getTodayStatus(userId) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Absensi');
    if (!sheet || sheet.getLastRow() <= 1) return { success: true, hasAbsen: false, data: null };

    var todayStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd/MM/yyyy');
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 16).getDisplayValues();

    for (var i = data.length - 1; i >= 0; i--) {
      var r = data[i];
      if (r[1] === userId && r[3] === todayStr) {
        return {
          success: true,
          hasAbsen: true,
          data: {
            id_absen: r[0],
            jam_masuk: r[4],
            status_masuk: r[5],
            foto_masuk: r[6],
            jam_pulang: r[9],
            status_pulang: r[10],
            foto_pulang: r[11],
            alasan_masuk: r[14] || '',
            alasan_pulang: r[15] || ''
          }
        };
      }
    }
    return { success: true, hasAbsen: false, data: null };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function getRiwayatPribadi(userId, page, limit, search) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Absensi');
    page = Number(page) || 1;
    limit = Number(limit) || 5;
    var q = String(search || '').trim().toLowerCase();

    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: true, data: [], pagination: { currentPage: 1, totalPages: 1, totalItems: 0 } };
    }

    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 16).getDisplayValues();
    var filtered = [];

    for (var i = rows.length - 1; i >= 0; i--) {
      var r = rows[i];
      if (r[1] === userId) {
        var hariNama = getHariIndonesia(r[3]);
        var match = !q || r[3].toLowerCase().indexOf(q) !== -1 || hariNama.toLowerCase().indexOf(q) !== -1;
        if (match) {
          filtered.push({
            id_absen: r[0],
            hari: hariNama,
            tanggal: r[3],
            jam_masuk: r[4],
            status_masuk: r[5],
            foto_masuk: r[6],
            jam_pulang: r[9],
            status_pulang: r[10],
            foto_pulang: r[11],
            alasan_masuk: r[14] || '',
            alasan_pulang: r[15] || ''
          });
        }
      }
    }

    var totalItems = filtered.length;
    var totalPages = Math.max(1, Math.ceil(totalItems / limit));
    var offset = (page - 1) * limit;

    return {
      success: true,
      data: filtered.slice(offset, offset + limit),
      pagination: { currentPage: page, totalPages: totalPages, totalItems: totalItems }
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function simpanAbsenMasuk(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Absensi');
    var settings = getSettingsMap(ss);

    var latSekolah = parseFloat(settings['LAT_SEKOLAH'] || '-6.3982');
    var longSekolah = parseFloat(settings['LONG_SEKOLAH'] || '106.8271');
    var maxRadius = Math.min(300, parseFloat(settings['MAX_RADIUS_METER'] || '300'));

    var userLat = parseFloat(payload.lat || latSekolah);
    var userLong = parseFloat(payload.long || longSekolah);
    var distance = hitungJarakMeter(latSekolah, longSekolah, userLat, userLong);

    if (distance > maxRadius) {
      return { success: false, message: 'Di luar radius presensi (' + Math.round(distance) + 'm, maks ' + maxRadius + 'm).' };
    }

    var now = new Date();
    var todayStr = Utilities.formatDate(now, 'Asia/Jakarta', 'dd/MM/yyyy');
    var jamStr = Utilities.formatDate(now, 'Asia/Jakarta', 'HH:mm:ss');
    var codeToday = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMdd');
    var prefix = 'ABS-' + codeToday + '-';

    var lastRow = sheet.getLastRow();
    var maxSeq = 0;
    var existingRowIndex = -1;

    if (lastRow > 1) {
      var data = sheet.getRange(2, 1, lastRow - 1, 16).getDisplayValues();
      for (var i = 0; i < data.length; i++) {
        var rowId = data[i][COL_ABSEN.ID];
        if (rowId.indexOf(prefix) === 0) {
          var num = parseInt(rowId.substring(prefix.length), 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
        if (data[i][COL_ABSEN.USER_ID] === payload.userId && data[i][COL_ABSEN.TANGGAL] === todayStr) {
          if (data[i][COL_ABSEN.JAM_MASUK]) return { success: false, message: 'Sudah absen masuk hari ini.' };
          existingRowIndex = i + 2;
        }
      }
    }

    var jamStdMasuk = settings['JAM_MASUK_STD'] || '07:00';
    var statusMasuk = (jamStr.slice(0, 5) > jamStdMasuk) ? 'Terlambat' : 'Tepat Waktu';
    var fotoUrl = simpanFotoSelfie(payload.foto, 'MASUK_' + payload.userId + '_' + codeToday);

    if (existingRowIndex !== -1) {
      sheet.getRange(existingRowIndex, 5, 1, 5).setValues([[jamStr, statusMasuk, fotoUrl, String(payload.lat || ''), String(payload.long || '')]]);
      sheet.getRange(existingRowIndex, 15).setValue(String(payload.alasan || ''));
    } else {
      var newId = prefix + ('0000' + (maxSeq + 1)).slice(-4);
      sheet.appendRow([newId, payload.userId, payload.userNama, todayStr, jamStr, statusMasuk, fotoUrl, String(payload.lat || ''), String(payload.long || ''), '', '', '', '', '', String(payload.alasan || ''), '']);
    }

    SpreadsheetApp.flush();
    return { success: true, message: 'Absen masuk berhasil (' + statusMasuk + ').' };
  } catch (err) {
    return { success: false, message: err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function simpanAbsenPulang(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Absensi');
    var settings = getSettingsMap(ss);

    var latSekolah = parseFloat(settings['LAT_SEKOLAH'] || '-6.3982');
    var longSekolah = parseFloat(settings['LONG_SEKOLAH'] || '106.8271');
    var maxRadius = Math.min(300, parseFloat(settings['MAX_RADIUS_METER'] || '300'));

    var userLat = parseFloat(payload.lat || latSekolah);
    var userLong = parseFloat(payload.long || longSekolah);
    var distance = hitungJarakMeter(latSekolah, longSekolah, userLat, userLong);

    if (distance > maxRadius) {
      return { success: false, message: 'Di luar radius presensi (' + Math.round(distance) + 'm, maks ' + maxRadius + 'm).' };
    }

    var now = new Date();
    var todayStr = Utilities.formatDate(now, 'Asia/Jakarta', 'dd/MM/yyyy');
    var jamStr = Utilities.formatDate(now, 'Asia/Jakarta', 'HH:mm:ss');
    var codeToday = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMdd');

    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: false, message: 'Data presensi masuk hari ini belum ditemukan.' };

    var data = sheet.getRange(2, 1, lastRow - 1, 16).getDisplayValues();
    var targetRow = -1;

    for (var i = data.length - 1; i >= 0; i--) {
      if (data[i][COL_ABSEN.USER_ID] === payload.userId && data[i][COL_ABSEN.TANGGAL] === todayStr) {
        if (data[i][COL_ABSEN.JAM_PULANG]) return { success: false, message: 'Sudah absen pulang hari ini.' };
        targetRow = i + 2;
        break;
      }
    }

    if (targetRow === -1) return { success: false, message: 'Silakan lakukan absen masuk terlebih dahulu.' };

    var jamStdPulang = settings['JAM_PULANG_STD'] || '16:00';
    var statusPulang = (jamStr.slice(0, 5) < jamStdPulang) ? 'Pulang Terlalu Cepat' : 'Tepat Waktu';
    var fotoUrl = simpanFotoSelfie(payload.foto, 'PULANG_' + payload.userId + '_' + codeToday);

    sheet.getRange(targetRow, 10, 1, 5).setValues([[jamStr, statusPulang, fotoUrl, String(payload.lat || ''), String(payload.long || '')]]);
    sheet.getRange(targetRow, 16).setValue(String(payload.alasan || ''));

    SpreadsheetApp.flush();
    return { success: true, message: 'Absen pulang berhasil (' + statusPulang + ').' };
  } catch (err) {
    return { success: false, message: err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function simpanPengajuanIzin(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Perizinan');
    var now = new Date();
    var tglPengajuan = Utilities.formatDate(now, 'Asia/Jakarta', 'dd/MM/yyyy HH:mm:ss');
    var codeToday = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyyMMdd');
    var prefix = 'IZN-' + codeToday + '-';

    var lastRow = sheet.getLastRow();
    var maxSeq = 0;
    if (lastRow > 1) {
      var existing = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
      for (var i = 0; i < existing.length; i++) {
        var rowId = existing[i][0];
        if (rowId.indexOf(prefix) === 0) {
          var num = parseInt(rowId.substring(prefix.length), 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      }
    }

    var idIzin = prefix + ('0000' + (maxSeq + 1)).slice(-4);
    sheet.appendRow([idIzin, payload.userId, payload.userNama, tglPengajuan, payload.jenisIzin, payload.tglMulai, payload.tglSelesai, payload.alasan, 'PENDING', '']);
    SpreadsheetApp.flush();

    return { success: true, message: 'Pengajuan ' + payload.jenisIzin + ' berhasil dikirim.' };
  } catch (err) {
    return { success: false, message: err.message };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function getSettingsMap(ss) {
  var sheet = ss.getSheetByName('Settings');
  var map = { 'JAM_MASUK_STD': '07:00', 'JAM_PULANG_STD': '16:00', 'LAT_SEKOLAH': '-6.3982', 'LONG_SEKOLAH': '106.8271', 'MAX_RADIUS_METER': '300' };
  if (sheet && sheet.getLastRow() > 1) {
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getDisplayValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][0]) map[data[i][0]] = data[i][1];
    }
  }
  return map;
}

function hitungJarakMeter(lat1, lon1, lat2, lon2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function simpanFotoSelfie(base64Data, prefixName) {
  if (!base64Data) return '';
  if (base64Data.length < 48000) return base64Data;
  try {
    var raw = base64Data.split(',')[1] || base64Data;
    var blob = Utilities.newBlob(Utilities.base64Decode(raw), 'image/jpeg', prefixName + '.jpg');
    var file = DriveApp.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return 'https://drive.google.com/uc?export=view&id=' + file.getId();
  } catch (e) {
    return '';
  }
}

