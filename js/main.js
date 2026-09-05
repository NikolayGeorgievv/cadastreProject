(function () {
  "use strict";

  /* placeholder outline toggle: ?ph=1 or Shift+P */
  var body = document.body;
  if (/[?&]ph=1/.test(location.search)) body.classList.add("show-placeholders");
  document.addEventListener("keydown", function (e) {
    if (e.shiftKey && (e.key === "P" || e.key === "p") && !/input|textarea|select/i.test(e.target.tagName)) {
      body.classList.toggle("show-placeholders");
    }
  });

  /* mobile menu */
  var toggle = document.getElementById("nav-toggle");
  var nav = document.getElementById("nav");
  var DESKTOP = window.matchMedia("(min-width: 64em)");

    /* pillars ship open; collapse on small screens */
    var pillars = Array.prototype.slice.call(document.querySelectorAll("[data-pillar]"));
    if (!DESKTOP.matches) {
      document.documentElement.classList.add("no-anim");
      pillars.forEach(function (item) {
        item.setAttribute("data-open", "false");
        var btn = item.querySelector(".pillar__toggle");
        if (btn) btn.setAttribute("aria-expanded", "false");
      });
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          document.documentElement.classList.remove("no-anim");
        });
      });
    }

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

  /* disclosure widgets: service pillars + FAQ accordion */
  function bindDisclosure(selector, buttonSelector) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (item) {
      var btn = item.querySelector(buttonSelector);
      if (!btn) return;
      btn.addEventListener("click", function () {
        var open = btn.getAttribute("aria-expanded") !== "true";
        btn.setAttribute("aria-expanded", String(open));
        item.setAttribute("data-open", String(open));
      });
    });
  }
  bindDisclosure("[data-pillar]", ".pillar__toggle");
  bindDisclosure("[data-faq]", ".faq__toggle");

  /* active nav link */
  var links = Array.prototype.slice.call(document.querySelectorAll(".nav__link[data-nav]"));
  if (links.length && "IntersectionObserver" in window) {
    var sections = links
      .map(function (l) { return document.getElementById(l.getAttribute("data-nav")); })
      .filter(Boolean);

    var visible = new Map();

    function mark(id) {
      links.forEach(function (l) {
        if (l.getAttribute("data-nav") === id) l.setAttribute("aria-current", "true");
        else l.removeAttribute("aria-current");
      });
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
      });
      var best = null, bestRatio = 0;
      visible.forEach(function (ratio, id) {
        if (ratio > bestRatio) { bestRatio = ratio; best = id; }
      });
      if (best) mark(best);
      else if (window.scrollY < 40) mark("top");
    }, {
      rootMargin: "-30% 0px -50% 0px",
      threshold: [0, 0.25, 0.5, 1]
    });

    sections.forEach(function (s) { io.observe(s); });
  }
})();
