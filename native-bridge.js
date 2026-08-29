import { allReminderIds, plannedNotifications, gameTitle } from './v040-core.js';

export const REMINDER_CHANNEL_ID = 'scorer-game-reminders';
export const TEST_REMINDER_ID = 2147482991;

function capacitor() { return window.Capacitor || null; }

function plugin(name) {
  const cap = capacitor();
  if (!cap?.isNativePlatform?.() || !cap?.isPluginAvailable?.(name) || typeof cap.registerPlugin !== 'function') return null;
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
    const exists = (listed?.channels || []).some(channel => channel?.id === REMINDER_CHANNEL_ID);
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
    return { native:true, available:true, created:!exists };
  } catch (error) {
    return { native:true, available:false, error:error?.message || String(error) };
  }
}

export async function syncGameReminders(game) {
  const local = plugin('LocalNotifications');
  if (!local) return { native:false, requested:0, scheduled:0, pending:0, permission:'web' };

  const permission = await requestNotificationPermission();
  if (!permission.granted) {
    return { native:true, requested:0, scheduled:0, pending:0, permission:permission.permission };
  }

  const channel = await ensureReminderChannel();
  if (!channel.available) {
    throw new Error(channel.error || 'Could not create Android reminder channel');
  }

  await cancelGameReminders(game);
  const items = plannedNotifications(game);
  if (!items.length) {
    return { native:true, requested:0, scheduled:0, pending:0, permission:'granted' };
  }

  const scheduledResult = await local.schedule({
    notifications: items.map(item => ({
      id:item.id,
      title:item.title,
      body:item.body,
      channelId: REMINDER_CHANNEL_ID,
      schedule:{ at:item.at, allowWhileIdle:true },
      extra:item.extra
    }))
  });

  const expectedIds = new Set(items.map(item => item.id));
  const pendingResult = await local.getPending();
  const pending = (pendingResult?.notifications || []).filter(item => expectedIds.has(Number(item?.id)));
  const returned = (scheduledResult?.notifications || []).filter(item => expectedIds.has(Number(item?.id)));

  if (pending.length !== items.length) {
    throw new Error(`Android only queued ${pending.length} of ${items.length} requested reminder${items.length === 1 ? '' : 's'}`);
  }

  return {
    native:true,
    requested:items.length,
    scheduled:returned.length,
    pending:pending.length,
    permission:'granted',
    nextAt:earliestPendingAt(pending)
  };
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
      extra:{ test:true, immediate:true, diagnostic:'default-channel' }
    }]
  });

  await delay(300);
  const deliveredResult = await local.getDeliveredNotifications?.().catch?.(() => ({ notifications:[] })) || { notifications:[] };
  const delivered = (deliveredResult?.notifications || []).some(item => Number(item?.id) === id);
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

  try { await local.cancel({ notifications:[{ id:TEST_REMINDER_ID }] }); } catch {}

  const at = new Date(Date.now() + Math.max(5, Number(seconds) || 10) * 1000);
  await local.schedule({
    notifications:[{
      id:TEST_REMINDER_ID,
      title:'Scorer reminder test',
      body:'If you can see this, Android reminders are working.',
      channelId:REMINDER_CHANNEL_ID,
      schedule:{ at, allowWhileIdle:true },
      extra:{ test:true }
    }]
  });

  const pendingResult = await local.getPending();
  const queued = (pendingResult?.notifications || []).some(item => Number(item?.id) === TEST_REMINDER_ID);
  if (!queued) throw new Error('Android did not keep the test reminder in its pending queue');
  return { native:true, queued:true, permission:'granted', at };
}

function earliestPendingAt(pending = []) {
  const times = pending.map(item => new Date(item?.schedule?.at || 0).getTime()).filter(Number.isFinite);
  if (!times.length) return '';
  return new Date(Math.min(...times)).toISOString();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

export function installNativeOpenHandlers(onGame) {
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
}

function notificationTarget(url) {
  const match = /^scorer:\/\/game\/([^?#]+)/i.exec(String(url || ''));
  if (!match) return '';
  try { return decodeURIComponent(match[1]); } catch { return match[1]; }
}

function sportName(id) {
  return ({volleyball:'Volleyball',basketball:'Basketball',soccer:'Soccer',football:'Football',cricket:'Cricket',tennis:'Tennis',badminton:'Badminton',lacrosse:'Lacrosse',kabaddi:'Kabaddi',baseball:'Baseball'})[id] || 'Game';
}
