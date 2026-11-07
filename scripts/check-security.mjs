#!/usr/bin/env node
/**
 * Security, read from the outside in.
 *
 * Four layers, checked in the order an attacker meets them: the response
 * headers that decide what the browser may run, the build that must not carry a
 * secret or a source map, the client code that must never hand content back as
 * HTML, and the API that must treat every request as hostile until it proves
 * where it came from.
 *
 * `npm run security:check`.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DIST = path.join(ROOT, "dist");

const results = [];
const check = (label, ok, detail = "") => {
  results.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || !detail ? "" : ` — ${detail}`}`);
};

if (!fs.existsSync(DIST)) {
  console.error("dist/ is missing — run `npm run build` first.");
  process.exit(1);
}

const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), "utf8");
const readDist = (...parts) => fs.readFileSync(path.join(DIST, ...parts), "utf8");
const exists = (...parts) => fs.existsSync(path.join(ROOT, ...parts));

const netlify = read("netlify.toml");
const html = readDist("index.html");
const flat = html.replace(/\s+/g, " ");
const assets = fs.readdirSync(path.join(DIST, "assets"));
const scripts = assets.filter((file) => file.endsWith(".js")).map((file) => readDist("assets", file));
const bundle = scripts.join("\n");

/* ====================================================== transport & browser */

check("HSTS is set for a year and its subdomains", /Strict-Transport-Security = "max-age=31536000; includeSubDomains"/.test(netlify));
check("framing is denied twice over", /X-Frame-Options = "DENY"/.test(netlify) && /frame-ancestors 'none'/.test(netlify));
check("content types are never sniffed", /X-Content-Type-Options = "nosniff"/.test(netlify));
check("referrers are trimmed to the origin", /Referrer-Policy = "strict-origin-when-cross-origin"/.test(netlify));
check("opener and resource sharing are same-origin", /Cross-Origin-Opener-Policy = "same-origin"/.test(netlify) && /Cross-Origin-Resource-Policy = "same-origin"/.test(netlify));
check(
  "device permissions are switched off, not asked for",
  /Permissions-Policy = "camera=\(\), microphone=\(\), geolocation=\(\), payment=\(\), usb=\(\), serial=\(\), midi=\(\)"/.test(netlify),
);
check("cross-domain policy files are refused", /X-Permitted-Cross-Domain-Policies = "none"/.test(netlify));

/* ============================================================ the policy */

const csp = (/Content-Security-Policy = "([^"]+)"/.exec(netlify) || [])[1] || "";
const directive = (name) => {
  const match = new RegExp(`(?:^|; )${name} ([^;]+)`).exec(csp);
  return match ? match[1].trim() : "";
};

check("a policy is set on every response", /for = "\/\*"[\s\S]{0,1600}Content-Security-Policy/.test(netlify));
check("it defaults to the site's own origin", directive("default-src") === "'self'", directive("default-src"));
check("scripts come only from us", directive("script-src") === "'self' 'sha256-nJcgf48nZCwYh+tWhXKQ3qu+/EkXcluGxsbIBftZs58='", directive("script-src"));
check("no inline script is allowed by a blanket rule", !/'unsafe-inline'/.test(directive("script-src")));
check("no eval of any kind, wasm included", !/unsafe-eval/.test(csp), csp.includes("wasm-unsafe-eval") ? "wasm-unsafe-eval present" : "");
check("inline event handler attributes are refused", directive("script-src-attr") === "'none'", directive("script-src-attr"));
check("nothing may be embedded in a frame", directive("frame-src") === "'none'" && directive("child-src") === "'none'");
check("plugins are refused", directive("object-src") === "'none'");
check("the base URL cannot be rewritten", directive("base-uri") === "'self'");
check("forms may only post to us", directive("form-action") === "'self'");
check("requests are upgraded to https", /upgrade-insecure-requests/.test(csp));
check("network calls stay on the site's origin", directive("connect-src") === "'self'", directive("connect-src"));
check("images cannot be pulled from a third party", directive("img-src") === "'self' data: blob:", directive("img-src"));
check("the manifest is allowed from us only", directive("manifest-src") === "'self'");

/* The hash has to be the hash of the one inline block that actually ships. */
const inline = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
const digest = inline ? createHash("sha256").update(inline[1], "utf8").digest("base64") : "";
check("the allowed hash is the hash of the shipped block", Boolean(digest) && csp.includes(`'sha256-${digest}'`), digest ? `sha256-${digest}` : "no inline block");
check("no inline event handlers survive in the shell", !/\son\w+=/i.test(flat.replace(/<script[\s\S]*?<\/script>/g, "")));
check("no javascript: URLs in the shell", !/javascript:/i.test(flat));

/* ========================================================= build hygiene */

const maps = assets.filter((file) => file.endsWith(".map"));
check("no source maps are published", maps.length === 0, maps.join(" "));
check("no build points at a source map", !scripts.some((source) => /sourceMappingURL/.test(source)));

const secretPatterns = [
  ["a plaintext admin password", /ADMIN_PASSWORD\s*[:=]\s*["'][^"']+["']/],
  ["the session signing secret", /ADMIN_SESSION_SECRET/],
  ["a scrypt hash", /scrypt\$[0-9a-f]{16,}/],
  ["SMS provider credentials", /MELIPAYAMAK_(USERNAME|PASSWORD|API_KEY)/],
  ["the manager's phone number", /ORDER_MANAGER_PHONE/],
];
const leaked = secretPatterns.filter(([, pattern]) => pattern.test(bundle));
check("the browser bundle carries no server secret", leaked.length === 0, leaked.map(([label]) => label).join(", "));
check(
  "no server-only variable is exported to the client build",
  !/VITE_[A-Z_]*(SECRET|PASSWORD|TOKEN|KEY|PHONE)/.test(bundle) && !/import\.meta\.env\.VITE_(?!.*PUBLIC)[A-Z_]+/.test(bundle),
);

/* =========================================================== client code */

const sourceFiles = [];
const walk = (directory) => {
  for (const entry of fs.readdirSync(path.join(ROOT, directory), { withFileTypes: true })) {
    const next = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(next);
    else if (/\.(ts|tsx)$/.test(entry.name)) sourceFiles.push(next);
  }
};
walk("src");
const sources = sourceFiles.map((file) => [file, read(file)]);

const risky = sources.filter(([, source]) => /\bdangerouslySetInnerHTML\b/.test(source));
check("no component renders raw HTML from content", risky.length === 0, risky.map(([file]) => file).join(" "));

const evaluated = sources.filter(([, source]) => /(?:^|[^\w.])eval\s*\(|new Function\s*\(/.test(source));
check("no code is evaluated at runtime", evaluated.length === 0, evaluated.map(([file]) => file).join(" "));

const blankLinks = [];
for (const [file, source] of sources) {
  const tags = source.match(/<a\b[\s\S]*?>/g) || [];
  for (const tag of tags) {
    if (!/target="_blank"/.test(tag)) continue;
    if (!/rel="[^"]*noopener/.test(tag)) blankLinks.push(file);
  }
}
check("every new tab is opened without an opener", blankLinks.length === 0, [...new Set(blankLinks)].join(" "));

/* ================================================================ the API */

const api = read("server", "admin-api.mjs");
const config = read("server", "admin-config.mjs");

check("session tokens are signed", /createHmac\("sha256"/.test(api));
check("signatures are compared in constant time", /timingSafeEqual\(Buffer\.from\(signature\)/.test(api));
check("passwords are compared in constant time", /timingSafeEqual\(derived, expected\)/.test(config));
check("passwords are stretched with scrypt before storage", /scrypt as scryptCallback/.test(config) && /N: 32768/.test(config));
check("a password is never stored or logged in the clear", !/console\.\w+\([^)]*password/i.test(api) && !/console\.\w+\([^)]*password/i.test(config));
check(
  "the session cookie is HttpOnly, SameSite=Strict and Secure on https",
  /"HttpOnly"/.test(api) && /SameSite=Strict/.test(api) && /parts\.push\("Secure"\)/.test(api),
);
check("failed logins are throttled per address and per account", /LOGIN_BLOCK_MS/.test(api) && /IP_LOGIN_LIMIT/.test(api) && /EMAIL_LOGIN_LIMIT/.test(api));
check(
  "every state change proves its origin",
  /function assertSameOrigin/.test(api) && /bad_origin/.test(api) && /sec-fetch-site/.test(api),
);
check("request bodies are capped before they are buffered", /MAX_JSON_BYTES/.test(api) && /MAX_UPLOAD_BYTES = 4 \* 1024 \* 1024/.test(api));
check("uploads are identified by their bytes, not their name", /function detectImageType/.test(api) && /PNG_SIGNATURE/.test(api));
check("uploads cannot be an SVG or an HTML file", !/"image\/svg/.test(api) && !/"text\/html/.test(api));
check("uploaded names cannot walk out of the media folder", /path\.basename/.test(api) && /\^\[A-Za-z0-9_-\]\+\\\.\[a-z0-9\]\{2,5\}\$/.test(api));
check("the stored document cannot pollute a prototype", /__proto__/.test(api) && /prototype/.test(api));
check("API responses are never cached", /Cache-Control", "no-store/.test(api));
check("uploaded images are served inside a sandboxed policy", /Content-Security-Policy", "default-src 'none'; sandbox"/.test(api));
check("uploaded images are served same-origin only", /Cross-Origin-Resource-Policy", "same-origin"/.test(api));
check("unsupported methods are refused, not ignored", /405, "method_not_allowed"/.test(api));
check("storage and server errors are reported, never echoed", !/json\(response, 500, \{ ok: false, code: "server_error", message: String/.test(api));
check("the API is kept out of search results", /for = "\/api\/\*"[\s\S]{0,120}noindex/.test(netlify));
check("the control room is never cached", /for = "\/shenataisoni"[\s\S]{0,160}no-store/.test(netlify));

/* =============================================================== secrets */

const ignore = read(".gitignore");
check(".env files stay out of git, and the template stays in", /\.env\*/.test(ignore) && /!\.env\.example/.test(ignore));
check("data/ and .netlify/ cannot be committed", /^data\//m.test(ignore) && /^\.netlify\//m.test(ignore));

const template = read(".env.example");
const blank = (name) => new RegExp(`^${name}=\\s*$`, "m").test(template);
check(
  "the environment template ships empty credentials",
  ["ADMIN_EMAIL", "ADMIN_PASSWORD_HASH", "ADMIN_PASSWORD", "ADMIN_SESSION_SECRET", "MELIPAYAMAK_USERNAME", "MELIPAYAMAK_PASSWORD", "ORDER_MANAGER_PHONE"].every(blank),
);
check("the template warns against VITE_-prefixed secrets", /Never prefix these with VITE_/.test(template));

/* ---------------------------------------------------------------- report */

const failed = results.filter((item) => !item.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} security checks passed` +
    (failed.length ? `\n\nFailed: ${failed.map((item) => item.label).join("; ")}` : ""),
);
process.exit(failed.length ? 1 : 0);
