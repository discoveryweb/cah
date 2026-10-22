/**
 * Bridges the Node-style admin handler to a WHATWG Request/Response pair so the
 * exact same API runs inside a Netlify Function.
 *
 * `normaliseFunctionPath` maps the rewritten function URL back to the path the
 * handler expects (`/api/...` or `/media/...`).
 */
export function normaliseFunctionPath(pathname) {
  const match = String(pathname).match(/\/(api|media)\//);
  return match && match.index > 0 ? String(pathname).slice(match.index) : String(pathname);
}

const toHeaderObject = (headers) => {
  const result = {};
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value;
  });
  return result;
};

export function createWebHandler(api) {
  return async function handleWebRequest(request) {
    const url = new URL(request.url);
    const headers = toHeaderObject(request.headers);
    // WHATWG Requests do not carry a Host header; same-origin checks need it.
    if (!headers.host) headers.host = url.host;
    const body =
      request.method === "GET" || request.method === "HEAD"
        ? Buffer.alloc(0)
        : Buffer.from(await request.arrayBuffer());

    const nodeRequest = {
      method: request.method,
      url: `${url.pathname}${url.search}`,
      headers,
      socket: {
        remoteAddress: headers["x-nf-client-connection-ip"] ?? headers["x-forwarded-for"] ?? "netlify",
        encrypted: url.protocol === "https:",
      },
      async *[Symbol.asyncIterator]() {
        if (body.length) yield body;
      },
    };

    let statusCode = 200;
    const responseHeaders = {};
    const chunks = [];

    const nodeResponse = {
      get statusCode() {
        return statusCode;
      },
      set statusCode(value) {
        statusCode = Number(value) || 200;
      },
      setHeader(key, value) {
        responseHeaders[String(key).toLowerCase()] = String(value);
      },
      getHeader(key) {
        return responseHeaders[String(key).toLowerCase()];
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

    await api.handle(nodeRequest, nodeResponse);

    const bodyBuffer = Buffer.concat(chunks);
    return new Response(bodyBuffer.length ? bodyBuffer : null, {
      status: statusCode,
      headers: responseHeaders,
    });
  };
}
