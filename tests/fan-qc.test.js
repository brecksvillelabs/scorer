import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  SPORT_DEFS, createInitialState, applySimpleScore, volleyballPoint, tennisPoint,
  badmintonPoint, cricketAction
} from '../sports.js';
import {
  EXTRA_SPORT_DEFS, createScorerState, lacrosseGoal, kabaddiAction
} from '../v035-core.js';
import { BASEBALL_SPORT_DEF, createBaseballState, baseballRun, baseballPitch } from '../baseball-core.js';
import { matchContext } from '../journal.js';

const catalog = { ...SPORT_DEFS, ...EXTRA_SPORT_DEFS, baseball: BASEBALL_SPORT_DEF };

function meaningful(ctx) {
  assert.ok(ctx.title && typeof ctx.title === 'string');
  assert.ok(ctx.score != null && String(ctx.score).length > 0);
  assert.ok(ctx.period && typeof ctx.period === 'string');
  assert.ok(ctx.detail != null && typeof ctx.detail === 'string');
}

test('fan QC catalog contains all ten supported sports exactly once', () => {
  assert.deepEqual(Object.keys(catalog), [
    'volleyball','basketball','soccer','football','cricket','tennis','badminton','lacrosse','kabaddi','baseball'
  ]);
});

test('Volleyball fan context survives a representative rally', () => {
  let state = createInitialState({ sport: 'volleyball' });
  state = volleyballPoint(state, 'A', 1);
  meaningful(matchContext(state));
  assert.equal(state.teamA.score, 1);
  assert.equal(state.volleyball.servingTeam, 'A');
});

test('Basketball fan context survives a representative basket', () => {
  let state = createInitialState({ sport: 'basketball' });
  state = applySimpleScore(state, 'A', 2);
  meaningful(matchContext(state));
  assert.equal(state.teamA.score, 2);
});

test('Soccer fan context survives a representative goal', () => {
  let state = createInitialState({ sport: 'soccer' });
  state = applySimpleScore(state, 'B', 1);
  meaningful(matchContext(state));
  assert.equal(state.teamB.score, 1);
});

test('Football fan context survives a representative touchdown', () => {
  let state = createInitialState({ sport: 'football' });
  state = applySimpleScore(state, 'A', 6);
  meaningful(matchContext(state));
  assert.equal(state.teamA.score, 6);
});

test('Cricket fan context survives a representative delivery', () => {
  let state = createInitialState({ sport: 'cricket' });
  state = cricketAction(state, '1');
  const ctx = matchContext(state);
  meaningful(ctx);
  assert.match(ctx.score, /1\/0/);
  assert.match(ctx.detail, /overs/);
});

test('Tennis fan context survives a representative point', () => {
  let state = createInitialState({ sport: 'tennis' });
  state = tennisPoint(state, 'A');
  const ctx = matchContext(state);
  meaningful(ctx);
  assert.match(ctx.detail, /15-0/);
});

test('Badminton fan context survives a representative rally', () => {
  let state = createInitialState({ sport: 'badminton' });
  state = badmintonPoint(state, 'B');
  const ctx = matchContext(state);
  meaningful(ctx);
  assert.match(ctx.detail, /0-1 points/);
});

test('Lacrosse fan context uses quarter, clock and possession language', () => {
  let state = createScorerState({ sport: 'lacrosse', lacrossePossession: 'A' }, createInitialState);
  state = lacrosseGoal(state, 'A', 1);
  const ctx = matchContext(state);
  meaningful(ctx);
  assert.equal(ctx.period, 'Q1');
  assert.match(ctx.detail, /possession/);
});

test('Kabaddi fan context exposes half and current raid', () => {
  let state = createScorerState({ sport: 'kabaddi', kabaddiFirstRaid: 'B' }, createInitialState);
  state = kabaddiAction(state, 'touch');
  const ctx = matchContext(state);
  meaningful(ctx);
  assert.equal(ctx.period, '1st Half');
  assert.match(ctx.detail, /raid/);
});

test('Baseball fan context exposes inning and B-S-O after a pitch/run', () => {
  let state = createBaseballState({ sport: 'baseball' }, createInitialState);
  state = baseballPitch(state, 'strike');
  state = baseballRun(state, 1);
  const ctx = matchContext(state);
  meaningful(ctx);
  assert.equal(ctx.period, 'Top 1');
  assert.match(ctx.detail, /B-S-O 0-1-0/);
});

test('fullscreen Display mode hides operator scoring pads while preserving the baseball diamond', () => {
  const css = fs.readFileSync(new URL('../v035.css', import.meta.url), 'utf8');
  assert.match(css, /\.display-mode \.score-actions/);
  assert.match(css, /\.display-mode \.racket-controls/);
  assert.match(css, /\.display-mode \.cricket-pad/);
  assert.match(css, /\.display-mode \.v035-raid-actions/);
  assert.match(css, /\.display-mode \.v035-baseball-actions/);
  assert.match(css, /\.display-mode \.v035-diamond \.base\{pointer-events:none/);
});
