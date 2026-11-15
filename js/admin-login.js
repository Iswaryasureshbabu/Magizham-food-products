// ==============================================
// ADMIN LOGIN SCRIPT
// Dedicated authentication workflow for administrators
// ==============================================

(function () {
  'use strict';

  var form = document.getElementById('adminLoginForm');
  var alertBox = document.getElementById('formAlert');
  var submitBtn = document.getElementById('adminLoginBtn');

  function showAlert(message, type) {
    if (!alertBox) return;
    alertBox.className = 'mz-alert ' + (type || 'error');
    alertBox.textContent = message;
    alertBox.style.display = 'block';
  }

  function hideAlert() {
    if (!alertBox) return;
    alertBox.style.display = 'none';
  }

  // If already logged in as admin, redirect to admin dashboard
  MagizhamAuth.ready().then(function (user) {
    if (user && user.role === 'admin') {
      window.location.replace('admin.html');
    }
  });

  if (!form) return;

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    hideAlert();

    var emailInput = document.getElementById('adminEmail');
    var passwordInput = document.getElementById('adminPassword');

    var email = (emailInput ? emailInput.value : '').trim();
    var password = passwordInput ? passwordInput.value : '';

    if (!email) {
      showAlert('Please enter your administrator e-mail address.', 'error');
      if (emailInput) emailInput.focus();
      return;
    }

    if (!password) {
      showAlert('Please enter your administrator password.', 'error');
      if (passwordInput) passwordInput.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';
    }

    MagizhamAuth.login(email, password)
      .then(function (user) {
        if (!user || user.role !== 'admin') {
          // Immediately log out non-admin accounts from the admin portal
          return MagizhamAuth.logout().then(function () {
            showAlert('Access denied: This account does not have administrator permissions. Please use the customer login.', 'error');
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In to Admin Portal';
            }
          });
        }

        MagizhamUI.toast('Welcome to Magizham Admin Portal, ' + (user.name || 'Admin') + '!', 'success');
        setTimeout(function () {
          window.location.href = 'admin.html';
        }, 300);
      })
      .catch(function (err) {
        var msg = (err && err.message) || 'Unable to sign in. Please verify your credentials.';
        showAlert(msg, 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In to Admin Portal';
        }
      });
  });
})();
