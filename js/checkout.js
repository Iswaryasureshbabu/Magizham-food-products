// ==============================================
// CHECKOUT PAGE
// The order is placed with the API - prices, stock and totals are
// calculated on the server, never in the browser.
// ==============================================

(function () {
  'use strict';

  var page = document.getElementById('checkoutPage');
  if (!page) return;

  var summaryBox = document.getElementById('checkoutSummary');
  var emptyBox = document.getElementById('checkoutEmpty');
  var formBox = document.getElementById('checkoutFormBox');
  var form = document.getElementById('checkoutForm');
  var nameInput = form.querySelector('[name="customer_name"]');
  var phoneInput = form.querySelector('[name="phone"]');
  var addressInput = form.querySelector('[name="delivery_address"]');
  var submitBtn = form.querySelector('[name="placeOrder"]');
  var alertBox = document.getElementById('formAlert');
  var lang = MagizhamUI.currentLang();

  function showAlert(message, ok) {
    if (!alertBox) return;
    alertBox.textContent = message || '';
    alertBox.style.display = message ? 'block' : 'none';
    alertBox.classList.toggle('mz-ok', !!ok);
  }

  function label(key, fallback) {
    var t = (typeof translations !== 'undefined') ? translations[lang] : null;
    return (t && t[key]) || fallback;
  }

  MagizhamAuth.requireLogin()
    .then(function (user) {
      if (user && user.name && nameInput && !nameInput.value) nameInput.value = user.name;
      return MagizhamAPI.getCart();
    })
    .then(function (cart) {
      var items = (cart && cart.items) || [];

      if (!items.length) {
        if (emptyBox) emptyBox.style.display = '';
        if (formBox) formBox.style.display = 'none';
        if (summaryBox) summaryBox.style.display = 'none';
        return;
      }

      var rows = '';
      items.forEach(function (item) {
        var name = MagizhamUI.pick(
          { name: item.product_name, name_ta: item.product_name_ta },
          'name',
          lang
        );
        var unit = MagizhamUI.toNumber(item.unit_price);
        var subtotal = unit * (item.quantity || 0);
        var stock = item.stock_quantity;
        var warning = '';
        if (item.is_available === false) {
          warning = '<div class="mz-stock-warning">' +
            MagizhamUI.escapeHtml(label('checkoutUnavailable', 'No longer available')) + '</div>';
        } else if (stock !== undefined && stock !== null && item.quantity > stock) {
          warning = '<div class="mz-stock-warning">' +
            MagizhamUI.escapeHtml(label('checkoutStock', 'Only {n} in stock').replace('{n}', stock)) +
            '</div>';
        }

        rows +=
          '<div class="mz-summary-row">' +
            '<span>' + MagizhamUI.escapeHtml(name) +
              ' <span class="mz-qty">x ' + item.quantity + '</span>' +
              warning +
            '</span>' +
            '<span>' + MagizhamUI.escapeHtml(MagizhamUI.formatPrice(subtotal)) + '</span>' +
          '</div>';
      });

      var total = items.reduce(function (sum, item) {
        return sum + MagizhamUI.toNumber(item.unit_price) * (item.quantity || 0);
      }, 0);

      rows +=
        '<div class="mz-summary-row mz-summary-total">' +
          '<span>' + MagizhamUI.escapeHtml(label('cartTotal', 'Total')) + '</span>' +
          '<span>' + MagizhamUI.escapeHtml(MagizhamUI.formatPrice(total)) + '</span>' +
        '</div>';

      summaryBox.innerHTML = rows;
    })
    .catch(function (err) {
      if (err && err.message === 'login required') return;
      MagizhamUI.reportError(err, 'The cart could not be loaded.');
    });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    MagizhamUI.clearFieldErrors(form);
    showAlert('');

    var payload = {
      customer_name: (nameInput.value || '').trim(),
      phone: (phoneInput.value || '').trim(),
      delivery_address: (addressInput.value || '').trim()
    };

    if (payload.customer_name.length < 2) {
      MagizhamUI.setFieldError(nameInput, label('checkoutNameRequired', 'Please enter your name.'));
      return;
    }
    if (!/^[0-9+\-\s()]{6,20}$/.test(payload.phone)) {
      MagizhamUI.setFieldError(phoneInput, label('checkoutPhoneRequired', 'Please enter a valid phone number.'));
      return;
    }
    if (payload.delivery_address.length < 5) {
      MagizhamUI.setFieldError(addressInput, label('checkoutAddressRequired', 'Please enter a delivery address.'));
      return;
    }

    MagizhamUI.setBusy(submitBtn, true, label('checkoutPlacing', 'Placing the order...'));

    MagizhamAPI.createOrder(payload)
      .then(function (data) {
        var order = (data && data.order) || null;
        MagizhamUI.toast(label('checkoutSuccess', 'Your order has been placed.'), 'info');
        if (order && order.id) {
          window.location.href = 'orders.html?placed=' + order.id;
        } else {
          window.location.href = 'orders.html';
        }
      })
      .catch(function (err) {
        MagizhamUI.setBusy(submitBtn, false);
        MagizhamUI.applyValidationErrors(form, err && err.details);
        showAlert((err && err.message) || 'The order could not be placed.');
      });
  });
})();
