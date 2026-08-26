import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, applySimpleScore, volleyballPoint, tennisPoint, formatTennisPoint,
  badmintonPoint, cricketAction, setCricketRole, switchCricketInnings, advancePeriod,
  formatOvers, swapSides
} from '../sports.js';

test('simple score never goes below zero', () => {
  let s = createInitialState({ sport: 'basketball' });
  s = applySimpleScore(s, 'A', -1);
  assert.equal(s.teamA.score, 0);
});

test('volleyball wins set at 25 by two', () => {
  let s = createInitialState({ sport: 'volleyball', bestOf: 3 });
  s.teamA.score = 24; s.teamB.score = 23;
  s = volleyballPoint(s, 'A');
  assert.equal(s.teamA.sets, 1);
  assert.equal(s.period, 2);
  assert.equal(s.teamA.score, 0);
});

test('volleyball does not end at 25-24', () => {
  let s = createInitialState({ sport: 'volleyball' });
  s.teamA.score = 24; s.teamB.score = 24;
  s = volleyballPoint(s, 'A');
  assert.equal(s.teamA.sets, 0);
  assert.equal(s.teamA.score, 25);
});

test('tennis formats deuce and advantage', () => {
  let s = createInitialState({ sport: 'tennis' });
  for (let i = 0; i < 3; i++) { s = tennisPoint(s, 'A'); s = tennisPoint(s, 'B'); }
  assert.equal(formatTennisPoint(s, 'A'), '40');
  assert.equal(formatTennisPoint(s, 'B'), '40');
  s = tennisPoint(s, 'A');
  assert.equal(formatTennisPoint(s, 'A'), 'AD');
});

test('tennis game requires two points after deuce', () => {
  let s = createInitialState({ sport: 'tennis' });
  for (let i = 0; i < 3; i++) { s = tennisPoint(s, 'A'); s = tennisPoint(s, 'B'); }
  s = tennisPoint(s, 'A');
  s = tennisPoint(s, 'A');
  assert.equal(s.tennis.games.A, 1);
  assert.equal(s.tennis.points.A, 0);
});

test('tennis enters tiebreak at 6-6', () => {
  let s = createInitialState({ sport: 'tennis' });
  for (let game = 0; game < 12; game++) {
    const side = game % 2 === 0 ? 'A' : 'B';
    for (let p = 0; p < 4; p++) s = tennisPoint(s, side);
  }
  assert.equal(s.tennis.games.A, 6);
  assert.equal(s.tennis.games.B, 6);
  assert.equal(s.tennis.tiebreak, true);
});

test('badminton wins game at 21 with two point margin', () => {
  let s = createInitialState({ sport: 'badminton' });
  s.badminton.points.A = 20; s.badminton.points.B = 19;
  s = badmintonPoint(s, 'A');
  assert.equal(s.badminton.games.A, 1);
  assert.equal(s.period, 2);
});

test('badminton continues at 21-20', () => {
  let s = createInitialState({ sport: 'badminton' });
  s.badminton.points.A = 20; s.badminton.points.B = 20;
  s = badmintonPoint(s, 'A');
  assert.equal(s.badminton.games.A, 0);
  assert.equal(s.badminton.points.A, 21);
});

test('badminton caps game at 30', () => {
  let s = createInitialState({ sport: 'badminton' });
  s.badminton.points.A = 29; s.badminton.points.B = 29;
  s = badmintonPoint(s, 'B');
  assert.equal(s.badminton.games.B, 1);
});

test('cricket tracks batter and bowler records', () => {
  let s = createInitialState({ sport: 'cricket', teamA: { roster: ['A1','A2','A3'] }, teamB: { roster: ['B1','B2'] }, battingTeam: 'A' });
  s = cricketAction(s, '4');
  assert.equal(s.teamA.runs, 4);
  assert.equal(s.cricket.battingStats.A.A1.runs, 4);
  assert.equal(s.cricket.battingStats.A.A1.balls, 1);
  assert.equal(s.cricket.battingStats.A.A1.fours, 1);
  assert.equal(s.cricket.bowlingStats.B.B1.runs, 4);
  assert.equal(s.cricket.bowlingStats.B.B1.balls, 1);
});

test('cricket wide adds run but not legal ball', () => {
  let s = createInitialState({ sport: 'cricket' });
  s = cricketAction(s, 'wide');
  assert.equal(s.teamA.runs, 1);
  assert.equal(s.teamA.balls, 0);
  assert.equal(s.cricket.extras.A.wides, 1);
});

test('cricket over swaps strike and requests bowler', () => {
  let s = createInitialState({ sport: 'cricket', teamA: { roster: ['A1','A2','A3'] }, teamB: { roster: ['B1','B2'] } });
  for (let i = 0; i < 6; i++) s = cricketAction(s, '0');
  assert.equal(formatOvers(s.teamA.balls), '1.0');
  assert.equal(s.cricket.striker, 'A2');
  assert.equal(s.cricket.needsBowler, true);
  s = setCricketRole(s, 'bowler', 'B2');
  assert.equal(s.cricket.bowler, 'B2');
  assert.equal(s.cricket.needsBowler, false);
});

test('cricket wicket brings next batter', () => {
  let s = createInitialState({ sport: 'cricket', teamA: { roster: ['A1','A2','A3'] }, teamB: { roster: ['B1'] } });
  s = cricketAction(s, 'wicket');
  assert.equal(s.teamA.wickets, 1);
  assert.equal(s.cricket.battingStats.A.A1.out, true);
  assert.equal(s.cricket.striker, 'A3');
  assert.equal(s.cricket.bowlingStats.B.B1.wickets, 1);
});

test('cricket second innings target is first innings plus one', () => {
  let s = createInitialState({ sport: 'cricket' });
  s.teamA.runs = 143; s.teamA.score = 143;
  s = switchCricketInnings(s);
  assert.equal(s.cricket.target, 144);
  assert.equal(s.cricket.battingTeam, 'B');
});

test('basketball fouls reset at new quarter', () => {
  let s = createInitialState({ sport: 'basketball' });
  s.teamA.fouls = 4; s.teamB.fouls = 3;
  s = advancePeriod(s, 1);
  assert.equal(s.period, 2);
  assert.equal(s.teamA.fouls, 0);
  assert.equal(s.teamB.fouls, 0);
});

test('swap sides flips possession', () => {
  let s = createInitialState({ sport: 'football' });
  s.football.possession = 'A';
  s = swapSides(s);
  assert.equal(s.football.possession, 'B');
});

test('cricket run out does not credit bowler wicket', () => {
  let s = createInitialState({ sport: 'cricket', teamA: { roster: ['A1','A2','A3'] }, teamB: { roster: ['B1'] } });
  s = cricketAction(s, 'runOut');
  assert.equal(s.teamA.wickets, 1);
  assert.equal(s.cricket.bowlingStats.B.B1.wickets, 0);
});
