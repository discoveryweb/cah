import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { createOrderHandler } from "./server/order-api.mjs";
import { createAdminMiddleware } from "./server/admin-api.mjs";
import { loadServerEnv } from "./server/env.mjs";
import { createFsStorage } from "./server/storage-fs.mjs";

loadServerEnv();
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const storage = createFsStorage({ dataDirectory: path.join(projectRoot, "data") });
const orderHandler = createOrderHandler({ root: projectRoot, storage });
const adminMiddleware = createAdminMiddleware({ root: projectRoot, storage });

const apiMiddleware = (
  request: Parameters<typeof orderHandler>[0],
  response: Parameters<typeof orderHandler>[1],
  next: (error?: Error) => void
) => {
  const pathname = request.url?.split("?")[0] ?? "";
  if (pathname.startsWith("/api/admin") || pathname === "/api/content" || pathname.startsWith("/media/")) {
    void adminMiddleware(request, response).then((handled: boolean) => {
      if (!handled) next();
    });
    return;
  }
  if (pathname === "/api/collaboration") {
    void orderHandler(request, response);
    return;
  }
  if (pathname.startsWith("/api/")) {
    response.statusCode = 404;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.end(JSON.stringify({ ok: false, code: "not_found" }));
    return;
  }
  next();
};

/**
 * The admin panel lives at /shenataisoni with hash tabs, so the dev and preview
 * servers must hand that path the single-page app shell.
 */
const adminPathFallback = (
  request: Parameters<typeof orderHandler>[0],
  _response: Parameters<typeof orderHandler>[1],
  next: (error?: Error) => void
) => {
  const url = request.url ?? "/";
  const pathname = url.split("?")[0].replace(/\/+$/, "");
  if (pathname.toLowerCase() === "/shenataisoni") {
    request.url = `/index.html${url.includes("?") ? url.slice(url.indexOf("?")) : ""}`;
  }
  next();
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const allowedHosts = [".e2b.app", "localhost", "127.0.0.1"];

export default defineConfig({
  plugins: [
    {
      name: "cahen-server-api",
      configureServer(server) {
        server.middlewares.use(adminPathFallback);
        server.middlewares.use(apiMiddleware);
      },
      configurePreviewServer(server) {
        server.middlewares.use(adminPathFallback);
        server.middlewares.use(apiMiddleware);
      },
    },
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts,
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts,
  },
  build: {
    // The Three.js vendor chunk is lazy-loaded only when the ParticleObject section enters view.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/three/")) return "three-vendor";
        },
      },
    },
  },
});
