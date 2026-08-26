import { formatClock, formatOvers, formatTennisPoint, getPeriodText, otherSide, teamKey } from './sports.js';
import { getBaseballPeriodText } from './baseball-core.js';

const DB_NAME = 'scorer-media-v1';
const STORE = 'photos';
const MAX_ORIGINAL_FALLBACK_BYTES = 15 * 1024 * 1024;

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
  if (state.sport === 'baseball') {
    const b = state.baseball;
    if (b?.half === 'bottom' || b?.balls || b?.strikes || b?.outs || b?.hits?.A || b?.hits?.B || b?.errors?.A || b?.errors?.B || b?.bases?.first || b?.bases?.second || b?.bases?.third) return true;
  }
  return false;
}

export function matchContext(state) {
  if (!state) return { title: 'Match', detail: '' };
  const a = state.teamA?.name || 'Side A';
  const b = state.teamB?.name || 'Side B';
  const period = state.sport === 'baseball' ? getBaseballPeriodText(state) : getPeriodText(state);
  const base = { sport: state.sport, title: `${a} vs ${b}`, period, timestamp: Date.now() };
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
  if (state.sport === 'baseball') {
    const bb = state.baseball;
    return {
      ...base,
      score: `${state.teamA.score}-${state.teamB.score}`,
      detail: `${period} · B-S-O ${bb.balls}-${bb.strikes}-${bb.outs} · H ${bb.hits.A}-${bb.hits.B} · E ${bb.errors.A}-${bb.errors.B}`
    };
  }
  const clock = state.clock?.mode && state.clock.mode !== 'none' ? ` · ${formatClock(state.clock.seconds)}` : '';
  return { ...base, score: `${state.teamA.score}-${state.teamB.score}`, detail: `${period}${clock}` };
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
    if (!('indexedDB' in globalThis)) return reject(new Error('Photo storage is unavailable in this browser'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('matchId', 'matchId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error || new Error('Could not open photo storage'));
    req.onblocked = () => reject(new Error('Photo storage is busy. Close other Scorer tabs and try again.'));
  });
}

function originalFallback(file) {
  if (file.size > MAX_ORIGINAL_FALLBACK_BYTES) throw new Error('This photo is too large to save. Try a smaller image or screenshot.');
  return file.slice(0, file.size, file.type || 'image/jpeg');
}

async function decodeBitmap(file) {
  if (!('createImageBitmap' in globalThis)) return null;
  try { return await createImageBitmap(file); }
  catch { return null; }
}

async function decodeHtmlImage(file) {
  if (typeof Image === 'undefined' || typeof URL === 'undefined') return null;
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not decode photo'));
      img.src = url;
    });
    return { image, url };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

async function canvasBlob(canvas) {
  return await new Promise(resolve => {
    try { canvas.toBlob(blob => resolve(blob || null), 'image/jpeg', .82); }
    catch { resolve(null); }
  });
}

async function compressImage(file) {
  if (!file || !String(file.type || '').startsWith('image/')) throw new Error('Choose a photo or image file');

  let source = await decodeBitmap(file);
  let html = null;
  if (!source) {
    html = await decodeHtmlImage(file);
    source = html?.image || null;
  }
  if (!source) return originalFallback(file);

  try {
    const sw = source.width || source.naturalWidth;
    const sh = source.height || source.naturalHeight;
    if (!sw || !sh || typeof document === 'undefined') return originalFallback(file);
    const max = 1600;
    const scale = Math.min(1, max / Math.max(sw, sh));
    const width = Math.max(1, Math.round(sw * scale));
    const height = Math.max(1, Math.round(sh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false }) || canvas.getContext('2d');
    if (!ctx) return originalFallback(file);
    ctx.drawImage(source, 0, 0, width, height);
    return (await canvasBlob(canvas)) || originalFallback(file);
  } catch {
    return originalFallback(file);
  } finally {
    source?.close?.();
    if (html?.url) URL.revokeObjectURL(html.url);
  }
}

async function putPhoto(item) {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).put(item);
      req.onerror = () => reject(req.error || new Error('Could not write photo'));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Could not save photo'));
      tx.onabort = () => reject(tx.error || new Error('Photo save was interrupted'));
    });
  } finally { db.close(); }
}

export async function addMatchPhoto(matchId, file, context, caption = '') {
  if (!matchId) throw new Error('Start or resume a match before adding photos');
  const blob = await compressImage(file);
  const item = {
    id: `photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    matchId,
    blob,
    mimeType: blob.type || file.type || 'image/jpeg',
    caption: String(caption || '').trim().slice(0, 180),
    context: context ? structuredCloneSafe(context) : {},
    createdAt: Date.now()
  };
  await putPhoto(item);
  return item;
}

function structuredCloneSafe(value) {
  try { return structuredClone(value); }
  catch { return JSON.parse(JSON.stringify(value ?? {})); }
}

export async function listMatchPhotos(matchId) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).index('matchId').getAll(IDBKeyRange.only(matchId));
      req.onsuccess = () => resolve((req.result || []).sort((a,b) => a.createdAt - b.createdAt));
      req.onerror = () => reject(req.error || new Error('Could not load match photos'));
      tx.onerror = () => reject(tx.error || new Error('Could not read photo storage'));
    });
  } finally { db.close(); }
}

export async function deleteMatchPhoto(id) {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Could not delete photo'));
      tx.onabort = () => reject(tx.error || new Error('Photo deletion was interrupted'));
    });
  } finally { db.close(); }
}

export async function deleteMatchPhotos(matchId) {
  if (!matchId) return 0;
  const db = await openDb();
  let count = 0;
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.index('matchId').openKeyCursor(IDBKeyRange.only(matchId));
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        store.delete(cursor.primaryKey);
        count += 1;
        cursor.continue();
      };
      req.onerror = () => reject(req.error || new Error('Could not find match photos'));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Could not delete match album'));
      tx.onabort = () => reject(tx.error || new Error('Album deletion was interrupted'));
    });
    return count;
  } finally { db.close(); }
}
