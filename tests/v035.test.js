import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, advancePeriod, tickClock, swapSides } from '../sports.js';
import {
  EXTRA_SPORT_DEFS, EXTRA_RULE_PROFILES, createScorerState, lacrosseGoal, setLacrossePossession,
  lacrosseShotClockAction, kabaddiAction, setKabaddiRaid, kabaddiRaidClockAction,
  tickScorerClock, advanceScorerPeriod, swapScorerSides, getScorerPeriodText
} from '../v035-core.js';

test('v0.3.5 exposes lacrosse and kabaddi sport profiles', () => {
  assert.equal(EXTRA_SPORT_DEFS.lacrosse.name, 'Lacrosse');
  assert.equal(EXTRA_SPORT_DEFS.kabaddi.name, 'Kabaddi');
  assert.match(EXTRA_RULE_PROFILES.lacrosse.baseline, /World Lacrosse/);
  assert.match(EXTRA_RULE_PROFILES.kabaddi.baseline, /IKF/);
});

test('field lacrosse defaults to four 15-minute quarters without forcing a shot clock', () => {
  const state = createScorerState({ sport: 'lacrosse' }, createInitialState);
  assert.equal(state.sport, 'lacrosse');
  assert.equal(state.maxPeriods, 4);
  assert.equal(state.clock.seconds, 15 * 60);
  assert.equal(state.lacrosse.discipline, 'field');
  assert.equal(state.lacrosse.shotClockSeconds, 0);
  assert.equal(getScorerPeriodText(state, () => ''), 'Q1');
});

test('lacrosse Sixes preset uses eight-minute quarters and a 30-second shot clock', () => {
  const state = createScorerState({ sport: 'lacrosse', lacrosseDiscipline: 'sixes', periodMinutes: 8, lacrosseShotClock: 30 }, createInitialState);
  assert.equal(state.clock.seconds, 480);
  assert.equal(state.lacrosse.discipline, 'sixes');
  assert.equal(state.lacrosse.shotClock, 30);
  assert.equal(state.lacrosse.shotClockSeconds, 30);
});

test('lacrosse goal and possession actions create sport-specific state and events', () => {
  let state = createScorerState({ sport: 'lacrosse', lacrosseShotClock: 80 }, createInitialState);
  state = lacrosseShotClockAction(state, 'toggle');
  state.lacrosse.shotClock = 41;
  state = lacrosseGoal(state, 'A', 1);
  assert.equal(state.teamA.score, 1);
  assert.equal(state.lacrosse.shotClock, 80);
  assert.equal(state.lacrosse.shotClockRunning, false);
  state = setLacrossePossession(state, 'B');
  assert.equal(state.lacrosse.possession, 'B');
  assert.equal(state.events.at(-1).type, 'lacrosse.possession');
});

test('kabaddi raid can accumulate multiple touch/bonus points before it ends', () => {
  let state = createScorerState({ sport: 'kabaddi', kabaddiFirstRaid: 'A' }, createInitialState);
  state = kabaddiAction(state, 'touch');
  state = kabaddiAction(state, 'touch');
  state = kabaddiAction(state, 'bonus');
  assert.equal(state.teamA.score, 3);
  assert.equal(state.kabaddi.raidPoints, 3);
  assert.equal(state.kabaddi.raidingTeam, 'A');
});

test('kabaddi All Out adds the separate two-point bonus without prematurely closing the raid', () => {
  let state = createScorerState({ sport: 'kabaddi' }, createInitialState);
  state = kabaddiAction(state, 'touch');
  state = kabaddiAction(state, 'allOut');
  assert.equal(state.teamA.score, 3);
  assert.equal(state.kabaddi.raidPoints, 3);
  assert.equal(state.kabaddi.raidingTeam, 'A');
  assert.equal(state.events.at(-1).type, 'kabaddi.all_out_bonus');
});

test('kabaddi tackle awards defense and ends the raid', () => {
  let state = createScorerState({ sport: 'kabaddi', kabaddiFirstRaid: 'A' }, createInitialState);
  state = kabaddiAction(state, 'tackle');
  assert.equal(state.teamB.score, 1);
  assert.equal(state.kabaddi.raidingTeam, 'B');
  assert.equal(state.kabaddi.raidsCompleted.A, 1);
  assert.equal(state.kabaddi.raidClock, 30);
});

test('kabaddi empty raid changes raid ownership without changing score', () => {
  let state = createScorerState({ sport: 'kabaddi', kabaddiFirstRaid: 'B' }, createInitialState);
  state = kabaddiAction(state, 'empty');
  assert.equal(state.teamA.score, 0);
  assert.equal(state.teamB.score, 0);
  assert.equal(state.kabaddi.raidingTeam, 'A');
});

test('kabaddi second half starts with the team that did not start the first half raid', () => {
  let state = createScorerState({ sport: 'kabaddi', kabaddiFirstRaid: 'A' }, createInitialState);
  state = advanceScorerPeriod(state, 1, advancePeriod);
  assert.equal(state.period, 2);
  assert.equal(state.kabaddi.raidingTeam, 'B');
  assert.equal(getScorerPeriodText(state, () => ''), '2nd Half');
});

test('raid and lacrosse shot clocks can tick independently of the game clock', () => {
  let kabaddi = createScorerState({ sport: 'kabaddi' }, createInitialState);
  kabaddi = kabaddiRaidClockAction(kabaddi, 'toggle');
  kabaddi = tickScorerClock(kabaddi, tickClock);
  assert.equal(kabaddi.kabaddi.raidClock, 29);

  let lacrosse = createScorerState({ sport: 'lacrosse', lacrosseShotClock: 80 }, createInitialState);
  lacrosse = lacrosseShotClockAction(lacrosse, 'toggle');
  lacrosse = tickScorerClock(lacrosse, tickClock);
  assert.equal(lacrosse.lacrosse.shotClock, 79);
});

test('side swap preserves lacrosse and kabaddi ownership semantics', () => {
  let lacrosse = createScorerState({ sport: 'lacrosse', lacrossePossession: 'A' }, createInitialState);
  lacrosse = swapScorerSides(lacrosse, swapSides);
  assert.equal(lacrosse.lacrosse.possession, 'B');

  let kabaddi = createScorerState({ sport: 'kabaddi', kabaddiFirstRaid: 'A' }, createInitialState);
  kabaddi = setKabaddiRaid(kabaddi, 'B');
  kabaddi = swapScorerSides(kabaddi, swapSides);
  assert.equal(kabaddi.kabaddi.raidingTeam, 'A');
  assert.equal(kabaddi.kabaddi.firstHalfStartingRaid, 'B');
});
