import { allReminderIds, plannedNotifications, gameTitle } from './v040-core.js';

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

export async function syncGameReminders(game) {
  const local = plugin('LocalNotifications');
  if (!local) return { native:false, scheduled:0, permission:'web' };

  const permission = await requestNotificationPermission();
  if (!permission.granted) return { native:true, scheduled:0, permission:permission.permission };

  await cancelGameReminders(game);
  const items = plannedNotifications(game);
  if (!items.length) return { native:true, scheduled:0, permission:'granted' };

  await local.schedule({
    notifications: items.map(item => ({
      id:item.id,
      title:item.title,
      body:item.body,
      schedule:{ at:item.at, allowWhileIdle:true },
      extra:item.extra,
      actionTypeId:''
    }))
  });

  return { native:true, scheduled:items.length, permission:'granted' };
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
