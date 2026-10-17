# CAHEN Digital Studio

A responsive, Persian-first portfolio website for the CAHEN design and digital team. Built with React, TypeScript, Vite, Tailwind CSS 4, and Lucide icons.

## Development

```bash
npm ci
npm run dev
```

Create a production build with `npm run build`; run the TypeScript check on its own with `npm run typecheck`.

## Content and visual identity

- Page copy, navigation, services, process steps, and selected projects live in `src/data.ts`.
- Theme tokens and responsive component styling live in `src/index.css`.
- The selected work currently uses **concept** visuals. Replace the images and case-study copy in `src/data.ts` with CAHEN's approved project material before publishing it as client work.
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
