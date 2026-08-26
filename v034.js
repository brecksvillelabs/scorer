import { eligibleNextBowlers, bowlerFigures, canChooseBowler, nextGeneratedBowlerName } from './v034-core.js';

const STORAGE_KEY = 'scorer-state-v2';
let dismissedKey = null;
let scheduled = false;

boot034();

function readState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}

function bowlerStepKey(state) {
  if (!state?.cricket) return '';
  const bat = state[state.cricket.battingTeam === 'B' ? 'teamB' : 'teamA'];
  return `${state.matchId}:${state.cricket.innings}:${bat?.balls || 0}:${state.cricket.bowler || ''}`;
}

function boot034() {
  injectStyles();
  syncBowlerUX();
  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', handleClick);
  document.addEventListener('submit', handleSubmit);
}

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    syncBowlerUX();
  });
}

function syncBowlerUX() {
  const state = readState();
  const needsChoice = state?.sport === 'cricket' && state.cricket?.needsBowler && !state.finished;
  if (!needsChoice) {
    dismissedKey = null;
    removeSheet();
    removeOpenButton();
    return;
  }

  ensureOpenButton(state);
  const key = bowlerStepKey(state);
  if (dismissedKey === key) return;
  showSheet(state, key);
}

function ensureOpenButton(state) {
  const alert = document.querySelector('.bowler-alert');
  const panel = alert?.parentElement;
  if (!panel) return;
  let button = panel.querySelector('.v034-open-bowler');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'v034-open-bowler';
    button.dataset.v034Action = 'open';
    alert.insertAdjacentElement('afterend', button);
  }
  button.textContent = `Choose next bowler · last over ${state.cricket.bowler}`;
}

function removeOpenButton() {
  document.querySelectorAll('.v034-open-bowler').forEach(node => node.remove());
}

function showSheet(state, key) {
  let sheet = document.getElementById('v034BowlerSheet');
  if (sheet?.dataset.key === key) return;
  sheet?.remove();

  const current = state.cricket.bowler || 'Current bowler';
  const candidates = eligibleNextBowlers(state);
  const candidateHtml = candidates.map(candidate => `
    <button class="v034-bowler-option" type="button" data-v034-action="choose" data-name="${attr(candidate.name)}">
      <span class="v034-bowler-name">${esc(candidate.name)}</span>
      <span class="v034-bowler-figures">${candidate.overs} ov · ${candidate.runs} R · ${candidate.wickets} W · Econ ${candidate.economy}</span>
    </button>`).join('');

  sheet = document.createElement('div');
  sheet.id = 'v034BowlerSheet';
  sheet.dataset.key = key;
  sheet.className = 'v034-sheet-backdrop';
  sheet.innerHTML = `
    <section class="v034-sheet" role="dialog" aria-modal="true" aria-labelledby="v034BowlerTitle">
      <div class="v034-sheet-handle" aria-hidden="true"></div>
      <div class="v034-sheet-head">
        <div>
          <div class="v034-eyebrow">OVER COMPLETE</div>
          <h2 id="v034BowlerTitle">Choose next bowler</h2>
        </div>
        <button class="v034-close" type="button" data-v034-action="close" aria-label="Close bowler chooser">✕</button>
      </div>
      <div class="v034-last-bowler"><span>Last over</span><strong>${esc(current)}</strong><small>A different bowler must bowl the next over.</small></div>
      <div class="v034-bowler-list">${candidateHtml || '<div class="v034-empty">No other saved bowler yet.</div>'}</div>
      <button class="v034-add-toggle" type="button" data-v034-action="add-toggle">＋ Add bowler</button>
      <form id="v034AddBowlerForm" class="v034-add-form hidden">
        <label>Bowler name<input id="v034BowlerName" maxlength="60" autocomplete="off" placeholder="Name or jersey number"></label>
        <div class="v034-form-actions"><button type="button" data-v034-action="generated">Use ${esc(nextGeneratedBowlerName(state))}</button><button type="submit">Use bowler</button></div>
        <div id="v034BowlerError" class="v034-error" role="alert"></div>
      </form>
      <div class="v034-sheet-foot">Scoring stays paused until the next bowler is selected.</div>
    </section>`;
  document.body.appendChild(sheet);
}

function removeSheet() {
  document.getElementById('v034BowlerSheet')?.remove();
}

function handleClick(event) {
  const target = event.target.closest('[data-v034-action]');
  if (!target) return;
  const action = target.dataset.v034Action;
  const state = readState();

  if (action === 'close') {
    dismissedKey = bowlerStepKey(state);
    removeSheet();
    return;
  }
  if (action === 'open') {
    dismissedKey = null;
    showSheet(state, bowlerStepKey(state));
    return;
  }
  if (action === 'add-toggle') {
    document.getElementById('v034AddBowlerForm')?.classList.toggle('hidden');
    setTimeout(() => document.getElementById('v034BowlerName')?.focus(), 0);
    return;
  }
  if (action === 'generated') {
    chooseBowler(state, nextGeneratedBowlerName(state));
    return;
  }
  if (action === 'choose') chooseBowler(state, target.dataset.name);
}

function handleSubmit(event) {
  if (event.target.id !== 'v034AddBowlerForm') return;
  event.preventDefault();
  const state = readState();
  const name = document.getElementById('v034BowlerName')?.value.trim();
  chooseBowler(state, name);
}

function chooseBowler(state, rawName) {
  const name = String(rawName || '').trim();
  const error = document.getElementById('v034BowlerError');
  if (!canChooseBowler(state, name)) {
    if (error) error.textContent = name === state?.cricket?.bowler ? 'Choose a different bowler from the last over.' : 'Enter or choose a bowler.';
    return;
  }

  const select = document.querySelector('select[data-role="bowler"]');
  if (!select) {
    if (error) error.textContent = 'Bowler control is still loading. Try once more.';
    scheduleSync();
    return;
  }

  if (![...select.options].some(option => option.value === name)) select.add(new Option(name, name));
  select.value = name;
  document.querySelectorAll('.v034-bowler-option, .v034-add-toggle, .v034-form-actions button').forEach(button => button.disabled = true);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function injectStyles() {
  if (document.getElementById('v034Styles')) return;
  const style = document.createElement('style');
  style.id = 'v034Styles';
  style.textContent = `
    .v034-open-bowler{width:100%;min-height:56px;margin:10px 0 4px;border:1px solid rgba(45,212,191,.38);border-radius:16px;background:rgba(13,148,136,.14);color:#ccfbf1;font-weight:900;font-size:15px;padding:12px 16px;cursor:pointer}
    .v034-sheet-backdrop{position:fixed;inset:0;z-index:2200;background:rgba(2,6,23,.72);display:flex;align-items:flex-end;justify-content:center;padding:16px;padding-bottom:max(16px,env(safe-area-inset-bottom));backdrop-filter:blur(8px)}
    .v034-sheet{width:min(620px,100%);max-height:min(82vh,760px);overflow:auto;border:1px solid rgba(148,163,184,.2);border-radius:26px;background:#0b1626;box-shadow:0 -20px 70px rgba(0,0,0,.45);padding:10px 16px 18px;color:#e2e8f0}
    .v034-sheet-handle{width:46px;height:5px;border-radius:999px;background:#475569;margin:2px auto 12px}
    .v034-sheet-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
    .v034-sheet-head h2{margin:2px 0 0;font-size:25px;line-height:1.1}
    .v034-eyebrow{font-size:10px;letter-spacing:.14em;font-weight:900;color:#5eead4}
    .v034-close{width:44px;height:44px;border-radius:14px;border:1px solid rgba(148,163,184,.2);background:#111f32;color:#e2e8f0;font-size:20px}
    .v034-last-bowler{margin:16px 0 12px;padding:12px 14px;border-radius:16px;background:rgba(15,23,42,.72);display:grid;grid-template-columns:auto 1fr;gap:2px 10px;align-items:baseline}
    .v034-last-bowler span{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;font-weight:800}.v034-last-bowler strong{font-size:16px}.v034-last-bowler small{grid-column:1/-1;color:#fbbf24;margin-top:3px}
    .v034-bowler-list{display:grid;gap:9px}
    .v034-bowler-option{min-height:64px;width:100%;border:1px solid rgba(148,163,184,.18);border-radius:17px;background:#101f33;color:#f8fafc;text-align:left;padding:11px 14px;display:grid;gap:4px;cursor:pointer}
    .v034-bowler-option:active{transform:scale(.992)}.v034-bowler-option:disabled{opacity:.55}.v034-bowler-name{font-size:17px;font-weight:900}.v034-bowler-figures{font-size:12px;color:#94a3b8}
    .v034-empty{padding:18px;border-radius:16px;background:rgba(15,23,42,.6);color:#94a3b8;text-align:center}
    .v034-add-toggle{width:100%;min-height:52px;margin-top:11px;border:1px dashed rgba(94,234,212,.38);border-radius:16px;background:transparent;color:#99f6e4;font-weight:850;font-size:15px}
    .v034-add-form{margin-top:10px;padding:13px;border-radius:16px;background:rgba(15,23,42,.78);display:grid;gap:10px}.v034-add-form.hidden{display:none}.v034-add-form label{display:grid;gap:6px;font-size:12px;color:#cbd5e1}.v034-add-form input{min-height:48px;border-radius:13px;border:1px solid #334155;background:#07111f;color:#f8fafc;padding:0 12px;font-size:16px}
    .v034-form-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.v034-form-actions button{min-height:48px;border:0;border-radius:13px;background:#164e63;color:white;font-weight:850}.v034-form-actions button:last-child{background:#0f766e}.v034-error{min-height:18px;color:#fca5a5;font-size:12px}
    .v034-sheet-foot{text-align:center;color:#94a3b8;font-size:11px;padding-top:13px}
    @media(min-width:700px){.v034-sheet-backdrop{align-items:center}.v034-sheet{border-radius:26px}}
  `;
  document.head.appendChild(style);
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function attr(value) { return esc(value); }
