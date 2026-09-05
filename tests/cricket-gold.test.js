import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createInitialState, cricketAction, setCricketRole } from '../sports.js';
import { createTeamProfile } from '../journal.js';
import {
  addRosterPlayer, cleanRosterEntries, cricketGoldScorecardMarkup,
  cricketGoldShareMessage, cricketYetToBat, removeRosterPlayer, updateSavedTeamRoster
} from '../cricket-gold-core.js';

function cricketFixture() {
  return createInitialState({
    sport:'cricket',
    battingTeam:'A',
    oversLimit:20,
    teamA:{ name:'India', color:'#123456', logo:'data:image/png;base64,INDIA', roster:['Kohli','Rahul','Rohit','Gill'] },
    teamB:{ name:'Pakistan', color:'#654321', logo:'data:image/png;base64,PAK', roster:['Shaheen','Naseem','Babar','Rizwan'] }
  });
}

test('saved team roster edits preserve identity and do not mutate historical snapshots', () => {
  const original = createTeamProfile({
    name:'India', color:'#123456', logo:'data:image/png;base64,INDIA',
    roster:['Kohli','Rahul','Kohli','']
  }, 'cricket', 'team-india');
  const historicalSnapshot = structuredClone(original);
  const edited = updateSavedTeamRoster(original, ['Kohli','Rahul','Rohit',' kohli '], 12345);

  assert.equal(edited.id, 'team-india');
  assert.equal(edited.name, 'India');
  assert.equal(edited.logo, original.logo);
  assert.equal(edited.color, original.color);
  assert.equal(edited.sport, 'cricket');
  assert.deepEqual(edited.roster, ['Kohli','Rahul','Rohit']);
  assert.deepEqual(original.roster, ['Kohli','Rahul']);
  assert.deepEqual(historicalSnapshot.roster, ['Kohli','Rahul']);
});

test('roster helpers add/remove players and normalize blanks and duplicates', () => {
  assert.deepEqual(cleanRosterEntries('Kohli\nRahul\n\nKOHLI\nGill'), ['Kohli','Rahul','Gill']);
  const added = addRosterPlayer(['Kohli','Rahul'], 'Rohit');
  assert.deepEqual(added, ['Kohli','Rahul','Rohit']);
  assert.deepEqual(addRosterPlayer(added, ' rohit '), added);
  assert.deepEqual(removeRosterPlayer(added, 1), ['Kohli','Rohit']);
  assert.deepEqual(removeRosterPlayer(added, 'KOHLI'), ['Rahul','Rohit']);
});

test('live first-innings cricket share is concise and self-contained', () => {
  const state = cricketFixture();
  state.teamA.runs = 65; state.teamA.score = 65; state.teamA.wickets = 3; state.teamA.balls = 72;
  state.cricket.striker = 'Kohli'; state.cricket.nonStriker = 'Rahul'; state.cricket.bowler = 'Shaheen';
  state.cricket.battingStats.A.Kohli = { name:'Kohli', runs:28, balls:24, fours:3, sixes:1, out:false };
  state.cricket.battingStats.A.Rahul = { name:'Rahul', runs:12, balls:10, fours:1, sixes:0, out:false };

  assert.equal(cricketGoldShareMessage(state), [
    '🏏 LIVE • India vs Pakistan',
    'India batting • 65/3 (12.0 ov)',
    'Kohli 28* (24) • Rahul 12* (10)',
    'RR 5.42 • Shaheen bowling',
    'Shared from Scorer'
  ].join('\n'));
});

test('live chase share prioritizes target, runs needed, balls and required run rate', () => {
  const state = cricketFixture();
  state.teamA.runs = 167; state.teamA.score = 167; state.teamA.wickets = 6; state.teamA.balls = 120;
  state.cricket.innings = 2; state.period = 2; state.cricket.battingTeam = 'B'; state.cricket.target = 168;
  state.teamB.runs = 121; state.teamB.score = 121; state.teamB.wickets = 4; state.teamB.balls = 92;
  state.cricket.striker = 'Babar'; state.cricket.nonStriker = 'Rizwan';
  state.cricket.battingStats.B.Babar = { name:'Babar', runs:52, balls:39, fours:5, sixes:1, out:false };
  state.cricket.battingStats.B.Rizwan = { name:'Rizwan', runs:21, balls:15, fours:2, sixes:0, out:false };

  const text = cricketGoldShareMessage(state);
  assert.match(text,/Pakistan 121\/4 \(15\.2 ov\) • chasing 168/);
  assert.match(text,/Babar 52\* \(39\) • Rizwan 21\* \(15\)/);
  assert.match(text,/Need 47 from 28 • RRR 10\.07/);
  assert.doesNotMatch(text,/RR 7\./);
});

test('innings-break and final shares omit stale live batter and bowler lines', () => {
  const state = cricketFixture();
  state.teamA.runs = 167; state.teamA.score = 167; state.teamA.wickets = 6; state.teamA.balls = 120;
  state.cricket.inningsComplete = true;
  state.cricket.striker = 'Kohli'; state.cricket.nonStriker = 'Rahul'; state.cricket.bowler = 'Shaheen';

  const breakText = cricketGoldShareMessage(state);
  assert.match(breakText,/🏏 INNINGS BREAK • India vs Pakistan/);
  assert.match(breakText,/India 167\/6 \(20\.0 ov\)/);
  assert.match(breakText,/Pakistan need 168 to win/);
  assert.doesNotMatch(breakText,/Kohli .*Rahul/);
  assert.doesNotMatch(breakText,/bowling/);

  state.cricket.innings = 2; state.period = 2; state.cricket.battingTeam = 'B'; state.cricket.target = 168; state.cricket.inningsComplete = false;
  state.teamB.runs = 154; state.teamB.score = 154; state.teamB.wickets = 8; state.teamB.balls = 120;
  state.finished = true; state.winner = 'A'; state.cricket.matchWinner = 'A';
  const finalText = cricketGoldShareMessage(state);
  assert.match(finalText,/🏏 FINAL • India vs Pakistan/);
  assert.match(finalText,/India won by 13 runs/);
  assert.doesNotMatch(finalText,/Kohli .*Rahul/);
  assert.doesNotMatch(finalText,/bowling/);
});

test('gold scorecard separates yet-to-bat and derives familiar bowling columns', () => {
  let state = cricketFixture();
  state = cricketAction(state,'0');
  state = cricketAction(state,'wide');
  state = cricketAction(state,'noBall');
  state = cricketAction(state,'4');
  state = cricketAction(state,'wicket');

  const html = cricketGoldScorecardMarkup(state);
  assert.match(html,/data-cricket-gold-scorecard="true"/);
  assert.match(html,/India vs Pakistan/);
  assert.match(html,/Batting/);
  assert.match(html,/R<\/th><th>B<\/th><th>4s<\/th><th>6s<\/th><th>SR/);
  assert.match(html,/Extras/);
  assert.match(html,/Total/);
  assert.match(html,/Yet to bat/);
  assert.match(html,/Gill/);
  assert.deepEqual(cricketYetToBat(state,'A'), ['Gill']);
  assert.match(html,/Fall of wickets/);
  assert.match(html,/Bowling<\/th><th>O<\/th><th>M<\/th><th>R<\/th><th>W<\/th><th>Econ<\/th><th>0s<\/th><th>WD<\/th><th>NB/);
  assert.match(html,/Shaheen/);
  assert.match(html,/wd 1, nb 1/);
});

test('completed maiden is counted once when the next over begins', () => {
  let state = cricketFixture();
  for (let i = 0; i < 6; i += 1) state = cricketAction(state,'0');
  assert.equal(state.cricket.needsBowler, true);
  state = setCricketRole(state,'bowler','Naseem');
  state = cricketAction(state,'1');
  const html = cricketGoldScorecardMarkup(state);
  assert.match(html,/<strong>Shaheen<\/strong><\/td><td>1\.0<\/td><td>1<\/td><td>0<\/td><td>0<\/td>/);
  assert.doesNotMatch(html,/<strong>Shaheen<\/strong><\/td><td>1\.0<\/td><td>2<\/td>/);
});

test('cricket gold layer is wired into syntax, offline, live refresh and native packaging paths', async () => {
  const [theme, worker, browser, pkg, prepare] = await Promise.all([
    readFile(new URL('../theme.js', import.meta.url), 'utf8'),
    readFile(new URL('../sw.js', import.meta.url), 'utf8'),
    readFile(new URL('../cricket-gold.js', import.meta.url), 'utf8'),
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/prepare-native.mjs', import.meta.url), 'utf8')
  ]);
  assert.match(theme,/import '\.\/cricket-gold\.js'/);
  assert.match(worker,/cricket-gold\.js/);
  assert.match(worker,/cricket-gold-core\.js/);
  assert.match(browser,/data-manage-roster/);
  assert.match(browser,/Share \/ WhatsApp/);
  assert.match(browser,/cricketGoldScorecardMarkup/);
  assert.match(browser,/MutationObserver/);
  assert.match(browser,/data-cricket-gold-scorecard/);
  assert.match(pkg,/node --check cricket-gold-core\.js/);
  assert.match(pkg,/node --check cricket-gold\.js/);
  assert.match(prepare,/allowed = new Set\(\['\.html', '\.js'/);
});
