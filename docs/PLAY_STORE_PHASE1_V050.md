# Scorer v0.5.0 — Play Store Phase 1

## Purpose

Version 0.5.0 converts the phone-confirmed v0.4.3 Android build into an
isolated Google Play preparation line. It does not publish to Google Play and
does not add cloud accounts, advertising, analytics or live spectator sync.

## Locked identity

- Public product family: Scorer / ScorerHub
- Android launcher label: Scorer
- Android application ID: `com.brecksvillelabs.scorer`
- Capacitor app ID: `com.brecksvillelabs.scorer`
- Deep-link scheme: `scorer://game/<scheduled-game-id>`
- Closed-testing version: 0.5.0 (`versionCode` 500)
- First public production version reserved: 1.0.0

The package change from the pre-Play debug ID `labs.brecksville.scorer` is
intentional. Android treats v0.5.0 as a separate app from v0.4.3 debug builds.
The Play application ID must not change after the first store artifact is
created.

## Scope freeze

Phase 1 accepts only release-readiness, packaging, policy, store-presentation
and defect corrections. ScorerHub cloud sync, optional accounts, live
spectator links, advanced statistics and monetization remain post-v1.0 work.

Quick Score must continue to work without an account or network connection.
Schedules, favorites, match history, Game Diary notes and photos remain local
to the device.

## Existing regression gates

1. Locked Node dependency graph and `npm ci` in CI.
2. Full JavaScript syntax and regression suite.
3. Capacitor asset preparation and Android sync.
4. Android debug compilation.
5. API 35 packaged-UI notification delivery test.
6. Debug APK and instrumentation-report artifacts.

Signed AAB generation, API 36 release testing, Play App Signing, store assets,
privacy declarations and closed-track publishing are later Play preparation
phases and must remain manually approved.
