import test from 'node:test';
import assert from 'node:assert/strict';

import { badmintonPoint, createInitialState } from '../sports.js';
import { formatShareMessage, fullScoreboardMarkup } from '../scoreboards.js';

function make(preset, {bestOf, gameTo, winBy=2, cap, matchType='singles'} = {}) {
  return createInitialState({
    sport:'badminton',
    trackingMode:'advanced',
    badmintonPreset:preset,
    badmintonBestOf:bestOf,
    badmintonGameTo:gameTo,
    badmintonWinBy:winBy,
    badmintonCap:cap,
    badmintonMatchType:matchType,
    teamA:{name:'Lake Erie Racquets',roster:['Ava Patel','Maya Chen']},
    teamB:{name:'Cuyahoga Shuttlers',roster:['Olivia Brown','Aisha Khan']}
  });
}

function rally(state, side, count) {
  let next=state;
  for(let i=0;i<count;i++) next=badmintonPoint(next,side);
  return next;
}

test('India short 3x15 supports deuce and 21-point cap', () => {
  let state=make('india-3x15',{bestOf:3,gameTo:15,cap:21});
  state=rally(state,'A',14);
  state=rally(state,'B',14);
  state=badmintonPoint(state,'A');
  assert.equal(state.finished,false);
  assert.equal(state.badminton.points.A,15);
  state=badmintonPoint(state,'B');
  state=badmintonPoint(state,'A');
  state=badmintonPoint(state,'A');
  assert.equal(state.badminton.games.A,1);
  assert.deepEqual(state.badminton.gameHistory[0].scoreA,17);
  assert.deepEqual(state.badminton.gameHistory[0].scoreB,15);

  let capped=make('india-3x15',{bestOf:1,gameTo:15,cap:21});
  capped=rally(capped,'A',20);
  capped=rally(capped,'B',20);
  capped=badmintonPoint(capped,'A');
  assert.equal(capped.finished,true);
  assert.equal(capped.badminton.gameHistory[0].scoreA,21);
  assert.equal(capped.badminton.gameHistory[0].scoreB,20);
});

test('BAI/BWF 3x21 retains classic win-by-two and cap 30', () => {
  let state=make('bai-3x21',{bestOf:3,gameTo:21,cap:30});
  state=rally(state,'A',20);
  state=rally(state,'B',20);
  state=badmintonPoint(state,'A');
  assert.equal(state.badminton.games.A,0);
  state=badmintonPoint(state,'A');
  assert.equal(state.badminton.games.A,1);
  assert.equal(state.badminton.gameHistory[0].scoreA,22);
  assert.equal(state.badminton.gameHistory[0].scoreB,20);
});

test('quick presets can finish in one game', () => {
  let quick21=make('quick-1x21',{bestOf:1,gameTo:21,cap:30});
  quick21=rally(quick21,'A',21);
  assert.equal(quick21.finished,true);
  assert.equal(quick21.winner,'A');

  let quick15=make('club-1x15',{bestOf:1,gameTo:15,cap:21});
  quick15=rally(quick15,'B',15);
  assert.equal(quick15.finished,true);
  assert.equal(quick15.winner,'B');
});

test('Badminton scorecard and share disclose the active preset', () => {
  let state=make('india-3x15',{bestOf:3,gameTo:15,cap:21,matchType:'doubles'});
  state=rally(state,'A',3);
  const html=fullScoreboardMarkup(state);
  const share=formatShareMessage(state);
  assert.match(html,/India short 3×15/);
  assert.match(html,/15 \/ \+2/);
  assert.match(html,/Doubles/);
  assert.match(share,/India short 3×15/);
  assert.match(share,/cap 21/);
});
