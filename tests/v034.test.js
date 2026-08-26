import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, cricketAction, setCricketRole } from '../sports.js';
import { eligibleNextBowlers, nextGeneratedBowlerName, canChooseBowler, bowlerFigures } from '../v034-core.js';

function finishOver(state) {
  let next = state;
  for (let i = 0; i < 6; i++) next = cricketAction(next, '0');
  return next;
}

test('no-roster cricket offers Bowler 2 after Bowler 1 completes the first over', () => {
  let state = createInitialState({ sport: 'cricket' });
  state = finishOver(state);
  assert.equal(state.cricket.needsBowler, true);
  assert.equal(state.cricket.bowler, 'Bowler 1');
  assert.deepEqual(eligibleNextBowlers(state).map(x => x.name), ['Bowler 2']);
});

test('saved roster bowler chooser excludes the bowler from the previous over', () => {
  let state = createInitialState({ sport: 'cricket', teamB: { roster: ['Sam', 'Mike', 'Leo'] } });
  state = finishOver(state);
  assert.equal(state.cricket.bowler, 'Sam');
  assert.deepEqual(eligibleNextBowlers(state).map(x => x.name), ['Mike', 'Leo']);
});

test('same bowler cannot be chosen for consecutive overs', () => {
  let state = createInitialState({ sport: 'cricket', teamB: { roster: ['Sam', 'Mike'] } });
  state = finishOver(state);
  assert.equal(canChooseBowler(state, 'Sam'), false);
  assert.equal(canChooseBowler(state, 'Mike'), true);
});

test('no-roster second over can return to Bowler 1 or add Bowler 3 but not reuse Bowler 2', () => {
  let state = createInitialState({ sport: 'cricket' });
  state = finishOver(state);
  state = setCricketRole(state, 'bowler', 'Bowler 2');
  state = finishOver(state);
  const names = eligibleNextBowlers(state).map(x => x.name);
  assert.ok(names.includes('Bowler 1'));
  assert.ok(names.includes('Bowler 3'));
  assert.ok(!names.includes('Bowler 2'));
  assert.equal(nextGeneratedBowlerName(state), 'Bowler 3');
});

test('bowler cards expose overs, runs, wickets and economy', () => {
  let state = createInitialState({ sport: 'cricket', teamB: { roster: ['Sam', 'Mike'] } });
  state = cricketAction(state, '4');
  for (let i = 0; i < 5; i++) state = cricketAction(state, '0');
  const figures = bowlerFigures(state, 'Sam');
  assert.equal(figures.overs, '1.0');
  assert.equal(figures.runs, 4);
  assert.equal(figures.wickets, 0);
  assert.equal(figures.economy, '4.00');
});
