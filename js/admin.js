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
  filterMonitoring: 'ALL',
  filterGuru: 'ALL'
};

var cachedRealtimeMonitoring = [];
var cachedGuruList = [];
var cachedRekapData = [];
var activeApprovalId = null;
var activeEditGuru = null;

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
      var fotoMBtn = g.detail.foto_masuk 
        ? '<button type="button" onclick="openFotoModal(\'' + g.detail.foto_masuk + '\', \'' + g.nama_guru + '\', \'Datang\')" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[9px] font-bold flex items-center justify-center space-x-1 mt-1.5 transition"><i data-lucide="image" class="w-3 h-3"></i><span>Lihat Foto</span></button>' 
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
      var fotoPBtn = g.detail.foto_pulang 
        ? '<button type="button" onclick="openFotoModal(\'' + g.detail.foto_pulang + '\', \'' + g.nama_guru + '\', \'Pulang\')" class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-[9px] font-bold flex items-center justify-center space-x-1 mt-1.5 transition"><i data-lucide="image" class="w-3 h-3"></i><span>Lihat Foto</span></button>' 
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

    var headerRow = '<div class="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">' +
      '<div class="min-w-0 flex items-center space-x-2">' +
        '<div class="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs flex-shrink-0">' +
          (g.nama_guru ? g.nama_guru.charAt(0).toUpperCase() : 'G') +
        '</div>' +
        '<p class="font-bold text-slate-800 truncate text-xs sm:text-sm">' + g.nama_guru + '</p>' +
      '</div>' +
      '<div class="flex items-center space-x-1.5 flex-shrink-0">' +
        '<span class="text-[9px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap ' + badgeClass + '">' + badgeText + '</span>' +
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

function renderAdminDashboard(res) {
  document.getElementById('admTotalGuru').innerText = res.stats.totalGuru || 0;
  document.getElementById('admSudahAbsen').innerText = res.stats.sudahAbsenMasukToday || 0;
  var elSudahPulang = document.getElementById('admSudahPulang');
  if (elSudahPulang) elSudahPulang.innerText = res.stats.sudahAbsenPulangToday || 0;
  document.getElementById('admBelumAbsen').innerText = res.stats.belumAbsenToday || 0;

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
    document.getElementById('cfgLat').value = res.settings.LAT_SEKOLAH || '-6.3982';
    document.getElementById('cfgLong').value = res.settings.LONG_SEKOLAH || '106.8271';
    document.getElementById('cfgRadius').value = res.settings.MAX_RADIUS_METER || '300';
    document.getElementById('cfgJamMasuk').value = res.settings.JAM_MASUK_STD || '07:00';
    document.getElementById('cfgJamPulang').value = res.settings.JAM_PULANG_STD || '16:00';
    updateGoogleMapsPreview();
  }

  cachedRealtimeMonitoring = res.realtimeMonitoring || [];
  cachedRekapData = res.rekapitulasi || [];
  renderRealtimeMonitoringList();

  var tbody = document.getElementById('tblRekapAdmin');
  tbody.innerHTML = '';
  if (!res.rekapitulasi || res.rekapitulasi.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="p-3 text-center text-slate-400">Tidak ada rekap data.</td></tr>';
  } else {
    res.rekapitulasi.forEach(function(r) {
      var tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition';
      
      var statMColor = r.status_masuk === 'Tepat Waktu' ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50';
      var statPColor = r.status_pulang === 'Tepat Waktu' ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50';

      var btnFotoM = r.foto_masuk ? ' <button type="button" onclick="openFotoModal(\'' + r.foto_masuk + '\', \'' + r.nama_guru + '\', \'Masuk\')" class="text-emerald-700 hover:text-emerald-900 inline" title="Lihat Foto Masuk"><i data-lucide="image" class="w-3 h-3 inline"></i></button>' : '';
      var btnFotoP = r.foto_pulang ? ' <button type="button" onclick="openFotoModal(\'' + r.foto_pulang + '\', \'' + r.nama_guru + '\', \'Pulang\')" class="text-emerald-700 hover:text-emerald-900 inline" title="Lihat Foto Pulang"><i data-lucide="image" class="w-3 h-3 inline"></i></button>' : '';

      var labelHariTgl = (r.hari ? '<span class="font-bold text-slate-800">' + r.hari + ',</span> ' : '') + r.tanggal;

      var tdG = '<td class="p-1.5 font-bold text-slate-700">' + r.nama_guru + '</td>';
      var tdT = '<td class="p-1.5 text-slate-500 whitespace-nowrap">' + labelHariTgl + '</td>';
      var tdM = '<td class="p-1.5"><span class="font-semibold">' + (r.jam_masuk || '--') + '</span> ' + 
        (r.status_masuk ? '<span class="text-[8px] px-1 py-0.5 rounded font-bold ' + statMColor + '">' + r.status_masuk + '</span>' : '') + btnFotoM + '</td>';
      var tdP = '<td class="p-1.5"><span class="font-semibold">' + (r.jam_pulang || '--') + '</span> ' + 
        (r.status_pulang ? '<span class="text-[8px] px-1 py-0.5 rounded font-bold ' + statPColor + '">' + r.status_pulang + '</span>' : '') + btnFotoP + '</td>';
      
      tr.innerHTML = tdG + tdT + tdM + tdP;
      tbody.appendChild(tr);
    });
  }

  document.getElementById('pageInfoAdmin').innerText = 'Hal ' + res.pagination.currentPage + ' dari ' + res.pagination.totalPages;
  document.getElementById('btnPrevAdmin').disabled = (res.pagination.currentPage <= 1);
  document.getElementById('btnNextAdmin').disabled = (res.pagination.currentPage >= res.pagination.totalPages);
  lucide.createIcons();
}

function updateGoogleMapsPreview() {
  var lat = document.getElementById('cfgLat').value.trim() || '-6.3982';
  var long = document.getElementById('cfgLong').value.trim() || '106.8271';
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
  if (!badge) return;

  if (list && Array.isArray(list)) {
    var pendingCount = list.filter(function(x) { return x && x.status === 'PENDING'; }).length;
    if (pendingCount > 0) {
      badge.innerText = pendingCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
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
    
    var header = '<div class="flex items-center justify-between border-b border-slate-100 pb-2">' +
      '<div class="flex items-center space-x-2 min-w-0">' +
        '<div class="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs flex-shrink-0">' +
          (item.nama_guru ? item.nama_guru.charAt(0).toUpperCase() : 'G') +
        '</div>' +
        '<span class="font-bold text-slate-800 truncate text-xs sm:text-sm">' + (item.nama_guru || 'Guru') + '</span>' +
      '</div>' +
      '<span class="text-[9px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap ' + badgeClass + '">' + statusLabel + '</span>' +
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

function downloadRekapPdf() {
  var sb = typeof getSupabase === 'function' ? getSupabase() : null;
  var fetchPromise;
  
  if (sb) {
    fetchPromise = sb.from('absensi').select('*').order('created_at', { ascending: false });
  } else {
    fetchPromise = Promise.resolve({ data: cachedRekapData });
  }

  fetchPromise.then(function(res) {
    var data = (res && res.data && res.data.length > 0) ? res.data : cachedRekapData;
    if (!data || data.length === 0) {
      showNotif('Data Kosong', 'Belum ada data presensi yang tercatat untuk dicetak.', false);
      return;
    }

    var tglCetak = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
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

    var printWindow = window.open('', '_blank');
    if (!printWindow) {
      showNotif('Popup Terblokir', 'Harap izinkan popup pada browser Anda untuk membuka pratinjau cetak PDF.', false);
      return;
    }

    var htmlDoc = '<!DOCTYPE html>' +
      '<html lang="id"><head><meta charset="UTF-8"><title>Rekap Presensi - SMA Islam Daarul Ilmi Depok</title>' +
      '<style>' +
      'body { font-family: "Segoe UI", Arial, sans-serif; padding: 25px; color: #1e293b; line-height: 1.4; }' +
      '.kop { border-bottom: 3px double #065f46; padding-bottom: 12px; margin-bottom: 18px; text-align: center; }' +
      '.kop h2 { margin: 0; font-size: 20px; color: #065f46; letter-spacing: 0.5px; }' +
      '.kop h3 { margin: 4px 0 0 0; font-size: 13px; font-weight: 600; color: #334155; }' +
      '.kop p { margin: 3px 0 0 0; font-size: 11px; color: #64748b; }' +
      '.judul-laporan { text-align: center; font-size: 14px; font-weight: bold; text-transform: uppercase; margin: 15px 0 4px 0; letter-spacing: 0.8px; color: #0f172a; }' +
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
      '<div class="kop">' +
        '<h2>SMA ISLAM DAARUL ILMI DEPOK</h2>' +
        '<h3>SISTEM INFORMASI PRESENSI GURU & KARYAWAN</h3>' +
        '<p>Kota Depok, Jawa Barat | Email: info@daarulilmi.sch.id</p>' +
      '</div>' +
      '<div class="judul-laporan">Laporan Rekapitulasi Presensi Kehadiran</div>' +
      '<div class="tgl-cetak">Waktu Cetak: ' + tglCetak + '</div>' +
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
      '</div>' +
      '<script>' +
        'window.onload = function() { window.print(); };' +
      '<\/script>' +
      '</body></html>';

    printWindow.document.open();
    printWindow.document.write(htmlDoc);
    printWindow.document.close();
  }).catch(function(err) {
    showNotif('Gagal Membuka Dokumen', 'Terjadi kesalahan: ' + (err.message || err), false);
  });
}

function downloadRekapCsv() {
  var sb = typeof getSupabase === 'function' ? getSupabase() : null;
  var fetchPromise;
  
  if (sb) {
    fetchPromise = sb.from('absensi').select('*').order('created_at', { ascending: false });
  } else {
    fetchPromise = Promise.resolve({ data: cachedRekapData });
  }

  fetchPromise.then(function(res) {
    var data = (res && res.data && res.data.length > 0) ? res.data : cachedRekapData;
    if (!data || data.length === 0) {
      showNotif('Data Kosong', 'Belum ada data presensi yang tercatat untuk diunduh.', false);
      return;
    }

    var tglFile = new Date().toISOString().slice(0, 10);

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
      XLSX.utils.book_append_sheet(wb, ws, 'Rekap Kehadiran');
      XLSX.writeFile(wb, 'Rekap_Presensi_SMA_Islam_Daarul_Ilmi_' + tglFile + '.xlsx');

      showNotif('Unduh Berhasil', 'Berkas Excel (.xlsx) rapi per-kolom berhasil diunduh ke komputer Anda.', true);
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
    link.setAttribute('download', 'Rekap_Presensi_SMA_Islam_Daarul_Ilmi_' + tglFile + '.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotif('Unduh Berhasil', 'Berkas tabel presensi berhasil diunduh.', true);
  }).catch(function(err) {
    showNotif('Gagal Unduh', 'Terjadi kesalahan: ' + (err.message || err), false);
  });
}

