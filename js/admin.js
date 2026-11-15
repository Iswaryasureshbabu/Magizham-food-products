// ==============================================
// ADMIN PAGE
// Everything is done through the protected /api/admin routes.
// ==============================================

(function () {
  'use strict';

  var page = document.getElementById('adminPage');
  if (!page) return;

  var lang = MagizhamUI.currentLang();
  var categories = [];
  var products = [];

  var STATUSES = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];

  function label(key, fallback) {
    var t = (typeof translations !== 'undefined') ? translations[lang] : null;
    return (t && t[key]) || fallback;
  }

  function esc(value) {
    return MagizhamUI.escapeHtml(value);
  }

  /* ---------------------------------------------------------- */
  /*  Tabs                                                      */
  /* ---------------------------------------------------------- */

  function activateTab(name) {
    MagizhamUI.qsa('.mz-tab').forEach(function (tab) {
      tab.classList.toggle('active', tab.getAttribute('data-tab') === name);
    });
    MagizhamUI.qsa('.mz-panel').forEach(function (panel) {
      panel.classList.toggle('active', panel.getAttribute('data-panel') === name);
    });
  }

  MagizhamUI.qsa('.mz-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      activateTab(tab.getAttribute('data-tab'));
    });
  });

  /* ---------------------------------------------------------- */
  /*  Dashboard                                                 */
  /* ---------------------------------------------------------- */

  function renderStats(stats) {
    var box = document.getElementById('adminStats');
    if (!box) return;

    var cards = [
      { value: stats.order_count, label: 'Orders' },
      { value: stats.pending_count, label: 'Pending orders' },
      { value: stats.product_count, label: 'Products' },
      { value: stats.category_count, label: 'Categories' },
      { value: stats.customer_count, label: 'Customers' },
      { value: stats.low_stock_count, label: 'Low stock items' },
      { value: MagizhamUI.formatPrice(stats.revenue), label: 'Revenue' }
    ];

    box.innerHTML = cards.map(function (card) {
      return '<div class="mz-stat">' +
        '<div class="mz-stat-value">' + esc(card.value) + '</div>' +
        '<div class="mz-stat-label">' + esc(card.label) + '</div>' +
      '</div>';
    }).join('');
  }

  function loadStats() {
    return MagizhamAPI.admin.stats().then(function (data) {
      renderStats((data && data.stats) || {});
    });
  }

  /* ---------------------------------------------------------- */
  /*  Categories                                                */
  /* ---------------------------------------------------------- */

  function renderCategories() {
    var body = document.getElementById('adminCategoriesBody');
    if (!body) return;

    if (!categories.length) {
      body.innerHTML = '<tr><td colspan="5" class="mz-empty">No categories yet.</td></tr>';
      return;
    }

    body.innerHTML = categories.map(function (cat) {
      var name = MagizhamUI.pick(
        { name: cat.category_name, name_ta: cat.category_name_ta },
        'name',
        lang
      );
      var statusBadge = cat.is_active !== false
        ? '<span class="mz-badge active" style="background:#e8f5e9; color:#2e7d32; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:600;">Active</span>'
        : '<span class="mz-badge inactive" style="background:#f5f5f5; color:#777; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:600;">Inactive (Legacy)</span>';

      return '<tr>' +
        '<td>' + esc(cat.id) + '</td>' +
        '<td>' + esc(name) +
          '<div class="mz-qty">' + esc(cat.category_slug) + '</div></td>' +
        '<td>' + statusBadge + ' (Order: ' + esc(cat.display_order || 0) + ')</td>' +
        '<td>' + esc(cat.product_count === undefined ? '-' : cat.product_count) + '</td>' +
        '<td>' +
          '<button class="mz-btn small ghost" data-edit-category="' + cat.id + '">Edit</button> ' +
          '<button class="mz-btn small danger" data-delete-category="' + cat.id + '">Delete</button>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  function loadCategories() {
    return MagizhamAPI.admin.categories().then(function (data) {
      categories = (data && data.categories) || [];
      renderCategories();
      fillCategorySelect();
    });
  }

  function fillCategorySelect(selectedId) {
    var select = document.getElementById('productCategory');
    if (!select) return;
    var current = selectedId !== undefined && selectedId !== null ? selectedId : select.value;
    // Only active categories can receive products; the product's own category
    // stays listed (marked) so that it can still be edited.
    var choices = categories.filter(function (cat) {
      return cat.is_active !== false || String(cat.id) === String(current);
    });
    select.innerHTML = '<option value="">-- Choose Category --</option>' + choices.map(function (cat) {
      var name = MagizhamUI.pick(
        { name: cat.category_name, name_ta: cat.category_name_ta },
        'name',
        lang
      );
      var activeNote = cat.is_active === false ? ' [Inactive]' : '';
      var isSel = (current !== undefined && current !== null && String(cat.id) === String(current)) ? ' selected' : '';
      return '<option value="' + cat.id + '"' + isSel + '>' + esc(name) + activeNote + '</option>';
    }).join('');
    if (current) select.value = current;
  }

  /* ---------------------------------------------------------- */
  /*  Products                                                  */
  /* ---------------------------------------------------------- */

  function renderProducts() {
    var body = document.getElementById('adminProductsBody');
    if (!body) return;

    if (!products.length) {
      body.innerHTML = '<tr><td colspan="8" class="mz-empty">No products found.</td></tr>';
      return;
    }

    body.innerHTML = products.map(function (product) {
      var name = MagizhamUI.pick(
        { name: product.product_name, name_ta: product.product_name_ta },
        'name',
        lang
      );
      var available = product.is_available ? 'Yes' : 'No';
      return '<tr>' +
        '<td>' + esc(product.id) + '</td>' +
        '<td><img src="' + MagizhamUI.imageSrc(product.image_url) + '" alt="' + esc(name) + '"></td>' +
        '<td>' + esc(name) + '<div class="mz-qty">' + esc(product.product_slug || '') + '</div></td>' +
        '<td>' + esc(product.category_name || '') + '</td>' +
        '<td>' + esc(product.price_display) + '</td>' +
        '<td>' + esc(product.stock_quantity) + '</td>' +
        '<td>' + esc(available) + '</td>' +
        '<td>' +
          '<button class="mz-btn small ghost" data-edit-product="' + product.id + '">Edit</button> ' +
          '<button class="mz-btn small danger" data-delete-product="' + product.id + '">Delete</button>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  function loadProducts(search) {
    return MagizhamAPI.admin.products(search).then(function (data) {
      products = (data && data.products) || [];
      renderProducts();
    });
  }

  /* ---------------------------------------------------------- */
  /*  Orders                                                    */
  /* ---------------------------------------------------------- */

  function renderOrders(orders) {
    var body = document.getElementById('adminOrdersBody');
    if (!body) return;

    if (!orders.length) {
      body.innerHTML = '<tr><td colspan="6" class="mz-empty">No orders yet.</td></tr>';
      return;
    }

    body.innerHTML = orders.map(function (order) {
      var options = STATUSES.map(function (status) {
        return '<option value="' + status + '"' +
          (status === order.order_status ? ' selected' : '') + '>' + status + '</option>';
      }).join('');

      return '<tr>' +
        '<td>' + esc(order.id) + '</td>' +
        '<td>' + esc(order.customer_name) + '<div class="mz-qty">' + esc(order.customer_email || '') + '</div></td>' +
        '<td>' + esc(order.phone) + '</td>' +
        '<td>' + esc(order.total_amount_display) + '</td>' +
        '<td><select class="mz-order-status" data-order="' + order.id + '">' + options + '</select></td>' +
        '<td><button class="mz-btn small ghost" data-order-detail="' + order.id + '">Details</button></td>' +
      '</tr>';
    }).join('');
  }

  function loadOrders(status) {
    return MagizhamAPI.admin.orders(status).then(function (data) {
      renderOrders((data && data.orders) || []);
    });
  }

  /* ---------------------------------------------------------- */
  /*  Users                                                     */
  /* ---------------------------------------------------------- */

  function renderUsers(users) {
    var body = document.getElementById('adminUsersBody');
    if (!body) return;

    if (!users.length) {
      body.innerHTML = '<tr><td colspan="5" class="mz-empty">No users yet.</td></tr>';
      return;
    }

    body.innerHTML = users.map(function (user) {
      return '<tr>' +
        '<td>' + esc(user.id) + '</td>' +
        '<td>' + esc(user.name) + '</td>' +
        '<td>' + esc(user.email) + '</td>' +
        '<td>' + esc(user.role) + '</td>' +
        '<td>' + esc(user.order_count === undefined ? '-' : user.order_count) + '</td>' +
      '</tr>';
    }).join('');
  }

  function loadUsers() {
    return MagizhamAPI.admin.users().then(function (data) {
      renderUsers((data && data.users) || []);
    });
  }

  /* ---------------------------------------------------------- */
  /*  Modal                                                     */
  /* ---------------------------------------------------------- */

  var modal = document.getElementById('mzModal');
  var modalTitle = document.getElementById('mzModalTitle');
  var productForm = document.getElementById('mzProductForm');
  var categoryForm = document.getElementById('mzCategoryForm');
  var editingProductId = null;
  var editingCategoryId = null;

  function openModal(title, form) {
    if (!modal) return;
    modalTitle.textContent = title;
    productForm.style.display = form === productForm ? '' : 'none';
    categoryForm.style.display = form === categoryForm ? '' : 'none';
    modal.classList.add('open');
  }

  function closeModal() {
    if (modal) modal.classList.remove('open');
  }

  MagizhamUI.qsa('.mz-modal-close').forEach(function (btn) {
    btn.addEventListener('click', closeModal);
  });

  if (modal) {
    modal.addEventListener('click', function (event) {
      if (event.target === modal) closeModal();
    });
  }

  var imagePreset = document.getElementById('productImagePreset');
  var imageInput = document.getElementById('productImage');
  var imagePreview = document.getElementById('productImagePreview');
  var imagePreviewText = document.getElementById('productImagePreviewText');

  function updateImagePreview(src) {
    if (!imagePreview) return;
    if (src && src.trim()) {
      imagePreview.src = src.trim();
      imagePreview.style.display = 'block';
      if (imagePreviewText) imagePreviewText.style.display = 'none';
    } else {
      imagePreview.style.display = 'none';
      if (imagePreviewText) imagePreviewText.style.display = 'inline';
    }
  }

  if (imagePreset && imageInput) {
    imagePreset.addEventListener('change', function () {
      if (imagePreset.value) {
        imageInput.value = imagePreset.value;
        updateImagePreview(imagePreset.value);
      }
    });
    imageInput.addEventListener('input', function () {
      updateImagePreview(imageInput.value);
    });
  }

  function openProductForm(product) {
    editingProductId = product ? product.id : null;
    productForm.reset();
    MagizhamUI.clearFieldErrors(productForm);

    fillCategorySelect(product ? product.category_id : null);

    if (product) {
      productForm.querySelector('[name="product_name"]').value = product.product_name || '';
      productForm.querySelector('[name="product_name_ta"]').value = product.product_name_ta || '';
      productForm.querySelector('[name="description"]').value = product.description || '';
      productForm.querySelector('[name="description_ta"]').value = product.description_ta || '';
      productForm.querySelector('[name="price"]').value = product.price;
      productForm.querySelector('[name="weight"]').value = product.weight || '';
      productForm.querySelector('[name="image_url"]').value = product.image_url || '';
      if (imagePreset) imagePreset.value = product.image_url || '';
      updateImagePreview(product.image_url || '');
      productForm.querySelector('[name="stock_quantity"]').value = product.stock_quantity;
      productForm.querySelector('[name="is_available"]').checked = product.is_available !== false;
      productForm.querySelector('[name="category_id"]').value = product.category_id;
    } else {
      productForm.querySelector('[name="is_available"]').checked = true;
      if (imagePreset) imagePreset.value = '';
      updateImagePreview('');
    }

    openModal(product ? 'Edit product' : 'New product', productForm);
  }

  function openCategoryForm(category) {
    editingCategoryId = category ? category.id : null;
    categoryForm.reset();
    MagizhamUI.clearFieldErrors(categoryForm);

    if (category) {
      categoryForm.querySelector('[name="category_name"]').value = category.category_name || '';
      categoryForm.querySelector('[name="category_name_ta"]').value = category.category_name_ta || '';
      categoryForm.querySelector('[name="category_slug"]').value = category.category_slug || '';
      categoryForm.querySelector('[name="description"]').value = category.description || '';
      categoryForm.querySelector('[name="description_ta"]').value = category.description_ta || '';
      var orderInput = categoryForm.querySelector('[name="display_order"]');
      if (orderInput) orderInput.value = category.display_order || 0;
      var activeInput = categoryForm.querySelector('[name="is_active"]');
      if (activeInput) activeInput.checked = category.is_active !== false;
    } else {
      var orderInput = categoryForm.querySelector('[name="display_order"]');
      if (orderInput) orderInput.value = categories.length + 1;
      var activeInput = categoryForm.querySelector('[name="is_active"]');
      if (activeInput) activeInput.checked = true;
    }

    openModal(category ? 'Edit category' : 'New category', categoryForm);
  }

  /* ---------------------------------------------------------- */
  /*  Form handling                                             */
  /* ---------------------------------------------------------- */

  if (productForm) {
    productForm.addEventListener('submit', function (event) {
      event.preventDefault();
      MagizhamUI.clearFieldErrors(productForm);

      var payload = {
        category_id: MagizhamUI.toNumber(productForm.querySelector('[name="category_id"]').value),
        product_name: productForm.querySelector('[name="product_name"]').value.trim(),
        product_name_ta: productForm.querySelector('[name="product_name_ta"]').value.trim() || null,
        description: productForm.querySelector('[name="description"]').value.trim() || null,
        description_ta: productForm.querySelector('[name="description_ta"]').value.trim() || null,
        price: MagizhamUI.toNumber(productForm.querySelector('[name="price"]').value),
        weight: productForm.querySelector('[name="weight"]').value.trim() || null,
        image_url: productForm.querySelector('[name="image_url"]').value.trim() || null,
        stock_quantity: MagizhamUI.toNumber(productForm.querySelector('[name="stock_quantity"]').value),
        is_available: productForm.querySelector('[name="is_available"]').checked
      };

      var request = editingProductId
        ? MagizhamAPI.admin.updateProduct(editingProductId, payload)
        : MagizhamAPI.admin.createProduct(payload);

      request
        .then(function () {
          closeModal();
          MagizhamUI.toast('The product was saved to the database.', 'info');
          return loadProducts();
        })
        .catch(function (err) {
          MagizhamUI.applyValidationErrors(productForm, err && err.details);
          MagizhamUI.reportError(err, 'The product could not be saved.');
        });
    });
  }

  if (categoryForm) {
    categoryForm.addEventListener('submit', function (event) {
      event.preventDefault();
      MagizhamUI.clearFieldErrors(categoryForm);

      var payload = {
        category_name: categoryForm.querySelector('[name="category_name"]').value.trim(),
        category_name_ta: categoryForm.querySelector('[name="category_name_ta"]').value.trim() || null,
        category_slug: categoryForm.querySelector('[name="category_slug"]').value.trim() || undefined,
        description: categoryForm.querySelector('[name="description"]').value.trim() || null,
        description_ta: categoryForm.querySelector('[name="description_ta"]').value.trim() || null,
        display_order: MagizhamUI.toNumber(categoryForm.querySelector('[name="display_order"]').value),
        is_active: categoryForm.querySelector('[name="is_active"]').checked
      };

      var request = editingCategoryId
        ? MagizhamAPI.admin.updateCategory(editingCategoryId, payload)
        : MagizhamAPI.admin.createCategory(payload);

      request
        .then(function () {
          closeModal();
          MagizhamUI.toast('The category was saved to the database.', 'info');
          return loadCategories();
        })
        .catch(function (err) {
          MagizhamUI.applyValidationErrors(categoryForm, err && err.details);
          MagizhamUI.reportError(err, 'The category could not be saved.');
        });
    });
  }

  /* ---------------------------------------------------------- */
  /*  Table actions                                             */
  /* ---------------------------------------------------------- */

  document.addEventListener('click', function (event) {
    var newProduct = event.target.closest('[data-new-product]');
    if (newProduct) {
      openProductForm(null);
      return;
    }

    var newCategory = event.target.closest('[data-new-category]');
    if (newCategory) {
      openCategoryForm(null);
      return;
    }

    var editProduct = event.target.closest('[data-edit-product]');
    if (editProduct) {
      var product = products.filter(function (item) {
        return String(item.id) === editProduct.getAttribute('data-edit-product');
      })[0];
      if (product) openProductForm(product);
      return;
    }

    var deleteProduct = event.target.closest('[data-delete-product]');
    if (deleteProduct) {
      var productId = deleteProduct.getAttribute('data-delete-product');
      if (!window.confirm('Delete this product?')) return;
      MagizhamAPI.admin.deleteProduct(productId)
        .then(function () {
          MagizhamUI.toast('The product was deleted.', 'info');
          return loadProducts();
        })
        .catch(function (err) {
          MagizhamUI.reportError(err, 'The product could not be deleted.');
        });
      return;
    }

    var editCategory = event.target.closest('[data-edit-category]');
    if (editCategory) {
      var category = categories.filter(function (item) {
        return String(item.id) === editCategory.getAttribute('data-edit-category');
      })[0];
      if (category) openCategoryForm(category);
      return;
    }

    var deleteCategory = event.target.closest('[data-delete-category]');
    if (deleteCategory) {
      var categoryId = deleteCategory.getAttribute('data-delete-category');
      if (!window.confirm('Delete this category?')) return;
      MagizhamAPI.admin.deleteCategory(categoryId)
        .then(function () {
          MagizhamUI.toast('The category was deleted.', 'info');
          return loadCategories();
        })
        .catch(function (err) {
          MagizhamUI.reportError(err, 'The category could not be deleted.');
        });
      return;
    }

    var orderDetail = event.target.closest('[data-order-detail]');
    if (orderDetail) {
      var orderId = orderDetail.getAttribute('data-order-detail');
      MagizhamAPI.request('GET', '/admin/orders/' + encodeURIComponent(orderId))
        .then(function (data) {
          var order = (data && data.order) || null;
          if (!order) return;
          var lines = (order.items || []).map(function (item) {
            return item.product_name + ' x ' + item.quantity + ' = ' + item.subtotal_display;
          }).join('\n');
          window.alert(
            'Order #' + order.id + '\n' +
            order.customer_name + ' (' + order.customer_email + ')\n' +
            order.phone + '\n' +
            order.delivery_address + '\n\n' +
            lines + '\n\n' +
            'Total: ' + order.total_amount_display
          );
        })
        .catch(function (err) {
          MagizhamUI.reportError(err, 'The order could not be loaded.');
        });
    }
  });

  document.addEventListener('change', function (event) {
    var select = event.target.closest('.mz-order-status');
    if (!select) return;
    var orderId = select.getAttribute('data-order');
    MagizhamAPI.admin.updateOrderStatus(orderId, select.value)
      .then(function () {
        MagizhamUI.toast('The order status was updated.', 'info');
        return loadOrders();
      })
      .catch(function (err) {
        MagizhamUI.reportError(err, 'The order status could not be updated.');
        return loadOrders();
      });
  });

  /* ---------------------------------------------------------- */
  /*  Toolbar                                                   */
  /* ---------------------------------------------------------- */

  var productSearch = document.getElementById('adminProductSearch');
  if (productSearch) {
    var searchTimer = null;
    productSearch.addEventListener('input', function () {
      var value = productSearch.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        loadProducts(value).catch(function (err) {
          MagizhamUI.reportError(err, 'The products could not be loaded.');
        });
      }, 300);
    });
  }

  var orderFilter = document.getElementById('adminOrderFilter');
  if (orderFilter) {
    orderFilter.addEventListener('change', function () {
      loadOrders(orderFilter.value).catch(function (err) {
        MagizhamUI.reportError(err, 'The orders could not be loaded.');
      });
    });
  }

  /* ---------------------------------------------------------- */
  /*  Boot                                                      */
  /* ---------------------------------------------------------- */

  MagizhamAuth.ready()
    .then(function (user) {
      if (!user || user.role !== 'admin') {
        window.location.replace('admin-login.html');
        return null;
      }

      activateTab('dashboard');

      return Promise.all([
        loadStats(),
        loadCategories(),
        loadProducts(),
        loadOrders(),
        loadUsers()
      ]).catch(function (err) {
        MagizhamUI.reportError(err, 'The administration data could not be loaded.');
      });
    })
    .catch(function () {
      window.location.replace('admin-login.html');
    });
})();
