import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../sports.js';
import { createScorerState } from '../v035-core.js';
import { createBaseballState } from '../baseball-core.js';
import { formatShareGoldMessage } from '../share-gold-core.js';

const named = sport => ({ sport, teamA:{name:'Eagles',roster:['A1','A2','A3']}, teamB:{name:'Tigers',roster:['B1','B2','B3']} });

function everyMessageIsStandalone(states) {
  for (const state of states) {
    const text = formatShareGoldMessage(state);
    assert.match(text,/Eagles vs Tigers|Tigers vs Eagles/);
    assert.match(text,/Shared from Scorer$/);
    assert.ok(text.split('\n').length >= 3, `${state.sport} needs enough context`);
  }
}

test('Share Gold: all ten sports produce standalone fan-readable updates', () => {
  const states = [
    createInitialState(named('volleyball')),
    createInitialState(named('basketball')),
    createInitialState(named('soccer')),
    createInitialState(named('football')),
    createInitialState({...named('cricket'),battingTeam:'A'}),
    createInitialState(named('tennis')),
    createInitialState(named('badminton')),
    createScorerState(named('lacrosse'),createInitialState),
    createScorerState(named('kabaddi'),createInitialState),
    createBaseballState(named('baseball'),createInitialState)
  ];
  everyMessageIsStandalone(states);
});

test('Share Gold: volleyball leads with sets, current set and server', () => {
  const s = createInitialState(named('volleyball'));
  s.teamA.sets=2; s.teamB.sets=1; s.teamA.score=18; s.teamB.score=16; s.period=4;
  s.volleyball.servingTeam='A';
  s.volleyball.setHistory=[{scoreA:25,scoreB:20},{scoreA:22,scoreB:25},{scoreA:25,scoreB:19}];
  const text=formatShareGoldMessage(s);
  assert.match(text,/Eagles leads 2–1 sets • Set 4: 18–16/);
  assert.match(text,/Eagles serving/);
  assert.match(text,/25–20, 22–25, 25–19/);
});

test('Share Gold: basketball uses quarter clock, ball and compact team context', () => {
  const s=createInitialState(named('basketball'));
  s.teamA.score=62; s.teamB.score=58; s.teamA.fouls=3; s.teamB.fouls=4; s.period=3; s.clock.seconds=261;
  s.basketball.possession='B'; s.basketball.timeouts={A:2,B:1};
  const text=formatShareGoldMessage(s);
  assert.match(text,/Eagles 62–58 Tigers • Q3 4:21/);
  assert.match(text,/Tigers ball • Fouls 3–4 • TO 2–1/);
});

test('Share Gold: soccer reads like a football score update and never invents scorers', () => {
  const s=createInitialState(named('soccer'));
  s.teamA.score=2; s.teamB.score=1; s.teamA.yellows=1; s.teamB.yellows=2; s.clock.seconds=4020;
  const text=formatShareGoldMessage(s);
  assert.match(text,/Eagles 2–1 Tigers • 67'/);
  assert.match(text,/Cards: Eagles 1Y\/0R • Tigers 2Y\/0R/);
  assert.doesNotMatch(text,/scorer|goal by/i);
});

test('Share Gold: American football prioritizes down-distance and possession', () => {
  const s=createInitialState(named('football'));
  s.teamA.score=21; s.teamB.score=17; s.period=4; s.clock.seconds=134;
  s.football.down=3; s.football.distance=7; s.football.possession='B'; s.football.timeouts={A:2,B:1};
  const text=formatShareGoldMessage(s);
  assert.match(text,/Q4 2:14/);
  assert.match(text,/3rd & 7 • Tigers ball • TO Eagles 2, Tigers 1/);
});

test('Share Gold: tennis uses sets, current-set games, point score and server', () => {
  const s=createInitialState(named('tennis'));
  s.tennis.sets={A:1,B:0}; s.tennis.games={A:3,B:4}; s.tennis.points={A:2,B:1}; s.tennis.servingTeam='B'; s.period=2;
  s.tennis.setHistory=[{scoreA:6,scoreB:4}];
  const text=formatShareGoldMessage(s);
  assert.match(text,/Eagles leads 1–0 sets • Set 2: 3–4/);
  assert.match(text,/Current game 30–15 • Tigers serving/);
  assert.match(text,/Sets 6–4/);
});

test('Share Gold: badminton uses games, rally score and server', () => {
  const s=createInitialState(named('badminton'));
  s.badminton.games={A:1,B:0}; s.badminton.points={A:17,B:19}; s.badminton.servingTeam='B'; s.period=2;
  s.badminton.gameHistory=[{scoreA:21,scoreB:18}];
  const text=formatShareGoldMessage(s);
  assert.match(text,/Eagles leads 1–0 games • Game 2: 17–19/);
  assert.match(text,/Tigers serving/);
  assert.match(text,/Games 21–18/);
});

test('Share Gold: lacrosse reports honest possession or restart state', () => {
  const s=createScorerState(named('lacrosse'),createInitialState);
  s.teamA.score=8; s.teamB.score=7; s.period=4; s.clock.seconds=192;
  s.lacrosse.possession=null; s.lacrosse.restartType='faceoff/draw'; s.lacrosse.shotClockSeconds=80; s.lacrosse.shotClock=42;
  const text=formatShareGoldMessage(s);
  assert.match(text,/Eagles 8–7 Tigers • Q4 3:12/);
  assert.match(text,/Restart pending \(faceoff\/draw\) • Shot 42/);
});

test('Share Gold: kabaddi uses raider, raid clock, pending points and All Outs', () => {
  const s=createScorerState(named('kabaddi'),createInitialState);
  s.teamA.score=28; s.teamB.score=24; s.period=2; s.clock.seconds=511;
  s.kabaddi.raidingTeam='B'; s.kabaddi.raidClock=18; s.kabaddi.raidRunning=true; s.kabaddi.raidPoints=1;
  s.events.push({type:'kabaddi.all_out_bonus',side:'A'});
  const text=formatShareGoldMessage(s);
  assert.match(text,/2nd half 8:31/);
  assert.match(text,/Tigers raiding • Raid 18s • Pending \+1/);
  assert.match(text,/All Outs: Eagles 1–0 Tigers/);
});

test('Share Gold: baseball uses inning, outs, count, runners and R-H-E', () => {
  const s=createBaseballState(named('baseball'),createInitialState);
  // Baseball defaults to Side B batting first, so Tigers are visitors and Eagles are home.
  s.teamB.score=4; s.teamA.score=3; s.baseball.inning=7; s.baseball.half='bottom'; s.baseball.outs=2; s.baseball.balls=2; s.baseball.strikes=1;
  s.baseball.bases={first:true,second:false,third:true}; s.baseball.hits={A:6,B:8}; s.baseball.errors={A:1,B:0};
  const text=formatShareGoldMessage(s);
  assert.match(text,/Tigers 4–3 Eagles • Bot 7/);
  assert.match(text,/2 outs • Count 2–1 • Runners 1st & 3rd/);
  assert.match(text,/R\/H\/E: Tigers 4\/8\/0 • Eagles 3\/6\/1/);
});

test('Share Gold: break states strip live-only possession, server, down and raid context', () => {
  const volleyball=createInitialState(named('volleyball'));
  volleyball.volleyball.phase='set_break'; volleyball.period=2; volleyball.volleyball.servingTeam='A';
  assert.doesNotMatch(formatShareGoldMessage(volleyball),/serving/i);

  const basketball=createInitialState(named('basketball'));
  basketball.period=2; basketball.clock.seconds=0; basketball.clock.running=false; basketball.basketball.possession='A';
  const basketText=formatShareGoldMessage(basketball);
  assert.match(basketText,/HALFTIME/);
  assert.doesNotMatch(basketText,/ball •/);

  const football=createInitialState(named('football'));
  football.clock.seconds=0; football.clock.running=false; football.football.down=4; football.football.possession='B';
  assert.doesNotMatch(formatShareGoldMessage(football),/& 10|Tigers ball/);

  const kabaddi=createScorerState(named('kabaddi'),createInitialState);
  kabaddi.clock.seconds=0; kabaddi.clock.running=false; kabaddi.kabaddi.raidRunning=false; kabaddi.kabaddi.raidPoints=0;
  assert.doesNotMatch(formatShareGoldMessage(kabaddi),/raiding|Raid \d+s/i);
});
