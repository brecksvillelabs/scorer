import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mergeDiaryItems, diaryContextText, diaryMomentSummary } from '../v036-core.js';

test('game diary merges photos and notes in chronological order', () => {
  const photos = [{ id: 'p1', createdAt: 30, context: { score: '3-5' } }];
  const notes = [{ id: 'n1', createdAt: 20, text: 'Big save', highlighted: false }];
  const items = mergeDiaryItems(photos, notes, {});
  assert.deepEqual(items.map(item => item.id), ['n1', 'p1']);
  assert.deepEqual(items.map(item => item.kind), ['note', 'photo']);
});

test('photo highlight state is attached without mutating photo storage', () => {
  const photos = [{ id: 'p1', createdAt: 10 }];
  const items = mergeDiaryItems(photos, [], { p1: { matchId: 'm1', highlighted: true } });
  assert.equal(items[0].highlighted, true);
  assert.equal(photos[0].highlighted, undefined);
});

test('diary summary counts photos notes and highlights', () => {
  const summary = diaryMomentSummary([
    { kind: 'photo', highlighted: true },
    { kind: 'photo', highlighted: false },
    { kind: 'note', highlighted: true }
  ]);
  assert.deepEqual(summary, { total: 3, photos: 2, notes: 1, highlights: 2 });
});

test('diary context keeps sport-specific period and detail together', () => {
  assert.equal(diaryContextText({ period: 'Top 5th', detail: 'B-S-O 1-2-1' }), 'Top 5th · B-S-O 1-2-1');
});

test('game diary capture stamps both photos and notes from live match context', async () => {
  const source = await readFile(new URL('../enhancements.js', import.meta.url), 'utf8');
  assert.match(source, /addMatchPhoto\(state\.matchId, file, matchContext\(state\)/);
  assert.match(source, /addMatchNote\(state\.matchId, el\.photoCaption\.value, matchContext\(state\)/);
  assert.match(source, /Game Diary/);
});

test('game diary local metadata is cleaned against active and historical matches', async () => {
  const source = await readFile(new URL('../diary.js', import.meta.url), 'utf8');
  assert.match(source, /export function cleanupDiary/);
  assert.match(source, /store\.notes = store\.notes\.filter\(note => valid\.has\(note\.matchId\)\)/);
  assert.match(source, /photoHighlights/);
});
