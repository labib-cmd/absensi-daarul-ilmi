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




