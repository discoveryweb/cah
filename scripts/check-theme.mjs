/** Lightweight regression checks for first-paint theme selection and effects. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const init = read('public/theme-init.js');
function initialTheme(saved, systemLight, storageDenied = false) {
  const document = { documentElement: { dataset: {} }, querySelector: () => null };
  const localStorage = { getItem: () => { if (storageDenied) throw new Error('denied'); return saved; } };
  vm.runInNewContext(init, { document, localStorage, window: { matchMedia: () => ({ matches: systemLight }) } });
  return document.documentElement.dataset.theme;
}
assert.equal(initialTheme(null, true), 'light');
assert.equal(initialTheme(null, false), 'light');
assert.equal(initialTheme('dark', true), 'dark');
assert.equal(initialTheme('light', false), 'light');
assert.equal(initialTheme('invalid', true), 'light');
assert.equal(initialTheme(null, true, true), 'light');
const html = read('index.html');
assert.ok(html.indexOf('/theme-init.js') !== -1 && html.indexOf('/theme-init.js') < html.indexOf('src="/src/main.tsx"'));
const app = read('src/App.tsx');
assert.match(app, /<SurfacePhysics\s*\/>/);
assert.match(app, /<MotionLab\s*\/>/);
assert.doesNotMatch(app, /<Cursor\s*\/>/);
const surface = read('src/components/SurfacePhysics.tsx');
assert.match(surface, /feDisplacementMap/);
assert.match(surface, /pointerdown/);
assert.match(surface, /prefers-reduced-motion/);
assert.match(surface, /maxWaves = 3/);
assert.doesNotMatch(read('src/styles/liquid.css'), /water-ripple/);
assert.match(read('src/styles/light.css'), /data-theme="light"/);
console.log('Theme initialization, light palette, native cursor and bounded surface-displacement checks passed');
