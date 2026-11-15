// ==============================================
// LOGIN PAGE
// ==============================================

(function () {
  'use strict';

  var form = document.getElementById('loginForm');
  if (!form) return;

  var emailInput = form.querySelector('[name="email"]');
  var passwordInput = form.querySelector('[name="password"]');
  var submitBtn = form.querySelector('[name="loginButton"]');
  var alertBox = document.getElementById('formAlert');

  /** Only internal pages may be used as a redirect target. */
  function redirectTarget() {
    var target = new URLSearchParams(window.location.search).get('redirect');
    if (target && /^[a-zA-Z0-9._-]+\.html$/.test(target)) return target;
    return 'index.html';
  }

  function showAlert(message) {
    if (!alertBox) return;
    alertBox.textContent = message || '';
    alertBox.style.display = message ? 'block' : 'none';
    alertBox.classList.remove('mz-ok');
  }

  function showReason() {
    var reason = new URLSearchParams(window.location.search).get('reason');
    if (reason) showAlert(reason);
  }

  // Somebody who is already signed in does not need this page.
  MagizhamAuth.ready().then(function (user) {
    if (user) window.location.href = redirectTarget();
  });

  showReason();

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    MagizhamUI.clearFieldErrors(form);
    showAlert('');

    var email = (emailInput.value || '').trim();
    var password = passwordInput.value || '';

    if (!email) {
      MagizhamUI.setFieldError(emailInput, 'Please enter your e-mail address.');
      return;
    }
    if (!password) {
      MagizhamUI.setFieldError(passwordInput, 'Please enter your password.');
      return;
    }

    MagizhamUI.setBusy(submitBtn, true, 'Signing in...');

    MagizhamAuth.login(email, password)
      .then(function (user) {
        // The guest cart is moved into the account before the redirect.
        return (window.magizhamCartReady ? window.magizhamCartReady() : null).then(function () {
          return user;
        });
      })
      .then(function (user) {
        MagizhamUI.toast('Welcome back, ' + (user ? user.name : '') + '!', 'info');
        window.location.href = redirectTarget();
      })
      .catch(function (err) {
        MagizhamUI.setBusy(submitBtn, false);
        MagizhamUI.applyValidationErrors(form, err && err.details);
        showAlert((err && err.message) || 'The login failed. Please try again.');
      });
  });
})();
