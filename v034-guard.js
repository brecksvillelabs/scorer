const STORAGE_KEY = 'scorer-state-v2';

function readState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}

function guardNativeBowlerSelect() {
  const state = readState();
  const select = document.querySelector('select[data-role="bowler"]');
  if (!select) return;
  [...select.options].forEach(option => {
    option.disabled = Boolean(state?.sport === 'cricket' && state.cricket?.needsBowler && option.value === state.cricket.bowler);
  });
}

let scheduled = false;
const observer = new MutationObserver(() => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    guardNativeBowlerSelect();
  });
});
observer.observe(document.body, { childList: true, subtree: true });
guardNativeBowlerSelect();

document.addEventListener('change', event => {
  const select = event.target.closest?.('select[data-role="bowler"]');
  if (!select) return;
  const state = readState();
  if (state?.sport !== 'cricket' || !state.cricket?.needsBowler) return;
  if (select.value !== state.cricket.bowler) return;

  // Capture phase runs before app.js's delegated change handler, preventing a
  // same-bowler selection from clearing the over-complete pause.
  event.preventDefault();
  event.stopImmediatePropagation();
  document.querySelector('.v034-open-bowler')?.click();
}, true);
