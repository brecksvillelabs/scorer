export function removeHistoryEntry(history, matchId) {
  return (Array.isArray(history) ? history : []).filter(item => item?.matchId !== matchId);
}

export function sortHistory(history) {
  return (Array.isArray(history) ? history.slice() : []).sort((a, b) => Number(b?.updatedAt || b?.archivedAt || 0) - Number(a?.updatedAt || a?.archivedAt || 0));
}

export function gameLogLabel(item) {
  const title = String(item?.title || 'Match');
  const score = String(item?.score || '');
  return score ? `${title} · ${score}` : title;
}
