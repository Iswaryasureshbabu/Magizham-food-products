var menuToggle = document.querySelector(".menu-toggle");
var nav = document.querySelector("nav");

if (menuToggle && nav) {
  menuToggle.addEventListener("click", function () {
    nav.classList.toggle("active");
    if (menuToggle.innerHTML.indexOf("bars") > -1) {
      menuToggle.innerHTML = '<i class="fas fa-times"></i>';
    } else {
      menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
    }
  });
}

var header = document.querySelector("header");

window.addEventListener("scroll", function () {
  if (window.scrollY > 50) {
    header.style.boxShadow = "0 8px 25px rgba(0,0,0,.12)";
    header.style.background = "rgba(255,255,255,.98)";
  } else {
    header.style.boxShadow = "0 2px 10px rgba(0,0,0,.06)";
    header.style.background = "rgba(255,255,255,.95)";
  }
});

var searchInput = document.querySelector(".search-box input");

if (searchInput && !document.querySelector(".category-banner")) {
  searchInput.addEventListener("keyup", function () {
    var value = this.value.toLowerCase().trim();
    var searchResults = document.querySelector(".search-results");

    if (searchResults) {
      if (value === "") {
        searchResults.classList.remove("active");
        return;
      }
      var currentLang = localStorage.getItem("magizhamLang") || "English";
      var matches = allProducts.filter(function (p) {
        var nameField = currentLang === "\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD" ? p.nameTa : p.name;
        var catField = currentLang === "\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD" ? p.categoryTa : p.category;
        var descField = currentLang === "\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD" ? p.descTa : p.desc;
        var searchStr = (nameField + " " + catField + " " + p.name + " " + p.nameTa + " " + p.category + " " + p.categoryTa + " " + p.desc + " " + p.descTa).toLowerCase();
        return searchStr.indexOf(value) > -1;
      });
      var html = "";
      if (matches.length === 0) {
        html = '<div class="no-results" data-key="noResults">No products found</div>';
      } else {
        matches.slice(0, 8).forEach(function (p) {
          html += '<a href="' + p.url + '"><img src="' + MagizhamUI.imageSrc(p.image) + '" alt="' + MagizhamUI.escapeHtml(p.name) + '"><span>' + MagizhamUI.escapeHtml(p.name) + ' - ' + MagizhamUI.escapeHtml(p.category) + '</span></a>';
        });
      }
      searchResults.innerHTML = html;
      searchResults.classList.add("active");
    }
  });

  document.addEventListener("click", function (e) {
    var sb = document.querySelector(".search-box");
    if (sb && !sb.contains(e.target)) {
      var sr = document.querySelector(".search-results");
      if (sr) sr.classList.remove("active");
    }
  });
}

window.updateProductLanguage = function(lang) {
  var isTa = lang === "\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD";
  document.querySelectorAll(".product-name-en").forEach(function(el) {
    el.style.display = isTa ? "none" : "";
  });
  document.querySelectorAll(".product-name-ta").forEach(function(el) {
    el.style.display = isTa ? "" : "none";
  });
  document.querySelectorAll(".product-desc-en").forEach(function(el) {
    el.style.display = isTa ? "none" : "";
  });
  document.querySelectorAll(".product-desc-ta").forEach(function(el) {
    el.style.display = isTa ? "" : "none";
  });
};

var revealElements = document.querySelectorAll(
  ".card, .product, .about, .why-grid div, .contact-box div, .offers"
);

function revealOnScroll() {
  var windowHeight = window.innerHeight;

  revealElements.forEach(function (item) {
    var revealTop = item.getBoundingClientRect().top;
    var revealPoint = 120;

    if (revealTop < windowHeight - revealPoint) {
      item.style.opacity = "1";
      item.style.transform = "translateY(0)";
    } else {
      item.style.opacity = "0";
      item.style.transform = "translateY(50px)";
    }
  });
}

window.addEventListener("scroll", revealOnScroll);
setTimeout(revealOnScroll, 200);

var topBtn = document.createElement("button");
topBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
topBtn.className = "topBtn";
document.body.appendChild(topBtn);

window.addEventListener("scroll", function () {
  if (window.scrollY > 400) {
    topBtn.style.display = "block";
  } else {
    topBtn.style.display = "none";
  }
});

topBtn.addEventListener("click", function () {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

document.addEventListener("click", function (e) {
  var btn = e.target.closest("button, .btn");
  if (!btn) return;
  var circle = document.createElement("span");
  var diameter = Math.max(btn.clientWidth, btn.clientHeight);

  circle.style.width = circle.style.height = diameter + "px";
  circle.style.left = e.offsetX - diameter / 2 + "px";
  circle.style.top = e.offsetY - diameter / 2 + "px";
  circle.style.position = "absolute";
  circle.style.borderRadius = "50%";
  circle.style.background = "rgba(255,255,255,.5)";
  circle.style.transform = "scale(0)";
  circle.style.animation = "ripple .6s linear";
  circle.style.pointerEvents = "none";

  btn.style.position = "relative";
  btn.style.overflow = "hidden";
  btn.appendChild(circle);

  setTimeout(function () {
    circle.remove();
  }, 600);
});

if (!document.getElementById("ripple-style")) {
  var rippleStyle = document.createElement("style");
  rippleStyle.id = "ripple-style";
  rippleStyle.innerHTML =
    "@keyframes ripple{to{transform:scale(4);opacity:0;}}";
  document.head.appendChild(rippleStyle);
}
