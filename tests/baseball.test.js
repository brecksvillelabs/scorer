import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, swapSides } from '../sports.js';
import {
  BASEBALL_SPORT_DEF, BASEBALL_RULE_PROFILE, createBaseballState, getBaseballPeriodText,
  baseballRun, baseballHit, baseballError, baseballPitch, baseballPlateAppearance,
  toggleBase, advanceBaseballHalf, swapBaseballSides
} from '../baseball-core.js';

test('baseball exposes a scoreboard profile', () => {
  assert.equal(BASEBALL_SPORT_DEF.name, 'Baseball');
  assert.match(BASEBALL_RULE_PROFILE.baseline, /6, 7 or 9/);
});

test('baseball defaults to nine innings with Away/Side B batting first', () => {
  const state = createBaseballState({ sport: 'baseball' }, createInitialState);
  assert.equal(state.sport, 'baseball');
  assert.equal(state.baseball.regulationInnings, 9);
  assert.equal(state.baseball.battingTeam, 'B');
  assert.equal(state.baseball.homeSide, 'A');
  assert.equal(getBaseballPeriodText(state), 'Top 1');
  assert.deepEqual(state.baseball.bases, { first: false, second: false, third: false });
});

test('baseball supports six and seven inning formats and explicit first batting side', () => {
  const six = createBaseballState({ sport: 'baseball', baseballInnings: 6, baseballFirstBat: 'A' }, createInitialState);
  const seven = createBaseballState({ sport: 'baseball', baseballInnings: 7 }, createInitialState);
  assert.equal(six.baseball.regulationInnings, 6);
  assert.equal(six.baseball.battingTeam, 'A');
  assert.equal(six.baseball.homeSide, 'B');
  assert.equal(seven.baseball.regulationInnings, 7);
});

test('four balls award first base and reset the count', () => {
  let state = createBaseballState({ sport: 'baseball' }, createInitialState);
  for (let i = 0; i < 4; i += 1) state = baseballPitch(state, 'ball');
  assert.equal(state.baseball.balls, 0);
  assert.equal(state.baseball.strikes, 0);
  assert.equal(state.baseball.bases.first, true);
  assert.equal(state.events.at(-1).type, 'baseball.walk');
});

test('a bases-loaded walk forces in exactly one run', () => {
  let state = createBaseballState({ sport: 'baseball' }, createInitialState);
  state = toggleBase(state, 'first');
  state = toggleBase(state, 'second');
  state = toggleBase(state, 'third');
  state = baseballPlateAppearance(state, 'walk');
  assert.equal(state.teamB.score, 1);
  assert.deepEqual(state.baseball.bases, { first: true, second: true, third: true });
  assert.equal(state.baseball.runsByInning.B[0], 1);
});

test('a foul cannot become strike three', () => {
  let state = createBaseballState({ sport: 'baseball' }, createInitialState);
  state = baseballPitch(state, 'strike');
  state = baseballPitch(state, 'strike');
  state = baseballPitch(state, 'foul');
  assert.equal(state.baseball.strikes, 2);
  assert.equal(state.baseball.outs, 0);
});

test('three strikes produce an out and three outs advance the half inning', () => {
  let state = createBaseballState({ sport: 'baseball' }, createInitialState);
  for (let out = 0; out < 3; out += 1) {
    state = baseballPitch(state, 'strike');
    state = baseballPitch(state, 'strike');
    state = baseballPitch(state, 'strike');
  }
  assert.equal(state.baseball.half, 'bottom');
  assert.equal(state.baseball.inning, 1);
  assert.equal(state.baseball.battingTeam, 'A');
  assert.equal(state.baseball.outs, 0);
  assert.equal(getBaseballPeriodText(state), 'Bot 1');
});

test('runs, hits and errors are tracked separately for the line score', () => {
  let state = createBaseballState({ sport: 'baseball' }, createInitialState);
  state = baseballRun(state, 1);
  state = baseballHit(state, 1);
  state = baseballError(state, 1);
  assert.equal(state.teamB.score, 1);
  assert.equal(state.baseball.hits.B, 1);
  assert.equal(state.baseball.errors.A, 1);
  assert.equal(state.baseball.runsByInning.B[0], 1);
});

test('manual third out and manual end-half both preserve inning semantics', () => {
  let state = createBaseballState({ sport: 'baseball' }, createInitialState);
  state = baseballPlateAppearance(state, 'out');
  state = baseballPlateAppearance(state, 'out');
  state = baseballPlateAppearance(state, 'out');
  assert.equal(state.baseball.half, 'bottom');
  state = advanceBaseballHalf(state, 'coach-run-limit');
  assert.equal(state.baseball.inning, 2);
  assert.equal(state.baseball.half, 'top');
});

test('home team does not bat bottom of final inning when already leading', () => {
  let state = createBaseballState({ sport: 'baseball', baseballInnings: 1 }, createInitialState);
  state.teamA.score = 2;
  state = advanceBaseballHalf(state, 'three-outs');
  assert.equal(state.finished, true);
  assert.equal(state.winner, 'A');
});

test('bottom-final go-ahead run ends the game as a walkoff', () => {
  let state = createBaseballState({ sport: 'baseball', baseballInnings: 1 }, createInitialState);
  state = advanceBaseballHalf(state, 'three-outs');
  assert.equal(state.baseball.half, 'bottom');
  state = baseballRun(state, 1);
  assert.equal(state.finished, true);
  assert.equal(state.winner, 'A');
});

test('tie after regulation continues to extra innings', () => {
  let state = createBaseballState({ sport: 'baseball', baseballInnings: 1 }, createInitialState);
  state = advanceBaseballHalf(state, 'three-outs');
  state = advanceBaseballHalf(state, 'three-outs');
  assert.equal(state.finished, false);
  assert.equal(state.baseball.inning, 2);
  assert.equal(state.baseball.half, 'top');
});

test('baseball side swap preserves first-bat, home, line-score and current batting semantics', () => {
  let state = createBaseballState({ sport: 'baseball' }, createInitialState);
  state = baseballRun(state, 1);
  state = baseballHit(state, 1);
  state = swapBaseballSides(state, swapSides);
  assert.equal(state.baseball.firstBat, 'A');
  assert.equal(state.baseball.homeSide, 'B');
  assert.equal(state.baseball.battingTeam, 'A');
  assert.equal(state.baseball.hits.A, 1);
  assert.equal(state.baseball.runsByInning.A[0], 1);
});
