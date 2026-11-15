// ==============================================
// AUTHENTICATION - session state for the whole site
// - knows the current user (regular customer or admin)
// - renders the account button inside the existing header
// - keeps the header in sync after login / logout
// ==============================================

var MagizhamAuth = (function () {
  'use strict';

  var currentUser = null;
  var readyPromise = null;
  var listeners = [];
  var wasSignedIn = false;

  /* ---------------------------------------------------------- */
  /*  State                                                    */
  /* ---------------------------------------------------------- */

  function user() {
    return currentUser;
  }

  function isAdmin() {
    return !!(currentUser && currentUser.role === 'admin');
  }

  function isSignedIn() {
    return !!currentUser;
  }

  function notify() {
    listeners.forEach(function (fn) {
      try {
        fn(currentUser);
      } catch (err) {
        if (window.console) console.error('[auth]', err);
      }
    });
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  function setUser(next) {
    currentUser = next || null;
    if (currentUser) wasSignedIn = true;
    notify();
  }

  /* ---------------------------------------------------------- */
  /*  Session                                                  */
  /* ---------------------------------------------------------- */

  /** Load the session once; every later call reuses the same promise. */
  function ready() {
    if (!readyPromise) {
      readyPromise = MagizhamAPI.me()
        .then(function (data) {
          setUser(data && data.user ? data.user : null);
          return currentUser;
        })
        .catch(function () {
          setUser(null);
          return null;
        });
    }
    return readyPromise;
  }

  /** Force a reload of the session (after a login for example). */
  function refresh() {
    readyPromise = MagizhamAPI.me()
      .then(function (data) {
        setUser(data && data.user ? data.user : null);
        return currentUser;
      })
      .catch(function () {
        setUser(null);
        return null;
      });
    return readyPromise;
  }

  function login(email, password) {
    return MagizhamAPI.login({ email: email, password: password }).then(function (data) {
      currentUser = (data && data.user) || null;
      wasSignedIn = true;
      readyPromise = Promise.resolve(currentUser);
      notify();
      return currentUser;
    });
  }

  function register(name, email, password) {
    return MagizhamAPI.register({ name: name, email: email, password: password }).then(function (data) {
      currentUser = (data && data.user) || null;
      wasSignedIn = true;
      readyPromise = Promise.resolve(currentUser);
      notify();
      return currentUser;
    });
  }

  function logout() {
    return MagizhamAPI.logout()
      .catch(function () {
        /* the cookie is dropped by the browser anyway */
      })
      .then(function () {
        setUser(null);
        return null;
      });
  }

  /** Send the visitor to the login page when a session is required. */
  function requireLogin(message) {
    if (currentUser) return Promise.resolve(currentUser);
    var back = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = 'login.html?redirect=' + back + (message ? '&reason=' + encodeURIComponent(message) : '');
    return Promise.reject(new Error('login required'));
  }

  /* ---------------------------------------------------------- */
  /*  Header button                                            */
  /* ---------------------------------------------------------- */

  function renderHeader() {
    var host = document.querySelector('header .header-right');
    if (!host) return;

    var anchor = host.querySelector('.cart');
    var existing = document.getElementById('mzAccountArea');
    if (existing) existing.parentNode.removeChild(existing);

    var area = document.createElement('div');
    area.id = 'mzAccountArea';
    area.className = 'mz-account-area';

    if (currentUser) {
      var name = currentUser.name || currentUser.email;

      var profile = document.createElement('a');
      profile.className = 'mz-account';
      profile.href = 'orders.html';
      profile.title = name;
      profile.innerHTML =
        '<i class="fa-solid fa-user"></i><span class="mz-account-text">' +
        MagizhamUI.escapeHtml(name.split(' ')[0]) +
        '</span>';
      area.appendChild(profile);

      if (isAdmin()) {
        var adminLink = document.createElement('a');
        adminLink.className = 'mz-account mz-admin';
        adminLink.href = 'admin.html';
        adminLink.title = 'Admin';
        adminLink.setAttribute('data-key', 'accountAdmin');
        adminLink.innerHTML = '<i class="fa-solid fa-gauge-high"></i>';
        area.appendChild(adminLink);
      }

      var out = document.createElement('button');
      out.type = 'button';
      out.className = 'mz-account mz-logout';
      out.id = 'mzLogout';
      out.title = 'Sign out';
      out.setAttribute('data-key', 'accountLogout');
      out.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i>';
      out.addEventListener('click', function () {
        logout().then(function () {
          MagizhamUI.toast('You have been signed out.', 'info');
          if (window.location.pathname.indexOf('orders.html') > -1) {
            window.location.href = 'index.html';
          } else if (window.location.pathname.indexOf('checkout.html') > -1) {
            window.location.href = 'cart.html';
          } else if (window.location.pathname.indexOf('admin.html') > -1) {
            window.location.href = 'index.html';
          }
        });
      });
      area.appendChild(out);
    } else {
      var loginLink = document.createElement('a');
      loginLink.className = 'mz-account';
      loginLink.href = 'login.html';
      loginLink.title = 'Login';
      loginLink.setAttribute('data-key', 'accountLogin');
      loginLink.innerHTML =
        '<i class="fa-solid fa-user"></i><span class="mz-account-text" data-key="accountLogin">Login</span>';
      area.appendChild(loginLink);
    }

    if (anchor && anchor.parentNode === host) {
      host.insertBefore(area, anchor);
    } else {
      host.appendChild(area);
    }

    // The account button is created after the language module ran, so the
    // translation is applied once more.
    if (typeof translate === 'function') translate(MagizhamUI.currentLang());
  }

  /* ---------------------------------------------------------- */
  /*  Boot                                                     */
  /* ---------------------------------------------------------- */

  function init() {
    document.addEventListener('magizham:unauthorized', function (event) {
      var was = wasSignedIn && currentUser;
      setUser(null);
      renderHeader();
      if (was && event && event.detail && event.detail.message) {
        MagizhamUI.toast(event.detail.message, 'warn');
      }
    });

    ready().then(function () {
      renderHeader();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    user: user,
    isAdmin: isAdmin,
    isSignedIn: isSignedIn,
    ready: ready,
    refresh: refresh,
    login: login,
    register: register,
    logout: logout,
    requireLogin: requireLogin,
    onChange: onChange,
    setUser: setUser,
    renderHeader: renderHeader
  };
})();
