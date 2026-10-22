/**
 * Bridges the Node-style admin/order handlers to a WHATWG Request/Response pair
 * so the exact same API runs inside a Netlify Function.
 *
 * `normaliseFunctionPath` maps the function URL back to the path the handlers
 * expect (`/api/...` or `/media/...`). Both the original path and the rewritten
 * `/.netlify/functions/admin/api/...` form are supported.
 */
export function normaliseFunctionPath(pathname) {
  const value = String(pathname ?? "");
  const match = value.match(/\/(api|media)\//);
  if (!match) return value;
  // Keep a leading path when the request already starts with /api/ or /media/.
  return match.index > 0 ? value.slice(match.index) : value;
}

const toHeaderObject = (headers) => {
  const result = {};
  headers.forEach((value, key) => {
    result[String(key).toLowerCase()] = value;
  });
  return result;
};

const jsonError = (nodeResponse, status, code, message) => {
  if (nodeResponse.getHeader("content-type")) return;
  nodeResponse.statusCode = status;
  nodeResponse.setHeader("Content-Type", "application/json; charset=utf-8");
  nodeResponse.setHeader("Cache-Control", "no-store");
  nodeResponse.setHeader("X-Content-Type-Options", "nosniff");
  nodeResponse.write(JSON.stringify({ ok: false, code, ...(message ? { message } : {}) }));
};

/**
 * @param api Admin API created by `createAdminApi`.
 * @param options.orderHandler Public form endpoint handler (optional).
 */
export function createWebHandler(api, { orderHandler = null } = {}) {
  return async function handleWebRequest(request, context) {
    const url = new URL(request.url);
    const headers = toHeaderObject(request.headers);
    // WHATWG Requests do not always carry a Host header; same-origin checks
    // and cookie scoping need it.
    if (!headers.host) headers.host = url.host;

    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    const body = hasBody ? Buffer.from(await request.arrayBuffer()) : Buffer.alloc(0);

    const nodeRequest = {
      method: request.method,
      url: `${url.pathname}${url.search}`,
      headers,
      socket: {
        remoteAddress:
          context?.ip ??
          headers["x-nf-client-connection-ip"] ??
          headers["x-forwarded-for"] ??
          "netlify",
        encrypted:
          url.protocol === "https:" ||
          String(headers["x-forwarded-proto"] ?? "").toLowerCase() === "https",
      },
      async *[Symbol.asyncIterator]() {
        if (body.length) yield body;
      },
    };

    let statusCode = 200;
    const responseHeaders = new Map();
    const chunks = [];

    const nodeResponse = {
      get statusCode() {
        return statusCode;
      },
      set statusCode(value) {
        statusCode = Number(value) || 200;
      },
      setHeader(key, value) {
        const name = String(key).toLowerCase();
        if (name === "set-cookie") {
          const existing = responseHeaders.get(name) ?? [];
          responseHeaders.set(name, existing.concat(String(value)));
          return;
        }
        responseHeaders.set(name, String(value));
      },
      getHeader(key) {
        return responseHeaders.get(String(key).toLowerCase());
      },
      removeHeader(key) {
        responseHeaders.delete(String(key).toLowerCase());
      },
      writeHead(value, extra = {}) {
        statusCode = Number(value) || statusCode;
        for (const [key, headerValue] of Object.entries(extra)) {
          this.setHeader(key, headerValue);
        }
      },
      write(chunk) {
        if (chunk === undefined || chunk === null) return;
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      },
      end(chunk) {
        if (chunk !== undefined && chunk !== null) this.write(chunk);
      },
    };

    try {
      const handled = await api.handle(nodeRequest, nodeResponse);

      if (handled === false) {
        const isOrderRoute =
          url.pathname === "/api/collaboration" || url.pathname.endsWith("/api/collaboration");
        if (orderHandler && isOrderRoute) {
          if (request.method !== "POST") {
            nodeResponse.setHeader("Allow", "POST");
            jsonError(nodeResponse, 405, "method_not_allowed", "این روش پشتیبانی نمی‌شود.");
          } else {
            await orderHandler(nodeRequest, nodeResponse, context);
          }
        } else {
          jsonError(nodeResponse, 404, "not_found", "این مسیر وجود ندارد.");
        }
      }
    } catch (error) {
      console.error("[function-handler]", error?.name ?? error?.code ?? "unknown");
      if (!chunks.length) {
        nodeResponse.removeHeader("content-type");
        jsonError(nodeResponse, 500, "server_error", "خطای غیرمنتظره در سرور.");
      }
    }

    const headersOut = new Headers();
    for (const [key, value] of responseHeaders) {
      if (Array.isArray(value)) {
        for (const item of value) headersOut.append(key, item);
      } else {
        headersOut.set(key, value);
      }
    }

    const bodyBuffer = Buffer.concat(chunks);
    return new Response(bodyBuffer.length ? bodyBuffer : null, {
      status: statusCode,
      headers: headersOut,
    });
  };
}
