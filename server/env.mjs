import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function parseEnvValue(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).replace(/\\n/g, "\n").replace(/\\r/g, "\r");
  }
  return trimmed.replace(/\s+#.*$/, "").trim();
}

/** Load local server-only .env files without overriding deployment environment variables. */
export function loadServerEnv() {
  const values = new Map();
  for (const fileName of [".env", ".env.local"]) {
    const filePath = path.join(projectRoot, fileName);
    if (!existsSync(filePath)) continue;
    const source = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      values.set(match[1], parseEnvValue(match[2]));
    }
  }
  for (const [key, value] of values) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
