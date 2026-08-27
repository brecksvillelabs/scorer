import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inferImageMime } from '../journal.js';
import { changeTimeout, timeoutLimit, timeoutStatus } from '../v037-core.js';

function stateFor(sport, bucket, extras = {}) {
  return {
    matchId: 'm1',
    sport,
    period: 1,
    eventSeq: 0,
    events: [],
    updatedAt: 1,
    volleyball: { timeouts: sport === 'volleyball' ? bucket : { A: 2, B: 2 } },
    basketball: { timeouts: sport === 'basketball' ? bucket : { A: 5, B: 5 } },
    football: { timeouts: sport === 'football' ? bucket : { A: 3, B: 3 } },
    lacrosse: { timeouts: sport === 'lacrosse' ? bucket : { A: 2, B: 2 }, timeoutsPerHalf: extras.timeoutsPerHalf ?? 2, discipline: extras.discipline || 'field' },
    kabaddi: { timeouts: sport === 'kabaddi' ? bucket : { A: 2, B: 2 }, timeoutsPerHalf: extras.timeoutsPerHalf ?? 2 }
  };
}

test('timeout can be explicitly restored but never above sport limit', () => {
  const used = stateFor('volleyball', { A: 1, B: 2 });
  const restored = changeTimeout(used, 'A', 1);
  assert.equal(restored.volleyball.timeouts.A, 2);
  assert.equal(restored.events.at(-1).type, 'timeout.restored');

  const capped = changeTimeout(restored, 'A', 1);
  assert.equal(capped.volleyball.timeouts.A, 2);
  assert.equal(capped.events.length, restored.events.length);
});

test('taking a timeout stops at zero and records remaining count', () => {
  const state = stateFor('football', { A: 1, B: 3 });
  const zero = changeTimeout(state, 'A', -1);
  assert.equal(zero.football.timeouts.A, 0);
  assert.equal(zero.events.at(-1).type, 'timeout.taken');
  assert.equal(zero.events.at(-1).remaining, 0);
});

test('timeout limits cover field and Sixes lacrosse plus kabaddi', () => {
  assert.equal(timeoutLimit(stateFor('lacrosse', { A: 2, B: 2 }, { timeoutsPerHalf: 2 })), 2);
  assert.equal(timeoutLimit(stateFor('lacrosse', { A: 1, B: 1 }, { timeoutsPerHalf: 1, discipline: 'sixes' })), 1);
  assert.equal(timeoutLimit(stateFor('kabaddi', { A: 2, B: 2 }, { timeoutsPerHalf: 2 })), 2);
  assert.deepEqual(timeoutStatus(stateFor('basketball', { A: 4, B: 5 })), { limit: 5, A: 4, B: 5 });
});

test('mobile camera files with blank MIME can be inferred from common image names', () => {
  assert.equal(inferImageMime({ type: '', name: 'IMG_20260826_205900.jpg' }), 'image/jpeg');
  assert.equal(inferImageMime({ type: '', name: 'photo.png' }), 'image/png');
  assert.equal(inferImageMime({ type: 'image/webp', name: 'camera.bin' }), 'image/webp');
});

test('top bar has a direct camera control separate from Game Diary', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const enhancements = await readFile(new URL('../enhancements.js', import.meta.url), 'utf8');
  assert.match(html, /id="quickCameraBtn"[^>]*>📷<\/button>/);
  assert.match(html, /id="journalBtn"[^>]*>📖<\/button>/);
  assert.match(html, /id="quickPhotoInput"[^>]*capture="environment"/);
  assert.match(enhancements, /quickCameraBtn\.addEventListener\('click', openQuickCamera\)/);
  assert.match(enhancements, /addMatchPhoto\(state\.matchId, file, matchContext\(state\), caption\)/);
});

test('photo persistence verifies write and does not depend on IDBKeyRange for match lookup', async () => {
  const source = await readFile(new URL('../journal.js', import.meta.url), 'utf8');
  assert.match(source, /const verified = await readPhoto\(item\.id\)/);
  assert.match(source, /index\('matchId'\)\.getAll\(matchId\)/);
  assert.doesNotMatch(source, /IDBKeyRange\.only\(matchId\)/);
});

test('timeout UI exposes remaining count and explicit restore action', async () => {
  const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(source, /data-action="restore-timeout"/);
  assert.match(source, /Timeout · \$\{side\} \(\$\{remaining\}\)/);
  assert.match(source, /changeTimeout\(state,side,1\)/);
});
