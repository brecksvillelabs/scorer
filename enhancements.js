import { SPORT_DEFS } from './sports.js';
import {
  createTeamProfile, upsertTeamProfile, profilesForSport, removeTeamProfile,
  hasMatchActivity, matchContext, matchSummary, addMatchPhoto, listMatchPhotos, deleteMatchPhoto
} from './journal.js';

const STATE_KEY = 'scorer-state-v2';
const FAVORITES_KEY = 'scorer-favorite-teams-v1';
const HISTORY_KEY = 'scorer-match-history-v1';
const ACTIVE_ID_KEY = 'scorer-active-match-id-v1';
const $ = id => document.getElementById(id);

let favorites = readJson(FAVORITES_KEY, []);
let history = readJson(HISTORY_KEY, []);
let viewingMatchId = '';
let photoUrls = [];
let lastArchivedSignature = '';

const el = {
  sportGrid: $('sportGrid'),
  inputNameA: $('inputNameA'), inputNameB: $('inputNameB'), inputColorA: $('inputColorA'), inputColorB: $('inputColorB'),
  inputRosterA: $('inputRosterA'), inputRosterB: $('inputRosterB'), logoPreviewA: $('logoPreviewA'), logoPreviewB: $('logoPreviewB'),
  favoriteSelectA: $('favoriteSelectA'), favoriteSelectB: $('favoriteSelectB'), saveFavoriteA: $('saveFavoriteA'), saveFavoriteB: $('saveFavoriteB'), deleteFavoriteA: $('deleteFavoriteA'), deleteFavoriteB: $('deleteFavoriteB'),
  startGameBtn: $('startGameBtn'), resetSavedBtn: $('resetSavedBtn'),
  journalBtn: $('journalBtn'), journalModal: $('journalModal'), closeJournalBtn: $('closeJournalBtn'), journalMatchCard: $('journalMatchCard'), capturePanel: $('capturePanel'),
  photoCaption: $('photoCaption'), photoInput: $('photoInput'), archiveMatchBtn: $('archiveMatchBtn'), albumGrid: $('albumGrid'), historyList: $('historyList'), toast: $('toast')
};

bind();
renderFavoriteSelects();
ensureCurrentMatchId();
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
  el.albumGrid.addEventListener('click', deletePhotoFromAlbum);
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
    el.journalMatchCard.innerHTML = '<div class="history-empty">Start a match to create a game journal.</div>';
    el.capturePanel.classList.add('hidden');
    el.albumGrid.innerHTML = '<div class="album-empty">No match album yet.</div>';
    renderHistoryList('');
    return;
  }
  el.journalMatchCard.innerHTML = `<div class="journal-match-title">${esc(summary.title)}</div><div class="journal-score">${esc(summary.score)}</div><div class="journal-detail">${esc(summary.detail || summary.period || '')}</div>`;
  el.capturePanel.classList.toggle('hidden', !current);
  revokeUrls();
  let photos = [];
  try { photos = await listMatchPhotos(summary.matchId); } catch {}
  el.albumGrid.innerHTML = photos.length ? photos.map(photoCard).join('') : '<div class="album-empty">No photos yet. Add a sideline photo and Scorer will preserve the live score context with it.</div>';
  renderHistoryList(summary.matchId);
}

function renderHistoryList(activeId) {
  el.historyList.innerHTML = history.length ? history.map(h => `<button class="history-item ${h.matchId === activeId ? 'active' : ''}" data-history-match="${attr(h.matchId)}"><div class="history-title">${esc(h.title)}</div><div class="history-meta">${esc(SPORT_DEFS[h.sport]?.name || h.sport)} · ${new Date(h.startedAt).toLocaleDateString()}</div><div class="history-score">${esc(h.score)}</div></button>`).join('') : '<div class="history-empty">Saved and completed matches will appear here. Their photo albums stay attached to the match.</div>';
}

function photoCard(photo) {
  const url = URL.createObjectURL(photo.blob);
  photoUrls.push(url);
  const c = photo.context || {};
  return `<article class="photo-card"><img src="${url}" alt="Game journal photo"><div class="photo-meta"><div class="photo-context">${esc(c.score || c.title || 'Match photo')}</div><div class="photo-detail">${esc([c.period, c.detail].filter(Boolean).join(' · '))}</div>${photo.caption ? `<div class="photo-caption">${esc(photo.caption)}</div>` : ''}<button class="photo-delete" data-delete-photo="${attr(photo.id)}">Delete</button></div></article>`;
}

async function capturePhoto(event) {
  const file = event.target.files?.[0];
  const state = normalizedState();
  if (!file || !state) return;
  try {
    await addMatchPhoto(state.matchId, file, matchContext(state), el.photoCaption.value);
    archiveState(state, false);
    el.photoCaption.value = '';
    el.photoInput.value = '';
    viewingMatchId = state.matchId;
    await renderJournal();
    toast('Photo added to match album');
  } catch (error) { toast(error?.message || 'Could not save photo'); }
}

async function deletePhotoFromAlbum(event) {
  const button = event.target.closest('[data-delete-photo]');
  if (!button) return;
  try { await deleteMatchPhoto(button.dataset.deletePhoto); await renderJournal(); toast('Photo removed'); }
  catch { toast('Could not remove photo'); }
}

function revokeUrls() { for (const url of photoUrls) URL.revokeObjectURL(url); photoUrls = []; }
function parseRoster(text) { return [...new Set(String(text || '').split(/[\r\n,;]+/).map(x => x.trim().replace(/^"|"$/g,'')).filter(Boolean))].slice(0,40); }
function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } }
function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { toast('Local storage is full — remove a large saved logo or older favorite'); return false; } }
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function attr(v) { return esc(v).replace(/`/g,'&#96;'); }
function toast(message) { el.toast.textContent = message; el.toast.classList.add('show'); setTimeout(() => el.toast.classList.remove('show'), 1700); }
