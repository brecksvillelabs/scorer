import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  applySimpleScore,
  volleyballPoint,
  cricketAction,
  switchCricketInnings,
  formatOvers,
  swapSides,
  advancePeriod
} from '../sports.js';

test('basketball score never goes below zero', () => {
  let s = createInitialState({ sport: 'basketball' });
  s = applySimpleScore(s, 'A', 3);
  s = applySimpleScore(s, 'A', -5);
  assert.equal(s.teamA.score, 0);
});

test('volleyball wins a normal set at 25 by two and advances', () => {
  let s = createInitialState({ sport: 'volleyball', bestOf: 5 });
  s.teamA.score = 24;
  s.teamB.score = 23;
  s = volleyballPoint(s, 'A', 1);
  assert.equal(s.teamA.sets, 1);
  assert.equal(s.period, 2);
  assert.equal(s.teamA.score, 0);
  assert.equal(s.teamB.score, 0);
});

test('volleyball does not end a set without two point lead', () => {
  let s = createInitialState({ sport: 'volleyball', bestOf: 5 });
  s.teamA.score = 24;
  s.teamB.score = 24;
  s = volleyballPoint(s, 'A', 1);
  assert.equal(s.teamA.sets, 0);
  assert.equal(s.teamA.score, 25);
  assert.equal(s.teamB.score, 24);
});

test('cricket valid balls produce correct over notation', () => {
  let s = createInitialState({ sport: 'cricket', oversLimit: 20 });
  for (let i = 0; i < 8; i += 1) s = cricketAction(s, '0');
  assert.equal(formatOvers(s.teamA.balls), '1.2');
});

test('cricket wide adds run but not a legal ball', () => {
  let s = createInitialState({ sport: 'cricket', oversLimit: 20 });
  s = cricketAction(s, 'wide');
  assert.equal(s.teamA.runs, 1);
  assert.equal(s.teamA.balls, 0);
});

test('cricket second innings target is first innings plus one', () => {
  let s = createInitialState({ sport: 'cricket', oversLimit: 20 });
  s.teamA.runs = 143;
  s = switchCricketInnings(s);
  assert.equal(s.cricket.target, 144);
  assert.equal(s.cricket.battingTeam, 'B');
});

test('swap sides preserves the visual-side meaning of possession', () => {
  let s = createInitialState({ sport: 'football' });
  s.teamA.name = 'Blue';
  s.teamB.name = 'Red';
  s.football.possession = 'A';
  s = swapSides(s);
  assert.equal(s.teamA.name, 'Red');
  assert.equal(s.football.possession, 'B');
});

test('basketball team fouls reset on a new quarter', () => {
  let s = createInitialState({ sport: 'basketball' });
  s.teamA.fouls = 4;
  s.teamB.fouls = 2;
  s = advancePeriod(s, 1);
  assert.equal(s.period, 2);
  assert.equal(s.teamA.fouls, 0);
  assert.equal(s.teamB.fouls, 0);
});
