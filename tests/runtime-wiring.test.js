import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Runtime QC: Cricket Gold UI is loaded by the page and cached offline', () => {
  const html = read('index.html');
  const sw = read('sw.js');
  assert.match(html, /<script type="module" src="\.\/cricket-gold\.js"><\/script>/);
  assert.match(sw, /\.\/cricket-gold\.js/);
  assert.match(sw, /\.\/cricket-gold-core\.js/);
});

test('Runtime QC: Display exit control is fixed to the center bottom', () => {
  const html = read('index.html');
  const css = read('layout-fixes.css');
  const sw = read('sw.js');
  assert.match(html, /href="\.\/layout-fixes\.css"/);
  assert.match(css, /\.exit-display\{[\s\S]*left:50%;[\s\S]*right:auto;[\s\S]*transform:translateX\(-50%\)/);
  assert.match(sw, /\.\/layout-fixes\.css/);
});
