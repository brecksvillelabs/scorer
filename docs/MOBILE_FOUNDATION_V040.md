# Scorer v0.4.0 — Mobile Foundation

## Purpose

v0.4.0 turns Scorer from a PWA-only project into one shared scoring product with a checked-in Capacitor Android shell.

The scoring engine, Quick Start flow, ten sport models, Game Diary and local history remain web-core features. Android adds native capabilities around that same core instead of creating a second scoring implementation.

## Architecture

```
Scorer web core
├── PWA / GitHub Pages
└── Capacitor Android shell
    ├── Local Notifications
    ├── Native Share
    └── App/deep-link lifecycle
```

Android application ID:

`labs.brecksville.scorer`

Capacitor app name:

`Scorer`

The native shell packages the local web assets from `dist/`. It does not point the Android application at GitHub Pages.

## Upcoming Games

Home now includes **Upcoming Games**.

A scheduled game stores:
- sport
- Team / Player A
- Team / Player B
- date and time
- optional venue
- reminder choices

Default reminder choices:
- 1 day before
- 2 hours before
- 30 minutes before

Schedules use local storage key:

`scorer-upcoming-games-v1`

No Scorer account, Google account, Firebase project or ScorerHub connection is required.

### Start scoring

A scheduled game can be opened with **Start scoring**.

Scorer reuses the v0.3.9 Quick Start flow:
1. sport and team names are prefilled from the scheduled game,
2. the operator lands on that sport's **Format** step,
3. **Start game** opens the existing scoreboard.

Sport rules are therefore not duplicated inside the schedule feature.

## Android reminders

The Android shell uses `@capacitor/local-notifications`.

On Android 13+ Scorer requests notification permission when the operator first saves reminder-enabled game.

v0.4.0 deliberately does **not** request:
- `SCHEDULE_EXACT_ALARM`
- `USE_EXACT_ALARM`

Sports reminders do not require second-level precision. If exact-alarm access is unavailable, Capacitor/Android can schedule using the non-exact alarm path.

Reminder notification IDs are deterministic from scheduled-game ID + reminder offset so editing/deleting a game can replace or cancel its prior reminders.

Tapping a local reminder returns to Scorer and identifies the scheduled game.

Deep-link scheme:

`scorer://game/<scheduled-game-id>`

## Sharing

The Android shell includes `@capacitor/share`.

A scheduled game can be shared through the native Android share sheet. The PWA uses the browser Web Share API when available.

This is sharing game details only. v0.4.0 does not yet publish a live ScorerHub game.

## PWA behavior

The existing PWA remains fully functional and offline-first.

Upcoming Games can be stored and viewed in the PWA, but dependable device-level background reminders are a native-Android feature in v0.4.0.

The native shell does not register the PWA service worker; Capacitor packages its own local web assets.

## Privacy

v0.4.0 is local-first.

The following remain on the device:
- scheduled games
- reminders
- scoreboard state
- favorite teams
- game history
- Game Diary notes
- local photos

No account or cloud sync is introduced in this release.

## Android build

Requirements used by CI:
- Node 22
- Java 21
- Android SDK / compile SDK 36
- Gradle 8.14.3
- Capacitor 8.5.0

From the repository root:

```bash
npm install
npm run native:sync
```

To open the Android project:

```bash
npm run native:open
```

To build the debug APK:

```bash
npm run native:build:android
```

CI also runs the Android build and uploads:

`android/app/build/outputs/apk/debug/app-debug.apk`

as the **scorer-v0.4.0-debug-apk** workflow artifact.

## Release gates

v0.4.0 requires:
1. full existing JavaScript regression suite,
2. v0.4 schedule/reminder/native integration tests,
3. Capacitor native asset preparation,
4. `npx cap sync android`,
5. Gradle `assembleDebug`,
6. debug APK artifact upload,
7. pull-request versions of both CI gates,
8. fresh main CI after merge,
9. fresh main Android build after merge,
10. GitHub Pages deployment.

A successful Android build proves the native project compiles and packages. It does **not** prove notification delivery on a physical Samsung/Android device; that remains a device QC step.

## Not in v0.4.0

These belong to later Connected Scorer phases:
- mandatory or optional cloud accounts
- Google Sign-In
- Firebase / Firestore
- ScorerHub live spectator pages
- QR live-game links
- push notifications from a server
- cloud media backup
- Play Store signed release/AAB

The core rule remains: **Quick Score works without an account or network connection.**
