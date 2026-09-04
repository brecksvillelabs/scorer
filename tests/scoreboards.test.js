import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  applySimpleScore, badmintonPoint, createInitialState, cricketAction, setCricketRole,
  switchCricketInnings, tennisPoint, volleyballPoint
} from '../sports.js';
import { createScorerState, kabaddiAction, lacrosseGoal } from '../v035-core.js';
import { baseballPitch, baseballRun, createBaseballState } from '../baseball-core.js';
import { formatShareMessage, fullScoreboardMarkup, scoreShareTitle } from '../scoreboards.js';

function namedOptions(sport) {
  return { sport, teamA:{ name:'Bees', roster:['A One','A Two','A Three'] }, teamB:{ name:'Royals', roster:['B One','B Two','B Three'] } };
}

test('every supported sport produces a self-contained score update', () => {
  const states = [];
  let state = volleyballPoint(createInitialState(namedOptions('volleyball')), 'A'); states.push(state);
  state = applySimpleScore(createInitialState(namedOptions('basketball')), 'A', 3); states.push(state);
  state = applySimpleScore(createInitialState(namedOptions('soccer')), 'B', 1); states.push(state);
  state = applySimpleScore(createInitialState(namedOptions('football')), 'A', 6); states.push(state);
  state = cricketAction(createInitialState({ ...namedOptions('cricket'), battingTeam:'A' }), '4'); states.push(state);
  state = tennisPoint(createInitialState(namedOptions('tennis')), 'A'); states.push(state);
  state = badmintonPoint(createInitialState(namedOptions('badminton')), 'B'); states.push(state);
  state = lacrosseGoal(createScorerState(namedOptions('lacrosse'), createInitialState), 'A'); states.push(state);
  state = kabaddiAction(createScorerState(namedOptions('kabaddi'), createInitialState), 'touch'); states.push(state);
  state = baseballRun(baseballPitch(createBaseballState(namedOptions('baseball'), createInitialState), 'strike'), 1); states.push(state);

  assert.equal(states.length, 10);
  for (const item of states) {
    const text = formatShareMessage(item);
    assert.match(text, item.sport === 'baseball' ? /Royals vs Bees/ : /Bees vs Royals/);
    assert.match(text, /Shared from Scorer/);
    assert.match(text, /LIVE/);
    assert.ok(text.split('\n').length >= 3, `${item.sport} share message lacks context`);
  }
});

test('cricket full scorecard keeps every batter and dismissal details', () => {
  let state = createInitialState({ ...namedOptions('cricket'), battingTeam:'A', cricketFormat:'T20', oversLimit:20 });
  state = cricketAction(state, '4');
  state = cricketAction(state, 'wicket');
  state = cricketAction(state, '1');
  state = setCricketRole(state, 'bowler', 'B Two');
  const html = fullScoreboardMarkup(state);
  assert.match(html, /A One/);
  assert.match(html, /A Two/);
  assert.match(html, /A Three/);
  assert.match(html, /b B One/);
  assert.match(html, /Bowling/);
  assert.match(html, /Fall of wickets/);
  assert.match(html, /R<\/th><th>B<\/th><th>4s<\/th><th>6s<\/th><th>SR/);
});

test('cricket share message clearly expresses a chase', () => {
  let state = createInitialState({ ...namedOptions('cricket'), battingTeam:'A', oversLimit:20 });
  state.teamA.runs = 119; state.teamA.score = 119; state.teamA.balls = 120;
  state = switchCricketInnings(state);
  state = cricketAction(state, '6');
  const text = formatShareMessage(state);
  assert.match(text, /Royals 6\/0/);
  assert.match(text, /Target 120/);
  assert.match(text, /Need 114 from 119/);
});

test('break and final shares omit stale live-only details', () => {
  let volleyball = createInitialState({ ...namedOptions('volleyball'), bestOf:3 });
  volleyball.teamA.score = 24;
  volleyball = volleyballPoint(volleyball,'A');
  const breakText = formatShareMessage(volleyball);
  assert.match(breakText,/Set break/);
  assert.doesNotMatch(breakText,/serving/i);

  let badminton = createInitialState({ ...namedOptions('badminton'), badmintonBestOf:1 });
  badminton.badminton.points.A = 20;
  badminton = badmintonPoint(badminton,'A');
  const finalHtml = fullScoreboardMarkup(badminton);
  assert.match(finalHtml,/FINAL/);
  assert.doesNotMatch(finalHtml,/>Serving</);
  assert.doesNotMatch(finalHtml,/Current game/);
});

test('cricket final share includes both innings and the result', () => {
  let state = createInitialState({ ...namedOptions('cricket'), battingTeam:'A', oversLimit:20 });
  state.teamA.runs = 5; state.teamA.score = 5; state.teamA.balls = 6;
  state = switchCricketInnings(state);
  state = cricketAction(state,'6');
  const text = formatShareMessage(state);
  assert.match(text,/Bees 5\/0 \(1\.0 ov\)/);
  assert.match(text,/Royals 6\/0 \(0\.1 ov\)/);
  assert.match(text,/Royals won by 10 wickets/);
});

test('period scorecards derive familiar quarter and half tables from scoring events', () => {
  let basketball = createInitialState(namedOptions('basketball'));
  basketball = applySimpleScore(basketball, 'A', 2);
  basketball.period = 2;
  basketball = applySimpleScore(basketball, 'B', 3);
  const basketballHtml = fullScoreboardMarkup(basketball);
  assert.match(basketballHtml, /Q1/);
  assert.match(basketballHtml, /Q4/);
  assert.match(basketballHtml, /Period scoring/);

  let soccer = createInitialState(namedOptions('soccer'));
  soccer = applySimpleScore(soccer, 'B', 1);
  const soccerHtml = fullScoreboardMarkup(soccer);
  assert.match(soccerHtml, /1H/);
  assert.match(soccerHtml, /2H/);
  assert.match(soccerHtml, /Yellow cards/);
});

test('lacrosse goal waits for a confirmed field restart and names timeout order', () => {
  let state = createScorerState(namedOptions('lacrosse'),createInitialState);
  state = lacrosseGoal(state,'A');
  const text = formatShareMessage(state);
  assert.match(text,/Restart pending/);
  assert.match(text,/TO left: Bees 2, Royals 2/);
  assert.doesNotMatch(text,/Side null/);
});

test('unreconciled period corrections never fabricate a quarter split', () => {
  let state = createScorerState(namedOptions('lacrosse'),createInitialState);
  state = lacrosseGoal(state,'A');
  state.period = 2;
  state = lacrosseGoal(state,'A',-1);
  const html = fullScoreboardMarkup(state);
  assert.match(html,/Bees<\/td><td>—<\/td><td>—<\/td>/);
  assert.match(html,/class="full-total">0/);
});

test('kabaddi share identifies the last raid after time expires', () => {
  const state = createScorerState(namedOptions('kabaddi'),createInitialState);
  state.clock.seconds = 0;
  state.kabaddi.raidRunning = true;
  state.kabaddi.raidPoints = 1;
  const text = formatShareMessage(state);
  assert.match(text,/Last raid/);
  assert.match(text,/Pending \+1/);
});

test('scoreboard output escapes team and player names', () => {
  const state = createInitialState({ sport:'cricket', teamA:{ name:'A <script>', roster:['<Batter>','Safe'] }, teamB:{ name:'B', roster:['Bowler'] } });
  const html = fullScoreboardMarkup(state);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /A &lt;script&gt;/);
  assert.match(html, /&lt;Batter&gt;/);
  assert.equal(scoreShareTitle(state), 'Scorer update: A <script> vs B');
});

test('full-score and share UI is wired into the offline app shell', async () => {
  const [html, app, css, worker, bridge] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../scoreboards.css', import.meta.url), 'utf8'),
    readFile(new URL('../sw.js', import.meta.url), 'utf8'),
    readFile(new URL('../native-bridge.js', import.meta.url), 'utf8')
  ]);
  assert.match(html, /id="fullScoreboardBtn"/);
  assert.match(html, /id="shareScoreBtn"/);
  assert.match(html, /id="fullScoreboardModal"/);
  assert.match(html, /scoreboards\.css/);
  assert.match(app, /formatShareMessage/);
  assert.match(app, /shareContent/);
  assert.match(css, /\.cricket-full-innings/);
  assert.match(worker, /scoreboards\.js/);
  assert.match(bridge, /export async function shareContent/);
});
