const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/* Exchanges the single-use token the widget produced for a yes/no from
   Cloudflare. Tokens expire after a few minutes and cannot be reused, so a
   replayed submission fails here even though the payload looks identical.

   Any failure — network, malformed response, bad token — is a "no". This is
   a spam gate, not an auth check: refusing a real person occasionally costs
   a phone call, letting bots through costs the inbox. */
export async function verifyTurnstile(token, secret, ip) {
  if (typeof token !== "string" || !token) return false;

  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);

  try {
    const res = await fetch(SITEVERIFY, { method: "POST", body });
    if (!res.ok) {
      console.error({ event: "turnstile_http_error", status: res.status });
      return false;
    }
    const data = await res.json();
    if (!data.success) {
      console.warn({ event: "turnstile_rejected", codes: data["error-codes"] });
    }
    return data.success === true;
  } catch (err) {
    console.error({ event: "turnstile_unreachable", message: String(err) });
    return false;
  }
}
