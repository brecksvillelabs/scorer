import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isRecoverablePhoto, recoveryBounds } from '../v038-core.js';
import { matchContext } from '../journal.js';

test('recovery only claims same sport and matchup inside the game window', () => {
  const summary = {
    matchId: 'current',
    sport: 'volleyball',
    title: 'Home vs Away',
    startedAt: 1_000_000,
    updatedAt: 1_200_000,
    finished: false
  };
  const photo = {
    id: 'old-photo',
    matchId: 'orphan',
    createdAt: 1_050_000,
    context: { sport: 'volleyball', title: 'Home vs Away' }
  };
  assert.equal(isRecoverablePhoto(photo, summary, 1_300_000), true);
  assert.equal(isRecoverablePhoto({ ...photo, context: { sport: 'basketball', title: 'Home vs Away' } }, summary, 1_300_000), false);
  assert.equal(isRecoverablePhoto({ ...photo, createdAt: 1000 }, summary, 1_300_000), false);
});

test('explicit context matchId is authoritative for recovery', () => {
  const summary = { matchId: 'm2', sport: 'soccer', title: 'A vs B', startedAt: 1000, updatedAt: 2000 };
  assert.equal(isRecoverablePhoto({ matchId: 'wrong', context: { matchId: 'm2' } }, summary, 2000), true);
  assert.equal(isRecoverablePhoto({ matchId: 'wrong', context: { matchId: 'm3', sport: 'soccer', title: 'A vs B' }, createdAt: 1500 }, summary, 2000), false);
});

test('active recovery window has a small pregame and post-now cushion', () => {
  const bounds = recoveryBounds({ startedAt: 1_000_000, updatedAt: 1_100_000, finished: false }, 1_200_000);
  assert.equal(bounds.start, 880_000);
  assert.equal(bounds.end, 2_100_000);
});

test('photo context now includes the canonical match id', () => {
  const state = {
    matchId: 'm-camera',
    sport: 'volleyball',
    period: 1,
    teamA: { name: 'Home', score: 9 },
    teamB: { name: 'Away', score: 2 },
    volleyball: { setHistory: [], servingTeam: 'A' },
    clock: { mode: 'none', seconds: 0 }
  };
  const context = matchContext(state);
  assert.equal(context.matchId, 'm-camera');
  assert.equal(context.score, '9-2');
});

test('both live toolbar and diary photo buttons use the in-app camera path', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../enhancements.js', import.meta.url), 'utf8');
  assert.match(html, /id="quickCameraBtn"/);
  assert.match(html, /id="diaryCameraBtn"/);
  assert.match(html, /id="cameraPreview"[^>]*autoplay[^>]*playsinline/);
  assert.match(source, /navigator\.mediaDevices\?\.getUserMedia/);
  assert.match(source, /quickCameraBtn\.addEventListener\('click', \(\) => openCameraCapture\('quick'\)\)/);
  assert.match(source, /diaryCameraBtn\.addEventListener\('click', \(\) => openCameraCapture\('diary'\)\)/);
  assert.match(source, /canvas\.toBlob\(resolve, 'image\/jpeg', \.88\)/);
});

test('journal attempts conservative recovery before declaring zero photos', async () => {
  const source = await readFile(new URL('../enhancements.js', import.meta.url), 'utf8');
  const journal = await readFile(new URL('../journal.js', import.meta.url), 'utf8');
  assert.match(source, /recoverMatchPhotos\(summary\)/);
  assert.match(journal, /isRecoverablePhoto\(item, summary\)/);
  assert.match(journal, /item\.matchId = summary\.matchId/);
});
