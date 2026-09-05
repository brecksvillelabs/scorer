import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, cricketAction } from '../sports.js';
import { cricketGoldScorecardMarkup } from '../cricket-gold-core.js';

test('cricket fall of wickets uses familiar wicket-score notation', () => {
  let state = createInitialState({
    sport:'cricket', battingTeam:'A',
    teamA:{ name:'India', roster:['Kohli','Rahul','Rohit'] },
    teamB:{ name:'Pakistan', roster:['Shaheen','Naseem'] }
  });
  state = cricketAction(state,'4');
  state = cricketAction(state,'wicket');
  const html = cricketGoldScorecardMarkup(state);
  assert.match(html,/Fall of wickets/);
  assert.match(html,/1-4 \(Kohli, 0\.2 ov\)/);
  assert.doesNotMatch(html,/4\/1 \(Kohli/);
});
