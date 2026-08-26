import { SPORT_DEFS } from './sports.js';
import {
  createTeamProfile, upsertTeamProfile, profilesForSport, removeTeamProfile,
  hasMatchActivity, matchContext, matchSummary, addMatchPhoto, listMatchPhotos, deleteMatchPhoto
} from './journal.js';
import {
  addMatchNote, listMatchNotes, deleteMatchNote, setMatchNoteHighlighted,
  getPhotoHighlights, setPhotoHighlighted, cleanupDiary
} from './diary.js';
import { mergeDiaryItems, diaryContextText, diaryMomentSummary } from './v036-core.js';

const STATE_KEY = 'scorer-state-v2';
const FAVORITES_KEY = 'scorer-favorite-teams-v1';
const HISTORY_KEY = 'scorer-match-history-v1';
const ACTIVE_ID_KEY = 'scorer-active-match-id-v1';
const NEW_SPORT_NAMES = { lacrosse: 'Lacrosse', kabaddi: 'Kabaddi', baseball: 'Baseball' };
const $ = id => document.getElementById(id);

let favorites = readJson(FAVORITES_KEY, []);
let history = readJson(HISTORY_KEY, []);
let viewingMatchId = '';
let photoUrls = [];
let lastArchivedSignature = '';

const el = {
  sportGrid: $('sportGrid'),
  inputNameA: $('inputNameA'), inputNameB: $('inputNameB'), inputColorA: $('inputColorA'), inputColorB: $('inputColorB'),
  inputLogoA: $('inputLogoA'), inputLogoB: $('inputLogoB'),
  inputRosterA: $('inputRosterA'), inputRosterB: $('inputRosterB'), logoPreviewA: $('logoPreviewA'), logoPreviewB: $('logoPreviewB'),
  favoriteSelectA: $('favoriteSelectA'), favoriteSelectB: $('favoriteSelectB'), saveFavoriteA: $('saveFavoriteA'), saveFavoriteB: $('saveFavoriteB'), deleteFavoriteA: $('deleteFavoriteA'), deleteFavoriteB: $('deleteFavoriteB'),
  startGameBtn: $('startGameBtn'), resetSavedBtn: $('resetSavedBtn'),
  journalBtn: $('journalBtn'), journalModal: $('journalModal'), closeJournalBtn: $('closeJournalBtn'), journalMatchCard: $('journalMatchCard'), capturePanel: $('capturePanel'), diarySummary: $('diarySummary'),
  photoCaption: $('photoCaption'), photoInput: $('photoInput'), saveNoteBtn: $('saveNoteBtn'), momentHighlight: $('momentHighlight'), archiveMatchBtn: $('archiveMatchBtn'), albumGrid: $('albumGrid'), historyList: $('historyList'), toast: $('toast')
};

bind();
renderFavoriteSelects();
ensureCurrentMatchId();
cleanupDiary([normalizedState()?.matchId, ...history.map(item => item.matchId)]);
setInterval(syncCompletedMatch, 1200);

function bind() {
  el.favoriteSelectA.addEventListener('change', () => loadFavorite('A'));
  el.favoriteSelectB.addEventListener('change', () => loadFavorite('B'));
  el.saveFavoriteA.addEventListener('click', () => saveFavorite('A'));
  el.saveFavoriteB.addEventListener('click', () => saveFavorite('B'));
  el.deleteFavoriteA.addEventListener('click', () => deleteFavorite('A'));
  el.deleteFavoriteB.addEventListener('click', () => deleteFavorite('B'));

  el.sportGrid.addEventListener('click', event => {
    const button = event.target.closest('.sport-choice');
    if (!button) return;
    const before = currentSport();
    queueMicrotask(() => {
      const after = currentSport();
      if (after !== before) resetPlayersForSportChange();
      renderFavoriteSelects();
    });
  });

  el.startGameBtn.addEventListener('click', () => {
    const before = normalizedState();
    if (before && hasMatchActivity(before)) archiveState(before, false);
    setTimeout(() => { ensureCurrentMatchId(true); viewingMatchId = normalizedState()?.matchId || ''; }, 0);
  }, true);

  el.resetSavedBtn.addEventListener('click', () => {
    const before = normalizedState();
    if (before && hasMatchActivity(before)) archiveState(before, false);
    setTimeout(() => { ensureCurrentMatchId(true); renderFavoriteSelects(); }, 0);
  }, true);

  el.journalBtn.addEventListener('click', () => openJournal());
  el.closeJournalBtn.addEventListener('click', closeJournal);
  el.archiveMatchBtn.addEventListener('click', () => {
    const state = normalizedState();
    if (state) { archiveState(state, true); renderJournal(); }
  });
  el.photoInput.addEventListener('change', capturePhoto);
  el.saveNoteBtn.addEventListener('click', saveQuickNote);
  el.albumGrid.addEventListener('click', handleDiaryAction);
  el.historyList.addEventListener('click', event => {
    const button = event.target.closest('[data-history-match]');
    if (!button) return;
    viewingMatchId = button.dataset.historyMatch;
    renderJournal();
  });
}

function currentSport() {
  return document.querySelector('.sport-choice.active')?.dataset.sport || normalizedState()?.sport || 'volleyball';
}

function resetPlayersForSportChange() {
  el.inputRosterA.value = '';
  el.inputRosterB.value = '';
  $('inputRosterFileA').value = '';
  $('inputRosterFileB').value = '';
  el.favoriteSelectA.value = '';
  el.favoriteSelectB.value = '';
  toast('Player lists cleared for the new sport');
}

function teamFromSetup(side) {
  const name = side === 'A' ? el.inputNameA : el.inputNameB;
  const color = side === 'A' ? el.inputColorA : el.inputColorB;
  const roster = side === 'A' ? el.inputRosterA : el.inputRosterB;
  const state = normalizedState();
  const liveTeam = state?.[side === 'A' ? 'teamA' : 'teamB'];
  return {
    name: name.value.trim() || (side === 'A' ? 'Home' : 'Away'),
    color: color.value,
    logo: logoFromPreview(side) || liveTeam?.logo || '',
    roster: parseRoster(roster.value)
  };
}

function logoFromPreview(side) {
  const host = side === 'A' ? el.logoPreviewA : el.logoPreviewB;
  return host.querySelector('img')?.src || '';
}

function renderFavoriteSelects() {
  const sport = currentSport();
  for (const side of ['A','B']) {
    const select = side === 'A' ? el.favoriteSelectA : el.favoriteSelectB;
    const old = select.value;
    const list = profilesForSport(favorites, sport);
    select.innerHTML = '<option value="">Saved team…</option>' + list.map(p => `<option value="${attr(p.id)}">★ ${esc(p.name)}</option>`).join('');
    if (list.some(p => p.id === old)) select.value = old;
    updateFavoriteButtons(side);
  }
}

function updateFavoriteButtons(side) {
  const select = side === 'A' ? el.favoriteSelectA : el.favoriteSelectB;
  (side === 'A' ? el.deleteFavoriteA : el.deleteFavoriteB).disabled = !select.value;
}

function loadFavorite(side) {
  const select = side === 'A' ? el.favoriteSelectA : el.favoriteSelectB;
  const profile = favorites.find(p => p.id === select.value);
  updateFavoriteButtons(side);
  if (!profile) return;
  (side === 'A' ? el.inputNameA : el.inputNameB).value = profile.name;
  (side === 'A' ? el.inputColorA : el.inputColorB).value = profile.color;
  (side === 'A' ? el.inputRosterA : el.inputRosterB).value = (profile.roster || []).join('\n');
  const preview = side === 'A' ? el.logoPreviewA : el.logoPreviewB;
  preview.innerHTML = profile.logo ? `<img src="${profile.logo}" alt=""><span>${esc(profile.name)} logo</span>` : `<span>No logo — ${esc(profile.name[0] || side)} will be shown</span>`;
  if (profile.logo) applyFavoriteLogoToSetup(side, profile.logo);
  toast(`${profile.name} loaded`);
}

async function applyFavoriteLogoToSetup(side, dataUrl) {
  // app.js owns the in-memory pending logo. Replaying a real file-input change
  // keeps that private state in sync when a saved favorite is loaded.
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
    const file = new File([blob], `favorite-${side.toLowerCase()}.${ext}`, { type: blob.type || 'image/jpeg' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = side === 'A' ? el.inputLogoA : el.inputLogoB;
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } catch {
    // Name/color/roster still load even if a browser blocks programmatic file assignment.
  }
}

function saveFavorite(side) {
  const sport = currentSport();
  const select = side === 'A' ? el.favoriteSelectA : el.favoriteSelectB;
  const team = teamFromSetup(side);
  const existingId = select.value || favorites.find(p => p.sport === sport && p.name.toLowerCase() === team.name.toLowerCase())?.id || '';
  const profile = createTeamProfile(team, sport, existingId);
  favorites = upsertTeamProfile(favorites, profile);
  if (!writeJson(FAVORITES_KEY, favorites)) return;
  renderFavoriteSelects();
  (side === 'A' ? el.favoriteSelectA : el.favoriteSelectB).value = profile.id;
  updateFavoriteButtons(side);
  toast(`${profile.name} saved to favorites`);
}

function deleteFavorite(side) {
  const select = side === 'A' ? el.favoriteSelectA : el.favoriteSelectB;
  if (!select.value) return;
  const profile = favorites.find(p => p.id === select.value);
  favorites = removeTeamProfile(favorites, select.value);
  if (!writeJson(FAVORITES_KEY, favorites)) return;
  renderFavoriteSelects();
  toast(`${profile?.name || 'Team'} removed`);
}

function rawState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || 'null'); } catch { return null; }
}

function normalizedState() {
  const state = rawState();
  if (!state) return null;
  state.matchId = state.matchId || localStorage.getItem(ACTIVE_ID_KEY) || makeId();
  state.startedAt = Number(state.startedAt || state.updatedAt || Date.now());
  return state;
}

function ensureCurrentMatchId(forceNew = false) {
  const state = rawState();
  if (!state) return '';
  const id = !forceNew && state.matchId ? state.matchId : (!forceNew && localStorage.getItem(ACTIVE_ID_KEY)) || makeId();
  localStorage.setItem(ACTIVE_ID_KEY, id);
  return id;
}

function makeId() { return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`; }

function archiveState(state, showToast) {
  if (!state) return;
  const summary = matchSummary(state);
  const signature = `${summary.matchId}:${summary.updatedAt}:${summary.score}:${summary.detail}:${summary.finished}`;
  if (signature === lastArchivedSignature && !showToast) return;
  const i = history.findIndex(x => x.matchId === summary.matchId);
  if (i >= 0) history[i] = summary; else history.unshift(summary);
  history = history.sort((a,b) => b.updatedAt - a.updatedAt).slice(0, 100);
  if (!writeJson(HISTORY_KEY, history)) return;
  lastArchivedSignature = signature;
  if (showToast) toast('Match saved to history');
}

function syncCompletedMatch() {
  const state = normalizedState();
  if (state?.finished) archiveState(state, false);
}

async function openJournal() {
  const state = normalizedState();
  viewingMatchId = state?.matchId || history[0]?.matchId || '';
  el.journalModal.classList.remove('hidden');
  el.journalModal.setAttribute('aria-hidden','false');
  await renderJournal();
}

function closeJournal() {
  el.journalModal.classList.add('hidden');
  el.journalModal.setAttribute('aria-hidden','true');
  revokeUrls();
}

async function renderJournal() {
  const state = normalizedState();
  const current = state && viewingMatchId === state.matchId;
  const summary = current ? matchSummary(state) : history.find(x => x.matchId === viewingMatchId);
  if (!summary) {
    el.journalMatchCard.innerHTML = '<div class="history-empty">Start a match to create a game diary.</div>';
    el.capturePanel.classList.add('hidden');
    el.diarySummary.innerHTML = '';
    el.albumGrid.innerHTML = '<div class="album-empty">No game diary yet.</div>';
    renderHistoryList('');
    return;
  }
  el.journalMatchCard.innerHTML = `<div class="journal-match-title">${esc(summary.title)}</div><div class="journal-score">${esc(summary.score)}</div><div class="journal-detail">${esc(summary.detail || summary.period || '')}</div>`;
  el.capturePanel.classList.toggle('hidden', !current);
  revokeUrls();
  let photos = [];
  try { photos = await listMatchPhotos(summary.matchId); } catch {}
  const notes = listMatchNotes(summary.matchId);
  const items = mergeDiaryItems(photos, notes, getPhotoHighlights());
  const counts = diaryMomentSummary(items);
  el.diarySummary.innerHTML = `<div><strong>${counts.photos}</strong> photo${counts.photos === 1 ? '' : 's'} · <strong>${counts.notes}</strong> note${counts.notes === 1 ? '' : 's'}${counts.highlights ? ` · <strong>${counts.highlights}</strong> highlight${counts.highlights === 1 ? '' : 's'}` : ''}</div><span>Score and game context are stamped automatically.</span>`;
  const moments = [diaryBookend('start', summary.startedAt, 'Game started', sportName(summary.sport))];
  moments.push(...items.map(diaryItemCard));
  if (summary.finished) moments.push(diaryBookend('final', summary.updatedAt, `FINAL · ${summary.score}`, summary.detail || summary.period || ''));
  el.albumGrid.innerHTML = items.length || summary.finished
    ? moments.join('')
    : moments.join('') + '<div class="album-empty diary-empty">Add a photo or quick note during the game. Scorer will stamp the live score and game state onto the moment.</div>';
  renderHistoryList(summary.matchId);
}

function sportName(id) { return SPORT_DEFS[id]?.name || NEW_SPORT_NAMES[id] || id; }

function renderHistoryList(activeId) {
  el.historyList.innerHTML = history.length ? history.map(h => `<button class="history-item ${h.matchId === activeId ? 'active' : ''}" data-history-match="${attr(h.matchId)}"><div class="history-title">${esc(h.title)}</div><div class="history-meta">${esc(sportName(h.sport))} · ${new Date(h.startedAt).toLocaleDateString()}</div><div class="history-score">${esc(h.score)}</div></button>`).join('') : '<div class="history-empty">Saved and completed matches will appear here. Their photos and diary notes stay attached to the match.</div>';
}

function diaryBookend(kind, timestamp, title, detail) {
  return `<article class="diary-bookend ${kind}"><div class="diary-time">${esc(momentTime(timestamp))}</div><div><div class="diary-type">${kind === 'final' ? 'Final' : 'Start'}</div><div class="diary-bookend-title">${esc(title)}</div>${detail ? `<div class="diary-detail">${esc(detail)}</div>` : ''}</div></article>`;
}

function diaryItemCard(item) {
  const c = item.context || {};
  const context = diaryContextText(c);
  const star = item.highlighted ? '★' : '☆';
  if (item.kind === 'photo') {
    const url = URL.createObjectURL(item.blob);
    photoUrls.push(url);
    return `<article class="diary-moment ${item.highlighted ? 'highlighted' : ''}"><div class="diary-rail"><span class="diary-dot photo"></span><span class="diary-time">${esc(momentTime(item.createdAt))}</span></div><div class="diary-card"><div class="diary-card-head"><div><div class="diary-type">Photo</div><div class="diary-score-stamp">${esc(c.score || c.title || 'Match photo')}</div></div><button class="diary-star" data-highlight-photo="${attr(item.id)}" aria-label="${item.highlighted ? 'Remove highlight' : 'Highlight moment'}" aria-pressed="${item.highlighted}">${star}</button></div>${context ? `<div class="diary-detail">${esc(context)}</div>` : ''}<img src="${url}" alt="Game diary photo">${item.caption ? `<div class="diary-text">${esc(item.caption)}</div>` : ''}<button class="photo-delete" data-delete-photo="${attr(item.id)}">Delete</button></div></article>`;
  }
  return `<article class="diary-moment ${item.highlighted ? 'highlighted' : ''}"><div class="diary-rail"><span class="diary-dot note"></span><span class="diary-time">${esc(momentTime(item.createdAt))}</span></div><div class="diary-card note-card"><div class="diary-card-head"><div><div class="diary-type">Note</div><div class="diary-score-stamp">${esc(c.score || c.title || 'Game note')}</div></div><button class="diary-star" data-highlight-note="${attr(item.id)}" aria-label="${item.highlighted ? 'Remove highlight' : 'Highlight moment'}" aria-pressed="${item.highlighted}">${star}</button></div>${context ? `<div class="diary-detail">${esc(context)}</div>` : ''}<div class="diary-text note-text">${esc(item.text)}</div><button class="photo-delete" data-delete-note="${attr(item.id)}">Delete</button></div></article>`;
}

function momentTime(timestamp) {
  const date = new Date(Number(timestamp || Date.now()));
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

async function capturePhoto(event) {
  const file = event.target.files?.[0];
  const state = normalizedState();
  if (!file || !state) return;
  try {
    const photo = await addMatchPhoto(state.matchId, file, matchContext(state), el.photoCaption.value);
    if (el.momentHighlight.checked) setPhotoHighlighted(photo.id, state.matchId, true);
    archiveState(state, false);
    resetMomentComposer();
    el.photoInput.value = '';
    viewingMatchId = state.matchId;
    await renderJournal();
    toast('Photo added to Game Diary');
  } catch (error) { toast(error?.message || 'Could not save photo'); }
}

async function saveQuickNote() {
  const state = normalizedState();
  if (!state) return toast('Start or resume a match before adding a note');
  try {
    addMatchNote(state.matchId, el.photoCaption.value, matchContext(state), el.momentHighlight.checked);
    archiveState(state, false);
    resetMomentComposer();
    viewingMatchId = state.matchId;
    await renderJournal();
    toast('Note added to Game Diary');
  } catch (error) { toast(error?.message || 'Could not save note'); }
}

async function handleDiaryAction(event) {
  const deletePhoto = event.target.closest('[data-delete-photo]');
  if (deletePhoto) {
    try {
      setPhotoHighlighted(deletePhoto.dataset.deletePhoto, viewingMatchId, false);
      await deleteMatchPhoto(deletePhoto.dataset.deletePhoto);
      await renderJournal();
      toast('Photo removed');
    } catch { toast('Could not remove photo'); }
    return;
  }
  const deleteNote = event.target.closest('[data-delete-note]');
  if (deleteNote) {
    deleteMatchNote(deleteNote.dataset.deleteNote);
    await renderJournal();
    toast('Note removed');
    return;
  }
  const photoStar = event.target.closest('[data-highlight-photo]');
  if (photoStar) {
    const highlighted = Boolean(getPhotoHighlights()?.[photoStar.dataset.highlightPhoto]?.highlighted);
    setPhotoHighlighted(photoStar.dataset.highlightPhoto, viewingMatchId, !highlighted);
    await renderJournal();
    toast(highlighted ? 'Highlight removed' : 'Moment highlighted');
    return;
  }
  const noteStar = event.target.closest('[data-highlight-note]');
  if (noteStar) {
    const note = listMatchNotes(viewingMatchId).find(item => item.id === noteStar.dataset.highlightNote);
    setMatchNoteHighlighted(noteStar.dataset.highlightNote, !note?.highlighted);
    await renderJournal();
    toast(note?.highlighted ? 'Highlight removed' : 'Moment highlighted');
  }
}

function resetMomentComposer() {
  el.photoCaption.value = '';
  el.momentHighlight.checked = false;
}

function revokeUrls() { for (const url of photoUrls) URL.revokeObjectURL(url); photoUrls = []; }
function parseRoster(text) { return [...new Set(String(text || '').split(/[\r\n,;]+/).map(x => x.trim().replace(/^"|"$/g,'')).filter(Boolean))].slice(0,40); }
function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } }
function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { toast('Local storage is full — remove a large saved logo or older favorite'); return false; } }
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function attr(v) { return esc(v).replace(/`/g,'&#96;'); }
function toast(message) { el.toast.textContent = message; el.toast.classList.add('show'); setTimeout(() => el.toast.classList.remove('show'), 1700); }
