/**
 * How the particle system is allowed to read its asset.
 *
 * An asset arrives either as a URL the browser can fetch (`/assets/mark.webp`)
 * or as an inline payload the page already holds (`data:`, `blob:`). The two
 * must not be read the same way.
 *
 * The site ships a strict Content Security Policy — `connect-src 'self'` — and
 * `'self'` matches only network schemes. `fetch()` of a `data:` or `blob:` URL
 * is therefore refused by the browser, even though the same payload is a
 * perfectly legal `<img src>` under `img-src 'self' data: blob:`. That refusal
 * is what silently kept the particle mark from ever appearing in production
 * while it worked in dev (dev serves no CSP header): the loader threw, the
 * component fell back to the flat mark, and nothing on screen said why.
 *
 * Inline payloads are decoded straight from an <img>, which the policy allows;
 * only real URLs go through `fetch`.
 */
export function isInlineImageSrc(src: string): boolean {
  // eslint-disable-next-line no-control-regex
  const value = src.trim();
  return /^(?:data|blob):/i.test(value);
}

/** True when the bytes must be fetched over the network. */
export function needsNetworkFetch(src: string): boolean {
  return !isInlineImageSrc(src);
}
