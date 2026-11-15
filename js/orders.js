// ==============================================
// ORDER HISTORY PAGE
// ==============================================

(function () {
  'use strict';

  var list = document.getElementById('ordersList');
  if (!list) return;

  var lang = MagizhamUI.currentLang();

  function label(key, fallback) {
    var t = (typeof translations !== 'undefined') ? translations[lang] : null;
    return (t && t[key]) || fallback;
  }

  function formatDate(value) {
    if (!value) return '';
    var date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return date.toLocaleString(lang === MagizhamUI.TAMIL ? 'ta-IN' : 'en-IN');
  }

  MagizhamAuth.requireLogin()
    .then(function () {
      return MagizhamAPI.getOrders();
    })
    .then(function (data) {
      var orders = (data && data.orders) || [];

      if (!orders.length) {
        list.innerHTML = '<div class="mz-empty">' +
          MagizhamUI.escapeHtml(label('ordersEmpty', 'You have not placed any order yet.')) +
          '</div>';
        return;
      }

      list.innerHTML = orders.map(function (order) {
        var items = (order.items || []).map(function (item) {
          var name = MagizhamUI.pick(
            { name: item.product_name, name_ta: item.product_name_ta },
            'name',
            lang
          );
          return '<div class="mz-order-item">' +
            '<img src="' + MagizhamUI.imageSrc(item.image_url) + '" alt="' +
              MagizhamUI.escapeHtml(item.product_name || '') + '">' +
            '<span>' + MagizhamUI.escapeHtml(name) +
              ' <span class="mz-qty">x ' + item.quantity + '</span></span>' +
            '<span class="mz-qty">' +
              MagizhamUI.escapeHtml(MagizhamUI.formatPrice(item.subtotal)) +
            '</span>' +
          '</div>';
        }).join('');

        var status = String(order.order_status || '').toLowerCase();

        return '<div class="mz-order">' +
          '<div class="mz-order-head">' +
            '<h3>' + MagizhamUI.escapeHtml(label('ordersNumber', 'Order')) + ' #' + order.id + '</h3>' +
            '<span class="mz-status ' + MagizhamUI.escapeHtml(status) + '">' +
              MagizhamUI.escapeHtml(order.order_status || '') +
            '</span>' +
          '</div>' +
          '<div class="mz-order-items">' + items + '</div>' +
          '<div class="mz-order-meta">' +
            '<div><strong>' + MagizhamUI.escapeHtml(label('ordersDate', 'Date')) + '</strong>' +
              MagizhamUI.escapeHtml(formatDate(order.created_at)) + '</div>' +
            '<div><strong>' + MagizhamUI.escapeHtml(label('ordersTotal', 'Total')) + '</strong>' +
              MagizhamUI.escapeHtml(order.total_amount_display ||
                MagizhamUI.formatPrice(order.total_amount)) + '</div>' +
            '<div><strong>' + MagizhamUI.escapeHtml(label('ordersPhone', 'Phone')) + '</strong>' +
              MagizhamUI.escapeHtml(order.phone || '') + '</div>' +
            '<div><strong>' + MagizhamUI.escapeHtml(label('ordersAddress', 'Delivery address')) + '</strong>' +
              MagizhamUI.escapeHtml(order.delivery_address || '') + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    })
    .catch(function (err) {
      if (err && err.message === 'login required') return;
      MagizhamUI.reportError(err, 'The orders could not be loaded.');
    });
})();
