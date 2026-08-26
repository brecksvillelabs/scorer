import { SPORT_RULE_PROFILES, normalizeSportFoundationState } from './sports.js';

const STORAGE_KEY = 'scorer-state-v2';
const SESSION_REPAIRED = 'scorer-v033-repaired';
const $ = (id) => document.getElementById(id);

boot033();

function readState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}

function sameState(a, b) {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

function boot033() {
  repairSavedFoundationState();
  injectStyles();
  decorate();
  const observer = new MutationObserver(() => requestAnimationFrame(decorate));
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', event => {
    if (event.target.closest('.sport-choice')) setTimeout(decorateRuleNote, 0);
  });
}

function repairSavedFoundationState() {
  const current = readState();
  if (!current) return;
  const normalized = normalizeSportFoundationState(current);
  if (sameState(current, normalized)) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));

  // app.js has already loaded its module-scoped state by the time this module runs.
  // Reload once so repaired cricket identities are also reflected in the live UI.
  if (!sessionStorage.getItem(SESSION_REPAIRED)) {
    sessionStorage.setItem(SESSION_REPAIRED, '1');
    location.reload();
  }
}

function decorate() {
  decorateCricketControls();
  decorateRuleNote();
}

function decorateCricketControls() {
  const state = readState();
  if (state?.sport !== 'cricket') return;
  const pad = document.querySelector('.cricket-pad');
  if (!pad) return;

  const strikerRunOut = pad.querySelector('[data-action="cricket"][data-value="runOut"]');
  if (strikerRunOut) {
    strikerRunOut.textContent = 'Run out ★';
    strikerRunOut.title = 'Dismiss the striker';
  }

  if (strikerRunOut && !pad.querySelector('[data-value="runOut:nonStriker"]')) {
    const button = strikerRunOut.cloneNode(true);
    button.dataset.value = 'runOut:nonStriker';
    button.textContent = 'Run out non-striker';
    button.title = 'Dismiss the non-striker';
    button.classList.add('v033-nonstriker-runout');
    strikerRunOut.insertAdjacentElement('afterend', button);
  }

  const lock = Boolean(state.cricket?.needsBowler);
  pad.querySelectorAll('[data-action="cricket"]').forEach(button => {
    button.disabled = lock;
    button.setAttribute('aria-disabled', lock ? 'true' : 'false');
  });
  pad.classList.toggle('v033-pad-locked', lock);
}

function decorateRuleNote() {
  const host = $('sportSettings');
  if (!host) return;
  const sport = document.querySelector('.sport-choice.active')?.dataset.sport;
  const profile = SPORT_RULE_PROFILES[sport];
  if (!profile) return;

  let note = $('v033RuleNote');
  if (!note) {
    note = document.createElement('div');
    note.id = 'v033RuleNote';
    note.className = 'v033-rule-note';
    host.appendChild(note);
  }
  note.innerHTML = `<span>Rules foundation</span><strong>${escapeHtml(profile.baseline)}</strong><small>Quick scoring stays simple; the underlying match model now preserves richer sport events for Connected Scorer.</small>`;
}

function injectStyles() {
  if ($('v033Styles')) return;
  const style = document.createElement('style');
  style.id = 'v033Styles';
  style.textContent = `
    .v033-rule-note{grid-column:1/-1;margin-top:8px;padding:12px 14px;border:1px solid rgba(45,212,191,.18);border-radius:16px;background:rgba(13,148,136,.08);display:grid;gap:3px}
    .v033-rule-note span{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#5eead4;font-weight:900}
    .v033-rule-note strong{font-size:13px;color:#e2e8f0}
    .v033-rule-note small{color:#94a3b8;line-height:1.4}
    .v033-nonstriker-runout{font-size:.82rem}
    .v033-pad-locked{opacity:.58}
    .v033-pad-locked::after{content:'Select the next bowler to continue';display:block;grid-column:1/-1;text-align:center;color:#fbbf24;font-size:12px;font-weight:800;padding:6px}
  `;
  document.head.appendChild(style);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
