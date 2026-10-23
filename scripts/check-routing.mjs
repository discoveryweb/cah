#!/usr/bin/env node
/**
 * Netlify routing gate.
 *
 * A redirect rule is only harmless if it respects two facts:
 *
 *   1. with `force = true` a rule wins even when a real file exists at the
 *      requested path — so a catch-all "404" rule with `force` serves the 404
 *      *document* for every real asset (text/html where a stylesheet was asked
 *      for, which is exactly how this site went black);
 *   2. without `force`, a real file shadows the rule, which is what makes a
 *      catch-all rule safe.
 *
 * This script parses netlify.toml, applies those semantics to the actual
 * `dist/` tree, and fails if any built asset would not be served as itself.
 *
 * `npm run routing:check`.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DIST = path.join(ROOT, "dist");

const results = [];
const check = (label, ok, detail = "") => {
  results.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || !detail ? "" : ` — ${detail}`}`);
};

/* ------------------------------------------------------------ toml parsing */

const toml = fs.readFileSync(path.join(ROOT, "netlify.toml"), "utf8");

const redirects = [...toml.matchAll(/\[\[redirects\]\]([\s\S]*?)(?=\n\[\[|\n#|\s*$)/g)].map((match) => {
  const body = match[1];
  const get = (key) => {
    // Netlify accepts both `to = "/x"` and `status = 404`.
    const quoted = new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, "m").exec(body);
    if (quoted) return quoted[1];
    const bare = new RegExp(`^\\s*${key}\\s*=\\s*([^\\s#]+)`, "m").exec(body);
    return bare ? bare[1] : undefined;
  };
  return {
    from: get("from"),
    to: get("to"),
    status: Number(get("status") ?? 301),
    force: /^\s*force\s*=\s*true/m.test(body),
  };
});

const publish = (/^\s*publish\s*=\s*"([^"]+)"/m.exec(toml) || [])[1];

/* ------------------------------------------------------- netlify semantics */

const exists = (urlPath) => {
  const clean = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  const file = path.join(DIST, clean.replace(/^\//, ""));
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return true;
  // Netlify also serves the pretty-URL form of an html file.
  return fs.existsSync(`${file}.html`) || fs.existsSync(path.join(file, "index.html"));
};

const matches = (pattern, urlPath) => {
  if (pattern === urlPath) return [];
  if (!pattern.includes("*") && !pattern.includes(":")) return null;
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/:splat/g, "(.*)")
    .replace(/\*/g, "(.*)");
  const found = new RegExp(`^${escaped}$`).exec(urlPath);
  return found ? found.slice(1) : null;
};

/** Returns what Netlify would answer for `urlPath`. */
function resolve(urlPath) {
  if (exists(urlPath)) {
    // A real file always wins unless a forced rule claims the path first.
    for (const rule of redirects) {
      if (!rule.force) continue;
      const splat = matches(rule.from, urlPath);
      if (splat !== null) return { kind: "redirect", ...rule, splat };
    }
    return { kind: "static", path: urlPath };
  }
  for (const rule of redirects) {
    const splat = matches(rule.from, urlPath);
    if (splat !== null) return { kind: "redirect", ...rule, splat };
  }
  return { kind: "static", path: urlPath };
}

/* ----------------------------------------------------------- the assertions */

check("the publish directory is dist", publish === "dist", String(publish));

const assetRules = redirects.filter(
  (rule) => rule.force && (rule.from?.startsWith("/assets") || rule.from?.startsWith("/fonts")),
);
check(
  "no forced rule may swallow /assets or /fonts",
  assetRules.length === 0,
  assetRules.map((rule) => `${rule.from} → ${rule.to} (status ${rule.status})`).join(", "),
);

const html = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
const referenced = Array.from(new Set([...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1])));

const broken = referenced
  .map((ref) => ({ ref, resolved: resolve(ref.split("?")[0]) }))
  .filter(({ resolved }) => resolved.kind !== "static");

check(
  `every asset the HTML references is served as itself (${referenced.length} checked)`,
  broken.length === 0,
  broken.map(({ ref, resolved }) => `${ref} → ${resolved.to ?? resolved.kind} ${resolved.status ?? ""}`).join(", "),
);

// Every file in the build, not just the ones the shell happens to mention.
const allFiles = [];
const walk = (dir, prefix = "") => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, `${prefix}/${entry.name}`);
    else allFiles.push(`${prefix}/${entry.name}`);
  }
};
walk(DIST);
const swallowed = allFiles
  .map((file) => ({ file, resolved: resolve(file) }))
  .filter(({ resolved }) => resolved.kind !== "static");
check(
  `every file in dist is reachable (${allFiles.length} files)`,
  swallowed.length === 0,
  swallowed.slice(0, 6).map(({ file, resolved }) => `${file} → ${resolved.to} ${resolved.status}`).join(", "),
);

/* ------------------------------------------------------- the routes that matter */

const css = resolve("/assets/index-BukR6GMC.css");
check("CSS is served as CSS, not as a document", css.kind === "static", `${css.kind} ${css.to ?? ""}`);

for (const font of ["/fonts/estedad-arabic.woff2", "/fonts/estedad-latin.woff2"]) {
  const resolved = resolve(font);
  check(`${font} is served`, resolved.kind === "static", `${resolved.kind} ${resolved.to ?? ""}`);
}

const controlRoom = resolve("/shenataisoni");
check(
  "the control room still routes to the app shell",
  controlRoom.kind === "redirect" && controlRoom.to === "/index.html" && controlRoom.status === 200,
  JSON.stringify(controlRoom),
);

const api = resolve("/api/content");
check(
  "the API still routes to its function",
  api.kind === "redirect" && /functions\/admin\/api/.test(api.to || ""),
  JSON.stringify(api),
);

const media = resolve("/media/some-file.webp");
check(
  "uploaded media still routes to its function",
  media.kind === "redirect" && /functions\/admin\/media/.test(media.to || ""),
  JSON.stringify(media),
);

const missing = resolve("/assets/does-not-exist-abc123.js");
check(
  "a genuinely missing asset is a 404, not the site shell",
  missing.kind === "redirect" && missing.status === 404 && missing.to === "/404.html",
  JSON.stringify(missing),
);

const unknownPage = resolve("/some/unknown/page");
check(
  "an unknown page is still the SPA shell",
  unknownPage.kind === "redirect" && unknownPage.to === "/index.html" && unknownPage.status === 200,
  JSON.stringify(unknownPage),
);

/* -------------------------------------------------------------------- done */

const failed = results.filter((item) => !item.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} routing checks passed` +
    (failed.length ? `\n\nFailed: ${failed.map((item) => item.label).join("; ")}` : ""),
);
process.exit(failed.length ? 1 : 0);
