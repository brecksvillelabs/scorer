const DIARY_KEY = 'scorer-game-diary-v1';

function readStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DIARY_KEY) || 'null');
    return {
      notes: Array.isArray(parsed?.notes) ? parsed.notes : [],
      photoHighlights: parsed?.photoHighlights && typeof parsed.photoHighlights === 'object' ? parsed.photoHighlights : {}
    };
  } catch {
    return { notes: [], photoHighlights: {} };
  }
}

function writeStore(store) {
  localStorage.setItem(DIARY_KEY, JSON.stringify(store));
  return store;
}

function cloneContext(context) {
  try { return structuredClone(context || {}); }
  catch { return JSON.parse(JSON.stringify(context || {})); }
}

export function addMatchNote(matchId, text, context, highlighted = false) {
  if (!matchId) throw new Error('Start or resume a match before adding a note');
  const noteText = String(text || '').trim().slice(0, 500);
  if (!noteText) throw new Error('Type a note first');
  const store = readStore();
  const note = {
    id: `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    matchId,
    text: noteText,
    context: cloneContext(context),
    highlighted: Boolean(highlighted),
    createdAt: Date.now()
  };
  store.notes.push(note);
  writeStore(store);
  return note;
}

export function listMatchNotes(matchId) {
  return readStore().notes.filter(note => note.matchId === matchId).sort((a, b) => a.createdAt - b.createdAt);
}

export function deleteMatchNote(id) {
  const store = readStore();
  store.notes = store.notes.filter(note => note.id !== id);
  writeStore(store);
}

export function setMatchNoteHighlighted(id, highlighted) {
  const store = readStore();
  const note = store.notes.find(item => item.id === id);
  if (!note) return false;
  note.highlighted = Boolean(highlighted);
  writeStore(store);
  return note.highlighted;
}

export function getPhotoHighlights() {
  return readStore().photoHighlights;
}

export function setPhotoHighlighted(photoId, matchId, highlighted) {
  if (!photoId || !matchId) return false;
  const store = readStore();
  if (highlighted) store.photoHighlights[photoId] = { matchId, highlighted: true };
  else delete store.photoHighlights[photoId];
  writeStore(store);
  return Boolean(highlighted);
}

export function deleteMatchDiary(matchId) {
  if (!matchId) return;
  const store = readStore();
  store.notes = store.notes.filter(note => note.matchId !== matchId);
  for (const [photoId, value] of Object.entries(store.photoHighlights)) {
    if (value?.matchId === matchId) delete store.photoHighlights[photoId];
  }
  writeStore(store);
}

export function cleanupDiary(validMatchIds = []) {
  const valid = new Set((Array.isArray(validMatchIds) ? validMatchIds : []).filter(Boolean));
  const store = readStore();
  store.notes = store.notes.filter(note => valid.has(note.matchId));
  for (const [photoId, value] of Object.entries(store.photoHighlights)) {
    if (!valid.has(value?.matchId)) delete store.photoHighlights[photoId];
  }
  writeStore(store);
}
