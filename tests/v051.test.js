import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = relative => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');

test('release signing is environment-only and rejects incomplete configuration', async () => {
  const gradle = await read('android/app/build.gradle');
  const ignored = await read('.gitignore');

  for (const name of [
    'SCORER_UPLOAD_KEYSTORE_PATH',
    'SCORER_UPLOAD_STORE_PASSWORD',
    'SCORER_UPLOAD_KEY_ALIAS',
    'SCORER_UPLOAD_KEY_PASSWORD'
  ]) {
    assert.match(gradle, new RegExp(name));
  }
  assert.match(gradle, /System\.getenv\(name\)/);
  assert.match(gradle, /Incomplete Scorer upload signing configuration/);
  assert.match(gradle, /Release signing is required/);
  assert.match(gradle, /signingConfig signingConfigs\.release/);
  assert.doesNotMatch(gradle, /storePassword\s+["'][^"']+["']/);
  assert.doesNotMatch(gradle, /keyPassword\s+["'][^"']+["']/);
  assert.match(ignored, /\*\.jks/);
  assert.match(ignored, /\*\.keystore/);
  assert.match(ignored, /keystore\.properties/);
});

test('API 36 release QC uses a disposable signer and exercises the release variant', async () => {
  const workflow = await read('.github/workflows/android-release.yml');

  assert.match(workflow, /api-level: 36/);
  assert.match(workflow, /bundleRelease/);
  assert.match(workflow, /scorerTestBuildType=release connectedReleaseAndroidTest/);
  assert.match(workflow, /ci-only-not-for-play/);
  assert.match(workflow, /jarsigner -verify/);
  assert.match(workflow, /sha256sum/);
  assert.doesNotMatch(workflow, /secrets\.SCORER_UPLOAD/);
});

test('Play AAB workflow is manual, secret-gated, verified and non-publishing', async () => {
  const workflow = await read('.github/workflows/play-aab.yml');

  assert.match(workflow, /workflow_dispatch/);
  assert.doesNotMatch(workflow, /\bpush:/);
  assert.doesNotMatch(workflow, /pull_request/);
  assert.match(workflow, /secrets\.SCORER_UPLOAD_KEYSTORE_BASE64/);
  assert.match(workflow, /secrets\.SCORER_UPLOAD_STORE_PASSWORD/);
  assert.match(workflow, /secrets\.SCORER_UPLOAD_KEY_ALIAS/);
  assert.match(workflow, /secrets\.SCORER_UPLOAD_KEY_PASSWORD/);
  assert.match(workflow, /base64 --decode/);
  assert.match(workflow, /npm run check/);
  assert.match(workflow, /bundleRelease/);
  assert.match(workflow, /jarsigner -verify/);
  assert.match(workflow, /scorer-v0\.5\.1-play-aab/);
  assert.doesNotMatch(workflow, /publish|playPublisher|serviceAccount/i);
});
