import { handleFormRequest } from "./handlers/request.js";
import { runRetentionSweep } from "./handlers/retention.js";

/* Worker entry point.

   Static assets under public/ are served by the platform before this runs,
   so anything arriving here is a path that matched no file. In practice that
   means /api/request and typos.

   Pages gave us file-based routing; Workers does not, so the route table is
   explicit. Keep this file to routing only — handlers own their own logic. */

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/request") {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { allow: "POST" }
        });
      }
      return handleFormRequest(request, env);
    }

    return new Response("Not Found", { status: 404 });
  },

  /* Cron trigger — see [triggers] in wrangler.toml. */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runRetentionSweep(env));
  }
};