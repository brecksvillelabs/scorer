import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, advancePeriod, tickClock, swapSides } from '../sports.js';
import {
  EXTRA_SPORT_DEFS, EXTRA_RULE_PROFILES, createScorerState, lacrosseGoal, setLacrossePossession,
  lacrosseTimeout, lacrosseShotClockAction, kabaddiAction, setKabaddiRaid, kabaddiRaidClockAction,
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
  assert.equal(state.lacrosse.timeouts.A, 2);
  assert.equal(getScorerPeriodText(state, () => ''), 'Q1');
});

test('lacrosse Sixes preset uses eight-minute quarters, 30-second shot clock and one timeout per half', () => {
  const state = createScorerState({ sport: 'lacrosse', lacrosseDiscipline: 'sixes', periodMinutes: 8, lacrosseShotClock: 30 }, createInitialState);
  assert.equal(state.clock.seconds, 480);
  assert.equal(state.lacrosse.discipline, 'sixes');
  assert.equal(state.lacrosse.shotClock, 30);
  assert.equal(state.lacrosse.shotClockSeconds, 30);
  assert.deepEqual(state.lacrosse.timeouts, { A: 1, B: 1 });
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

test('Sixes goal hands the restart possession to the team that conceded', () => {
  let state = createScorerState({ sport: 'lacrosse', lacrosseDiscipline: 'sixes', lacrosseShotClock: 30, lacrossePossession: 'A' }, createInitialState);
  state = lacrosseGoal(state, 'A', 1);
  assert.equal(state.lacrosse.possession, 'B');
  assert.equal(state.lacrosse.shotClock, 30);
});

test('lacrosse timeout allowances replenish at halftime using discipline rules', () => {
  let field = createScorerState({ sport: 'lacrosse' }, createInitialState);
  field = lacrosseTimeout(field, 'A');
  field = advanceScorerPeriod(field, 1, advancePeriod);
  field = advanceScorerPeriod(field, 1, advancePeriod);
  assert.equal(field.period, 3);
  assert.deepEqual(field.lacrosse.timeouts, { A: 2, B: 2 });

  let sixes = createScorerState({ sport: 'lacrosse', lacrosseDiscipline: 'sixes', lacrosseShotClock: 30 }, createInitialState);
  sixes = lacrosseTimeout(sixes, 'A');
  sixes = advanceScorerPeriod(sixes, 1, advancePeriod);
  sixes = advanceScorerPeriod(sixes, 1, advancePeriod);
  assert.deepEqual(sixes.lacrosse.timeouts, { A: 1, B: 1 });
});

test('kabaddi raid can accumulate multiple touch/bonus points before it ends', () => {
  let state = createScorerState({ sport: 'kabaddi', kabaddiFirstRaid: 'A' }, createInitialState);
  state = kabaddiAction(state, 'touch');
  state = kabaddiAction(state, 'touch');
  state = kabaddiAction(state, 'bonus');
  assert.equal(state.teamA.score, 0);
  assert.equal(state.kabaddi.raidPoints, 3);
  assert.equal(state.kabaddi.raidingTeam, 'A');
  state = kabaddiAction(state,'end');
  assert.equal(state.teamA.score,3);
  assert.equal(state.kabaddi.raidingTeam,'B');
});

test('kabaddi All Out adds the separate two-point bonus without prematurely closing the raid', () => {
  let state = createScorerState({ sport: 'kabaddi' }, createInitialState);
  state = kabaddiAction(state, 'touch');
  state = kabaddiAction(state, 'allOut');
  assert.equal(state.teamA.score, 2);
  assert.equal(state.kabaddi.raidPoints, 1);
  assert.equal(state.kabaddi.raidingTeam, 'A');
  assert.equal(state.events.at(-1).type, 'kabaddi.all_out_bonus');
});

test('kabaddi All Out can be awarded to the defending team', () => {
  let state = createScorerState({ sport: 'kabaddi', kabaddiFirstRaid: 'A' }, createInitialState);
  state = kabaddiAction(state, 'technical', 'B-allOut');
  assert.equal(state.teamA.score, 0);
  assert.equal(state.teamB.score, 2);
  assert.equal(state.kabaddi.raidPoints, 0);
  assert.equal(state.events.at(-1).type, 'kabaddi.all_out_bonus');
  assert.equal(state.events.at(-1).side, 'B');
});

test('kabaddi tackle awards defense and ends the raid', () => {
  let state = createScorerState({ sport: 'kabaddi', kabaddiFirstRaid: 'A' }, createInitialState);
  state = kabaddiAction(state, 'tackle');
  assert.equal(state.teamB.score, 1);
  assert.equal(state.kabaddi.raidingTeam, 'B');
  assert.equal(state.kabaddi.raidsCompleted.A, 1);
  assert.equal(state.kabaddi.raidClock, 30);
});

test('kabaddi tackle cancels pending touches but preserves a pending bonus', () => {
  let state = createScorerState({ sport:'kabaddi', kabaddiFirstRaid:'A' },createInitialState);
  state = kabaddiAction(state,'touch');
  state = kabaddiAction(state,'bonus');
  state = kabaddiAction(state,'tackle');
  assert.equal(state.teamA.score,1);
  assert.equal(state.teamB.score,1);
});

test('kabaddi super tackle awards two and raid expiry awards the defense', () => {
  let superTackle = createScorerState({ sport:'kabaddi', kabaddiFirstRaid:'A' },createInitialState);
  superTackle = kabaddiAction(superTackle,'superTackle');
  assert.equal(superTackle.teamB.score,2);

  let expired = createScorerState({ sport:'kabaddi', kabaddiFirstRaid:'A' },createInitialState);
  expired.clock.running = false;
  expired.kabaddi.raidRunning = true;
  expired.kabaddi.raidClock = 1;
  expired = tickScorerClock(expired,tickClock);
  assert.equal(expired.teamB.score,1);
  assert.equal(expired.kabaddi.raidingTeam,'B');
});

test('third consecutive empty raid is resolved as do-or-die out', () => {
  let state = createScorerState({ sport:'kabaddi', kabaddiFirstRaid:'A' },createInitialState);
  for (let cycle=0;cycle<2;cycle++) {
    state = kabaddiAction(state,'empty');
    state = kabaddiAction(state,'empty');
  }
  state = kabaddiAction(state,'empty');
  assert.equal(state.teamB.score,1);
  assert.equal(state.events.some(event=>event.type==='kabaddi.do_or_die_out'),true);
});

test('kabaddi empty raid changes raid ownership without changing score', () => {
  let state = createScorerState({ sport: 'kabaddi', kabaddiFirstRaid: 'B' }, createInitialState);
  state = kabaddiAction(state, 'empty');
  assert.equal(state.teamA.score, 0);
  assert.equal(state.teamB.score, 0);
  assert.equal(state.kabaddi.raidingTeam, 'A');
});

test('kabaddi second half starts with the other first raider and restores two timeouts', () => {
  let state = createScorerState({ sport: 'kabaddi', kabaddiFirstRaid: 'A' }, createInitialState);
  state.kabaddi.timeouts = { A: 0, B: 1 };
  state = advanceScorerPeriod(state, 1, advancePeriod);
  assert.equal(state.period, 2);
  assert.equal(state.kabaddi.raidingTeam, 'B');
  assert.deepEqual(state.kabaddi.timeouts, { A: 2, B: 2 });
  assert.equal(getScorerPeriodText(state, () => ''), '2nd Half');
});

test('kabaddi keeps the half open until the last raid is resolved', () => {
  let state = createScorerState({ sport: 'kabaddi', kabaddiFirstRaid: 'A' }, createInitialState);
  state.clock.seconds = 0;
  state.kabaddi.raidRunning = true;
  state = advanceScorerPeriod(state, 1, advancePeriod);
  assert.equal(state.period, 1);

  state = kabaddiAction(state, 'empty');
  state = advanceScorerPeriod(state, 1, advancePeriod);
  assert.equal(state.period, 2);
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
  assert.equal(kabaddi.kabaddi.firstHalfStartingRaid, 'A');
});
