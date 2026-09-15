(function () {
  "use strict";

  /* placeholder outline toggle: ?ph=1 or Shift+P.
     e.code is the physical key, so this still works on a Bulgarian layout
     where Shift+P produces "П" rather than "P". */
  var body = document.body;
  if (/[?&]ph=1/.test(location.search)) body.classList.add("show-placeholders");
  document.addEventListener("keydown", function (e) {
    if (e.shiftKey && e.code === "KeyP" && !/input|textarea|select/i.test(e.target.tagName)) {
      body.classList.toggle("show-placeholders");
    }
  });

  /* mobile menu */
  var toggle = document.getElementById("nav-toggle");
  var nav = document.getElementById("nav");
  var DESKTOP = window.matchMedia("(min-width: 64em)");

  function setMenu(open) {
    if (!toggle || !nav) return;
    toggle.setAttribute("aria-expanded", String(open));
    nav.setAttribute("data-open", String(open));
  }

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a") && !DESKTOP.matches) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        toggle.focus();
      }
    });
    DESKTOP.addEventListener("change", function () { setMenu(false); });
  }

  /* services accordion */
  function setOpen(item, open) {
    var btn = item.querySelector(".svc__toggle");
    item.setAttribute("data-open", String(open));
    if (btn) btn.setAttribute("aria-expanded", String(open));
  }

  var items = Array.prototype.slice.call(document.querySelectorAll("[data-svc]"));
  items.forEach(function (item) {
    var btn = item.querySelector(".svc__toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      setOpen(item, btn.getAttribute("aria-expanded") !== "true");
    });
  });

  /* deep links: index.html#usluga-trasirane opens that service.
     Ad landing pages and the footer links rely on this. */
  function openFromHash() {
    var id = location.hash.slice(1);
    if (!id) return;
    var item = document.getElementById(id);
    if (!item || !item.hasAttribute("data-svc")) return;
    setOpen(item, true);
    item.scrollIntoView({ block: "start" });
  }
  openFromHash();
  window.addEventListener("hashchange", openFromHash);

  /* active nav link.
     "top" is excluded deliberately: it resolves to <body>, which is always
     intersecting and would compete with the real sections. */
  var links = Array.prototype.slice.call(document.querySelectorAll(".nav__link[data-nav]"));
  if (links.length && "IntersectionObserver" in window) {
    var sections = links
      .filter(function (l) { return l.getAttribute("data-nav") !== "top"; })
      .map(function (l) { return document.getElementById(l.getAttribute("data-nav")); })
      .filter(Boolean);

    function mark(id) {
      links.forEach(function (l) {
        if (l.getAttribute("data-nav") === id) l.setAttribute("aria-current", "true");
        else l.removeAttribute("aria-current");
      });
    }

    var live = new Set();

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) live.add(entry.target);
        else live.delete(entry.target);
      });

      if (window.scrollY < 40) { mark("top"); return; }

      /* topmost section still in the band wins — a tall section you are
         reading beats a short one that happens to be fully visible */
      var best = null;
      live.forEach(function (el) {
        if (!best || el.getBoundingClientRect().top < best.getBoundingClientRect().top) best = el;
      });
      if (best) mark(best.id);
    }, {
      rootMargin: "-30% 0px -50% 0px",
      threshold: 0
    });

    sections.forEach(function (s) { io.observe(s); });
  }
})();
