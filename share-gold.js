import { formatShareGoldMessage, scoreShareGoldTitle } from './share-gold-core.js';
import { shareContent } from './native-bridge.js';

const STATE_KEY = 'scorer-state-v2';
let installed = false;

function $(id) { return document.getElementById(id); }
function readState() {
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || 'null'); }
  catch { return null; }
}
function notify(message) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}
async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand?.('copy');
  area.remove();
}
async function shareState(state) {
  const text = formatShareGoldMessage(state);
  try {
    const result = await shareContent({ title:scoreShareGoldTitle(state), text, dialogTitle:'Share score update' });
    if (!result?.shared) {
      await copyText(text);
      notify('Score update copied — paste it into WhatsApp or Messages');
    }
  } catch (error) {
    if (error?.name !== 'AbortError') notify('Could not open sharing');
  }
}
async function copyState(state) {
  try {
    await copyText(formatShareGoldMessage(state));
    notify('Score update copied');
  } catch {
    notify('Could not copy the score update');
  }
}

export function installShareGold() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  document.addEventListener('click', event => {
    const button = event.target.closest?.('#shareScoreBtn,#shareScoreSheetBtn,#copyScoreBtn');
    if (!button) return;
    const state = readState();
    // Cricket Gold already owns these buttons and uses its richer cricket-specific
    // share path. The same cricket message contract is reused by share-gold-core.
    if (!state?.sport || state.sport === 'cricket') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button.id === 'copyScoreBtn') copyState(state);
    else shareState(state);
  }, true);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'complete') installShareGold();
  else window.addEventListener('load', installShareGold, { once:true });
}
