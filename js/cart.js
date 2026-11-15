// ==============================================
// CART SYSTEM
//
// - guests keep their cart in localStorage (WhatsApp ordering stays intact)
// - signed in customers get a cart that lives in PostgreSQL
// - the visual design of the cart page is unchanged
// ==============================================

var WHATSAPP_NUMBER = "919842805607";

var cartState = {
  signedIn: false,
  serverItems: [],   // normalised items coming from the API
  itemCount: 0,
  totalAmount: 0,
  ready: false
};

/* ==============================================
   STORAGE HELPERS (guest cart)
   ============================================== */

function getCart() {
  try {
    return JSON.parse(localStorage.getItem("magizhamCart") || "[]");
  } catch (e) {
    return [];
  }
}

function saveCart(items) {
  localStorage.setItem("magizhamCart", JSON.stringify(items));
  updateCartBadge();
}

/** Convert a stored guest item into the shape used everywhere else. */
function normalizeGuestItem(item) {
  return {
    cartItemId: null,
    productId: item.id,
    name: item.name,
    nameTa: item.nameTa || "",
    desc: "",
    descTa: "",
    image: item.image,
    weight: item.weight || "",
    price: item.price,
    priceValue: priceNumber(item.price),
    qty: item.qty || 1,
    stock: null,
    avail: true
  };
}

/** Convert an API cart row into the shape used everywhere else. */
function normalizeServerItem(item) {
  return {
    cartItemId: item.id,
    productId: item.product_id,
    name: item.product_name,
    nameTa: item.product_name_ta || "",
    desc: item.description || "",
    descTa: item.description_ta || "",
    image: item.image_url || "",
    weight: item.weight || "",
    price: item.unit_price_display || MagizhamUI.formatPrice(item.unit_price),
    priceValue: MagizhamUI.toNumber(item.unit_price),
    qty: item.quantity || 1,
    stock: item.stock_quantity === undefined ? null : Number(item.stock_quantity),
    avail: item.is_available !== false
  };
}

/** The items that are currently shown on screen. */
function currentCartItems() {
  if (cartState.signedIn) return cartState.serverItems;
  return getCart().map(normalizeGuestItem);
}

function currentCartCount() {
  if (cartState.signedIn) return cartState.itemCount;
  var count = 0;
  getCart().forEach(function (item) {
    count += item.qty || 1;
  });
  return count;
}

/* ==============================================
   BADGE
   ============================================== */

function updateCartBadge() {
  var badge = document.getElementById("cartCount");
  if (!badge) return;
  var count = currentCartCount();
  badge.textContent = count;
  badge.style.display = count > 0 ? "flex" : "none";
}

/* ==============================================
   SERVER CART
   ============================================== */

function applyServerCart(cart) {
  var data = cart || {};
  cartState.serverItems = (data.items || []).map(normalizeServerItem);
  cartState.itemCount = Number(data.item_count || 0);
  cartState.totalAmount = MagizhamUI.toNumber(data.total_amount || 0);
  updateCartBadge();
}

function loadServerCart() {
  return MagizhamAPI.getCart()
    .then(function (cart) {
      applyServerCart(cart);
      renderCartPage(cartLang());
      return cart;
    })
    .catch(function (err) {
      if (err && err.status === 401) {
        cartState.signedIn = false;
        updateCartBadge();
        renderCartPage(cartLang());
        return null;
      }
      MagizhamUI.reportError(err, "The cart could not be loaded.");
      return null;
    });
}

/** Move the guest cart of localStorage into the account of the customer. */
function syncGuestCart() {
  var guest = getCart();
  if (!guest.length) return Promise.resolve(null);

  var payload = guest.map(function (item) {
    return { product_id: item.id, quantity: item.qty || 1 };
  });

  return MagizhamAPI.syncCart(payload)
    .then(function (cart) {
      try {
        localStorage.removeItem("magizhamCart");
      } catch (e) {
        /* storage not available */
      }
      applyServerCart(cart);
      renderCartPage(cartLang());
      return cart;
    })
    .catch(function (err) {
      MagizhamUI.reportError(err, "The cart could not be moved to your account.");
      return null;
    });
}

/* ==============================================
   ADD / UPDATE / REMOVE
   ============================================== */

function findProductFromButton(btn) {
  var card = btn.closest(".product");
  if (!card) return null;
  var catId = card.getAttribute("data-cat");
  var prodId = parseInt(card.getAttribute("data-id"), 10);
  if (!catId || !products[catId]) return null;
  var prod = null;
  products[catId].products.forEach(function (p) {
    if (p.id === prodId) prod = p;
  });
  if (!prod) return null;
  return { catId: catId, product: prod };
}

function magizhamAddToCart(catId, prod) {
  if (!prod) return;

  if (prod.avail === false) {
    MagizhamUI.toast("This product is currently unavailable.", "warn");
    return;
  }
  if (prod.stock !== null && prod.stock !== undefined && prod.stock <= 0) {
    MagizhamUI.toast("This product is out of stock.", "warn");
    return;
  }

  if (cartState.signedIn) {
    MagizhamAPI.addToCart(prod.id, 1)
      .then(function (result) {
        applyServerCart(result && result.cart);
        renderCartPage(cartLang());
        MagizhamUI.toast(prod.name + " added to your cart.", "info");
      })
      .catch(function (err) {
        MagizhamUI.reportError(err, "The product could not be added to the cart.");
      });
    return;
  }

  var items = getCart();
  var existing = null;
  items.forEach(function (item) {
    if (item.id === prod.id) existing = item;
  });
  if (existing) {
    existing.qty = (existing.qty || 1) + 1;
  } else {
    items.push({
      id: prod.id,
      catId: catId,
      name: prod.name,
      nameTa: prod.nameTa,
      image: prod.image,
      weight: prod.weight,
      price: prod.price,
      qty: 1
    });
  }
  saveCart(items);
  renderCartPage(cartLang());
}

function magizhamBuyNow(prod) {
  var lang = cartLang();
  var labels = cartLabels(lang);
  var isTa = lang === "\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD";
  var name = isTa ? prod.nameTa : prod.name;
  var msg = labels.intro + name + " (" + prod.weight + ") - " + prod.price;
  window.open("https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(msg), "_blank");
}

function priceNumber(price) {
  var num = parseFloat(String(price).replace(/[^0-9.]/g, ""));
  return isNaN(num) ? 0 : num;
}

function changeQuantity(productId, delta) {
  if (cartState.signedIn) {
    var item = null;
    cartState.serverItems.forEach(function (entry) {
      if (entry.productId === productId) item = entry;
    });
    if (!item) return;

    var next = item.qty + delta;
    if (next < 1) {
      removeFromCart(productId);
      return;
    }
    if (item.stock !== null && item.stock !== undefined && next > item.stock) {
      MagizhamUI.toast("Only " + item.stock + " unit(s) of this product are in stock.", "warn");
      return;
    }

    MagizhamAPI.updateCartItem(item.cartItemId, next)
      .then(function (result) {
        applyServerCart(result && result.cart);
        renderCartPage(cartLang());
      })
      .catch(function (err) {
        MagizhamUI.reportError(err, "The quantity could not be changed.");
      });
    return;
  }

  var items = getCart();
  items.forEach(function (item) {
    if (item.id === productId) {
      item.qty = (item.qty || 1) + delta;
    }
  });
  items = items.filter(function (item) {
    return item.qty > 0;
  });
  saveCart(items);
  renderCartPage(cartLang());
}

function removeFromCart(productId) {
  if (cartState.signedIn) {
    var item = null;
    cartState.serverItems.forEach(function (entry) {
      if (entry.productId === productId) item = entry;
    });
    if (!item) return;

    MagizhamAPI.removeCartItem(item.cartItemId)
      .then(function (result) {
        applyServerCart(result && result.cart);
        renderCartPage(cartLang());
      })
      .catch(function (err) {
        MagizhamUI.reportError(err, "The product could not be removed from the cart.");
      });
    return;
  }

  var afterRemove = getCart().filter(function (item) {
    return item.id !== productId;
  });
  saveCart(afterRemove);
  renderCartPage(cartLang());
}

/* ==============================================
   CART PAGE RENDER
   ============================================== */

function cartLang() {
  return localStorage.getItem("magizhamLang") || "English";
}

function cartLabels(lang) {
  var t = (typeof translations !== "undefined") ? translations[lang] : null;
  return {
    qty: (t && t.cartQty) || "Qty",
    remove: (t && t.cartRemove) || "Remove",
    weight: (t && t.weightLabel) || "Weight",
    price: (t && t.priceLabel) || "Price",
    intro: (t && t.cartOrderIntro) || "Hello! I would like to order:\n"
  };
}

function renderCartPage(lang) {
  var container = document.getElementById("cartItems");
  if (!container) return;

  var isTa = lang === "\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD";
  var labels = cartLabels(lang);
  var items = currentCartItems();
  var emptyBox = document.getElementById("cartEmpty");
  var footer = document.getElementById("cartFooter");
  var totalEl = document.getElementById("cartTotalValue");
  var waBtn = document.getElementById("cartWhatsApp");

  if (items.length === 0) {
    if (emptyBox) emptyBox.style.display = "";
    if (footer) footer.style.display = "none";
    container.innerHTML = "";
    renderCheckoutButton(items.length);
    return;
  }

  if (emptyBox) emptyBox.style.display = "none";
  if (footer) footer.style.display = "";

  var total = 0;
  var msg = labels.intro;

  container.innerHTML = items.map(function (item) {
    var name = isTa ? (item.nameTa || item.name) : item.name;
    var price = item.priceValue || priceNumber(item.price);
    var lineTotal = price * (item.qty || 1);
    total += lineTotal;
    msg += "\u2022 " + name + " (" + item.weight + ") x " + item.qty + " = \u20B9" + lineTotal;
    return '' +
      '<div class="cart-item">' +
        '<img src="' + MagizhamUI.imageSrc(item.image) + '" alt="' + MagizhamUI.escapeHtml(item.name) + '">' +
        '<div class="cart-item-info">' +
          '<h3>' + MagizhamUI.escapeHtml(name) + '</h3>' +
          '<p>' + labels.weight + ': ' + MagizhamUI.escapeHtml(item.weight) + '</p>' +
          '<p class="cart-item-price">' + MagizhamUI.escapeHtml(item.price) + '</p>' +
        '</div>' +
        '<div class="cart-qty">' +
          '<button class="qty-minus" data-id="' + item.productId + '" aria-label="-">\u2212</button>' +
          '<span class="qty-val">' + item.qty + '</span>' +
          '<button class="qty-plus" data-id="' + item.productId + '" aria-label="+">+</button>' +
        '</div>' +
        '<button class="cart-remove" data-id="' + item.productId + '" title="' + labels.remove + '" aria-label="' + labels.remove + '"><i class="fa-solid fa-trash"></i></button>' +
      '</div>';
  }).join("");

  if (totalEl) totalEl.textContent = "\u20B9" + total;
  if (waBtn) waBtn.href = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(msg);
  renderCheckoutButton(items.length);
}

/* ==============================================
   CHECKOUT BUTTON (only for signed in customers)
   ============================================== */

function renderCheckoutButton(itemCount) {
  var actions = document.querySelector(".cart-actions");
  if (!actions) return;

  var existing = document.getElementById("mzCheckoutBtn");
  if (!cartState.signedIn || !itemCount) {
    if (existing) existing.parentNode.removeChild(existing);
    return;
  }
  if (existing) return;

  var link = document.createElement("a");
  link.href = "checkout.html";
  link.id = "mzCheckoutBtn";
  link.className = "btn cart-order";
  link.setAttribute("data-key", "cartCheckout");
  link.innerHTML = '<i class="fa-solid fa-bag-shopping"></i> ' +
    (typeof translations !== "undefined" && translations[cartLang()]
      ? translations[cartLang()].cartCheckout
      : "Checkout");
  actions.insertBefore(link, actions.firstChild);
}

window.updateCartLanguage = function (lang) {
  if (document.getElementById("cartItems")) {
    renderCartPage(lang || cartLang());
  }
};

/* ==============================================
   CLICK HANDLERS (delegated)
   ============================================== */

document.addEventListener("click", function (e) {
  var addBtn = e.target.closest(".add-cart");
  if (addBtn) {
    var found = findProductFromButton(addBtn);
    if (found) magizhamAddToCart(found.catId, found.product);
    return;
  }

  var buyBtn = e.target.closest(".buy-now");
  if (buyBtn) {
    var foundBuy = findProductFromButton(buyBtn);
    if (foundBuy) magizhamBuyNow(foundBuy.product);
    return;
  }

  var removeBtn = e.target.closest(".cart-remove");
  if (removeBtn) {
    var removeId = parseInt(removeBtn.getAttribute("data-id"), 10);
    removeFromCart(removeId);
    return;
  }

  var qtyBtn = e.target.closest(".qty-plus, .qty-minus");
  if (qtyBtn) {
    var qtyId = parseInt(qtyBtn.getAttribute("data-id"), 10);
    var delta = qtyBtn.classList.contains("qty-plus") ? 1 : -1;
    changeQuantity(qtyId, delta);
  }
});

/* ==============================================
   CATALOGUE UPDATES
   ============================================== */

/** Find a product of the (database backed) catalogue by its id. */
function findCatalogueProduct(productId) {
  var catalogue = window.products || {};
  var found = null;
  Object.keys(catalogue).forEach(function (catId) {
    var category = catalogue[catId];
    if (!category || !category.products) return;
    category.products.forEach(function (product) {
      if (product.id === productId) found = product;
    });
  });
  return found;
}

/**
 * The catalogue was reloaded from the database - products that were renamed
 * or repriced have to be updated inside the cart as well.
 */
function refreshCartFromCatalogue() {
  if (cartState.signedIn) {
    loadServerCart();
    return;
  }

  var items = getCart();
  if (!items.length) return;

  var changed = false;
  items.forEach(function (item) {
    var product = findCatalogueProduct(item.id);
    if (!product) return;
    if (item.name !== product.name) { item.name = product.name; changed = true; }
    if (product.nameTa && item.nameTa !== product.nameTa) { item.nameTa = product.nameTa; changed = true; }
    if (product.image && item.image !== product.image) { item.image = product.image; changed = true; }
    if (product.weight && item.weight !== product.weight) { item.weight = product.weight; changed = true; }
    if (product.price && item.price !== product.price) { item.price = product.price; changed = true; }
  });

  if (changed) saveCart(items);
  renderCartPage(cartLang());
}

document.addEventListener("magizham:catalogue-updated", refreshCartFromCatalogue);

/* ==============================================
   SESSION HANDLING
   ============================================== */

/** Resolves as soon as the cart matches the session (used before a redirect). */
var cartReadyPromise = Promise.resolve();

window.magizhamCartReady = function () {
  return cartReadyPromise;
};

MagizhamAuth.onChange(function (user) {
  cartState.signedIn = !!user;

  if (cartState.signedIn) {
    if (getCart().length) {
      // The guest cart is moved into the account of the customer.
      cartReadyPromise = syncGuestCart();
    } else {
      cartReadyPromise = loadServerCart();
    }
  } else {
    cartReadyPromise = Promise.resolve();
    cartState.serverItems = [];
    cartState.itemCount = 0;
    updateCartBadge();
    renderCartPage(cartLang());
  }
});

/* ==============================================
   INIT
   ============================================== */

(function initCart() {
  MagizhamAuth.ready().then(function (user) {
    cartState.ready = true;
    if (!user) {
      // Guests keep the localStorage cart.
      updateCartBadge();
      renderCartPage(cartLang());
    }
    // For signed in customers the onChange handler already loaded the
    // server cart (it runs before this callback).
  });
})();
