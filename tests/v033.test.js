import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPORT_DEFS, SPORT_RULE_PROFILES, createInitialState, cricketAction,
  setCricketRole, switchCricketInnings, normalizeSportFoundationState,
  volleyballPoint, tennisPoint, badmintonPoint, applySimpleScore
} from '../sports.js';

test('sport rule profiles cover every supported sport', () => {
  assert.deepEqual(Object.keys(SPORT_RULE_PROFILES).sort(), Object.keys(SPORT_DEFS).sort());
  for (const id of Object.keys(SPORT_DEFS)) {
    assert.ok(SPORT_RULE_PROFILES[id].baseline);
    assert.ok(SPORT_RULE_PROFILES[id].simple.length > 0);
    assert.ok(SPORT_RULE_PROFILES[id].advanced.length > 0);
  }
});

test('new cricket match without roster starts with unique Batter 1 and Batter 2', () => {
  const s = createInitialState({ sport: 'cricket' });
  assert.equal(s.cricket.striker, 'Batter 1');
  assert.equal(s.cricket.nonStriker, 'Batter 2');
  assert.notEqual(s.cricket.striker, s.cricket.nonStriker);
  assert.equal(s.cricket.nextFallbackBatterNumber, 3);
});

test('cricket fallback batting order advances Batter 1 through Batter 4', () => {
  let s = createInitialState({ sport: 'cricket' });
  s = cricketAction(s, 'wicket');
  assert.equal(s.cricket.striker, 'Batter 3');
  assert.equal(s.cricket.nonStriker, 'Batter 2');

  s = cricketAction(s, '1');
  assert.equal(s.cricket.striker, 'Batter 2');
  s = cricketAction(s, 'wicket');
  assert.equal(s.cricket.striker, 'Batter 4');
  assert.equal(s.cricket.nonStriker, 'Batter 3');
  assert.notEqual(s.cricket.striker, s.cricket.nonStriker);
});

test('cricket non-striker run out replaces only the non-striker', () => {
  let s = createInitialState({ sport: 'cricket' });
  s = cricketAction(s, 'runOut:nonStriker');
  assert.equal(s.cricket.striker, 'Batter 1');
  assert.equal(s.cricket.nonStriker, 'Batter 3');
  assert.equal(s.cricket.battingStats.A['Batter 2'].out, true);
  assert.equal(s.cricket.dismissals.A[0].type, 'run out');
  assert.equal(s.cricket.dismissals.A[0].batter, 'Batter 2');
});

test('cricket roster continues into generated batters without duplicates', () => {
  let s = createInitialState({
    sport: 'cricket',
    teamA: { roster: ['Alice', 'Bea', 'Cara'] },
    teamB: { roster: ['Bowler'] }
  });
  s = cricketAction(s, 'wicket');
  assert.equal(s.cricket.striker, 'Cara');
  s = cricketAction(s, 'wicket');
  assert.equal(s.cricket.striker, 'Batter 3');
  assert.notEqual(s.cricket.striker, s.cricket.nonStriker);
});

test('stale duplicate Batter 1 cricket state is repaired to next unique batter', () => {
  let s = createInitialState({ sport: 'cricket' });
  s.cricket.striker = 'Batter 1';
  s.cricket.nonStriker = 'Batter 1';
  s.cricket.nextBatterIndex = 0;
  s.cricket.battingStats.A['Batter 1'] = { name: 'Batter 1', runs: 0, balls: 1, fours: 0, sixes: 0, out: false };
  s.cricket.battingStats.A['Batter 2'] = { name: 'Batter 2', runs: 0, balls: 1, fours: 0, sixes: 0, out: true };
  s = normalizeSportFoundationState(s);
  assert.equal(s.cricket.nonStriker, 'Batter 1');
  assert.equal(s.cricket.striker, 'Batter 3');
});

test('cricket locks deliveries at over end until bowler is confirmed', () => {
  let s = createInitialState({ sport: 'cricket', teamB: { roster: ['B1', 'B2'] } });
  for (let i = 0; i < 6; i++) s = cricketAction(s, '0');
  assert.equal(s.cricket.needsBowler, true);
  const frozen = cricketAction(s, '4');
  assert.equal(frozen.teamA.runs, s.teamA.runs);
  assert.equal(frozen.teamA.balls, s.teamA.balls);
  s = setCricketRole(s, 'bowler', 'B2');
  s = cricketAction(s, '4');
  assert.equal(s.teamA.runs, 4);
  assert.equal(s.teamA.balls, 7);
});

test('second cricket innings resets fallback batting order cleanly', () => {
  let s = createInitialState({ sport: 'cricket' });
  s.teamA.runs = 100; s.teamA.score = 100;
  s = switchCricketInnings(s);
  assert.equal(s.cricket.striker, 'Batter 1');
  assert.equal(s.cricket.nonStriker, 'Batter 2');
  s = cricketAction(s, 'wicket');
  assert.equal(s.cricket.striker, 'Batter 3');
});

test('core scoring actions produce ordered match events', () => {
  let basketball = createInitialState({ sport: 'basketball' });
  basketball = applySimpleScore(basketball, 'A', 2);
  assert.equal(basketball.events.at(-1).type, 'score.adjusted');
  assert.equal(basketball.events.at(-1).seq, 1);

  let volleyball = createInitialState({ sport: 'volleyball', bestOf: 3 });
  volleyball = volleyballPoint(volleyball, 'A');
  assert.equal(volleyball.events[0].type, 'volleyball.point');

  let tennis = createInitialState({ sport: 'tennis' });
  tennis = tennisPoint(tennis, 'A');
  assert.equal(tennis.events[0].type, 'tennis.point');

  let badminton = createInitialState({ sport: 'badminton' });
  badminton = badmintonPoint(badminton, 'A');
  assert.equal(badminton.events[0].type, 'badminton.rally');

  let cricket = createInitialState({ sport: 'cricket' });
  cricket = cricketAction(cricket, '1');
  assert.equal(cricket.events[0].type, 'cricket.delivery');
});
