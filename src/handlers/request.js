import { normalize, validateAll } from "../../public/js/validation.js";
import { verifyTurnstile } from "../../lib/turnstile.js";
import { saveRequest, markEmailSent } from "../../lib/store.js";
import { sendNotification } from "../../lib/notify.js";

/* POST /api/request

   Orchestration only — validation, spam checks, storage and mail each live
   in their own module. The order matters: store before send, so a mail
   failure never loses the lead.

   Method checking lives in the router, not here. */

const MAX_BODY_BYTES = 32 * 1024;
const MIN_ELAPSED_MS = 3000;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });

/* A bot gets a normal-looking 200. Telling it why it failed just helps it
   pass next time. */
const silentAccept = () => json({ ok: true });

export async function handleFormRequest(request, env) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES) return json({ ok: false }, 413);

  let raw;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false }, 400);
  }

  if (typeof raw?.hp === "string" && raw.hp.trim() !== "") return silentAccept();
  if (typeof raw?.elapsedMs !== "number" || raw.elapsedMs < MIN_ELAPSED_MS) return silentAccept();

  const values = normalize(raw);
  const errors = validateAll(values);
  if (Object.keys(errors).length) return json({ ok: false, errors }, 400);

  const ip = request.headers.get("CF-Connecting-IP") || "";

  /* Skipped when no secret is configured, so `wrangler dev` works without
     credentials. The production guard below stops that shortcut ever
     shipping. */
  if (env.TURNSTILE_SECRET) {
    const passed = await verifyTurnstile(raw?.turnstileToken, env.TURNSTILE_SECRET, ip);
    if (!passed) {
      return json(
        { ok: false, errors: { turnstile: "Проверката не беше преминета. Опитайте отново или ни се обадете." } },
        400
      );
    }
  } else if (env.ENVIRONMENT === "production") {
    console.error({ event: "turnstile_secret_missing" });
    return json({ ok: false }, 500);
  }

  const record = {
    ...values,
    ip,
    userAgent: (request.headers.get("user-agent") || "").slice(0, 300),
    submittedAt: new Date().toISOString()
  };

  let id = null;
  try {
    id = await saveRequest(env.DB, record);
  } catch (err) {
    console.error({ event: "d1_write_failed", message: String(err) });
  }

  let sent = false;
  try {
    await sendNotification(env, record, id);
    sent = true;
  } catch (err) {
    console.error({ event: "email_send_failed", id, message: String(err) });
  }

  if (id && sent) {
    /* best effort: the notification already went out, so a failure here is
       cosmetic and must not turn a success into an error */
    try {
      await markEmailSent(env.DB, id);
    } catch (err) {
      console.error({ event: "d1_flag_failed", id, message: String(err) });
    }
  }

  /* The notification is the only thing that reaches a human. A stored row
     nobody looks at is a lost client, so an unsent notification is reported
     as a failure and the panel points them at the phone. The row still
     stays — it is evidence the request happened, and a duplicate from a
     retry costs far less than a missed job. */
  if (!sent) {
    console.error({ event: "request_not_notified", id, stored: Boolean(id) });
    return json({ ok: false }, 502);
  }

  console.log({ event: "request_received", id, service: record.service, stored: Boolean(id), sent });
  return json({ ok: true });
}
