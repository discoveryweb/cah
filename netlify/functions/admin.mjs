import { createAdminApi } from "../../server/admin-api.mjs";
import { createOrderHandler } from "../../server/order-api.mjs";
import { createBlobsStorage } from "../../server/storage-blobs.mjs";
import { createWebHandler, normaliseFunctionPath } from "../../server/web-adapter.mjs";

// One instance per warm container, shared by every route so the admin API and
// the public order endpoint see the same storage object.
let handlerPromise = null;

function getHandler() {
  if (!handlerPromise) {
    const storage = createBlobsStorage();
    const env = process.env;
    const api = createAdminApi({ storage, env });
    const orderHandler = createOrderHandler({ storage, env });
    handlerPromise = Promise.resolve(
      createWebHandler(api, { orderHandler })
    );
  }
  return handlerPromise;
}

/**
 * Serves `/api/*` and `/media/*` (see `netlify.toml`). Credentials and SMS
 * settings come from the site's server-side environment variables and never
 * reach the browser bundle.
 */
export default async function adminFunction(request, context) {
  try {
    const url = new URL(request.url);
    url.pathname = normaliseFunctionPath(url.pathname);
    const normalised = new Request(url, request);
    const handler = await getHandler();
    return await handler(normalised, context);
  } catch (error) {
    console.error("[admin-function]", error?.name ?? error?.code ?? "unknown");
    const storageIssue = /blobs|storage/i.test(String(error?.name ?? ""));
    return new Response(
      JSON.stringify({
        ok: false,
        code: storageIssue ? "storage_unavailable" : "server_error",
        message: storageIssue
          ? "دسترسی به فضای ذخیره‌سازی پنل ممکن نشد. تنظیمات Netlify Blobs را بررسی کنید."
          : "خطای غیرمنتظره در سرور.",
      }),
      {
        status: storageIssue ? 503 : 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      }
    );
  }
}
