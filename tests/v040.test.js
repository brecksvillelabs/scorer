import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DEFAULT_REMINDER_MINUTES, SCHEDULE_STORAGE_KEY, createScheduledGame, sortScheduledGames,
  upcomingGames, sportMeta, reminderId, plannedNotifications, notificationTarget, gameTitle
} from '../v040-core.js';

const SPORTS = ['volleyball','basketball','soccer','football','cricket','tennis','badminton','lacrosse','kabaddi','baseball'];

test('v0.4 schedule storage is local-first and all ten sports are recognized', () => {
  assert.equal(SCHEDULE_STORAGE_KEY, 'scorer-upcoming-games-v1');
  assert.deepEqual(DEFAULT_REMINDER_MINUTES, [1440,120,30]);
  for (const sport of SPORTS) {
    assert.notEqual(sportMeta(sport).name, 'Game', sport);
    assert.ok(sportMeta(sport).icon, sport);
  }
});

test('scheduled games normalize and sort by start time', () => {
  const now = Date.UTC(2026,7,27,16,0,0);
  const later = createScheduledGame({ id:'later', sport:'baseball', teamA:'Bees', teamB:'Tigers', startsAt:new Date(now + 4*3600e3).toISOString() }, now);
  const sooner = createScheduledGame({ id:'sooner', sport:'volleyball', teamA:'A', teamB:'B', startsAt:new Date(now + 2*3600e3).toISOString() }, now);
  assert.deepEqual(sortScheduledGames([later, sooner]).map(x=>x.id), ['sooner','later']);
  assert.equal(gameTitle(later), 'Bees vs Tigers');
});

test('upcoming list keeps imminent/recent games but excludes stale games', () => {
  const now = Date.UTC(2026,7,27,16,0,0);
  const make = (id, offset) => createScheduledGame({ id, startsAt:new Date(now + offset).toISOString() }, now);
  const ids = upcomingGames([
    make('future', 3600e3),
    make('recent', -2*3600e3),
    make('stale', -5*3600e3)
  ], now).map(x=>x.id);
  assert.deepEqual(ids, ['recent','future']);
});

test('reminder ids are stable, positive and distinct per offset', () => {
  const ids = DEFAULT_REMINDER_MINUTES.map(min => reminderId('game-123', min));
  assert.deepEqual(ids, DEFAULT_REMINDER_MINUTES.map(min => reminderId('game-123', min)));
  assert.equal(new Set(ids).size, 3);
  assert.ok(ids.every(id => Number.isInteger(id) && id > 0 && id <= 2147483000));
});

test('native notification plan uses exact requested lead times and deep-link metadata', () => {
  const now = Date.UTC(2026,7,27,12,0,0);
  const start = now + 48*3600e3;
  const game = createScheduledGame({
    id:'sched-abc',
    sport:'soccer',
    teamA:'Bees',
    teamB:'Bears',
    startsAt:new Date(start).toISOString(),
    reminders:[1440,120,30]
  }, now);
  const plan = plannedNotifications(game, now);
  assert.equal(plan.length, 3);
  assert.deepEqual(plan.map(x => (start - x.at.getTime()) / 60000), [1440,120,30]);
  assert.ok(plan.every(x => x.extra.gameId === 'sched-abc'));
  assert.ok(plan.every(x => notificationTarget(x.extra.route) === 'sched-abc'));
});

test('past reminder occurrences are not scheduled', () => {
  const now = Date.UTC(2026,7,27,12,0,0);
  const start = now + 90*60000;
  const game = createScheduledGame({
    id:'soon', startsAt:new Date(start).toISOString(), reminders:[1440,120,30]
  }, now);
  const plan = plannedNotifications(game, now);
  assert.equal(plan.length, 1);
  assert.equal((start - plan[0].at.getTime()) / 60000, 30);
});

test('notification target only accepts Scorer game deep links', () => {
  assert.equal(notificationTarget('scorer://game/abc%20123'), 'abc 123');
  assert.equal(notificationTarget('https://example.com/game/abc'), '');
  assert.equal(notificationTarget('scorer://other/abc'), '');
});

test('Upcoming Games is wired into Home and scheduled games hand off to Quick Start format', async () => {
  const ui = await readFile(new URL('../v040.js', import.meta.url), 'utf8');
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const quick = await readFile(new URL('../v039.js', import.meta.url), 'utf8');
  assert.match(ui, /Upcoming Games/);
  assert.match(ui, /scorer:prepare-scheduled-game/);
  assert.match(app, /scorer:prepare-scheduled-game/);
  assert.match(app, /function prepareScheduledGame/);
  assert.match(quick, /scorer:scheduled-game-ready/);
  assert.match(quick, /setStep\('format'\)/);
});

test('native bridge exposes LocalNotifications, Share and App without making cloud/account mandatory', async () => {
  const bridge = await readFile(new URL('../native-bridge.js', import.meta.url), 'utf8');
  assert.match(bridge, /plugin\('LocalNotifications'\)/);
  assert.match(bridge, /plugin\('Share'\)/);
  assert.match(bridge, /plugin\('App'\)/);
  assert.match(bridge, /localNotificationActionPerformed/);
  assert.match(bridge, /appUrlOpen/);
  assert.doesNotMatch(bridge, /firebase|firestore|google.?sign.?in/i);
});

test('Android shell requests notification permission and supports user-granted exact alarms', async () => {
  const manifest = await readFile(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  const config = JSON.parse(await readFile(new URL('../capacitor.config.json', import.meta.url), 'utf8'));
  assert.match(manifest, /android\.permission\.POST_NOTIFICATIONS/);
  assert.match(manifest, /android\.permission\.CAMERA/);
  assert.match(manifest, /android\.permission\.SCHEDULE_EXACT_ALARM/);
  assert.doesNotMatch(manifest, /USE_EXACT_ALARM/);
  assert.match(manifest, /android:scheme="scorer"/);
  assert.match(manifest, /android:host="game"/);
  assert.equal(config.appId, 'com.brecksvillelabs.scorer');
  assert.equal(config.webDir, 'dist');
});

test('Capacitor dependencies are version-pinned and service worker is disabled in native shell', async () => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(pkg.dependencies['@capacitor/core'], '8.5.0');
  assert.equal(pkg.dependencies['@capacitor/android'], '8.5.0');
  assert.equal(pkg.dependencies['@capacitor/local-notifications'], '8.3.1');
  assert.equal(pkg.dependencies['@capacitor/app'], '8.1.1');
  assert.equal(pkg.dependencies['@capacitor/share'], '8.0.1');
  assert.equal(pkg.devDependencies['@capacitor/cli'], '8.5.0');
  assert.match(app, /!window\.Capacitor\?\.isNativePlatform\?\.\(\)/);
});

test('fresh installs open the Home hub instead of forcing setup', async () => {
  const source = await readFile(new URL('../v040.js', import.meta.url), 'utf8');
  assert.match(source, /function showFreshHome/);
  assert.match(source, /scorer-v040-home-shown/);
  assert.match(source, /\$\('closeSetupBtn'\)\?\.click\(\)/);
  assert.match(source, /\$\('homeBtn'\)\?\.click\(\)/);
});

test('Upcoming Games correction UX stays in-app and rejects past schedule times', async () => {
  const source = await readFile(new URL('../v040.js', import.meta.url), 'utf8');
  assert.match(source, /id="v040DeleteConfirm"/);
  assert.match(source, /data-v040-delete-action="confirm"/);
  assert.match(source, /Choose a future game time/);
  assert.doesNotMatch(source, /\bconfirm\s*\(/);
});

test('native build preparation and Android Gradle shell are checked in', async () => {
  const prep = await readFile(new URL('../scripts/prepare-native.mjs', import.meta.url), 'utf8');
  const gradle = await readFile(new URL('../android/app/build.gradle', import.meta.url), 'utf8');
  const settings = await readFile(new URL('../android/capacitor.settings.gradle', import.meta.url), 'utf8');
  assert.match(prep, /Prepared Scorer web assets for Capacitor/);
  assert.match(gradle, /applicationId "com\.brecksvillelabs\.scorer"/);
  assert.match(gradle, /versionName "0\.\d+\.\d+"/);
  assert.match(settings, /capacitor-local-notifications/);
  assert.match(settings, /capacitor-share/);
});
