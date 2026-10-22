import { createAdminApi } from "../../server/admin-api.mjs";
import { createBlobsStorage } from "../../server/storage-blobs.mjs";
import { createWebHandler, normaliseFunctionPath } from "../../server/web-adapter.mjs";

let handlerPromise = null;

/**
 * One function serves both /api/* and /media/*; a redirect in netlify.toml
 * rewrites those routes here. Credentials are read from the site's server-side
 * environment variables (ADMIN_EMAIL, ADMIN_PASSWORD_HASH, ADMIN_SESSION_SECRET).
 */
function getHandler() {
  if (!handlerPromise) {
    const api = createAdminApi({
      storage: createBlobsStorage(),
      env: process.env,
    });
    handlerPromise = Promise.resolve(createWebHandler(api));
  }
  return handlerPromise;
}

export default async function adminFunction(request) {
  try {
    const url = new URL(request.url);
    url.pathname = normaliseFunctionPath(url.pathname);
    const normalised = new Request(url, request);
    const handler = await getHandler();
    return await handler(normalised);
  } catch (error) {
    console.error("[admin-function]", error);
    return new Response(
      JSON.stringify({
        ok: false,
        code: "storage_unavailable",
        message: "دسترسی به فضای ذخیره‌سازی پنل ممکن نشد. تنظیمات Netlify Blobs را بررسی کنید.",
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  }
}
