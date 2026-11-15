// ==============================================
// API CLIENT - talks to the Express / PostgreSQL backend
// - single place that knows the API base url
// - session cookie is sent with every request
// - every failure becomes a readable ApiError
// ==============================================

var MagizhamAPI = (function () {
  'use strict';

  var DEFAULT_API_PORT = 5000;
  var REQUEST_TIMEOUT = 15000;
  var PROBE_TIMEOUT = 4000;

  var resolvedBase = null;      // "" (same origin) or "http://host:port"
  var resolving = null;

  /* ---------------------------------------------------------- */
  /*  Errors                                                    */
  /* ---------------------------------------------------------- */

  function ApiError(message, status, code, details) {
    this.name = 'ApiError';
    this.message = message || 'Something went wrong.';
    this.status = status || 0;
    this.code = code || 'UNKNOWN_ERROR';
    this.details = details || null;
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;

  function networkError(message) {
    return new ApiError(
      message ||
        'Cannot reach the server. Please make sure the backend is running (npm run server).',
      0,
      'NETWORK_ERROR'
    );
  }

  /* ---------------------------------------------------------- */
  /*  Base url resolution                                       */
  /* ---------------------------------------------------------- */

  function trimSlash(value) {
    return String(value).replace(/\/+$/, '');
  }

  function readOverride() {
    try {
      if (window.MAGIZHAM_API_BASE) return trimSlash(window.MAGIZHAM_API_BASE);
      var stored = localStorage.getItem('magizhamApiBase');
      if (stored) return trimSlash(stored);
    } catch (e) {
      /* localStorage can be blocked - ignore */
    }
    return null;
  }

  function apiPath(base, path) {
    var suffix = String(path || '');
    if (suffix.charAt(0) !== '/') suffix = '/' + suffix;
    return (base || '') + '/api' + suffix;
  }

  /** GET {base}/api/health - used to find out which base url works. */
  function probe(base) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = null;

    if (controller) {
      timer = setTimeout(function () {
        controller.abort();
      }, PROBE_TIMEOUT);
    }

    var options = { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } };
    if (controller) options.signal = controller.signal;

    return fetch(apiPath(base, '/health'), options)
      .then(function (res) {
        if (timer) clearTimeout(timer);
        if (!res.ok) throw new Error('probe failed');
        return true;
      })
      .catch(function (err) {
        if (timer) clearTimeout(timer);
        throw err;
      });
  }

  /**
   * Find the API base url once per page:
   *   1. an explicit override always wins
   *   2. the same origin (the Express server serves the frontend too)
   *   3. the API on the default port (live-server / vite on another port)
   */
  function ensureBase() {
    if (resolvedBase !== null) return Promise.resolve(resolvedBase);

    var override = readOverride();
    if (override) {
      resolvedBase = override === '/api' ? '' : override.replace(/\/api$/, '');
      return Promise.resolve(resolvedBase);
    }

    if (resolving) return resolving;

    resolving = probe('')
      .then(function () {
        resolvedBase = '';
        return resolvedBase;
      })
      .catch(function () {
        var host = window.location.hostname || 'localhost';
        var candidate = 'http://' + host + ':' + DEFAULT_API_PORT;
        return probe(candidate)
          .then(function () {
            resolvedBase = candidate;
            return resolvedBase;
          })
          .catch(function () {
            resolvedBase = 'http://localhost:' + DEFAULT_API_PORT;
            return resolvedBase;
          });
      })
      .then(function (base) {
        resolving = null;
        return base;
      });

    return resolving;
  }

  /* ---------------------------------------------------------- */
  /*  Core request                                              */
  /* ---------------------------------------------------------- */

  function request(method, path, body) {
    return ensureBase()
      .then(function (base) {
        var options = {
          method: method,
          credentials: 'include',
          headers: { Accept: 'application/json' }
        };

        if (body !== undefined && body !== null) {
          options.headers['Content-Type'] = 'application/json';
          options.body = JSON.stringify(body);
        }

        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timer = null;
        if (controller) {
          options.signal = controller.signal;
          timer = setTimeout(function () {
            controller.abort();
          }, REQUEST_TIMEOUT);
        }

        return fetch(apiPath(base, path), options)
          .then(function (res) {
            if (timer) clearTimeout(timer);
            return res.text().then(function (raw) {
              var payload = null;
              if (raw) {
                try {
                  payload = JSON.parse(raw);
                } catch (e) {
                  payload = null;
                }
              }
              return { res: res, payload: payload };
            });
          })
          .catch(function (err) {
            if (timer) clearTimeout(timer);
            if (err && err.name === 'AbortError') {
              throw new ApiError('The server took too long to answer.', 0, 'TIMEOUT');
            }
            throw networkError();
          });
      })
      .then(function (result) {
        var res = result.res;
        var payload = result.payload;

        if (res.ok) {
          return payload && payload.success ? payload.data : payload;
        }

        var error = (payload && payload.error) || {};
        var message = error.message || 'Request failed (' + res.status + ').';

        if (res.status === 401) {
          document.dispatchEvent(
            new CustomEvent('magizham:unauthorized', { detail: { message: message } })
          );
        }

        throw new ApiError(message, res.status, error.code || 'HTTP_' + res.status, error.details);
      });
  }

  /* ---------------------------------------------------------- */
  /*  Endpoints                                                 */
  /* ---------------------------------------------------------- */

  return {
    ApiError: ApiError,

    baseUrl: function () {
      return resolvedBase === null ? '' : resolvedBase;
    },

    request: request,

    get: function (path) {
      return request('GET', path);
    },
    post: function (path, body) {
      return request('POST', path, body || {});
    },
    patch: function (path, body) {
      return request('PATCH', path, body || {});
    },
    del: function (path) {
      return request('DELETE', path);
    },

    /* ---------- catalogue ---------- */

    getCategories: function () {
      return request('GET', '/categories');
    },
    getCategoryProducts: function (slug) {
      return request('GET', '/categories/' + encodeURIComponent(slug) + '/products');
    },
    getProducts: function (params) {
      var query = '';
      if (params) {
        var pairs = [];
        for (var key in params) {
          if (Object.prototype.hasOwnProperty.call(params, key) && params[key] !== undefined && params[key] !== '') {
            pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
          }
        }
        if (pairs.length) query = '?' + pairs.join('&');
      }
      return request('GET', '/products' + query);
    },
    getProduct: function (id) {
      return request('GET', '/products/' + encodeURIComponent(id));
    },

    /* ---------- authentication ---------- */

    register: function (payload) {
      return request('POST', '/auth/register', payload);
    },
    login: function (payload) {
      return request('POST', '/auth/login', payload);
    },
    logout: function () {
      return request('POST', '/auth/logout');
    },
    me: function () {
      return request('GET', '/auth/me');
    },

    /* ---------- cart ---------- */

    getCart: function () {
      return request('GET', '/cart');
    },
    addToCart: function (productId, quantity) {
      return request('POST', '/cart/items', {
        product_id: productId,
        quantity: quantity || 1
      });
    },
    updateCartItem: function (cartItemId, quantity) {
      return request('PATCH', '/cart/items/' + encodeURIComponent(cartItemId), {
        quantity: quantity
      });
    },
    removeCartItem: function (cartItemId) {
      return request('DELETE', '/cart/items/' + encodeURIComponent(cartItemId));
    },
    syncCart: function (items) {
      return request('POST', '/cart/sync', { items: items });
    },
    clearCart: function () {
      return request('DELETE', '/cart');
    },

    /* ---------- orders ---------- */

    createOrder: function (payload) {
      return request('POST', '/orders', payload);
    },
    getOrders: function () {
      return request('GET', '/orders');
    },
    getOrder: function (id) {
      return request('GET', '/orders/' + encodeURIComponent(id));
    },

    /* ---------- administration ---------- */

    admin: {
      stats: function () {
        return request('GET', '/admin/stats');
      },
      products: function (search) {
        return request('GET', '/admin/products' + (search ? '?search=' + encodeURIComponent(search) : ''));
      },
      createProduct: function (payload) {
        return request('POST', '/admin/products', payload);
      },
      updateProduct: function (id, payload) {
        return request('PATCH', '/admin/products/' + encodeURIComponent(id), payload);
      },
      deleteProduct: function (id) {
        return request('DELETE', '/admin/products/' + encodeURIComponent(id));
      },
      categories: function () {
        return request('GET', '/admin/categories');
      },
      createCategory: function (payload) {
        return request('POST', '/admin/categories', payload);
      },
      updateCategory: function (id, payload) {
        return request('PATCH', '/admin/categories/' + encodeURIComponent(id), payload);
      },
      deleteCategory: function (id) {
        return request('DELETE', '/admin/categories/' + encodeURIComponent(id));
      },
      orders: function (status) {
        return request('GET', '/admin/orders' + (status ? '?status=' + encodeURIComponent(status) : ''));
      },
      updateOrderStatus: function (id, orderStatus) {
        return request('PATCH', '/admin/orders/' + encodeURIComponent(id), {
          order_status: orderStatus
        });
      },
      users: function () {
        return request('GET', '/admin/users');
      }
    }
  };
})();
