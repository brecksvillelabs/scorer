import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('v0.4.1 verifies scheduled reminders by reading Android pending queue', async () => {
  const source = await readFile(new URL('../native-bridge.js', import.meta.url), 'utf8');
  assert.match(source, /await local\.schedule\(/);
  assert.match(source, /await local\.getPending\(\)/);
  assert.match(source, /pending\.length !== items\.length/);
  assert.match(source, /Android only queued/);
});

test('game reminders use a dedicated high-importance Android channel', async () => {
  const source = await readFile(new URL('../native-bridge.js', import.meta.url), 'utf8');
  assert.match(source, /scorer-game-reminders/);
  assert.match(source, /name: 'Game reminders'/);
  assert.match(source, /importance: 4/);
  assert.match(source, /channelId: REMINDER_CHANNEL_ID/);
  assert.doesNotMatch(source, /actionTypeId:''/);
});

test('native reminder diagnostics expose permission, pending queue, channels and exact-alarm state', async () => {
  const source = await readFile(new URL('../native-bridge.js', import.meta.url), 'utf8');
  assert.match(source, /export async function reminderDiagnostics/);
  assert.match(source, /local\.checkPermissions/);
  assert.match(source, /local\.getPending/);
  assert.match(source, /local\.listChannels/);
  assert.match(source, /checkExactNotificationSetting/);
});

test('device diagnostics separate immediate notification delivery from scheduled alarm queueing', async () => {
  const bridge = await readFile(new URL('../native-bridge.js', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../v040.js', import.meta.url), 'utf8');
  assert.match(bridge, /export async function sendImmediateTestNotification/);
  assert.match(bridge, /Scorer notifications are working/);
  assert.match(bridge, /export async function scheduleTestReminder/);
  assert.match(bridge, /Android did not keep the test reminder in its pending queue/);
  assert.match(ui, /Send test now/);
  assert.match(ui, /Queue short test/);
  assert.match(ui, /sendImmediateTestNotification\(\)/);
  assert.match(ui, /scheduleTestReminder\(10\)/);
});

test('reminder scheduling errors are no longer overwritten by a local-save success toast', async () => {
  const ui = await readFile(new URL('../v040.js', import.meta.url), 'utf8');
  assert.match(ui, /let reminderError = ''/);
  assert.match(ui, /reminder failed:/);
  assert.match(ui, /verified in Android/);
  assert.doesNotMatch(ui, /catch \(error\) \{ toast\(\`Game saved · reminder error:/);
});

test('Android reminder icon, vibration and Capacitor plugin config are present', async () => {
  const config = JSON.parse(await readFile(new URL('../capacitor.config.json', import.meta.url), 'utf8'));
  const manifest = await readFile(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  const icon = await readFile(new URL('../android/app/src/main/res/drawable/ic_stat_scorer.xml', import.meta.url), 'utf8');
  assert.equal(config.plugins.LocalNotifications.smallIcon, 'ic_stat_scorer');
  assert.equal(config.plugins.LocalNotifications.iconColor, '#20C8BE');
  assert.match(manifest, /android\.permission\.VIBRATE/);
  assert.match(icon, /vector/);
});

test('v0.4.1 version is aligned across web and Android shell', async () => {
  const version = (await readFile(new URL('../VERSION', import.meta.url), 'utf8')).trim();
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const gradle = await readFile(new URL('../android/app/build.gradle', import.meta.url), 'utf8');
  const prep = await readFile(new URL('../scripts/prepare-native.mjs', import.meta.url), 'utf8');
  assert.equal(version, '0.4.1');
  assert.equal(pkg.version, '0.4.1');
  assert.match(gradle, /versionCode 401/);
  assert.match(gradle, /versionName "0\.4\.1"/);
  assert.match(prep, /version:'0\.4\.1'/);
});
