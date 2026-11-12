/**
 * ====================================================================
 * AUTH.JS - Manajemen Sesi Pengguna & Login
 * ====================================================================
 */

var currentUser = null;

function restoreUserSession() {
  try {
    var savedUser = localStorage.getItem('daarulilmi_user');
    var savedTab = localStorage.getItem('daarulilmi_last_tab');
    if (savedUser) {
      currentUser = JSON.parse(savedUser);
      if (currentUser && currentUser.id_user) {
        if (savedTab && currentUser.role !== 'Guru' && window.stateAdmin) {
          window.stateAdmin.tab = savedTab;
        }
        onLoginSuccess(true);
      }
    }
  } catch (e) {
    console.warn('Gagal memulihkan session pengguna:', e);
  }
}

function togglePasswordVisibility() {
  var pwd = document.getElementById('loginPassword');
  pwd.type = (pwd.type === 'password') ? 'text' : 'password';
}

function quickFillLogin(email, pass) {
  document.getElementById('loginEmail').value = email;
  document.getElementById('loginPassword').value = pass;
  document.getElementById('formLogin').dispatchEvent(new Event('submit'));
}

function handleLogin(e) {
  e.preventDefault();
  var email = document.getElementById('loginEmail').value.trim();
  var password = document.getElementById('loginPassword').value.trim();
  var btn = document.getElementById('btnLoginSubmit');
  
  btn.disabled = true;
  btn.innerText = 'MEMPROSES...';

  API.login(email, password).then(function(res) {
    btn.disabled = false;
    btn.innerText = 'MASUK APLIKASI';
    if (res.success) {
      currentUser = res.user;
      localStorage.setItem('daarulilmi_user', JSON.stringify(currentUser));
      onLoginSuccess(false);
    } else {
      showNotif('Gagal Masuk', res.message, false);
    }
  });
}

function onLoginSuccess(isRestored) {
  document.getElementById('viewLogin').classList.add('hidden');
  document.getElementById('btnLogout').classList.remove('hidden');
  document.getElementById('userWelcome').classList.remove('hidden');
  
  document.getElementById('displayUserName').innerText = currentUser.nama_guru;
  document.getElementById('displayUserRole').innerText = currentUser.role;

  if (currentUser.role === 'Guru') {
    document.getElementById('viewGuru').classList.remove('hidden');
    loadGuruDashboard();
  } else {
    document.getElementById('viewAdmin').classList.remove('hidden');
    loadAdminData();
    if (isRestored && window.stateAdmin && window.stateAdmin.tab) {
      switchAdminTab(window.stateAdmin.tab);
    }
  }
}

function handleLogout() {
  currentUser = null;
  localStorage.removeItem('daarulilmi_user');
  localStorage.removeItem('daarulilmi_last_tab');
  document.getElementById('displayUserName').innerText = '';
  if (document.getElementById('loginEmail')) document.getElementById('loginEmail').value = '';
  if (document.getElementById('loginPassword')) document.getElementById('loginPassword').value = '';
  document.getElementById('viewGuru').classList.add('hidden');
  document.getElementById('viewAdmin').classList.add('hidden');
  document.getElementById('userWelcome').classList.add('hidden');
  document.getElementById('btnLogout').classList.add('hidden');
  document.getElementById('viewLogin').classList.remove('hidden');
}

