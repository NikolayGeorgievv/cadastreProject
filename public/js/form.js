import { rules, normalize, SERVICE_LABELS } from "./validation.js";

/* The browser half of the form. Everything here is DOM adaptation: turning
   elements into the plain values validation.js expects, and turning the
   server's answer back into visible state. The rules themselves live in
   validation.js and are shared with the Worker. */

const ENDPOINT = "/api/request";
const WIDGET = "#turnstile-widget";

const form = document.getElementById("request-form");
if (form) {
  const successPanel = document.getElementById("form-success");
  const errorPanel = document.getElementById("form-error");
  const submitBtn = document.getElementById("submit-btn");

  /* preselect service from ?service=<slug>; unknown slugs fall back to
     "drugo" rather than leaving the select empty */
  const slug = new URLSearchParams(location.search).get("service");
  if (slug && form.elements.service) {
    form.elements.service.value = SERVICE_LABELS[slug] ? slug : "drugo";
  }

  /* element -> plain value, matching what normalize() produces server-side */
  function valueOf(el) {
    if (el.type === "checkbox") return el.checked;
    return typeof el.value === "string" ? el.value.trim() : "";
  }

  /* Turnstile has a message slot but no input of its own — el stays null and
     every path below guards for that. */
  const fields = {};
  for (const wrap of form.querySelectorAll("[data-field]")) {
    const key = wrap.getAttribute("data-field");
    fields[key] = {
      wrap,
      el: form.elements[key] || null,
      error: wrap.querySelector(".field__error"),
      touched: false
    };
  }

  function show(key, msg) {
    const f = fields[key];
    if (!f) return;
    const visible = Boolean(msg);
    f.wrap.setAttribute("data-invalid", visible ? "true" : "false");
    if (f.error) f.error.textContent = visible ? msg : "";
    if (!f.el) return;
    f.el.setAttribute("aria-invalid", visible ? "true" : "false");
    if (visible && f.error) f.el.setAttribute("aria-describedby", f.error.id);
    else f.el.removeAttribute("aria-describedby");
  }

  function validate(key, force) {
    const f = fields[key];
    if (!f || !f.el || !rules[key]) return true;
    const msg = rules[key](valueOf(f.el));
    show(key, (f.touched || force) && msg ? msg : "");
    return !msg;
  }

  for (const key of Object.keys(fields)) {
    const f = fields[key];
    if (!f.el) continue;
    const blurEvent = f.el.type === "checkbox" || f.el.tagName === "SELECT" ? "change" : "blur";
    f.el.addEventListener(blurEvent, () => {
      f.touched = true;
      validate(key);
    });
    f.el.addEventListener("input", () => {
      if (f.touched) validate(key);
    });
  }

  /* Tokens are single-use and expire after five minutes. Because this form
     submits over fetch rather than navigating away, a rejected submission
     leaves a spent token in the widget — the next attempt would fail for a
     reason unrelated to what the person typed. So: reset after every
     failure, never after success. */
  function turnstileToken() {
    const el = form.elements["cf-turnstile-response"];
    return el ? el.value : "";
  }

  function resetTurnstile() {
    if (!window.turnstile) return;
    try {
      window.turnstile.reset(WIDGET);
    } catch {
      /* widget not rendered (script blocked, or hostname not allowed while
         developing) — nothing to reset, and the server decides anyway */
    }
  }

  /* honeypot: real people never see this field, so anything in it is a bot.
     openedAt catches the other common pattern — a submit within a second or
     two of load, which no human types fast enough to produce. Both are only
     signals; the server decides. */
  const openedAt = Date.now();

  function focusPanel(panel) {
    const h = panel.querySelector("h2");
    h.setAttribute("tabindex", "-1");
    h.focus();
  }

  async function submitRequest(payload) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    /* 400 carries per-field messages; anything else is a failure we cannot
       explain to the person, so it gets the generic panel */
    if (res.status === 400) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, errors: body.errors || {} };
    }
    if (!res.ok) return { ok: false };
    return res.json().catch(() => ({ ok: true }));
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorPanel.hidden = true;
    show("turnstile", "");

    let firstBad = null;
    for (const key of Object.keys(fields)) {
      fields[key].touched = true;
      if (!validate(key, true) && !firstBad && fields[key].el) firstBad = fields[key].el;
    }
    if (firstBad) {
      firstBad.focus();
      return;
    }

    const payload = {
      ...normalize({
        name: fields.name.el.value,
        phone: fields.phone.el.value,
        email: fields.email.el.value,
        service: fields.service.el.value,
        location: fields.location.el.value,
        identifier: fields.identifier.el.value,
        message: fields.message.el.value,
        consent: fields.consent.el.checked
      }),
      submittedAt: new Date().toISOString(),
      turnstileToken: turnstileToken(),
      /* server-side spam signals — never trust these in the browser */
      hp: form.elements.website ? form.elements.website.value : "",
      elapsedMs: Date.now() - openedAt
    };

    submitBtn.disabled = true;
    submitBtn.textContent = "Изпращане…";

    try {
      const res = await submitRequest(payload);

      if (!res.ok) {
        resetTurnstile();

        /* the server rejected specific fields — surface them in place rather
           than showing a panel that says nothing useful */
        if (res.errors && Object.keys(res.errors).length) {
          let first = null;
          for (const [key, msg] of Object.entries(res.errors)) {
            show(key, msg);
            if (!first && fields[key] && fields[key].el) first = fields[key].el;
          }
          if (first) first.focus();
          else focusPanel(errorPanel);
          return;
        }
        throw new Error("rejected");
      }

      form.hidden = true;
      successPanel.hidden = false;
      focusPanel(successPanel);
    } catch {
      resetTurnstile();
      errorPanel.hidden = false;
      focusPanel(errorPanel);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Изпрати заявката";
    }
  });
}