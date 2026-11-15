// ==============================================
// ROUTER - centralized navigation & routing
// - Canonical page#section navigation everywhere
// - Same-page smooth scrolling (no page reload)
// - Active nav link highlighting on every page
// - Auto-scroll to section when returning Home
// ==============================================

var router = (function () {
  var isHomePage = !!document.querySelector(".hero");
  var isCategoryPage = !!document.querySelector(".category-banner");

  function closeMobileMenu() {
    var nav = document.querySelector("nav");
    var menuToggle = document.querySelector(".menu-toggle");
    if (nav) nav.classList.remove("active");
    if (menuToggle) menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
  }

  // ---------- Active nav link ----------

  // Category pages: highlight the "Categories" menu item
  function highlightPageSpecific() {
    if (!isCategoryPage) return;
    document.querySelectorAll("nav ul li a").forEach(function (link) {
      var href = link.getAttribute("href");
      if (href === "index.html#categories" || href === "#categories") {
        link.classList.add("active");
      }
    });
  }

  // Home page: highlight the menu item of the section in view
  function highlightCurrentSection() {
    if (!isHomePage) return;
    var sections = document.querySelectorAll("section[id]");
    var navLinks = document.querySelectorAll("nav ul li a");
    if (sections.length === 0 || navLinks.length === 0) return;

    var current = "";
    var scrollY = window.pageYOffset || document.documentElement.scrollTop;
    sections.forEach(function (section) {
      if (scrollY >= section.offsetTop - 100) {
        current = section.getAttribute("id");
      }
    });

    navLinks.forEach(function (link) {
      var href = link.getAttribute("href") || "";
      var active = false;
      if (current) {
        if (href === "#" + current || href === "index.html#" + current) {
          active = true;
        }
        if (current === "home" && (href === "index.html" || href === "")) {
          active = true;
        }
      }
      link.classList.toggle("active", active);
    });
  }

  // ---------- Click handling ----------

  // #target on the current page  -> smooth scroll (no reload)
  // otherPage#target             -> native navigation + auto-scroll
  // # placeholder                -> do nothing (no jump, no error)
  function handleClick(e) {
    var anchor = e.target.closest("a[href]");
    if (!anchor) return;
    var href = anchor.getAttribute("href");
    if (!href) return;

    var hashIndex = href.indexOf("#");
    if (hashIndex === -1) return;

    var hash = href.slice(hashIndex + 1);

    if (hash === "") {
      e.preventDefault();
      return;
    }

    var target = document.getElementById(hash);
    if (!target) return;

    e.preventDefault();
    closeMobileMenu();
    target.scrollIntoView({ behavior: "smooth" });
  }

  // ---------- Auto-scroll to section on load ----------

  // Guarantees the page lands on the requested section when
  // navigating back to the Home page (index.html#section).
  function scrollToHashOnLoad() {
    if (!location.hash) return;
    setTimeout(function () {
      var el = document.getElementById(location.hash.slice(1));
      if (!el) return;
      var rect = el.getBoundingClientRect();
      if (Math.abs(rect.top) > 200) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }, 150);
  }

  function init() {
    highlightPageSpecific();
    highlightCurrentSection();
    scrollToHashOnLoad();
    if (isHomePage) {
      window.addEventListener("scroll", highlightCurrentSection);
    }
    document.addEventListener("click", handleClick);
  }

  return { init: init };
})();

router.init();
