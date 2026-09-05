import './cricket-gold.js';

export const THEME_KEY = 'scorer-theme-v1';
export const THEME_OPTIONS = Object.freeze(['system', 'light', 'dark']);

export function normalizeTheme(value, fallback = 'dark') {
  return THEME_OPTIONS.includes(value) ? value : fallback;
}

export function resolveTheme(preference, prefersDark = false) {
  const normalized = normalizeTheme(preference);
  return normalized === 'system' ? (prefersDark ? 'dark' : 'light') : normalized;
}

function readPreference() {
  try { return normalizeTheme(localStorage.getItem(THEME_KEY)); }
  catch { return 'dark'; }
}

function writePreference(value) {
  try { localStorage.setItem(THEME_KEY, value); } catch {}
}

function systemPrefersDark() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

function optionLabel(preference) {
  return preference === 'system' ? 'System default' : preference === 'light' ? 'Light appearance' : 'Dark appearance';
}

export function applyTheme(preference, { persist = true } = {}) {
  const normalized = normalizeTheme(preference);
  const resolved = resolveTheme(normalized, systemPrefersDark());
  if (typeof document === 'undefined') return { preference: normalized, resolved };

  document.documentElement.dataset.themePreference = normalized;
  document.documentElement.dataset.theme = resolved;
  if (persist) writePreference(normalized);

  const themeColor = document.querySelector('meta[name="theme-color"]');
  themeColor?.setAttribute('content', resolved === 'light' ? '#f1f6fa' : '#07111f');

  document.querySelectorAll('[data-theme-choice]').forEach(button => {
    const selected = button.dataset.themeChoice === normalized;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });

  const current = document.getElementById('appearanceCurrent');
  if (current) current.textContent = optionLabel(normalized);

  const summary = document.querySelector('#appearanceMenu summary');
  if (summary) {
    const glyph = summary.querySelector('.appearance-glyph');
    if (glyph) glyph.textContent = normalized === 'light' ? '☀' : normalized === 'dark' ? '☾' : '◐';
    summary.setAttribute('aria-label', `Appearance: ${optionLabel(normalized)}`);
    summary.setAttribute('title', `Appearance: ${optionLabel(normalized)}`);
  }

  document.dispatchEvent(new CustomEvent('scorer:theme-changed', {
    detail: { preference: normalized, resolved }
  }));
  return { preference: normalized, resolved };
}

function bootTheme() {
  applyTheme(readPreference(), { persist: false });

  document.addEventListener('click', event => {
    const choice = event.target.closest?.('[data-theme-choice]');
    if (choice) {
      applyTheme(choice.dataset.themeChoice);
      document.getElementById('appearanceMenu')?.removeAttribute('open');
      return;
    }

    const menu = document.getElementById('appearanceMenu');
    if (menu?.open && !menu.contains(event.target)) menu.removeAttribute('open');
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') document.getElementById('appearanceMenu')?.removeAttribute('open');
  });

  const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
  const followSystem = () => {
    if (readPreference() === 'system') applyTheme('system', { persist: false });
  };
  media?.addEventListener?.('change', followSystem);
  media?.addListener?.(followSystem);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootTheme, { once: true });
  else bootTheme();
}
