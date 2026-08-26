export function mergeDiaryItems(photos = [], notes = [], photoHighlights = {}) {
  const photoItems = (Array.isArray(photos) ? photos : []).map(photo => ({
    ...photo,
    kind: 'photo',
    highlighted: Boolean(photoHighlights?.[photo.id]?.highlighted)
  }));
  const noteItems = (Array.isArray(notes) ? notes : []).map(note => ({ ...note, kind: 'note', highlighted: Boolean(note.highlighted) }));
  return [...photoItems, ...noteItems].sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
}

export function diaryContextText(context = {}) {
  return [context.period, context.detail].filter(Boolean).join(' · ');
}

export function diaryMomentSummary(items = []) {
  const list = Array.isArray(items) ? items : [];
  return {
    total: list.length,
    photos: list.filter(item => item.kind === 'photo').length,
    notes: list.filter(item => item.kind === 'note').length,
    highlights: list.filter(item => item.highlighted).length
  };
}
