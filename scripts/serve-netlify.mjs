/**
 * Serve `dist/` exactly the way Netlify will.
 *
 * `vite preview` is a fine static server but it knows nothing about
 * `netlify.toml`: no redirects, no `[[headers]]`, and therefore no
 * Content-Security-Policy. That gap is precisely how a page can look perfect
 * locally and come up black in production — the routing, the MIME types and
 * the policy all have to be exercised together before a deploy counts as
 * tested.
 *
 * This reads the same rules the deploy reads and applies Netlify's semantics:
 *   • a real file is served as itself — unless a rule is `force = true`,
 *   • otherwise the first matching `[[redirects]]` rule answers,
 *   • a 404 rule serves the target file with its status and its mime type,
 *   • `[[headers]]` are layered over the response, last match winning.
 *
 * Usage: node scripts/serve-netlify.mjs [port]
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4180);
const toml = fs.readFileSync(path.join(ROOT, "netlify.toml"), "utf8");

/* ------------------------------------------------------------- toml parsing */

const unquote = (value) =>
  value === undefined ? undefined : value.replace(/^"(.*)"$/s, "$1");

function tables(kind) {
  const blocks = [...toml.matchAll(new RegExp(`\\[\\[${kind}\\]\\]([\\s\\S]*?)(?=\\n\\[\\[|\\n#[^\\n]*\\n|$)`, "g"))];
  return blocks.map((block) => {
    const body = block[1];
    const field = (key) => {
      const quoted = new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, "m").exec(body);
      if (quoted) return quoted[1];
      const bare = new RegExp(`^\\s*${key}\\s*=\\s*([^\\s#]+)`, "m").exec(body);
      return bare ? unquote(bare[1]) : undefined;
    };
    const values = {};
    const valuesBlock = /\[headers\.values\]([\s\S]*)$/.exec(body);
    if (valuesBlock) {
      for (const line of valuesBlock[1].split("\n")) {
        const entry = /^\s*([A-Za-z0-9-]+)\s*=\s*"(.*)"\s*$/.exec(line);
        if (entry) values[entry[1]] = entry[2];
      }
    }
    return {
      from: field("from"),
      to: field("to"),
      status: Number(field("status") ?? 301),
      force: /^\s*force\s*=\s*true/m.test(body),
      for: field("for"),
      values,
    };
  });
}

const redirects = tables("redirects").filter((rule) => rule.from);
const headerRules = tables("headers").filter((rule) => rule.for);

const MIME = {
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".woff2": "font/woff2",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".wasm": "application/wasm",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
};

/* --------------------------------------------------------------- resolution */

function fileFor(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]).replace(/^\/+/, "");
  const direct = path.join(DIST, clean);
  if (!direct.startsWith(DIST)) return null;
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  if (!clean) return null;
  const asHtml = path.join(DIST, `${clean}.html`);
  if (fs.existsSync(asHtml) && fs.statSync(asHtml).isFile()) return asHtml;
  return null;
}

function splatMatch(pattern, urlPath) {
  if (pattern === urlPath) return [];
  if (!pattern.includes("*") && !pattern.includes(":")) return null;
  const source = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/:splat|\*/g, "(.*)");
  const match = new RegExp(`^${source}$`).exec(urlPath);
  return match ? match.slice(1) : null;
}

function resolve(urlPath) {
  const file = fileFor(urlPath);
  if (file) {
    for (const rule of redirects) {
      if (!rule.force) continue;
      if (splatMatch(rule.from, urlPath) !== null) return { rule, file: null };
    }
    return { file };
  }
  for (const rule of redirects) {
    const splat = splatMatch(rule.from, urlPath);
    if (splat !== null) return { rule, splat };
  }
  return { file: null };
}

function headersFor(urlPath, extra = {}) {
  const merged = { ...extra };
  for (const rule of headerRules) {
    if (splatMatch(rule.for, urlPath) === null) continue;
    Object.assign(merged, rule.values);
  }
  return merged;
}

/* ------------------------------------------------------------------- server */

const server = http.createServer((request, response) => {
  const urlPath = request.url ?? "/";

  // Functions are not emulated here; keep the contract visible in the log.
  if (urlPath.startsWith("/api/") || urlPath.startsWith("/media/")) {
    response.writeHead(501, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "functions run on Netlify, not here" }));
    return;
  }

  let target = urlPath;
  let status = 200;
  let chosen = resolve(urlPath);

  if (chosen.rule) {
    status = chosen.rule.status;
    target = chosen.rule.to.replace(
      ":splat",
      (chosen.splat && chosen.splat[0]) || "",
    );
    chosen = { file: fileFor(target) };
  }

  const file = chosen.file;
  if (!file) {
    response.writeHead(404, headersFor(urlPath, { "content-type": "text/html; charset=utf-8" }));
    response.end("Not found");
    return;
  }

  const ext = path.extname(file).toLowerCase();
  const headers = headersFor(target, {
    "content-type": MIME[ext] ?? "application/octet-stream",
    "content-length": String(fs.statSync(file).size),
  });

  response.writeHead(status, headers);
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  fs.createReadStream(file).pipe(response);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`serving dist/ with netlify.toml semantics on http://0.0.0.0:${PORT}`);
  console.log(`  ${redirects.length} redirect rules, ${headerRules.length} header rules`);
});
