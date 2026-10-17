import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createOrderHandler } from "./server/order-api.mjs";
import { loadServerEnv } from "./server/env.mjs";

loadServerEnv();

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.join(projectRoot, "dist");
const orderHandler = createOrderHandler();
const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".wasm", "application/wasm"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
]);

function applySecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

function sendError(response, status, message) {
  response.statusCode = status;
  response.setHeader("Content-Type", "text/plain; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(message);
}

function resolvePublicFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const requested = path.resolve(distDirectory, `.${decoded}`);
  if (requested !== distDirectory && !requested.startsWith(`${distDirectory}${path.sep}`)) return null;
  if (!existsSync(requested)) return path.join(distDirectory, "index.html");
  try {
    const stats = statSync(requested);
    return stats.isDirectory() ? path.join(requested, "index.html") : requested;
  } catch {
    return path.join(distDirectory, "index.html");
  }
}

const server = createServer(async (request, response) => {
  applySecurityHeaders(response);
  const requestUrl = new URL(request.url ?? "/", "http://localhost");
  if (requestUrl.pathname === "/api/collaboration") {
    await orderHandler(request, response);
    return;
  }
  if (requestUrl.pathname.startsWith("/api/")) {
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.statusCode = 404;
    response.end(JSON.stringify({ ok: false, code: "not_found" }));
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    sendError(response, 405, "Method not allowed");
    return;
  }
  if (!existsSync(distDirectory)) {
    sendError(response, 503, "Build the site first with npm run build.");
    return;
  }

  const filePath = resolvePublicFile(requestUrl.pathname);
  if (!filePath || !existsSync(filePath)) {
    sendError(response, 404, "Not found");
    return;
  }
  let stats;
  try {
    stats = statSync(filePath);
    if (!stats.isFile()) throw new Error("Not a file");
  } catch {
    sendError(response, 404, "Not found");
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const isHashedAsset = /-[A-Za-z0-9_-]{8,}\.[^.]+$/.test(path.basename(filePath));
  response.statusCode = 200;
  response.setHeader("Content-Type", contentTypes.get(extension) ?? "application/octet-stream");
  response.setHeader("Content-Length", stats.size);
  response.setHeader("Cache-Control", isHashedAsset ? "public, max-age=31536000, immutable" : "no-cache");
  if (request.method === "HEAD") {
    response.end();
    return;
  }

  const stream = createReadStream(filePath);
  stream.on("error", () => {
    if (!response.headersSent) sendError(response, 500, "Unable to read file");
    else response.destroy();
  });
  stream.pipe(response);
});

const port = Number.parseInt(process.env.PORT ?? "4173", 10);
server.listen(Number.isFinite(port) ? port : 4173, "0.0.0.0", () => {
  console.log(`CAHEN site listening on 0.0.0.0:${Number.isFinite(port) ? port : 4173}`);
});
