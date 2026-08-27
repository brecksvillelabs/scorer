import {
  SCHEDULE_STORAGE_KEY, DEFAULT_REMINDER_MINUTES, createScheduledGame, sortScheduledGames,
  upcomingGames, sportMeta, gameTitle, reminderLabel, gameStatus
} from './v040-core.js';
import {
  nativePlatform, nativePlatformName, notificationCapability, syncGameReminders,
  cancelGameReminders, shareScheduledGame, installNativeOpenHandlers
} from './native-bridge.js';

const $ = id => document.getElementById(id);
let editingId = '';
let pendingDeleteId = '';
let highlightId = '';
let capability = null;

boot040();

function boot040() {
  installHomeAction();
  installModal();
  installNativeOpenHandlers(id => {
    highlightId = id;
    openSchedule();
  });
  refreshHomeBadge();
}

function installHomeAction() {
  const grid = document.querySelector('.v031-home-grid');
  if (!grid || $('v040Upcoming')) return;
  const button = document.createElement('button');
  button.id = 'v040Upcoming';
  button.className = 'v031-home-action v040-home-action';
  button.type = 'button';
  button.innerHTML = '<strong>🗓 Upcoming Games <b id="v040HomeCount" class="v040-count"></b></strong><span>Schedule games & reminders</span>';
  const first = grid.firstElementChild;
  if (first?.nextSibling) grid.insertBefore(button, first.nextSibling);
  else grid.appendChild(button);
  button.addEventListener('click', () => {
    closeHome();
    openSchedule();
  });
}

function installModal() {
  if ($('v040ScheduleModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="v040ScheduleModal" class="v031-overlay hidden" aria-hidden="true">
      <div class="v040-card" role="dialog" aria-modal="true" aria-labelledby="v040Title">
        <div class="v031-modal-head">
          <div><div class="eyebrow">SCORER</div><h2 id="v040Title">Upcoming Games</h2></div>
          <button id="v040Close" class="icon-btn" type="button" aria-label="Close upcoming games">✕</button>
        </div>
        <div class="v040-intro">
          <div><strong>Plan the game. Scorer remembers the rest.</strong><span>Games stay on this device. The Android app can deliver local reminders even without ScorerHub.</span></div>
          <button id="v040Add" class="primary-btn" type="button">＋ Add game</button>
        </div>
        <div id="v040NativeStatus" class="v040-native-status"></div>
        <div id="v040Form" class="v040-form-wrap hidden"></div>
        <div id="v040DeleteConfirm" class="v040-delete-confirm hidden"></div>
        <div id="v040List" class="v040-list"></div>
      </div>
    </div>`);

  $('v040Close').addEventListener('click', closeSchedule);
  $('v040Add').addEventListener('click', () => openForm());
  $('v040List').addEventListener('click', handleListAction);
  $('v040DeleteConfirm').addEventListener('click', handleDeleteConfirm);
  $('v040Form').addEventListener('submit', handleFormSubmit);
  $('v040Form').addEventListener('click', handleFormClick);
}

async function openSchedule() {
  renderList();
  $('v040ScheduleModal').classList.remove('hidden');
  $('v040ScheduleModal').setAttribute('aria-hidden','false');
  capability = await notificationCapability();
  renderNativeStatus();
  if (highlightId) {
    setTimeout(() => {
      document.querySelector(`[data-v040-game="${cssEscape(highlightId)}"]`)?.scrollIntoView({ behavior:'smooth', block:'center' });
      document.querySelector(`[data-v040-game="${cssEscape(highlightId)}"]`)?.classList.add('highlighted');
      highlightId = '';
    }, 80);
  }
}

function closeSchedule() {
  $('v040ScheduleModal')?.classList.add('hidden');
  $('v040ScheduleModal')?.setAttribute('aria-hidden','true');
  closeForm();
  closeDeleteConfirm();
}

function closeHome() {
  $('v031Home')?.classList.add('hidden');
  $('v031Home')?.setAttribute('aria-hidden','true');
}

function readGames() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SCHEDULE_STORAGE_KEY) || '[]');
    return sortScheduledGames(Array.isArray(parsed) ? parsed : []);
  } catch { return []; }
}

function writeGames(list) {
  localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(sortScheduledGames(list)));
  refreshHomeBadge();
}

function renderList() {
  const host = $('v040List');
  const games = readGames();
  if (!games.length) {
    host.innerHTML = `
      <div class="v040-empty">
        <div class="v040-empty-icon">🗓</div>
        <strong>No games scheduled yet</strong>
        <span>Add an upcoming game and choose when Scorer should remind you.</span>
        <button type="button" data-v040-action="add">Add first game</button>
      </div>`;
    return;
  }

  const now = Date.now();
  host.innerHTML = games.map(game => {
    const meta = sportMeta(game.sport);
    const date = new Date(game.startsAt);
    const when = Number.isNaN(date.getTime()) ? 'Date not set' : date.toLocaleString([], { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
    const reminders = (game.reminders || []).map(min => `<span>🔔 ${esc(reminderLabel(min))}</span>`).join('');
    const past = date.getTime() < now - 4 * 60 * 60 * 1000;
    return `
      <article class="v040-game ${past ? 'past' : ''}" data-v040-game="${attr(game.id)}">
        <div class="v040-game-icon">${meta.icon}</div>
        <div class="v040-game-main">
          <div class="v040-game-top"><span>${esc(meta.name)}</span><em>${esc(gameStatus(game, now))}</em></div>
          <strong>${esc(gameTitle(game))}</strong>
          <div class="v040-when">${esc(when)}${game.venue ? ` · ${esc(game.venue)}` : ''}</div>
          <div class="v040-reminder-chips">${reminders || '<span>No reminders</span>'}</div>
        </div>
        <div class="v040-game-actions">
          <button class="primary" type="button" data-v040-action="start" data-id="${attr(game.id)}">Start scoring</button>
          <button type="button" data-v040-action="share" data-id="${attr(game.id)}">Share</button>
          <button type="button" data-v040-action="edit" data-id="${attr(game.id)}">Edit</button>
          <button class="danger" type="button" data-v040-action="delete" data-id="${attr(game.id)}">Delete</button>
        </div>
      </article>`;
  }).join('');
}

function renderNativeStatus() {
  const host = $('v040NativeStatus');
  if (!host) return;
  if (nativePlatform()) {
    const permission = capability?.permission || 'checking';
    host.innerHTML = `<strong>📱 Android reminders</strong><span>${permission === 'granted' ? 'Ready — local game reminders can fire when Scorer is closed.' : permission === 'denied' ? 'Notifications are blocked. Saving a game still works; Android reminders need permission.' : 'Scorer will ask for notification permission when you save a reminder.'}</span>`;
    host.classList.add('native');
  } else {
    host.innerHTML = '<strong>🌐 Web / PWA</strong><span>Your schedule is saved locally here. Background device reminders become active in the Android Scorer app.</span>';
    host.classList.remove('native');
  }
}

function openForm(game = null) {
  editingId = game?.id || '';
  const meta = game || createScheduledGame({ startsAt: nextHourIso(), reminders: DEFAULT_REMINDER_MINUTES });
  const localValue = toLocalInput(meta.startsAt);
  $('v040Form').innerHTML = `
    <form class="v040-form">
      <div class="v040-form-head">
        <div><span>${editingId ? 'EDIT GAME' : 'NEW GAME'}</span><strong>${editingId ? 'Update scheduled game' : 'Schedule a game'}</strong></div>
        <button type="button" data-v040-form-action="close" aria-label="Close game form">✕</button>
      </div>
      <label>Sport<select id="v040Sport">${sportOptions(meta.sport)}</select></label>
      <div class="v040-team-fields">
        <label>Team / Player A<input id="v040TeamA" maxlength="40" value="${attr(meta.teamA || '')}" placeholder="Home or Team A"></label>
        <label>Team / Player B<input id="v040TeamB" maxlength="40" value="${attr(meta.teamB || '')}" placeholder="Away or Team B"></label>
      </div>
      <label>Date & time<input id="v040StartsAt" type="datetime-local" value="${attr(localValue)}" required></label>
      <label>Venue <span class="optional">optional</span><input id="v040Venue" maxlength="100" value="${attr(meta.venue || '')}" placeholder="School gym, Field 2…"></label>
      <fieldset>
        <legend>Remind me</legend>
        <div class="v040-reminders">
          ${DEFAULT_REMINDER_MINUTES.map(min => `<label><input type="checkbox" name="v040Reminder" value="${min}" ${(meta.reminders || []).includes(min) ? 'checked' : ''}><span>${esc(reminderLabel(min))}</span></label>`).join('')}
        </div>
      </fieldset>
      <div class="v040-form-note">${nativePlatform() ? 'Android will schedule these reminders locally on this phone.' : 'The schedule is saved now; device notifications will activate when this data is used in the Android app.'}</div>
      <div class="v040-form-actions">
        <button type="button" class="secondary-btn" data-v040-form-action="close">Cancel</button>
        <button type="submit" class="primary-btn">${editingId ? 'Save changes' : 'Schedule game'}</button>
      </div>
    </form>`;
  $('v040Form').classList.remove('hidden');
  $('v040Form').scrollIntoView({ behavior:'smooth', block:'start' });
}

function closeForm() {
  editingId = '';
  $('v040Form')?.classList.add('hidden');
  if ($('v040Form')) $('v040Form').innerHTML = '';
}

async function handleFormSubmit(event) {
  if (!event.target.closest('.v040-form')) return;
  event.preventDefault();
  const starts = $('v040StartsAt')?.value;
  if (!starts || Number.isNaN(new Date(starts).getTime())) return toast('Choose a valid game date and time');
  if (new Date(starts).getTime() < Date.now() - 5 * 60 * 1000) return toast('Choose a future game time');

  const existing = readGames().find(game => game.id === editingId);
  const reminders = [...document.querySelectorAll('input[name="v040Reminder"]:checked')].map(x => Number(x.value));
  const game = createScheduledGame({
    id: existing?.id,
    createdAt: existing?.createdAt,
    sport:$('v040Sport').value,
    teamA:$('v040TeamA').value,
    teamB:$('v040TeamB').value,
    startsAt:new Date(starts).toISOString(),
    venue:$('v040Venue').value,
    reminders
  });

  const next = readGames().filter(item => item.id !== game.id);
  next.push(game);
  writeGames(next);

  let reminderResult = { native:false, scheduled:0 };
  try { reminderResult = await syncGameReminders(game); }
  catch (error) { toast(`Game saved · reminder error: ${error?.message || 'try again'}`); }

  closeForm();
  renderList();
  capability = await notificationCapability();
  renderNativeStatus();

  if (reminderResult.native && reminderResult.permission === 'denied') toast('Game saved · Android notifications are blocked');
  else if (reminderResult.native) toast(`Game saved · ${reminderResult.scheduled} reminder${reminderResult.scheduled === 1 ? '' : 's'} scheduled`);
  else toast('Game saved locally');
}

function handleFormClick(event) {
  if (event.target.closest('[data-v040-form-action="close"]')) closeForm();
}

async function handleListAction(event) {
  const actionEl = event.target.closest('[data-v040-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.v040Action;
  if (action === 'add') return openForm();

  const id = actionEl.dataset.id;
  const game = readGames().find(item => item.id === id);
  if (!game) return;

  if (action === 'edit') return openForm(game);
  if (action === 'start') return startScheduledGame(game);
  if (action === 'share') {
    try {
      const result = await shareScheduledGame(game);
      if (!result.shared && result.text) {
        await navigator.clipboard?.writeText(result.text);
        toast('Game details copied');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') toast('Could not share this game');
    }
    return;
  }
  if (action === 'delete') {
    pendingDeleteId = id;
    const host = $('v040DeleteConfirm');
    host.innerHTML = `
      <div><strong>Delete ${esc(gameTitle(game))}?</strong><span>This removes the scheduled game and cancels its local reminders on this device.</span></div>
      <div><button type="button" data-v040-delete-action="cancel">Cancel</button><button class="danger" type="button" data-v040-delete-action="confirm">Delete game</button></div>`;
    host.classList.remove('hidden');
    host.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }
}

async function handleDeleteConfirm(event) {
  const action = event.target.closest('[data-v040-delete-action]')?.dataset.v040DeleteAction;
  if (!action) return;
  if (action === 'cancel') return closeDeleteConfirm();
  if (action !== 'confirm' || !pendingDeleteId) return;
  const game = readGames().find(item => item.id === pendingDeleteId);
  if (game) {
    try { await cancelGameReminders(game); } catch {}
    writeGames(readGames().filter(item => item.id !== pendingDeleteId));
  }
  closeDeleteConfirm();
  renderList();
  toast('Scheduled game deleted');
}

function closeDeleteConfirm() {
  pendingDeleteId = '';
  const host = $('v040DeleteConfirm');
  if (!host) return;
  host.classList.add('hidden');
  host.innerHTML = '';
}

function startScheduledGame(game) {
  closeSchedule();
  closeHome();
  document.dispatchEvent(new CustomEvent('scorer:prepare-scheduled-game', {
    detail:{ sport:game.sport, teamA:game.teamA, teamB:game.teamB, scheduleId:game.id }
  }));
}

function refreshHomeBadge() {
  const count = upcomingGames(readGames()).length;
  const badge = $('v040HomeCount');
  if (!badge) return;
  badge.textContent = count ? String(count) : '';
  badge.classList.toggle('hidden', !count);
}

function sportOptions(selected) {
  return ['volleyball','basketball','soccer','football','cricket','tennis','badminton','lacrosse','kabaddi','baseball']
    .map(id => {
      const meta = sportMeta(id);
      return `<option value="${id}" ${id === selected ? 'selected' : ''}>${meta.icon} ${esc(meta.name)}</option>`;
    }).join('');
}

function nextHourIso() {
  const d = new Date();
  d.setSeconds(0,0);
  d.setMinutes(0);
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}

function toLocalInput(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0,16);
}

function toast(message) {
  const host = $('toast');
  if (!host) return;
  host.textContent = message;
  host.classList.add('show');
  setTimeout(() => host.classList.remove('show'), 2400);
}

function esc(value) { return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function attr(value) { return esc(value).replace(/`/g,'&#96;'); }
function cssEscape(value) { return window.CSS?.escape ? CSS.escape(value) : String(value).replace(/["\\]/g,'\\$&'); }
