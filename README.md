# CAHEN Digital Studio

A responsive, Persian-first portfolio website for the CAHEN design and digital team. Built with React, TypeScript, Vite, Tailwind CSS 4, and Lucide icons.

## Development

```bash
npm ci
npm run dev
```

Create a production build with `npm run build`; run the TypeScript check on its own with `npm run typecheck`.

## The opening screen

One screen of type and one lit object: the studio's mark, rendered as machined
violet metal by a hand-written WebGL2 fragment shader. **Nothing is pinned and
nothing plays.**

It replaced a film — a 3–5 MB stock render of a blue sci-fi corridor, scrubbed
frame by frame with the page held for 3.4 viewports. That was someone else's
picture, it cost megabytes before a reader saw a word, and it resisted the
scroll. (The alternatives were tried and rejected on the evidence: a particle
burst, drifting silk sheets and a raymarched lens all read as decoration rather
than as an object with weight.)

### What draws it — `src/components/HeroRelief.tsx`

No three.js, no scene graph, no post-processing chain: one vertex shader, one
fragment shader, one texture, one full-screen triangle.

- **The form.** `public/hero/mark-relief.webp` is the mark baked into a height
  field: R = soft height, G/A = sharp coverage, B = fine detail. 86 KB (39 KB on
  a phone), preloaded, and the only image the first screen needs.
- **The lighting is real.** Per-pixel normals from the height field (four taps,
  central differences), one key light sweeping across the piece over 24 s, one
  cool fill, one rim, a specular lobe, fresnel, and occlusion from the form
  itself — so it reads as a physical object rather than a picture of a logo.
  The swept shadow is *not* a shifted sprite: that produced a hard patch.
- **Aspect is handled properly.** Screen space keeps the long axis at 1, so the
  object stays round at every width, and the composition is explicit per
  breakpoint: `heroFocus()` centres it on a phone and pushes it right of centre
  on a wide screen, where the type needs the left third. `heroScale()` is the
  height, in screen units, that the texture square spans — a *larger* number is
  a larger object.
- **Orientation is a correctness requirement.** `gl_FragCoord.y` runs up the
  screen while a texture's `v` runs down it, so the mapping negates `y` exactly
  once, in `markSpace()`, and the upload leaves `UNPACK_FLIP_Y_WEBGL` alone.
  Flipping in both places is how the mark ended up upside down once; the gate
  now counts the negations and requires the texture not to be flipped back.
- **Arrival** is light spreading outward from the centre over 2.6 s, not a fade.

### It answers the pointer

The piece is not a picture that reacts: the *surface* is disturbed, and every
other term is derived from that disturbance, so the response is physical rather
than decorative.

- **The finger presses a lens.** A gaussian well under the pointer drags the
  mark's own texcoord in its falloff — a bulge in the metal, not a scale on the
  element. It eases in over ~0.2 s and keeps breathing while a pointer rests on
  it, so a held hover never freezes.
- **Taps and drags shed shockwaves.** A press lands a ring that travels outward
  (`front = age · 0.40`), a second faster crest trailing it, and a dent behind
  that heals — four slots (two on the reduced tier), 2.6 s each, dropped oldest
  first. A drag spawns one every 110 ms, and only if the pointer actually
  travelled, so a still finger stays calm.
- **Everything is lit by the disturbance.** Energy from the lens and the crests
  tilts the surface normal, gathers a caustic (blended toward lilac-white, never
  added — adding clips to white and reads as a lamp) and bleeds a little glow
  into the plate behind, so the mark seems lit from within rather than pasted on.
- **Dispersion, inside the palette.** The crest is sampled twice, either side of
  the true tone, and the two ends are laid on opposite flanks of the wave. Both
  ends live in the studio's own violet ramp, so the fringe reads as refraction
  and never as a rainbow.
- **One projection, or the lens surfaces in the wrong place.** The pointer, the
  shockwaves and the fragment itself all resolve through `markSpace()`. Passing
  screen uv to a texture-space disturbance puts the bulge where the finger is
  not, and the gate pins the shared projection for exactly that reason.

Cost on arrival is unchanged: the interaction is uniforms and a few dozen ALU
operations inside the draw that was already happening. On a touch screen the
parallax is skipped entirely — the finger moving the surface *is* the effect —
and `prefers-reduced-motion` never spawns a disturbance at all. Every listener
is `passive` on the `.hero` section, so none of it can delay a scroll or a tap
on the order form.

### Performance ladder

| tier | when | cost |
|---|---|---|
| full | a normal device | DPR 2 (1.5 on a phone) capped by a pixel budget, 60 fps, 1 texture upload |
| reduced | ≤ 4 cores, ≤ 4 GB, `saveData` | DPR 1.25, 30 fps, half the shockwave slots |
| still | `prefers-reduced-motion` | one frame, then no loop at all |
| none | no WebGL2, or a shader that fails to compile | the CSS violet field underneath |

The loop stops when the canvas is off screen or the tab is hidden, the pixel
ratio is capped, and every GPU object is released on unmount. Failures are
logged (`hero shader: …`), never swallowed into a black screen.

`npm run hero:check` mounts the real component against a recording WebGL2
context and holds all of it: the shaders parse as GLSL ES 3.00 and are not
truncated, the normal/key/specular/fresnel terms are present, the renderer is
raw WebGL2, shader errors are logged, there is a reduced tier, reduced motion
draws once and stops, the loop halts when hidden, a phone loads the 512 texture,
and no video or media request exists anywhere on the first screen.

The interaction is tested end to end rather than by regex alone: the gate
dispatches a real `pointerdown` on the hero, then reads back the uniforms that
reached the stubbed GPU and requires the lens to be where the finger was and a
shockwave to be in the ring buffer — then releases the pointer and requires the
lens to let go. Orientation is pinned the same way: exactly one `-q.y`, inside
the shared projection, with the upload unflipped.

## On a phone

Most visitors arrive on a phone, so the phone is designed, not shrunk. The whole
contract lives in `src/styles/mobile.css` (scoped to `<= 767px`) so it can be
read and audited in one place.

- **The entrance is one gesture.** The preloader paints the same violet aurora
  the hero is built from, behind the sand word; when the pour finishes, the
  curtain lifts and the headline rises in the same beat, so the page ends the
  entrance in a dissolve rather than a cut. On a phone the pour is 1.25 s
  instead of 1.85 s, and the chrome is cut to one line.
- **The first screen fits.** One screen minus a deliberate peek at the ticker,
  so the phone never shows a wall it has to break through before the page
  starts.
- **A dock instead of a disappearing header.** Once the hero is behind you, a
  slim pill at the bottom carries the current chapter (Roman numeral + name,
  tapping it opens the index), the page progress along its rim, and the one
  action the studio wants. It never appears over the hero or over the closing
  CTA.
- **It behaves like an app, not a web page.** `viewport-fit=cover` with
  `env(safe-area-inset-*)` on every fixed surface, a 62 px bar, ≥ 44 px tap
  targets, `touch-action: manipulation`, press states instead of hover states,
  `overscroll-behavior-y: contain` so a pull cannot reload the page, and 16 px
  form fields so iOS never zooms on focus.
- **The order form is a bottom sheet** with a grab handle and a spring-up
  entrance; on a phone the keyboard is not summoned until the reader taps a
  field.
- **Data is respected.** The opening screen requests no media at all, so a
  metered phone pays nothing extra for the first impression.
- **No backdrop blur on a phone** (the header falls back to a 93 % pane, the
  sheet to 3 px): re-blurring a surface over content that moves is the most
  expensive thing a phone can do here.

- **The office plate is landscape** (a 6:5 crop of the night-light desk scene,
  sticky beside the reading column on desktop) and **re-lit for the palette**:
  the photograph is a night shot in the site's own violet, not a daylight photo
  dropped into a dark page.

`npm run mobile:check` runs the real Header, dock and preloader in jsdom at
390 × 844 and pins 40 of these behaviours, including that the dock stays out of
the tab order until it is on screen.

## Speed

The page is judged on how it feels while scrolling on a mid-range Windows
laptop and on a phone, not on how it looks in a screenshot. What that took:

- **Two permanent frame loops, deleted.** The custom cursor ran a
  `requestAnimationFrame` loop from first paint and never stopped, and the About
  plate did the same three screens before a reader arrives. Both now run only
  while something is actually moving (and the plate only while it is on screen),
  so the compositor can go idle and a phone can sleep.
- **The scroll frame measures nothing.** `scrollHeight`, `offsetTop` and up to
  six `getBoundingClientRect()` boxes used to be read inside the scroll frame —
  a forced synchronous relayout per scrolled frame. Positions are now measured
  when the layout actually changes (`utils/documentMetrics.ts`, a
  `ResizeObserver` on the body, the font-ready event) and read from memory;
  `rect-cache.ts` invalidates on scroll and measures on demand.
- **The pointer is applied once per frame.** The hero used to measure the canvas
  and do its work on *every* pointer event; at mouse polling rate that is
  thousands of layout reads a second. Events now stamp a position and the frame
  loop consumes it.
- **No full-screen blur anywhere it is not seen.** Eight decorative gaussian
  filters sat on top of radial gradients that were already smooth; the fixed
  header re-blurred the page under it on every scroll frame; the hero's grain
  was a `soft-light` blend over a canvas repainting at 60 fps. The gradients are
  now gradients, the header is a near-opaque pane at every width, and the grain
  is painted *under* the object so its blend is computed once.
- **The hero shader only shades the object.** Empty plate pixels used to run the
  four normal taps, the whole lighting model and the dispersion; they now skip
  it, which is coherent over large screen regions. On top of that the canvas is
  held to a **pixel budget** (≈4.6 M on desktop, 2.2 M on a phone) rather than a
  device-pixel-ratio cap, so a 2560 × 1440 display cannot ask a mid-range GPU
  for 15 M fragments a frame.
- **Compositor layers are handed back.** `will-change` is a promise that a layer
  is worth keeping; every revealed section used to keep its promise forever. A
  settled reveal now sets `will-change: auto`.
- **Below-the-fold photography is lazy** (`loading="lazy"`, intrinsic size, async
  decode), and the hero's height map has its own revalidated cache rule, because
  it is preloaded on every visit.

`npm run perf:check` tests all of it — including payload budgets for the entry
bundle, the stylesheet, the fonts and the hero texture — because none of this is
visible in a screenshot, which is exactly why it needs a test.

## Addresses

`src/content/defaults.ts` is the only place the studio's public identity lives:
`info@cahen.ir`, `t.me/CAHENWEB`, `instagram.com/CAHENWEB/` and a WhatsApp chat
at `wa.me/989023841612` (E.164 digits, no plus — that is what `wa.me` expects).
The email is rendered through `contact.email`, the channels through
`contact.socials`, so the menu, footer, contact section and 3D social visual can
never disagree.

`contact.phone` is deliberately empty: the number the studio shared is its
WhatsApp line, so it is published as a chat link rather than a dial-out number.
Fill the field in the panel if a `tel:` link should appear in the footer too.

A site published from the panel before these addresses existed still carries the
original placeholders (a `hello@cahen.studio` email and links to the platforms'
home pages). `src/content/normalize.ts` adopts the real values for those exact
strings only; anything an editor typed is left alone.

## Previewing what actually ships

`vite preview` serves `dist/` but knows nothing about `netlify.toml`: no
redirects, no `[[headers]]`, and therefore no Content-Security-Policy. A page
can look perfect there and come up black in production.

```bash
npm run build
node scripts/serve-netlify.mjs 4180   # same rules, same MIME types, same CSP
```

That server reads the same file the deploy reads and applies Netlify's
semantics (a real file wins unless a rule is forced, `404` rules carry their
own status and type, `[[headers]]` layer over the response). If a page works
here, the deploy has nothing left to surprise it with.

The particle mark is the reason this exists: it is built from an inline `data:`
payload, and `fetch()` of that payload is refused by `connect-src 'self'`. In
dev there is no CSP header, so the bug was invisible; in production the loader
threw and the mark quietly fell back to a flat image. `npm run mark:check`
pins the rule — inline payloads are decoded through an `<img>`, never fetched —
and checks the shipped chunk still does it.

## Routing (read this before editing `netlify.toml`)

Netlify serves a static file **unless** a redirect claims the path with
`force = true`. That one word took the site down: two catch-all 404 rules were
written with `force`, so every request under `/assets` and `/fonts` — the
stylesheet, the entry script and both typefaces — was answered with
`/404.html` and a 404. The browser reported it as *“Refused to apply style …
MIME type ('text/html')”*, and because the entry script was 404ing too, the page
rendered nothing: a black screen.

The rules are now unforced. A file that exists is always served as itself; the
rule only catches a path that really is missing. `npm run routing:check` parses
`netlify.toml`, applies Netlify's shadowing semantics to the actual `dist/`
tree, and fails if any built file would not be served as itself, if
`/shenataisoni` or `/api/*` stopped routing, or if a missing asset started
returning the shell.

## Delivery

The site is measured, not assumed. `npm run product:check` runs against the real
`dist/` and fails the release if any of this drifts:

| | |
|---|---|
| **One scroll listener** | every piece of chrome used to install its own `scroll` + RAF; `src/utils/scrollFrame.ts` is now the only one, passive, visibility-aware, and it hands every subscriber the same already-read `scrollY` |
| **First payload** | entry JS < 130 KB gzip, CSS < 45 KB gzip, no image over 60 KB, no font over 60 KB, nothing base64'd into the bundle |
| **Fonts** | four files (Estedad Arabic + Latin, JetBrains Mono Latin, Instrument Serif roman + italic) served from `/fonts` with a one-year immutable cache and `preload` on the Persian cut; the 16-file font packages are no longer imported, and Vazirmatn/Space Grotesk were removed entirely |
| **Images** | every photograph is WebP (1 MB → 236 KB for the whole asset folder); the brand mark is a violet 400 px WebP instead of a 377 KB PNG |
| **The opening screen** | one 86 KB height map (39 KB on a phone) and one shader pass — no video, no 3D engine, no post-processing chain |
| **The entrance** | finishes when the typeface is in — floor 0.9–1.1 s, ceiling 1.7–1.95 s — instead of always pouring for the full duration |
| **The 3D layer** | glTF/Draco loaders are dynamically imported only if a model is requested; the site renders its mark from an image, so ~700 KB never ships on first load |
| **Admin CSS** | the control room's stylesheet is a lazy chunk (35 KB), not part of the public first paint |

And the product surface:

- a 1200 × 630 social card built from the studio's own night frame
- a violet app icon in 48/180/192/512 px, plus an `apple-touch-icon`
- `ProfessionalService` structured data with the real email, channels and city
- canonical URL, `og:locale`, image dimensions and alt text
- a Persian, on-brand `404.html` with `noindex`
- `robots.txt` that keeps `/shenataisoni` and `/api/` out of the index, and a
  `sitemap.xml` that lists only the public page
- a `<noscript>` line with the studio's email and channels
- security headers (CSP, HSTS, frame-ancestors, permissions) and cache policy
  per path: immutable for assets and fonts, revalidate for the shell, `no-store`
  for the control room

## Glass

Every card is cut from one pane (`src/styles/glass.css`): a translucent violet
tint, a lit rim, an inner glow, and one diagonal reflection laid *under* the
content with `z-index: -1` inside an `isolation: isolate` stacking context.

The blur is deliberate: the dialog, the dock and back-to-top always blur; cards
blur only on `(hover: hover) and (pointer: fine)` at ≥ 900 px, and the carousel
card never does — a backdrop filter re-runs on every frame the page moves, which
is exactly what made the hero feel broken before. On a phone the pane is still
glass through tint, rim, glow and reflection, at no per-frame cost.

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

Ten checks run entirely offline:

- `npm run hero:check` — 88 assertions: the shaders parse and are not truncated; the mark is upright (one `-q.y`, in the shared projection, upload unflipped); normals, key light, specular and fresnel are present; the pointer, the shockwaves and the fragment share one projection, and a real `pointerdown` reaches the GPU as a lens and a ring buffer entry; passive listeners only; raw WebGL2 with logged shader errors, a reduced tier, one frame for reduced motion, and a loop that halts when hidden; no video and no media request; nothing pinned; a scroll re-renders nothing and writes only transform and opacity.
- `npm run mobile:check` — 51 assertions: the dock exists, arrives after the hero, opens the index and the sheet; the entrance paints the same light as the hero; safe areas, the 62 px bar, the bottom sheet and 16 px fields are present; no blur on a phone.
- `npm run content:check` — 24 assertions: the published email, Telegram channel, Instagram profile and WhatsApp number; every channel has a glyph; no component hardcodes an address; and a site published with the old placeholder addresses adopts the real ones without overwriting anything an editor typed.
- `npm run admin:check` — 63 assertions over the API and the security model.
- `npm run sms:check` — 21 assertions: order storage and Melipayamak formatting with a stubbed provider.
- `npm run netlify:check` — 23 assertions: bundles both functions with esbuild and exercises them against a mock Netlify Blobs edge API.
- `npm run mark:check` — 37 assertions: the particle mark is decoded from an inline payload instead of fetched (the CSP refusal that hid it), the phone budget, and the case-study card.
- `npm run product:check` — 65 assertions on the built output: payload budgets, font and image weight, the single scroll listener, metadata, icons, structured data, 404, sitemap, robots, cache and security headers, focus states, reduced motion, alt text and one `<h1>`.
- `npm run perf:check` — 31 assertions on speed: no idle frame loops, no layout
  reads in the scroll frame, no decorative gaussian filters, an opaque header, a
  lazy grid, a pixel budget on the hero, a bounded `will-change` count, and
  gzipped budgets for the entry bundle (< 125 kB), the stylesheet (< 30 kB), the
  fonts and the hero texture.
- `npm run typecheck` — the TypeScript build, also part of `npm run build`.

All of them run in `npm run verify`.


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
