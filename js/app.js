/**
 * ====================================================================
 * APP.JS - Inisialisasi Aplikasi Utama & Notifikasi
 * ====================================================================
 */

window.addEventListener('DOMContentLoaded', function() {
  if (window.lucide) {
    lucide.createIcons();
  }
  setTodayLabel();
  restoreUserSession();
});

function setTodayLabel() {
  var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  var today = new Date().toLocaleDateString('id-ID', options);
  var el = document.getElementById('txtHariIni');
  if (el) el.innerText = today;
}

// Dialog Pop-up Notifikasi (Toast Kustom)
function showNotif(title, msg, isSuccess) {
  document.getElementById('notifTitle').innerText = title;
  document.getElementById('notifMessage').innerText = msg;
  var box = document.getElementById('notifIconBox');
  
  if (isSuccess) {
    box.className = 'w-12 h-12 rounded-full mx-auto flex items-center justify-center bg-emerald-100 text-emerald-700';
  } else {
    box.className = 'w-12 h-12 rounded-full mx-auto flex items-center justify-center bg-rose-100 text-rose-700';
  }
  
  document.getElementById('modalNotif').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeNotif() {
  document.getElementById('modalNotif').classList.add('hidden');
}

// Modal Preview Foto Selfie
function openFotoModal(urlFoto, namaGuru, tipe) {
  if (!urlFoto || urlFoto === '-') {
    showNotif('Foto Tidak Tersedia', 'Belum ada bukti foto selfie untuk presensi ini.', false);
    return;
  }

  document.getElementById('viewFotoTitle').innerText = 'Foto ' + tipe;
  document.getElementById('viewFotoSub').innerText = namaGuru;
  
  var loader = document.getElementById('viewFotoLoader');
  if (loader) loader.classList.remove('hidden');

  var img = document.getElementById('imgFotoDetail');
  img.src = urlFoto;

  var btnLink = document.getElementById('btnBukaLinkFoto');
  if (btnLink) {
    btnLink.href = urlFoto;
  }

  document.getElementById('modalViewFoto').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeFotoModal() {
  document.getElementById('modalViewFoto').classList.add('hidden');
  var img = document.getElementById('imgFotoDetail');
  if (img) img.src = '';
}

function handleFotoLoadError() {
  var loader = document.getElementById('viewFotoLoader');
  if (loader) loader.classList.add('hidden');
}

// ====================================================================
// MODUL SISTEM NOTIFIKASI PUSH & SOUND CHIME
// ====================================================================

// Efek suara denting bel notifikasi (Web Audio API internal tanpa audio eksternal)
function playNotificationChime() {
  try {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    var ctx = new AudioCtx();
    var now = ctx.currentTime;
    
    var osc1 = ctx.createOscillator();
    var osc2 = ctx.createOscillator();
    var gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now); // A5
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.15); // D6

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.08);
    osc1.stop(now + 0.5);
    osc2.stop(now + 0.5);
  } catch (err) {
    // Abaikan jika browser belum mengizinkan autoplay audio
  }
}

// Fungsi Utama Pemicu Notifikasi Pop-up Sistem HP / Laptop
function triggerSystemNotification(title, options) {
  playNotificationChime();

  if (!('Notification' in window)) {
    return;
  }

  var opt = Object.assign({
    icon: 'img/logo.jpg',
    badge: 'img/logo.jpg',
    vibrate: [200, 100, 200]
  }, options || {});

  if (Notification.permission === 'granted') {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(function(reg) {
        reg.showNotification(title, opt);
      }).catch(function() {
        try { new Notification(title, opt); } catch (e) {}
      });
    } else {
      try { new Notification(title, opt); } catch (e) {}
    }
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(function(perm) {
      if (perm === 'granted') {
        try { new Notification(title, opt); } catch (e) {}
      }
    });
  }
}

// Permintaan Izin Notifikasi Otomatis
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    try {
      Notification.requestPermission();
    } catch (e) {}
  }
}

// Listener pesan dari Service Worker (misal: saat notifikasi diklik)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SWITCH_TAB') {
      if (typeof switchAdminTab === 'function') {
        switchAdminTab(event.data.tab);
      }
    }
  });
}




