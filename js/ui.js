// ==============================================
// UI HELPERS - notifications, formatting, escaping
// Shared by every page that talks to the backend.
// ==============================================

var MagizhamUI = (function () {
  'use strict';

  var TAMIL = '\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD';

  /* ---------------------------------------------------------- */
  /*  Language helpers                                          */
  /* ---------------------------------------------------------- */

  function currentLang() {
    try {
      return localStorage.getItem('magizhamLang') || 'English';
    } catch (e) {
      return 'English';
    }
  }

  function isTamil(lang) {
    return (lang || currentLang()) === TAMIL;
  }

  /** Pick the right field of a bilingual object. */
  function pick(bilingual, field, lang) {
    if (!bilingual) return '';
    var isTa = isTamil(lang);
    var value = isTa ? bilingual[field + '_ta'] : bilingual[field];
    if (value === undefined || value === null || value === '') {
      value = bilingual[field];
    }
    return value === undefined || value === null ? '' : value;
  }

  /* ---------------------------------------------------------- */
  /*  Formatting                                                */
  /* ---------------------------------------------------------- */

  function toNumber(value) {
    if (typeof value === 'number') return value;
    var num = parseFloat(String(value === undefined || value === null ? '' : value).replace(/[^0-9.\-]/g, ''));
    return isNaN(num) ? 0 : num;
  }

  function formatPrice(value) {
    var num = toNumber(value);
    var rounded = Math.round(num * 100) / 100;
    return '\u20B9' + rounded;
  }

  /** Turn "images/x.jpg" or "x.jpg" into a usable src path. */
  function imageSrc(value) {
    if (!value) return '';
    var path = String(value);
    if (/^(https?:)?\/\//i.test(path) || path.charAt(0) === '/') return path;
    if (path.indexOf('images/') === 0) return path;
    return 'images/' + path;
  }

  /* ---------------------------------------------------------- */
  /*  Escaping                                                 */
  /* ---------------------------------------------------------- */

  function escapeHtml(value) {
    if (value === undefined || value === null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------------------------------------------------------- */
  /*  Notifications                                             */
  /* ---------------------------------------------------------- */

  var TOAST_ID = 'magizham-toast-style';

  function ensureStyle() {
    if (document.getElementById(TOAST_ID)) return;
    var style = document.createElement('style');
    style.id = TOAST_ID;
    style.innerHTML =
      '#magizham-toasts{position:fixed;top:80px;right:18px;z-index:2000;display:flex;' +
      'flex-direction:column;gap:10px;max-width:min(360px,calc(100vw - 36px))}' +
      '.mz-toast{background:#fff;color:#3B2A1A;border-radius:14px;padding:12px 16px;' +
      'box-shadow:0 8px 25px rgba(0,0,0,.16);border-left:4px solid var(--green);font-size:14px;' +
      'line-height:1.45;animation:mzToastIn .25s ease}' +
      '.mz-toast.mz-error{border-left-color:#e74c3c}' +
      '.mz-toast.mz-info{border-left-color:#128C7E}' +
      '.mz-toast.mz-warn{border-left-color:#FFC107}' +
      '@keyframes mzToastIn{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}';
    document.head.appendChild(style);
  }

  function toast(message, type) {
    if (!message) return;
    ensureStyle();

    var host = document.getElementById('magizham-toasts');
    if (!host) {
      host = document.createElement('div');
      host.id = 'magizham-toasts';
      document.body.appendChild(host);
    }

    var node = document.createElement('div');
    node.className = 'mz-toast' + (type ? ' mz-' + type : '');
    node.textContent = message;
    host.appendChild(node);

    setTimeout(function () {
      node.style.transition = 'opacity .3s, transform .3s';
      node.style.opacity = '0';
      node.style.transform = 'translateX(24px)';
      setTimeout(function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 320);
    }, 4200);
  }

  /** Show the message of a failed request in a readable way. */
  function reportError(err, fallback) {
    var message = fallback;
    if (err && err.message) message = err.message;
    else if (typeof err === 'string') message = err;
    toast(message, 'error');
    if (window.console && console.error) console.error('[magizham]', err);
  }

  /* ---------------------------------------------------------- */
  /*  Inline form errors                                       */
  /* ---------------------------------------------------------- */

  function setFieldError(input, message) {
    if (!input) return;
    var holder = input.closest('.mz-field') || input.parentNode;
    if (!holder) return;

    var box = holder.querySelector('.mz-field-error');
    if (!box) {
      box = document.createElement('p');
      box.className = 'mz-field-error';
      holder.appendChild(box);
    }
    box.textContent = message || '';
    box.style.display = message ? 'block' : 'none';
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function clearFieldErrors(form) {
    if (!form) return;
    form.querySelectorAll('.mz-field-error').forEach(function (box) {
      box.textContent = '';
      box.style.display = 'none';
    });
    form.querySelectorAll('[aria-invalid]').forEach(function (input) {
      input.setAttribute('aria-invalid', 'false');
    });
  }

  /**
   * Show the zod style "details" array coming from the API on the matching
   * inputs of a form.
   */
  function applyValidationErrors(form, details) {
    if (!form || !details || !details.length) return;
    details.forEach(function (item) {
      if (!item || !item.field) return;
      var input = form.querySelector('[name="' + item.field + '"]');
      setFieldError(input, item.message);
    });
  }

  /* ---------------------------------------------------------- */
  /*  Misc                                                     */
  /* ---------------------------------------------------------- */

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function setBusy(button, busy, busyLabel) {
    if (!button) return;
    if (busy) {
      button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      button.innerHTML = busyLabel || button.innerHTML;
      button.classList.add('is-busy');
    } else {
      button.disabled = false;
      if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
      button.classList.remove('is-busy');
    }
  }

  return {
    TAMIL: TAMIL,
    currentLang: currentLang,
    isTamil: isTamil,
    pick: pick,
    toNumber: toNumber,
    formatPrice: formatPrice,
    imageSrc: imageSrc,
    escapeHtml: escapeHtml,
    toast: toast,
    reportError: reportError,
    setFieldError: setFieldError,
    clearFieldErrors: clearFieldErrors,
    applyValidationErrors: applyValidationErrors,
    qs: qs,
    qsa: qsa,
    setBusy: setBusy
  };
})();
