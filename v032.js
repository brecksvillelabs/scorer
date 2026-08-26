import { SPORT_DEFS } from './sports.js';
import { deleteMatchPhotos } from './journal.js';
import { gameLogLabel, removeHistoryEntry, sortHistory } from './v032-core.js';

const HISTORY_KEY = 'scorer-match-history-v1';
const STATE_KEY = 'scorer-state-v2';
const ACTIVE_ID_KEY = 'scorer-active-match-id-v1';
const REOPEN_KEY = 'scorer-v032-reopen-log';
const $ = id => document.getElementById(id);
let pendingDeleteId = '';

boot032();

function boot032() {
  installStyles();
  installGamesLogButton();
  installGamesLogModal();
  installPhotoStorageHint();
  if (sessionStorage.getItem(REOPEN_KEY) === '1') {
    sessionStorage.removeItem(REOPEN_KEY);
    setTimeout(openGamesLog, 80);
  }
}

function installGamesLogButton() {
  const grid = document.querySelector('.v031-home-grid');
  if (!grid || $('v032GamesLog')) return;
  const button = document.createElement('button');
  button.id = 'v032GamesLog';
  button.className = 'v031-home-action';
  button.type = 'button';
  button.innerHTML = '<strong>🗂 Games Log</strong><span>Scores, results and saved albums</span>';
  grid.appendChild(button);
  button.addEventListener('click', () => {
    $('v031Home')?.classList.add('hidden');
    $('v031Home')?.setAttribute('aria-hidden', 'true');
    openGamesLog();
  });
}

function installPhotoStorageHint() {
  const panel = $('capturePanel');
  if (!panel || $('v032PhotoHint')) return;
  const note = document.createElement('div');
  note.id = 'v032PhotoHint';
  note.className = 'v032-photo-hint';
  note.textContent = 'Photos are saved locally on this device and stay attached to this game.';
  panel.appendChild(note);
}

function installGamesLogModal() {
  if ($('v032GamesModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="v032GamesModal" class="v031-overlay hidden" aria-hidden="true">
      <div class="v032-log-card" role="dialog" aria-modal="true" aria-labelledby="v032GamesTitle">
        <div class="v031-modal-head">
          <div><div class="eyebrow">SCORER</div><h2 id="v032GamesTitle">Games Log</h2></div>
          <button id="v032CloseGames" class="icon-btn" type="button" aria-label="Close games log">✕</button>
        </div>
        <div class="v032-log-intro">Saved and completed games on this device. Deleting a game also removes its local photo album.</div>
        <div id="v032GamesList" class="v032-games-list"></div>
        <div id="v032DeleteConfirm" class="v032-delete-confirm hidden"></div>
      </div>
    </div>`);

  $('v032CloseGames').addEventListener('click', closeGamesLog);
  $('v032GamesList').addEventListener('click', handleGamesClick);
  $('v032DeleteConfirm').addEventListener('click', handleConfirmClick);
}

function openGamesLog() {
  pendingDeleteId = '';
  $('v032DeleteConfirm')?.classList.add('hidden');
  renderGamesLog();
  $('v032GamesModal').classList.remove('hidden');
  $('v032GamesModal').setAttribute('aria-hidden', 'false');
}

function closeGamesLog() {
  $('v032GamesModal')?.classList.add('hidden');
  $('v032GamesModal')?.setAttribute('aria-hidden', 'true');
  pendingDeleteId = '';
}

function readHistory() {
  try { return sortHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')); }
  catch { return []; }
}

function readState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || 'null'); }
  catch { return null; }
}

function renderGamesLog() {
  const history = readHistory();
  const host = $('v032GamesList');
  if (!history.length) {
    host.innerHTML = '<div class="v032-empty">No saved games yet. Completed games and matches saved from Game Journal will appear here.</div>';
    return;
  }

  host.innerHTML = history.map(item => {
    const sport = SPORT_DEFS[item.sport];
    const date = new Date(item.startedAt || item.archivedAt || Date.now());
    const when = Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' });
    return `<article class="v032-game-row">
      <div class="v032-game-icon">${sport?.icon || '🏆'}</div>
      <div class="v032-game-copy">
        <strong>${esc(item.title || 'Match')}</strong>
        <span>${esc([sport?.name || item.sport || 'Game', when].filter(Boolean).join(' · '))}</span>
        <b>${esc(item.score || '')}</b>
        <em>${esc(item.detail || item.period || (item.finished ? 'Final' : 'Saved game'))}</em>
      </div>
      <div class="v032-game-actions">
        <button type="button" data-v032-view="${attr(item.matchId)}">View</button>
        <button class="danger" type="button" data-v032-delete="${attr(item.matchId)}">Delete</button>
      </div>
    </article>`;
  }).join('');
}

function handleGamesClick(event) {
  const view = event.target.closest('[data-v032-view]');
  if (view) return viewInJournal(view.dataset.v032View);
  const del = event.target.closest('[data-v032-delete]');
  if (del) askDelete(del.dataset.v032Delete);
}

function viewInJournal(matchId) {
  closeGamesLog();
  $('journalBtn')?.click();
  setTimeout(() => {
    const button = [...document.querySelectorAll('[data-history-match]')].find(x => x.dataset.historyMatch === matchId);
    button?.click();
  }, 120);
}

function askDelete(matchId) {
  const item = readHistory().find(x => x.matchId === matchId);
  if (!item) return;
  pendingDeleteId = matchId;
  const state = readState();
  const clearsFinal = state?.matchId === matchId && state?.finished;
  const host = $('v032DeleteConfirm');
  host.innerHTML = `<div><strong>Delete ${esc(gameLogLabel(item))}?</strong><span>This removes the game from Games Log and deletes its photos from this device.${clearsFinal ? ' Because this is also the saved final scoreboard, that saved scoreboard will be cleared too.' : ''}</span></div><div><button type="button" data-v032-cancel>Cancel</button><button class="danger" type="button" data-v032-confirm>Delete game</button></div>`;
  host.classList.remove('hidden');
  host.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function handleConfirmClick(event) {
  if (event.target.closest('[data-v032-cancel]')) {
    pendingDeleteId = '';
    $('v032DeleteConfirm').classList.add('hidden');
    return;
  }
  if (event.target.closest('[data-v032-confirm]')) deleteGame(pendingDeleteId);
}

async function deleteGame(matchId) {
  if (!matchId) return;
  const history = removeHistoryEntry(readHistory(), matchId);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

  const state = readState();
  const clearingSavedFinal = state?.matchId === matchId && state?.finished;
  if (clearingSavedFinal) {
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(ACTIVE_ID_KEY);
  }

  try { await deleteMatchPhotos(matchId); }
  catch (error) {
    toast(error?.message || 'Game removed, but its photo album could not be fully deleted');
    renderGamesLog();
    return;
  }

  sessionStorage.setItem(REOPEN_KEY, '1');
  location.reload();
}

function installStyles() {
  if ($('v032Styles')) return;
  const style = document.createElement('style');
  style.id = 'v032Styles';
  style.textContent = `
    .v031-home-grid #v031History,.v031-home-grid #v032GamesLog{grid-column:auto}
    .v032-log-card{width:min(760px,100%);max-height:90vh;overflow:auto;border:1px solid rgba(148,163,184,.2);border-radius:28px;background:linear-gradient(180deg,#0d1a2d,#081321);box-shadow:0 30px 80px rgba(0,0,0,.45);padding:22px;color:#f8fafc}
    .v032-log-intro,.v032-photo-hint{color:#94a3b8;font-size:14px}.v032-log-intro{margin:-4px 0 16px}.v032-photo-hint{margin-top:4px}
    .v032-games-list{display:grid;gap:10px}.v032-game-row{display:grid;grid-template-columns:auto 1fr auto;gap:13px;align-items:center;padding:14px;border:1px solid rgba(148,163,184,.16);border-radius:20px;background:rgba(15,30,50,.72)}
    .v032-game-icon{width:46px;height:46px;border-radius:15px;display:grid;place-items:center;background:rgba(30,41,59,.9);font-size:23px}.v032-game-copy{min-width:0;display:grid;gap:2px}.v032-game-copy strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v032-game-copy span,.v032-game-copy em{color:#94a3b8;font-size:13px;font-style:normal}.v032-game-copy b{font-size:20px}.v032-game-actions{display:flex;gap:7px}.v032-game-actions button,.v032-delete-confirm button{border:1px solid rgba(148,163,184,.22);background:#102136;color:#f8fafc;border-radius:12px;padding:9px 12px;font-weight:800}.v032-game-actions .danger,.v032-delete-confirm .danger{border-color:rgba(248,113,113,.36);background:rgba(127,29,29,.28);color:#fecaca}
    .v032-delete-confirm{margin-top:14px;padding:14px;border:1px solid rgba(248,113,113,.3);border-radius:18px;background:rgba(127,29,29,.14);display:flex;justify-content:space-between;gap:14px;align-items:center}.v032-delete-confirm.hidden{display:none}.v032-delete-confirm>div:first-child{display:grid;gap:4px}.v032-delete-confirm span{color:#cbd5e1;font-size:13px}.v032-delete-confirm>div:last-child{display:flex;gap:8px;flex-shrink:0}.v032-empty{padding:30px 16px;text-align:center;color:#94a3b8;border:1px dashed rgba(148,163,184,.2);border-radius:18px}
    @media(max-width:620px){.v032-game-row{grid-template-columns:auto 1fr}.v032-game-actions{grid-column:1/-1}.v032-game-actions button{flex:1}.v032-delete-confirm{align-items:stretch;flex-direction:column}.v032-delete-confirm>div:last-child button{flex:1}}
  `;
  document.head.appendChild(style);
}

function toast(message) {
  const el = $('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function attr(value) { return esc(value).replace(/`/g, '&#96;'); }
