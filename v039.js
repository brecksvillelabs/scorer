import { QUICK_START_STEPS, sportRoleCopy, quickFormatPresets, presetMatchesValues } from './v039-core.js';

const $ = id => document.getElementById(id);
const setup = $('setupModal');
const sportGrid = $('sportGrid');
const teamGrid = document.querySelector('.team-setup-grid');
const sportSettings = $('sportSettings');
const startBtn = $('startGameBtn');
const resetBtn = $('resetSavedBtn');
const setupTitle = $('setupTitle');
const modal = setup?.querySelector('.setup-modal');

let currentStep = 'sport';
let editingMode = false;
let wasOpen = false;
let formatSyncScheduled = false;

boot039();

function boot039() {
  if (!setup || !sportGrid || !teamGrid || !sportSettings || !startBtn || !modal) return;
  markStepSections();
  installWizardChrome();
  enhanceTeamCards();
  ensureFormatHero();
  bindWizard();
  observeSetup();
  if (!setup.classList.contains('hidden')) onSetupOpened();
}

function markStepSections() {
  sportGrid.closest('.setup-section')?.classList.add('v039-step-section', 'v039-step-sport');
  teamGrid.closest('.setup-section')?.classList.add('v039-step-section', 'v039-step-teams');
  sportSettings.classList.add('v039-step-section', 'v039-step-format');
}

function installWizardChrome() {
  if ($('v039Progress')) return;
  const header = setup.querySelector('.modal-header');
  header?.insertAdjacentHTML('afterend', `
    <div class="v039-wizard-head">
      <div id="v039Progress" class="v039-progress" aria-label="Game setup progress">
        <div data-v039-progress="sport"><span>1</span><b>Sport</b></div>
        <i></i>
        <div data-v039-progress="teams"><span>2</span><b>Teams</b></div>
        <i></i>
        <div data-v039-progress="format"><span>3</span><b>Format</b></div>
      </div>
      <p id="v039StepHint"></p>
    </div>`);

  const footer = setup.querySelector('.modal-footer');
  if (!footer) return;
  const back = document.createElement('button');
  back.id = 'v039BackBtn';
  back.className = 'secondary-btn v039-back';
  back.type = 'button';
  back.textContent = '← Back';

  const next = document.createElement('button');
  next.id = 'v039NextBtn';
  next.className = 'primary-btn v039-next';
  next.type = 'button';
  next.textContent = 'Continue →';

  footer.prepend(back);
  footer.insertBefore(next, startBtn);
  resetBtn?.classList.add('v039-reset');
}

function bindWizard() {
  $('v039BackBtn')?.addEventListener('click', () => {
    if (currentStep === 'format') setStep('teams');
    else if (currentStep === 'teams') setStep('sport');
  });

  $('v039NextBtn')?.addEventListener('click', () => {
    if (currentStep === 'teams') {
      normalizeQuickNames();
      setStep('format');
    }
  });

  sportGrid.addEventListener('click', event => {
    const choice = event.target.closest('.sport-choice');
    if (!choice) return;
    setTimeout(() => {
      enhanceTeamCards();
      ensureFormatHero(true);
      setStep('teams');
    }, 0);
  });

  resetBtn?.addEventListener('click', () => {
    setTimeout(() => {
      editingMode = false;
      ensureFormatHero(true);
      setStep('sport');
    }, 0);
  });

  startBtn.addEventListener('click', () => {
    // app.js owns validation/state creation. This layer only changes the setup flow.
    setTimeout(() => {
      if (setup.classList.contains('hidden')) currentStep = 'sport';
    }, 0);
  });

  const settingsObserver = new MutationObserver(() => scheduleFormatSync());
  settingsObserver.observe(sportSettings, { childList: true });

  $('inputNameA')?.addEventListener('input', syncSecondaryLabels);
  $('inputNameB')?.addEventListener('input', syncSecondaryLabels);
  document.addEventListener('scorer:scheduled-game-ready', () => {
    editingMode = false;
    enhanceTeamCards();
    ensureFormatHero(true);
    setTimeout(() => setStep('format'), 0);
  });
}

function observeSetup() {
  const observer = new MutationObserver(() => {
    const open = !setup.classList.contains('hidden') && setup.getAttribute('aria-hidden') !== 'true';
    if (open && !wasOpen) onSetupOpened();
    wasOpen = open;
  });
  observer.observe(setup, { attributes: true, attributeFilter: ['class', 'aria-hidden'] });
  wasOpen = !setup.classList.contains('hidden') && setup.getAttribute('aria-hidden') !== 'true';
}

function onSetupOpened() {
  editingMode = startBtn.textContent.trim() === 'Apply changes';
  markStepSections();
  enhanceTeamCards();
  ensureFormatHero(true);
  setStep(editingMode ? 'teams' : 'sport');
}

function setStep(step) {
  if (!QUICK_START_STEPS.includes(step)) step = 'sport';
  currentStep = step;
  setup.dataset.v039Step = step;
  markStepSections();

  document.querySelector('.v039-step-sport')?.classList.toggle('hidden', step !== 'sport');
  document.querySelector('.v039-step-teams')?.classList.toggle('hidden', step !== 'teams');
  document.querySelector('.v039-step-format')?.classList.toggle('hidden', step !== 'format');

  const index = QUICK_START_STEPS.indexOf(step);
  document.querySelectorAll('[data-v039-progress]').forEach(node => {
    const nodeIndex = QUICK_START_STEPS.indexOf(node.dataset.v039Progress);
    node.classList.toggle('active', nodeIndex === index);
    node.classList.toggle('done', nodeIndex < index);
  });

  const back = $('v039BackBtn');
  const next = $('v039NextBtn');
  if (back) back.classList.toggle('hidden', step === 'sport');
  if (next) next.classList.toggle('hidden', step !== 'teams');
  startBtn.classList.toggle('hidden', step !== 'format');
  resetBtn?.classList.add('hidden');

  const sport = currentSport();
  const sportName = currentSportName();
  const hint = $('v039StepHint');

  if (step === 'sport') {
    setupTitle.textContent = 'Choose your sport';
    if (hint) hint.textContent = 'Tap the game you are scoring. Scorer will only ask for what matters next.';
  } else if (step === 'teams') {
    setupTitle.textContent = sportRoleCopy(sport).title;
    if (hint) hint.textContent = `${sportName} · Names first. Saved teams are one tap away; logos, colors and rosters are optional.`;
    updateTeamCopy();
  } else {
    setupTitle.textContent = `${sportName} format`;
    if (hint) hint.textContent = 'Pick the format you are playing. Open Advanced match options only if your league needs something different.';
    ensureFormatHero();
    syncPresetSelection();
    syncSecondaryControls();
  }

  if (!editingMode && step === 'format') startBtn.textContent = 'Start game';
  if (editingMode) startBtn.textContent = 'Apply changes';
  modal.scrollTo({ top: 0, behavior: 'smooth' });
}

function normalizeQuickNames() {
  const a = $('inputNameA');
  const b = $('inputNameB');
  if (a && !a.value.trim()) a.value = 'Home';
  if (b && !b.value.trim()) b.value = 'Away';
}

function enhanceTeamCards() {
  updateTeamCopy();
  document.querySelectorAll('.team-setup-card').forEach((card, index) => {
    if (card.querySelector('.v039-team-more')) return;
    const side = index === 0 ? 'A' : 'B';
    const name = $(
      side === 'A' ? 'inputNameA' : 'inputNameB'
    )?.closest('label');
    const title = card.querySelector('.team-setup-title');
    const favorite = card.querySelector('.favorite-row');
    if (!name || !title) return;

    const details = document.createElement('details');
    details.className = 'v039-team-more';
    details.innerHTML = '<summary>Customize team <span>logo · color · roster</span></summary><div class="v039-team-more-body"></div>';
    const body = details.querySelector('.v039-team-more-body');
    const advanced = [...card.children].filter(child =>
      child !== title && child !== favorite && child !== name && child !== details
    );
    advanced.forEach(child => body.appendChild(child));

    if (favorite) {
      favorite.classList.add('v039-favorite-picker');
      const favoriteActions = document.createElement('div');
      favoriteActions.className = 'v039-favorite-actions';
      [...favorite.querySelectorAll('button')].forEach(button => favoriteActions.appendChild(button));
      if (favoriteActions.children.length) body.prepend(favoriteActions);
    }

    card.appendChild(details);
  });
}

function updateTeamCopy() {
  const copy = sportRoleCopy(currentSport());
  const titles = document.querySelectorAll('.team-setup-title');
  setTitleText(titles[0], copy.sideA);
  setTitleText(titles[1], copy.sideB);
  setLabelText($('inputNameA')?.closest('label'), copy.nameA);
  setLabelText($('inputNameB')?.closest('label'), copy.nameB);
}

function setTitleText(node, text) {
  if (!node) return;
  const textNode = [...node.childNodes].find(child => child.nodeType === Node.TEXT_NODE);
  if (textNode) textNode.textContent = text;
  else node.append(document.createTextNode(text));
}

function setLabelText(label, text) {
  if (!label) return;
  const textNode = [...label.childNodes].find(child => child.nodeType === Node.TEXT_NODE);
  if (textNode) textNode.textContent = text;
}

function scheduleFormatSync() {
  if (formatSyncScheduled) return;
  formatSyncScheduled = true;
  requestAnimationFrame(() => {
    formatSyncScheduled = false;
    ensureFormatHero();
    if (currentStep === 'format') {
      syncPresetSelection();
      syncSecondaryControls();
    }
  });
}

function ensureFormatHero(force = false) {
  if (!sportSettings) return;
  if (!force && $('v039FormatHero')) return;
  if (force && $('v039FormatHero')) return; // app-rendered settings have not changed.

  const existing = [...sportSettings.children];
  if (!existing.length) return;

  const hero = document.createElement('div');
  hero.id = 'v039FormatHero';
  hero.className = 'v039-format-hero';
  sportSettings.prepend(hero);

  const details = document.createElement('details');
  details.className = 'v039-format-more';
  details.innerHTML = '<summary>Advanced match options <span>Change timing, limits or special rules</span></summary><div class="v039-format-more-body"></div>';
  const body = details.querySelector('.v039-format-more-body');
  existing.forEach(child => body.appendChild(child));
  sportSettings.appendChild(details);

  renderFormatHero();
}

function renderFormatHero() {
  const hero = $('v039FormatHero');
  if (!hero) return;
  const sport = currentSport();
  const presets = quickFormatPresets(sport);
  const buttons = presets.map(preset => `
    <button type="button" class="v039-format-card" data-v039-preset="${escapeAttr(preset.id)}">
      <strong>${escapeHtml(preset.label)}</strong>
      <span>${escapeHtml(preset.note || '')}</span>
    </button>`).join('');

  hero.innerHTML = `
    <div class="v039-format-question">${formatQuestion(sport)}</div>
    <div class="v039-format-grid">${buttons}</div>
    <div id="v039SecondaryQuick" class="v039-secondary-quick"></div>`;

  hero.addEventListener('click', handleFormatHeroClick);
  renderSecondaryQuick();
  syncPresetSelection();
}

function formatQuestion(sport) {
  if (sport === 'baseball') return 'How many innings?';
  if (sport === 'volleyball') return 'How many sets can decide the match?';
  if (sport === 'cricket') return 'What are you playing?';
  if (sport === 'lacrosse') return 'Which lacrosse format?';
  if (sport === 'kabaddi') return 'Match format';
  if (sport === 'tennis' || sport === 'badminton') return 'Match format';
  return 'How long are the periods?';
}

function handleFormatHeroClick(event) {
  const presetButton = event.target.closest('[data-v039-preset]');
  if (presetButton) {
    const preset = quickFormatPresets(currentSport()).find(item => item.id === presetButton.dataset.v039Preset);
    if (!preset) return;
    applyPreset(preset);
    if (preset.id === 'custom') document.querySelector('.v039-format-more')?.setAttribute('open', '');
    return;
  }

  const sideButton = event.target.closest('[data-v039-side-target]');
  if (sideButton) {
    const target = $(sideButton.dataset.v039SideTarget);
    if (!target) return;
    target.value = sideButton.dataset.side;
    target.dispatchEvent(new Event('change', { bubbles: true }));
    syncSecondaryControls();
  }
}

function applyPreset(preset) {
  for (const [id, value] of Object.entries(preset.values || {})) {
    const control = $(id);
    if (!control) continue;
    control.value = String(value);
    control.dispatchEvent(new Event('change', { bubbles: true }));
  }
  // Some existing change handlers populate dependent fields. Reapply the
  // preset values once so the quick card is the final source of truth.
  for (const [id, value] of Object.entries(preset.values || {})) {
    const control = $(id);
    if (control) control.value = String(value);
  }
  syncPresetSelection();
}

function settingValues() {
  const values = {};
  for (const preset of quickFormatPresets(currentSport())) {
    for (const id of Object.keys(preset.values || {})) values[id] = $(id)?.value ?? '';
  }
  return values;
}

function syncPresetSelection() {
  const values = settingValues();
  const presets = quickFormatPresets(currentSport());
  document.querySelectorAll('[data-v039-preset]').forEach(button => {
    const preset = presets.find(item => item.id === button.dataset.v039Preset);
    button.classList.toggle('selected', Boolean(preset && presetMatchesValues(preset, values)));
    button.setAttribute('aria-pressed', preset && presetMatchesValues(preset, values) ? 'true' : 'false');
  });
}

function renderSecondaryQuick() {
  const host = $('v039SecondaryQuick');
  if (!host) return;
  const sport = currentSport();
  let target = '';
  let title = '';
  if (sport === 'baseball') { target = 'settingBaseballFirstBat'; title = 'Who bats first?'; }
  if (sport === 'cricket') { target = 'settingBatting'; title = 'Who bats first?'; }
  if (sport === 'kabaddi') { target = 'settingKabaddiFirstRaid'; title = 'Who has the first raid?'; }
  if (!target) { host.innerHTML = ''; return; }

  host.innerHTML = `
    <div class="v039-secondary-label">${title}</div>
    <div class="v039-side-choice">
      <button type="button" data-v039-side-target="${target}" data-side="A"></button>
      <button type="button" data-v039-side-target="${target}" data-side="B"></button>
    </div>`;
  syncSecondaryControls();
}

function syncSecondaryLabels() {
  if (currentStep === 'format') syncSecondaryControls();
}

function syncSecondaryControls() {
  const host = $('v039SecondaryQuick');
  if (!host) return;
  const buttons = host.querySelectorAll('[data-v039-side-target]');
  buttons.forEach(button => {
    const target = $(button.dataset.v039SideTarget);
    const side = button.dataset.side;
    const teamName = $(side === 'A' ? 'inputNameA' : 'inputNameB')?.value.trim() || `Side ${side}`;
    button.textContent = teamName;
    const selected = target?.value === side;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
}

function currentSport() {
  return document.querySelector('.sport-choice.active')?.dataset.sport || 'volleyball';
}

function currentSportName() {
  const active = document.querySelector('.sport-choice.active');
  return active?.querySelector('strong')?.textContent?.trim() || 'Game';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function escapeAttr(value) { return escapeHtml(value).replace(/\`/g, '&#96;'); }
