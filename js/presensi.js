/**
 * ====================================================================
 * PRESENSI.JS - Kamera Selfie, GPS Geofencing & Dashboard Guru
 * ====================================================================
 */

var currentAbsenType = 'MASUK';
var mediaStream = null;
var capturedPhotoBase64 = '';
var currentLat = null;
var currentLong = null;
var currentDistanceMeters = null;
var currentAccuracy = null;
var gpsStatusValid = false;
var gpsWatchId = null;

var activeSchoolSettings = JSON.parse(localStorage.getItem('daarulilmi_cached_settings') || 'null') || {
  LAT_SEKOLAH: '-6.41022',
  LONG_SEKOLAH: '106.82729',
  MAX_RADIUS_METER: '350',
  JAM_MASUK_STD: '07:00',
  JAM_PULANG_STD: '16:00'
};
var stateGuru = { page: 1, limit: 5, search: '' };

function loadGuruDashboard() {
  // Pre-load pengaturan sekolah terbaru di background
  API.getSettings().then(function(s) {
    if (s) activeSchoolSettings = s;
  });

  loadTodayStatusGuru();
  loadRiwayatGuru();
  loadIzinGuru();

  if (!window.guruReminderInterval) {
    window.guruReminderInterval = setInterval(function() {
      if (currentUser && currentUser.role === 'Guru') {
        loadTodayStatusGuru();
      }
    }, 60000);
  }
}

function loadTodayStatusGuru() {
  if (!currentUser) return;
  API.getTodayStatus(currentUser.id_user).then(function(res) {
    if (res.success && res.hasAbsen) {
      renderTodayCardGuru(res.data);
      checkGuruAttendanceReminder(res.data);
    } else {
      renderTodayCardGuru(null);
      checkGuruAttendanceReminder(null);
    }
  });
}

function checkGuruAttendanceReminder(todayAbsen) {
  if (!currentUser || currentUser.role !== 'Guru') return;

  var now = new Date();
  var dayOfWeek = now.getDay(); // 0 = Ahad/Minggu, 6 = Sabtu
  // Nonaktifkan notifikasi pengingat pada hari Sabtu & Ahad (hanya aktif Senin s/d Jumat)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return;
  }

  if (typeof requestNotificationPermission === 'function') {
    requestNotificationPermission();
  }

  var hours = now.getHours();
  var minutes = now.getMinutes();
  var totalMins = hours * 60 + minutes;
  var todayKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

  // 1. Pengingat Datang Pagi (06:00 - 09:30) -> 360 s/d 570 menit
  var sudahMasuk = todayAbsen && todayAbsen.jam_masuk;
  if (!sudahMasuk) {
    var keyDatang = 'notif_remind_datang_' + currentUser.id_user + '_' + todayKey;
    if (totalMins >= 360 && totalMins <= 570 && !sessionStorage.getItem(keyDatang)) {
      sessionStorage.setItem(keyDatang, '1');
      if (typeof triggerSystemNotification === 'function') {
        triggerSystemNotification('⏰ Pengingat Presensi Datang', {
          body: 'Assalamu\'alaikum ' + currentUser.nama_guru + ', jangan lupa presensi datang hari ini ya!',
          icon: 'img/logo.jpg',
          tag: 'reminder-datang-' + todayKey
        });
      }
    }
  }

  // 2. Pengingat Pulang Sore (15:00 - 18:30) -> 900 s/d 1110 menit
  var sudahPulang = todayAbsen && todayAbsen.jam_pulang;
  if (sudahMasuk && !sudahPulang) {
    var keyPulang = 'notif_remind_pulang_' + currentUser.id_user + '_' + todayKey;
    if (totalMins >= 900 && totalMins <= 1110 && !sessionStorage.getItem(keyPulang)) {
      sessionStorage.setItem(keyPulang, '1');
      if (typeof triggerSystemNotification === 'function') {
        triggerSystemNotification('🏠 Pengingat Presensi Pulang', {
          body: 'Waktu kepulangan telah tiba, silakan lakukan presensi pulang ya!',
          icon: 'img/logo.jpg',
          tag: 'reminder-pulang-' + todayKey
        });
      }
    }
  }
}

function renderTodayCardGuru(data) {
  var elJamM = document.getElementById('guruJamMasuk');
  var elStatM = document.getElementById('guruStatusMasuk');
  var elJamP = document.getElementById('guruJamPulang');
  var elStatP = document.getElementById('guruStatusPulang');
  var btnM = document.getElementById('btnAbsenMasuk');
  var btnP = document.getElementById('btnAbsenPulang');

  var now = new Date();
  var dayOfWeek = now.getDay(); // 0 = Ahad, 6 = Sabtu
  var isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

  if (data && data.jam_masuk) {
    elJamM.innerText = data.jam_masuk;
    elStatM.innerText = data.status_masuk;
    elStatM.className = data.status_masuk === 'Tepat Waktu' ? 
      'inline-block text-[9px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700' :
      'inline-block text-[9px] px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-700';
    btnM.disabled = true;
  } else {
    elJamM.innerText = '--:--';
    elStatM.innerText = isWeekend ? 'Libur' : 'Belum';
    elStatM.className = isWeekend ? 
      'inline-block text-[9px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-500 border border-slate-200' :
      'inline-block text-[9px] px-2 py-0.5 rounded-full font-bold bg-slate-200 text-slate-600';
    btnM.disabled = isWeekend ? true : false;
    if (isWeekend) {
      btnM.classList.add('opacity-40', 'cursor-not-allowed');
      btnM.title = 'Libur Sekolah (Presensi hanya Senin - Jumat)';
    } else {
      btnM.classList.remove('opacity-40', 'cursor-not-allowed');
      btnM.title = '';
    }
  }

  if (data && data.jam_pulang) {
    elJamP.innerText = data.jam_pulang;
    elStatP.innerText = data.status_pulang;
    elStatP.className = data.status_pulang === 'Tepat Waktu' ? 
      'inline-block text-[9px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700' :
      'inline-block text-[9px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700';
    btnP.disabled = true;
  } else {
    elJamP.innerText = '--:--';
    elStatP.innerText = isWeekend ? 'Libur' : 'Belum';
    elStatP.className = isWeekend ? 
      'inline-block text-[9px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-500 border border-slate-200' :
      'inline-block text-[9px] px-2 py-0.5 rounded-full font-bold bg-slate-200 text-slate-600';
    btnP.disabled = isWeekend ? true : !(data && data.jam_masuk);
    if (isWeekend) {
      btnP.classList.add('opacity-40', 'cursor-not-allowed');
      btnP.title = 'Libur Sekolah (Presensi hanya Senin - Jumat)';
    } else {
      btnP.classList.remove('opacity-40', 'cursor-not-allowed');
      btnP.title = '';
    }
  }
}

function debounceLoadRiwayatGuru() {
  clearTimeout(window.timerDebounce);
  window.timerDebounce = setTimeout(function() {
    stateGuru.page = 1;
    stateGuru.search = document.getElementById('searchRiwayatGuru').value;
    loadRiwayatGuru();
  }, 300);
}

function changePageGuru(delta) {
  stateGuru.page += delta;
  loadRiwayatGuru();
}

function loadRiwayatGuru() {
  var tbody = document.getElementById('tblRiwayatGuru');
  tbody.innerHTML = '<tr><td colspan="3" class="p-3 text-center text-slate-400">Memuat data...</td></tr>';

  API.getRiwayatPribadi(currentUser.id_user, stateGuru.page, stateGuru.limit, stateGuru.search).then(function(res) {
    if (res.success) {
      renderTableGuru(res.data, res.pagination);
    }
  });
}

function renderTableGuru(items, pag) {
  var tbody = document.getElementById('tblRiwayatGuru');
  tbody.innerHTML = '';

  if (!items || items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="p-3 text-center text-slate-400">Belum ada riwayat.</td></tr>';
    return;
  }

  items.forEach(function(r) {
    var tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition';
    
    var badgeMClass = r.status_masuk === 'Tepat Waktu' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-rose-700 bg-rose-50 border border-rose-200';
    var badgePClass = r.status_pulang === 'Tepat Waktu' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-amber-700 bg-amber-50 border border-amber-200';

    var safeAlasanM = (r.alasan_masuk || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    var safeAlasanP = (r.alasan_pulang || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    var safeNamaGuru = (currentUser ? currentUser.nama_guru : 'Guru').replace(/'/g, "\\'").replace(/"/g, '&quot;');

    var btnFotoM = r.foto_masuk ? ' <button type="button" onclick="openFotoModal(\'' + r.foto_masuk + '\', \'' + safeNamaGuru + '\', \'Masuk\', \'' + safeAlasanM + '\')" class="text-emerald-700 hover:text-emerald-900 ml-1 inline-block" title="Lihat Foto Masuk"><i data-lucide="image" class="w-3.5 h-3.5 inline"></i></button>' : '';
    var btnFotoP = r.foto_pulang ? ' <button type="button" onclick="openFotoModal(\'' + r.foto_pulang + '\', \'' + safeNamaGuru + '\', \'Pulang\', \'' + safeAlasanP + '\')" class="text-emerald-700 hover:text-emerald-900 ml-1 inline-block" title="Lihat Foto Pulang"><i data-lucide="image" class="w-3.5 h-3.5 inline"></i></button>' : '';

    var ketAlasanM = r.alasan_masuk ? '<span class="block text-[9px] text-amber-700 italic">Ket: ' + r.alasan_masuk + '</span>' : '';
    var ketAlasanP = r.alasan_pulang ? '<span class="block text-[9px] text-amber-700 italic">Ket: ' + r.alasan_pulang + '</span>' : '';

    var labelHariTgl = (r.hari ? '<span class="font-bold text-slate-800">' + r.hari + ',</span> ' : '') + r.tanggal;
    var tdTgl = '<td class="p-2 font-medium text-slate-700 whitespace-nowrap">' + labelHariTgl + '</td>';
    
    var tdM = '<td class="p-2"><span class="font-semibold">' + (r.jam_masuk || '--') + '</span>' + 
      (r.status_masuk ? ' <span class="text-[9px] px-1.5 py-0.2 rounded font-bold ' + badgeMClass + '">' + r.status_masuk + '</span>' : '') + btnFotoM + ketAlasanM + '</td>';
    var tdP = '<td class="p-2"><span class="font-semibold">' + (r.jam_pulang || '--') + '</span>' + 
      (r.status_pulang ? ' <span class="text-[9px] px-1.5 py-0.2 rounded font-bold ' + badgePClass + '">' + r.status_pulang + '</span>' : '') + btnFotoP + ketAlasanP + '</td>';
    
    tr.innerHTML = tdTgl + tdM + tdP;
    tbody.appendChild(tr);
  });

  document.getElementById('pageInfoGuru').innerText = 'Hal ' + pag.currentPage + ' dari ' + pag.totalPages;
  document.getElementById('btnPrevGuru').disabled = (pag.currentPage <= 1);
  document.getElementById('btnNextGuru').disabled = (pag.currentPage >= pag.totalPages);
  lucide.createIcons();
}

// Modal Presensi Kamera & Geofencing
function openAbsenModal(type) {
  var now = new Date();
  var dayOfWeek = now.getDay(); // 0 = Ahad/Minggu, 6 = Sabtu
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    showNotif('Hari Libur Sekolah', 'Presensi guru hanya aktif pada hari kerja (Senin s/d Jumat). Hari Sabtu dan Ahad adalah hari libur sekolah. Selamat berlibur!', false);
    return;
  }

  currentAbsenType = type;
  document.getElementById('modalTitle').innerText = 'Presensi ' + (type === 'MASUK' ? 'Masuk' : 'Pulang');
  
  currentLat = null;
  currentLong = null;
  currentDistanceMeters = null;
  gpsStatusValid = false;

  var alertBox = document.getElementById('gpsStatusAlert');
  if (alertBox) {
    alertBox.className = 'p-2.5 rounded-xl text-[11px] font-semibold flex items-center space-x-2 text-left border bg-slate-50 border-slate-200 text-slate-600';
    alertBox.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin text-slate-500 flex-shrink-0"></i><span>Mengukur jarak GPS Anda ke lokasi sekolah...</span>';
  }

  var txt = document.getElementById('gpsText');
  if (txt) txt.innerText = 'Mencari Koordinat GPS...';

  document.getElementById('modalAbsen').classList.remove('hidden');
  resetCameraUI();
  startCamera();

  // Kunci titik koordinat GPS seketika tanpa menunda tunggu jaringan
  getGPSLocation();
  evaluateAlasanBox(type);

  // Ambil pembaruan pengaturan dari server secara paralel
  API.getSettings().then(function(settings) {
    if (settings) {
      activeSchoolSettings = settings;
      evaluateAlasanBox(type);
      if (currentLat !== null && currentLong !== null) {
        evaluateGPSDistance();
      }
    }
  });
}

function evaluateAlasanBox(type) {
  var now = new Date();
  var nowHHMM = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  var boxAlasan = document.getElementById('boxAlasanKhusus');
  var lblAlasan = document.getElementById('lblAlasanKhusus');
  var txtAlasan = document.getElementById('txtAlasanKhusus');
  txtAlasan.value = '';

  if (type === 'MASUK') {
    var stdMasuk = activeSchoolSettings.JAM_MASUK_STD || '07:00';
    if (nowHHMM > stdMasuk) {
      boxAlasan.classList.remove('hidden');
      lblAlasan.innerText = 'Alasan Datang Terlambat:';
      txtAlasan.placeholder = 'Tuliskan alasan keterlambatan Anda (wajib diisi)...';
    } else {
      boxAlasan.classList.add('hidden');
    }
  } else {
    var stdPulang = activeSchoolSettings.JAM_PULANG_STD || '16:00';
    if (nowHHMM < stdPulang) {
      boxAlasan.classList.remove('hidden');
      lblAlasan.innerText = 'Alasan Pulang Lebih Awal:';
      txtAlasan.placeholder = 'Tuliskan alasan pulang lebih awal (wajib diisi)...';
    } else {
      boxAlasan.classList.add('hidden');
    }
  }
}

function updateSubmitButtonState() {
  var btn = document.getElementById('btnSubmitAbsen');
  if (btn) {
    btn.disabled = !(capturedPhotoBase64 && gpsStatusValid);
  }
}

function closeAbsenModal() {
  stopCamera();
  if (gpsWatchId) {
    try { navigator.geolocation.clearWatch(gpsWatchId); } catch (e) {}
    gpsWatchId = null;
  }
  document.getElementById('modalAbsen').classList.add('hidden');
}

function resetCameraUI() {
  capturedPhotoBase64 = '';
  document.getElementById('videoPreview').classList.remove('hidden');
  document.getElementById('imgCaptured').classList.add('hidden');
  var fallbackBox = document.getElementById('fallbackCamBox');
  if (fallbackBox) fallbackBox.classList.add('hidden');
  
  updateSubmitButtonState();
  document.getElementById('btnSnap').innerHTML = '<i data-lucide="camera" class="w-4 h-4 mr-1"></i><span>Ambil Foto</span>';
  lucide.createIcons();
}

function startCamera() {
  var video = document.getElementById('videoPreview');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showFallbackCameraUI();
    return;
  }

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
    .then(function(stream) {
      attachStreamToVideo(video, stream);
    })
    .catch(function(err) {
      console.warn('Kamera depan tidak merespons, beralih ke kamera default:', err);
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(function(stream) {
          attachStreamToVideo(video, stream);
        })
        .catch(function(err2) {
          console.warn('Aliran kamera terhalang/ditolak, mengaktifkan opsi kamera HP:', err2);
          showFallbackCameraUI();
        });
    });
}

function attachStreamToVideo(video, stream) {
  mediaStream = stream;
  video.srcObject = stream;
  var fallbackBox = document.getElementById('fallbackCamBox');
  if (fallbackBox) fallbackBox.classList.add('hidden');
  video.classList.remove('hidden');

  video.onloadedmetadata = function() {
    video.play().catch(function(e) {
      console.warn('Gagal memutar video otomatis:', e);
    });
  };
}

function showFallbackCameraUI() {
  var video = document.getElementById('videoPreview');
  var img = document.getElementById('imgCaptured');
  var fallbackBox = document.getElementById('fallbackCamBox');

  if (video) video.classList.add('hidden');
  if (img) img.classList.add('hidden');
  if (fallbackBox) fallbackBox.classList.remove('hidden');
  lucide.createIcons();
}

function triggerNativeCamera() {
  var inp = document.getElementById('inputNativeCam');
  if (inp) inp.click();
}

// BUBURKAN CAP WAKTU REAL-TIME PADA FOTO
function drawRealtimeTimestampOnCanvas(canvas, ctx) {
  var w = canvas.width;
  var h = canvas.height;
  
  var now = new Date();
  var days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  
  var dayName = days[now.getDay()];
  var dateStr = String(now.getDate()).padStart(2, '0') + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
  var timeStr = String(now.getHours()).padStart(2, '0') + ':' + 
                String(now.getMinutes()).padStart(2, '0') + ':' + 
                String(now.getSeconds()).padStart(2, '0') + ' WIB';
  
  var textTimestamp = dayName + ', ' + dateStr + ' • ' + timeStr;

  // Ukuran font adaptif sesuai resolusi kamera
  var fontSize = Math.max(11, Math.round(w * 0.035));
  ctx.font = 'bold ' + fontSize + 'px sans-serif';
  
  var textMetrics = ctx.measureText(textTimestamp);
  var paddingX = 12;
  var paddingY = 6;
  var boxW = textMetrics.width + (paddingX * 2) + 16;
  var boxH = fontSize + (paddingY * 2) + 4;
  var posX = 10;
  var posY = h - boxH - 12;

  // Latar belakang badge rounded hitam semi-transparan
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)'; // slate-900 / 75%
  
  var radius = 8;
  ctx.beginPath();
  ctx.moveTo(posX + radius, posY);
  ctx.lineTo(posX + boxW - radius, posY);
  ctx.quadraticCurveTo(posX + boxW, posY, posX + boxW, posY + radius);
  ctx.lineTo(posX + boxW, posY + boxH - radius);
  ctx.quadraticCurveTo(posX + boxW, posY + boxH, posX + boxW - radius, posY + boxH);
  ctx.lineTo(posX + radius, posY + boxH);
  ctx.quadraticCurveTo(posX, posY + boxH, posX, posY + boxH - radius);
  ctx.lineTo(posX, posY + radius);
  ctx.quadraticCurveTo(posX, posY, posX + radius, posY);
  ctx.closePath();
  ctx.fill();

  // Titik indikator waktu hijau hidup
  ctx.fillStyle = '#22c55e'; // green-500
  ctx.beginPath();
  var dotRadius = Math.max(3, Math.round(fontSize * 0.22));
  var dotX = posX + paddingX;
  var dotY = posY + (boxH / 2);
  ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
  ctx.fill();

  // Teks Tanggal & Jam Realtime
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(textTimestamp, dotX + dotRadius + 7, dotY);
  ctx.restore();
}

function handleNativeCameraFile(e) {
  var file = e.target.files && e.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function(evt) {
    var rawSrc = evt.target.result;
    var tempImg = new Image();
    tempImg.onload = function() {
      var canvas = document.getElementById('canvasSnap');
      canvas.width = tempImg.width || 400;
      canvas.height = tempImg.height || 400;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(tempImg, 0, 0, canvas.width, canvas.height);
      
      drawRealtimeTimestampOnCanvas(canvas, ctx);

      capturedPhotoBase64 = canvas.toDataURL('image/jpeg', 0.75);
      var img = document.getElementById('imgCaptured');
      var video = document.getElementById('videoPreview');
      var fallbackBox = document.getElementById('fallbackCamBox');

      img.src = capturedPhotoBase64;
      if (fallbackBox) fallbackBox.classList.add('hidden');
      if (video) video.classList.add('hidden');
      img.classList.remove('hidden');

      document.getElementById('btnSnap').innerHTML = '<i data-lucide="rotate-ccw" class="w-4 h-4 mr-1"></i><span>Foto Ulang</span>';
      updateSubmitButtonState();
      lucide.createIcons();
    };
    tempImg.src = rawSrc;
  };
  reader.readAsDataURL(file);
}

function stopCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(function(track) { track.stop(); });
    mediaStream = null;
  }
}

function takeSnapshot() {
  var video = document.getElementById('videoPreview');
  var canvas = document.getElementById('canvasSnap');
  var img = document.getElementById('imgCaptured');

  if (capturedPhotoBase64) {
    resetCameraUI();
    startCamera();
    return;
  }

  var fallbackBox = document.getElementById('fallbackCamBox');
  if (fallbackBox && !fallbackBox.classList.contains('hidden')) {
    triggerNativeCamera();
    return;
  }

  canvas.width = video.videoWidth || 300;
  canvas.height = video.videoHeight || 300;
  var ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // Cap waktu realtime langsung di atas foto
  drawRealtimeTimestampOnCanvas(canvas, ctx);

  capturedPhotoBase64 = canvas.toDataURL('image/jpeg', 0.75);
  img.src = capturedPhotoBase64;
  
  video.classList.add('hidden');
  img.classList.remove('hidden');

  document.getElementById('btnSnap').innerHTML = '<i data-lucide="rotate-ccw" class="w-4 h-4 mr-1"></i><span>Foto Ulang</span>';
  updateSubmitButtonState();
  lucide.createIcons();
}

function evaluateGPSDistance() {
  var txt = document.getElementById('gpsText');
  var badge = document.getElementById('gpsBadge');
  var alertBox = document.getElementById('gpsStatusAlert');
  if (currentLat === null || currentLong === null) return;

  var latSekolah = parseFloat(activeSchoolSettings.LAT_SEKOLAH || '-6.41022');
  var longSekolah = parseFloat(activeSchoolSettings.LONG_SEKOLAH || '106.82729');
  var maxRadius = parseFloat(activeSchoolSettings.MAX_RADIUS_METER || '350');

  currentDistanceMeters = hitungJarakMeter(latSekolah, longSekolah, currentLat, currentLong);
  var jarakBulat = Math.round(currentDistanceMeters);

  // Berikan toleransi akurasi GPS: jika ponsel memiliki margin error (misal di dalam ruangan)
  var accuracyTolerance = Math.min(Math.round((currentAccuracy || 0) * 0.5), 60);
  var effectiveRadius = maxRadius + accuracyTolerance;

  if (currentDistanceMeters <= effectiveRadius) {
    gpsStatusValid = true;
    if (txt) txt.innerText = jarakBulat + 'm dari sekolah (Valid)';
    if (badge) badge.className = 'absolute bottom-2 left-2 bg-emerald-700/90 backdrop-blur-md px-2.5 py-1 rounded-full text-[9px] text-white flex items-center space-x-1 border border-emerald-400/50 z-20';
    if (alertBox) {
      alertBox.className = 'p-2.5 rounded-xl text-[11px] font-semibold flex items-center space-x-2 text-left border bg-emerald-50 border-emerald-200 text-emerald-800';
      alertBox.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4 text-emerald-600 flex-shrink-0"></i><span>Lokasi Valid! Jarak Anda <b>' + jarakBulat + ' meter</b> dari sekolah (Batas maks: ' + Math.round(maxRadius) + 'm).</span>';
    }
  } else {
    gpsStatusValid = false;
    if (txt) txt.innerText = 'Di luar radius (' + jarakBulat + 'm)';
    if (badge) badge.className = 'absolute bottom-2 left-2 bg-rose-700/90 backdrop-blur-md px-2.5 py-1 rounded-full text-[9px] text-white flex items-center space-x-1 border border-rose-400/50 z-20';
    if (alertBox) {
      alertBox.className = 'p-2.5 rounded-xl text-[11px] font-semibold flex items-center justify-between text-left border bg-rose-50 border-rose-200 text-rose-800';
      alertBox.innerHTML = '<div class="flex items-center space-x-2"><i data-lucide="alert-triangle" class="w-4 h-4 text-rose-600 flex-shrink-0"></i><span><b>Di Luar Radius!</b> Jarak Anda <b>' + jarakBulat + 'm</b> (Maks ' + Math.round(maxRadius) + 'm).</span></div>' +
        '<button type="button" onclick="getGPSLocation()" class="ml-2 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[10px] flex-shrink-0 shadow-sm transition active:scale-95">Segarkan GPS</button>';
    }
  }
  if (window.lucide) lucide.createIcons();
  updateSubmitButtonState();
}

function getGPSLocation() {
  var txt = document.getElementById('gpsText');
  var badge = document.getElementById('gpsBadge');
  var alertBox = document.getElementById('gpsStatusAlert');

  if (gpsWatchId) {
    try { navigator.geolocation.clearWatch(gpsWatchId); } catch (e) {}
    gpsWatchId = null;
  }

  if (!navigator.geolocation) {
    currentLat = null;
    currentLong = null;
    gpsStatusValid = false;
    if (txt) txt.innerText = 'GPS Tidak Didukung';
    if (alertBox) {
      alertBox.className = 'p-2.5 rounded-xl text-[11px] font-semibold flex items-center space-x-2 text-left border bg-rose-50 border-rose-200 text-rose-800';
      alertBox.innerHTML = '<i data-lucide="alert-triangle" class="w-4 h-4 text-rose-600 flex-shrink-0"></i><span>Perangkat/browser ini tidak mendukung sensor lokasi GPS.</span>';
    }
    if (window.lucide) lucide.createIcons();
    updateSubmitButtonState();
    return;
  }

  if (txt) txt.innerText = 'Mengunci Posisi GPS...';
  if (badge) badge.className = 'absolute bottom-2 left-2 bg-slate-800/90 backdrop-blur-md px-2.5 py-1 rounded-full text-[9px] text-white flex items-center space-x-1 border border-slate-600 z-20';
  if (alertBox) {
    alertBox.className = 'p-2.5 rounded-xl text-[11px] font-semibold flex items-center space-x-2 text-left border bg-blue-50 border-blue-200 text-blue-800';
    alertBox.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin text-blue-600 flex-shrink-0"></i><span>Mengunci sinyal GPS & koordinat lokasi sekolah...</span>';
    alertBox.classList.remove('hidden');
  }
  if (window.lucide) lucide.createIcons();

  function onGpsSuccess(pos) {
    currentLat = parseFloat(pos.coords.latitude.toFixed(6));
    currentLong = parseFloat(pos.coords.longitude.toFixed(6));
    currentAccuracy = pos.coords.accuracy || 0;
    evaluateGPSDistance();
  }

  // Tahap 1: Coba ambil lokasi akurasi tinggi (izinkan cache 60 detik agar instan jika Google Maps baru dibuka)
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      onGpsSuccess(pos);
      startGpsWatcher();
    },
    function(err) {
      // Jika izin lokasi ditolak secara tegas oleh user/OS
      if (err.code === 1) { // PERMISSION_DENIED
        currentLat = null;
        currentLong = null;
        gpsStatusValid = false;
        if (txt) txt.innerText = 'Izin Lokasi Ditolak';
        if (badge) badge.className = 'absolute bottom-2 left-2 bg-rose-700/90 backdrop-blur-md px-2.5 py-1 rounded-full text-[9px] text-white flex items-center space-x-1 border border-rose-400/50 z-20';
        if (alertBox) {
          alertBox.className = 'p-2.5 rounded-xl text-[11px] font-semibold flex items-center justify-between text-left border bg-rose-50 border-rose-200 text-rose-800';
          alertBox.innerHTML = '<div class="flex items-center space-x-2"><i data-lucide="map-pin-off" class="w-4 h-4 text-rose-600 flex-shrink-0"></i><span><b>Izin Lokasi Ditolak!</b> Aktifkan izin lokasi di info aplikasi HP.</span></div>' +
            '<button type="button" onclick="getGPSLocation()" class="ml-2 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[10px] flex-shrink-0 shadow-sm transition active:scale-95">Coba Lagi</button>';
        }
        if (window.lucide) lucide.createIcons();
        updateSubmitButtonState();
        return;
      }

      // Tahap 2: Jika timeout atau satelit terhalang di dalam ruangan, otomatis fallback ke Jaringan / WiFi / Seluler
      if (alertBox) {
        alertBox.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin text-amber-600 flex-shrink-0"></i><span>Satelit GPS terhalang, mengalihkan ke sinyal lokasi jaringan/WiFi...</span>';
        if (window.lucide) lucide.createIcons();
      }

      navigator.geolocation.getCurrentPosition(
        function(pos) {
          onGpsSuccess(pos);
          startGpsWatcher();
        },
        function(fallbackErr) {
          currentLat = null;
          currentLong = null;
          gpsStatusValid = false;
          if (txt) txt.innerText = 'Sinyal GPS Lemah';
          if (badge) badge.className = 'absolute bottom-2 left-2 bg-amber-700/90 backdrop-blur-md px-2.5 py-1 rounded-full text-[9px] text-white flex items-center space-x-1 border border-amber-400/50 z-20';
          if (alertBox) {
            alertBox.className = 'p-2.5 rounded-xl text-[11px] font-semibold flex items-center justify-between text-left border bg-amber-50 border-amber-200 text-amber-800';
            alertBox.innerHTML = '<div class="flex items-center space-x-2"><i data-lucide="alert-circle" class="w-4 h-4 text-amber-600 flex-shrink-0"></i><span><b>Sinyal GPS Lemah!</b> Coba buka Google Maps sebentar lalu klik tombol Ulangi.</span></div>' +
              '<button type="button" onclick="getGPSLocation()" class="ml-2 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[10px] flex-shrink-0 shadow-sm transition active:scale-95">Ulangi GPS</button>';
          }
          if (window.lucide) lucide.createIcons();
          updateSubmitButtonState();
          startGpsWatcher();
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 }
      );
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
  );
}

function startGpsWatcher() {
  if (gpsWatchId || !navigator.geolocation) return;
  try {
    gpsWatchId = navigator.geolocation.watchPosition(
      function(pos) {
        currentLat = parseFloat(pos.coords.latitude.toFixed(6));
        currentLong = parseFloat(pos.coords.longitude.toFixed(6));
        currentAccuracy = pos.coords.accuracy || 0;
        evaluateGPSDistance();
      },
      function() {},
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
    );
  } catch (e) {}
}

function submitAbsen() {
  if (!capturedPhotoBase64) {
    showNotif('Foto Wajib Diambil', 'Silakan ambil foto selfie Anda terlebih dahulu.', false);
    return;
  }

  if (currentLat === null || currentLong === null) {
    showNotif('GPS Wajib Aktif', 'Koordinat lokasi GPS belum terdeteksi. Pastikan GPS aktif dan diizinkan.', false);
    return;
  }

  if (!gpsStatusValid) {
    var maxRadius = parseFloat(activeSchoolSettings.MAX_RADIUS_METER || '300');
    showNotif('Di Luar Jangkauan Radius', 'Jarak Anda ' + Math.round(currentDistanceMeters || 0) + ' meter dari sekolah (batas maksimal ' + Math.round(maxRadius) + ' meter). Presensi tidak dapat dikirim.', false);
    return;
  }

  var alasanInput = document.getElementById('txtAlasanKhusus') ? document.getElementById('txtAlasanKhusus').value.trim() : '';
  var boxAlasan = document.getElementById('boxAlasanKhusus');
  
  if (boxAlasan && !boxAlasan.classList.contains('hidden') && !alasanInput) {
    showNotif('Alasan Wajib Diisi', 'Mohon isi kolom alasan sebelum mengirimkan presensi.', false);
    return;
  }

  var btn = document.getElementById('btnSubmitAbsen');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" class="w-4 h-4 animate-spin"></i><span>Mengirim...</span>';
    if (window.lucide) lucide.createIcons();
  }

  var payload = {
    userId: currentUser.id_user,
    userNama: currentUser.nama_guru,
    lat: currentLat,
    long: currentLong,
    foto: capturedPhotoBase64,
    alasan: alasanInput
  };

  API.simpanAbsen(currentAbsenType, payload).then(function(res) {
    if (btn) {
      btn.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4"></i><span>Kirim Presensi</span>';
      if (window.lucide) lucide.createIcons();
    }
    closeAbsenModal();
    if (res.success) {
      showNotif('Presensi Berhasil', res.message, true);
    } else {
      showNotif('Presensi Ditolak', res.message, false);
    }
    loadGuruDashboard();
  });
}

// Modul Perizinan
function openIzinModal() {
  document.getElementById('modalIzin').classList.remove('hidden');
}

function closeIzinModal() {
  document.getElementById('modalIzin').classList.add('hidden');
}

function submitIzinGuru(e) {
  e.preventDefault();
  var jenis = document.getElementById('izinJenis').value;
  var tglMulai = document.getElementById('izinTglMulai').value;
  var tglSelesai = document.getElementById('izinTglSelesai').value;
  var alasan = document.getElementById('izinAlasan').value.trim();

  var payload = {
    userId: currentUser.id_user,
    userNama: currentUser.nama_guru,
    jenisIzin: jenis,
    tglMulai: tglMulai,
    tglSelesai: tglSelesai,
    alasan: alasan
  };

  closeIzinModal();

  API.simpanPengajuanIzin(payload).then(function(res) {
    if (res.success) {
      showNotif('Pengajuan Terkirim', res.message, true);
      loadIzinGuru();
    } else {
      showNotif('Gagal Mengajukan', res.message, false);
    }
  });
}

function loadIzinGuru() {
  var box = document.getElementById('listIzinGuru');
  if (!box || !currentUser) return;

  API.getRiwayatIzinGuru(currentUser.id_user).then(function(res) {
    if (res.success) {
      renderIzinGuru(res.data);
    }
  });
}

function renderIzinGuru(list) {
  var box = document.getElementById('listIzinGuru');
  box.innerHTML = '';

  if (!list || list.length === 0) {
    box.innerHTML = '<p class="text-center text-xs text-slate-400 py-3">Belum ada pengajuan izin.</p>';
    return;
  }

  list.forEach(function(item) {
    var badgeClass = 'bg-amber-100 text-amber-800';
    if (item.status === 'APPROVED') badgeClass = 'bg-emerald-100 text-emerald-800';
    if (item.status === 'REJECTED') badgeClass = 'bg-rose-100 text-rose-800';

    var card = document.createElement('div');
    card.className = 'p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1 text-xs';
    
    var top = '<div class="flex items-center justify-between"><span class="font-bold text-slate-800">' + item.jenis_izin + ' (' + item.tgl_mulai + ' s/d ' + item.tgl_selesai + ')</span><span class="text-[9px] px-2 py-0.5 rounded-full font-bold ' + badgeClass + '">' + item.status + '</span></div>';
    var desc = '<p class="text-slate-500 text-[11px]">' + item.alasan + '</p>';
    var note = item.catatan_admin ? '<p class="text-emerald-700 text-[10px] italic">Catatan Admin: ' + item.catatan_admin + '</p>' : '';

    card.innerHTML = top + desc + note;
    box.appendChild(card);
  });
}

