/**
 * ====================================================================
 * API.JS - Data Access Layer (Supabase PostgreSQL, GAS & Local Mock)
 * Sekolah Islam Daarul Ilmi Depok
 * ====================================================================
 */

// ====================================================================
// KONFIGURASI KONEKSI DATABASE (SUPABASE)
// ====================================================================
// Masukkan Project URL dan Anon Key dari dashboard Supabase Anda:
// (Buka Project Settings > API di https://supabase.com)
var SUPABASE_URL = 'https://htitgfxyzpnkrtogejqn.supabase.co'; 
var SUPABASE_ANON_KEY = 'sb_publishable_ZckdSHniuL1qj0yLniTEfA_B6GOiSFi'; 

// Inisialisasi Supabase Client
var supabaseClient = null;

function getSupabase() {
  if (!supabaseClient && SUPABASE_URL && SUPABASE_ANON_KEY) {
    var sbLib = window.supabase || (typeof supabase !== 'undefined' ? supabase : null);
    if (sbLib && typeof sbLib.createClient === 'function') {
      try {
        supabaseClient = sbLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase Client Connected.');
      } catch (e) {
        console.warn('⚠️ Gagal inisialisasi Supabase client:', e);
      }
    }
  }
  return supabaseClient;
}

// Helper: Unggah Foto Selfie Base64 ke Supabase Storage Bucket
function uploadSelfieToSupabase(base64Data, filename) {
  return new Promise(function(resolve) {
    var sb = getSupabase();
    if (!sb || !base64Data || base64Data.indexOf('data:') === -1) {
      resolve(base64Data || '');
      return;
    }

    try {
      var parts = base64Data.split(';base64,');
      var contentType = parts[0].replace('data:', '') || 'image/jpeg';
      var byteCharacters = atob(parts[1] || parts[0]);
      var byteArrays = [];
      for (var offset = 0; offset < byteCharacters.length; offset += 512) {
        var slice = byteCharacters.slice(offset, offset + 512);
        var byteNumbers = new Array(slice.length);
        for (var i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        byteArrays.push(new Uint8Array(byteNumbers));
      }
      var blob = new Blob(byteArrays, { type: contentType });
      var filePath = 'selfie_' + Date.now() + '_' + (filename || 'absen.jpg');

      sb.storage.from('selfie-absen').upload(filePath, blob, {
        contentType: contentType,
        upsert: true
      }).then(function(res) {
        if (res.error) {
          console.warn('Gagal upload ke bucket selfie-absen:', res.error);
          resolve(base64Data);
        } else {
          var publicData = sb.storage.from('selfie-absen').getPublicUrl(filePath);
          resolve(publicData.data.publicUrl);
        }
      }).catch(function() {
        resolve(base64Data);
      });
    } catch (err) {
      resolve(base64Data);
    }
  });
}

// Format Tanggal Hari Ini DD/MM/YYYY
function getTodayFormatted() {
  var d = new Date();
  var day = String(d.getDate()).padStart(2, '0');
  var month = String(d.getMonth() + 1).padStart(2, '0');
  var year = d.getFullYear();
  return day + '/' + month + '/' + year;
}

// Format Jam HH:mm:ss
function getTimeFormatted() {
  var d = new Date();
  var h = String(d.getHours()).padStart(2, '0');
  var m = String(d.getMinutes()).padStart(2, '0');
  var s = String(d.getSeconds()).padStart(2, '0');
  return h + ':' + m + ':' + s;
}

// Hitung Jarak (Meter) dengan Rumus Haversine
function hitungJarakMeter(lat1, lon1, lat2, lon2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

var API = {
  // 0. Ambil Pengaturan Sekolah (Koordinat, Radius, Jam Kerja)
  getSettings: function() {
    var defaults = {
      LAT_SEKOLAH: '-6.3982',
      LONG_SEKOLAH: '106.8271',
      MAX_RADIUS_METER: '300',
      JAM_MASUK_STD: '07:00',
      JAM_PULANG_STD: '16:00'
    };
    return new Promise(function(resolve) {
      var sb = getSupabase();
      if (sb) {
        sb.from('settings').select('*').then(function(res) {
          if (res.data && res.data.length > 0) {
            res.data.forEach(function(s) {
              if (s.key) defaults[s.key] = s.value;
            });
          }
          resolve(defaults);
        }).catch(function() {
          resolve(defaults);
        });
      } else {
        resolve(defaults);
      }
    });
  },
  // 1. Autentikasi Pengguna
  login: function(email, password) {
    var cleanEmail = String(email || '').trim().toLowerCase();
    var cleanPassword = String(password || '').trim();
    if (cleanEmail && cleanEmail.indexOf('@') === -1) {
      cleanEmail = cleanEmail + '@daarulilmi.sch.id';
    }

    return new Promise(function(resolve) {
      var sb = getSupabase();
      if (sb) {
        sb.from('users')
          .select('*')
          .eq('email', cleanEmail)
          .eq('password', cleanPassword)
          .single()
          .then(function(res) {
            if (res.data) {
              resolve({ success: true, user: res.data });
            } else {
              resolve({ success: false, message: 'Email atau kata sandi tidak cocok di database Supabase.' });
            }
          })
          .catch(function() {
            // Direct REST Fallback
            API._loginViaRest(cleanEmail, cleanPassword).then(resolve);
          });
        return;
      }

      // Fallback Direct REST Supabase API
      API._loginViaRest(cleanEmail, cleanPassword).then(resolve);
    });
  },

  _loginViaRest: function(email, password) {
    var url = SUPABASE_URL + '/rest/v1/users?email=eq.' + encodeURIComponent(email) + '&password=eq.' + encodeURIComponent(password) + '&select=*';
    return fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
      }
    })
    .then(function(r) { return r.json(); })
    .then(function(rows) {
      if (rows && rows.length > 0) {
        return { success: true, user: rows[0] };
      }
      return { success: false, message: 'Email atau kata sandi tidak cocok di database Supabase.' };
    })
    .catch(function(err) {
      return { success: false, message: 'Gagal menghubungi database: ' + (err.message || err) };
    });
  },

  // 2. Status Presensi Hari Ini
  getTodayStatus: function(userId) {
    return new Promise(function(resolve) {
      var sb = getSupabase();
      if (sb) {
        var today = getTodayFormatted();
        sb.from('absensi')
          .select('*')
          .eq('id_user', userId)
          .eq('tanggal', today)
          .order('created_at', { ascending: false })
          .limit(1)
          .then(function(res) {
            if (res.data && res.data.length > 0) {
              resolve({ success: true, hasAbsen: true, data: res.data[0] });
            } else {
              resolve({ success: true, hasAbsen: false, data: null });
            }
          })
          .catch(function() {
            resolve({ success: true, hasAbsen: false, data: null });
          });
        return;
      }

      if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run.withSuccessHandler(resolve).getTodayStatus(userId);
        return;
      }

      var saved = localStorage.getItem('mock_today_absen_' + userId);
      if (saved) {
        resolve({ success: true, hasAbsen: true, data: JSON.parse(saved) });
      } else {
        resolve({
          success: true,
          hasAbsen: true,
          data: {
            id_absen: 'ABS-20261105-0001',
            jam_masuk: '06:55:12',
            status_masuk: 'Tepat Waktu',
            foto_masuk: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
            jam_pulang: '',
            status_pulang: '',
            foto_pulang: ''
          }
        });
      }
    });
  },

  // 3. Riwayat Presensi Guru
  getRiwayatPribadi: function(userId, page, limit, search) {
    return new Promise(function(resolve) {
      var sb = getSupabase();
      if (sb) {
        var p = page || 1;
        var l = limit || 10;
        var from = (p - 1) * l;
        var to = from + l - 1;

        var query = sb.from('absensi').select('*', { count: 'exact' }).eq('id_user', userId);
        if (search) {
          query = query.ilike('tanggal', '%' + search + '%');
        }

        query.order('created_at', { ascending: false }).range(from, to).then(function(res) {
          if (res.error) {
            resolve({ success: false, data: [], pagination: { currentPage: p, totalPages: 1, totalItems: 0 } });
          } else {
            resolve({
              success: true,
              data: res.data || [],
              pagination: {
                currentPage: p,
                totalPages: Math.ceil((res.count || 0) / l) || 1,
                totalItems: res.count || 0
              }
            });
          }
        });
        return;
      }

      if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run.withSuccessHandler(resolve).getRiwayatPribadi(userId, page, limit, search);
        return;
      }

      var mockData = [
        { id_absen: 'ABS-001', hari: 'Jumat', tanggal: '30/10/2026', jam_masuk: '06:55:12', status_masuk: 'Tepat Waktu', foto_masuk: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300', jam_pulang: '16:02:10', status_pulang: 'Tepat Waktu', foto_pulang: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300' },
        { id_absen: 'ABS-002', hari: 'Kamis', tanggal: '29/10/2026', jam_masuk: '07:12:45', status_masuk: 'Terlambat', foto_masuk: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300', jam_pulang: '16:00:00', status_pulang: 'Tepat Waktu', foto_pulang: '', alasan_masuk: 'Macet Margonda' }
      ];

      resolve({
        success: true,
        data: mockData,
        pagination: { currentPage: page || 1, totalPages: 1, totalItems: mockData.length }
      });
    });
  },

  // 4. Simpan Absen Masuk & Pulang (Dengan Validasi Ketat Geofencing GPS & Jam Kerja)
  simpanAbsen: function(type, payload) {
    return new Promise(function(resolve) {
      var dayOfWeek = new Date().getDay(); // 0 = Ahad/Minggu, 6 = Sabtu
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        resolve({ success: false, message: 'Presensi hanya berlaku pada hari kerja (Senin s/d Jumat). Hari Sabtu dan Ahad adalah libur sekolah.' });
        return;
      }

      var sb = getSupabase();
      if (sb) {
        API.getSettings().then(function(settings) {
          var latSekolah = parseFloat(settings.LAT_SEKOLAH || '-6.3982');
          var longSekolah = parseFloat(settings.LONG_SEKOLAH || '106.8271');
          var maxRadius = parseFloat(settings.MAX_RADIUS_METER || '300');

          var userLat = parseFloat(payload.lat);
          var userLong = parseFloat(payload.long);

          if (isNaN(userLat) || isNaN(userLong)) {
            resolve({ success: false, message: 'Koordinat GPS tidak terdeteksi. Wajib aktifkan GPS dan izinkan akses lokasi.' });
            return;
          }

          var jarakMeter = hitungJarakMeter(latSekolah, longSekolah, userLat, userLong);
          if (jarakMeter > maxRadius) {
            resolve({
              success: false,
              message: 'Di luar radius sekolah! Jarak Anda ' + Math.round(jarakMeter) + ' meter (maksimal ' + Math.round(maxRadius) + ' meter).'
            });
            return;
          }

          var today = getTodayFormatted();
          var nowTime = getTimeFormatted();
          var nowHHMM = nowTime.slice(0, 5);

          var computedStatus = payload.status;
          if (!computedStatus) {
            if (type === 'MASUK') {
              var stdMasuk = settings.JAM_MASUK_STD || '07:00';
              computedStatus = (nowHHMM > stdMasuk) ? 'Terlambat' : 'Tepat Waktu';
            } else {
              var stdPulang = settings.JAM_PULANG_STD || '16:00';
              computedStatus = (nowHHMM < stdPulang) ? 'Pulang Terlalu Cepat' : 'Tepat Waktu';
            }
          }

          sb.from('absensi').select('*').eq('id_user', payload.userId).eq('tanggal', today).limit(1).then(function(checkRes) {
            var existingRow = (checkRes.data && checkRes.data.length > 0) ? checkRes.data[0] : null;

            if (type === 'MASUK' && existingRow && existingRow.jam_masuk) {
              resolve({ success: false, message: 'Anda sudah melakukan absen masuk hari ini (' + existingRow.jam_masuk + ').' });
              return;
            }
            if (type === 'PULANG' && existingRow && existingRow.jam_pulang) {
              resolve({ success: false, message: 'Anda sudah melakukan absen pulang hari ini (' + existingRow.jam_pulang + ').' });
              return;
            }

            uploadSelfieToSupabase(payload.foto, payload.userId + '_' + type.toLowerCase() + '.jpg').then(function(photoUrl) {
              var days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
              var dayName = days[new Date().getDay()];
              if (type === 'MASUK') {
                var newRecord = {
                  id_absen: 'ABS-' + Date.now(),
                  id_user: payload.userId,
                  nama_guru: payload.userNama,
                  hari: dayName,
                  tanggal: today,
                  jam_masuk: nowTime,
                  status_masuk: computedStatus,
                  foto_masuk: photoUrl,
                  lat_masuk: String(userLat),
                  long_masuk: String(userLong),
                  alasan_masuk: payload.alasan || ''
                };
                sb.from('absensi').insert([newRecord]).then(function(res) {
                  if (res.error) resolve({ success: false, message: res.error.message });
                  else resolve({ success: true, message: 'Presensi masuk berhasil (' + computedStatus + ', jarak ' + Math.round(jarakMeter) + 'm).' });
                });
              } else {
                var updateFields = {
                  jam_pulang: nowTime,
                  status_pulang: computedStatus,
                  foto_pulang: photoUrl,
                  lat_pulang: String(userLat),
                  long_pulang: String(userLong),
                  alasan_pulang: payload.alasan || ''
                };

                if (existingRow) {
                  sb.from('absensi').update(updateFields).eq('id_absen', existingRow.id_absen).then(function(res) {
                    if (res.error) resolve({ success: false, message: res.error.message });
                    else resolve({ success: true, message: 'Presensi pulang berhasil (' + computedStatus + ', jarak ' + Math.round(jarakMeter) + 'm).' });
                  });
                } else {
                  updateFields.id_absen = 'ABS-' + Date.now();
                  updateFields.id_user = payload.userId;
                  updateFields.nama_guru = payload.userNama;
                  updateFields.tanggal = today;
                  sb.from('absensi').insert([updateFields]).then(function(res) {
                    if (res.error) resolve({ success: false, message: res.error.message });
                    else resolve({ success: true, message: 'Presensi pulang berhasil (' + computedStatus + ', jarak ' + Math.round(jarakMeter) + 'm).' });
                  });
                }
              }
            });
          });
        });
        return;
      }

      if (typeof google !== 'undefined' && google.script && google.script.run) {
        var func = (type === 'MASUK') ? 'simpanAbsenMasuk' : 'simpanAbsenPulang';
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(function(err) { resolve({ success: false, message: err.message }); })[func](payload);
        return;
      }

      var now = new Date();
      var nowStr = now.toLocaleTimeString('id-ID');
      var status = (type === 'MASUK') ? 'Tepat Waktu' : 'Tepat Waktu';

      var current = JSON.parse(localStorage.getItem('mock_today_absen_' + payload.userId) || '{}');
      if (type === 'MASUK') {
        current.jam_masuk = nowStr;
        current.status_masuk = status;
        current.foto_masuk = payload.foto;
      } else {
        current.jam_pulang = nowStr;
        current.status_pulang = status;
        current.foto_pulang = payload.foto;
      }
      localStorage.setItem('mock_today_absen_' + payload.userId, JSON.stringify(current));

      resolve({
        success: true,
        message: 'Presensi ' + type.toLowerCase() + ' berhasil dicatat (' + status + ').'
      });
    });
  },

  // 5. Pengajuan Perizinan
  simpanPengajuanIzin: function(payload) {
    return new Promise(function(resolve) {
      var sb = getSupabase();
      if (sb) {
        var row = {
          id_izin: 'IZN-' + Date.now(),
          id_user: payload.userId,
          nama_guru: payload.userNama,
          tanggal_pengajuan: getTodayFormatted(),
          jenis_izin: payload.jenisIzin,
          tgl_mulai: payload.tglMulai,
          tgl_selesai: payload.tglSelesai,
          alasan: payload.alasan,
          status: 'PENDING',
          catatan_admin: ''
        };
        sb.from('perizinan').insert([row]).then(function(res) {
          if (res.error) resolve({ success: false, message: res.error.message });
          else resolve({ success: true, message: 'Pengajuan ' + payload.jenisIzin + ' berhasil dikirim!' });
        });
        return;
      }

      if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(function(err) { resolve({ success: false, message: err.message }); })
          .simpanPengajuanIzin(payload);
        return;
      }

      var list = JSON.parse(localStorage.getItem('mock_izin_list') || '[]');
      list.unshift({
        id_izin: 'IZN-' + Date.now(),
        user_id: payload.userId,
        nama_guru: payload.userNama,
        jenis_izin: payload.jenisIzin,
        tgl_mulai: payload.tglMulai,
        tgl_selesai: payload.tglSelesai,
        alasan: payload.alasan,
        status: 'PENDING',
        catatan_admin: ''
      });
      localStorage.setItem('mock_izin_list', JSON.stringify(list));

      resolve({ success: true, message: 'Pengajuan ' + payload.jenisIzin + ' berhasil dikirim!' });
    });
  },

  // 6. Riwayat Izin Guru
  getRiwayatIzinGuru: function(userId) {
    return new Promise(function(resolve) {
      var sb = getSupabase();
      if (sb) {
        sb.from('perizinan').select('*').eq('id_user', userId).order('created_at', { ascending: false }).then(function(res) {
          resolve({ success: true, data: res.data || [] });
        });
        return;
      }

      if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run.withSuccessHandler(resolve).getRiwayatIzinGuru(userId);
        return;
      }

      var list = JSON.parse(localStorage.getItem('mock_izin_list') || '[]');
      resolve({ success: true, data: list });
    });
  },

  // 6b. Ambil Semua Daftar Izin untuk Admin
  getDaftarIzinAdmin: function() {
    return new Promise(function(resolve) {
      var sb = getSupabase();
      if (sb) {
        sb.from('perizinan').select('*').order('created_at', { ascending: false }).then(function(res) {
          resolve({ success: true, data: res.data || [] });
        }).catch(function(err) {
          resolve({ success: false, message: err.message, data: [] });
        });
        return;
      }

      if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run.withSuccessHandler(resolve).getDaftarIzinAdmin();
        return;
      }

      var list = JSON.parse(localStorage.getItem('mock_izin_list') || '[]');
      resolve({ success: true, data: list });
    });
  },

  // 7. Admin Dashboard Data
  getAdminDashboardData: function(range, search, page, limit, filterGuru) {
    return new Promise(function(resolve) {
      var sb = getSupabase();
      if (sb) {
        var today = getTodayFormatted();
        var rekapQuery = sb.from('absensi').select('*').order('created_at', { ascending: false }).limit(100);
        if (filterGuru && filterGuru !== 'ALL') {
          rekapQuery = rekapQuery.eq('id_user', filterGuru);
        }
        if (search && search.trim() !== '') {
          rekapQuery = rekapQuery.ilike('nama_guru', '%' + search.trim() + '%');
        }

        Promise.all([
          sb.from('users').select('*').eq('role', 'Guru'),
          sb.from('absensi').select('*').eq('tanggal', today),
          sb.from('settings').select('*'),
          rekapQuery
        ]).then(function(results) {
          var guruUsers = results[0].data || [];
          var todayAbsensi = results[1].data || [];
          var settingsData = results[2].data || [];
          var rekapData = results[3].data || [];

          var settingsObj = {};
          settingsData.forEach(function(s) { settingsObj[s.key] = s.value; });

          var sudahMasuk = todayAbsensi.filter(function(a) { return !!a.jam_masuk; }).length;
          var sudahPulang = todayAbsensi.filter(function(a) { return !!a.jam_pulang; }).length;
          var belumAbsen = Math.max(0, guruUsers.length - sudahMasuk);

          var realtime = guruUsers.map(function(g) {
            var ab = todayAbsensi.find(function(a) { return a.id_user === g.id_user; });
            return {
              id_user: g.id_user,
              nama_guru: g.nama_guru,
              status_presensi: ab ? 'Sudah Absen' : 'Belum Absen',
              detail: ab || null
            };
          });

          resolve({
            success: true,
            stats: {
              totalGuru: guruUsers.length,
              sudahAbsenMasukToday: sudahMasuk,
              sudahAbsenPulangToday: sudahPulang,
              belumAbsenToday: belumAbsen
            },
            guruList: guruUsers,
            settings: settingsObj,
            realtimeMonitoring: realtime,
            rekapitulasi: rekapData,
            pagination: { currentPage: page || 1, totalPages: 1 }
          });
        }).catch(function(err) {
          resolve({ success: false, message: err.message });
        });
        return;
      }

      if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run.withSuccessHandler(resolve).getAdminDashboardData(range, search, page, limit, filterGuru);
        return;
      }

      resolve({
        success: true,
        stats: { totalGuru: 3, sudahAbsenMasukToday: 2, sudahAbsenPulangToday: 1, belumAbsenToday: 1 },
        guruList: [
          { id_user: 'USR-002', nama_guru: 'Ustadz Ahmad Fauzi' },
          { id_user: 'USR-003', nama_guru: 'Ustadzah Fatimah' },
          { id_user: 'USR-004', nama_guru: 'Ustadz Abdullah' }
        ],
        settings: { LAT_SEKOLAH: '-6.3982', LONG_SEKOLAH: '106.8271', MAX_RADIUS_METER: '300', JAM_MASUK_STD: '07:00', JAM_PULANG_STD: '16:00' },
        realtimeMonitoring: [
          { id_user: 'USR-002', nama_guru: 'Ustadz Ahmad Fauzi', status_presensi: 'Sudah Absen', detail: { jam_masuk: '06:55:12', status_masuk: 'Tepat Waktu', foto_masuk: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300', jam_pulang: '16:05:30', status_pulang: 'Tepat Waktu', foto_pulang: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300' } },
          { id_user: 'USR-003', nama_guru: 'Ustadzah Fatimah', status_presensi: 'Sudah Absen', detail: { jam_masuk: '07:12:45', status_masuk: 'Terlambat', foto_masuk: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300', jam_pulang: '14:50:11', status_pulang: 'Pulang Terlalu Cepat', foto_pulang: '', alasan_masuk: 'Macet Margonda' } },
          { id_user: 'USR-004', nama_guru: 'Ustadz Abdullah', status_presensi: 'Belum Absen', detail: null }
        ],
        rekapitulasi: [
          { id_absen: 'ABS-001', nama_guru: 'Ustadz Ahmad Fauzi', hari: 'Jumat', tanggal: '30/10/2026', jam_masuk: '06:55:12', status_masuk: 'Tepat Waktu', foto_masuk: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300', jam_pulang: '16:05:30', status_pulang: 'Tepat Waktu', foto_pulang: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300' }
        ],
        pagination: { currentPage: page || 1, totalPages: 1 }
      });
    });
  },

  // 8. Admin Simpan Edit Jam
  simpanEditJamGuru: function(payload) {
    return new Promise(function(resolve) {
      var sb = getSupabase();
      if (sb) {
        sb.from('absensi').update({
          jam_masuk: payload.jamMasuk,
          status_masuk: payload.statusMasuk,
          jam_pulang: payload.jamPulang,
          status_pulang: payload.statusPulang
        }).eq('id_absen', payload.idAbsen).then(function(res) {
          if (res.error) resolve({ success: false, message: res.error.message });
          else resolve({ success: true, message: 'Jam presensi ' + payload.namaGuru + ' berhasil diperbarui.' });
        });
        return;
      }

      if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run.withSuccessHandler(resolve).simpanEditJamGuruAdmin(payload);
        return;
      }
      resolve({ success: true, message: 'Jam presensi ' + payload.namaGuru + ' berhasil disimpan.' });
    });
  },

  // 9. Admin Simpan Settings
  simpanSettings: function(payload) {
    return new Promise(function(resolve) {
      var sb = getSupabase();
      if (sb) {
        var updates = [
          { key: 'LAT_SEKOLAH', value: String(payload.lat) },
          { key: 'LONG_SEKOLAH', value: String(payload.long) },
          { key: 'MAX_RADIUS_METER', value: String(payload.radius) },
          { key: 'JAM_MASUK_STD', value: String(payload.jamMasuk) },
          { key: 'JAM_PULANG_STD', value: String(payload.jamPulang) }
        ];
        sb.from('settings').upsert(updates).then(function(res) {
          if (res.error) resolve({ success: false, message: res.error.message });
          else resolve({ success: true, message: 'Pengaturan Google Maps & Jam Kerja berhasil disimpan ke Supabase!' });
        });
        return;
      }

      if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run.withSuccessHandler(resolve).simpanSettingsAdmin(payload);
        return;
      }
      resolve({ success: true, message: 'Pengaturan Google Maps & Jam Kerja berhasil disimpan.' });
    });
  },

  // 10. Admin Approval Izin
  prosesApprovalIzin: function(payload) {
    return new Promise(function(resolve) {
      var sb = getSupabase();
      if (sb) {
        sb.from('perizinan').update({
          status: payload.status,
          catatan_admin: payload.catatan || ''
        }).eq('id_izin', payload.idIzin).then(function(res) {
          if (res.error) {
            resolve({ success: false, message: res.error.message });
          } else {
            var list = JSON.parse(localStorage.getItem('mock_izin_list') || '[]');
            var found = list.find(function(x) { return x.id_izin === payload.idIzin; });
            if (found) {
              found.status = payload.status;
              found.catatan_admin = payload.catatan || '';
              localStorage.setItem('mock_izin_list', JSON.stringify(list));
            }
            resolve({ success: true, message: 'Status izin berhasil diperbarui menjadi ' + (payload.status === 'APPROVED' ? 'DISETUJUI' : 'DITOLAK') + '.' });
          }
        }).catch(function(err) {
          resolve({ success: false, message: err.message });
        });
        return;
      }

      if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run.withSuccessHandler(resolve).prosesApprovalIzin(payload);
        return;
      }

      var list = JSON.parse(localStorage.getItem('mock_izin_list') || '[]');
      var found = list.find(function(x) { return x.id_izin === payload.idIzin; });
      if (found) {
        found.status = payload.status;
        found.catatan_admin = payload.catatan || '';
        localStorage.setItem('mock_izin_list', JSON.stringify(list));
      }
      resolve({ success: true, message: 'Status izin berhasil diperbarui menjadi ' + (payload.status === 'APPROVED' ? 'DISETUJUI' : 'DITOLAK') + '.' });
    });
  }
};
