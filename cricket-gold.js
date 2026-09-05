import {
  addRosterPlayer, cleanRosterEntries, cricketGoldScorecardMarkup,
  cricketGoldShareMessage, removeRosterPlayer
} from './cricket-gold-core.js';
import { shareContent } from './native-bridge.js';

const STATE_KEY = 'scorer-state-v2';
let rosterSide = 'A';
let installed = false;

function $(id) { return document.getElementById(id); }
function readState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || 'null'); }
  catch { return null; }
}
function rosterFor(side) {
  return cleanRosterEntries($(`inputRoster${side}`)?.value || '');
}
function writeRoster(side, roster) {
  const textarea = $(`inputRoster${side}`);
  if (textarea) textarea.value = cleanRosterEntries(roster).join('\n');
  renderRosterSummary(side);
}
function notify(message) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

function injectStyles() {
  if ($('cricketGoldStyles')) return;
  const style = document.createElement('style');
  style.id = 'cricketGoldStyles';
  style.textContent = `
    .roster-manage-row{display:flex;align-items:center;gap:.55rem;flex-wrap:wrap;margin:.15rem 0 .65rem}
    .roster-manage-row .roster-summary{font-size:.78rem;opacity:.72}
    .roster-editor-modal{max-width:620px}
    .roster-editor-note{font-size:.84rem;opacity:.78;margin:.15rem 0 1rem}
    .roster-add-row{display:grid;grid-template-columns:1fr auto;gap:.6rem;margin-bottom:1rem}
    .roster-add-row input{min-width:0}
    .roster-player-list{display:grid;gap:.45rem;max-height:52vh;overflow:auto;padding:.1rem}
    .roster-player{display:grid;grid-template-columns:2rem 1fr auto;align-items:center;gap:.6rem;padding:.65rem .7rem;border:1px solid rgba(127,127,127,.28);border-radius:.75rem}
    .roster-player-index{font-size:.75rem;opacity:.58;text-align:center}
    .roster-player-name{font-weight:650;overflow-wrap:anywhere}
    .roster-empty{padding:1rem;border:1px dashed rgba(127,127,127,.35);border-radius:.75rem;text-align:center;opacity:.75}
    .cricket-gold-head h2 small{font-size:.52em;font-weight:600;opacity:.75}
    .cricket-gold-inline{margin:.8rem 0 1rem;padding:.7rem .8rem;border-radius:.7rem;background:rgba(127,127,127,.07)}
    .cricket-gold-inline h4{margin:0 0 .3rem;text-transform:uppercase;font-size:.7rem;letter-spacing:.08em;opacity:.68}
    .cricket-gold-inline p{margin:0;line-height:1.45}
    .cricket-gold-active td:first-child{box-shadow:inset 3px 0 0 currentColor}
    .cricket-gold-bowling th,.cricket-gold-bowling td{white-space:nowrap}
    @media(max-width:560px){.roster-editor-modal{width:min(96vw,620px)}.roster-add-row{grid-template-columns:1fr}.cricket-gold-inline{margin:.65rem 0}.cricket-gold-innings header{gap:.7rem}}
  `;
  document.head.appendChild(style);
}

function ensureRosterButtons() {
  for (const side of ['A','B']) {
    const textarea = $(`inputRoster${side}`);
    if (!textarea || document.querySelector(`[data-manage-roster="${side}"]`)) continue;
    const label = textarea.closest('label');
    const row = document.createElement('div');
    row.className = 'roster-manage-row';
    row.innerHTML = `<button class="mini-btn" type="button" data-manage-roster="${side}">Manage roster</button><span class="roster-summary" id="rosterSummary${side}"></span>`;
    label?.insertAdjacentElement('afterend', row);
    textarea.addEventListener('change', () => persistRosterIfSaved(side, 'Roster updated'));
    $(`inputRosterFile${side}`)?.addEventListener('change', () => {
      setTimeout(() => {
        renderRosterSummary(side);
        persistRosterIfSaved(side, 'Imported roster saved');
      }, 350);
    });
    $(`favoriteSelect${side}`)?.addEventListener('change', () => setTimeout(() => {
      renderRosterSummary(side);
      updateSaveLabel(side);
    }, 0));
    renderRosterSummary(side);
    updateSaveLabel(side);
  }
}

function updateSaveLabel(side) {
  const select = $(`favoriteSelect${side}`);
  const button = $(`saveFavorite${side}`);
  if (!button) return;
  button.textContent = select?.value ? 'Update identity' : '★ Save team';
  button.title = select?.value
    ? 'Name, logo and color changes can be updated here. Roster changes save automatically.'
    : 'Save this team once for future matches.';
}

function renderRosterSummary(side) {
  const summary = $(`rosterSummary${side}`);
  if (!summary) return;
  const count = rosterFor(side).length;
  const saved = Boolean($(`favoriteSelect${side}`)?.value);
  summary.textContent = `${count} player${count === 1 ? '' : 's'}${saved ? ' · roster auto-saves' : ''}`;
}

function ensureRosterModal() {
  if ($('rosterManagerModal')) return;
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop hidden';
  modal.id = 'rosterManagerModal';
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML = `<div class="setup-modal roster-editor-modal" role="dialog" aria-modal="true" aria-labelledby="rosterManagerTitle">
    <div class="modal-header"><div><div class="eyebrow">TEAM LIBRARY</div><h2 id="rosterManagerTitle">Manage roster</h2></div><button id="closeRosterManagerBtn" class="icon-btn" type="button" aria-label="Close roster manager">✕</button></div>
    <div id="rosterManagerNote" class="roster-editor-note"></div>
    <div class="roster-add-row"><input id="rosterPlayerInput" maxlength="60" placeholder="Player name" autocomplete="off"><button id="addRosterPlayerBtn" class="primary-btn" type="button">+ Add player</button></div>
    <div id="rosterPlayerList" class="roster-player-list"></div>
    <div class="modal-footer"><button id="doneRosterManagerBtn" class="primary-btn" type="button">Done</button></div>
  </div>`;
  document.body.appendChild(modal);
  $('closeRosterManagerBtn').addEventListener('click', closeRosterManager);
  $('doneRosterManagerBtn').addEventListener('click', closeRosterManager);
  modal.addEventListener('click', event => { if (event.target === modal) closeRosterManager(); });
  $('addRosterPlayerBtn').addEventListener('click', addPlayerFromEditor);
  $('rosterPlayerInput').addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); addPlayerFromEditor(); }
  });
  $('rosterPlayerList').addEventListener('click', event => {
    const remove = event.target.closest('[data-remove-roster-index]');
    if (!remove) return;
    const index = Number(remove.dataset.removeRosterIndex);
    writeRoster(rosterSide, removeRosterPlayer(rosterFor(rosterSide), index));
    persistRosterIfSaved(rosterSide, 'Player removed');
    renderRosterEditor();
  });
}

function openRosterManager(side) {
  rosterSide = side === 'B' ? 'B' : 'A';
  renderRosterEditor();
  const modal = $('rosterManagerModal');
  modal?.classList.remove('hidden');
  modal?.setAttribute('aria-hidden','false');
  setTimeout(() => $('rosterPlayerInput')?.focus(), 0);
}
function closeRosterManager() {
  const modal = $('rosterManagerModal');
  modal?.classList.add('hidden');
  modal?.setAttribute('aria-hidden','true');
}
function addPlayerFromEditor() {
  const input = $('rosterPlayerInput');
  const name = input?.value?.trim() || '';
  if (!name) return;
  const before = rosterFor(rosterSide);
  const after = addRosterPlayer(before, name);
  if (after.length === before.length) {
    notify('That player is already on the roster');
    input?.select();
    return;
  }
  writeRoster(rosterSide, after);
  if (input) input.value = '';
  persistRosterIfSaved(rosterSide, `${name} added`);
  renderRosterEditor();
  input?.focus();
}

function renderRosterEditor() {
  const side = rosterSide;
  const name = $(`inputName${side}`)?.value?.trim() || `Side ${side}`;
  const saved = Boolean($(`favoriteSelect${side}`)?.value);
  const list = rosterFor(side);
  const title = $('rosterManagerTitle');
  if (title) title.textContent = `${name} roster`;
  const note = $('rosterManagerNote');
  if (note) note.textContent = saved
    ? 'This is a saved team. Add/remove changes are saved automatically; you do not need to save the team again.'
    : 'Changes apply to this match setup. Save the team once if you want this roster available automatically in future matches.';
  const host = $('rosterPlayerList');
  if (!host) return;
  host.innerHTML = list.length ? list.map((player,index) => `<div class="roster-player"><span class="roster-player-index">${index + 1}</span><span class="roster-player-name"></span><button class="mini-btn" type="button" data-remove-roster-index="${index}">Remove</button></div>`).join('') : '<div class="roster-empty">No players yet. Add the first player above.</div>';
  host.querySelectorAll('.roster-player-name').forEach((node,index) => { node.textContent = list[index]; });
}

function persistRosterIfSaved(side, message = 'Roster saved') {
  const select = $(`favoriteSelect${side}`);
  const save = $(`saveFavorite${side}`);
  if (!select?.value || !save) {
    renderRosterSummary(side);
    return false;
  }
  // Reuse Scorer's existing team-profile upsert path so the saved team keeps
  // its stable id, name, logo, color and sport association. The user never
  // needs to press Save again for a roster-only edit.
  save.click();
  setTimeout(() => {
    renderRosterSummary(side);
    updateSaveLabel(side);
  }, 0);
  if (message) notify(message);
  return true;
}

function refreshCricketFullScorecard() {
  const state = readState();
  if (state?.sport !== 'cricket') return;
  const host = $('fullScoreboardContent');
  if (!host) return;
  host.innerHTML = cricketGoldScorecardMarkup(state);
  const title = $('fullScoreboardTitle');
  if (title) title.textContent = 'Cricket full scorecard';
  const sheetShare = $('shareScoreSheetBtn');
  if (sheetShare) sheetShare.textContent = 'Share / WhatsApp';
}

async function shareCricketState(state) {
  const text = cricketGoldShareMessage(state);
  const title = `Scorer update: ${state.teamA?.name || 'Side A'} vs ${state.teamB?.name || 'Side B'}`;
  try {
    const result = await shareContent({ title, text, dialogTitle:'Share cricket score' });
    if (!result?.shared) {
      await navigator.clipboard?.writeText?.(text);
      notify('Cricket update copied');
    }
  } catch (error) {
    notify(error?.message || 'Could not open sharing');
  }
}

async function copyCricketState(state) {
  const text = cricketGoldShareMessage(state);
  try {
    await navigator.clipboard.writeText(text);
    notify('Cricket update copied');
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed'; area.style.opacity = '0';
    document.body.appendChild(area); area.select(); document.execCommand?.('copy'); area.remove();
    notify('Cricket update copied');
  }
}

function installClickHandlers() {
  document.addEventListener('click', event => {
    const manage = event.target.closest?.('[data-manage-roster]');
    if (manage) openRosterManager(manage.dataset.manageRoster);
  });

  document.addEventListener('click', event => {
    if (event.target.closest?.('#fullScoreboardBtn')) setTimeout(refreshCricketFullScorecard, 0);
  });

  document.addEventListener('click', event => {
    const button = event.target.closest?.('#shareScoreBtn,#shareScoreSheetBtn,#copyScoreBtn');
    if (!button) return;
    const state = readState();
    if (state?.sport !== 'cricket') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button.id === 'copyScoreBtn') copyCricketState(state);
    else shareCricketState(state);
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('rosterManagerModal')?.classList.contains('hidden')) closeRosterManager();
  });
}

export function installCricketGold() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  injectStyles();
  ensureRosterModal();
  ensureRosterButtons();
  installClickHandlers();
  document.addEventListener('scorer:theme-changed', () => ensureRosterButtons());
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'complete') installCricketGold();
  else window.addEventListener('load', installCricketGold, { once:true });
}
