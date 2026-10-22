import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

/**
 * Password hashing parameters. N is the CPU/memory cost; 2^15 with r=8 needs
 * ~33MB per derivation, which is why maxmem is raised explicitly.
 */
export const SCRYPT_PARAMS = { N: 32768, r: 8, p: 1, keyLen: 64, maxmem: 96 * 1024 * 1024 };
const LEGACY_PARAMS = { ...SCRYPT_PARAMS, N: 16384 };
export const MIN_PASSWORD_LENGTH = 12;
export const MIN_SECRET_LENGTH = 32;

const derive = (password, salt, params) =>
  scrypt(password, salt, params.keyLen, {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: params.maxmem,
  });

/** `scrypt$N$r$p$saltHex$hashHex` — self-describing so params can move later. */
export async function hashPassword(password, params = SCRYPT_PARAMS) {
  const salt = randomBytes(16);
  const derived = await derive(String(password), salt, params);
  return ["scrypt", params.N, params.r, params.p, salt.toString("hex"), derived.toString("hex")].join("$");
}

function parseHash(stored) {
  const parts = String(stored ?? "").trim().split("$");
  if (parts[0] !== "scrypt") return null;
  if (parts.length === 6) {
    const [, n, r, p, saltHex, hashHex] = parts;
    const params = { ...SCRYPT_PARAMS, N: Number(n), r: Number(r), p: Number(p) };
    if (!Number.isFinite(params.N) || !Number.isFinite(params.r) || !Number.isFinite(params.p)) return null;
    if (params.N < 4096 || params.N > 1048576 || params.r < 1 || params.r > 32) return null;
    return { params, saltHex, hashHex };
  }
  // Legacy three-part hashes from the previous store format.
  if (parts.length === 3) return { params: LEGACY_PARAMS, saltHex: parts[1], hashHex: parts[2] };
  return null;
}

export async function verifyPassword(password, stored) {
  const parsed = parseHash(stored);
  if (!parsed) return false;
  let expected;
  try {
    expected = Buffer.from(parsed.hashHex, "hex");
    if (expected.length < 16) return false;
  } catch {
    return false;
  }
  const derived = await derive(String(password), Buffer.from(parsed.saltHex, "hex"), parsed.params);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** A throwaway hash used to equalise timing when the email is unknown. */
let dummyHashPromise = null;
export const getDummyHash = () => {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(randomBytes(24).toString("base64url"));
  }
  return dummyHashPromise;
};

const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;
export const normaliseEmail = (value) => String(value ?? "").trim().toLowerCase();

const accountId = (email) => createHash("sha256").update(`cahen:${email}`).digest("hex").slice(0, 16);

export const passwordIssue = (password, email) => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `گذرواژه باید حداقل ${MIN_PASSWORD_LENGTH} نویسه باشد.`;
  }
  if (password.length > 512) return "گذرواژه بیش از حد بلند است.";
  const local = email.split("@")[0] ?? "";
  if (local.length >= 4 && password.toLowerCase().includes(local)) {
    return "گذرواژه نباید بخشی از ایمیل باشد.";
  }
  if (/^(.)\1+$/.test(password)) return "گذرواژه نباید تکرار یک نویسه باشد.";
  if (/^(password|passw0rd|qwerty|123456|admin)/i.test(password)) {
    return "گذرواژهٔ انتخاب‌شده بسیار حدس‌زدنی است.";
  }
  return null;
};

const PLACEHOLDER_SECRETS = /(change[-_ ]?me|replace[-_ ]?me|example|secret|test|demo)/i;

/**
 * Reads the whole admin identity from server-side environment variables.
 * Nothing is stored on disk: removing an account or rotating the secret
 * invalidates access immediately after a restart.
 */
export async function loadAdminConfig(env = process.env) {
  const issues = [];
  const accounts = [];

  const secret = String(env.ADMIN_SESSION_SECRET ?? "");
  if (secret.length < MIN_SECRET_LENGTH) {
    issues.push(`ADMIN_SESSION_SECRET باید حداقل ${MIN_SECRET_LENGTH} نویسهٔ تصادفی باشد.`);
  } else if (PLACEHOLDER_SECRETS.test(secret)) {
    issues.push("ADMIN_SESSION_SECRET شبیه مقدار نمونه است؛ یک رشتهٔ تصادفی تازه بسازید.");
  }

  const ownerEmail = normaliseEmail(env.ADMIN_EMAIL);
  const ownerHash = String(env.ADMIN_PASSWORD_HASH ?? "").trim();
  const ownerPassword = String(env.ADMIN_PASSWORD ?? "");

  if (!ownerEmail) {
    issues.push("ADMIN_EMAIL تعریف نشده است.");
  } else if (!EMAIL_PATTERN.test(ownerEmail)) {
    issues.push("ADMIN_EMAIL یک ایمیل معتبر نیست.");
  }

  let ownerStoredHash = null;
  if (ownerHash) {
    if (!parseHash(ownerHash)) {
      issues.push("ADMIN_PASSWORD_HASH معتبر نیست؛ آن را با «npm run admin:hash» بسازید.");
    } else {
      ownerStoredHash = ownerHash;
    }
  } else if (ownerPassword) {
    const reason = passwordIssue(ownerPassword, ownerEmail || "admin@local");
    if (reason) issues.push(`ADMIN_PASSWORD: ${reason}`);
    else ownerStoredHash = await hashPassword(ownerPassword);
  } else {
    issues.push("یکی از ADMIN_PASSWORD_HASH یا ADMIN_PASSWORD لازم است.");
  }

  if (ownerEmail && ownerStoredHash) {
    accounts.push({
      id: accountId(ownerEmail),
      email: ownerEmail,
      name: String(env.ADMIN_NAME ?? "").trim().slice(0, 60) || ownerEmail.split("@")[0],
      role: "owner",
      hash: ownerStoredHash,
    });
  }

  const teamRaw = String(env.ADMIN_TEAM ?? "").trim();
  if (teamRaw) {
    let team = null;
    try {
      team = JSON.parse(teamRaw);
    } catch {
      issues.push("ADMIN_TEAM باید یک آرایهٔ JSON معتبر باشد.");
    }
    if (team && !Array.isArray(team)) {
      issues.push("ADMIN_TEAM باید یک آرایه باشد.");
      team = null;
    }
    for (const [index, entry] of (team ?? []).entries()) {
      const label = `ADMIN_TEAM[${index}]`;
      if (!entry || typeof entry !== "object") {
        issues.push(`${label} باید یک شیء باشد.`);
        continue;
      }
      const email = normaliseEmail(entry.email);
      const role = String(entry.role ?? "");
      if (!EMAIL_PATTERN.test(email)) {
        issues.push(`${label}.email معتبر نیست.`);
        continue;
      }
      if (accounts.some((account) => account.email === email)) {
        issues.push(`${label}.email تکراری است.`);
        continue;
      }
      if (role !== "editor" && role !== "viewer") {
        issues.push(`${label}.role باید editor یا viewer باشد.`);
        continue;
      }
      const hash = String(entry.passwordHash ?? "").trim();
      let stored = null;
      if (hash) {
        if (!parseHash(hash)) {
          issues.push(`${label}.passwordHash معتبر نیست.`);
          continue;
        }
        stored = hash;
      } else if (entry.password) {
        const reason = passwordIssue(String(entry.password), email);
        if (reason) {
          issues.push(`${label}.password: ${reason}`);
          continue;
        }
        stored = await hashPassword(String(entry.password));
      } else {
        issues.push(`${label} به passwordHash نیاز دارد.`);
        continue;
      }
      accounts.push({
        id: accountId(email),
        email,
        name: String(entry.name ?? "").trim().slice(0, 60) || email.split("@")[0],
        role,
        hash: stored,
      });
    }
  }

  const hours = Number(env.ADMIN_SESSION_HOURS ?? 8);
  const sessionHours = Number.isFinite(hours) ? Math.min(72, Math.max(1, Math.round(hours))) : 8;

  return {
    ready: issues.length === 0 && accounts.length > 0,
    issues,
    secret,
    accounts,
    sessionTtlMs: sessionHours * 60 * 60 * 1000,
    cookieSecure: String(env.ADMIN_COOKIE_SECURE ?? "").toLowerCase() === "true",
  };
}

export const publicAccount = (account) => ({
  id: account.id,
  email: account.email,
  name: account.name,
  role: account.role,
  active: true,
});
