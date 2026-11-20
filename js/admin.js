/**
 * ====================================================================
 * ADMIN.JS - Dashboard Monitoring Realtime, Approval & Pengaturan
 * ====================================================================
 */

var stateAdmin = {
  page: 1,
  limit: 10,
  search: '',
  range: 'bulanan',
  tab: 'monitoring',
  rekapViewMode: 'log',
  filterMonitoring: 'ALL',
  filterGuru: 'ALL'
};

var cachedRealtimeMonitoring = [];
var cachedGuruList = [];
var cachedRekapData = [];
var cachedIzinList = [];
var activeApprovalId = null;
var activeEditGuru = null;

var adminNotifiedIzinIds = JSON.parse(sessionStorage.getItem('daarulilmi_session_notified_izin') || '[]');
var isAdminWatcherInitialized = false;

function initAdminIzinWatcher() {
  if (isAdminWatcherInitialized) return;
  isAdminWatcherInitialized = true;

  // Segera periksa izin pending saat admin pertama kali membuka halaman
  checkIncomingIzinAdmin();

  // Polling rutin pemantau izin masuk tiap 8 detik
  if (!window.adminIzinPollInterval) {
    window.adminIzinPollInterval = setInterval(checkIncomingIzinAdmin, 8000);
  }

  // Polling pembaruan data monitoring presensi tiap 20 detik
  if (!window.adminMonitoringInterval) {
    window.adminMonitoringInterval = setInterval(function() {
      if (currentUser && currentUser.role !== 'Guru' && stateAdmin.tab === 'monitoring') {
        loadAdminData();
      }
    }, 20000);
  }

  // Supabase Realtime Listener (aktif instan jika Supabase Realtime replication ON)
  var sb = typeof getSupabase === 'function' ? getSupabase() : null;
  if (sb && !window.adminSupabaseChannel) {
    try {
      window.adminSupabaseChannel = sb.channel('admin-dashboard-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'perizinan' }, function() {
          checkIncomingIzinAdmin();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'absensi' }, function() {
          if (currentUser && currentUser.role !== 'Guru' && stateAdmin.tab === 'monitoring') {
            loadAdminData();
          }
        })
        .subscribe();
    } catch (e) {}
  }
}

function checkIncomingIzinAdmin() {
  API.getDaftarIzinAdmin().then(function(res) {
    var items = (res && res.data) ? res.data : [];
    var pendingItems = items.filter(function(it) { return it && it.status === 'PENDING'; });
    
    // Perbarui badge merah & banner atas
    updateBadgePendingIzin(items);

    // Filter izin pending yang belum pernah diberitahukan di sesi browser ini
    var newPending = pendingItems.filter(function(it) {
      return adminNotifiedIzinIds.indexOf(it.id_izin) === -1;
    });

    if (newPending.length > 0) {
      newPending.forEach(function(item) {
        adminNotifiedIzinIds.push(item.id_izin);
        
        // Pemicu notifikasi sistem (Pop-up HP/Desktop + Bel Suara)
        if (typeof triggerSystemNotification === 'function') {
          triggerSystemNotification('🔔 Pengajuan Izin Baru!', {
            body: item.nama_guru + ' mengajukan ' + item.jenis_izin + ': ' + (item.alasan || '-'),
            icon: 'img/logo.jpg',
            tag: item.id_izin,
            data: { action: 'open_izin', url: './index.html' }
          });
        }
        showNotif('Pengajuan Izin Masuk', item.nama_guru + ' mengajukan ' + item.jenis_izin + ' (' + (item.alasan || '-') + '). Silakan tinjau di tab Approval Izin.', true);
      });

      sessionStorage.setItem('daarulilmi_session_notified_izin', JSON.stringify(adminNotifiedIzinIds.slice(-50)));

      // Jika admin sedang di tab izin, perbarui daftar tampilan seketika
      if (stateAdmin.tab === 'izin') {
        renderApprovalIzinAdmin(items);
      }
    }
  });
}

function switchAdminTab(tab) {
  stateAdmin.tab = tab;
  localStorage.setItem('daarulilmi_last_tab', tab);
  
  var btnM = document.getElementById('tabMonitoringBtn');
  var btnR = document.getElementById('tabRekapBtn');
  var btnI = document.getElementById('tabIzinBtn');
  var btnS = document.getElementById('tabSettingsBtn');

  var panM = document.getElementById('panelMonitoring');
  var panR = document.getElementById('panelRekap');
  var panI = document.getElementById('panelIzin');
  var panS = document.getElementById('panelSettings');

  var baseClass = 'pb-2 border-b-2 px-2 font-bold inline-flex items-center space-x-1.5 transition-all ';
  if (btnM) btnM.className = baseClass + (tab === 'monitoring' ? 'border-emerald-700 text-emerald-700' : 'border-transparent text-slate-500');
  if (btnR) btnR.className = baseClass + (tab === 'rekap' ? 'border-emerald-700 text-emerald-700' : 'border-transparent text-slate-500');
  if (btnI) btnI.className = baseClass + (tab === 'izin' ? 'border-emerald-700 text-emerald-700' : 'border-transparent text-slate-500');
  if (btnS) btnS.className = baseClass + (tab === 'settings' ? 'border-emerald-700 text-emerald-700' : 'border-transparent text-slate-500');

  panM.classList.add('hidden');
  panR.classList.add('hidden');
  panI.classList.add('hidden');
  panS.classList.add('hidden');

  if (tab === 'monitoring') {
    panM.classList.remove('hidden');
  } else if (tab === 'rekap') {
    panR.classList.remove('hidden');
  } else if (tab === 'izin') {
    panI.classList.remove('hidden');
    loadDaftarIzinAdmin();
  } else if (tab === 'settings') {
    panS.classList.remove('hidden');
  }
}

function switchRekapViewMode(mode) {
  stateAdmin.rekapViewMode = mode;
  var btnLog = document.getElementById('btnSubTabLog');
  var btnPersen = document.getElementById('btnSubTabPersen');
  var boxLog = document.getElementById('containerRekapLog');
  var boxPersen = document.getElementById('containerRekapPersen');

  if (mode === 'persen') {
    if (btnPersen) btnPersen.className = 'px-2.5 py-1 rounded-lg bg-white text-slate-800 shadow-xs transition cursor-pointer';
    if (btnLog) btnLog.className = 'px-2.5 py-1 rounded-lg text-slate-500 hover:text-slate-800 transition cursor-pointer';
    if (boxPersen) boxPersen.classList.remove('hidden');
    if (boxLog) boxLog.classList.add('hidden');
  } else {
    if (btnLog) btnLog.className = 'px-2.5 py-1 rounded-lg bg-white text-slate-800 shadow-xs transition cursor-pointer';
    if (btnPersen) btnPersen.className = 'px-2.5 py-1 rounded-lg text-slate-500 hover:text-slate-800 transition cursor-pointer';
    if (boxLog) boxLog.classList.remove('hidden');
    if (boxPersen) boxPersen.classList.add('hidden');
  }
  if (window.lucide) lucide.createIcons();
}

function debounceLoadAdminData() {
  clearTimeout(window.timerDebounce);
  window.timerDebounce = setTimeout(function() {
    stateAdmin.page = 1;
    stateAdmin.search = document.getElementById('searchAdminRekap').value;
    loadAdminData();
  }, 300);
}

function changePageAdmin(delta) {
  stateAdmin.page += delta;
  loadAdminData();
}

function loadAdminData() {
  var elRange = document.getElementById('filterRange');
  var elGuru = document.getElementById('filterGuru');
  if (elRange) stateAdmin.range = elRange.value;
  if (elGuru) stateAdmin.filterGuru = elGuru.value;

  updateBadgePendingIzin();
  initAdminIzinWatcher();

  API.getAdminDashboardData(stateAdmin.range, stateAdmin.search, stateAdmin.page, stateAdmin.limit, stateAdmin.filterGuru)
    .then(function(res) {
      if (res.success) {
        renderAdminDashboard(res);
      }
    });
}

function filterMonitoringRealtime(filterType) {
  stateAdmin.filterMonitoring = filterType;

  if (stateAdmin.tab !== 'monitoring') {
    switchAdminTab('monitoring');
  }

  var btnAll = document.getElementById('btnStatAll');
  var btnDatang = document.getElementById('btnStatDatang');
  var btnPulang = document.getElementById('btnStatPulang');
  var btnBelum = document.getElementById('btnStatBelum');

  if (btnAll) btnAll.className = 'p-2.5 bg-emerald-50 hover:bg-emerald-100/80 rounded-xl border border-emerald-100 transition flex flex-col items-center justify-center cursor-pointer active:scale-95';
  if (btnDatang) btnDatang.className = 'p-2.5 bg-blue-50 hover:bg-blue-100/80 rounded-xl border border-blue-100 transition flex flex-col items-center justify-center cursor-pointer active:scale-95';
  if (btnPulang) btnPulang.className = 'p-2.5 bg-amber-50 hover:bg-amber-100/80 rounded-xl border border-amber-100 transition flex flex-col items-center justify-center cursor-pointer active:scale-95';
  if (btnBelum) btnBelum.className = 'p-2.5 bg-rose-50 hover:bg-rose-100/80 rounded-xl border border-rose-100 transition flex flex-col items-center justify-center cursor-pointer active:scale-95';

  if (filterType === 'ALL' && btnAll) {
    btnAll.className = 'p-2.5 bg-emerald-50 hover:bg-emerald-100/80 rounded-xl border border-emerald-300 ring-2 ring-emerald-500/40 transition flex flex-col items-center justify-center cursor-pointer active:scale-95';
  } else if (filterType === 'DATANG' && btnDatang) {
    btnDatang.className = 'p-2.5 bg-blue-50 hover:bg-blue-100/80 rounded-xl border border-blue-300 ring-2 ring-blue-500/40 transition flex flex-col items-center justify-center cursor-pointer active:scale-95';
  } else if (filterType === 'PULANG' && btnPulang) {
    btnPulang.className = 'p-2.5 bg-amber-50 hover:bg-amber-100/80 rounded-xl border border-amber-300 ring-2 ring-amber-500/40 transition flex flex-col items-center justify-center cursor-pointer active:scale-95';
  } else if (filterType === 'BELUM' && btnBelum) {
    btnBelum.className = 'p-2.5 bg-rose-50 hover:bg-rose-100/80 rounded-xl border border-rose-300 ring-2 ring-rose-500/40 transition flex flex-col items-center justify-center cursor-pointer active:scale-95';
  }

  renderRealtimeMonitoringList();
}

function renderRealtimeMonitoringList() {
  var listM = document.getElementById('listRealtimeGuru');
  if (!listM) return;
  listM.innerHTML = '';

  var filtered = cachedRealtimeMonitoring.filter(function(g) {
    var hasMasuk = g.detail && g.detail.jam_masuk;
    var hasPulang = g.detail && g.detail.jam_pulang;

    if (stateAdmin.filterMonitoring === 'DATANG') {
      return Boolean(hasMasuk);
    } else if (stateAdmin.filterMonitoring === 'PULANG') {
      return Boolean(hasPulang);
    } else if (stateAdmin.filterMonitoring === 'BELUM') {
      return !hasMasuk;
    }
    return true;
  });

  if (filtered.length === 0) {
    listM.innerHTML = '<p class="text-center text-xs text-slate-400 py-4">Tidak ada data guru untuk kategori ini.</p>';
    return;
  }

  filtered.forEach(function(g) {
    var card = document.createElement('div');
    card.className = 'p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-2.5 text-xs';
    
    var hasMasuk = g.detail && g.detail.jam_masuk;
    var hasPulang = g.detail && g.detail.jam_pulang;

    var badgeClass = 'bg-rose-100 text-rose-800';
    var badgeText = 'Belum Absen';

    if (hasPulang) {
      badgeClass = 'bg-amber-100 text-amber-800';
      badgeText = 'Sudah Absen Pulang';
    } else if (hasMasuk) {
      badgeClass = 'bg-blue-100 text-blue-800';
      badgeText = 'Sudah Absen Datang';
    }

    // KOLOM KIRI (DATANG)
    var boxDatangHtml = '';
    if (hasMasuk) {
      var statMasuk = g.detail.status_masuk || (g.detail.jam_masuk.slice(0, 5) > '07:00' ? 'Terlambat' : 'Tepat Waktu');
      var colorStatMasuk = statMasuk === 'Tepat Waktu' 
        ? 'text-emerald-700 bg-emerald-100/70 border-emerald-200' 
        : 'text-rose-700 bg-rose-100/70 border-rose-200';
      var safeAlasanM = (g.detail.alasan_masuk || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      var safeNamaGuru = (g.nama_guru || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      var fotoMBtn = g.detail.foto_masuk 
        ? '<button type="button" onclick="openFotoModal(\'' + g.detail.foto_masuk + '\', \'' + safeNamaGuru + '\', \'Datang\', \'' + safeAlasanM + '\')" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[9px] font-bold flex items-center justify-center space-x-1 mt-1.5 transition"><i data-lucide="image" class="w-3 h-3"></i><span>Lihat Foto</span></button>' 
        : '';
      var alasanMText = g.detail.alasan_masuk ? '<span class="text-[9px] text-amber-700 italic block mt-1 leading-tight">Ket: ' + g.detail.alasan_masuk + '</span>' : '';

      boxDatangHtml = '<div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">' +
        '<div>' +
          '<div class="flex items-center justify-between flex-wrap gap-1">' +
            '<span class="text-[9px] font-bold uppercase tracking-wider text-slate-500">Datang</span>' +
            '<span class="inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-bold border ' + colorStatMasuk + '">' + statMasuk + '</span>' +
          '</div>' +
          '<p class="text-xs sm:text-sm font-extrabold text-slate-800 mt-1">' + g.detail.jam_masuk + '</p>' +
          alasanMText +
        '</div>' +
        fotoMBtn +
      '</div>';
    } else {
      boxDatangHtml = '<div class="p-2.5 rounded-xl bg-slate-50/60 border border-slate-100 flex flex-col justify-between">' +
        '<div>' +
          '<div class="flex items-center justify-between">' +
            '<span class="text-[9px] font-bold uppercase tracking-wider text-slate-400">Datang</span>' +
            '<span class="text-[8px] px-1.5 py-0.2 rounded font-bold bg-slate-200 text-slate-500">Belum</span>' +
          '</div>' +
          '<p class="text-xs sm:text-sm font-extrabold text-slate-400 mt-1">--:--</p>' +
        '</div>' +
      '</div>';
    }

    // KOLOM KANAN (PULANG)
    var boxPulangHtml = '';
    if (hasPulang) {
      var statPulang = g.detail.status_pulang || (g.detail.jam_pulang.slice(0, 5) < '16:00' ? 'Pulang Terlalu Cepat' : 'Tepat Waktu');
      var colorStatPulang = statPulang === 'Tepat Waktu' 
        ? 'text-emerald-700 bg-emerald-100/70 border-emerald-200' 
        : 'text-amber-700 bg-amber-100/70 border-amber-200';
      var safeAlasanP = (g.detail.alasan_pulang || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      var safeNamaGuruP = (g.nama_guru || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      var fotoPBtn = g.detail.foto_pulang 
        ? '<button type="button" onclick="openFotoModal(\'' + g.detail.foto_pulang + '\', \'' + safeNamaGuruP + '\', \'Pulang\', \'' + safeAlasanP + '\')" class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[9px] font-bold flex items-center justify-center space-x-1 mt-1.5 transition"><i data-lucide="image" class="w-3 h-3"></i><span>Lihat Foto</span></button>' 
        : '';
      var alasanPText = g.detail.alasan_pulang ? '<span class="text-[9px] text-amber-700 italic block mt-1 leading-tight">Ket: ' + g.detail.alasan_pulang + '</span>' : '';

      boxPulangHtml = '<div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">' +
        '<div>' +
          '<div class="flex items-center justify-between flex-wrap gap-1">' +
            '<span class="text-[9px] font-bold uppercase tracking-wider text-slate-500">Pulang</span>' +
            '<span class="inline-flex items-center px-1.5 py-0.2 rounded text-[8px] font-bold border ' + colorStatPulang + '">' + statPulang + '</span>' +
          '</div>' +
          '<p class="text-xs sm:text-sm font-extrabold text-slate-800 mt-1">' + g.detail.jam_pulang + '</p>' +
          alasanPText +
        '</div>' +
        fotoPBtn +
      '</div>';
    } else {
      boxPulangHtml = '<div class="p-2.5 rounded-xl bg-slate-50/60 border border-slate-100 flex flex-col justify-between">' +
        '<div>' +
          '<div class="flex items-center justify-between">' +
            '<span class="text-[9px] font-bold uppercase tracking-wider text-slate-400">Pulang</span>' +
            '<span class="text-[8px] px-1.5 py-0.2 rounded font-bold bg-slate-200 text-slate-500">Belum</span>' +
          '</div>' +
          '<p class="text-xs sm:text-sm font-extrabold text-slate-400 mt-1">--:--</p>' +
        '</div>' +
      '</div>';
    }

    var headerRow = '<div class="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">' +
      '<div class="flex items-start space-x-2.5 min-w-0 flex-1">' +
        '<div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5 shadow-sm">' +
          (g.nama_guru ? g.nama_guru.charAt(0).toUpperCase() : 'G') +
        '</div>' +
        '<div class="min-w-0 flex-1">' +
          '<p class="font-bold text-slate-800 text-xs sm:text-sm leading-snug break-words">' + g.nama_guru + '</p>' +
          '<span class="inline-block mt-1 text-[9px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap ' + badgeClass + '">' + badgeText + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="flex-shrink-0 pt-0.5">' +
        '<button type="button" onclick="openEditJamGuruModal(\'' + g.id_user + '\')" title="Edit Jam Guru" class="px-2 py-1 rounded-lg bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 transition flex items-center space-x-1 shadow-sm cursor-pointer active:scale-95">' +
          '<i data-lucide="edit-3" class="w-3 h-3"></i>' +
          '<span class="text-[9px] font-bold">Edit Jam</span>' +
        '</button>' +
      '</div>' +
    '</div>';

    var gridColumns = '<div class="grid grid-cols-2 gap-2">' +
      boxDatangHtml +
      boxPulangHtml +
    '</div>';

    card.innerHTML = headerRow + gridColumns;
    listM.appendChild(card);
  });

  lucide.createIcons();
}

function openEditJamGuruModal(idUser) {
  var found = cachedRealtimeMonitoring.find(function(g) { return g.id_user === idUser; });
  if (!found) return;

  activeEditGuru = found;
  document.getElementById('editJamNamaGuru').innerText = found.nama_guru;
  document.getElementById('editInputJamMasuk').value = (found.detail && found.detail.jam_masuk) ? found.detail.jam_masuk : '';
  document.getElementById('editInputJamPulang').value = (found.detail && found.detail.jam_pulang) ? found.detail.jam_pulang : '';
  document.getElementById('modalEditJamGuru').classList.remove('hidden');
  lucide.createIcons();
}

function closeEditJamGuruModal() {
  activeEditGuru = null;
  document.getElementById('modalEditJamGuru').classList.add('hidden');
}

function submitEditJamGuru(e) {
  e.preventDefault();
  if (!activeEditGuru) return;

  var jamMasuk = document.getElementById('editInputJamMasuk').value.trim();
  var jamPulang = document.getElementById('editInputJamPulang').value.trim();

  var payload = {
    userId: activeEditGuru.id_user,
    namaGuru: activeEditGuru.nama_guru,
    jamMasuk: jamMasuk,
    jamPulang: jamPulang
  };

  closeEditJamGuruModal();

  API.simpanEditJamGuru(payload).then(function(res) {
    if (res.success) {
      showNotif('Berhasil Diperbarui', res.message, true);
      loadAdminData();
    } else {
      showNotif('Gagal Memperbarui', res.message, false);
    }
  });
}

function parseTanggalPresensi(tglStr) {
  if (!tglStr) return null;
  if (tglStr instanceof Date) {
    return new Date(tglStr.getFullYear(), tglStr.getMonth(), tglStr.getDate(), 0, 0, 0, 0);
  }
  var str = String(tglStr).trim();
  if (str.indexOf('/') !== -1) {
    var p = str.split('/');
    if (p.length === 3) {
      var d = parseInt(p[0], 10);
      var m = parseInt(p[1], 10) - 1;
      var y = parseInt(p[2], 10);
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m, d, 0, 0, 0, 0);
    }
  }
  if (str.indexOf('-') !== -1) {
    var p2 = str.split('-');
    if (p2.length === 3) {
      var y2 = parseInt(p2[0], 10);
      var m2 = parseInt(p2[1], 10) - 1;
      var d2 = parseInt(p2[2], 10);
      if (!isNaN(d2) && !isNaN(m2) && !isNaN(y2)) return new Date(y2, m2, d2, 0, 0, 0, 0);
    }
  }
  var dObj = new Date(str);
  return isNaN(dObj.getTime()) ? null : new Date(dObj.getFullYear(), dObj.getMonth(), dObj.getDate(), 0, 0, 0, 0);
}

function isTeacherIzinOnDate(teacherId, teacherName, dTarget, approvedIzinList) {
  if (!approvedIzinList || !dTarget) return false;
  var targetTime = dTarget.getTime();
  for (var i = 0; i < approvedIzinList.length; i++) {
    var iz = approvedIzinList[i];
    var isStatusApproved = (iz.status === 'APPROVED' || iz.status === 'Disetujui');
    if (!isStatusApproved) continue;

    var isUserMatch = (iz.id_user && teacherId && iz.id_user === teacherId) ||
      (iz.nama_guru && teacherName && iz.nama_guru.trim().toLowerCase() === teacherName.trim().toLowerCase());

    if (isUserMatch) {
      var start = parseTanggalPresensi(iz.tgl_mulai);
      var end = parseTanggalPresensi(iz.tgl_selesai || iz.tgl_mulai);
      if (start && end) {
        var startTime = start.getTime();
        var endTime = end.getTime() + (24 * 60 * 60 * 1000 - 1);
        if (targetTime >= startTime && targetTime <= endTime) {
          return true;
        }
      }
    }
  }
  return false;
}

function filterRecordsByRange(list, range) {
  list = list || [];
  if (!range || range === 'all') return list;
  var now = new Date();
  var todayStr = (('0' + now.getDate()).slice(-2)) + '/' + (('0' + (now.getMonth() + 1)).slice(-2)) + '/' + now.getFullYear();

  if (range === 'today') {
    return list.filter(function(r) { return r.tanggal === todayStr; });
  }

  var day = now.getDay();
  var diff = (day + 6) % 7;
  var monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff, 0, 0, 0, 0);
  var sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  var sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);

  if (range === 'pekanan') {
    return list.filter(function(r) {
      var d = parseTanggalPresensi(r.tanggal);
      return d && ((d >= monday && d <= sunday) || (d >= sevenDaysAgo && d <= now));
    });
  }

  if (range === 'bulanan') {
    return list.filter(function(r) {
      var d = parseTanggalPresensi(r.tanggal);
      return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }

  if (range === 'tahunan') {
    return list.filter(function(r) {
      var d = parseTanggalPresensi(r.tanggal);
      return d && d.getFullYear() === now.getFullYear();
    });
  }

  return list;
}

function calculatePerGuruStats(rekapList, guruList, forcedHariEfektif, approvedIzinList) {
  rekapList = rekapList || [];
  guruList = guruList || [];
  approvedIzinList = approvedIzinList || cachedIzinList || [];

  // Hitung tanggal unik sekolah dari data presensi atau gunakan hari efektif sekolah
  var uniqueDatesMap = {};
  rekapList.forEach(function(r) {
    if (r.tanggal) {
      var dObj = parseTanggalPresensi(r.tanggal);
      if (dObj) uniqueDatesMap[r.tanggal] = dObj;
    }
  });
  var uniqueDates = Object.keys(uniqueDatesMap);
  var totalHariEfektif = (typeof forcedHariEfektif === 'number' && forcedHariEfektif > 0)
    ? forcedHariEfektif
    : Math.max(1, uniqueDates.length);

  var teachersMap = {};
  guruList.forEach(function(g) {
    teachersMap[g.id_user] = {
      id_user: g.id_user,
      nama_guru: g.nama_guru,
      datesAttended: {},
      totalHadir: 0,
      totalIzin: 0,
      tepatCount: 0,
      lambatCount: 0
    };
  });

  rekapList.forEach(function(r) {
    var t = teachersMap[r.id_user];
    if (!t) {
      t = teachersMap[r.id_user] = {
        id_user: r.id_user,
        nama_guru: r.nama_guru || 'Guru',
        datesAttended: {},
        totalHadir: 0,
        totalIzin: 0,
        tepatCount: 0,
        lambatCount: 0
      };
    }
    if (r.tanggal && !t.datesAttended[r.tanggal]) {
      t.datesAttended[r.tanggal] = true;
      t.totalHadir++;
      if (r.status_masuk === 'Tepat Waktu') t.tepatCount++;
      else if (r.status_masuk === 'Terlambat') t.lambatCount++;
    }
  });

  // Hitung izin yang disetujui (Approved) untuk hari sekolah aktif yang tidak dihadiri guru
  Object.values(teachersMap).forEach(function(t) {
    uniqueDates.forEach(function(dateStr) {
      if (!t.datesAttended[dateStr]) {
        var dSchool = uniqueDatesMap[dateStr];
        if (isTeacherIzinOnDate(t.id_user, t.nama_guru, dSchool, approvedIzinList)) {
          t.totalIzin++;
        }
      }
    });
  });

  var perGuruStats = Object.values(teachersMap).map(function(t) {
    var hadir = t.totalHadir;
    var izin = t.totalIzin;
    var alpa = Math.max(0, totalHariEfektif - hadir - izin);
    var pctHadir = totalHariEfektif > 0 ? ((hadir / totalHariEfektif) * 100).toFixed(1) : '0';
    var pctIzin = totalHariEfektif > 0 ? ((izin / totalHariEfektif) * 100).toFixed(1) : '0';
    var pctAlpa = totalHariEfektif > 0 ? ((alpa / totalHariEfektif) * 100).toFixed(1) : '0';
    var pctResmi = totalHariEfektif > 0 ? (((hadir + izin) / totalHariEfektif) * 100).toFixed(1) : '0';

    return {
      id_user: t.id_user,
      nama_guru: t.nama_guru,
      totalHadir: hadir,
      totalIzin: izin,
      totalTidakHadir: alpa,
      totalHariEfektif: totalHariEfektif,
      tepatCount: t.tepatCount,
      lambatCount: t.lambatCount,
      persenHadir: parseFloat(pctHadir),
      persenIzin: parseFloat(pctIzin),
      persenTidakHadir: parseFloat(pctAlpa),
      persenResmi: parseFloat(pctResmi)
    };
  });

  perGuruStats.sort(function(a, b) {
    if (b.persenHadir !== a.persenHadir) return b.persenHadir - a.persenHadir;
    return a.nama_guru.localeCompare(b.nama_guru);
  });

  var totalTargetSesi = Math.max(1, (guruList.length || perGuruStats.length) * totalHariEfektif);
  var totalAktualHadir = perGuruStats.reduce(function(acc, x) { return acc + x.totalHadir; }, 0);
  var totalAktualIzin = perGuruStats.reduce(function(acc, x) { return acc + x.totalIzin; }, 0);
  var totalTidakAbsenSesi = Math.max(0, totalTargetSesi - totalAktualHadir - totalAktualIzin);
  var totalTepat = perGuruStats.reduce(function(acc, x) { return acc + x.tepatCount; }, 0);
  var totalLambat = perGuruStats.reduce(function(acc, x) { return acc + x.lambatCount; }, 0);
  var persenKolektif = ((totalAktualHadir / totalTargetSesi) * 100).toFixed(1);
  var persenIzinKolektif = ((totalAktualIzin / totalTargetSesi) * 100).toFixed(1);
  var persenTidakAbsenKolektif = ((totalTidakAbsenSesi / totalTargetSesi) * 100).toFixed(1);
  var persenResmiKolektif = (((totalAktualHadir + totalAktualIzin) / totalTargetSesi) * 100).toFixed(1);

  return {
    totalHariEfektif: totalHariEfektif,
    uniqueDates: uniqueDates,
    perGuruStats: perGuruStats,
    totalTargetSesi: totalTargetSesi,
    totalAktualHadir: totalAktualHadir,
    totalAktualIzin: totalAktualIzin,
    totalTidakAbsenSesi: totalTidakAbsenSesi,
    totalTepat: totalTepat,
    totalLambat: totalLambat,
    persenKolektif: parseFloat(persenKolektif),
    persenIzinKolektif: parseFloat(persenIzinKolektif),
    persenTidakAbsenKolektif: parseFloat(persenTidakAbsenKolektif),
    persenResmiKolektif: parseFloat(persenResmiKolektif)
  };
}

function calculateTriplePeriodStats(allRekapList, guruList, approvedIzinList) {
  allRekapList = allRekapList || [];
  guruList = guruList || [];
  approvedIzinList = approvedIzinList || cachedIzinList || [];

  var now = new Date();
  var day = now.getDay();
  var diff = (day + 6) % 7;
  var monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff, 0, 0, 0, 0);
  var sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
  var sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);

  var listMinggu = [];
  var listBulan = [];
  var listTahun = [];

  allRekapList.forEach(function(r) {
    var d = parseTanggalPresensi(r.tanggal);
    if (!d) return;

    if ((d >= monday && d <= sunday) || (d >= sevenDaysAgo && d <= now)) {
      listMinggu.push(r);
    }
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
      listBulan.push(r);
    }
    if (d.getFullYear() === now.getFullYear()) {
      listTahun.push(r);
    }
  });

  // Hitung hari efektif sekolah untuk masing-masing periode
  var datesMinggu = {};
  listMinggu.forEach(function(r) { if (r.tanggal) datesMinggu[r.tanggal] = true; });
  var hariEfektifMinggu = Math.max(1, Object.keys(datesMinggu).length);

  var datesBulan = {};
  listBulan.forEach(function(r) { if (r.tanggal) datesBulan[r.tanggal] = true; });
  var hariEfektifBulan = Math.max(1, Object.keys(datesBulan).length);

  var datesTahun = {};
  listTahun.forEach(function(r) { if (r.tanggal) datesTahun[r.tanggal] = true; });
  var hariEfektifTahun = Math.max(1, Object.keys(datesTahun).length);

  var statsMinggu = calculatePerGuruStats(listMinggu, guruList, hariEfektifMinggu, approvedIzinList);
  var statsBulan = calculatePerGuruStats(listBulan, guruList, hariEfektifBulan, approvedIzinList);
  var statsTahun = calculatePerGuruStats(listTahun, guruList, hariEfektifTahun, approvedIzinList);

  var mapMinggu = {};
  statsMinggu.perGuruStats.forEach(function(s) { mapMinggu[s.id_user] = s; });

  var mapBulan = {};
  statsBulan.perGuruStats.forEach(function(s) { mapBulan[s.id_user] = s; });

  var mapTahun = {};
  statsTahun.perGuruStats.forEach(function(s) { mapTahun[s.id_user] = s; });

  var baseGuruList = (guruList && guruList.length > 0) ? guruList : statsBulan.perGuruStats;
  var combinedGuruList = baseGuruList.map(function(g) {
    var sm = mapMinggu[g.id_user] || { totalHadir: 0, totalIzin: 0, totalTidakHadir: hariEfektifMinggu, persenHadir: 0, persenIzin: 0, persenTidakHadir: 100, persenResmi: 0, tepatCount: 0, lambatCount: 0 };
    var sb = mapBulan[g.id_user] || { totalHadir: 0, totalIzin: 0, totalTidakHadir: hariEfektifBulan, persenHadir: 0, persenIzin: 0, persenTidakHadir: 100, persenResmi: 0, tepatCount: 0, lambatCount: 0 };
    var st = mapTahun[g.id_user] || { totalHadir: 0, totalIzin: 0, totalTidakHadir: hariEfektifTahun, persenHadir: 0, persenIzin: 0, persenTidakHadir: 100, persenResmi: 0, tepatCount: 0, lambatCount: 0 };

    return {
      id_user: g.id_user,
      nama_guru: g.nama_guru || 'Guru',
      minggu: {
        totalHadir: sm.totalHadir,
        totalIzin: sm.totalIzin,
        totalTidakHadir: sm.totalTidakHadir,
        hariEfektif: hariEfektifMinggu,
        persenHadir: sm.persenHadir,
        persenIzin: sm.persenIzin,
        persenTidakHadir: sm.persenTidakHadir,
        persenResmi: sm.persenResmi,
        tepatCount: sm.tepatCount,
        lambatCount: sm.lambatCount
      },
      bulan: {
        totalHadir: sb.totalHadir,
        totalIzin: sb.totalIzin,
        totalTidakHadir: sb.totalTidakHadir,
        hariEfektif: hariEfektifBulan,
        persenHadir: sb.persenHadir,
        persenIzin: sb.persenIzin,
        persenTidakHadir: sb.persenTidakHadir,
        persenResmi: sb.persenResmi,
        tepatCount: sb.tepatCount,
        lambatCount: sb.lambatCount
      },
      tahun: {
        totalHadir: st.totalHadir,
        totalIzin: st.totalIzin,
        totalTidakHadir: st.totalTidakHadir,
        hariEfektif: hariEfektifTahun,
        persenHadir: st.persenHadir,
        persenIzin: st.persenIzin,
        persenTidakHadir: st.persenTidakHadir,
        persenResmi: st.persenResmi,
        tepatCount: st.tepatCount,
        lambatCount: st.lambatCount
      }
    };
  });

  combinedGuruList.sort(function(a, b) {
    if (b.bulan.persenHadir !== a.bulan.persenHadir) return b.bulan.persenHadir - a.bulan.persenHadir;
    return a.nama_guru.localeCompare(b.nama_guru);
  });

  return {
    statsMinggu: statsMinggu,
    statsBulan: statsBulan,
    statsTahun: statsTahun,
    combinedGuruList: combinedGuruList
  };
}

function updatePeriodPill(idPersen, idRasio, persenVal, rasioVal) {
  var elP = document.getElementById(idPersen);
  var elR = document.getElementById(idRasio);
  if (elP) elP.innerText = persenVal + '%';
  if (elR) elR.innerText = rasioVal;
}

function renderTabelPersenMultiPeriode(tripleStats) {
  var tbody = document.getElementById('tblPersenPerGuru');
  var tfoot = document.getElementById('tfootPersenPerGuru');
  if (!tbody) return;

  tbody.innerHTML = '';
  var list = tripleStats.combinedGuruList || [];

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="p-3 text-center text-slate-400">Belum ada data kehadiran.</td></tr>';
  } else {
    list.forEach(function(s, idx) {
      var tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition cursor-pointer';
      tr.title = 'Klik untuk melihat detail riwayat presensi ' + s.nama_guru;
      tr.onclick = function() {
        var selG = document.getElementById('filterGuru');
        if (selG) {
          selG.value = s.id_user;
          switchRekapViewMode('log');
          loadAdminData();
        }
      };

      function getBadge(pct) {
        if (pct >= 85) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
        if (pct >= 60) return 'bg-amber-100 text-amber-800 border-amber-300';
        return 'bg-rose-100 text-rose-800 border-rose-300';
      }

      function renderCell(p) {
        return '<td class="p-1.5 text-center whitespace-nowrap">' +
          '<span class="px-1.5 py-0.5 rounded-full text-[9px] font-black border ' + getBadge(p.persenHadir) + '">' + p.persenHadir + '%</span>' +
          '<span class="block text-[8px] text-slate-500 mt-0.5">' + p.totalHadir + '/' + p.hariEfektif + ' Hadir</span>' +
          (p.totalIzin > 0 ? '<span class="block text-[8px] text-blue-600 font-semibold">' + p.totalIzin + ' Izin</span>' : '') +
          (p.totalTidakHadir > 0 ? '<span class="block text-[8px] text-rose-600 font-semibold">' + p.totalTidakHadir + ' Tdk Absen</span>' : '') +
          '</td>';
      }

      var tdNo = '<td class="p-1.5 text-center text-slate-400 font-semibold">' + (idx + 1) + '</td>';
      var tdNama = '<td class="p-1.5 font-bold text-slate-700 leading-tight">' + s.nama_guru + '</td>';
      var tdM = renderCell(s.minggu);
      var tdB = renderCell(s.bulan);
      var tdT = renderCell(s.tahun);
      var tdAksi = '<td class="p-1.5 text-center"><i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-400 inline"></i></td>';

      tr.innerHTML = tdNo + tdNama + tdM + tdB + tdT + tdAksi;
      tbody.appendChild(tr);
    });
  }

  if (tfoot) {
    function renderTfootCell(st) {
      return '<td class="p-2 text-center whitespace-nowrap text-emerald-800">' +
        '<span class="text-xs font-black">' + st.persenKolektif + '%</span>' +
        '<span class="block text-[8px] text-slate-500">' + st.totalAktualHadir + '/' + st.totalTargetSesi + ' Hadir</span>' +
        (st.totalAktualIzin > 0 ? '<span class="block text-[8px] text-blue-600 font-semibold">' + st.totalAktualIzin + ' Sesi Izin</span>' : '') +
        '<span class="block text-[8px] text-rose-600 font-semibold">' + st.totalTidakAbsenSesi + ' Sesi Tdk Absen</span>' +
        '</td>';
    }

    tfoot.innerHTML = '<tr>' +
      '<td colspan="2" class="p-2 text-slate-800 text-[10px] uppercase font-black tracking-wide">TOTAL SELURUH GURU</td>' +
      renderTfootCell(tripleStats.statsMinggu) +
      renderTfootCell(tripleStats.statsBulan) +
      renderTfootCell(tripleStats.statsTahun) +
      '<td></td>' +
    '</tr>';
  }
  if (window.lucide) lucide.createIcons();
}

function renderTabelLogPresensi(logList) {
  var tbodyLog = document.getElementById('tblRekapAdmin');
  if (!tbodyLog) return;
  tbodyLog.innerHTML = '';
  if (!logList || logList.length === 0) {
    tbodyLog.innerHTML = '<tr><td colspan="4" class="p-3 text-center text-slate-400">Tidak ada riwayat presensi pada periode ini.</td></tr>';
    return;
  }
  logList.forEach(function(r) {
    var tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition';
    
    var statMColor = r.status_masuk === 'Tepat Waktu' ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50';
    var statPColor = r.status_pulang === 'Tepat Waktu' ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50';

    var safeAlasanM = (r.alasan_masuk || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    var safeAlasanP = (r.alasan_pulang || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    var safeNama = (r.nama_guru || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

    var btnFotoM = r.foto_masuk ? ' <button type="button" onclick="openFotoModal(\'' + r.foto_masuk + '\', \'' + safeNama + '\', \'Masuk\', \'' + safeAlasanM + '\')" class="text-emerald-700 hover:text-emerald-900 inline" title="Lihat Foto Masuk"><i data-lucide="image" class="w-3 h-3 inline"></i></button>' : '';
    var btnFotoP = r.foto_pulang ? ' <button type="button" onclick="openFotoModal(\'' + r.foto_pulang + '\', \'' + safeNama + '\', \'Pulang\', \'' + safeAlasanP + '\')" class="text-emerald-700 hover:text-emerald-900 inline" title="Lihat Foto Pulang"><i data-lucide="image" class="w-3 h-3 inline"></i></button>' : '';

    var ketAlasanM = r.alasan_masuk 
      ? '<div class="text-[9px] text-amber-800 bg-amber-50/90 border border-amber-200/80 rounded px-1.5 py-0.5 mt-1 leading-tight break-words max-w-[150px]"><span class="font-bold">Ket:</span> ' + r.alasan_masuk + '</div>' 
      : '';
    var ketAlasanP = r.alasan_pulang 
      ? '<div class="text-[9px] text-amber-800 bg-amber-50/90 border border-amber-200/80 rounded px-1.5 py-0.5 mt-1 leading-tight break-words max-w-[150px]"><span class="font-bold">Ket:</span> ' + r.alasan_pulang + '</div>' 
      : '';

    var labelHariTgl = (r.hari ? '<span class="font-bold text-slate-800">' + r.hari + ',</span> ' : '') + r.tanggal;

    var tdG = '<td class="p-1.5 align-top font-bold text-slate-700">' + r.nama_guru + '</td>';
    var tdT = '<td class="p-1.5 align-top text-slate-500 whitespace-nowrap">' + labelHariTgl + '</td>';
    var tdM = '<td class="p-1.5 align-top"><span class="font-semibold">' + (r.jam_masuk || '--') + '</span> ' + 
      (r.status_masuk ? '<span class="text-[8px] px-1 py-0.5 rounded font-bold ' + statMColor + '">' + r.status_masuk + '</span>' : '') + btnFotoM + ketAlasanM + '</td>';
    var tdP = '<td class="p-1.5 align-top"><span class="font-semibold">' + (r.jam_pulang || '--') + '</span> ' + 
      (r.status_pulang ? '<span class="text-[8px] px-1 py-0.5 rounded font-bold ' + statPColor + '">' + r.status_pulang + '</span>' : '') + btnFotoP + ketAlasanP + '</td>';
    
    tr.innerHTML = tdG + tdT + tdM + tdP;
    tbodyLog.appendChild(tr);
  });
  if (window.lucide) lucide.createIcons();
}

function renderRekapStatsAndTables(rekapList, guruList, approvedIzinList) {
  var selGuru = document.getElementById('filterGuru');
  var selectedGuruId = (selGuru && selGuru.value) ? selGuru.value : 'ALL';
  var selRange = document.getElementById('filterRange');
  var currentRange = (selRange && selRange.value) ? selRange.value : (stateAdmin.range || 'bulanan');
  approvedIzinList = approvedIzinList || cachedIzinList || [];

  // 1. Hitung komparasi 3 periode (Minggu Ini, Bulan Ini, Tahun Ini) dari seluruh data sekolah
  var tripleStats = calculateTriplePeriodStats(rekapList, guruList, approvedIzinList);

  // 2. Hitung hari efektif sekolah pada rentang yang aktif (misal 5 hari untuk pekanan/bulanan)
  var filteredSchoolRange = filterRecordsByRange(rekapList, currentRange);
  var schoolDatesMap = {};
  filteredSchoolRange.forEach(function(r) { if (r.tanggal) schoolDatesMap[r.tanggal] = true; });
  var totalHariEfektifSekolah = Math.max(1, Object.keys(schoolDatesMap).length);

  // 3. Hitung statistik seluruh guru berdasarkan hari efektif sekolah tersebut
  var statObjActive = calculatePerGuruStats(filteredSchoolRange, guruList, totalHariEfektifSekolah, approvedIzinList);
  var perGuruStats = statObjActive.perGuruStats;

  // 4. Saring data untuk tabel log riwayat presensi
  var filteredForLog = filteredSchoolRange;
  if (selectedGuruId !== 'ALL') {
    filteredForLog = filteredSchoolRange.filter(function(r) { return r.id_user === selectedGuruId; });
  }

  // Update Card Ringkasan Utama
  var titleEl = document.getElementById('titlePersenRekap');
  var badgeEl = document.getElementById('badgePersenTotal');
  var barEl = document.getElementById('barPersenTotal');
  var txtHariEl = document.getElementById('txtStatHariKerja');
  var txtHadirEl = document.getElementById('txtStatHadir');
  var txtIzinEl = document.getElementById('txtStatIzin');
  var txtTidakAbsenEl = document.getElementById('txtStatTidakAbsen');
  var txtTepatEl = document.getElementById('txtStatTepatWaktu');
  var txtLambatEl = document.getElementById('txtStatTerlambat');
  var badgeCount = document.getElementById('rekapCountBadge');

  if (badgeCount) badgeCount.innerText = filteredForLog.length + ' data presensi';
  if (txtHariEl) txtHariEl.innerText = totalHariEfektifSekolah + ' Hari';

  var labelPeriode = currentRange === 'pekanan' ? ' (Pekanan)' : (currentRange === 'bulanan' ? ' (Bulanan)' : (currentRange === 'tahunan' ? ' (Tahunan)' : ''));

  if (selectedGuruId !== 'ALL') {
    var selectedStat = perGuruStats.find(function(s) { return s.id_user === selectedGuruId; });
    var nameGuruSelected = selectedStat ? selectedStat.nama_guru : 'Guru';
    var hVal = selectedStat ? selectedStat.totalHadir : 0;
    var izVal = selectedStat ? selectedStat.totalIzin : 0;
    var thVal = selectedStat ? selectedStat.totalTidakHadir : Math.max(0, totalHariEfektifSekolah - hVal - izVal);
    var pVal = selectedStat ? selectedStat.persenHadir : 0;
    var pIzVal = selectedStat ? selectedStat.persenIzin : 0;
    var pThVal = selectedStat ? selectedStat.persenTidakHadir : 100;
    var tVal = selectedStat ? selectedStat.tepatCount : 0;
    var lVal = selectedStat ? selectedStat.lambatCount : 0;

    if (titleEl) titleEl.innerText = 'Persentase: ' + nameGuruSelected + labelPeriode;
    if (badgeEl) badgeEl.innerText = pVal + '%';
    if (barEl) barEl.style.width = Math.min(100, pVal) + '%';
    
    if (txtHadirEl) txtHadirEl.innerText = hVal + ' (' + pVal + '%)';
    if (txtIzinEl) txtIzinEl.innerText = izVal + ' (' + pIzVal + '%)';
    if (txtTidakAbsenEl) txtTidakAbsenEl.innerText = thVal + ' (' + pThVal + '%)';
    if (txtTepatEl) txtTepatEl.innerText = 'Tepat Waktu: ' + tVal;
    var lambatPct = hVal > 0 ? ((lVal / hVal) * 100).toFixed(0) : '0';
    if (txtLambatEl) txtLambatEl.innerText = 'Terlambat: ' + lVal + ' (' + lambatPct + '%)';

    // Update 3 Pills untuk Guru Tersebut (Memuat Hadir, Izin, dan Tidak Absen)
    var sgTriple = tripleStats.combinedGuruList.find(function(x) { return x.id_user === selectedGuruId; });
    if (sgTriple) {
      function formatPillRasio(s) {
        var parts = [s.totalHadir + '/' + s.hariEfektif + ' Hadir'];
        if (s.totalIzin > 0) parts.push(s.totalIzin + ' Izin');
        if (s.totalTidakHadir > 0) parts.push(s.totalTidakHadir + ' Tdk Absen');
        return parts.join(' • ');
      }
      updatePeriodPill('txtPillPersenMinggu', 'txtPillRasioMinggu', sgTriple.minggu.persenHadir, formatPillRasio(sgTriple.minggu));
      updatePeriodPill('txtPillPersenBulan', 'txtPillRasioBulan', sgTriple.bulan.persenHadir, formatPillRasio(sgTriple.bulan));
      updatePeriodPill('txtPillPersenTahun', 'txtPillRasioTahun', sgTriple.tahun.persenHadir, formatPillRasio(sgTriple.tahun));
    }
  } else {
    if (titleEl) titleEl.innerText = 'Persentase Seluruh Guru' + labelPeriode;
    if (badgeEl) badgeEl.innerText = statObjActive.persenKolektif + '%';
    if (barEl) barEl.style.width = Math.min(100, statObjActive.persenKolektif) + '%';
    
    if (txtHadirEl) txtHadirEl.innerText = statObjActive.totalAktualHadir + ' (' + statObjActive.persenKolektif + '%)';
    if (txtIzinEl) txtIzinEl.innerText = statObjActive.totalAktualIzin + ' (' + statObjActive.persenIzinKolektif + '%)';
    if (txtTidakAbsenEl) txtTidakAbsenEl.innerText = statObjActive.totalTidakAbsenSesi + ' (' + statObjActive.persenTidakAbsenKolektif + '%)';
    if (txtTepatEl) txtTepatEl.innerText = 'Tepat Waktu: ' + statObjActive.totalTepat;
    var lambatPctAll = statObjActive.totalAktualHadir > 0 ? ((statObjActive.totalLambat / statObjActive.totalAktualHadir) * 100).toFixed(0) : '0';
    if (txtLambatEl) txtLambatEl.innerText = 'Terlambat: ' + statObjActive.totalLambat + ' (' + lambatPctAll + '%)';

    // Update 3 Pills untuk Seluruh Guru Kolektif
    function formatPillRasioAll(st) {
      var parts = [st.totalAktualHadir + '/' + st.totalTargetSesi + ' Sesi'];
      if (st.totalAktualIzin > 0) parts.push(st.totalAktualIzin + ' Izin');
      if (st.totalTidakAbsenSesi > 0) parts.push(st.totalTidakAbsenSesi + ' Tdk Absen');
      return parts.join(' • ');
    }
    updatePeriodPill('txtPillPersenMinggu', 'txtPillRasioMinggu', tripleStats.statsMinggu.persenKolektif, formatPillRasioAll(tripleStats.statsMinggu));
    updatePeriodPill('txtPillPersenBulan', 'txtPillRasioBulan', tripleStats.statsBulan.persenKolektif, formatPillRasioAll(tripleStats.statsBulan));
    updatePeriodPill('txtPillPersenTahun', 'txtPillRasioTahun', tripleStats.statsTahun.persenKolektif, formatPillRasioAll(tripleStats.statsTahun));
  }

  // Render Tabel Persentase Per Guru (Kolom: Minggu Ini, Bulan Ini, Tahun Ini)
  renderTabelPersenMultiPeriode(tripleStats);

  // Render Tabel Log Presensi
  renderTabelLogPresensi(filteredForLog);
}

function renderAdminDashboard(res) {
  var totalGuru = res.stats.totalGuru || 0;
  var sudahMasuk = res.stats.sudahAbsenMasukToday || 0;
  var sudahPulang = res.stats.sudahAbsenPulangToday || 0;
  var belumAbsen = res.stats.belumAbsenToday || 0;

  document.getElementById('admTotalGuru').innerText = totalGuru;
  document.getElementById('admSudahAbsen').innerText = sudahMasuk;
  var elSudahPulang = document.getElementById('admSudahPulang');
  if (elSudahPulang) elSudahPulang.innerText = sudahPulang;
  document.getElementById('admBelumAbsen').innerText = belumAbsen;

  // Persentase Kehadiran Hari Ini
  var persenHariIni = totalGuru > 0 ? ((sudahMasuk / totalGuru) * 100).toFixed(1) : '0';
  var elPersenHariIni = document.getElementById('admPersenHariIni');
  if (elPersenHariIni) elPersenHariIni.innerText = persenHariIni + '%';
  var elProgressHariIni = document.getElementById('admProgressHariIni');
  if (elProgressHariIni) elProgressHariIni.style.width = persenHariIni + '%';

  if (res.guruList && res.guruList.length > 0) {
    cachedGuruList = res.guruList;
    var selGuru = document.getElementById('filterGuru');
    if (selGuru) {
      var currentVal = selGuru.value || 'ALL';
      selGuru.innerHTML = '<option value="ALL">Semua Guru</option>';
      res.guruList.forEach(function(g) {
        var opt = document.createElement('option');
        opt.value = g.id_user;
        opt.innerText = g.nama_guru;
        if (g.id_user === currentVal) opt.selected = true;
        selGuru.appendChild(opt);
      });
    }
  }

  if (res.settings) {
    document.getElementById('cfgLat').value = res.settings.LAT_SEKOLAH || '-6.41022';
    document.getElementById('cfgLong').value = res.settings.LONG_SEKOLAH || '106.82729';
    document.getElementById('cfgRadius').value = res.settings.MAX_RADIUS_METER || '350';
    document.getElementById('cfgJamMasuk').value = res.settings.JAM_MASUK_STD || '07:00';
    document.getElementById('cfgJamPulang').value = res.settings.JAM_PULANG_STD || '16:00';
    updateGoogleMapsPreview();
  }

  cachedRealtimeMonitoring = res.realtimeMonitoring || [];
  cachedRekapData = res.rekapitulasi || [];
  cachedIzinList = res.izinList || [];
  renderRealtimeMonitoringList();
  renderRekapStatsAndTables(res.rekapitulasi || [], res.guruList || cachedGuruList, cachedIzinList);

  document.getElementById('pageInfoAdmin').innerText = 'Hal ' + res.pagination.currentPage + ' dari ' + res.pagination.totalPages;
  document.getElementById('btnPrevAdmin').disabled = (res.pagination.currentPage <= 1);
  document.getElementById('btnNextAdmin').disabled = (res.pagination.currentPage >= res.pagination.totalPages);
  lucide.createIcons();
}

function updateGoogleMapsPreview() {
  var lat = document.getElementById('cfgLat').value.trim() || '-6.41022';
  var long = document.getElementById('cfgLong').value.trim() || '106.82729';
  var iframe = document.getElementById('iframeGoogleMaps');
  if (iframe) {
    iframe.src = 'https://maps.google.com/maps?q=' + lat + ',' + long + '&hl=id&z=17&output=embed';
  }
}

function detectAdminCurrentLocationGPS() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        document.getElementById('cfgLat').value = pos.coords.latitude.toFixed(5);
        document.getElementById('cfgLong').value = pos.coords.longitude.toFixed(5);
        updateGoogleMapsPreview();
        showNotif('Lokasi Terdeteksi', 'Koordinat GPS Anda berhasil diambil!', true);
      },
      function(err) {
        showNotif('GPS Error', 'Gagal mendeteksi koordinat: ' + err.message, false);
      }
    );
  }
}

function saveAdminSettings() {
  var payload = {
    lat: document.getElementById('cfgLat').value.trim(),
    long: document.getElementById('cfgLong').value.trim(),
    radius: document.getElementById('cfgRadius').value.trim(),
    jamMasuk: document.getElementById('cfgJamMasuk').value,
    jamPulang: document.getElementById('cfgJamPulang').value
  };

  API.simpanSettings(payload).then(function(res) {
    if (res.success) {
      showNotif('Pengaturan Disimpan', res.message, true);
    } else {
      showNotif('Gagal Menyimpan', res.message, false);
    }
  });
}

function updateBadgePendingIzin(list) {
  var badge = document.getElementById('badgePendingIzin');
  var banner = document.getElementById('bannerPendingIzin');
  var txtBanner = document.getElementById('txtBannerPendingIzin');

  if (list && Array.isArray(list)) {
    var pendingItems = list.filter(function(x) { return x && x.status === 'PENDING'; });
    var pendingCount = pendingItems.length;

    if (badge) {
      if (pendingCount > 0) {
        badge.innerText = pendingCount;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }

    if (banner) {
      if (pendingCount > 0) {
        if (txtBanner) {
          txtBanner.innerText = 'Ada ' + pendingCount + ' pengajuan izin baru menunggu persetujuan Anda!';
        }
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    }
  } else {
    API.getDaftarIzinAdmin().then(function(res) {
      var items = (res && res.data) ? res.data : [];
      updateBadgePendingIzin(items);
    });
  }
}

function loadDaftarIzinAdmin() {
  var box = document.getElementById('listApprovalIzin');
  if (!box) return;

  box.innerHTML = '<p class="text-center text-xs text-slate-400 py-4 flex items-center justify-center space-x-1.5"><i data-lucide="loader" class="w-4 h-4 animate-spin text-emerald-600"></i><span>Memuat data perizinan dari database...</span></p>';
  if (window.lucide) lucide.createIcons();

  API.getDaftarIzinAdmin().then(function(res) {
    var list = (res && res.data) ? res.data : [];
    updateBadgePendingIzin(list);
    renderApprovalIzinAdmin(list);
  });
}

function renderApprovalIzinAdmin(list) {
  var box = document.getElementById('listApprovalIzin');
  box.innerHTML = '';

  if (!list || list.length === 0) {
    box.innerHTML = '<div class="p-6 text-center space-y-1"><i data-lucide="clipboard-check" class="w-8 h-8 text-slate-300 mx-auto"></i><p class="text-xs font-bold text-slate-500">Belum Ada Pengajuan Izin</p><p class="text-[10px] text-slate-400">Pengajuan izin, sakit, atau cuti dari guru akan muncul di sini.</p></div>';
    if (window.lucide) lucide.createIcons();
    return;
  }

  list.forEach(function(item) {
    var badgeClass = 'bg-amber-100 text-amber-800 border border-amber-200';
    var statusLabel = 'MENUNGGU PERSETUJUAN';
    if (item.status === 'APPROVED') {
      badgeClass = 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      statusLabel = 'DISETUJUI';
    } else if (item.status === 'REJECTED') {
      badgeClass = 'bg-rose-100 text-rose-800 border border-rose-200';
      statusLabel = 'DITOLAK';
    }

    var card = document.createElement('div');
    card.className = 'p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-2 text-xs';
    
    var header = '<div class="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">' +
      '<div class="flex items-start space-x-2 min-w-0 flex-1">' +
        '<div class="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">' +
          (item.nama_guru ? item.nama_guru.charAt(0).toUpperCase() : 'G') +
        '</div>' +
        '<div class="min-w-0 flex-1">' +
          '<span class="font-bold text-slate-800 text-xs sm:text-sm leading-snug break-words block">' + (item.nama_guru || 'Guru') + '</span>' +
        '</div>' +
      '</div>' +
      '<span class="text-[9px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap flex-shrink-0 ' + badgeClass + '">' + statusLabel + '</span>' +
    '</div>';

    var sub = '<div class="flex items-center justify-between text-[11px] text-slate-600 font-semibold">' +
      '<span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold">' + item.jenis_izin + '</span>' +
      '<span class="text-slate-500 text-[10px]">' + item.tgl_mulai + (item.tgl_selesai && item.tgl_selesai !== item.tgl_mulai ? ' s/d ' + item.tgl_selesai : '') + '</span>' +
    '</div>';

    var desc = '<p class="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 leading-snug"><strong>Alasan:</strong> ' + (item.alasan || '-') + '</p>';
    
    var action = '';
    if (item.status === 'PENDING') {
      action = '<div class="pt-1 flex justify-end space-x-2">' +
        '<button onclick="openApprovalModal(\'' + item.id_izin + '\', \'' + (item.nama_guru || 'Guru').replace(/'/g, "\\'") + '\', \'' + item.jenis_izin + '\')" class="px-3.5 py-1.5 bg-[#2e7d32] hover:bg-[#1b5e20] text-white font-bold text-[10px] rounded-xl shadow flex items-center space-x-1 cursor-pointer transition">' +
          '<i data-lucide="check-square" class="w-3.5 h-3.5"></i>' +
          '<span>Proses Persetujuan</span>' +
        '</button>' +
      '</div>';
    } else {
      var iconStat = item.status === 'APPROVED' ? 'check-circle' : 'x-circle';
      var textStatColor = item.status === 'APPROVED' ? 'text-emerald-700' : 'text-rose-700';
      action = '<div class="pt-1 text-[10px] ' + textStatColor + ' flex items-center justify-between">' +
        '<span class="flex items-center space-x-1 font-bold"><i data-lucide="' + iconStat + '" class="w-3.5 h-3.5"></i><span>' + (item.status === 'APPROVED' ? 'Sudah Disetujui Admin' : 'Ditolak Admin') + '</span></span>' +
        (item.catatan_admin ? '<span class="text-slate-500 italic">Catatan: ' + item.catatan_admin + '</span>' : '') +
      '</div>';
    }

    card.innerHTML = header + sub + desc + action;
    box.appendChild(card);
  });
  if (window.lucide) lucide.createIcons();
}

function openApprovalModal(id, nama, jenis) {
  activeApprovalId = id;
  document.getElementById('apprModalInfo').innerText = 'Memproses perizinan ' + jenis + ' untuk ' + nama + '.';
  document.getElementById('apprCatatan').value = '';
  document.getElementById('modalApprovalAdmin').classList.remove('hidden');
}

function closeApprovalModal() {
  activeApprovalId = null;
  document.getElementById('modalApprovalAdmin').classList.add('hidden');
}

function submitApprovalAdmin(status) {
  if (!activeApprovalId) return;
  var payload = { idIzin: activeApprovalId, status: status, catatan: document.getElementById('apprCatatan').value.trim() };
  closeApprovalModal();

  API.prosesApprovalIzin(payload).then(function(res) {
    if (res.success) {
      showNotif('Status Diperbarui', res.message, true);
      loadDaftarIzinAdmin();
      updateBadgePendingIzin();
    } else {
      showNotif('Gagal Memproses', res.message, false);
    }
  });
}

function fallbackPrintWindow(htmlDoc) {
  var printWindow = window.open('', '_blank');
  if (!printWindow) {
    showNotif('Popup Terblokir', 'Harap izinkan popup pada browser Anda untuk membuka dokumen.', false);
    return;
  }
  printWindow.document.open();
  printWindow.document.write(htmlDoc);
  printWindow.document.close();
}

function downloadRekapPdf() {
  var sb = typeof getSupabase === 'function' ? getSupabase() : null;
  var selGuru = document.getElementById('filterGuru');
  var selectedGuruId = (selGuru && selGuru.value) ? selGuru.value : 'ALL';
  var selectedGuruName = (selGuru && selGuru.selectedIndex >= 0 && selectedGuruId !== 'ALL') ? selGuru.options[selGuru.selectedIndex].text : '';
  var searchVal = document.getElementById('searchAdminRekap') ? document.getElementById('searchAdminRekap').value.trim() : '';

  var fetchPromise;
  if (sb) {
    var query = sb.from('absensi').select('*').order('created_at', { ascending: false });
    if (selectedGuruId !== 'ALL') {
      query = query.eq('id_user', selectedGuruId);
    }
    if (searchVal) {
      query = query.ilike('nama_guru', '%' + searchVal + '%');
    }
    fetchPromise = query;
  } else {
    var filtered = cachedRekapData || [];
    if (selectedGuruId !== 'ALL') {
      filtered = filtered.filter(function(r) { return r.id_user === selectedGuruId || r.nama_guru === selectedGuruName; });
    }
    if (searchVal) {
      filtered = filtered.filter(function(r) { return (r.nama_guru || '').toLowerCase().indexOf(searchVal.toLowerCase()) !== -1; });
    }
    fetchPromise = Promise.resolve({ data: filtered });
  }

  fetchPromise.then(function(res) {
    var data = (res && res.data && res.data.length > 0) ? res.data : (res && Array.isArray(res)) ? res : [];
    if (!data || data.length === 0) {
      showNotif('Data Kosong', 'Tidak ada data presensi yang sesuai dengan filter guru yang dipilih.', false);
      return;
    }

    var namaGuruClean = selectedGuruName ? selectedGuruName.replace(/[^a-zA-Z0-9]/g, '_') : 'Semua_Guru';
    var tglFile = new Date().toISOString().slice(0, 10);
    var namaFileDownload = 'Rekap_Presensi_' + namaGuruClean + '_' + tglFile;

    var tglCetak = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    var subJudul = selectedGuruName ? 'Nama Guru: ' + selectedGuruName : 'Seluruh Guru & Karyawan';

    // Hitung Komparasi 3 Periode (Minggu Ini, Bulan Ini, Tahun Ini)
    var allSource = (cachedRekapData && cachedRekapData.length > 0) ? cachedRekapData : data;
    var tripleStats = calculateTriplePeriodStats(allSource, cachedGuruList, cachedIzinList);
    var isFilteredSingleGuru = (selectedGuruId !== 'ALL');

    function formatRasioPdfAll(st) {
      var s = st.totalAktualHadir + ' / ' + st.totalTargetSesi + ' Sesi';
      if (st.totalAktualIzin > 0) s += ' • ' + st.totalAktualIzin + ' Izin';
      if (st.totalTidakAbsenSesi > 0) s += ' • ' + st.totalTidakAbsenSesi + ' Tdk Absen';
      return s;
    }

    var pMinggu = tripleStats.statsMinggu.persenKolektif;
    var rMinggu = formatRasioPdfAll(tripleStats.statsMinggu);
    var pBulan = tripleStats.statsBulan.persenKolektif;
    var rBulan = formatRasioPdfAll(tripleStats.statsBulan);
    var pTahun = tripleStats.statsTahun.persenKolektif;
    var rTahun = formatRasioPdfAll(tripleStats.statsTahun);

    if (isFilteredSingleGuru) {
      var sg = tripleStats.combinedGuruList.find(function(x) { return x.id_user === selectedGuruId || x.nama_guru === selectedGuruName; });
      if (sg) {
        function formatRasioPdfSingle(p) {
          var s = p.totalHadir + ' / ' + p.hariEfektif + ' Hari';
          if (p.totalIzin > 0) s += ' • ' + p.totalIzin + ' Izin';
          if (p.totalTidakHadir > 0) s += ' • ' + p.totalTidakHadir + ' Tdk Absen';
          return s;
        }
        pMinggu = sg.minggu.persenHadir;
        rMinggu = formatRasioPdfSingle(sg.minggu);
        pBulan = sg.bulan.persenHadir;
        rBulan = formatRasioPdfSingle(sg.bulan);
        pTahun = sg.tahun.persenHadir;
        rTahun = formatRasioPdfSingle(sg.tahun);
      }
    }

    var ringkasanBoxHtml = '<div style="background-color: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px;">' +
      '<div style="font-size: 11px; font-weight: bold; color: #166534; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">Komparasi Persentase Kehadiran Berdasarkan Periode</div>' +
      '<table style="width: 100%; border: none; margin: 0; font-size: 11px;">' +
        '<tr style="background: transparent;">' +
          '<td style="border: none; padding: 4px; vertical-align: top; width: 33.3%;">' +
            '<div style="font-size: 10px; color: #166534; font-weight: bold; text-transform: uppercase;">1. Minggu Ini (Pekanan)</div>' +
            '<div style="font-size: 16px; font-weight: bold; color: #15803d;">' + pMinggu + '% <span style="font-size: 11px; font-weight: normal; color: #64748b;">(' + rMinggu + ')</span></div>' +
          '</td>' +
          '<td style="border: none; padding: 4px; vertical-align: top; width: 33.3%;">' +
            '<div style="font-size: 10px; color: #0f766e; font-weight: bold; text-transform: uppercase;">2. Bulan Ini (Bulanan)</div>' +
            '<div style="font-size: 16px; font-weight: bold; color: #0f766e;">' + pBulan + '% <span style="font-size: 11px; font-weight: normal; color: #64748b;">(' + rBulan + ')</span></div>' +
          '</td>' +
          '<td style="border: none; padding: 4px; vertical-align: top; width: 33.3%;">' +
            '<div style="font-size: 10px; color: #4338ca; font-weight: bold; text-transform: uppercase;">3. Tahun Ini (Tahunan)</div>' +
            '<div style="font-size: 16px; font-weight: bold; color: #4338ca;">' + pTahun + '% <span style="font-size: 11px; font-weight: normal; color: #64748b;">(' + rTahun + ')</span></div>' +
          '</td>' +
        '</tr>' +
      '</table>' +
    '</div>';

    // Tabel Ringkasan Persentase Guru (jika seluruh guru)
    var tabelPersenPerGuruHtml = '';
    if (!isFilteredSingleGuru && tripleStats.combinedGuruList.length > 0) {
      var rowsGuruPersenHtml = '';
      tripleStats.combinedGuruList.forEach(function(t, idx) {
        function getBadgeStyle(pct) {
          var bg = pct >= 85 ? '#dcfce7' : (pct >= 60 ? '#fef3c7' : '#fee2e2');
          var col = pct >= 85 ? '#15803d' : (pct >= 60 ? '#b45309' : '#dc2626');
          return 'display: inline-block; padding: 2px 7px; border-radius: 9999px; font-weight: bold; font-size: 10px; background: ' + bg + '; color: ' + col + ';';
        }

        function formatGuruCol(p) {
          var detail = p.totalHadir + '/' + p.hariEfektif;
          if (p.totalIzin > 0) detail += ', ' + p.totalIzin + ' Izin';
          if (p.totalTidakHadir > 0) detail += ', ' + p.totalTidakHadir + ' Alpa';
          return '<span style="' + getBadgeStyle(p.persenHadir) + '">' + p.persenHadir + '%</span> <span style="color: #64748b; font-size: 10px;">(' + detail + ')</span>';
        }

        rowsGuruPersenHtml += '<tr>' +
          '<td style="text-align: center;">' + (idx + 1) + '</td>' +
          '<td><strong>' + t.nama_guru + '</strong></td>' +
          '<td style="text-align: center;">' + formatGuruCol(t.minggu) + '</td>' +
          '<td style="text-align: center;">' + formatGuruCol(t.bulan) + '</td>' +
          '<td style="text-align: center;">' + formatGuruCol(t.tahun) + '</td>' +
        '</tr>';
      });

      tabelPersenPerGuruHtml = '<div style="margin-top: 15px; margin-bottom: 25px;">' +
        '<div style="font-size: 12px; font-weight: bold; color: #065f46; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">1. Ringkasan Persentase Kehadiran Per Guru (Mingguan, Bulanan, Tahunan)</div>' +
        '<table>' +
          '<thead>' +
            '<tr>' +
              '<th style="width: 35px;">No</th>' +
              '<th>Nama Guru / Karyawan</th>' +
              '<th style="width: 140px;">Minggu Ini</th>' +
              '<th style="width: 140px;">Bulan Ini</th>' +
              '<th style="width: 140px;">Tahun Ini</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' + rowsGuruPersenHtml + '</tbody>' +
        '</table>' +
      '</div>';
    }
    
    var rowsHtml = '';
    data.forEach(function(r, idx) {
      var jamM = r.jam_masuk ? (r.jam_masuk + ' (' + (r.status_masuk || 'Tepat Waktu') + ')') : '--:--';
      var jamP = r.jam_pulang ? (r.jam_pulang + ' (' + (r.status_pulang || 'Tepat Waktu') + ')') : '--:--';
      var ket = r.alasan_masuk || r.alasan_pulang || '-';

      rowsHtml += '<tr>' +
        '<td style="text-align: center;">' + (idx + 1) + '</td>' +
        '<td><strong>' + (r.nama_guru || '-') + '</strong></td>' +
        '<td style="text-align: center;">' + (r.tanggal || '-') + '</td>' +
        '<td style="text-align: center;">' + jamM + '</td>' +
        '<td style="text-align: center;">' + jamP + '</td>' +
        '<td>' + ket + '</td>' +
      '</tr>';
    });

    var bodyContentHtml = '<div class="kop">' +
        '<h2>SMA ISLAM DAARUL ILMI DEPOK</h2>' +
        '<h3>SISTEM INFORMASI PRESENSI GURU & KARYAWAN</h3>' +
        '<p>Kota Depok, Jawa Barat | Email: info@daarulilmi.sch.id</p>' +
      '</div>' +
      '<div class="judul-laporan">Laporan Rekapitulasi Presensi Kehadiran</div>' +
      '<div class="sub-judul">' + subJudul + '</div>' +
      '<div class="tgl-cetak">Waktu Cetak: ' + tglCetak + '</div>' +
      ringkasanBoxHtml +
      tabelPersenPerGuruHtml +
      '<div style="font-size: 12px; font-weight: bold; color: #065f46; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">' + (isFilteredSingleGuru ? 'Detail Riwayat Presensi' : '2. Detail Riwayat Presensi Lengkap') + '</div>' +
      '<table>' +
        '<thead>' +
          '<tr>' +
            '<th style="width: 35px;">No</th>' +
            '<th>Nama Guru / Karyawan</th>' +
            '<th style="width: 85px;">Tanggal</th>' +
            '<th style="width: 140px;">Presensi Datang</th>' +
            '<th style="width: 140px;">Presensi Pulang</th>' +
            '<th>Keterangan / Alasan</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + rowsHtml + '</tbody>' +
      '</table>' +
      '<div class="ttd-container">' +
        '<div class="ttd-box">' +
          '<p>Mengetahui,</p>' +
          '<p><strong>Kepala Sekolah</strong></p>' +
          '<div class="ttd-space"></div>' +
          '<p><strong>( ........................................ )</strong></p>' +
        '</div>' +
        '<div class="ttd-box">' +
          '<p>Depok, ' + (tglCetak.indexOf(',') !== -1 ? tglCetak.split(',')[1].trim() : tglCetak) + '</p>' +
          '<p><strong>Bagian Tata Usaha</strong></p>' +
          '<div class="ttd-space"></div>' +
          '<p><strong>( ........................................ )</strong></p>' +
        '</div>' +
      '</div>';

    var htmlDoc = '<!DOCTYPE html>' +
      '<html lang="id"><head><meta charset="UTF-8"><title>' + namaFileDownload + '</title>' +
      '<style>' +
      'body { font-family: "Segoe UI", Arial, sans-serif; padding: 25px; color: #1e293b; line-height: 1.4; }' +
      '.kop { border-bottom: 3px double #065f46; padding-bottom: 12px; margin-bottom: 18px; text-align: center; }' +
      '.kop h2 { margin: 0; font-size: 20px; color: #065f46; letter-spacing: 0.5px; }' +
      '.kop h3 { margin: 4px 0 0 0; font-size: 13px; font-weight: 600; color: #334155; }' +
      '.kop p { margin: 3px 0 0 0; font-size: 11px; color: #64748b; }' +
      '.judul-laporan { text-align: center; font-size: 14px; font-weight: bold; text-transform: uppercase; margin: 15px 0 2px 0; letter-spacing: 0.8px; color: #0f172a; }' +
      '.sub-judul { text-align: center; font-size: 12px; font-weight: 600; color: #065f46; margin-bottom: 4px; }' +
      '.tgl-cetak { text-align: center; font-size: 11px; color: #64748b; margin-bottom: 16px; }' +
      'table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 25px; }' +
      'th, td { border: 1px solid #cbd5e1; padding: 7px 9px; }' +
      'th { background-color: #f1f5f9; color: #0f172a; text-transform: uppercase; font-size: 10px; font-weight: bold; }' +
      'tr:nth-child(even) { background-color: #f8fafc; }' +
      '.ttd-container { display: flex; justify-content: space-between; margin-top: 35px; font-size: 12px; page-break-inside: avoid; }' +
      '.ttd-box { width: 220px; text-align: center; }' +
      '.ttd-space { height: 65px; }' +
      '@media print { @page { size: A4 landscape; margin: 12mm; } body { padding: 0; } }' +
      '</style></head><body>' +
      bodyContentHtml +
      '<script>window.onload = function() { window.print(); };<\/script>' +
      '</body></html>';

    // Langsung Download Berkas PDF ke Perangkat jika html2pdf tersedia
    showNotif('Mengunduh PDF', 'Sedang menyiapkan berkas PDF (' + namaFileDownload + '.pdf)...', true);

    if (window.html2pdf) {
      var container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '1050px';
      container.style.background = '#ffffff';
      container.style.padding = '25px';
      container.style.color = '#1e293b';
      container.style.fontFamily = '"Segoe UI", Arial, sans-serif';
      container.innerHTML = '<style>' +
        '.kop { border-bottom: 3px double #065f46; padding-bottom: 12px; margin-bottom: 18px; text-align: center; }' +
        '.kop h2 { margin: 0; font-size: 20px; color: #065f46; }' +
        '.kop h3 { margin: 4px 0 0 0; font-size: 13px; font-weight: 600; color: #334155; }' +
        '.kop p { margin: 3px 0 0 0; font-size: 11px; color: #64748b; }' +
        '.judul-laporan { text-align: center; font-size: 14px; font-weight: bold; text-transform: uppercase; margin: 15px 0 2px 0; color: #0f172a; }' +
        '.sub-judul { text-align: center; font-size: 12px; font-weight: 600; color: #065f46; margin-bottom: 4px; }' +
        '.tgl-cetak { text-align: center; font-size: 11px; color: #64748b; margin-bottom: 16px; }' +
        'table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 25px; }' +
        'th, td { border: 1px solid #cbd5e1; padding: 7px 9px; }' +
        'th { background-color: #f1f5f9; color: #0f172a; text-transform: uppercase; font-size: 10px; font-weight: bold; }' +
        'tr:nth-child(even) { background-color: #f8fafc; }' +
        '.ttd-container { display: flex; justify-content: space-between; margin-top: 35px; font-size: 12px; }' +
        '.ttd-box { width: 220px; text-align: center; }' +
        '.ttd-space { height: 60px; }' +
        '</style>' + bodyContentHtml;
      document.body.appendChild(container);

      var opt = {
        margin: [8, 8, 8, 8],
        filename: namaFileDownload + '.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

      html2pdf().set(opt).from(container).save().then(function() {
        if (container.parentNode) document.body.removeChild(container);
        showNotif('Unduh Berhasil', 'Berkas PDF (' + namaFileDownload + '.pdf) berhasil diunduh ke folder Downloads Anda.', true);
      }).catch(function(err) {
        if (container.parentNode) document.body.removeChild(container);
        console.error('html2pdf fallback to print:', err);
        fallbackPrintWindow(htmlDoc);
      });
    } else {
      fallbackPrintWindow(htmlDoc);
    }
  }).catch(function(err) {
    showNotif('Gagal Membuka Dokumen', 'Terjadi kesalahan: ' + (err.message || err), false);
  });
}

function downloadRekapCsv() {
  var sb = typeof getSupabase === 'function' ? getSupabase() : null;
  var selGuru = document.getElementById('filterGuru');
  var selectedGuruId = (selGuru && selGuru.value) ? selGuru.value : 'ALL';
  var selectedGuruName = (selGuru && selGuru.selectedIndex >= 0 && selectedGuruId !== 'ALL') ? selGuru.options[selGuru.selectedIndex].text : '';
  var searchVal = document.getElementById('searchAdminRekap') ? document.getElementById('searchAdminRekap').value.trim() : '';

  var fetchPromise;
  if (sb) {
    var query = sb.from('absensi').select('*').order('created_at', { ascending: false });
    if (selectedGuruId !== 'ALL') {
      query = query.eq('id_user', selectedGuruId);
    }
    if (searchVal) {
      query = query.ilike('nama_guru', '%' + searchVal + '%');
    }
    fetchPromise = query;
  } else {
    var filtered = cachedRekapData || [];
    if (selectedGuruId !== 'ALL') {
      filtered = filtered.filter(function(r) { return r.id_user === selectedGuruId || r.nama_guru === selectedGuruName; });
    }
    if (searchVal) {
      filtered = filtered.filter(function(r) { return (r.nama_guru || '').toLowerCase().indexOf(searchVal.toLowerCase()) !== -1; });
    }
    fetchPromise = Promise.resolve({ data: filtered });
  }

  fetchPromise.then(function(res) {
    var data = (res && res.data && res.data.length > 0) ? res.data : (res && Array.isArray(res)) ? res : [];
    if (!data || data.length === 0) {
      showNotif('Data Kosong', 'Tidak ada data presensi yang sesuai dengan filter guru yang dipilih.', false);
      return;
    }

    var namaGuruClean = selectedGuruName ? selectedGuruName.replace(/[^a-zA-Z0-9]/g, '_') : 'Semua_Guru';
    var tglFile = new Date().toISOString().slice(0, 10);
    var namaFileDownload = 'Rekap_Presensi_' + namaGuruClean + '_' + tglFile;

    // OPSI 1: Format Asli Microsoft Excel (.xlsx) dengan SheetJS (Rapi per kolom)
    if (window.XLSX && XLSX.utils) {
      var rowsFormatted = data.map(function(r, idx) {
        return {
          'No': idx + 1,
          'ID Absensi': r.id_absen || '',
          'Nama Guru / Karyawan': r.nama_guru || '',
          'Tanggal': r.tanggal || '',
          'Jam Datang': r.jam_masuk || '-',
          'Status Datang': r.status_masuk || '-',
          'Jam Pulang': r.jam_pulang || '-',
          'Status Pulang': r.status_pulang || '-',
          'Alasan / Keterangan': (r.alasan_masuk || '') + (r.alasan_pulang ? ' | ' + r.alasan_pulang : '') || '-',
          'Link Foto Selfie Datang': r.foto_masuk || '-',
          'Link Foto Selfie Pulang': r.foto_pulang || '-'
        };
      });

      var ws = XLSX.utils.json_to_sheet(rowsFormatted);

      // Auto-fit Column Widths (Lebar kolom pas dan rapi)
      var colWidths = [
        { wch: 6 },   // No
        { wch: 22 },  // ID Absensi
        { wch: 28 },  // Nama Guru
        { wch: 14 },  // Tanggal
        { wch: 12 },  // Jam Datang
        { wch: 16 },  // Status Datang
        { wch: 12 },  // Jam Pulang
        { wch: 16 },  // Status Pulang
        { wch: 30 },  // Alasan / Keterangan
        { wch: 45 },  // Link Foto Datang
        { wch: 45 }   // Link Foto Pulang
      ];
      ws['!cols'] = colWidths;

      var wb = XLSX.utils.book_new();
      var sheetName = selectedGuruName ? selectedGuruName.slice(0, 30) : 'Log Presensi';
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      // Tambahkan Sheet 2: Ringkasan Persentase Multi-Periode (Mingguan, Bulanan, Tahunan)
      var allSource = (cachedRekapData && cachedRekapData.length > 0) ? cachedRekapData : data;
      var tripleStats = calculateTriplePeriodStats(allSource, cachedGuruList, cachedIzinList);

      var rowsPersen = tripleStats.combinedGuruList.map(function(t, idx) {
        return {
          'No': idx + 1,
          'Nama Guru / Karyawan': t.nama_guru,
          'Kehadiran Minggu Ini (%)': t.minggu.persenHadir + '%',
          'Rasio Minggu Ini': t.minggu.totalHadir + ' / ' + t.minggu.hariEfektif + ' Hari',
          'Izin (Minggu)': t.minggu.totalIzin + ' Hari',
          'Tidak Absen (Minggu)': t.minggu.totalTidakHadir + ' Hari',
          'Kehadiran Bulan Ini (%)': t.bulan.persenHadir + '%',
          'Rasio Bulan Ini': t.bulan.totalHadir + ' / ' + t.bulan.hariEfektif + ' Hari',
          'Izin (Bulan)': t.bulan.totalIzin + ' Hari',
          'Tidak Absen (Bulan)': t.bulan.totalTidakHadir + ' Hari',
          'Kehadiran Tahun Ini (%)': t.tahun.persenHadir + '%',
          'Rasio Tahun Ini': t.tahun.totalHadir + ' / ' + t.tahun.hariEfektif + ' Hari',
          'Izin (Tahun)': t.tahun.totalIzin + ' Hari',
          'Tidak Absen (Tahun)': t.tahun.totalTidakHadir + ' Hari',
          'Tepat Waktu (Bulan)': t.bulan.tepatCount,
          'Terlambat (Bulan)': t.bulan.lambatCount
        };
      });

      // Baris total kolektif seluruh guru
      rowsPersen.push({
        'No': '',
        'Nama Guru / Karyawan': 'TOTAL KOLEKTIF SELURUH GURU',
        'Kehadiran Minggu Ini (%)': tripleStats.statsMinggu.persenKolektif + '%',
        'Rasio Minggu Ini': tripleStats.statsMinggu.totalAktualHadir + ' / ' + tripleStats.statsMinggu.totalTargetSesi + ' Sesi',
        'Izin (Minggu)': tripleStats.statsMinggu.totalAktualIzin + ' Sesi',
        'Tidak Absen (Minggu)': tripleStats.statsMinggu.totalTidakAbsenSesi + ' Sesi',
        'Kehadiran Bulan Ini (%)': tripleStats.statsBulan.persenKolektif + '%',
        'Rasio Bulan Ini': tripleStats.statsBulan.totalAktualHadir + ' / ' + tripleStats.statsBulan.totalTargetSesi + ' Sesi',
        'Izin (Bulan)': tripleStats.statsBulan.totalAktualIzin + ' Sesi',
        'Tidak Absen (Bulan)': tripleStats.statsBulan.totalTidakAbsenSesi + ' Sesi',
        'Kehadiran Tahun Ini (%)': tripleStats.statsTahun.persenKolektif + '%',
        'Rasio Tahun Ini': tripleStats.statsTahun.totalAktualHadir + ' / ' + tripleStats.statsTahun.totalTargetSesi + ' Sesi',
        'Izin (Tahun)': tripleStats.statsTahun.totalAktualIzin + ' Sesi',
        'Tidak Absen (Tahun)': tripleStats.statsTahun.totalTidakAbsenSesi + ' Sesi',
        'Tepat Waktu (Bulan)': tripleStats.statsBulan.totalTepat,
        'Terlambat (Bulan)': tripleStats.statsBulan.totalLambat
      });

      var wsPersen = XLSX.utils.json_to_sheet(rowsPersen);
      wsPersen['!cols'] = [
        { wch: 6 },   // No
        { wch: 32 },  // Nama Guru
        { wch: 22 },  // % Minggu
        { wch: 18 },  // Rasio Minggu
        { wch: 14 },  // Izin Minggu
        { wch: 18 },  // Tdk Absen Minggu
        { wch: 22 },  // % Bulan
        { wch: 18 },  // Rasio Bulan
        { wch: 14 },  // Izin Bulan
        { wch: 18 },  // Tdk Absen Bulan
        { wch: 22 },  // % Tahun
        { wch: 18 },  // Rasio Tahun
        { wch: 14 },  // Izin Tahun
        { wch: 18 },  // Tdk Absen Tahun
        { wch: 18 },  // Tepat Waktu
        { wch: 18 }   // Terlambat
      ];
      XLSX.utils.book_append_sheet(wb, wsPersen, 'Persentase Kehadiran');

      XLSX.writeFile(wb, namaFileDownload + '.xlsx');

      showNotif('Unduh Berhasil', 'Berkas Excel (.xlsx) ' + (selectedGuruName ? 'untuk ' + selectedGuruName : 'semua guru') + ' berhasil diunduh.', true);
      return;
    }

    // OPSI 2: Fallback CSV Kompatibel Indonesia (Semicolon ; Delimiter + sep=;)
    var headers = ['No', 'ID Absensi', 'Nama Guru', 'Tanggal', 'Jam Datang', 'Status Datang', 'Jam Pulang', 'Status Pulang', 'Alasan', 'Foto Datang', 'Foto Pulang'];
    var rows = ['sep=;', headers.join(';')];

    data.forEach(function(r, idx) {
      var row = [
        idx + 1,
        '"' + (r.id_absen || '') + '"',
        '"' + (r.nama_guru || '').replace(/"/g, '""') + '"',
        '"' + (r.tanggal || '') + '"',
        '"' + (r.jam_masuk || '-') + '"',
        '"' + (r.status_masuk || '-') + '"',
        '"' + (r.jam_pulang || '-') + '"',
        '"' + (r.status_pulang || '-') + '"',
        '"' + ((r.alasan_masuk || '') + (r.alasan_pulang ? ' ' + r.alasan_pulang : '')).replace(/"/g, '""') + '"',
        '"' + (r.foto_masuk || '') + '"',
        '"' + (r.foto_pulang || '') + '"'
      ];
      rows.push(row.join(';'));
    });

    var csvContent = '\uFEFF' + rows.join('\r\n');
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', namaFileDownload + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotif('Unduh Berhasil', 'Berkas tabel presensi berhasil diunduh.', true);
  }).catch(function(err) {
    showNotif('Gagal Unduh', 'Terjadi kesalahan: ' + (err.message || err), false);
  });
}

