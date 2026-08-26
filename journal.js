import { formatClock, formatOvers, formatTennisPoint, getPeriodText, otherSide, teamKey } from './sports.js';

const DB_NAME = 'scorer-media-v1';
const STORE = 'photos';

export function createTeamProfile(team, sport, id = '') {
  return {
    id: id || `team-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    sport,
    name: String(team?.name || 'Team').trim() || 'Team',
    color: /^#[0-9a-f]{6}$/i.test(team?.color || '') ? team.color : '#2563eb',
    logo: String(team?.logo || ''),
    roster: [...new Set((team?.roster || []).map(x => String(x || '').trim()).filter(Boolean))].slice(0, 40),
    updatedAt: Date.now()
  };
}

export function upsertTeamProfile(profiles, profile) {
  const list = Array.isArray(profiles) ? profiles.slice() : [];
  const index = list.findIndex(x => x.id === profile.id);
  if (index >= 0) list[index] = profile; else list.push(profile);
  return list.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

export function profilesForSport(profiles, sport) {
  return (Array.isArray(profiles) ? profiles : []).filter(x => x.sport === sport);
}

export function removeTeamProfile(profiles, id) {
  return (Array.isArray(profiles) ? profiles : []).filter(x => x.id !== id);
}

export function hasMatchActivity(state) {
  if (!state) return false;
  if (state.finished || state.period > 1) return true;
  if (state.teamA?.score || state.teamB?.score || state.teamA?.runs || state.teamB?.runs || state.teamA?.wickets || state.teamB?.wickets) return true;
  if (state.volleyball?.setHistory?.length || state.tennis?.setHistory?.length || state.badminton?.gameHistory?.length) return true;
  if (state.sport === 'tennis' && (state.tennis?.points?.A || state.tennis?.points?.B || state.tennis?.games?.A || state.tennis?.games?.B)) return true;
  if (state.sport === 'badminton' && (state.badminton?.points?.A || state.badminton?.points?.B)) return true;
  return false;
}

export function matchContext(state) {
  if (!state) return { title: 'Match', detail: '' };
  const a = state.teamA?.name || 'Side A';
  const b = state.teamB?.name || 'Side B';
  const base = { sport: state.sport, title: `${a} vs ${b}`, period: getPeriodText(state), timestamp: Date.now() };
  if (state.sport === 'cricket') {
    const batSide = state.cricket.battingTeam;
    const bat = state[teamKey(batSide)];
    const field = state[teamKey(otherSide(batSide))];
    return { ...base, score: `${bat.name} ${bat.runs}/${bat.wickets}`, detail: `${formatOvers(bat.balls)} overs · vs ${field.name}` };
  }
  if (state.sport === 'tennis') {
    return { ...base, score: `${state.tennis.sets.A}-${state.tennis.sets.B} sets`, detail: `${state.tennis.games.A}-${state.tennis.games.B} games · ${formatTennisPoint(state,'A')}-${formatTennisPoint(state,'B')}` };
  }
  if (state.sport === 'badminton') {
    return { ...base, score: `${state.badminton.games.A}-${state.badminton.games.B} games`, detail: `${state.badminton.points.A}-${state.badminton.points.B} points` };
  }
  const clock = state.clock?.mode && state.clock.mode !== 'none' ? ` · ${formatClock(state.clock.seconds)}` : '';
  return { ...base, score: `${state.teamA.score}-${state.teamB.score}`, detail: `${getPeriodText(state)}${clock}` };
}

export function matchSummary(state) {
  const ctx = matchContext(state);
  return {
    matchId: state.matchId,
    sport: state.sport,
    teamA: { name: state.teamA.name, color: state.teamA.color, logo: state.teamA.logo },
    teamB: { name: state.teamB.name, color: state.teamB.color, logo: state.teamB.logo },
    title: ctx.title,
    score: ctx.score,
    detail: ctx.detail,
    period: ctx.period,
    finished: Boolean(state.finished),
    winner: state.winner || null,
    startedAt: Number(state.startedAt || Date.now()),
    updatedAt: Number(state.updatedAt || Date.now()),
    archivedAt: Date.now()
  };
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('matchId', 'matchId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Could not open media database'));
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let value;
      try { value = fn(store, resolve, reject); } catch (e) { reject(e); }
      tx.oncomplete = () => { if (value !== undefined) resolve(value); };
      tx.onerror = () => reject(tx.error || new Error('Media database error'));
    });
  } finally { db.close(); }
}

async function compressImage(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Choose an image');
  let source;
  let revoke = '';
  if ('createImageBitmap' in globalThis) source = await createImageBitmap(file);
  else {
    revoke = URL.createObjectURL(file);
    source = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Could not read photo')); img.src = revoke; });
  }
  const max = 1600;
  const sw = source.width || source.naturalWidth, sh = source.height || source.naturalHeight;
  const scale = Math.min(1, max / Math.max(sw, sh));
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.drawImage(source, 0, 0, width, height);
  source.close?.(); if (revoke) URL.revokeObjectURL(revoke);
  return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare photo')), 'image/jpeg', .82));
}

export async function addMatchPhoto(matchId, file, context, caption = '') {
  const blob = await compressImage(file);
  const item = {
    id: `photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    matchId,
    blob,
    caption: String(caption || '').trim().slice(0, 180),
    context,
    createdAt: Date.now()
  };
  await withStore('readwrite', (store) => store.put(item));
  return item;
}

export async function listMatchPhotos(matchId) {
  return await withStore('readonly', (store, resolve, reject) => {
    const req = store.index('matchId').getAll(IDBKeyRange.only(matchId));
    req.onsuccess = () => resolve((req.result || []).sort((a,b) => a.createdAt - b.createdAt));
    req.onerror = () => reject(req.error);
  });
}

export async function deleteMatchPhoto(id) {
  await withStore('readwrite', (store) => store.delete(id));
}
