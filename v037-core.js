function clone(value) { return JSON.parse(JSON.stringify(value)); }

function timeoutBucket(state) {
  if (!state?.sport) return null;
  return state?.[state.sport]?.timeouts || null;
}

export function timeoutLimit(state) {
  switch (state?.sport) {
    case 'volleyball': return 2;
    case 'basketball': return 5;
    case 'football': return 3;
    case 'lacrosse': return Math.max(0, Number(state?.lacrosse?.timeoutsPerHalf ?? (state?.lacrosse?.discipline === 'sixes' ? 1 : 2)));
    case 'kabaddi': return Math.max(0, Number(state?.kabaddi?.timeoutsPerHalf ?? 2));
    default: return 0;
  }
}

export function timeoutStatus(state) {
  const bucket = timeoutBucket(state);
  const limit = timeoutLimit(state);
  return {
    limit,
    A: bucket ? Math.max(0, Number(bucket.A || 0)) : 0,
    B: bucket ? Math.max(0, Number(bucket.B || 0)) : 0
  };
}

function appendEvent(next, type, details = {}) {
  if (!Array.isArray(next.events)) next.events = [];
  next.eventSeq = Number(next.eventSeq || 0) + 1;
  next.events.push({
    id: `${next.matchId || 'match'}-e${next.eventSeq}`,
    seq: next.eventSeq,
    type,
    sport: next.sport,
    period: next.period,
    at: Date.now(),
    ...details
  });
  if (next.events.length > 5000) next.events = next.events.slice(-5000);
}

export function changeTimeout(state, side, delta) {
  const next = clone(state);
  if (!['A','B'].includes(side)) return next;
  const bucket = timeoutBucket(next);
  const limit = timeoutLimit(next);
  if (!bucket || limit <= 0) return next;

  const before = Math.max(0, Number(bucket[side] || 0));
  const after = Math.min(limit, Math.max(0, before + Number(delta || 0)));
  bucket[side] = after;

  if (after !== before) {
    appendEvent(next, after > before ? 'timeout.restored' : 'timeout.taken', {
      side,
      remaining: after,
      limit
    });
    next.updatedAt = Date.now();
  }
  return next;
}
