// ==============================================
// CATALOGUE LOADER - PostgreSQL becomes the source of truth
//
// The API returns the catalogue in its own shape. It is converted into the
// very same structure that js/products.js provides, so every existing
// module (category page, search, cart, ...) keeps working unchanged.
//
// When the API cannot be reached the bundled catalogue is used, so the
// shop never turns into an empty page.
// ==============================================

var MagizhamCatalog = (function () {
  'use strict';

  var loaded = false;

  /* ---------------------------------------------------------- */
  /*  Conversion                                               */
  /* ---------------------------------------------------------- */

  /** "images/idli-podi.jpg" -> "idli-podi.jpg" (kept next to the other fields) */
  function imageName(value) {
    if (!value) return '';
    var path = String(value).replace(/\\/g, '/');
    var slash = path.lastIndexOf('/');
    return slash === -1 ? path : path.slice(slash + 1);
  }

  function toProduct(apiProduct) {
    var price = MagizhamUI.toNumber(apiProduct.price);
    return {
      id: apiProduct.id,
      name: apiProduct.product_name,
      nameTa: apiProduct.product_name_ta || '',
      desc: apiProduct.description || '',
      descTa: apiProduct.description_ta || '',
      image: imageName(apiProduct.image_url),
      weight: apiProduct.weight || '',
      price: apiProduct.price_display || MagizhamUI.formatPrice(price),
      priceValue: price,
      avail: apiProduct.is_available !== false,
      stock: apiProduct.stock_quantity === undefined ? null : Number(apiProduct.stock_quantity),
      slug: apiProduct.product_slug || ''
    };
  }

  /**
   * Rebuild the global "products" object from the API response.
   * The shape stays identical to js/products.js.
   */
  function buildCatalogue(categories, products) {
    var byCategory = {};

    categories.forEach(function (category) {
      byCategory[category.category_slug] = {
        id: category.category_slug,
        name: category.category_name,
        nameTa: category.category_name_ta || '',
        banner: category.description || '',
        bannerTa: category.description_ta || '',
        products: []
      };
    });

    products.forEach(function (apiProduct) {
      var key = apiProduct.category_slug;
      if (!byCategory[key]) return;
      byCategory[key].products.push(toProduct(apiProduct));
    });

    return byCategory;
  }

  /** Rebuild the flat list that the header search works with. */
  function buildFlatList(catalogue) {
    var flat = [];
    Object.keys(catalogue).forEach(function (key) {
      var category = catalogue[key];
      category.products.forEach(function (product) {
        flat.push({
          id: product.id,
          name: product.name,
          nameTa: product.nameTa,
          category: category.name,
          categoryTa: category.nameTa,
          desc: product.desc,
          descTa: product.descTa,
          image: product.image,
          weight: product.weight,
          price: product.price,
          avail: product.avail,
          url: 'category.html?type=' + key
        });
      });
    });
    return flat;
  }

  /* ---------------------------------------------------------- */
  /*  Loading                                                  */
  /* ---------------------------------------------------------- */

  function load() {
    if (loaded) return Promise.resolve(false);
    loaded = true;

    return Promise.all([MagizhamAPI.getCategories(), MagizhamAPI.getProducts({ limit: 200 })])
      .then(function (results) {
        var apiCategories = (results[0] && results[0].categories) || [];
        var apiProducts = (results[1] && results[1].products) || [];

        if (!apiCategories.length || !apiProducts.length) {
          MagizhamUI.toast('The database has no products yet - showing the bundled catalogue.', 'warn');
          return false;
        }

        var catalogue = buildCatalogue(apiCategories, apiProducts);

        // Replace the bundled catalogue with the database content.
        var bundled = window.products || {};
        Object.keys(bundled).forEach(function (key) {
          delete bundled[key];
        });
        Object.keys(catalogue).forEach(function (key) {
          bundled[key] = catalogue[key];
        });

        // Rebuild the flat list used by the header search.
        window.allProducts = buildFlatList(catalogue);

        // The category page has to show the database content as well.
        if (typeof window.renderCategoryPage === 'function') {
          var slug = null;
          try {
            slug = new URL(window.location.href).searchParams.get('type');
          } catch (e) {
            slug = null;
          }
          if (slug) window.renderCategoryPage(slug);
        }

        // The cart can hold products that were renamed in the database.
        document.dispatchEvent(new CustomEvent('magizham:catalogue-updated'));

        return true;
      })
      .catch(function (err) {
        MagizhamUI.toast(
          'Working with the offline catalogue - the database is not reachable.',
          'warn'
        );
        if (window.console) console.warn('[catalog]', err);
        return false;
      });
  }

  function init() {
    load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    load: load,
    buildCatalogue: buildCatalogue,
    toProduct: toProduct
  };
})();
