import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('immediate diagnostic uses the built-in default channel and verifies Android delivery', async () => {
  const bridge = await readFile(new URL('../native-bridge.js', import.meta.url), 'utf8');
  assert.match(bridge, /channelId:'default'/);
  assert.match(bridge, /getDeliveredNotifications/);
  assert.match(bridge, /Android accepted the test call but no active notification was posted/);
  assert.match(bridge, /default channel importance/);
});

test('reminder diagnostics distinguish app permission, channel state, queued and delivered notifications', async () => {
  const bridge = await readFile(new URL('../native-bridge.js', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../v040.js', import.meta.url), 'utf8');
  assert.match(bridge, /local\.areEnabled/);
  assert.match(bridge, /delivered:deliveredResult/);
  assert.match(ui, /currently visible/);
  assert.match(ui, /Default channel:/);
  assert.match(ui, /Game channel:/);
  assert.match(ui, /importance/);
});

test('v0.4.3 supports user-granted exact alarms for precise game reminders', async () => {
  const manifest = await readFile(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  const bridge = await readFile(new URL('../native-bridge.js', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../v040.js', import.meta.url), 'utf8');
  assert.match(manifest, /android\.permission\.SCHEDULE_EXACT_ALARM/);
  assert.match(bridge, /export async function requestExactAlarmAccess/);
  assert.match(bridge, /changeExactNotificationSetting/);
  assert.match(ui, /Enable precise reminders/);
  assert.match(ui, /requestExactAlarmAccess/);
});

test('diagnostic build removes custom icon config so Android fallback icon is used', async () => {
  const config = JSON.parse(await readFile(new URL('../capacitor.config.json', import.meta.url), 'utf8'));
  const bridge = await readFile(new URL('../native-bridge.js', import.meta.url), 'utf8');
  assert.equal(config.plugins, undefined);
  const immediate = bridge.slice(bridge.indexOf('export async function sendImmediateTestNotification'), bridge.indexOf('export async function requestExactAlarmAccess'));
  assert.doesNotMatch(immediate, /smallIcon|iconColor/);
});

test('v0.4.3 version is aligned everywhere', async () => {
  const version = (await readFile(new URL('../VERSION', import.meta.url), 'utf8')).trim();
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const gradle = await readFile(new URL('../android/app/build.gradle', import.meta.url), 'utf8');
  const prep = await readFile(new URL('../scripts/prepare-native.mjs', import.meta.url), 'utf8');
  assert.equal(version, '0.4.3');
  assert.equal(pkg.version, '0.4.3');
  assert.match(gradle, /versionCode 403/);
  assert.match(gradle, /versionName "0\.4\.3"/);
  assert.match(prep, /version:'0\.4\.3'/);
});
