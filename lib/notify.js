import { SERVICE_LABELS } from "../public/js/validation.js";

/* Notification mail.

   Sent through the Email Routing send_email binding, which is free but only
   to the verified destination pinned in wrangler.toml. `to` is deliberately
   omitted so the binding uses that pinned address — even if this endpoint is
   abused, it cannot be turned into a mailer for arbitrary recipients.

   replyTo is set to the client's address when they gave one, so hitting
   reply in Gmail goes to the client rather than to noreply@. */

function renderBody(record, id) {
  const lines = [
    `Услуга:        ${SERVICE_LABELS[record.service] || record.service}`,
    `Име:           ${record.name}`,
    `Телефон:       ${record.phone}`,
    `Имейл:         ${record.email || "-"}`,
    `Местоположение: ${record.location}`,
    `Идентификатор: ${record.identifier || "-"}`,
    "",
    "Съобщение:",
    record.message,
    "",
    "---",
    `Получена: ${record.submittedAt}`,
    `Номер: ${id || "(незаписана в базата)"}`
  ];
  return lines.join("\n");
}

function renderSubject(record) {
  const label = SERVICE_LABELS[record.service] || record.service;
  return `Нова заявка: ${label} - ${record.name}`;
}

export async function sendNotification(env, record, id) {
  if (!env.EMAIL) throw new Error("EMAIL binding missing");

  await env.EMAIL.send({
    from: env.NOTIFY_FROM,
    to: env.NOTIFY_TO,
    subject: renderSubject(record),
    text: renderBody(record, id),
    ...(record.email ? { replyTo: record.email } : {})
  });
}
