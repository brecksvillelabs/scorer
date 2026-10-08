import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createInitialState,
  footballApplyPlay,
  footballFieldSnapshot,
  footballScore,
  footballSituationLabel,
  footballSpotLabel,
  setFootballDirection,
  setFootballPossession,
  setFootballSituation,
  setFootballSpot
} from '../sports.js';

function make(overrides = {}) {
  return createInitialState({
    sport:'football',
    periodMinutes:12,
    trackingMode:'advanced',
    teamA:{ name:'Lake Erie Gridiron', roster:['Aiden Carter','Noah Patel','Liam Brooks'] },
    teamB:{ name:'Cuyahoga Knights', roster:['Ethan Reed','Mason Clark','Jayden Hill'] },
    ...overrides
  });
}

test('football field uses an absolute 0-100 coordinate with familiar yard-line labels', () => {
  let state=make();
  state=setFootballSpot(state,25);
  assert.equal(footballSpotLabel(state),'Lake Erie Gridiron 25');
  state=setFootballSpot(state,50);
  assert.equal(footballSpotLabel(state),'50');
  state=setFootballSpot(state,78);
  assert.equal(footballSpotLabel(state),'Cuyahoga Knights 22');
});

test('football yardage advances the ball, down and distance', () => {
  let state=make();
  state=setFootballSpot(state,25);
  state=setFootballSituation(state,1,10);
  state=footballApplyPlay(state,4,'Aiden Carter','run');
  assert.equal(state.football.ballSpot,29);
  assert.equal(state.football.down,2);
  assert.equal(state.football.distance,6);
  assert.equal(state.football.lastPlay.player,'Aiden Carter');

  state=footballApplyPlay(state,7,'Noah Patel','pass');
  assert.equal(state.football.ballSpot,36);
  assert.equal(state.football.down,1);
  assert.equal(state.football.distance,10);
});

test('football negative yardage increases distance to gain', () => {
  let state=make();
  state=setFootballSituation(state,2,7);
  state=footballApplyPlay(state,-3,'Aiden Carter','run');
  assert.equal(state.football.down,3);
  assert.equal(state.football.distance,10);
  assert.equal(state.football.ballSpot,22);
});

test('fourth-down failure flips possession and attack direction at the same spot', () => {
  let state=make();
  state=setFootballSpot(state,40);
  state=setFootballSituation(state,4,5);
  state=footballApplyPlay(state,2,'Aiden Carter','run');
  assert.equal(state.football.ballSpot,42);
  assert.equal(state.football.possession,'B');
  assert.equal(state.football.offenseDirection,-1);
  assert.equal(state.football.down,1);
  assert.equal(state.football.distance,10);
  assert.equal(state.football.lastPlay.turnoverOnDowns,true);
});

test('manual possession and direction remain explicitly editable', () => {
  let state=make();
  state=setFootballPossession(state,'B',true);
  assert.equal(state.football.possession,'B');
  assert.equal(state.football.offenseDirection,-1);
  state=setFootballDirection(state,1);
  assert.equal(state.football.offenseDirection,1);
});

test('goal-to-go situation is derived from the field position', () => {
  let state=make();
  state=setFootballSpot(state,94);
  state=setFootballSituation(state,2,8);
  assert.equal(footballSituationLabel(state),'2nd & Goal');
});

test('football scoring records player, scoring type and field context', () => {
  let state=make();
  state=setFootballSpot(state,86);
  state=footballScore(state,'A',6,'touchdown','Noah Patel');
  assert.equal(state.teamA.score,6);
  const event=state.events.at(-1);
  assert.equal(event.type,'football.score');
  assert.equal(event.scoringType,'touchdown');
  assert.equal(event.player,'Noah Patel');
  assert.equal(event.ballSpot,86);
});

test('football field snapshot is stable and directly consumable by a future webpage', () => {
  let state=make();
  state=setFootballSpot(state,35);
  state=setFootballSituation(state,3,4);
  const snapshot=footballFieldSnapshot(state);
  assert.equal(snapshot.schemaVersion,1);
  assert.equal(snapshot.ballSpot,35);
  assert.equal(snapshot.lineToGainSpot,39);
  assert.equal(snapshot.situation,'3rd & 4');
  assert.equal(snapshot.possession,'A');
  assert.equal(snapshot.teams.A.name,'Lake Erie Gridiron');
});

test('football rosters can carry a full team-sized import', () => {
  const roster=Array.from({length:60},(_,i)=>`Player ${i+1}`);
  const state=make({ teamA:{ name:'Large Roster', roster } });
  assert.equal(state.teamA.roster.length,60);
});
