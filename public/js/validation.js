/* Shared validation.
   Imported by the browser (js/form.js) and by the Pages Function
   (functions/api/request.js), so it is the single source of truth for what
   counts as a valid request.

   Hard rule: no DOM, no Worker globals, no fetch. Plain values in, message
   out. The browser adapts elements to values; the server adapts JSON to
   values. If something here starts needing `document` or `env`, it belongs
   in the caller, not in this file. */

/* The select on request.html is built from this. Keeping the slugs here
   rather than only in the markup means the server can reject anything that
   is not a real service, and the notification email can print the label
   instead of the slug. */
export const SERVICE_GROUPS = Object.freeze([
  {
    label: "Кадастър",
    services: [
      ["nanasyane-sgrada", "Нанасяне на сграда"],
      ["nanasyane-sgrada-sos", "Нанасяне на сграда или самостоятелен обект (СОС)"],
      ["delba", "Делба"],
      ["obedinyavane", "Обединяване"],
      ["izmenenie-na-imota", "Изменение на имота"]
    ]
  },
  {
    label: "Геодезически измервания",
    services: [
      ["zasnemane", "Заснемане на граници, сгради и съоръжения"],
      ["trasirane", "Трасиране на граници и сгради"],
      ["tahimetrichna-snimka", "Тахиметрична снимка"],
      ["tyrpimost-sgrada", "Търпимост на сграда"],
      ["fotogrametria", "Фотограметрия"]
    ]
  },
  {
    label: "Инвестиционно проектиране",
    services: [
      ["pup", "Подробен устройствен план (ПУП)"],
      ["vertikalno-planirane", "Вертикално планиране"]
    ]
  },
  {
    label: "Експертизи и процедури",
    services: [
      ["kombinirana-skica", "Комбинирана скица"],
      ["tehnicheska-ekspertiza", "Техническа експертиза"],
      ["obstoyatelstveni-proverki", "Обстоятелствени проверки"]
    ]
  },
  {
    label: null,
    services: [["drugo", "Друго"]]
  }
]);

export const SERVICE_LABELS = Object.freeze(
  Object.fromEntries(SERVICE_GROUPS.flatMap((g) => g.services))
);

export const FIELDS = Object.freeze([
  "name", "phone", "email", "service", "location", "identifier", "message", "consent"
]);

/* Upper bounds exist for the server's benefit. A browser will never hit
   them; a script posting straight at /api/request will. */
export const LIMITS = Object.freeze({
  name: 120,
  phone: 40,
  email: 254,
  location: 200,
  identifier: 60,
  message: 4000
});

const str = (v) => (typeof v === "string" ? v.trim() : "");

/* Each rule takes the already-normalised value and returns "" when the value
   is acceptable, or the message to show the person. Messages say what to
   fix, not what went wrong. */
export const rules = Object.freeze({
  name(v) {
    if (v.length < 2) return "Напишете името си, за да знаем как да се обърнем към Вас.";
    if (v.length > LIMITS.name) return `Името е твърде дълго - максимум ${LIMITS.name} знака.`;
    return "";
  },

  phone(v) {
    if (v.length > LIMITS.phone) return `Телефонът е твърде дълъг - максимум ${LIMITS.phone} знака.`;
    const digits = v.replace(/[^\d]/g, "");
    if (digits.length < 8) return "Добавете телефон с код - например 0888 123 456.";
    if (digits.length > 15) return "Проверете телефона - изглежда има повече цифри от нужното.";
    return "";
  },

  email(v) {
    if (!v) return "";
    if (v.length > LIMITS.email) return "Имейлът е твърде дълъг.";
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
      ? ""
      : "Проверете имейла - трябва да съдържа @ и домейн, например ime@mail.bg.";
  },

  service(v) {
    if (!v) return "Изберете услуга от списъка, или „Друго“, ако не сте сигурни.";
    /* unreachable from the select; reachable from anything else */
    if (!SERVICE_LABELS[v]) return "Изберете услуга от списъка.";
    return "";
  },

  location(v) {
    if (v.length < 2) return "Напишете населеното място или местността, където е имотът.";
    if (v.length > LIMITS.location) return `Твърде дълго - максимум ${LIMITS.location} знака.`;
    return "";
  },

  /* Optional. Bulgarian cadastral identifiers are digits and dots
     (10135.2560.123.1.5), so anything else is almost certainly a mistake —
     but this stays lenient on purpose: a wrong rejection here costs a lead,
     and the field is only a convenience. */
  identifier(v) {
    if (!v) return "";
    if (v.length > LIMITS.identifier) return `Идентификаторът е твърде дълъг - максимум ${LIMITS.identifier} знака.`;
    if (!/^[\d.\s-]+$/.test(v)) {
      return "Идентификаторът съдържа само цифри и точки - например 10135.2560.123.1.5.";
    }
    return "";
  },

  message(v) {
    if (v.length < 10) return "Опишете накратко какво ви е нужно - един-два реда стигат.";
    if (v.length > LIMITS.message) return `Съобщението е твърде дълго - максимум ${LIMITS.message} знака.`;
    return "";
  },

  consent(v) {
    return v === true ? "" : "Отбележете съгласието, за да можем да обработим заявката.";
  }
});

/* One normaliser for both sides, so the value the browser validated is
   byte-for-byte the value the server validates. */
export function normalize(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    name: str(src.name),
    phone: str(src.phone),
    email: str(src.email),
    service: str(src.service),
    location: str(src.location),
    identifier: str(src.identifier),
    message: str(src.message),
    consent: src.consent === true || src.consent === "true" || src.consent === "on"
  };
}

/* Returns { field: message } containing only the fields that failed.
   Empty object means valid. */
export function validateAll(values) {
  const errors = {};
  for (const field of FIELDS) {
    const msg = rules[field](values[field]);
    if (msg) errors[field] = msg;
  }
  return errors;
}
