#!/usr/bin/env node
/**
 * Turn a raw clip into the web-ready hero film.
 *
 * Default pipeline (what the delivered CAHEN clip used):
 *   1. trim (optional) and drop the audio track
 *   2. remove the burned-in corner badge, if the clip has one
 *   3. cover-crop / scale to 16:9
 *   4. interpolate to 60 fps so motion is smooth on high-refresh screens
 *   5. two encodes: 1920×1080 (desktop) and 1280×720 (phones)
 *   6. fade from black and back to black, so `loop` restarts invisibly
 *   7. poster, plus a blurred 29 KB thumbnail for instant first paint
 *
 * Usage
 *   npm run film:video -- inbox/uploads/<file>.mp4
 *   npm run film:video -- clip.mp4 --start 0.4 --duration 14.5 --fps 60
 *   npm run film:video -- clip.mp4 --badge 1014,642,262,52   # delogo x,y,w,h
 *   npm run film:video -- clip.mp4 --no-interpolate --fit contain
 *   npm run film:video -- --placeholder                      # branded stand-in
 *
 * Output: public/film/{hero-1920.mp4, hero-1280.mp4, hero-poster.jpg,
 *         hero-poster-blur.jpg}
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "public", "film");
const WORK = path.join(ROOT, ".film-work");

const argv = process.argv.slice(2);
const flag = (name, fallback = undefined) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = argv[i + 1];
  return !next || next.startsWith("--") ? true : next;
};
const has = (name) => argv.includes(`--${name}`);
const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));

const placeholder = has("placeholder");
const input = positional[0];
const start = Number(flag("start", 0)) || 0;
const duration = Number(flag("duration", 0)) || 0;
/** 0 keeps the source frame rate. */
const fps = Number(flag("fps", 60)) || 0;
const interpolate = !has("no-interpolate");
const fit = String(flag("fit", "cover"));
const badge = flag("badge", null);
const crf = Number(flag("crf", 30)) || 30;

function findFfmpeg() {
  const env = process.env.FFMPEG_BIN;
  if (env && fs.existsSync(env)) return env;
  const folder = "/tmp/ffmpegpkg/imageio_ffmpeg/binaries";
  if (fs.existsSync(folder)) {
    const hit = fs
      .readdirSync(folder)
      .filter((n) => n.startsWith("ffmpeg-"))
      .sort()
      .pop();
    if (hit) return path.join(folder, hit);
  }
  return "ffmpeg";
}

const FFMPEG = findFfmpeg();

function run(args, label, quiet = false) {
  return new Promise((resolve, reject) => {
    if (!quiet) process.stdout.write(`  ${label} … `);
    const started = Date.now();
    const child = spawn(FFMPEG, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr.on("data", (d) => {
      err += d.toString();
      if (err.length > 12000) err = err.slice(-6000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        if (!quiet) process.stdout.write(`ok (${((Date.now() - started) / 1000).toFixed(0)}s)\n`);
        resolve();
      } else {
        if (!quiet) process.stdout.write("failed\n");
        reject(new Error(err.split("\n").filter(Boolean).slice(-8).join("\n")));
      }
    });
  });
}

const size = (bytes) => (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`);

/** Frame geometry helpers: cover-crop means "fill 16:9, then scale". */
function filterChain(W, H, { sourceW, sourceH }) {
  const parts = [];
  if (badge) {
    const [x, y, w, h] = String(badge).split(",").map(Number);
    // Coordinates are in source pixels; crop is relative to the same frame.
    parts.push(`delogo=x=${x}:y=${y}:w=${w}:h=${h}`);
  }
  if (fit === "contain") {
    parts.push(`scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos`, `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black`);
  } else if (sourceW !== W || sourceH !== H) {
    parts.push(`scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W}:${H}`);
  }
  if (interpolate && fps) {
    parts.push(`minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`);
  } else if (fps) {
    parts.push(`fps=${fps}`);
  }
  return parts.join(",");
}

async function probe(file) {
  return new Promise((resolve) => {
    const child = spawn(FFMPEG, ["-hide_banner", "-i", file], { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("close", () => {
      const dur = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(err);
      const vid = /Stream #\d+:\d+.*?: Video: .*?, (\d{2,5})x(\d{2,5})/.exec(err);
      resolve({
        duration: dur ? Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]) : 0,
        width: vid ? Number(vid[1]) : 0,
        height: vid ? Number(vid[2]) : 0,
      });
    });
  });
}

async function main() {
  await fsp.mkdir(OUT, { recursive: true });
  await fsp.mkdir(WORK, { recursive: true });

  if (placeholder) {
    const total = duration || 14;
    console.log(`Rendering a ${total}s placeholder loop in the brand palette…`);
    await run(
      [
        "-hide_banner", "-y", "-loglevel", "error",
        "-f", "lavfi", "-i",
        `gradients=s=1920x1080:c0=0x07071a:c1=0x2b1567:c2=0x120a2e:c3=0x5532b8:c4=0x0b0820:x0=180:y0=90:x1=1740:y1=990:speed=0.006:duration=${total}:rate=60`,
        "-vf", "format=yuv420p,vignette=PI/4.4,noise=alls=5:allf=t+u",
        "-c:v", "libx264", "-preset", "medium", "-crf", "30",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
        path.join(WORK, "master.mp4"),
      ],
      "placeholder",
    );
    return finish(path.join(WORK, "master.mp4"), { duration: total });
  }

  if (!input) {
    console.error(
      [
        "Usage: npm run film:video -- <video-file> [options]",
        "",
        "  --start 0.4        trim from this second",
        "  --duration 14.5    keep this many seconds",
        "  --fps 60           target frame rate (0 keeps the source)",
        "  --no-interpolate   drop frames instead of interpolating",
        "  --fit contain      letterbox instead of cover-cropping",
        "  --badge x,y,w,h    remove a burned-in badge with delogo",
        "  --crf 30           quality for the 1080p master (lower = better)",
        "  --placeholder      render a branded stand-in loop",
      ].join("\n"),
    );
    process.exit(2);
  }
  if (!fs.existsSync(input)) {
    console.error(`Not found: ${input}`);
    process.exit(2);
  }

  const meta = await probe(input);
  console.log(`Input: ${path.basename(input)} — ${meta.width}×${meta.height}, ${meta.duration.toFixed(2)}s`);

  const trim = [];
  if (start) trim.push("-ss", String(start));
  if (duration) trim.push("-t", String(duration));

  // Step 1 — clean, steady master at 1280 wide, then everything derives from it.
  const master = path.join(WORK, "master.mp4");
  const masterH = Math.round((1280 * 9) / 16);
  await run(
    [
      "-hide_banner", "-y", "-loglevel", "error",
      ...trim, "-i", input,
      "-an",
      "-vf", `${filterChain(1280, masterH, meta)},setsar=1`,
      "-c:v", "libx264", "-profile:v", "high", "-preset", "medium",
      "-crf", String(Math.max(18, crf - 8)), "-maxrate", "10M", "-bufsize", "20M",
      "-pix_fmt", "yuv420p", "-g", String(fps || 60), "-movflags", "+faststart",
      master,
    ],
    "master (clean, steady, silent)",
  );

  await finish(master, { ...meta, duration: duration || meta.duration - start });
}

/** Encode the two delivery sizes plus posters, then report. */
async function finish(master, meta) {
  const total = meta.duration || 14;
  const fadeOutAt = Math.max(0.2, total - 0.72);

  const encode = async (label, W, H, quality, rate) => {
    const file = path.join(OUT, W >= 1600 ? "hero-1920.mp4" : "hero-1280.mp4");
    await run(
      [
        "-hide_banner", "-y", "-loglevel", "error",
        "-i", master, "-an",
        "-vf", `scale=${W}:${H}:flags=lanczos,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=${fadeOutAt.toFixed(2)}:d=0.62`,
        "-c:v", "libx264", "-profile:v", "high", "-preset", "slow",
        "-crf", String(quality), "-maxrate", rate, "-bufsize", `${parseFloat(rate) * 2}M`,
        "-pix_fmt", "yuv420p", "-g", "60", "-movflags", "+faststart",
        file,
      ],
      label,
    );
  };

  await encode("desktop 1920×1080", 1920, 1080, crf, "4M");
  await encode("mobile 1280×720", 1280, 720, crf - 1, "1500k");

  await run(
    [
      "-hide_banner", "-y", "-loglevel", "error",
      "-ss", (total * 0.34).toFixed(2), "-i", path.join(OUT, "hero-1920.mp4"),
      "-frames:v", "1", "-vf", "scale=1600:-2:flags=lanczos", "-q:v", "4",
      path.join(OUT, "hero-poster.jpg"),
    ],
    "poster",
  );
  await run(
    [
      "-hide_banner", "-y", "-loglevel", "error",
      "-i", path.join(OUT, "hero-poster.jpg"),
      "-vf", "scale=24:-2,scale=1600:-2:flags=neighbor", "-q:v", "6",
      path.join(OUT, "hero-poster-blur.jpg"),
    ],
    "poster thumbnail",
  );

  const files = ["hero-1920.mp4", "hero-1280.mp4", "hero-poster.jpg", "hero-poster-blur.jpg"];
  let totalBytes = 0;
  console.log("\npublic/film:");
  for (const name of files) {
    const stat = await fsp.stat(path.join(OUT, name)).catch(() => null);
    if (!stat) continue;
    totalBytes += stat.size;
    console.log(`  ${name.padEnd(24)} ${size(stat.size)}`);
  }
  console.log(`  ${"total".padEnd(24)} ${size(totalBytes)}`);
  await fsp.rm(WORK, { recursive: true, force: true });
  if (totalBytes > 9 * 1048576) {
    console.log("\n! Over 9 MB. Raise --crf (32–34) or trim with --duration to keep the hero light.");
  }
  console.log("\nNext: npm run build");
}

main().catch(async (err) => {
  console.error("\nFailed:", err.message);
  if (/ENOENT/.test(err.message)) {
    console.error("ffmpeg is missing. Install it with: ./inbox/setup-ffmpeg.sh");
  }
  await fsp.rm(WORK, { recursive: true, force: true });
  process.exit(1);
});
