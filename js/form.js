/* The only place that changes when a backend exists. */
async function submitRequest(payload) {
  console.log("submitRequest", payload);
  return { ok: true };
}

(function () {
  "use strict";

  var form = document.getElementById("request-form");
  if (!form) return;

  var successPanel = document.getElementById("form-success");
  var errorPanel = document.getElementById("form-error");
  var submitBtn = document.getElementById("submit-btn");

  /* preselect service from ?service=<slug> */
  var select = form.elements.service;
  var slug = new URLSearchParams(location.search).get("service");
  if (slug && select) {
    var match = Array.prototype.some.call(select.options, function (o) { return o.value === slug; });
    select.value = match ? slug : "drugo";
  }

  /* rules — messages say what to fix, not what went wrong */
  var rules = {
    name: function (v) { return v.trim().length >= 2 ? "" : "Напишете името си, за да знаем как да се обърнем към Вас."; },
    phone: function (v) {
      var digits = v.replace(/[^\d]/g, "");
      if (digits.length < 8) return "Добавете телефон с код - например 0888 123 456.";
      return "";
    },
    email: function (v) {
      if (!v.trim()) return "";
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "" : "Проверете имейла - трябва да съдържа @ и домейн, например ime@mail.bg.";
    },
    service: function (v) { return v ? "" : "Изберете услуга от списъка, или „Друго“, ако не сте сигурни."; },
    location: function (v) { return v.trim().length >= 2 ? "" : "Напишете населеното място или местността, където е имотът."; },
    identifier: function () { return ""; },
    message: function (v) { return v.trim().length >= 10 ? "" : "Опишете накратко какво ви е нужно - един-два реда стигат."; },
    consent: function (_v, el) { return el.checked ? "" : "Отбележете съгласието, за да можем да обработим заявката."; }
  };

  var fields = {};
  Array.prototype.forEach.call(form.querySelectorAll("[data-field]"), function (wrap) {
    var key = wrap.getAttribute("data-field");
    var el = form.elements[key];
    if (!el) return;
    fields[key] = { wrap: wrap, el: el, error: wrap.querySelector(".field__error"), touched: false };
  });

  function validate(key, force) {
    var f = fields[key];
    if (!f) return true;
    var msg = rules[key] ? rules[key](f.el.value || "", f.el) : "";
    var show = (f.touched || force) && msg;
    f.wrap.setAttribute("data-invalid", show ? "true" : "false");
    f.error.textContent = show ? msg : "";
    f.el.setAttribute("aria-invalid", show ? "true" : "false");
    if (show) f.el.setAttribute("aria-describedby", f.error.id);
    return !msg;
  }

  Object.keys(fields).forEach(function (key) {
    var f = fields[key];
    var blurEvent = f.el.type === "checkbox" || f.el.tagName === "SELECT" ? "change" : "blur";
    f.el.addEventListener(blurEvent, function () {
      f.touched = true;
      validate(key);
    });
    f.el.addEventListener("input", function () {
      if (f.touched) validate(key);
    });
  });

  /* honeypot: real people never see this field, so anything in it is a bot.
     openedAt catches the other common pattern — a submit within a second or
     two of load, which no human types fast enough to produce. */
  var openedAt = Date.now();

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    errorPanel.hidden = true;

    var firstBad = null;
    Object.keys(fields).forEach(function (key) {
      fields[key].touched = true;
      var ok = validate(key, true);
      if (!ok && !firstBad) firstBad = fields[key].el;
    });

    if (firstBad) {
      firstBad.focus();
      return;
    }

    var payload = {
      name: fields.name.el.value.trim(),
      phone: fields.phone.el.value.trim(),
      email: fields.email.el.value.trim(),
      service: fields.service.el.value,
      location: fields.location.el.value.trim(),
      identifier: fields.identifier.el.value.trim(),
      message: fields.message.el.value.trim(),
      consent: fields.consent.el.checked,
      submittedAt: new Date().toISOString(),
      /* server-side spam signals — never trust these in the browser */
      hp: form.elements.website ? form.elements.website.value : "",
      elapsedMs: Date.now() - openedAt
    };

    submitBtn.disabled = true;
    submitBtn.textContent = "Изпращане…";

    try {
      var res = await submitRequest(payload);
      if (res && res.ok === false) throw new Error("rejected");
      form.hidden = true;
      successPanel.hidden = false;
      successPanel.querySelector("h2").setAttribute("tabindex", "-1");
      successPanel.querySelector("h2").focus();
    } catch (err) {
      errorPanel.hidden = false;
      errorPanel.querySelector("h2").setAttribute("tabindex", "-1");
      errorPanel.querySelector("h2").focus();
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Изпрати заявката";
    }
  });
})();
