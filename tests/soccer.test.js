import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advancePeriod,
  createInitialState,
  finishSoccerMatch,
  soccerCard,
  soccerGoal
} from '../sports.js';
import { formatShareMessage, fullScoreboardMarkup } from '../scoreboards.js';

function match() {
  return createInitialState({
    sport:'soccer',
    periodMinutes:45,
    teamA:{ name:'Lake Erie FC', roster:['Ava Patel','Maya Chen','Sofia Ramirez'] },
    teamB:{ name:'Cleveland City SC', roster:['Olivia Brown','Aisha Khan','Grace Lee'] }
  });
}

test('soccer goals and cards produce a familiar chronological match-center scorecard', () => {
  let state = match();
  state.clock.seconds = 12 * 60;
  state = soccerGoal(state,'A',1);
  state.clock.seconds = 31 * 60;
  state = soccerCard(state,'B','yellow',1);

  state = advancePeriod(state,1);
  state.clock.seconds = 22 * 60;
  state = soccerGoal(state,'B',1);
  state.clock.seconds = 33 * 60;
  state = soccerCard(state,'A','red',1);

  const html = fullScoreboardMarkup(state);
  assert.match(html,/Half-by-half/);
  assert.match(html,/Match events/);
  assert.match(html,/12'/);
  assert.match(html,/31'/);
  assert.match(html,/67'/);
  assert.match(html,/78'/);
  assert.match(html,/Yellow card/);
  assert.match(html,/Red card/);
  assert.match(html,/1H/);
  assert.match(html,/2H/);
  assert.match(html,/Lake Erie FC/);
  assert.match(html,/Cleveland City SC/);
  assert.match(html,/Yellow cards/);
  assert.match(html,/Red cards/);
});

test('soccer share text keeps cumulative second-half timing and card totals', () => {
  let state = match();
  state = soccerGoal(state,'A',1);
  state = advancePeriod(state,1);
  state.clock.seconds = 22 * 60;
  state = soccerCard(state,'B','yellow',1);
  const text = formatShareMessage(state);
  assert.match(text,/2nd half/);
  assert.match(text,/67'/);
  assert.match(text,/Lake Erie FC 1–0 Cleveland City SC/);
  assert.match(text,/0Y\/0R/);
  assert.match(text,/1Y\/0R/);
});

test('soccer final whistle freezes the match and declares winner or draw', () => {
  let state = match();
  state = soccerGoal(state,'A',1);
  state = soccerGoal(state,'A',1);
  state = soccerGoal(state,'B',1);
  state = finishSoccerMatch(state);
  assert.equal(state.finished,true);
  assert.equal(state.winner,'A');
  assert.equal(state.clock.running,false);
  assert.match(fullScoreboardMarkup(state),/Lake Erie FC won/);

  let draw = match();
  draw = finishSoccerMatch(draw);
  assert.equal(draw.winner,'tie');
  assert.match(formatShareMessage(draw),/Tied/);
});
