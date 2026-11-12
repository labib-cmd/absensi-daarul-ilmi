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
var gpsStatusValid = false;
var activeSchoolSettings = {
  LAT_SEKOLAH: '-6.3982',
  LONG_SEKOLAH: '106.8271',
  MAX_RADIUS_METER: '300',
  JAM_MASUK_STD: '07:00',
  JAM_PULANG_STD: '16:00'
};
var stateGuru = { page: 1, limit: 5, search: '' };

function loadGuruDashboard() {
  loadTodayStatusGuru();
  loadRiwayatGuru();
  loadIzinGuru();
}

function loadTodayStatusGuru() {
  if (!currentUser) return;
  API.getTodayStatus(currentUser.id_user).then(function(res) {
    if (res.success && res.hasAbsen) {
      renderTodayCardGuru(res.data);
    } else {
      renderTodayCardGuru(null);
    }
  });
}

function renderTodayCardGuru(data) {
  var elJamM = document.getElementById('guruJamMasuk');
  var elStatM = document.getElementById('guruStatusMasuk');
  var elJamP = document.getElementById('guruJamPulang');
  var elStatP = document.getElementById('guruStatusPulang');
  var btnM = document.getElementById('btnAbsenMasuk');
  var btnP = document.getElementById('btnAbsenPulang');

  if (data && data.jam_masuk) {
    elJamM.innerText = data.jam_masuk;
    elStatM.innerText = data.status_masuk;
    elStatM.className = data.status_masuk === 'Tepat Waktu' ? 
      'inline-block text-[9px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700' :
      'inline-block text-[9px] px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-700';
    btnM.disabled = true;
  } else {
    elJamM.innerText = '--:--';
    elStatM.innerText = 'Belum';
    elStatM.className = 'inline-block text-[9px] px-2 py-0.5 rounded-full font-bold bg-slate-200 text-slate-600';
    btnM.disabled = false;
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
    elStatP.innerText = 'Belum';
    elStatP.className = 'inline-block text-[9px] px-2 py-0.5 rounded-full font-bold bg-slate-200 text-slate-600';
    btnP.disabled = !(data && data.jam_masuk);
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

    var btnFotoM = r.foto_masuk ? ' <button type="button" onclick="openFotoModal(\'' + r.foto_masuk + '\', \'' + (currentUser ? currentUser.nama_guru : 'Guru') + '\', \'Masuk\')" class="text-emerald-700 hover:text-emerald-900 ml-1 inline-block" title="Lihat Foto Masuk"><i data-lucide="image" class="w-3.5 h-3.5 inline"></i></button>' : '';
    var btnFotoP = r.foto_pulang ? ' <button type="button" onclick="openFotoModal(\'' + r.foto_pulang + '\', \'' + (currentUser ? currentUser.nama_guru : 'Guru') + '\', \'Pulang\')" class="text-emerald-700 hover:text-emerald-900 ml-1 inline-block" title="Lihat Foto Pulang"><i data-lucide="image" class="w-3.5 h-3.5 inline"></i></button>' : '';

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

  API.getSettings().then(function(settings) {
    activeSchoolSettings = settings || activeSchoolSettings;
    evaluateAlasanBox(type);
    getGPSLocation();
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

function handleNativeCameraFile(e) {
  var file = e.target.files && e.target.files[0];
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function(evt) {
    capturedPhotoBase64 = evt.target.result;
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
  
  capturedPhotoBase64 = canvas.toDataURL('image/jpeg', 0.7);
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

  var latSekolah = parseFloat(activeSchoolSettings.LAT_SEKOLAH || '-6.3982');
  var longSekolah = parseFloat(activeSchoolSettings.LONG_SEKOLAH || '106.8271');
  var maxRadius = parseFloat(activeSchoolSettings.MAX_RADIUS_METER || '300');

  currentDistanceMeters = hitungJarakMeter(latSekolah, longSekolah, currentLat, currentLong);
  var jarakBulat = Math.round(currentDistanceMeters);

  if (currentDistanceMeters <= maxRadius) {
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
      alertBox.className = 'p-2.5 rounded-xl text-[11px] font-semibold flex items-center space-x-2 text-left border bg-rose-50 border-rose-200 text-rose-800';
      alertBox.innerHTML = '<i data-lucide="alert-triangle" class="w-4 h-4 text-rose-600 flex-shrink-0"></i><span><b>Di Luar Radius!</b> Jarak Anda <b>' + jarakBulat + ' meter</b> (Maksimal ' + Math.round(maxRadius) + 'm). Absen ditolak.</span>';
    }
  }
  if (window.lucide) lucide.createIcons();
  updateSubmitButtonState();
}

function getGPSLocation() {
  var txt = document.getElementById('gpsText');
  var badge = document.getElementById('gpsBadge');
  var alertBox = document.getElementById('gpsStatusAlert');

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        currentLat = parseFloat(pos.coords.latitude.toFixed(6));
        currentLong = parseFloat(pos.coords.longitude.toFixed(6));
        evaluateGPSDistance();
      },
      function(err) {
        currentLat = null;
        currentLong = null;
        gpsStatusValid = false;
        if (txt) txt.innerText = 'GPS Tidak Aktif / Ditolak';
        if (badge) badge.className = 'absolute bottom-2 left-2 bg-rose-700/90 backdrop-blur-md px-2.5 py-1 rounded-full text-[9px] text-white flex items-center space-x-1 border border-rose-400/50 z-20';
        if (alertBox) {
          alertBox.className = 'p-2.5 rounded-xl text-[11px] font-semibold flex items-center space-x-2 text-left border bg-rose-50 border-rose-200 text-rose-800';
          alertBox.innerHTML = '<i data-lucide="map-pin-off" class="w-4 h-4 text-rose-600 flex-shrink-0"></i><span><b>GPS Wajib Aktif!</b> Izinkan akses lokasi pada browser/HP Anda untuk bisa melakukan presensi.</span>';
        }
        if (window.lucide) lucide.createIcons();
        updateSubmitButtonState();
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  } else {
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
  }
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

