# Scorer v0.4.2 — Android Notification Delivery Diagnostics

## Trigger

Real-device testing on Android showed:
- Scorer notification permission enabled,
- v0.4.1 **Send test now** produced no visible notification,
- scheduled game reminder also was not observed.

Because the immediate test does not depend on an alarm trigger, v0.4.2 treats this first as a notification-posting problem rather than only an exact-alarm timing problem.

## Diagnostic layers

Upcoming Games now distinguishes:

1. **App notification permission / enabled state**
2. **Android notification-channel state and importance**
3. **Pending scheduled notifications**
4. **Currently delivered/active notifications**
5. **Exact-alarm capability**

Android can allow notifications for the app while an individual channel is disabled. A channel with importance 0 is reported as **BLOCKED**.

## Immediate test isolation

The immediate diagnostic intentionally uses Capacitor's built-in `default` notification channel rather than Scorer's custom `scorer-game-reminders` channel.

After posting, Scorer waits briefly and calls `getDeliveredNotifications()`.

A successful immediate diagnostic now means Android itself reports the test notification as active.

If Android accepts the plugin call but the test does not appear in the active notification list, Scorer surfaces:

`Android accepted the test call but no active notification was posted`

along with the default channel's importance.

This separates:
- JS/plugin call success
- channel availability
- actual OS-level notification posting

## Notification icon isolation

v0.4.2 removes the custom Local Notifications icon configuration from `capacitor.config.json` for this diagnostic build and does not pass a custom icon in the notification payload.

Capacitor therefore falls back to its Android-safe default notification icon. This removes the custom status-bar icon as a possible delivery variable.

## Precise reminders

The Android manifest now declares:

`android.permission.SCHEDULE_EXACT_ALARM`

Scorer does **not** declare `USE_EXACT_ALARM`.

When exact alarms are denied, Upcoming Games offers **Enable precise reminders**, which invokes Capacitor's Android exact-alarm settings flow. This is user-granted special access rather than an automatically privileged permission.

Game reminders can still be queued without exact access; Android may then use inexact timing.

## Version

- Scorer: 0.4.2
- Android versionCode: 402
- Android versionName: 0.4.2

## Release gate

v0.4.2 requires:
- full JavaScript regression suite,
- Android diagnostic regressions,
- Capacitor sync,
- Gradle `assembleDebug`,
- debug APK artifact,
- PR-head CI + Android QC,
- fresh main CI + Android QC + Pages deployment.

Physical-device notification delivery remains the final validation step.
