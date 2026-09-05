import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Share Gold runtime is loaded by the app shell through the existing guard module', () => {
  const guard = read('v034-guard.js');
  assert.match(guard, /import '\.\/share-gold\.js';/);
});

test('Share Gold modules are cached for offline PWA use', () => {
  const sw = read('sw.js');
  assert.match(sw, /\.\/share-gold\.js/);
  assert.match(sw, /\.\/share-gold-core\.js/);
  assert.match(sw, /scorer-v0\.5\.2-share-gold/);
});

test('Share Gold modules are included in the permanent syntax gate', () => {
  const pkg = read('package.json');
  assert.match(pkg, /node --check share-gold-core\.js/);
  assert.match(pkg, /node --check share-gold\.js/);
});
