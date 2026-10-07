import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialState, tennisPoint, formatTennisPoint } from '../sports.js';
import { formatShareMessage, fullScoreboardMarkup } from '../scoreboards.js';

function make(preset, overrides = {}) {
  const defaults = {
    'standard-3': { tennisBestOf:3, tennisNoAd:false, tennisDecidingMatchTiebreakTo:0, tennisMatchType:'singles' },
    'standard-5': { tennisBestOf:5, tennisNoAd:false, tennisDecidingMatchTiebreakTo:0, tennisMatchType:'singles' },
    'no-ad-3': { tennisBestOf:3, tennisNoAd:true, tennisDecidingMatchTiebreakTo:0, tennisMatchType:'singles' },
    'doubles-10': { tennisBestOf:3, tennisNoAd:true, tennisDecidingMatchTiebreakTo:10, tennisMatchType:'doubles' }
  }[preset];
  return createInitialState({
    sport:'tennis',
    tennisPreset:preset,
    ...defaults,
    ...overrides,
    teamA:{name:'Lake Erie Aces',roster:['Ava Patel','Maya Chen']},
    teamB:{name:'Cuyahoga Baseliners',roster:['Olivia Brown','Aisha Khan']}
  });
}

function points(state, side, count) {
  let next=state;
  for(let i=0;i<count;i++) next=tennisPoint(next,side);
  return next;
}

test('No-Ad uses a deciding point at deuce', () => {
  let state=make('no-ad-3');
  state=points(state,'A',3);
  state=points(state,'B',3);
  assert.equal(formatTennisPoint(state,'A'),'40');
  assert.equal(formatTennisPoint(state,'B'),'40');
  state=tennisPoint(state,'A');
  assert.equal(state.tennis.games.A,1);
  assert.deepEqual(state.tennis.points,{A:0,B:0});
});

test('No-Ad still ends ordinary games on the fourth point', () => {
  let state=make('no-ad-3');
  state=points(state,'A',4);
  assert.equal(state.tennis.games.A,1);
  assert.equal(state.tennis.games.B,0);
});

test('standard tie-break remains first to 7 by two', () => {
  let state=make('standard-3');
  state.tennis.games={A:6,B:6};
  state.tennis.tiebreak=true;
  state.tennis.tiebreakStartServer='A';
  state.tennis.servingTeam='A';
  state.tennis.tiebreakPoints={A:6,B:6};
  state=tennisPoint(state,'A');
  assert.equal(state.finished,false);
  assert.equal(state.tennis.tiebreakPoints.A,7);
  state=tennisPoint(state,'A');
  assert.equal(state.tennis.sets.A,1);
  assert.equal(state.tennis.setHistory[0].scoreA,7);
  assert.equal(state.tennis.setHistory[0].scoreB,6);
  assert.equal(state.tennis.setHistory[0].tiebreak,'8-6');
});

test('doubles preset replaces the deciding set with a 10-point match tie-break', () => {
  let state=make('doubles-10');
  state.tennis.sets.A=1;
  state.period=2;
  state.tennis.games={A:0,B:5};
  state=points(state,'B',4);
  assert.equal(state.tennis.sets.B,1);
  assert.equal(state.tennis.matchTiebreak,true);
  assert.equal(state.period,3);

  state.tennis.matchTiebreakPoints={A:9,B:8};
  state=tennisPoint(state,'A');
  assert.equal(state.finished,true);
  assert.equal(state.winner,'A');
  assert.equal(state.tennis.sets.A,2);
  assert.equal(state.tennis.setHistory.at(-1).matchTiebreak,'10-8');
});

test('best-of-five requires three sets', () => {
  let state=make('standard-5');
  state.tennis.sets.A=2;
  state.tennis.games={A:5,B:0};
  state=points(state,'A',4);
  assert.equal(state.finished,true);
  assert.equal(state.tennis.sets.A,3);
});

test('Tennis full scorecard and share disclose preset, No-Ad and match tie-break', () => {
  let state=make('doubles-10');
  state.tennis.sets={A:1,B:1};
  state.tennis.matchTiebreak=true;
  state.tennis.matchTiebreakPoints={A:6,B:5};
  state.tennis.matchTiebreakStartServer='A';
  const html=fullScoreboardMarkup(state);
  const share=formatShareMessage(state);
  assert.match(html,/Doubles match tie-break 10/);
  assert.match(html,/No-Ad/);
  assert.match(html,/MTB/);
  assert.match(share,/Doubles match tie-break 10/);
  assert.match(share,/Match TB 6–5/);
});
