import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('UX QC: Baseball modules are loaded by the app and cached offline', () => {
  const app = read('app.js');
  const sw = read('sw.js');
  assert.match(app, /from '\.\/baseball-core\.js'/);
  assert.match(app, /from '\.\/baseball-ui\.js'/);
  assert.match(sw, /\.\/baseball-core\.js/);
  assert.match(sw, /\.\/baseball-ui\.js/);
});

test('UX QC: obsolete v035 DOM patch is no longer loaded or cached', () => {
  const html = read('index.html');
  const sw = read('sw.js');
  const pkg = read('package.json');
  assert.doesNotMatch(html, /v035\.js/);
  assert.doesNotMatch(sw, /v035\.js/);
  assert.doesNotMatch(pkg, /node --check v035\.js/);
});

test('UX QC: saved favorite logos are wired to real file inputs', () => {
  const enhancements = read('enhancements.js');
  assert.match(enhancements, /inputLogoA:\s*\$\('inputLogoA'\)/);
  assert.match(enhancements, /inputLogoB:\s*\$\('inputLogoB'\)/);
  assert.match(enhancements, /input\.dispatchEvent\(new Event\('change'/);
});

test('UX QC: History has display names for all three new sports', () => {
  const enhancements = read('enhancements.js');
  assert.match(enhancements, /lacrosse:\s*'Lacrosse'/);
  assert.match(enhancements, /kabaddi:\s*'Kabaddi'/);
  assert.match(enhancements, /baseball:\s*'Baseball'/);
});

test('UX QC: setup remains scrollable and sport grid collapses for phones', () => {
  const css = read('styles.css');
  assert.match(css, /\.setup-modal\{[^}]*max-height:92vh;overflow:auto/);
  assert.match(css, /@media\(max-width:420px\)[\s\S]*\.sport-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test('UX QC: compact mobile controls receive at least 44px release overrides', () => {
  const css = read('v035.css');
  assert.match(css, /\.icon-btn\{width:44px;min-height:44px\}/);
  assert.match(css, /\.mini-btn\{min-height:44px\}/);
});

test('UX QC: entire game surface is not a noisy live region', () => {
  const html = read('index.html');
  assert.match(html, /<main id="gameSurface" class="game-surface"><\/main>/);
  assert.doesNotMatch(html, /gameSurface[^>]*aria-live/);
  assert.match(html, /id="toast" role="status"/);
});

test('UX QC: sport-specific Journal context covers Lacrosse, Kabaddi and Baseball', () => {
  const journal = read('journal.js');
  assert.match(journal, /state\.sport === 'lacrosse'/);
  assert.match(journal, /state\.sport === 'kabaddi'/);
  assert.match(journal, /state\.sport === 'baseball'/);
  assert.match(journal, /B-S-O/);
});
