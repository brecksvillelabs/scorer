const STORAGE_KEY = 'scorer-state-v2';

boot();

function readState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}

function boot() {
  decorate();
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      decorate();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function decorate() {
  const state = readState();
  if (state?.sport !== 'kabaddi' || !state.kabaddi) return;
  const board = document.querySelector('.v035-kabaddi-board');
  if (!board) return;

  // All Out belongs to whichever team puts the opponent fully out, not
  // inherently to the current raider. Replace the earlier raid-only control
  // with a team-specific +2 action on both score cards.
  board.querySelector('[data-action="kabaddi"][data-value="allOut"]')?.remove();

  const cards = [...board.querySelectorAll('.v035-kabaddi-team')];
  cards.forEach((card, index) => {
    const side = index === 0 ? 'A' : 'B';
    const sub = card.querySelector('.team-sub');
    const status = state.kabaddi.raidingTeam === side ? 'RAIDING' : 'DEFENDING';
    const text = `${status} · ${state.kabaddi.timeouts?.[side] ?? 0} TO`;
    if (sub && sub.textContent !== text) sub.textContent = text;

    if (!card.querySelector(`[data-side="${side}-allOut"]`)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mini-btn v035-allout-btn';
      button.dataset.action = 'kabaddi-technical';
      button.dataset.side = `${side}-allOut`;
      button.textContent = 'All Out +2';
      card.appendChild(button);
    }
  });
}
