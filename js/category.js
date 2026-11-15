function getQueryParam(name) {
  var params = new URL(window.location.href).searchParams;
  return params.get(name);
}

window.updateCategoryHeader = function(lang) {
  if (!currentCategory) return;
  var cat = products[currentCategory];
  if (!cat) return;
  var isTa = lang === "\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD";

  var titleEl = document.getElementById("catTitle");
  var descEl = document.getElementById("catDesc");
  var breadcrumbEl = document.getElementById("breadcrumbCat");

  if (titleEl) titleEl.textContent = isTa ? cat.nameTa : cat.name;
  if (descEl) {
    // Category sentences are optional: nothing is shown until verified text exists.
    var catText = isTa ? cat.bannerTa : cat.banner;
    descEl.textContent = catText || '';
    descEl.style.display = catText ? '' : 'none';
  }
  if (breadcrumbEl) breadcrumbEl.textContent = isTa ? cat.nameTa : cat.name;

  var titleName = isTa ? cat.nameTa : cat.name;
  var siteName = isTa ? "\u0BAE\u0B95\u0BBF\u0BB4\u0BAE\u0BCD \u0B89\u0BA3\u0BB5\u0BC1\u0BAA\u0BCD \u0BAA\u0BCA\u0BB0\u0BC1\u0B9F\u0BCD\u0B95\u0BB3\u0BCD" : "Magizham Food Products";
  document.title = titleName + " - " + siteName;
};

function renderCategoryPage(catId) {
  if (!catId) {
    window.location.href = "index.html";
    return;
  }

  window.currentCategory = catId;
  var cat = products[catId];
  if (!cat) {
    window.location.href = "index.html";
    return;
  }

  var lang = localStorage.getItem("magizhamLang") || "English";

  updateCategoryHeader(lang);

  var grid = document.querySelector(".product-grid");
  if (!grid) return;
  grid.innerHTML = "";

  cat.products.forEach(function(prod) {
    var div = document.createElement("div");
    div.className = "product";
    div.id = "product-" + prod.id;
    div.setAttribute("data-cat", catId);
    div.setAttribute("data-id", prod.id);

    // Stock and availability come from the database.
    var inStock = prod.avail !== false;
    if (inStock && prod.stock !== null && prod.stock !== undefined) {
      inStock = prod.stock > 0;
    }
    var stockLabel = inStock ? "In Stock" : "Out of Stock";
    var stockKey = inStock ? "inStock" : "outOfStock";

    div.innerHTML =
      '<img src="' + MagizhamUI.imageSrc(prod.image) + '" alt="' + MagizhamUI.escapeHtml(prod.name) + '">' +
      '<div class="product-info">' +
        '<h3 class="product-name-en">' + MagizhamUI.escapeHtml(prod.name) + '</h3>' +
        '<h3 class="product-name-ta" style="display:none">' + MagizhamUI.escapeHtml(prod.nameTa) + '</h3>' +
        (prod.desc ? '<p class="product-desc product-desc-en">' + MagizhamUI.escapeHtml(prod.desc) + '</p>' : '') +
        (prod.descTa ? '<p class="product-desc product-desc-ta" style="display:none">' + MagizhamUI.escapeHtml(prod.descTa) + '</p>' : '') +
        '<p class="product-weight"><span data-key="weightLabel">Weight</span>: ' + MagizhamUI.escapeHtml(prod.weight) + '</p>' +
        '<p class="product-price"><span data-key="priceLabel">Price</span>: ' + MagizhamUI.escapeHtml(prod.price) + '</p>' +
        '<p class="product-avail" data-key="' + stockKey + '">' + stockLabel + '</p>' +
        '<div class="product-actions">' +
          '<button class="add-cart" data-key="addToCart"' + (inStock ? '' : ' disabled') + '>Add to Cart</button>' +
          '<button class="buy-now" data-key="buyNow"' + (inStock ? '' : ' disabled') + '>Buy Now</button>' +
        '</div>' +
      '</div>';
    grid.appendChild(div);
  });

  updateProductLanguage(lang);
  setupCategorySearch(catId);

  // The cards are created after the language module ran, so the labels are
  // translated once more.
  if (typeof translate === 'function') translate(lang);
}

function setupCategorySearch(catId) {
  var searchInput = document.querySelector(".search-box input");
  if (!searchInput) return;

  var cat = products[catId];
  if (!cat) return;

  var searchHandler = function() {
    var value = this.value.toLowerCase().trim();
    var searchResults = document.querySelector(".search-results");
    if (!searchResults) return;

    if (value === "") {
      searchResults.classList.remove("active");
      return;
    }

    var matches = cat.products.filter(function(p) {
      var searchStr = (p.name + " " + p.nameTa + " " + p.desc + " " + p.descTa).toLowerCase();
      return searchStr.indexOf(value) > -1;
    });

    var html = "";
    if (matches.length === 0) {
      html = '<div class="no-results" data-key="noResults">No products found</div>';
    } else {
      matches.slice(0, 8).forEach(function(p) {
        html += '<a href="#product-' + p.id + '"><img src="' + MagizhamUI.imageSrc(p.image) + '" alt="' + MagizhamUI.escapeHtml(p.name) + '"><span>' + MagizhamUI.escapeHtml(p.name) + '</span></a>';
      });
    }
    searchResults.innerHTML = html;
    searchResults.classList.add("active");
  };

  // The page can be rendered more than once (once with the bundled
  // catalogue, once with the database content) - only one listener may
  // stay attached.
  if (searchInput.magizhamSearchHandler) {
    searchInput.removeEventListener("keyup", searchInput.magizhamSearchHandler);
  }
  searchInput.magizhamSearchHandler = searchHandler;
  searchInput.addEventListener("keyup", searchHandler);

  if (!searchInput.magizhamCloseBound) {
    searchInput.magizhamCloseBound = true;
    document.addEventListener("click", function(e) {
      var sb = document.querySelector(".search-box");
      if (sb && !sb.contains(e.target)) {
        var sr = document.querySelector(".search-results");
        if (sr) sr.classList.remove("active");
      }
    });
  }
}

if (document.querySelector(".product-grid")) {
  renderCategoryPage(getQueryParam("type"));
}
