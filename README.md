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

The collaboration dialog requires a name and phone number; email, service, and project description are optional. Submissions are posted to the same-origin `/api/collaboration` endpoint. Every accepted order is stored first, then its full details are sent by SMS to the fixed manager number; the visitor cannot select or change that recipient.

Orders live in the shared storage layer (max 500, newest first) and appear in the panel's **سفارش‌ها / Orders** tab with the delivery status of each SMS part. When Melipayamak settings are missing or a send fails, the order keeps its `pending`/`failed` status and an owner or editor can re-send it from that tab — the form never drops a lead because of notification problems. Duplicate submissions from the same phone within two minutes are acknowledged without creating a second record.

Configure a private local `.env` file using `.env.example` (never add real credentials to `VITE_*` variables or commit `.env`):

- `ORDER_MANAGER_PHONE`: the manager's mobile number.
- `MELIPAYAMAK_USERNAME` and either `MELIPAYAMAK_API_KEY` or `MELIPAYAMAK_PASSWORD`.
- `MELIPAYAMAK_FROM`: an active sender line enabled for web-service sending.

The server follows National Messagek's [SendSimpleSMS2 REST documentation](https://www.melipayamak.com/api/sendsimplesms2/) and posts form-encoded `username`, `password`, `to`, `from`, `text`, and `isflash` fields to its documented REST endpoint. Development uses a Vite middleware; production can run with `npm run build && npm start` (binds to `0.0.0.0`, defaults to port 4173). Provider credentials and the manager number stay on the server. An in-memory limit allows up to three successful submissions per IP per hour; for multi-instance deployments, move that limiter to shared storage. A provider acceptance ID is not a delivery receipt, and provider sender-line, account, balance, IP-allowlist, and filtering rules still apply.

## Admin panel (`/shenataisoni`)

The control room edits every text block, work sample, link and image on the site, and manages orders and team access. It has **no built-in account**: the first owner's credentials come from server-side environment variables and are read at request time. Nothing is stored in the repository, in `localStorage`, or in the browser bundle.

Owners can add, disable and remove administrators from *مدیران* without touching the server: new accounts receive a one-time password shown once to the creating owner, are stored only as scrypt hashes, and are forced to choose a new password at first sign-in. Role changes and removals revoke that account's sessions immediately, and the last active owner cannot be demoted or deleted. Accounts declared through environment variables stay read-only in the panel (shown as `ENV`) so deployment-level credentials cannot be weakened from the browser.

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

Three checks run entirely offline: `npm run admin:check` (API/security, 63 assertions), `npm run sms:check` (order storage + Melipayamak formatting with a stubbed provider, 21 assertions) and `npm run netlify:check` (bundles both functions with esbuild and exercises them against a mock Netlify Blobs edge API, 23 assertions).

The panel is fully closed while these variables are missing: `/api/admin/session` reports `configured: false`, the UI shows the exact variables to set, and every login attempt returns `503`. There is no setup screen and no default password to guess.

### Security model

- scrypt (`N=32768, r=8, p=1`) password hashing with per-password salts; unknown emails still run a dummy derivation so timing does not reveal which addresses exist.
- Session cookies are signed (HMAC-SHA256), `HttpOnly`, `SameSite=Strict`, `Secure` over HTTPS, and expire after the configured window.
- Every session is recorded server-side by id, so **logout and revocation take effect immediately** instead of trusting a still-valid cookie. Settings also offers “sign out all devices”.
- Failed logins are throttled per IP and per email (12 / 6 attempts per 15 minutes, then a 15-minute lock with `Retry-After`); successful logins clear the counters.
- Every state-changing request must be same-origin (`Origin` / `Sec-Fetch-Site`), which blocks cross-site form posts (CSRF).
- Uploads are re-typed from their magic bytes (never from the declared `Content-Type`), renamed to random hex names, capped at 4 MB, restricted to JPEG/PNG/WebP/AVIF/GIF, and served with `nosniff` plus `Content-Security-Policy: default-src 'none'; sandbox`.
- Only the public read-only `/api/content` and `/media/*` endpoints are reachable without a session. The old `/api/admin/setup` and `/api/admin/admins` routes were removed.
- Panel-managed accounts never leave the server as hashes: `scrypt$…` strings are stripped from every response, one-time passwords are returned once to the creating owner, and the admin state only exposes `{id, email, name, role, active, source, mustChangePassword, createdAt, lastLoginAt}`. The last active owner is protected against demotion/deletion, and changing a role or password revokes the affected sessions.
- Responses are `no-store`; the API answers with `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, COOP/CORP and a restrictive `Permissions-Policy`.

### Deployment

**Self-hosted Node** (`npm run build && npm start`): data lives in `data/` on disk (git-ignored). Set the variables in the process environment or in a local `.env` file (loaded by `server/env.mjs` without overriding real environment variables).

**Netlify** — the repository is already configured; connect it to a Netlify site and set the environment variables:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` (from `netlify.toml`) |
| Publish directory | `dist` |
| Functions directory | `netlify/functions` |
| Node version | `22` (`netlify.toml` + `.nvmrc`) |

Required environment variables (Site configuration → Environment variables, scope **Functions**):

- `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` (or `ADMIN_PASSWORD`), `ADMIN_SESSION_SECRET` — the owner account. Use `npm run admin:hash -- "passphrase"`; never commit the hash.
- `ORDER_MANAGER_PHONE`, `MELIPAYAMAK_USERNAME`, `MELIPAYAMAK_API_KEY` (or `MELIPAYAMAK_PASSWORD`), `MELIPAYAMAK_FROM` — SMS notifications. Missing values do not break the site: orders are stored and queued.

Optional: `ADMIN_NAME`, `ADMIN_SESSION_HOURS` (1–72, default 8), `ADMIN_TEAM` (JSON array of extra env-level editors/viewers), `ADMIN_BLOB_STORE` (default `cahen-admin`), `ADMIN_COOKIE_SECURE`, `TRUST_PROXY`.

How the deployment is wired:

- `[[redirects]]` send `/api/*` and `/media/*` to `netlify/functions/admin.mjs` with status `200` and `force = true`, before the SPA fallback (`/*` → `/index.html`). `/shenataisoni` also falls back to the SPA shell.
- The function reuses the exact handlers from `server/` through `server/web-adapter.mjs`; there is no second API implementation to drift.
- State (content, sessions, orders, uploads) lives in **Netlify Blobs** (`server/storage-blobs.mjs`). Netlify injects the Blobs context automatically inside functions; the client is lazy so a missing context returns a clean `503 storage_unavailable` instead of crashing the deploy.
- Deploy previews and branch deploys use `<store>-preview` automatically (`CONTEXT` is `deploy-preview`/`branch-deploy`), so preview edits and test orders never touch production content.
- `netlify/functions/retry-orders.mjs` is a scheduled function (`@hourly`) that re-sends orders left in `pending`/`failed`, for example when SMS settings were added after the fact. It is free of side effects when the queue is empty.
- SMS parts are sent after the HTTP response using the function's `waitUntil` context, so the visitor never waits on Melipayamak and the request stays well inside the function and rewrite timeouts. On the self-hosted server the same handler sends synchronously.
- Uploads are capped at 4 MB because Netlify buffers at most 6 MB per request and base64-encodes binary bodies (+33%).
- Responses from the function set their own security headers (Netlify header rules only apply to static files): `no-store` for the API, `nosniff`/CSP sandbox for media, HSTS and frame protections for HTML.

After the first deploy:

1. Open `https://<site>/shenataisoni` and sign in with `ADMIN_EMAIL` and the password behind `ADMIN_PASSWORD_HASH`.
2. Save a text change and reload the public page to confirm Blobs writes work.
3. Submit the collaboration form once and check the order appears under *سفارش‌ها* with SMS status `sent` (or `pending` if SMS variables are not set yet; the hourly sweep will retry).
4. Add a custom domain under Domain management; session cookies are `Secure` on HTTPS automatically.

Troubleshooting:

- `admin_not_configured` — `ADMIN_EMAIL` / password / `ADMIN_SESSION_SECRET` are missing or rejected at boot; open `/api/admin/session` to see the exact `issues` list.
- `storage_unavailable` — the function cannot reach Netlify Blobs. Confirm the site has Blobs enabled (all plans) and that the deploy is running as a Netlify Function, not a static preview.
- Login appears to succeed but the panel is read-only — check the role (`viewer`), and remember that role changes revoke the affected sessions.
- Orders stay `pending` — fill the four Melipayamak variables, redeploy, then use *ارسال دوباره* or wait for the hourly sweep.

`netlify.toml` also sets a strict CSP for the public site (`script-src 'self' 'wasm-unsafe-eval'` for the particle scene), immutable caching for `/assets/*`, no-cache for `index.html`, and `noindex` for the control room.

### Verifying the security model

```bash
npm run admin:check   # API + security model
npm run sms:check     # order storage + Melipayamak client
npm run netlify:check # function bundling + Blobs-backed routes
```

The first two spin up the API on a random port against a temporary directory with throwaway credentials; the third bundles both functions with esbuild and runs them against a mock Netlify Blobs edge API. Together they cover origin checks, generic credential errors, cookie flags, tampered and revoked sessions, role limits, upload re-typing, path traversal, throttling, order queuing, SMS formatting, SPA/API routing and storage-outage behaviour.

### Notes

- The in-memory login limiter is per server instance. Behind multiple serverless instances it still slows brute force, but a shared store would be stronger.
- Keep `ADMIN_SESSION_SECRET` and password hashes in the hosting provider's secret store; rotating the secret invalidates every active session.
- The public content endpoint only ever returns copy, never account data or hashes.
