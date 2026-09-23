import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../sports.js';
import { createScorerState } from '../v035-core.js';
import { createBaseballState } from '../baseball-core.js';
import { createTeamProfile, upsertTeamProfile, profilesForSport } from '../journal.js';
import { formatShareGoldMessage } from '../share-gold-core.js';

const SPORT_SPECS = [
  ['volleyball',12], ['basketball',12], ['soccer',18], ['football',22], ['cricket',15],
  ['tennis',4], ['badminton',4], ['lacrosse',18], ['kabaddi',12], ['baseball',15]
];

const PERMUTATIONS = [
  ['A','B'], ['B','A'], ['B','C'], ['C','B'], ['C','A'], ['A','C']
];

const COLORS = { A:'#1d4ed8', B:'#be123c', C:'#047857' };

function rosterFor(sport,label,count) {
  return Array.from({length:count},(_,index) => `${sport.toUpperCase()}-${label}-${String(index + 1).padStart(2,'0')}`);
}

function logoFor(sport,label) {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect width='96' height='96' rx='18' fill='${encodeURIComponent(COLORS[label])}'/%3E%3Ctext x='48' y='58' text-anchor='middle' font-size='36' fill='white'%3E${sport[0].toUpperCase()}${label}%3C/text%3E%3C/svg%3E`;
}

function teamFor(sport,label,count) {
  return {
    name:`${sport[0].toUpperCase() + sport.slice(1)} QC ${label}`,
    color:COLORS[label],
    logo:logoFor(sport,label),
    roster:rosterFor(sport,label,count)
  };
}

function createSportState(sport,teamA,teamB) {
  const options = { sport, teamA, teamB };
  if (sport === 'cricket') options.battingTeam = 'A';
  if (sport === 'baseball') return createBaseballState(options, createInitialState);
  if (sport === 'lacrosse' || sport === 'kabaddi') return createScorerState(options, createInitialState);
  return createInitialState(options);
}

test('All-sports QC matrix persists three full saved teams and exercises all 60 ordered matchups', () => {
  let gameCount = 0;

  for (const [sport,rosterCount] of SPORT_SPECS) {
    const teams = Object.fromEntries(['A','B','C'].map(label => [label, teamFor(sport,label,rosterCount)]));
    let favorites = [];

    for (const label of ['A','B','C']) {
      const profile = createTeamProfile(teams[label], sport, `qc-${sport}-${label.toLowerCase()}`);
      favorites = upsertTeamProfile(favorites, profile);
    }

    const saved = profilesForSport(favorites, sport);
    assert.equal(saved.length,3,`${sport}: three saved teams`);
    for (const profile of saved) {
      assert.equal(profile.roster.length,rosterCount,`${sport}: full roster retained for ${profile.name}`);
      assert.match(profile.logo,/^data:image\/svg\+xml/,`${sport}: logo retained for ${profile.name}`);
    }

    for (const [left,right] of PERMUTATIONS) {
      const state = createSportState(sport, teams[left], teams[right]);
      assert.equal(state.sport,sport);
      assert.equal(state.teamA.name,teams[left].name);
      assert.equal(state.teamB.name,teams[right].name);
      assert.equal(state.teamA.roster.length,rosterCount);
      assert.equal(state.teamB.roster.length,rosterCount);
      assert.ok(state.teamA.logo && state.teamB.logo,`${sport} ${left}->${right}: logos present`);

      const message = formatShareGoldMessage(state);
      assert.ok(message.includes(teams[left].name),`${sport} ${left}->${right}: Share Gold contains Side A`);
      assert.ok(message.includes(teams[right].name),`${sport} ${left}->${right}: Share Gold contains Side B`);
      assert.match(message,/Shared from Scorer$/);
      gameCount += 1;
    }
  }

  assert.equal(gameCount,60);
});
