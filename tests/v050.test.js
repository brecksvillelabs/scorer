import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = relative => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');

test('v0.5.0 locks the permanent Play application identity', async () => {
  const config = JSON.parse(await read('capacitor.config.json'));
  const gradle = await read('android/app/build.gradle');
  const strings = await read('android/app/src/main/res/values/strings.xml');
  const activity = await read('android/app/src/main/java/com/brecksvillelabs/scorer/MainActivity.java');
  const instrumentation = await read('android/app/src/androidTest/java/com/brecksvillelabs/scorer/NotificationDeliveryTest.java');

  assert.equal(config.appId, 'com.brecksvillelabs.scorer');
  assert.match(gradle, /namespace = "com\.brecksvillelabs\.scorer"/);
  assert.match(gradle, /applicationId "com\.brecksvillelabs\.scorer"/);
  assert.match(strings, />com\.brecksvillelabs\.scorer</);
  assert.match(activity, /^package com\.brecksvillelabs\.scorer;/);
  assert.match(instrumentation, /^package com\.brecksvillelabs\.scorer;/);
  assert.match(instrumentation, /PACKAGE_NAME = "com\.brecksvillelabs\.scorer"/);
});

test('v0.5.0 release numbering and Android 16 target are aligned', async () => {
  const version = (await read('VERSION')).trim();
  const pkg = JSON.parse(await read('package.json'));
  const gradle = await read('android/app/build.gradle');
  const variables = await read('android/variables.gradle');

  assert.equal(version, '0.5.0');
  assert.equal(pkg.version, version);
  assert.match(gradle, /versionCode 500/);
  assert.match(gradle, /versionName "0\.5\.0"/);
  assert.match(variables, /compileSdkVersion = 36/);
  assert.match(variables, /targetSdkVersion = 36/);
});

test('release preparation uses locked Node installs and ignores generated native sync output', async () => {
  const ci = await read('.github/workflows/ci.yml');
  const android = await read('.github/workflows/android.yml');
  const ignored = await read('.gitignore');
  const lock = JSON.parse(await read('package-lock.json'));

  assert.match(ci, /npm ci --no-audit --no-fund/);
  assert.match(android, /npm ci --no-audit --no-fund/);
  assert.equal(lock.packages[''].version, '0.5.0');
  assert.match(ignored, /android\/app\/src\/main\/assets\//);
  assert.match(ignored, /android\/capacitor-cordova-android-plugins\//);
});
