/**
 * CAHEN video inbox — a tiny, dependency-free upload service.
 *
 * Why it exists: the chat composer only accepts a narrow set of attachments and
 * caps their size, so large video files never reach the agent. This service
 * exposes a resumable, chunked upload endpoint *inside the project* so the file
 * lands on disk next to the code (and survives environment restarts) and can be
 * inspected immediately.
 *
 * Design notes:
 *  - No buffering: request bodies are streamed straight into the target file at
 *    an explicit offset, so memory stays flat regardless of video size.
 *  - Resumable: the client asks for the current size and continues from there;
 *    a mismatched offset returns 409 with the authoritative byte count.
 *  - Files live in inbox/uploads, which git ignores but the workspace snapshot
 *    keeps — an upload is only lost if the folder is deleted.
 */
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

const PORT = Number(process.env.INBOX_PORT || 8787);
const HOST = process.env.INBOX_HOST || "0.0.0.0";
const BASE = path.dirname(new URL(import.meta.url).pathname);
const UPLOADS = process.env.INBOX_DIR || path.join(BASE, "uploads");
const FRAMES = path.join(UPLOADS, ".frames");
const PROXIES = path.join(UPLOADS, ".proxies");
const MAX_BYTES = Number(process.env.INBOX_MAX_BYTES || 200 * 1024 * 1024);
/** Originals can be large; past this size we also build a light copy of the video. */
const PROXY_MIN = Number(process.env.INBOX_PROXY_MIN || 24 * 1024 * 1024);
const BROWSER = path.join(BASE, "index.html");

const FFMPEG =
  process.env.FFMPEG_BIN ||
  (fs.existsSync("/tmp/ffmpegpkg/imageio_ffmpeg/binaries")
    ? (() => {
        const dir = "/tmp/ffmpegpkg/imageio_ffmpeg/binaries";
        const hit = fs
          .readdirSync(dir)
          .filter((n) => n.startsWith("ffmpeg-"))
          .sort()
          .pop();
        return hit ? path.join(dir, hit) : "";
      })()
    : "") ||
  "ffmpeg";

const ALLOWED = new Set([
  "mp4", "m4v", "mov", "webm", "mkv", "avi", "ogv", "mpg", "mpeg", "3gp", "ts",
  "png", "jpg", "jpeg", "webp", "gif", "avif", "heic",
  "mp3", "wav", "m4a", "aac", "ogg", "flac",
  "pdf", "zip", "txt", "md", "json",
]);

await fsp.mkdir(UPLOADS, { recursive: true });
await fsp.mkdir(FRAMES, { recursive: true });
await fsp.mkdir(PROXIES, { recursive: true });

/* ------------------------------------------------------------------ helpers */

const json = (res, status, body) => {
  const payload = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": payload.length,
    "cache-control": "no-store",
  });
  res.end(payload);
};

const fail = (res, status, error, extra = {}) =>
  json(res, status, { ok: false, error, ...extra });

const safeStem = (name) => {
  const base = path.basename(String(name || "file")).replace(/[\u0000-\u001f\u007f]/g, "");
  const cleaned = base.replace(/[^\p{L}\p{N}._ -]/gu, "_").replace(/\s+/g, " ").trim();
  return (cleaned || "file").slice(-120);
};

const extOf = (name) => {
  const m = /\.([A-Za-z0-9]{1,6})$/.exec(name || "");
  return m ? m[1].toLowerCase() : "";
};

const ID_RE = /^[a-f0-9]{12}$/;
const isValidId = (id) => ID_RE.test(id || "");

const metaPath = (id) => path.join(UPLOADS, `${id}.json`);
const binPath = (meta) => path.join(UPLOADS, `${meta.id}-${meta.file}`);
const framesDir = (id) => path.join(FRAMES, id);

async function readMeta(id) {
  try {
    return JSON.parse(await fsp.readFile(metaPath(id), "utf8"));
  } catch {
    return null;
  }
}

async function writeMeta(meta) {
  const tmp = `${metaPath(meta.id)}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(meta, null, 2));
  await fsp.rename(tmp, metaPath(meta.id));
}

/**
 * Background jobs (frames, proxy) finish at unpredictable times and must not
 * clobber each other's metadata, so every mutation goes through one queue.
 */
const metaLocks = new Map();
function withMeta(id, fn) {
  const prev = metaLocks.get(id) || Promise.resolve();
  const next = prev
    .then(async () => {
      const meta = await readMeta(id);
      if (!meta) return null;
      const result = await fn(meta);
      await writeMeta(meta);
      return result;
    })
    .catch(() => null);
  metaLocks.set(id, next);
  return next;
}

async function readJson(req, limit = 64 * 1024) {
  let size = 0;
  const parts = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("body_too_large"), { status: 413 });
    parts.push(chunk);
  }
  if (!parts.length) return {};
  try {
    return JSON.parse(Buffer.concat(parts).toString("utf8"));
  } catch {
    throw Object.assign(new Error("bad_json"), { status: 400 });
  }
}

function run(cmd, args, timeoutMs = 45_000) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let child;
    try {
      child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch {
      return resolve({ code: -1, stdout, stderr: "spawn_failed" });
    }
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: "spawn_failed" });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

/** Read duration/dimensions/codecs out of `ffmpeg -i`, which prints on stderr. */
async function probe(file) {
  const { stderr } = await run(FFMPEG, ["-hide_banner", "-nostdin", "-i", file], 30_000);
  if (!stderr || !/Duration/.test(stderr)) return null;
  const out = {};
  const dur = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(stderr);
  if (dur) out.duration = Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]);
  const video = /Stream #\d+:\d+.*?: Video: ([^,\n]+)(?:[^\n]*?), (\d{2,5})x(\d{2,5})/.exec(stderr);
  if (video) {
    out.codec = video[1].trim();
    out.width = Number(video[2]);
    out.height = Number(video[3]);
  }
  const audio = /Stream #\d+:\d+.*?: Audio: ([^,\n]+)/.exec(stderr);
  if (audio) out.audioCodec = audio[1].trim();
  return Object.keys(out).length ? out : null;
}

/** Grab up to six evenly spaced stills so the upload is viewable as frames. */
async function extractFrames(meta) {
  const dir = framesDir(meta.id);
  await fsp.mkdir(dir, { recursive: true });
  const duration = meta.probe?.duration;
  const step = duration && duration > 3 ? duration / 6 : 2;
  const { code } = await run(
    FFMPEG,
    [
      "-hide_banner", "-nostdin", "-loglevel", "error", "-i", binPath(meta),
      "-vf", `fps=1/${step.toFixed(3)},scale='min(960,iw)':-2`,
      "-frames:v", "6", "-q:v", "4", path.join(dir, "%02d.jpg"),
    ],
    120_000,
  );
  if (code !== 0 && !fs.existsSync(path.join(dir, "01.jpg"))) return [];
  return (await fsp.readdir(dir)).filter((n) => n.endsWith(".jpg")).sort();
}

/**
 * Transcode a small, review-friendly copy (720p, CRF 31) of a large video.
 * Only the light copy needs to survive a snapshot; the original can be dropped.
 */
const proxyQueue = [];
let proxyBusy = false;

async function makeProxy(meta) {
  const out = path.join(PROXIES, `${meta.id}.mp4`);
  const { code } = await run(
    FFMPEG,
    [
      "-hide_banner", "-nostdin", "-loglevel", "error", "-y", "-i", binPath(meta),
      "-vf", "scale='min(720,iw)':-2", "-c:v", "libx264", "-crf", "31",
      "-preset", "veryfast", "-c:a", "aac", "-b:a", "64k",
      "-movflags", "+faststart", out,
    ],
    900_000,
  );
  const stat = code === 0 ? await fsp.stat(out).catch(() => null) : null;
  if (!stat) return;
  await withMeta(meta.id, (live) => {
    live.proxy = { bytes: stat.size, name: `${meta.id}.mp4` };
  });
}

function queueProxy(meta) {
  if (meta.size < PROXY_MIN) return;
  proxyQueue.push(meta);
  if (proxyBusy) return;
  proxyBusy = true;
  (async () => {
    while (proxyQueue.length) {
      const next = proxyQueue.shift();
      try {
        await makeProxy(next);
      } catch {
        /* best effort */
      }
    }
    proxyBusy = false;
  })();
}

/* ------------------------------------------------------------------- routes */

async function handleNew(req, res) {
  const body = await readJson(req);
  const name = safeStem(body.name);
  const size = Number(body.size);
  const ext = extOf(name);

  if (!name) return fail(res, 400, "missing_name");
  if (!Number.isFinite(size) || size <= 0) return fail(res, 400, "missing_size");
  if (size > MAX_BYTES) return fail(res, 413, "too_large", { maxBytes: MAX_BYTES });
  if (!ALLOWED.has(ext)) return fail(res, 415, "unsupported_type", { ext });

  const id = crypto.randomBytes(6).toString("hex");
  const meta = {
    id,
    file: name,
    size,
    type: String(body.type || "").slice(0, 120),
    createdAt: new Date().toISOString(),
    received: 0,
    complete: false,
  };
  await fsp.writeFile(binPath(meta), Buffer.alloc(0));
  await writeMeta(meta);
  return json(res, 201, { ok: true, id, received: 0, chunkSize: 4 * 1024 * 1024, maxBytes: MAX_BYTES });
}

async function handleChunk(req, res, id, url) {
  const meta = await readMeta(id);
  if (!meta) return fail(res, 404, "unknown_upload");
  if (meta.complete) return json(res, 200, { ok: true, received: meta.received, complete: true });

  const raw = url.searchParams.get("offset") ?? req.headers["x-offset"];
  const offset = Number(raw);
  if (!Number.isInteger(offset) || offset < 0) return fail(res, 400, "bad_offset");

  const file = binPath(meta);
  const fh = await fsp.open(file, "r+");
  let pos;
  try {
    const stat = await fh.stat();
    if (offset !== stat.size) {
      return json(res, 409, { ok: false, error: "offset_mismatch", received: stat.size });
    }
    pos = stat.size;
    for await (const chunk of req) {
      if (pos + chunk.length > meta.size) {
        await fh.truncate(meta.size);
        meta.received = meta.size;
        await writeMeta(meta);
        return fail(res, 413, "over_size", { received: meta.size });
      }
      let written = 0;
      while (written < chunk.length) {
        const { bytesWritten } = await fh.write(chunk, written, chunk.length - written, pos + written);
        if (!bytesWritten) throw new Error("write_stalled");
        written += bytesWritten;
      }
      pos += chunk.length;
    }
    await fh.sync();
  } finally {
    await fh.close();
  }

  meta.received = pos;
  await writeMeta(meta);
  return json(res, 200, { ok: true, received: pos, size: meta.size });
}

async function handleDone(req, res, id) {
  const meta = await readMeta(id);
  if (!meta) return fail(res, 404, "unknown_upload");

  const stat = await fsp.stat(binPath(meta)).catch(() => null);
  if (!stat) return fail(res, 410, "file_missing");
  if (stat.size !== meta.size) {
    meta.received = stat.size;
    await writeMeta(meta);
    return fail(res, 409, "incomplete", { received: stat.size, expected: meta.size });
  }

  meta.received = stat.size;
  meta.complete = true;
  meta.completedAt = new Date().toISOString();
  meta.probe = await probe(binPath(meta)).catch(() => null);
  await writeMeta(meta);

  if (isVideo(meta)) {
    queueProxy(meta);
    extractFrames(meta)
      .then((frames) => withMeta(meta.id, (live) => { live.frames = frames; }))
      .catch(() => {});
  }
  return json(res, 200, { ok: true, id, ...publicMeta(meta) });
}

const isVideo = (meta) =>
  /^(video|audio)\//.test(meta.type) || ["mp4", "mov", "webm", "mkv", "m4v", "avi"].includes(extOf(meta.file));

const publicMeta = (meta) => ({
  id: meta.id,
  name: meta.file,
  size: meta.size,
  type: meta.type,
  createdAt: meta.createdAt,
  completedAt: meta.completedAt || null,
  complete: Boolean(meta.complete),
  received: meta.received,
  probe: meta.probe || null,
  frames: meta.frames || [],
  proxy: meta.proxy ? { bytes: meta.proxy.bytes } : null,
});

async function handleList(req, res) {
  const names = await fsp.readdir(UPLOADS).catch(() => []);
  const items = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const meta = await readMeta(name.slice(0, -5)).catch(() => null);
    if (meta) items.push(publicMeta(meta));
  }
  items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return json(res, 200, { ok: true, items, maxBytes: MAX_BYTES });
}

async function handleDelete(req, res, id) {
  const meta = await readMeta(id);
  if (!meta) return fail(res, 404, "unknown_upload");
  await fsp.rm(binPath(meta), { force: true });
  await fsp.rm(metaPath(id), { force: true });
  await fsp.rm(framesDir(id), { recursive: true, force: true });
  await fsp.rm(path.join(PROXIES, `${id}.mp4`), { force: true });
  return json(res, 200, { ok: true });
}

async function serveDownload(req, res, id) {
  const meta = await readMeta(id);
  if (!meta) return fail(res, 404, "unknown_upload");
  const file = binPath(meta);
  let stat;
  try {
    stat = await fsp.stat(file);
  } catch {
    return fail(res, 404, "file_missing");
  }
  const raw = meta.type || "";
  const type = /^text\/|html|xml|json|javascript|svg/.test(raw) ? "text/plain; charset=utf-8" : raw || "application/octet-stream";
  const ascii = meta.file.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  const range = req.headers.range;
  const base = {
    "content-type": type,
    "accept-ranges": "bytes",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "content-disposition": `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(meta.file)}`,
    "content-security-policy": "sandbox; default-src 'none'",
  };

  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m) {
      let start = m[1] ? Number(m[1]) : 0;
      let end = m[2] ? Number(m[2]) : stat.size - 1;
      if (!m[1] && m[2]) {
        start = Math.max(0, stat.size - Number(m[2]));
        end = stat.size - 1;
      }
      if (start >= stat.size || start > end) {
        res.writeHead(416, { "content-range": `bytes */${stat.size}` });
        return res.end();
      }
      end = Math.min(end, stat.size - 1);
      res.writeHead(206, { ...base, "content-range": `bytes ${start}-${end}/${stat.size}`, "content-length": end - start + 1 });
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
  }

  res.writeHead(200, { ...base, "content-length": stat.size });
  fs.createReadStream(file).pipe(res);
}

async function serveProxy(req, res, id) {
  const meta = await readMeta(id);
  if (!meta?.proxy) return fail(res, 404, "no_proxy");
  const file = path.join(PROXIES, `${id}.mp4`);
  let stat;
  try {
    stat = await fsp.stat(file);
  } catch {
    return fail(res, 404, "no_proxy");
  }
  res.writeHead(200, {
    "content-type": "video/mp4",
    "content-length": stat.size,
    "accept-ranges": "bytes",
    "cache-control": "no-store",
  });
  fs.createReadStream(file).pipe(res);
}

async function serveFrame(req, res, id, name) {
  if (!isValidId(id) || !/^\d{2}\.jpg$/.test(name)) return fail(res, 404, "not_found");
  const file = path.join(framesDir(id), name);
  try {
    const buf = await fsp.readFile(file);
    res.writeHead(200, { "content-type": "image/jpeg", "content-length": buf.length, "cache-control": "public, max-age=300" });
    return res.end(buf);
  } catch {
    return fail(res, 404, "not_found");
  }
}

async function serveIndex(res) {
  const html = await fsp.readFile(BROWSER, "utf8");
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  });
  res.end(html);
}

/* ------------------------------------------------------------------- server */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://inbox.local");
  const { pathname } = url;
  try {
    if ((req.method === "GET" || req.method === "HEAD") && (pathname === "/" || pathname === "/index.html")) return await serveIndex(res);
    if (req.method === "GET" && pathname === "/health") return json(res, 200, { ok: true, ffmpeg: fs.existsSync(FFMPEG) || FFMPEG === "ffmpeg" });

    if (pathname === "/api/new" && req.method === "POST") return await handleNew(req, res);
    if (pathname === "/api/files" && req.method === "GET") return await handleList(req, res);

    let m = /^\/api\/chunk\/([a-f0-9]{12})$/.exec(pathname);
    if (m && (req.method === "PUT" || req.method === "POST")) return await handleChunk(req, res, m[1], url);

    m = /^\/api\/done\/([a-f0-9]{12})$/.exec(pathname);
    if (m && req.method === "POST") return await handleDone(req, res, m[1]);

    m = /^\/api\/files\/([a-f0-9]{12})$/.exec(pathname);
    if (m && req.method === "DELETE") return await handleDelete(req, res, m[1]);

    m = /^\/api\/state\/([a-f0-9]{12})$/.exec(pathname);
    if (m && req.method === "GET") {
      const meta = await readMeta(m[1]);
      return meta ? json(res, 200, { ok: true, received: meta.received, complete: meta.complete }) : fail(res, 404, "unknown_upload");
    }

    m = /^\/files\/([a-f0-9]{12})(?:\/download)?$/.exec(pathname);
    if (m && (req.method === "GET" || req.method === "HEAD")) return await serveDownload(req, res, m[1]);

    m = /^\/proxy\/([a-f0-9]{12})$/.exec(pathname);
    if (m && (req.method === "GET" || req.method === "HEAD")) return await serveProxy(req, res, m[1]);

    m = /^\/frames\/([a-f0-9]{12})\/(\d{2}\.jpg)$/.exec(pathname);
    if (m && req.method === "GET") return await serveFrame(req, res, m[1], m[2]);

    return fail(res, 404, "not_found");
  } catch (err) {
    const status = err?.status || 500;
    if (status === 500) console.error("[inbox]", req.method, pathname, err);
    if (!res.headersSent) return fail(res, status, err?.message || "server_error");
    res.destroy();
  }
});

server.requestTimeout = 0;
server.headersTimeout = 0;
server.keepAliveTimeout = 65_000;

server.listen(PORT, HOST, () => {
  const ff = fs.existsSync(FFMPEG) || FFMPEG === "ffmpeg";
  console.log(`[inbox] listening on http://${HOST}:${PORT}`);
  console.log(`[inbox] storing uploads in ${UPLOADS} (max ${(MAX_BYTES / 1048576).toFixed(0)} MB per file)`);
  console.log(`[inbox] ffmpeg: ${ff ? FFMPEG : "not found (metadata/frames skipped)"}`);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
