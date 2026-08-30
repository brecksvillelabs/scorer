import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('immediate notification cannot enter the exact-alarm settings flow', async () => {
  const bridge = await readFile(new URL('../native-bridge.js', import.meta.url), 'utf8');
  const start = bridge.indexOf('export async function sendImmediateTestNotification');
  const end = bridge.indexOf('export async function requestExactAlarmAccess');
  const immediate = bridge.slice(start, end);
  assert.match(immediate, /channelId:'default'/);
  assert.match(immediate, /isExactNotification:false/);
  assert.match(immediate, /isExactMandatory:false/);
  assert.match(immediate, /waitForDeliveredNotification/);
  assert.doesNotMatch(immediate, /changeExactNotificationSetting/);
});

test('game reminders make exact versus Android-managed timing explicit', async () => {
  const bridge = await readFile(new URL('../native-bridge.js', import.meta.url), 'utf8');
  assert.match(bridge, /const useExact = exactAlarm === 'granted'/);
  assert.match(bridge, /isExactNotification:useExact/);
  assert.match(bridge, /isExactMandatory:false/);
  assert.match(bridge, /timing:useExact \? 'precise' : 'android-managed'/);
});

test('saved pending records are not misrepresented as OS delivery verification', async () => {
  const bridge = await readFile(new URL('../native-bridge.js', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../v040.js', import.meta.url), 'utf8');
  assert.match(bridge, /persisted restore list, not AlarmManager state/);
  assert.match(ui, /reminder schedule/);
  assert.doesNotMatch(ui, /verified in Android/);
});

test('upcoming reminders are re-armed after launch and Android settings return', async () => {
  const bridge = await readFile(new URL('../native-bridge.js', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../v040.js', import.meta.url), 'utf8');
  assert.match(bridge, /export async function recoverUpcomingGameReminders/);
  assert.match(bridge, /appStateChange/);
  assert.match(ui, /recoverNativeReminders/);
  assert.match(ui, /re-armed/);
});

test('blocked game channel is surfaced instead of silently accepting reminders', async () => {
  const bridge = await readFile(new URL('../native-bridge.js', import.meta.url), 'utf8');
  const ui = await readFile(new URL('../v040.js', import.meta.url), 'utf8');
  assert.match(bridge, /Number\(refreshed\?\.importance\) === 0/);
  assert.match(bridge, /Game reminders are blocked in Android notification settings/);
  assert.match(ui, /Android is blocking Scorer’s Game reminders channel/);
});

test('Android instrumentation verifies the real Capacitor-to-notification-manager path', async () => {
  const instrumentation = await readFile(new URL('../android/app/src/androidTest/java/labs/brecksville/scorer/NotificationDeliveryTest.java', import.meta.url), 'utf8');
  const workflow = await readFile(new URL('../.github/workflows/android.yml', import.meta.url), 'utf8');
  assert.match(instrumentation, /SCHEDULE_EXACT_ALARM deny/);
  assert.match(instrumentation, /sendImmediateTestNotification/);
  assert.match(instrumentation, /getActiveNotifications/);
  assert.match(workflow, /connectedDebugAndroidTest/);
  assert.match(workflow, /api-level: 35/);
});

test('v0.4.3 version is aligned across release surfaces', async () => {
  const version = (await readFile(new URL('../VERSION', import.meta.url), 'utf8')).trim();
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const gradle = await readFile(new URL('../android/app/build.gradle', import.meta.url), 'utf8');
  const prep = await readFile(new URL('../scripts/prepare-native.mjs', import.meta.url), 'utf8');
  const workflow = await readFile(new URL('../.github/workflows/android.yml', import.meta.url), 'utf8');
  assert.equal(version, '0.4.3');
  assert.equal(pkg.version, '0.4.3');
  assert.match(gradle, /versionCode 403/);
  assert.match(gradle, /versionName "0\.4\.3"/);
  assert.match(prep, /version:'0\.4\.3'/);
  assert.match(workflow, /scorer-v0\.4\.3-debug-apk/);
});
