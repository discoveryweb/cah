# CAHEN Digital Studio

A responsive, Persian-first portfolio website for the CAHEN design and digital team. Built with React, TypeScript, Vite, Tailwind CSS 4, and Lucide icons.

## Development

```bash
npm ci
npm run dev
```

Create a production build with `npm run build`; run the TypeScript check on its own with `npm run typecheck`.

## Content and visual identity

- Page copy, navigation, services and selected projects are editable from the admin panel; the built-in defaults live in `src/content/defaults.ts`.
- Theme tokens and responsive component styling live in `src/index.css`.
- The selected work currently uses **concept** visuals. Replace the images and case-study copy from the admin panel with CAHEN's approved project material before publishing it as client work.
- The supplied CAHEN mark is used throughout the brand lockup and favicon; `src/assets/cahen-logo.png` is the original upload and `src/assets/cahen-mark.png` is its transparent, tightly-cropped web version.
- The About section uses the CanvasUI `ParticleObject` source with a reduced-motion/WebGL/low-memory static fallback. Its upstream license is preserved in `licenses/CANVAS-UI-LICENSE.md`.
- Selected work is presented in a scroll-led circular gallery inspired by [Ravi Katiyar's 21st.dev component](https://21st.dev/@ravikatiyar162/components/circular-gallery). The page exposed the demo and usage, but not the component source in this environment, so the project-specific implementation is local and adds click/keyboard controls plus a reduced-motion static mode.
- The contact-section `ParticleMorph` is a local canvas component configured with the requested morph controls. It uses transparent, equally-sized social SVGs and pauses off-screen; low-end, no-WebGL, and reduced-motion modes show all three static marks.
- The current social links point to each platform's official homepage. Replace them in `src/components/CtaBanner.tsx` with CAHEN's account-specific URLs once available.
- The site is right-to-left by default; keep Persian content and its `dir="rtl"` layout in mind when adding sections.

## Collaboration form and SMS notifications

The collaboration dialog requires a name and phone number; email, service, and project description are optional. Submissions are posted to the same-origin `/api/collaboration` endpoint. The server sends one notification SMS to the fixed manager number; the visitor cannot select or change that recipient.

Configure a private local `.env` file using `.env.example` (never add real credentials to `VITE_*` variables or commit `.env`):

- `ORDER_MANAGER_PHONE`: the manager's mobile number.
- `MELIPAYAMAK_USERNAME` and either `MELIPAYAMAK_API_KEY` or `MELIPAYAMAK_PASSWORD`.
- `MELIPAYAMAK_FROM`: an active sender line enabled for web-service sending.

The server follows National Messagek's [SendSimpleSMS2 REST documentation](https://www.melipayamak.com/api/sendsimplesms2/) and posts form-encoded `username`, `password`, `to`, `from`, `text`, and `isflash` fields to its documented REST endpoint. Development uses a Vite middleware; production can run with `npm run build && npm start` (binds to `0.0.0.0`, defaults to port 4173). Provider credentials and the manager number stay on the server. An in-memory limit allows up to three successful submissions per IP per hour; for multi-instance deployments, move that limiter to shared storage. A provider acceptance ID is not a delivery receipt, and provider sender-line, account, balance, IP-allowlist, and filtering rules still apply.

## Admin panel (`/shenataisoni`)

The control room edits every text block, work sample, link and image on the site. It has **no built-in account**: the owner's credentials come from server-side environment variables and are read at request time. Nothing is stored in the repository, in `localStorage`, or in the browser bundle.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `ADMIN_EMAIL` | Owner email used to sign in (required). |
| `ADMIN_PASSWORD_HASH` | scrypt hash from `npm run admin:hash -- "your passphrase"` (recommended). |
| `ADMIN_PASSWORD` | Fallback plain password (min 12 chars); hashed in memory at boot. Prefer the hash. |
| `ADMIN_NAME` | Display name in the panel (optional). |
| `ADMIN_SESSION_SECRET` | 32+ random characters used to sign session cookies. Rotating it signs out every device. |
| `ADMIN_SESSION_HOURS` | Session lifetime, 1–72 (default 8). |
| `ADMIN_TEAM` | Optional JSON array of `{email, name, role, passwordHash}` for editors/viewers. |
| `ADMIN_BLOB_STORE` | Netlify Blobs store name (default `cahen-admin`). |

Generate a hash without writing the password anywhere:

```bash
npm run admin:hash -- "a long unique passphrase"
```

The panel is fully closed while these variables are missing: `/api/admin/session` reports `configured: false`, the UI shows the exact variables to set, and every login attempt returns `503`. There is no setup screen and no default password to guess.

### Security model

- scrypt (`N=32768, r=8, p=1`) password hashing with per-password salts; unknown emails still run a dummy derivation so timing does not reveal which addresses exist.
- Session cookies are signed (HMAC-SHA256), `HttpOnly`, `SameSite=Strict`, `Secure` over HTTPS, and expire after the configured window.
- Every session is recorded server-side by id, so **logout and revocation take effect immediately** instead of trusting a still-valid cookie. Settings also offers “sign out all devices”.
- Failed logins are throttled per IP and per email (12 / 6 attempts per 15 minutes, then a 15-minute lock with `Retry-After`); successful logins clear the counters.
- Every state-changing request must be same-origin (`Origin` / `Sec-Fetch-Site`), which blocks cross-site form posts (CSRF).
- Uploads are re-typed from their magic bytes (never from the declared `Content-Type`), renamed to random hex names, capped at 6 MB, restricted to JPEG/PNG/WebP/AVIF/GIF, and served with `nosniff` plus `Content-Security-Policy: default-src 'none'; sandbox`.
- Only the public read-only `/api/content` and `/media/*` endpoints are reachable without a session. The old `/api/admin/setup` and `/api/admin/admins` routes were removed.
- Responses are `no-store`; the API answers with `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, COOP/CORP and a restrictive `Permissions-Policy`.

### Deployment

**Self-hosted Node** (`npm run build && npm start`): data lives in `data/` on disk (git-ignored). Set the variables in the process environment or in a local `.env` file (loaded by `server/env.mjs` without overriding real environment variables).

**Netlify**: `netlify.toml` builds `dist/`, publishes it, and rewrites `/api/*` and `/media/*` to `netlify/functions/admin.mjs`. That function reuses the same handler through `server/web-adapter.mjs` and stores content, activity and uploads in **Netlify Blobs** (`server/storage-blobs.mjs`). Add the environment variables above under *Site configuration → Environment variables* (they are server-side only; never use a `VITE_` prefix). Blobs is available on all Netlify plans.

`netlify.toml` also adds a strict CSP for the public site (`script-src 'self' 'wasm-unsafe-eval'` for the particle scene) plus HSTS and frame protections.

### Verifying the security model

```bash
npm run admin:check
```

This spins up the API on a random port against a temporary directory, generates throwaway hashes in memory, and asserts the behaviour described above: origin checks, generic credential errors, cookie flags, tampered and revoked sessions, role limits, removed legacy routes, upload re-typing, path traversal, throttling and the serverless adapter.

### Notes

- The in-memory login limiter is per server instance. Behind multiple serverless instances it still slows brute force, but a shared store would be stronger.
- Keep `ADMIN_SESSION_SECRET` and password hashes in the hosting provider's secret store; rotating the secret invalidates every active session.
- The public content endpoint only ever returns copy, never account data or hashes.
