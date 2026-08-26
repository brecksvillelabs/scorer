import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, volleyballPoint } from '../sports.js';
import { setsNeeded, volleyballWinnerFromState, reconcileCompletedState, manuallyFinishState, finalLabel } from '../v031-core.js';

function winSet(state, side, loserScore = 0) {
  state.teamA.score = side === 'A' ? 24 : loserScore;
  state.teamB.score = side === 'B' ? 24 : loserScore;
  return volleyballPoint(state, side);
}

test('best-of-3 requires exactly two set wins', () => {
  assert.equal(setsNeeded(3), 2);
  assert.equal(setsNeeded(5), 3);
});

test('volleyball best-of-3 finishes at 2-0 and does not start set 3', () => {
  let s = createInitialState({ sport: 'volleyball', bestOf: 3 });
  s = winSet(s, 'A');
  assert.equal(s.finished, false);
  assert.equal(s.period, 2);
  s = winSet(s, 'A');
  assert.equal(s.finished, true);
  assert.equal(s.winner, 'A');
  assert.equal(s.teamA.sets, 2);
  assert.equal(s.period, 2);
});

test('volleyball best-of-3 finishes at 2-1', () => {
  let s = createInitialState({ sport: 'volleyball', bestOf: 3 });
  s = winSet(s, 'A');
  s = winSet(s, 'B');
  s = winSet(s, 'A');
  assert.equal(s.finished, true);
  assert.equal(s.winner, 'A');
  assert.equal(s.teamA.sets, 2);
  assert.equal(s.teamB.sets, 1);
});

test('volleyball best-of-5 remains active at 2-0', () => {
  let s = createInitialState({ sport: 'volleyball', bestOf: 5 });
  s = winSet(s, 'A');
  s = winSet(s, 'A');
  assert.equal(s.finished, false);
  assert.equal(s.teamA.sets, 2);
  assert.equal(s.period, 3);
});

test('reconcile repairs a stale best-of-3 2-0 state', () => {
  const s = createInitialState({ sport: 'volleyball', bestOf: 3 });
  s.teamA.sets = 2; s.teamB.sets = 0; s.period = 3; s.finished = false; s.winner = null;
  assert.equal(volleyballWinnerFromState(s), 'A');
  const fixed = reconcileCompletedState(s);
  assert.equal(fixed.finished, true);
  assert.equal(fixed.winner, 'A');
});

test('manual end preserves score and records reason', () => {
  const s = createInitialState({ sport: 'basketball' });
  s.teamA.score = 51; s.teamB.score = 49;
  const ended = manuallyFinishState(s, { winner: 'A', reason: 'Time limit' });
  assert.equal(ended.finished, true);
  assert.equal(ended.winner, 'A');
  assert.equal(ended.teamA.score, 51);
  assert.equal(ended.teamB.score, 49);
  assert.equal(ended.manualEnd.reason, 'Time limit');
  assert.match(finalLabel(ended), /wins/);
});
