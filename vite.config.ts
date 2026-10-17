import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { createOrderHandler } from "./server/order-api.mjs";
import { loadServerEnv } from "./server/env.mjs";

loadServerEnv();
const orderHandler = createOrderHandler();
const orderApiMiddleware = (request: Parameters<typeof orderHandler>[0], response: Parameters<typeof orderHandler>[1], next: (error?: Error) => void) => {
  const pathname = request.url?.split("?")[0] ?? "";
  if (pathname === "/api/collaboration") {
    void orderHandler(request, response, next);
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const allowedHosts = [".e2b.app", "localhost", "127.0.0.1"];

export default defineConfig({
  plugins: [
    {
      name: "cahen-collaboration-api",
      configureServer(server) {
        server.middlewares.use(orderApiMiddleware);
      },
      configurePreviewServer(server) {
        server.middlewares.use(orderApiMiddleware);
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
