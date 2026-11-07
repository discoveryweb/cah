#!/usr/bin/env node
/**
 * Which surface does a themed component actually get?
 *
 * The cascade is not readable by eye once a design has three skins (semantic
 * tokens, the glass layer, the daylight layer) and two of them are scoped by an
 * attribute. A rule that forgets `[data-theme="light"]` does not look wrong in
 * the source: it looks like the dark rule, and it silently wins in both themes
 * because it is the more specific one, or because it is the only one.
 *
 * This reads the built stylesheet, resolves the cascade for the surfaces that
 * carry the theme — the header bar and its pill, the mobile dock, the full
 * screen menu — in both themes, at phone and desktop widths, on both
 * performance tiers, and asserts that the winning colour belongs to the theme
 * it claims to serve.
 *
 * `npm run theme:surface`.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DIST = path.join(ROOT, "dist");

const results = [];
const check = (label, ok, detail = "") => {
  results.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok || !detail ? "" : ` — ${detail}`}`);
};

if (!fs.existsSync(DIST)) {
  console.error("dist/ is missing — run `npm run build` first.");
  process.exit(1);
}

const cssFile = fs
  .readdirSync(path.join(DIST, "assets"))
  .filter((file) => file.endsWith(".css"))
  .sort((a, b) => fs.statSync(path.join(DIST, "assets", b)).size - fs.statSync(path.join(DIST, "assets", a)).size)[0];
const css = fs.readFileSync(path.join(DIST, "assets", cssFile), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/* ------------------------------------------------------------- stylesheet */

/**
 * Every flat declaration block, with its media and its cascade layer.
 *
 * Layers decide precedence before specificity does: an unlayered declaration
 * outranks every layered one. The entry sheet's `:root` is emitted unlayered
 * while the theme files sit in `@layer components`, so a token defined in both
 * places is a token whose day value can never win. Modelling this is the
 * difference between reading a colour and reading a wish.
 */
const layerOrder = new Map();
const layerOf = (name) => {
  if (!layerOrder.has(name)) layerOrder.set(name, layerOrder.size);
  return layerOrder.get(name);
};
const LAYER_UNLAYERED = 1000;

const rules = [];
const walk = (text, media, layer) => {
  let index = 0;
  while (index < text.length) {
    const brace = text.indexOf("{", index);
    if (brace < 0) break;
    const prelude = text.slice(index, brace).trim();
    let depth = 0;
    let end = brace;
    for (; end < text.length; end += 1) {
      if (text[end] === "{") depth += 1;
      else if (text[end] === "}") {
        depth -= 1;
        if (!depth) break;
      }
    }
    const body = text.slice(brace + 1, end);
    if (prelude.startsWith("@media")) walk(body, `${media ?? ""} ${prelude}`.trim(), layer);
    else if (prelude.startsWith("@layer")) {
      const name = prelude.slice(prelude.lastIndexOf("@layer") + 6).trim();
      // `@layer a, b, c;` only declares order; a bare `@layer { }` is anonymous.
      if (name) walk(body, media, name.split(/[\s;]+/)[0]);
      else walk(body, media, layer);
    } else if (prelude.startsWith("@")) walk(body, media, layer);
    else {
      for (const selector of prelude.split(",")) {
        rules.push({
          selector: selector.trim(),
          body,
          media: media ?? "",
          order: rules.length,
          layer: layer === undefined ? LAYER_UNLAYERED : layerOf(layer),
        });
      }
    }
    index = end + 1;
  }
};
walk(css, "", undefined);

const mediaMatches = (media, width) => {
  if (!media) return true;
  const checks = media.match(/\((?:max|min)-width:\s*[\d.]+px\)/g) ?? [];
  return checks.every((part) => {
    const max = /max-width:\s*([\d.]+)px/.exec(part);
    const min = /min-width:\s*([\d.]+)px/.exec(part);
    if (max) return width <= Number(max[1]);
    if (min) return width >= Number(min[1]);
    return true;
  });
};

/* --------------------------------------------------------------- matching */

/**
 * Specificity of a single selector, as (ids, classes, types).
 *
 * Only pseudo-*elements* are stripped. `:root` is a pseudo-class with the
 * weight of `[data-theme]`, and folding it away made `:root` score zero — the
 * gate then claimed a bare `[data-theme="light"]` block beat the night
 * defaults it actually ties with and loses to on source order.
 */
const specificity = (selector) => {
  const bare = selector.replace(/::[a-z-]+(\([^)]*\))?/gi, "");
  const ids = (bare.match(/#[\w-]+/g) ?? []).length;
  const classes = (bare.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[a-z-]+/g) ?? []).length;
  const types = (bare.match(/(?:^|[\s>+~])([a-z][\w-]*)/gi) ?? []).length;
  return ids * 1e4 + classes * 100 + types;
};

/** One compound selector — `div.a[data-theme=light]:not(.b)` — against one element. */
const compoundMatches = (compound, element) => {
  let rest = compound.trim();
  const type = /^([a-z][\w-]*|\*)/i.exec(rest);
  if (type) {
    if (type[1] !== "*" && type[1].toLowerCase() !== element.tag) return false;
    rest = rest.slice(type[1].length);
  }
  const parts = rest.match(/(\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+(?:\([^)]*\))?)/g) ?? [];
  return parts.every((part) => {
    if (part.startsWith(".")) return element.classes.includes(part.slice(1));
    if (part.startsWith(":not(")) {
      const inner = part.slice(5, -1).trim();
      return !compoundMatches(inner, element);
    }
    if (part.startsWith(":")) return true; // :hover, :focus-visible, :root … not asserted here
    const attr = /^\[\s*([\w-]+)\s*(?:([~|^$*]?=)\s*["']?([^"'\]]*)["']?)?\s*\]$/.exec(part);
    if (!attr) return false;
    const [, name, operator, value] = attr;
    const actual = element.attributes[name];
    if (operator === undefined) return actual !== undefined;
    if (actual === undefined) return false;
    return operator === "=" ? actual === value : actual.includes(value);
  });
};

/**
 * Does `selector` match the chain, ending at its last element?
 *
 * The rightmost compound is the subject and must match the subject element —
 * without that, `html[data-theme=light] body` "matched" a header pill and every
 * light-theme surface was judged against the page background instead of itself.
 */
const selectorMatches = (selector, chain) => {
  const compounds = selector.replace(/\s*>\s+/g, " ").split(/\s+/).filter(Boolean);
  if (!compoundMatches(compounds[compounds.length - 1], chain[chain.length - 1])) return false;
  let cursor = chain.length - 2;
  for (let i = compounds.length - 2; i >= 0; i -= 1) {
    let found = -1;
    for (let j = cursor; j >= 0; j -= 1) {
      if (compoundMatches(compounds[i], chain[j])) {
        found = j;
        break;
      }
    }
    if (found < 0) return false;
    cursor = found - 1;
  }
  return true;
};

const element = (tag, classes, attributes = {}) => ({
  tag,
  classes: classes.split(/\s+/).filter(Boolean),
  attributes,
});

/* --------------------------------------------------------------- colours */

/**
 * Custom properties resolve before a colour exists, so the token a surface
 * points at is read too — from the root, the site wrapper and the two theme
 * bands, in cascade order. Without this, a token-driven surface would look
 * like an unreadable value instead of a colour that belongs to a theme.
 */
const tokensFor = (theme) => {
  const map = new Map();
  // The token layer is read against the elements that can carry one: the root
  // (which is `:root` or `html[data-theme]`), the body, and the site wrapper.
  // Matching for real, rather than looking for an attribute name, is what tells
  // `html:not([data-theme])` — the daylight fallback — from the night defaults.
  const root = [element("html", "", { "data-theme": theme }), element("body", ""), element("div", "site")];
  // A token is inherited: it counts when it is declared on the element itself
  // or on any ancestor, so the selector is matched against every prefix of the
  // chain and not only against its subject.
  const declaresOnChain = (selector) => root.some((_, index) => selectorMatches(selector, root.slice(0, index + 1)));
  for (const rule of rules) {
    if (!/(^|,)\s*(:root|html|\.site|\.theme-ink|\.theme-paper|\[data-theme)/.test(rule.selector)) continue;
    if (!declaresOnChain(rule.selector)) continue;
    for (const match of rule.body.matchAll(/--([\w-]+)\s*:\s*([^;]+)/g)) {
      const score = rule.layer * 1e9 + specificity(rule.selector) * 1000 + rule.order;
      const previous = map.get(match[1]);
      if (!previous || score >= previous.score) map.set(match[1], { value: match[2].trim(), score });
    }
  }
  return map;
};

const resolveVars = (value, tokens, depth = 0) => {
  if (depth > 6 || !value.includes("var(")) return value;
  return value.replace(/var\(\s*--([\w-]+)\s*(?:,\s*([^)]*))?\)/g, (_full, name, fallback) => {
    const hit = tokens.get(name);
    return hit ? resolveVars(hit.value, tokens, depth + 1) : (fallback ?? "");
  });
};

/** The first opaque colour a value paints, as `[r, g, b]`. */
const firstColour = (value) => {
  const source = String(value).trim();
  const hex = /#([0-9a-f]{3,8})\b/i.exec(source);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3) digits = [...digits].map((d) => d + d).join("");
    if (digits.length >= 6) {
      return [parseInt(digits.slice(0, 2), 16), parseInt(digits.slice(2, 4), 16), parseInt(digits.slice(4, 6), 16)];
    }
  }
  const rgb = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(source);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  const named = /color-mix\([^)]*?(#[0-9a-f]{3,8}|rgba?\([^)]*\))/i.exec(source);
  if (named) return firstColour(named[1]);
  return null;
};

const relativeLuminance = ([r, g, b]) => {
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/**
 * The winning background for a surface in a given state, plus what won it.
 * `transparent` counts as nothing painted: the ground below shows through, so
 * the surface is only judged when it actually paints.
 */
const winner = (chain, { theme, perf, width }, properties = ["background", "background-color"]) => {
  let best = null;
  for (const rule of rules) {
    if (!mediaMatches(rule.media, width)) continue;
    // A pseudo-element is ornament on top of the surface — the glow behind the
    // menu is not the menu, and it is not what the reader reads type against.
    // The minifier writes `::before` as `:before`; scrollbar and other vendor
    // pseudo-elements are decorations on someone else's box, not this surface.
    if (/::|:-[a-z]|:(before|after|marker|placeholder|selection|backdrop)\b/.test(rule.selector)) continue;
    if (!selectorMatches(rule.selector, chain)) continue;

    // A rule scoped to the other theme cannot win here.
    const themeMatch = /\[data-theme=["']?([\w-]+)["']?\]/.exec(rule.selector);
    if (themeMatch && themeMatch[1] !== theme) continue;
    const perfMatch = /\[data-perf=["']?([\w-]+)["']?\]/.exec(rule.selector);
    if (perfMatch && perfMatch[1] !== perf) continue;

    for (const property of properties) {
      const declaration = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i").exec(rule.body);
      if (!declaration) continue;
      const score = rule.layer * 1e9 + specificity(rule.selector) * 1000 + rule.order;
      if (!best || score >= best.score) {
        best = { score, value: declaration[1].trim(), property, selector: rule.selector };
      }
    }
  }
  if (!best) return null;
  if (/^(transparent|none|0 0|initial)$/i.test(best.value)) return null;
  return best;
};

/* ---------------------------------------------------------------- states */

const chainFor = ({ theme, perf, scrolled, invert, surface }) => {
  const attributes = { "data-theme": theme, "data-perf": perf === "low" ? "low" : undefined };
  const html = element("html", "", attributes);
  const body = element("body", "", {});
  const headerClasses = ["header", scrolled ? "header--solid" : "", invert ? "header--invert" : "", "header--ready"]
    .filter(Boolean)
    .join(" ");
  if (surface === "pill") return [html, body, element("header", headerClasses), element("div", "frame header__inner")];
  if (surface === "bar") return [html, body, element("header", headerClasses)];
  if (surface === "dock") return [html, body, element("nav", "dock dock--in")];
  return [html, body, element("div", "menu")];
};

const states = [];
for (const theme of ["light", "dark"]) {
  for (const perf of ["full", "low"]) {
    for (const width of [390, 900, 1440]) {
      for (const scrolled of [false, true]) {
        for (const invert of [false, true]) {
          states.push({ theme, perf, width, scrolled, invert });
        }
      }
    }
  }
}

const tokensByTheme = { light: tokensFor("light"), dark: tokensFor("dark") };

const judge = (surface, state) => {
  const resolved = winner(chainFor({ ...state, surface }), state);
  if (!resolved) return { ok: true, note: "paints nothing" };
  const value = resolveVars(resolved.value, tokensByTheme[state.theme]);
  const colour = firstColour(value);
  if (!colour) return { ok: false, note: `unreadable value: ${value}` };
  const luminance = relativeLuminance(colour);
  const wantsLight = state.theme === "light";
  // Deliberately loose: a surface only has to belong to its theme, not match a
  // palette value — the design can change, a wrong-way bar cannot come back.
  const ok = wantsLight ? luminance > 0.45 : luminance < 0.3;
  return {
    ok,
    note: `${value} (luminance ${luminance.toFixed(2)}, from \`${resolved.selector}\`)`,
  };
};

if (process.argv.includes("--report")) {
  console.log("\nResolved chrome surfaces (winning declaration, per theme)\n");
  for (const surface of ["pill", "bar", "dock", "menu"]) {
    for (const theme of ["light", "dark"]) {
      for (const width of [390, 1440]) {
        const state = { theme, perf: "full", width, scrolled: true, invert: false };
        const hit = winner(chainFor({ ...state, surface }), state);
        const value = hit ? resolveVars(hit.value, tokensByTheme[theme]) : "—";
        console.log(`${surface.padEnd(5)} ${theme.padEnd(5)} ${String(width).padEnd(5)} ${value.slice(0, 78)}  ${hit ? `<${hit.selector}>` : ""}`);
      }
    }
  }
  console.log("");
}

/* --------------------------------------------------------------- asserts */

for (const surface of ["pill", "bar", "dock", "menu"]) {
  for (const theme of ["light", "dark"]) {
    const failing = [];
    for (const state of states.filter((entry) => entry.theme === theme)) {
      const verdict = judge(surface, state);
      if (!verdict.ok) {
        failing.push(`${state.width}px/${state.perf}${state.scrolled ? "/scrolled" : ""}${state.invert ? "/invert" : ""}: ${verdict.note}`);
      }
    }
    const label =
      surface === "pill"
        ? `the header pill takes the ${theme} theme at every width and tier`
        : surface === "bar"
          ? `the header bar takes the ${theme} theme at every width and tier`
          : surface === "dock"
            ? `the phone dock takes the ${theme} theme`
            : `the full-screen menu takes the ${theme} theme`;
    check(label, failing.length === 0, failing.slice(0, 3).join(" | "));
  }
}

/* The scrolled bar is a surface of its own: it is what a reader sees once the
   page moves, and it used to be painted for the dark theme only. */
for (const theme of ["light", "dark"]) {
  const state = { theme, perf: "full", width: 390, scrolled: true, invert: false };
  const resolved = winner(chainFor({ ...state, surface: "bar" }), state);
  check(
    `the scrolled header bar is scoped to the ${theme} theme`,
    !resolved || !/\[data-theme/.test(resolved.selector) || resolved.selector.includes(theme),
    resolved?.selector ?? "none",
  );
}

/* ------------------------------------------------ the text on the surface */

/**
 * A bar of the wrong brightness is obvious; dark type on it is worse. The
 * header's own colour is resolved the same way and held to a readable contrast
 * against whatever the pill ends up painting.
 */
const contrast = (a, b) => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

for (const theme of ["light", "dark"]) {
  for (const scrolled of [false, true]) {
    const state = { theme, perf: "full", width: 390, scrolled, invert: false };
    const chain = chainFor({ ...state, surface: "bar" });
    const background = winner(chain, state);
    const text = winner(chain, state, ["color"]);
    const backgroundValue = background ? firstColour(resolveVars(background.value, tokensByTheme[theme])) : null;
    const textValue = text ? firstColour(resolveVars(text.value, tokensByTheme[theme])) : null;
    // The bar is transparent until it is scrolled: the pill underneath is the
    // ground then, and the pill is the same token the text was designed against.
    const ground =
      backgroundValue ?? firstColour(resolveVars(tokensByTheme[theme].get("chrome-pill")?.value ?? "", tokensByTheme[theme]));
    const ratio = ground && textValue ? contrast(textValue, ground) : 0;
    check(
      `the header text is readable on the ${theme} bar${scrolled ? " once scrolled" : ""}`,
      ratio >= 4.5,
      `${ratio.toFixed(2)}:1 · text ${textValue?.join(",") ?? "?"} on ${ground?.join(",") ?? "?"}`,
    );
  }
}

/* ------------------------------------------------- the rule that keeps it */

/**
 * The bug this gate exists for began as a literal: `background: #07071a` on a
 * chrome surface, written once for the dark theme and then inherited by every
 * other one. So the source is read too, and the chrome is only allowed to paint
 * the tokens above.
 */
const CHROME = [".header", ".header--solid", ".header--inner", ".header__inner", ".dock", ".rail", ".menu"];
const styles = fs
  .readdirSync(path.join(ROOT, "src", "styles"))
  .filter((file) => file.endsWith(".css"))
  .map((file) => [file, fs.readFileSync(path.join(ROOT, "src", "styles", file), "utf8")]);

const literalChrome = [];
for (const [file, source] of styles) {
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim();
    const body = match[2];
    const targets = selector
      .split(",")
      .map((part) => part.trim())
      // A decorative pseudo-element (`.menu::before`) is not a surface, and a
      // state (`:hover`) is not a resting one.
      .filter((part) => !/::|:hover|:active|:focus|:not\(/.test(part))
      // Drop the scope a rule is nested under: theme, tier, ancestor.
      .map((part) => part.replace(/^.*\s/, ""))
      .filter((part) => CHROME.includes(part));
    if (!targets.length) continue;
    for (const declaration of body.matchAll(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/g)) {
      const value = declaration[1].trim();
      if (/^(transparent|none|0 0|inherit|initial)$/i.test(value)) continue;
      if (value.startsWith("var(--chrome-")) continue;
      literalChrome.push(`${file} · ${targets[0]} → ${value.slice(0, 48)}`);
    }
  }
}
check(
  "no chrome surface is painted with a literal colour",
  literalChrome.length === 0,
  literalChrome.join(" | "),
);

const lightSource = fs.readFileSync(path.join(ROOT, "src", "styles", "light.css"), "utf8");
const chromeTokens = [
  "--chrome-bar",
  "--chrome-pill",
  "--chrome-pill-opaque",
  "--chrome-pill-mobile",
  "--chrome-dock",
  "--chrome-rail",
  "--chrome-menu",
  "--chrome-sheen",
];
/** The one block in daylight that defines the chrome tokens, whatever its selector. */
const daylightBlock = [...lightSource.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter(([, selector]) => /html\[data-theme="light"\]/.test(selector))
  .map(([, , body]) => body)
  .find((body) => body.includes("--chrome-")) ?? "";
check(
  "daylight redefines every chrome token",
  chromeTokens.every((token) => daylightBlock.includes(`${token}:`)),
  chromeTokens.filter((token) => !daylightBlock.includes(`${token}:`)).join(" "),
);
check(
  "the daylight tokens outrank the night defaults",
  // `:root` sets the night values at the same weight as a bare attribute
  // selector and is emitted later, so daylight must name the element too.
  /html\[data-theme="light"\][^{]*\{[^}]*--chrome-/.test(lightSource) && !/(^|,)\s*\[data-theme="light"\]\s*\{[^}]*--chrome-/.test(lightSource),
);

const failed = results.filter((item) => !item.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} theme surface checks passed` +
    (failed.length ? `\n\nFailed: ${failed.map((item) => item.label).join("; ")}` : ""),
);
process.exit(failed.length ? 1 : 0);
