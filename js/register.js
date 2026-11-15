// ==============================================
// REGISTER PAGE
// ==============================================

(function () {
  'use strict';

  var form = document.getElementById('registerForm');
  if (!form) return;

  var nameInput = form.querySelector('[name="name"]');
  var emailInput = form.querySelector('[name="email"]');
  var passwordInput = form.querySelector('[name="password"]');
  var confirmInput = form.querySelector('[name="confirm_password"]');
  var submitBtn = form.querySelector('[name="registerButton"]');
  var alertBox = document.getElementById('formAlert');

  function showAlert(message) {
    if (!alertBox) return;
    alertBox.textContent = message || '';
    alertBox.style.display = message ? 'block' : 'none';
    alertBox.classList.remove('mz-ok');
  }

  MagizhamAuth.ready().then(function (user) {
    if (user) window.location.href = 'index.html';
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    MagizhamUI.clearFieldErrors(form);
    showAlert('');

    var name = (nameInput.value || '').trim();
    var email = (emailInput.value || '').trim();
    var password = passwordInput.value || '';
    var confirm = confirmInput.value || '';

    if (name.length < 2) {
      MagizhamUI.setFieldError(nameInput, 'Please enter your name.');
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      MagizhamUI.setFieldError(emailInput, 'Please provide a valid e-mail address.');
      return;
    }
    if (password.length < 8) {
      MagizhamUI.setFieldError(passwordInput, 'The password must be at least 8 characters.');
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      MagizhamUI.setFieldError(passwordInput, 'The password needs a letter and a number.');
      return;
    }
    if (password !== confirm) {
      MagizhamUI.setFieldError(confirmInput, 'The two passwords do not match.');
      return;
    }

    MagizhamUI.setBusy(submitBtn, true, 'Creating your account...');

    MagizhamAuth.register(name, email, password)
      .then(function (user) {
        return (window.magizhamCartReady ? window.magizhamCartReady() : null).then(function () {
          return user;
        });
      })
      .then(function (user) {
        MagizhamUI.toast('Welcome, ' + (user ? user.name : '') + '!', 'info');
        window.location.href = 'index.html';
      })
      .catch(function (err) {
        MagizhamUI.setBusy(submitBtn, false);
        MagizhamUI.applyValidationErrors(form, err && err.details);
        showAlert((err && err.message) || 'The registration failed. Please try again.');
      });
  });
})();
