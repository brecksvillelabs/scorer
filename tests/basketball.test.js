import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advancePeriod,
  basketballFoul,
  basketballScore,
  basketballShotClockAction,
  createInitialState,
  finishBasketballMatch,
  setBasketballPossession,
  tickClock
} from '../sports.js';
import { formatShareMessage, fullScoreboardMarkup } from '../scoreboards.js';

function game(mode = 'simple') {
  return createInitialState({
    sport:'basketball',
    trackingMode:mode,
    periodMinutes:10,
    basketballShotClock:24,
    teamA:{ name:'Lake Erie Legends', roster:['Ava Patel','Maya Chen','Sofia Ramirez','Priya Nair'] },
    teamB:{ name:'Cuyahoga Storm', roster:['Olivia Brown','Aisha Khan','Grace Lee','Camila Rodriguez'] }
  });
}

test('basketball simple mode scores without requiring player attribution', () => {
  let state = game('simple');
  state = basketballScore(state,'A',2);
  state = basketballScore(state,'B',3);
  state = basketballScore(state,'A',1);
  assert.equal(state.teamA.score,3);
  assert.equal(state.teamB.score,3);
  const scores = state.events.filter(event => event.type === 'basketball.score');
  assert.equal(scores.length,3);
  assert.equal(scores.every(event => event.player === undefined),true);
  assert.doesNotMatch(fullScoreboardMarkup(state),/undefined/);
});

test('basketball detailed mode tracks named points fouls possession and shot clock', () => {
  let state = game('advanced');
  state = basketballScore(state,'A',2,'Ava Patel');
  state = basketballScore(state,'A',3,'Maya Chen');
  state = basketballFoul(state,'B','Aisha Khan');
  state = setBasketballPossession(state,'A');
  state.clock.running = true;
  state = basketballShotClockAction(state,'toggle');
  state = tickClock(state);
  state = tickClock(state);

  assert.equal(state.teamA.score,5);
  assert.equal(state.teamB.fouls,1);
  assert.equal(state.basketball.playerStats.A['Ava Patel'].points,2);
  assert.equal(state.basketball.playerStats.A['Maya Chen'].points,3);
  assert.equal(state.basketball.playerStats.B['Aisha Khan'].fouls,1);
  assert.equal(state.basketball.possession,'A');
  assert.equal(state.basketball.shotClock,22);
  assert.equal(state.clock.seconds,598);

  const html = fullScoreboardMarkup(state);
  assert.match(html,/Quarter scoring/);
  assert.match(html,/Lake Erie Legends players/);
  assert.match(html,/Ava Patel/);
  assert.match(html,/Maya Chen/);
  assert.match(html,/Aisha Khan/);
  assert.match(html,/Play by play/);
});

test('basketball quarter changes reset team fouls and shot clock but preserve player fouls', () => {
  let state = game('advanced');
  state = basketballFoul(state,'A','Priya Nair');
  state = basketballShotClockAction(state,'reset14');
  assert.equal(state.teamA.fouls,1);
  assert.equal(state.basketball.shotClock,14);

  state = advancePeriod(state,1);
  assert.equal(state.period,2);
  assert.equal(state.teamA.fouls,0);
  assert.equal(state.teamB.fouls,0);
  assert.equal(state.basketball.playerStats.A['Priya Nair'].fouls,1);
  assert.equal(state.basketball.shotClock,24);
  assert.equal(state.basketball.shotClockRunning,false);
  assert.equal(state.clock.seconds,600);
});

test('basketball final state and share preserve the scoreboard context', () => {
  let state = game('advanced');
  state = basketballScore(state,'A',3,'Ava Patel');
  state = basketballScore(state,'B',2,'Olivia Brown');
  state = basketballFoul(state,'B','Grace Lee');
  state = finishBasketballMatch(state);

  assert.equal(state.finished,true);
  assert.equal(state.winner,'A');
  assert.equal(state.clock.running,false);
  assert.equal(state.basketball.shotClockRunning,false);
  assert.match(fullScoreboardMarkup(state),/Lake Erie Legends won/);
  assert.match(formatShareMessage(state),/Lake Erie Legends 3–2 Cuyahoga Storm/);
});

test('basketball tie stays live so overtime can be started', () => {
  let state = game('advanced');
  state = basketballScore(state,'A',2,'Ava Patel');
  state = basketballScore(state,'B',2,'Olivia Brown');
  const attempted = finishBasketballMatch(state);
  assert.equal(attempted.finished,false);
  state = advancePeriod(attempted,3);
  assert.equal(state.period,4);
  state = advancePeriod(state,1);
  assert.equal(state.period,5);
});
