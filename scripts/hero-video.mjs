#!/usr/bin/env node
/**
 * Turn a raw video into the web-ready hero film.
 *
 * Produces, in public/film/:
 *   hero-1920.mp4   desktop loop  (H.264 High, yuv420p, faststart, no audio)
 *   hero-1280.mp4   phones/tablets (lighter bitrate)
 *   hero-poster.jpg first paint + fallback still
 *   hero-scrub.mp4  optional all-keyframe edition for scroll-scrubbing
 *
 * Usage:
 *   npm run film:video -- inbox/uploads/<id>-clip.mp4
 *   npm run film:video -- clip.mp4 --start 2 --duration 12 --fps 60
 *   npm run film:video -- --placeholder      # brand-coloured stand-in loop
 *
 * Cropping: by default the clip is cropped to 16:9 and scaled to width, so any
 * aspect ratio fills the hero without letterboxing.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "public", "film");

const argv = process.argv.slice(2);
const flag = (name, fallback = undefined) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = argv[i + 1];
  return !next || next.startsWith("--") ? true : next;
};
const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));

const placeholder = flag("placeholder", false) === true;
const input = positional[0];
const start = Number(flag("start", 0)) || 0;
const duration = Number(flag("duration", 0)) || 0;
// 0 = keep the source frame rate, which is what high-frame-rate clips need.
const fps = Number(flag("fps", 0)) || 0;
const scrub = flag("scrub", false) === true;

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

function run(args, label) {
  return new Promise((resolve, reject) => {
    process.stdout.write(`  ${label} … `);
    const child = spawn(FFMPEG, args, { stdio: ["ignore", "inherit", "pipe"] });
    let err = "";
    child.stderr.on("data", (d) => {
      err += d.toString();
      if (err.length > 8000) err = err.slice(-4000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        process.stdout.write("ok\n");
        resolve();
      } else {
        process.stdout.write("failed\n");
        reject(new Error(err.split("\n").filter(Boolean).slice(-6).join("\n")));
      }
    });
  });
}

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;
const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

async function main() {
  await fsp.mkdir(OUT, { recursive: true });

  if (placeholder) {
    const total = duration || 14;
    console.log(`Rendering a ${total}s placeholder loop in the brand palette…`);
    await run(
      [
        "-hide_banner", "-y", "-loglevel", "error",
        "-f", "lavfi",
        "-i",
        `gradients=s=1920x1080:c0=0x07071a:c1=0x2b1567:c2=0x120a2e:c3=0x5532b8:c4=0x0b0820:x0=180:y0=90:x1=1740:y1=990:speed=0.006:duration=${total}:rate=60`,
        "-vf",
        "format=yuv420p,vignette=PI/4.4,noise=alls=5:allf=t+u",
        "-c:v", "libx264", "-preset", "medium", "-crf", "30",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
        path.join(OUT, "hero-1920.mp4"),
      ],
      "placeholder",
    );
    await run(
      [
        "-hide_banner", "-y", "-loglevel", "error",
        "-i", path.join(OUT, "hero-1920.mp4"),
        "-vf", "scale=1280:-2:flags=lanczos",
        "-c:v", "libx264", "-preset", "medium", "-crf", "32",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
        path.join(OUT, "hero-1280.mp4"),
      ],
      "placeholder (mobile)",
    );
    await run(
      [
        "-hide_banner", "-y", "-loglevel", "error",
        "-i", path.join(OUT, "hero-1920.mp4"),
        "-frames:v", "1", "-vf", "scale=1600:-2:flags=lanczos", "-q:v", "3",
        path.join(OUT, "hero-poster.jpg"),
      ],
      "poster",
    );
    return report();
  }

  if (!input) {
    console.error(
      [
        "Usage: npm run film:video -- <video-file> [--start 0] [--duration 12] [--fps 30] [--scrub]",
        "       npm run film:video -- --placeholder",
      ].join("\n"),
    );
    process.exit(2);
  }
  if (!fs.existsSync(input)) {
    console.error(`Not found: ${input}`);
    process.exit(2);
  }

  const trim = [];
  if (start) trim.push("-ss", String(start));
  if (duration) trim.push("-t", String(duration));

  // Fill the frame: cover-crop to 16:9, then scale. `--fit contain` keeps edges.
  const fit = flag("fit", "cover");
  const rate = fps ? `,fps=${fps}` : "";
  const filterFor = (w) =>
    fit === "contain"
      ? `scale=${w}:-2:flags=lanczos${rate},format=yuv420p`
      : `scale=${w}:${Math.round((w * 9) / 16)}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${Math.round((w * 9) / 16)}${rate},format=yuv420p`;

  console.log(`Input: ${input}`);
  console.log(`Encoding ${fps ? `${fps} fps` : "at the source frame rate"}, ${fit} fit${duration ? `, ${duration}s` : ""}…`);

  await run(
    [
      "-hide_banner", "-y", "-loglevel", "error",
      ...trim, "-i", input,
      "-an",
      "-vf", filterFor(1920),
      "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "23",
      "-maxrate", "6M", "-bufsize", "12M",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      path.join(OUT, "hero-1920.mp4"),
    ],
    "desktop",
  );

  await run(
    [
      "-hide_banner", "-y", "-loglevel", "error",
      ...trim, "-i", input,
      "-an",
      "-vf", filterFor(1280),
      "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "26",
      "-maxrate", "2.5M", "-bufsize", "5M",
      "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      path.join(OUT, "hero-1280.mp4"),
    ],
    "mobile",
  );

  const posterAt = Math.min(start + 0.6, start + (duration ? duration / 2 : 0.6));
  await run(
    [
      "-hide_banner", "-y", "-loglevel", "error",
      "-ss", String(posterAt), "-i", input,
      "-frames:v", "1",
      "-vf", `scale=1600:-2:flags=lanczos`,
      "-q:v", "3",
      path.join(OUT, "hero-poster.jpg"),
    ],
    "poster",
  );

  if (scrub) {
    // Every frame a keyframe: seeking by scroll stays instant and smooth.
    await run(
      [
        "-hide_banner", "-y", "-loglevel", "error",
        ...trim, "-i", input,
        "-an",
        "-vf", `scale=1440:${Math.round((1440 * 9) / 16)}:force_original_aspect_ratio=increase:flags=lanczos,crop=1440:${Math.round((1440 * 9) / 16)}${rate},format=yuv420p`,
        "-c:v", "libx264", "-preset", "slow", "-crf", "23",
        "-g", "1", "-keyint_min", "1", "-sc_threshold", "0",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        path.join(OUT, "hero-scrub.mp4"),
      ],
      "scrub master",
    );
  }

  await report();
}

async function report() {
  const files = (await fsp.readdir(OUT)).filter((n) => !n.startsWith(".")).sort();
  let total = 0;
  console.log("\npublic/film:");
  for (const name of files) {
    const stat = await fsp.stat(path.join(OUT, name));
    total += stat.size;
    console.log(`  ${name.padEnd(22)} ${stat.size > 1048576 ? mb(stat.size) : kb(stat.size)}`);
  }
  console.log(`  ${"total".padEnd(22)} ${mb(total)}`);
  if (total > 12 * 1048576) {
    console.log("\n! Over 12 MB. Re-run with --duration 10 or a higher CRF to keep the hero light.");
  }
  console.log("\nNext: npm run build   (or npm run dev)");
}

main().catch((err) => {
  console.error("\nFailed:", err.message);
  if (/ENOENT/.test(err.message) || !fs.existsSync(FFMPEG)) {
    console.error("ffmpeg is missing. Install it with: ./inbox/setup-ffmpeg.sh");
  }
  process.exit(1);
});
