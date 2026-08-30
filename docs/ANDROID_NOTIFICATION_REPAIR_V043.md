# Scorer v0.4.3 — Android Notification Repair

## What v0.4.2 proved

The v0.4.2 APK contained the required Android notification permission, local-notification plugin, alarm receiver, boot restore receiver and channels. It still did not prove real device delivery.

Two reliability assumptions were incorrect:

1. Capacitor Local Notifications 8.3.1 defaults `isExactNotification` to `true`. Scorer's immediate test did not override that default, so a notification that should post now could enter Android's exact-alarm settings flow.
2. Capacitor `getPending()` reads the plugin's persisted restore records. It is useful for restart recovery, but it is not a query of Android `AlarmManager` registrations and must not be described as OS delivery verification.

## v0.4.3 behavior

- Immediate notifications explicitly set `isExactNotification:false` and never depend on exact-alarm access.
- Immediate delivery is polled through `getDeliveredNotifications()` for up to three seconds and must appear in Android's active notification list.
- Game reminders explicitly choose precise timing only when Android reports exact-alarm access as granted.
- Without exact access, game reminders use Android-managed timing without silently opening Settings.
- The 10-second background test is only enabled when precise reminders and the Game reminders channel are available.
- Upcoming reminders are deterministically re-armed on native launch, app resume and after returning from exact-alarm settings.
- A blocked Game reminders channel is reported as a delivery error instead of a successful schedule.
- UI language distinguishes Android's accepted schedule call, Capacitor's stored restart record and an actually visible notification.

## Android instrumentation gate

`NotificationDeliveryTest` runs on an Android API 35 emulator and exercises the packaged app through its real Capacitor WebView bridge:

1. Grant `POST_NOTIFICATIONS`.
2. Deny `SCHEDULE_EXACT_ALARM`.
3. Launch `MainActivity`.
4. Import the packaged `native-bridge.js` and call `sendImmediateTestNotification()`.
5. Require both the bridge result and Android `NotificationManager.getActiveNotifications()` to confirm delivery.

This closes the v0.4.2 gap where JavaScript source assertions and `assembleDebug` could pass without posting a notification.

## Version

- Scorer: 0.4.3
- Android versionCode: 403
- Android versionName: 0.4.3
