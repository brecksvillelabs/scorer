import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gameLogLabel, removeHistoryEntry, sortHistory } from '../v032-core.js';

test('games log deletion removes only the selected match', () => {
  const history = [
    { matchId: 'a', title: 'A vs B' },
    { matchId: 'b', title: 'C vs D' }
  ];
  assert.deepEqual(removeHistoryEntry(history, 'a').map(x => x.matchId), ['b']);
});

test('games log sorts newest match first', () => {
  const history = [
    { matchId: 'old', updatedAt: 10 },
    { matchId: 'new', updatedAt: 30 },
    { matchId: 'mid', updatedAt: 20 }
  ];
  assert.deepEqual(sortHistory(history).map(x => x.matchId), ['new', 'mid', 'old']);
});

test('games log label includes score when available', () => {
  assert.equal(gameLogLabel({ title: 'Bees vs NR', score: '2-0 sets' }), 'Bees vs NR · 2-0 sets');
});

test('photo persistence keeps decoder and original-file fallbacks', async () => {
  const source = await readFile(new URL('../journal.js', import.meta.url), 'utf8');
  assert.match(source, /decodeBitmap/);
  assert.match(source, /decodeHtmlImage/);
  assert.match(source, /originalFallback/);
  assert.match(source, /tx\.oncomplete\s*=\s*\(\)\s*=>\s*resolve/);
});
