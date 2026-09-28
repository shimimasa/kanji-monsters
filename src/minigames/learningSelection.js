const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
export function reviewIds(history = {}, limit = 10) {
  return Object.entries(history).filter(([, value]) => value?.lastCorrect === false)
    .sort((a, b) => count(b[1].lastAnsweredAt) - count(a[1].lastAnsweredAt) || a[0].localeCompare(b[0]))
    .slice(0, limit).map(([id]) => id);
}

export function selectLearningEntries(shuffled, history, requestedReviewIds, getId = entry => entry.id) {
  if (requestedReviewIds?.length) {
    const ids = new Set(requestedReviewIds);
    const selected = shuffled.filter(entry => ids.has(getId(entry))).slice(0, 10);
    if (selected.length) return selected;
  }
  // Other courses and retired content must not consume the three review slots.
  history = Object.fromEntries(shuffled.filter(entry => history?.[getId(entry)])
    .map(entry => [getId(entry), history[getId(entry)]]));
  if (!Object.keys(history).length) return shuffled.slice(0, 10);
  const wanted = new Set(reviewIds(history, 3));
  const review = shuffled.filter(entry => wanted.has(getId(entry)));
  const rest = shuffled.filter(entry => !wanted.has(getId(entry)) && history[getId(entry)]?.lastCorrect !== false);
  const unseen = rest.filter(entry => !history[getId(entry)]);
  const seen = rest.filter(entry => history[getId(entry)]);
  seen.sort((a, b) => count(history[getId(a)].lastAnsweredAt) - count(history[getId(b)].lastAnsweredAt));
  const selected = [...review, ...unseen.slice(0, 5), ...seen.slice(0, 10 - review.length - Math.min(5, unseen.length))];
  const used = new Set(selected.map(getId));
  // Fill a full round even when almost every item is unseen or needs review.
  return [...selected, ...rest.filter(entry => !used.has(getId(entry))),
    ...shuffled.filter(entry => !used.has(getId(entry)) && !rest.includes(entry))].slice(0, 10);
}
