export function setsNeeded(bestOf) {
  const n = Math.max(1, Number(bestOf || 1));
  return Math.ceil(n / 2);
}

export function volleyballWinnerFromState(state) {
  if (!state || state.sport !== 'volleyball') return null;
  const needed = setsNeeded(state.volleyball?.bestOf || 3);
  const a = Number(state.teamA?.sets || 0);
  const b = Number(state.teamB?.sets || 0);
  if (a >= needed && a > b) return 'A';
  if (b >= needed && b > a) return 'B';
  return null;
}

export function reconcileCompletedState(state) {
  if (!state || typeof state !== 'object') return state;
  const next = structuredCloneSafe(state);
  if (next.sport === 'volleyball') {
    const winner = volleyballWinnerFromState(next);
    if (winner && !next.finished) {
      next.finished = true;
      next.winner = winner;
      if (next.volleyball) next.volleyball.matchWinner = winner;
      next.clock && (next.clock.running = false);
      next.updatedAt = Date.now();
    }
  }
  return next;
}

export function manuallyFinishState(state, { winner = 'tie', reason = 'Final' } = {}) {
  if (!state || typeof state !== 'object') return state;
  const next = structuredCloneSafe(state);
  next.finished = true;
  next.winner = ['A', 'B', 'tie'].includes(winner) ? winner : 'tie';
  if (next.clock) next.clock.running = false;
  next.manualEnd = {
    reason: String(reason || 'Final'),
    noWinner: winner === 'none',
    endedAt: Date.now()
  };
  if (next.sport === 'volleyball' && next.volleyball) next.volleyball.matchWinner = next.winner === 'tie' ? null : next.winner;
  if (next.sport === 'tennis' && next.tennis) next.tennis.matchWinner = next.winner === 'tie' ? null : next.winner;
  if (next.sport === 'badminton' && next.badminton) next.badminton.matchWinner = next.winner === 'tie' ? null : next.winner;
  if (next.sport === 'cricket' && next.cricket) next.cricket.matchWinner = next.winner;
  next.updatedAt = Date.now();
  return next;
}

export function finalLabel(state) {
  if (!state?.finished) return '';
  if (state.manualEnd?.noWinner) return `Match ended · ${state.manualEnd.reason}`;
  if (state.winner === 'tie') return state.manualEnd?.reason && state.manualEnd.reason !== 'Final' ? `Match ended · ${state.manualEnd.reason}` : 'Match tied';
  const team = state.winner === 'B' ? state.teamB : state.teamA;
  return `${team?.name || 'Winner'} wins`;
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
