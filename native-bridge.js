import { allReminderIds, plannedNotifications, gameTitle } from './v040-core.js';

export const REMINDER_CHANNEL_ID = 'scorer-game-reminders';
export const TEST_REMINDER_ID = 2147482991;
const DELIVERY_POLL_INTERVAL_MS = 200;
const DELIVERY_POLL_TIMEOUT_MS = 3000;

function capacitor() { return window.Capacitor || null; }

function plugin(name) {
  const cap = capacitor();
  if (!cap?.isNativePlatform?.() || !cap?.isPluginAvailable?.(name)) return null;

  // Capacitor's unbundled Android bridge exports generated plugin proxies here.
  // registerPlugin() belongs to @capacitor/core's JS module and is not present on
  // the raw window.Capacitor object used by Scorer's plain-module shell.
  const nativeProxy = cap?.Plugins?.[name];
  if (nativeProxy) return nativeProxy;

  // Keep compatibility with bundled/web runtimes that do expose registerPlugin.
  if (typeof cap.registerPlugin !== 'function') return null;
  try { return cap.registerPlugin(name); } catch { return null; }
}

export function nativePlatform() {
  const cap = capacitor();
  return Boolean(cap?.isNativePlatform?.());
}

export function nativePlatformName() {
  const cap = capacitor();
  return cap?.getPlatform?.() || 'web';
}

export async function notificationCapability() {
  const local = plugin('LocalNotifications');
  if (!local) return { native:false, available:false, permission:'web' };
  try {
    const result = await local.checkPermissions();
    return { native:true, available:true, permission:result?.display || 'prompt' };
  } catch (error) {
    return { native:true, available:false, permission:'error', error:error?.message || String(error) };
  }
}

export async function requestNotificationPermission() {
  const local = plugin('LocalNotifications');
  if (!local) return { native:false, granted:false, permission:'web' };
  let result = await local.checkPermissions();
  if (result?.display !== 'granted') result = await local.requestPermissions();
  return { native:true, granted:result?.display === 'granted', permission:result?.display || 'prompt' };
}

export async function ensureReminderChannel() {
  const local = plugin('LocalNotifications');
  if (!local) return { native:false, available:false };

  try {
    const listed = await local.listChannels();
    const existing = (listed?.channels || []).find(channel => channel?.id === REMINDER_CHANNEL_ID);
    const exists = Boolean(existing);
    if (!exists) {
      await local.createChannel({
        id: REMINDER_CHANNEL_ID,
        name: 'Game reminders',
        description: 'Upcoming Scorer game reminders',
        importance: 4,
        visibility: 1,
        vibration: true
      });
    }
    const refreshed = exists ? existing : (await local.listChannels())?.channels?.find(channel => channel?.id === REMINDER_CHANNEL_ID);
    if (Number(refreshed?.importance) === 0) {
      return {
        native:true,
        available:false,
        blocked:true,
        channel:refreshed,
        error:'Game reminders are blocked in Android notification settings'
      };
    }
    // Android 7 has no channels, so a successful create/list path with no
    // returned channel is still usable there.
    return { native:true, available:true, created:!exists, channel:refreshed };
  } catch (error) {
    return { native:true, available:false, error:error?.message || String(error) };
  }
}

export async function syncGameReminders(game, options = {}) {
  const local = plugin('LocalNotifications');
  if (!local) return { native:false, requested:0, accepted:0, stored:0, permission:'web' };

  const permission = options.requestPermission === false
    ? await currentNotificationPermission(local)
    : await requestNotificationPermission();
  if (!permission.granted) {
    return { native:true, requested:0, accepted:0, stored:0, permission:permission.permission };
  }

  const channel = await ensureReminderChannel();
  if (!channel.available) {
    throw new Error(channel.error || 'Could not create Android reminder channel');
  }

  await cancelGameReminders(game);
  const items = plannedNotifications(game);
  if (!items.length) {
    return { native:true, requested:0, accepted:0, stored:0, permission:'granted' };
  }

  const exactAlarm = await exactAlarmPermission(local);
  const useExact = exactAlarm === 'granted';

  const scheduledResult = await local.schedule({
    notifications: items.map(item => ({
      id:item.id,
      title:item.title,
      body:item.body,
      channelId: REMINDER_CHANNEL_ID,
      schedule:{ at:item.at, allowWhileIdle:true },
      // Capacitor 8.3 defaults this to true even for immediate notifications.
      // Make the choice explicit so Android settings never opens implicitly.
      isExactNotification:useExact,
      isExactMandatory:false,
      extra:item.extra
    }))
  });

  const expectedIds = new Set(items.map(item => item.id));
  const pendingResult = await local.getPending();
  // Capacitor getPending() is its persisted restore list, not AlarmManager state.
  // Keep it as a storage/reboot-recovery check and do not call it OS verification.
  const stored = (pendingResult?.notifications || []).filter(item => expectedIds.has(Number(item?.id)));
  const returned = (scheduledResult?.notifications || []).filter(item => expectedIds.has(Number(item?.id)));

  if (returned.length !== items.length) {
    throw new Error(`Android accepted only ${returned.length} of ${items.length} requested reminder${items.length === 1 ? '' : 's'}`);
  }
  if (stored.length !== items.length) {
    throw new Error(`Scorer retained only ${stored.length} of ${items.length} reminder${items.length === 1 ? '' : 's'} for restart recovery`);
  }

  return {
    native:true,
    requested:items.length,
    accepted:returned.length,
    stored:stored.length,
    permission:'granted',
    exactAlarm,
    timing:useExact ? 'precise' : 'android-managed',
    nextAt:earliestPendingAt(stored)
  };
}

export async function recoverUpcomingGameReminders(games = []) {
  const local = plugin('LocalNotifications');
  if (!local) return { native:false, recovered:0, stored:0, permission:'web' };

  const permission = await currentNotificationPermission(local);
  if (!permission.granted) return { native:true, recovered:0, stored:0, permission:permission.permission };

  let recovered = 0;
  let stored = 0;
  const errors = [];
  for (const game of games) {
    try {
      const result = await syncGameReminders(game, { requestPermission:false });
      recovered += Number(result.accepted || 0);
      stored += Number(result.stored || 0);
    } catch (error) {
      errors.push({ gameId:String(game?.id || ''), message:error?.message || String(error) });
    }
  }
  return { native:true, recovered, stored, permission:'granted', errors };
}

export async function reminderDiagnostics(game = null) {
  const local = plugin('LocalNotifications');
  if (!local) return { native:false, permission:'web', pending:[], pendingForGame:[], exactAlarm:'web', channels:[] };

  const permissionResult = await local.checkPermissions().catch(() => ({ display:'error' }));
  const enabledResult = await local.areEnabled?.().catch?.(() => ({ value:false })) || { value:false };
  const pendingResult = await local.getPending().catch(() => ({ notifications:[] }));
  const deliveredResult = await local.getDeliveredNotifications?.().catch?.(() => ({ notifications:[] })) || { notifications:[] };
  const channelResult = await local.listChannels().catch(() => ({ channels:[] }));
  const exactResult = await local.checkExactNotificationSetting?.().catch?.(() => ({ exact_alarm:'unknown' })) || { exact_alarm:'unknown' };

  const expected = game?.id ? new Set(allReminderIds(game).map(item => item.id)) : null;
  const pending = pendingResult?.notifications || [];
  return {
    native:true,
    permission:permissionResult?.display || 'unknown',
    enabled:Boolean(enabledResult?.value),
    pending,
    delivered:deliveredResult?.notifications || [],
    pendingForGame:expected ? pending.filter(item => expected.has(Number(item?.id))) : [],
    exactAlarm:exactResult?.exact_alarm || 'unknown',
    channels:channelResult?.channels || []
  };
}

export async function sendImmediateTestNotification() {
  const local = plugin('LocalNotifications');
  if (!local) return { native:false, sent:false, delivered:false, permission:'web' };

  const permission = await requestNotificationPermission();
  if (!permission.granted) return { native:true, sent:false, delivered:false, permission:permission.permission };

  const enabled = await local.areEnabled?.().catch?.(() => ({ value:false })) || { value:false };
  if (!enabled?.value) throw new Error('Android reports notifications disabled for Scorer');

  const id = TEST_REMINDER_ID - 1;
  try { await local.removeDeliveredNotifications?.({ notifications:[{ id }] }); } catch {}
  try { await local.cancel({ notifications:[{ id }] }); } catch {}

  // Deliberately use Capacitor's built-in "default" channel and default icon.
  // This isolates the app-level notification path from Scorer's custom reminder channel.
  await local.schedule({
    notifications:[{
      id,
      title:'Scorer notifications are working',
      body:'Android posted this notification directly from Scorer.',
      channelId:'default',
      // An immediate post must never request or depend on exact-alarm access.
      isExactNotification:false,
      isExactMandatory:false,
      extra:{ test:true, immediate:true, diagnostic:'default-channel' }
    }]
  });

  const delivered = await waitForDeliveredNotification(local, id);
  const channelsResult = await local.listChannels().catch(() => ({ channels:[] }));
  const defaultChannel = (channelsResult?.channels || []).find(channel => channel?.id === 'default');

  if (!delivered) {
    const importance = defaultChannel?.importance ?? 'unknown';
    throw new Error(`Android accepted the test call but no active notification was posted (default channel importance: ${importance})`);
  }

  return {
    native:true,
    sent:true,
    delivered:true,
    permission:'granted',
    channelId:'default',
    channelImportance:defaultChannel?.importance ?? null
  };
}

export async function requestExactAlarmAccess() {
  const local = plugin('LocalNotifications');
  if (!local) return { native:false, exactAlarm:'web' };

  const before = await local.checkExactNotificationSetting?.().catch?.(() => ({ exact_alarm:'unknown' })) || { exact_alarm:'unknown' };
  if (before?.exact_alarm === 'granted') return { native:true, exactAlarm:'granted', changed:false };

  const after = await local.changeExactNotificationSetting?.().catch?.(error => {
    throw new Error(error?.message || 'Could not open Android precise-reminder settings');
  });

  return { native:true, exactAlarm:after?.exact_alarm || 'unknown', changed:true };
}

export async function scheduleTestReminder(seconds = 10) {
  const local = plugin('LocalNotifications');
  if (!local) return { native:false, queued:false, permission:'web' };

  const permission = await requestNotificationPermission();
  if (!permission.granted) return { native:true, queued:false, permission:permission.permission };

  const channel = await ensureReminderChannel();
  if (!channel.available) throw new Error(channel.error || 'Could not create Android reminder channel');

  const exactAlarm = await exactAlarmPermission(local);
  if (exactAlarm !== 'granted') {
    throw new Error('Enable precise reminders before running the 10-second background test');
  }

  try { await local.cancel({ notifications:[{ id:TEST_REMINDER_ID }] }); } catch {}

  const at = new Date(Date.now() + Math.max(5, Number(seconds) || 10) * 1000);
  await local.schedule({
    notifications:[{
      id:TEST_REMINDER_ID,
      title:'Scorer reminder test',
      body:'If you can see this, Android reminders are working.',
      channelId:REMINDER_CHANNEL_ID,
      schedule:{ at, allowWhileIdle:true },
      isExactNotification:true,
      isExactMandatory:true,
      extra:{ test:true }
    }]
  });

  const pendingResult = await local.getPending();
  const queued = (pendingResult?.notifications || []).some(item => Number(item?.id) === TEST_REMINDER_ID);
  if (!queued) throw new Error('Scorer could not retain the test reminder for delivery');
  return { native:true, queued:true, permission:'granted', exactAlarm, at };
}

function earliestPendingAt(pending = []) {
  const times = pending.map(item => new Date(item?.schedule?.at || 0).getTime()).filter(Number.isFinite);
  if (!times.length) return '';
  return new Date(Math.min(...times)).toISOString();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function currentNotificationPermission(local) {
  const result = await local.checkPermissions().catch(() => ({ display:'error' }));
  return { native:true, granted:result?.display === 'granted', permission:result?.display || 'error' };
}

async function exactAlarmPermission(local) {
  const result = await local.checkExactNotificationSetting?.().catch?.(() => ({ exact_alarm:'unknown' })) || { exact_alarm:'unknown' };
  return result?.exact_alarm || 'unknown';
}

async function waitForDeliveredNotification(local, id) {
  const deadline = Date.now() + DELIVERY_POLL_TIMEOUT_MS;
  do {
    const result = await local.getDeliveredNotifications?.().catch?.(() => ({ notifications:[] })) || { notifications:[] };
    if ((result?.notifications || []).some(item => Number(item?.id) === Number(id))) return true;
    await delay(DELIVERY_POLL_INTERVAL_MS);
  } while (Date.now() < deadline);
  return false;
}

export async function cancelGameReminders(game) {
  const local = plugin('LocalNotifications');
  if (!local || !game?.id) return { native:false, cancelled:0 };
  const notifications = allReminderIds(game);
  try {
    await local.cancel({ notifications });
    return { native:true, cancelled:notifications.length };
  } catch {
    return { native:true, cancelled:0 };
  }
}

export async function shareScheduledGame(game) {
  const title = gameTitle(game);
  const when = new Date(game.startsAt).toLocaleString([], { dateStyle:'medium', timeStyle:'short' });
  const text = [title, sportName(game.sport), when, game.venue].filter(Boolean).join(' · ');
  const share = plugin('Share');
  if (share) {
    await share.share({ title, text, dialogTitle:'Share game' });
    return { native:true, shared:true };
  }
  if (navigator.share) {
    await navigator.share({ title, text });
    return { native:false, shared:true };
  }
  return { native:false, shared:false, text };
}

export function installNativeOpenHandlers(onGame, onActive) {
  const local = plugin('LocalNotifications');
  const app = plugin('App');

  local?.addListener?.('localNotificationActionPerformed', event => {
    const id = event?.notification?.extra?.gameId;
    if (id) onGame?.(String(id));
  });

  app?.addListener?.('appUrlOpen', event => {
    const target = notificationTarget(event?.url || '');
    if (target) onGame?.(target);
  });

  app?.addListener?.('appStateChange', event => {
    if (event?.isActive) onActive?.();
  });
}

function notificationTarget(url) {
  const match = /^scorer:\/\/game\/([^?#]+)/i.exec(String(url || ''));
  if (!match) return '';
  try { return decodeURIComponent(match[1]); } catch { return match[1]; }
}

function sportName(id) {
  return ({volleyball:'Volleyball',basketball:'Basketball',soccer:'Soccer',football:'Football',cricket:'Cricket',tennis:'Tennis',badminton:'Badminton',lacrosse:'Lacrosse',kabaddi:'Kabaddi',baseball:'Baseball'})[id] || 'Game';
}
