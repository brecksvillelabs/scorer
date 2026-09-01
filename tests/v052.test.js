import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeTheme, resolveTheme, THEME_OPTIONS } from '../theme.js';

test('v0.5.2 appearance preferences normalize and resolve deterministically', () => {
  assert.deepEqual(THEME_OPTIONS, ['system', 'light', 'dark']);
  assert.equal(normalizeTheme('light'), 'light');
  assert.equal(normalizeTheme('dark'), 'dark');
  assert.equal(normalizeTheme('unexpected'), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
  assert.equal(resolveTheme('system', true), 'dark');
});

test('v0.5.2 exposes an accessible persistent appearance picker', async () => {
  const [html, css, sw] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../theme.css', import.meta.url), 'utf8'),
    readFile(new URL('../sw.js', import.meta.url), 'utf8')
  ]);
  for (const value of ['system', 'light', 'dark']) {
    assert.match(html, new RegExp(`data-theme-choice="${value}"`));
  }
  assert.match(html, /id="appearanceCurrent"/);
  assert.match(html, /theme\.css/);
  assert.match(html, /theme\.js/);
  assert.match(css, /html\[data-theme="light"\]/);
  assert.match(sw, /scorer-v0\.5\.2/);
  assert.match(sw, /theme\.css/);
  assert.match(sw, /theme\.js/);
});

test('v0.5.2 carries the new Scorer mark into web and Android launch assets', async () => {
  const [svg, launcher, notification, html] = await Promise.all([
    readFile(new URL('../assets/app-icon.svg', import.meta.url), 'utf8'),
    readFile(new URL('../android/app/src/main/res/drawable/ic_launcher.xml', import.meta.url), 'utf8'),
    readFile(new URL('../android/app/src/main/res/drawable/ic_stat_scorer.xml', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8')
  ]);
  assert.match(svg, /abstract S/i);
  assert.match(svg, /#FF624A/i);
  assert.doesNotMatch(svg, />8<|>6</);
  assert.match(launcher, /#2DD4BF/);
  assert.match(launcher, /#6366F1/);
  assert.match(notification, /viewportWidth="512"/);
  assert.match(html, /brand-icon/);
});

test('v0.5.2 increments the web and Android release identities', async () => {
  const [version, pkg, gradle] = await Promise.all([
    readFile(new URL('../VERSION', import.meta.url), 'utf8'),
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
    readFile(new URL('../android/app/build.gradle', import.meta.url), 'utf8')
  ]);
  assert.equal(version.trim(), '0.5.2');
  assert.equal(JSON.parse(pkg).version, '0.5.2');
  assert.match(gradle, /versionCode 502/);
  assert.match(gradle, /versionName "0\.5\.2"/);
});
