import { reconcileCompletedState, manuallyFinishState, finalLabel, setsNeeded } from './v031-core.js';

const STORAGE_KEY = 'scorer-state-v2';
const $ = id => document.getElementById(id);
let applying = false;
let lastFinal = null;

boot031();

function boot031() {
  injectStyles();
  installHomeButton();
  installMatchActions();
  installHomeModal();
  installEndModal();
  reconcileSavedMatch();
  observeUi();
  queueMicrotask(refresh031);
}

function readState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}
function writeState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function reconcileSavedMatch() {
  const current = readState();
  if (!current) return;
  const repaired = reconcileCompletedState(current);
  if (!current.finished && repaired?.finished) {
    writeState(repaired);
    location.reload();
  }
}

function installHomeButton() {
  if ($('homeBtn')) return;
  const actions = document.querySelector('.top-actions');
  if (!actions) return;
  const button = document.createElement('button');
  button.id = 'homeBtn'; button.className = 'icon-btn'; button.type = 'button';
  button.setAttribute('aria-label', 'Home'); button.textContent = '⌂';
  actions.prepend(button);
  button.addEventListener('click', openHome);
}

function installMatchActions() {
  if ($('v031MatchActions')) return;
  const tools = $('sportTools');
  if (!tools) return;
  const bar = document.createElement('section');
  bar.id = 'v031MatchActions'; bar.className = 'v031-match-actions';
  bar.innerHTML = `<button id="v031EndGame" class="v031-end-btn" type="button">End game</button>`;
  tools.insertAdjacentElement('afterend', bar);
  $('v031EndGame').addEventListener('click', openEndModal);
}

function installHomeModal() {
  if ($('v031Home')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="v031Home" class="v031-overlay hidden" aria-hidden="true">
      <div class="v031-home-card" role="dialog" aria-modal="true" aria-labelledby="v031HomeTitle">
        <div class="v031-modal-head"><div><div class="eyebrow">SCORER</div><h2 id="v031HomeTitle">Home</h2></div><button id="v031CloseHome" class="icon-btn" type="button">✕</button></div>
        <div id="v031ResumeCard"></div>
        <div class="v031-home-grid">
          <button id="v031NewGame" class="v031-home-action" type="button"><strong>＋ New game</strong><span>Start a clean scoreboard</span></button>
          <button id="v031Teams" class="v031-home-action" type="button"><strong>★ Favorite teams</strong><span>Load or edit saved teams</span></button>
          <button id="v031History" class="v031-home-action" type="button"><strong>📷 Game Journal</strong><span>History, photos and albums</span></button>
        </div>
      </div>
    </div>`);
  $('v031CloseHome').addEventListener('click', closeHome);
  $('v031NewGame').addEventListener('click', () => { closeHome(); $('resetSavedBtn')?.click(); setTimeout(() => $('editBtn')?.click(), 30); });
  $('v031Teams').addEventListener('click', () => { closeHome(); $('editBtn')?.click(); });
  $('v031History').addEventListener('click', () => { closeHome(); $('journalBtn')?.click(); });
}

function installEndModal() {
  if ($('v031EndModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="v031EndModal" class="v031-overlay hidden" aria-hidden="true">
      <div class="v031-end-card" role="dialog" aria-modal="true" aria-labelledby="v031EndTitle">
        <div class="v031-modal-head"><div><div class="eyebrow">MATCH CONTROL</div><h2 id="v031EndTitle">End this game?</h2></div><button id="v031CloseEnd" class="icon-btn" type="button">✕</button></div>
        <p class="v031-muted">Use this when a match ends outside the normal scoring rules. The current score is preserved.</p>
        <label>Reason<select id="v031EndReason"><option>Final</option><option>Forfeit</option><option>Time limit</option><option>Abandoned</option><option>Injury</option><option>Other</option></select></label>
        <label>Result<select id="v031EndWinner"></select></label>
        <div class="v031-confirm-row"><button id="v031CancelEnd" class="secondary-btn" type="button">Cancel</button><button id="v031ConfirmEnd" class="v031-danger-btn" type="button">End game</button></div>
      </div>
    </div>`);
  $('v031CloseEnd').addEventListener('click', closeEndModal);
  $('v031CancelEnd').addEventListener('click', closeEndModal);
  $('v031ConfirmEnd').addEventListener('click', confirmManualEnd);
}

function openHome() {
  const state = readState();
  const host = $('v031ResumeCard');
  if (state) {
    const status = matchStatus(state);
    host.innerHTML = `<button id="v031Resume" class="v031-resume" type="button"><span class="v031-live-dot"></span><span><small>${state.finished ? 'LAST MATCH' : 'ACTIVE MATCH'}</small><strong>${escapeHtml(state.teamA?.name || 'Home')} vs ${escapeHtml(state.teamB?.name || 'Away')}</strong><em>${escapeHtml(status)}</em></span><b>${state.finished ? 'View' : 'Resume'} →</b></button>`;
    $('v031Resume')?.addEventListener('click', closeHome);
  } else host.innerHTML = '';
  $('v031Home').classList.remove('hidden'); $('v031Home').setAttribute('aria-hidden','false');
}
function closeHome() { $('v031Home')?.classList.add('hidden'); $('v031Home')?.setAttribute('aria-hidden','true'); }

function openEndModal() {
  const state = readState(); if (!state || state.finished) return;
  const select = $('v031EndWinner');
  select.innerHTML = `<option value="${currentLeader(state)}">Use current leader</option><option value="A">${escapeHtml(state.teamA?.name || 'Side A')} wins</option><option value="B">${escapeHtml(state.teamB?.name || 'Side B')} wins</option><option value="tie">Tie / draw</option><option value="none">No winner</option>`;
  $('v031EndModal').classList.remove('hidden'); $('v031EndModal').setAttribute('aria-hidden','false');
}
function closeEndModal() { $('v031EndModal')?.classList.add('hidden'); $('v031EndModal')?.setAttribute('aria-hidden','true'); }

function confirmManualEnd() {
  const state = readState(); if (!state) return;
  const winner = $('v031EndWinner').value;
  const reason = $('v031EndReason').value;
  const finalState = manuallyFinishState(state, { winner, reason });
  writeState(finalState);
  location.reload();
}

function currentLeader(state) {
  if (state.sport === 'volleyball') {
    if ((state.teamA?.sets || 0) > (state.teamB?.sets || 0)) return 'A';
    if ((state.teamB?.sets || 0) > (state.teamA?.sets || 0)) return 'B';
  }
  if (state.sport === 'tennis') {
    if ((state.tennis?.sets?.A || 0) > (state.tennis?.sets?.B || 0)) return 'A';
    if ((state.tennis?.sets?.B || 0) > (state.tennis?.sets?.A || 0)) return 'B';
  }
  if (state.sport === 'badminton') {
    if ((state.badminton?.games?.A || 0) > (state.badminton?.games?.B || 0)) return 'A';
    if ((state.badminton?.games?.B || 0) > (state.badminton?.games?.A || 0)) return 'B';
  }
  const a = Number(state.teamA?.score ?? state.teamA?.runs ?? 0), b = Number(state.teamB?.score ?? state.teamB?.runs ?? 0);
  return a === b ? 'tie' : a > b ? 'A' : 'B';
}

function observeUi() {
  const observer = new MutationObserver(() => { if (!applying) requestAnimationFrame(refresh031); });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  document.addEventListener('click', e => {
    if (e.target.closest('#undoBtn')) setTimeout(refresh031, 0);
    if (e.target.closest('.sport-choice')) setTimeout(setVolleyballDefault, 0);
  });
}

function refresh031() {
  applying = true;
  try {
    setVolleyballDefault();
    const state = readState();
    renderFinalState(state);
  } finally { applying = false; }
}

function setVolleyballDefault() {
  const select = $('settingBestOf');
  const start = $('startGameBtn');
  if (!select || !start || start.textContent.trim() === 'Apply changes') return;
  if (select.dataset.v031Defaulted) return;
  select.value = '3';
  select.dataset.v031Defaulted = 'true';
}

function renderFinalState(state) {
  const tools = $('sportTools'), actions = $('v031MatchActions');
  if (!state?.finished) {
    document.body.classList.remove('v031-is-final');
    if (tools) tools.style.display = '';
    if (actions) actions.style.display = '';
    $('v031FinalPanel')?.remove();
    lastFinal = null;
    return;
  }

  document.body.classList.add('v031-is-final');
  if (tools) tools.style.display = 'none';
  if (actions) actions.style.display = 'none';
  document.querySelectorAll('#gameSurface [data-action], #sportTools [data-action]').forEach(btn => btn.disabled = true);

  const label = finalLabel(state);
  const signature = `${state.matchId}|${label}|${state.updatedAt}`;
  if (lastFinal === signature && $('v031FinalPanel')) return;
  lastFinal = signature;
  $('v031FinalPanel')?.remove();
  const panel = document.createElement('section'); panel.id = 'v031FinalPanel'; panel.className = 'v031-final-panel';
  panel.innerHTML = `<div><small>FINAL</small><strong>${escapeHtml(label)}</strong><span>${escapeHtml(matchStatus(state))}</span></div><div class="v031-final-actions"><button data-v031="journal" type="button">Game Journal</button><button data-v031="home" type="button">Home</button><button data-v031="new" type="button">New Match</button></div>`;
  (tools || $('gameSurface'))?.insertAdjacentElement('afterend', panel);
  panel.querySelector('[data-v031="journal"]').addEventListener('click', () => $('journalBtn')?.click());
  panel.querySelector('[data-v031="home"]').addEventListener('click', openHome);
  panel.querySelector('[data-v031="new"]').addEventListener('click', () => { $('resetSavedBtn')?.click(); setTimeout(() => $('editBtn')?.click(), 30); });

  const center = document.querySelector('.center-banner'); if (center) center.innerHTML = `<strong>${escapeHtml(label)}</strong>`;
}

function matchStatus(state) {
  const sport = state.sport;
  if (sport === 'volleyball') return `${state.teamA?.sets || 0}–${state.teamB?.sets || 0} sets · best of ${state.volleyball?.bestOf || 3}${state.finished ? ' · Final' : ''}`;
  if (sport === 'tennis') return `${state.tennis?.sets?.A || 0}–${state.tennis?.sets?.B || 0} sets${state.finished ? ' · Final' : ''}`;
  if (sport === 'badminton') return `${state.badminton?.games?.A || 0}–${state.badminton?.games?.B || 0} games${state.finished ? ' · Final' : ''}`;
  if (sport === 'cricket') return `${state.teamA?.runs || 0}/${state.teamA?.wickets || 0} · ${state.teamB?.runs || 0}/${state.teamB?.wickets || 0}${state.finished ? ' · Final' : ''}`;
  return `${state.teamA?.score || 0}–${state.teamB?.score || 0}${state.finished ? ' · Final' : ''}`;
}

function injectStyles() {
  if ($('v031Styles')) return;
  const style = document.createElement('style'); style.id = 'v031Styles';
  style.textContent = `
  .v031-match-actions{max-width:1100px;margin:12px auto 28px;padding:0 24px;display:flex;justify-content:flex-end}.v031-end-btn{border:1px solid rgba(248,113,113,.35);background:rgba(127,29,29,.15);color:#fecaca;border-radius:16px;padding:13px 18px;font-weight:800}.v031-overlay{position:fixed;inset:0;z-index:1200;background:rgba(2,8,23,.82);backdrop-filter:blur(16px);display:flex;align-items:center;justify-content:center;padding:20px}.v031-overlay.hidden{display:none}.v031-home-card,.v031-end-card{width:min(620px,100%);max-height:90vh;overflow:auto;border:1px solid rgba(148,163,184,.2);border-radius:28px;background:linear-gradient(180deg,#0d1a2d,#081321);box-shadow:0 30px 80px rgba(0,0,0,.45);padding:22px}.v031-modal-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}.v031-modal-head h2{margin:3px 0 0;font-size:28px}.v031-resume{width:100%;border:1px solid rgba(45,212,191,.28);background:linear-gradient(135deg,rgba(13,148,136,.2),rgba(37,99,235,.16));color:#f8fafc;border-radius:22px;padding:18px;display:flex;align-items:center;gap:14px;text-align:left;margin-bottom:16px}.v031-resume span:nth-child(2){display:grid;gap:3px;flex:1}.v031-resume small{color:#67e8f9;font-weight:900;letter-spacing:.12em}.v031-resume strong{font-size:18px}.v031-resume em{font-style:normal;color:#94a3b8}.v031-live-dot{width:10px;height:10px;border-radius:50%;background:#2dd4bf;box-shadow:0 0 0 5px rgba(45,212,191,.12)}.v031-home-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.v031-home-action{min-height:98px;border:1px solid rgba(148,163,184,.18);background:rgba(15,30,50,.8);border-radius:20px;color:#f8fafc;padding:16px;text-align:left;display:grid;gap:5px}.v031-home-action:last-child{grid-column:1/-1}.v031-home-action strong{font-size:17px}.v031-home-action span,.v031-muted{color:#94a3b8}.v031-end-card label{display:grid;gap:7px;margin:14px 0;color:#cbd5e1;font-weight:700}.v031-end-card select{width:100%;background:#102136;color:#f8fafc;border:1px solid rgba(148,163,184,.22);border-radius:14px;padding:13px}.v031-confirm-row{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}.v031-danger-btn{border:1px solid #dc2626;background:#b91c1c;color:white;border-radius:14px;padding:12px 18px;font-weight:900}.v031-final-panel{max-width:1100px;margin:12px auto 28px;padding:20px 24px;border:1px solid rgba(45,212,191,.28);border-radius:24px;background:linear-gradient(135deg,rgba(13,148,136,.18),rgba(37,99,235,.14));display:flex;align-items:center;justify-content:space-between;gap:18px}.v031-final-panel>div:first-child{display:grid;gap:4px}.v031-final-panel small{color:#67e8f9;font-weight:950;letter-spacing:.16em}.v031-final-panel strong{font-size:clamp(24px,5vw,42px)}.v031-final-panel span{color:#94a3b8}.v031-final-actions{display:flex;gap:8px;flex-wrap:wrap}.v031-final-actions button{border:1px solid rgba(148,163,184,.22);background:#102136;color:#f8fafc;border-radius:14px;padding:12px 14px;font-weight:800}.v031-is-final #gameSurface .score-btn{opacity:.42;pointer-events:none}.v031-is-final #gameSurface{filter:saturate(.84)}
  @media(max-width:640px){.v031-home-grid{grid-template-columns:1fr}.v031-home-action:last-child{grid-column:auto}.v031-final-panel{margin:10px 16px 24px;align-items:stretch;flex-direction:column}.v031-final-actions{display:grid;grid-template-columns:1fr 1fr}.v031-final-actions button:last-child{grid-column:1/-1}.v031-match-actions{padding:0 16px}.top-actions{gap:8px}.top-actions .icon-btn{min-width:48px}}
  `;
  document.head.appendChild(style);
}

function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// Exported only for browser-console diagnostics and deterministic smoke checks.
window.Scorer031 = { setsNeeded };
