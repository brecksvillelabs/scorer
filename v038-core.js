const TWO_MINUTES = 2 * 60 * 1000;
const FIFTEEN_MINUTES = 15 * 60 * 1000;

export function recoveryBounds(summary = {}, now = Date.now()) {
  const startedAt = Number(summary.startedAt || 0);
  const updatedAt = Number(summary.updatedAt || now);
  return {
    start: Math.max(0, startedAt - TWO_MINUTES),
    end: Boolean(summary.finished) ? updatedAt + FIFTEEN_MINUTES : now + FIFTEEN_MINUTES
  };
}

export function isRecoverablePhoto(photo, summary, now = Date.now()) {
  if (!photo || !summary?.matchId || photo.matchId === summary.matchId) return false;
  const context = photo.context || {};

  // Newer captures carry a second copy of the canonical match id.
  if (context.matchId) return context.matchId === summary.matchId;

  // v0.3.7 and earlier photos did not carry context.matchId. Recover only
  // same-sport, same-title photos captured inside this game's time window.
  if (context.sport !== summary.sport || context.title !== summary.title) return false;
  const createdAt = Number(photo.createdAt || context.timestamp || 0);
  const bounds = recoveryBounds(summary, now);
  return createdAt >= bounds.start && createdAt <= bounds.end;
}
