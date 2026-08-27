import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  QUICK_START_STEPS, sportRoleCopy, quickFormatPresets, presetMatchesValues, nextQuickStep
} from '../v039-core.js';

const supported = ['volleyball','basketball','soccer','football','cricket','tennis','badminton','lacrosse','kabaddi','baseball'];

test('Quick Start is a three-step sport → teams → format flow', () => {
  assert.deepEqual(QUICK_START_STEPS, ['sport','teams','format']);
  assert.equal(nextQuickStep('sport'), 'teams');
  assert.equal(nextQuickStep('teams'), 'format');
  assert.equal(nextQuickStep('format'), 'format');
  assert.equal(nextQuickStep('teams', -1), 'sport');
});

test('all ten sports expose at least one novice format preset', () => {
  for (const sport of supported) {
    assert.ok(quickFormatPresets(sport).length >= 1, sport);
  }
});

test('volleyball quick format offers Best of 3 and Best of 5', () => {
  const presets = quickFormatPresets('volleyball');
  assert.deepEqual(presets.map(x => x.values.settingBestOf), ['3','5']);
});

test('baseball quick format makes 6, 7 and 9 innings first-class choices', () => {
  const presets = quickFormatPresets('baseball');
  assert.deepEqual(presets.map(x => x.values.settingBaseballInnings), ['6','7','9']);
});

test('cricket quick format maps T20 and ODI to their overs', () => {
  const presets = quickFormatPresets('cricket');
  assert.deepEqual(presets[0].values, { settingCricketFormat:'T20', settingOvers:'20' });
  assert.deepEqual(presets[1].values, { settingCricketFormat:'ODI', settingOvers:'50' });
});

test('lacrosse quick format keeps Field and Sixes distinct', () => {
  const [field, sixes] = quickFormatPresets('lacrosse');
  assert.equal(field.values.settingLacrosseDiscipline, 'field');
  assert.equal(field.values.settingMinutes, '15');
  assert.equal(sixes.values.settingLacrosseDiscipline, 'sixes');
  assert.equal(sixes.values.settingMinutes, '8');
  assert.equal(sixes.values.settingLacrosseShotClock, '30');
});

test('racket sports use player/team terminology', () => {
  assert.equal(sportRoleCopy('tennis').sideA, 'Player / Team A');
  assert.equal(sportRoleCopy('badminton').nameB, 'Player / team name');
  assert.equal(sportRoleCopy('baseball').sideA, 'Team A');
});

test('preset selection compares the underlying trusted setup fields', () => {
  const preset = quickFormatPresets('baseball')[1];
  assert.equal(presetMatchesValues(preset, { settingBaseballInnings:'7' }), true);
  assert.equal(presetMatchesValues(preset, { settingBaseballInnings:'9' }), false);
});

test('Quick Start layer auto-advances after sport and keeps advanced setup collapsed', async () => {
  const source = await readFile(new URL('../v039.js', import.meta.url), 'utf8');
  assert.match(source, /setStep\('teams'\)/);
  assert.match(source, /Customize team/);
  assert.match(source, /Advanced match options/);
  assert.match(source, /data-v039-preset/);
  assert.match(source, /settingBaseballFirstBat/);
  assert.match(source, /settingBatting/);
  assert.match(source, /settingKabaddiFirstRaid/);
});

test('Quick Start is an additive layer over existing setup and scoring scripts', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(html, /v039\.css/);
  assert.match(html, /v039\.js/);
  assert.match(html, /id="sportGrid"/);
  assert.match(html, /id="startGameBtn"/);
  assert.match(sw, /v039\.css/);
  assert.match(sw, /v039\.js/);
});
