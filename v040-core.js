export const SCHEDULE_STORAGE_KEY = 'scorer-upcoming-games-v1';
export const DEFAULT_REMINDER_MINUTES = [1440, 120, 30];

const SPORT_META = {
  volleyball:{name:'Volleyball',icon:'🏐'}, basketball:{name:'Basketball',icon:'🏀'},
  soccer:{name:'Soccer',icon:'⚽'}, football:{name:'Football',icon:'🏈'},
  cricket:{name:'Cricket',icon:'🏏'}, tennis:{name:'Tennis',icon:'🎾'},
  badminton:{name:'Badminton',icon:'🏸'}, lacrosse:{name:'Lacrosse',icon:'🥍'},
  kabaddi:{name:'Kabaddi',icon:'🤼'}, baseball:{name:'Baseball',icon:'⚾'}
};

export function sportMeta(id) {
  return SPORT_META[id] || { name:'Game', icon:'🏆' };
}

export function createScheduledGame(input = {}, now = Date.now()) {
  const sport = SPORT_META[input.sport] ? input.sport : 'volleyball';
  const startsAt = normalizeDate(input.startsAt, now + 60 * 60 * 1000);
  const reminders = normalizeReminders(input.reminders);
  return {
    id: String(input.id || makeId(now)),
    sport,
    teamA: clean(input.teamA) || 'Home',
    teamB: clean(input.teamB) || 'Away',
    startsAt,
    venue: clean(input.venue),
    reminders,
    createdAt: Number(input.createdAt || now),
    updatedAt: now
  };
}

export function normalizeScheduledGame(value, now = Date.now()) {
  if (!value || typeof value !== 'object') return null;
  return createScheduledGame(value, Number(value.updatedAt || now));
}

export function sortScheduledGames(list = []) {
  return [...list].filter(Boolean).sort((a,b) => new Date(a.startsAt) - new Date(b.startsAt));
}

export function upcomingGames(list = [], now = Date.now()) {
  return sortScheduledGames(list).filter(game => new Date(game.startsAt).getTime() >= now - 4 * 60 * 60 * 1000);
}

export function gameTitle(game) {
  return `${game?.teamA || 'Home'} vs ${game?.teamB || 'Away'}`;
}

export function reminderId(gameId, minutes) {
  const source = `${gameId}:${Number(minutes)}`;
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2147483000 + 1;
}

export function plannedNotifications(game, now = Date.now()) {
  const start = new Date(game?.startsAt || 0).getTime();
  if (!Number.isFinite(start)) return [];
  const meta = sportMeta(game.sport);
  return normalizeReminders(game.reminders).map(minutes => {
    const atMs = start - minutes * 60 * 1000;
    if (atMs <= now + 5000) return null;
    return {
      id: reminderId(game.id, minutes),
      title: reminderTitle(minutes, meta.name),
      body: `${gameTitle(game)} · ${formatReminderTime(minutes)}`,
      at: new Date(atMs),
      extra: { gameId: game.id, route: `scorer://game/${encodeURIComponent(game.id)}` }
    };
  }).filter(Boolean);
}

export function allReminderIds(game) {
  return DEFAULT_REMINDER_MINUTES.map(minutes => ({ id: reminderId(game.id, minutes) }));
}

export function reminderLabel(minutes) {
  const n = Number(minutes);
  if (n === 1440) return '1 day before';
  if (n === 120) return '2 hours before';
  if (n === 30) return '30 minutes before';
  if (n >= 1440 && n % 1440 === 0) return `${n/1440} days before`;
  if (n >= 60 && n % 60 === 0) return `${n/60} hours before`;
  return `${n} minutes before`;
}

export function notificationTarget(url = '') {
  const match = /^scorer:\/\/game\/([^?#]+)/i.exec(String(url));
  if (!match) return '';
  try { return decodeURIComponent(match[1]); } catch { return match[1]; }
}

export function gameStatus(game, now = Date.now()) {
  const start = new Date(game?.startsAt || 0).getTime();
  const delta = start - now;
  if (!Number.isFinite(start)) return 'Scheduled';
  if (Math.abs(delta) < 2 * 60 * 60 * 1000) return delta > 0 ? 'Starting soon' : 'Started';
  if (delta < 0) return 'Past';
  return 'Upcoming';
}

function normalizeReminders(values) {
  const raw = Array.isArray(values) ? values : DEFAULT_REMINDER_MINUTES;
  return [...new Set(raw.map(Number).filter(n => DEFAULT_REMINDER_MINUTES.includes(n)))].sort((a,b) => b-a);
}

function normalizeDate(value, fallback) {
  const parsed = new Date(value || fallback);
  return Number.isNaN(parsed.getTime()) ? new Date(fallback).toISOString() : parsed.toISOString();
}

function clean(value) { return String(value || '').trim().slice(0, 100); }
function makeId(now) { return `sched-${now.toString(36)}-${Math.random().toString(36).slice(2,8)}`; }
function formatReminderTime(minutes) { return reminderLabel(minutes); }
function reminderTitle(minutes, sportName) {
  if (minutes <= 30) return `${sportName} starts soon`;
  return `Upcoming ${sportName} game`;
}
