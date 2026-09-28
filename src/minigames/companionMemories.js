export const MEMORY_GAME_IDS = Object.freeze(['mathSprint', 'mathInvader', 'englishChoice', 'sentenceOrder',
  'timedChoice', 'multiSelect', 'asyncChoice', 'kanjiDefense']);

// Called inside the existing reward transaction, after its duplicate-session gate.
export function recordCompanionMemory(friend, { gameId, score, finished, at }) {
  if (!MEMORY_GAME_IDS.includes(gameId)) return null;
  const memories = friend.memories ??= { version: 1, games: {} };
  const previous = memories.games[gameId];
  const firstPlay = !previous, firstFinish = finished && previous?.firstFinishedAt == null;
  const newBest = !!previous && score > previous.bestScore;
  const record = previous ?? { plays: 0, firstPlayedAt: at, lastPlayedAt: at,
    bestScore: score, bestAt: at, firstFinishedAt: null };
  record.plays++; record.lastPlayedAt = at;
  if (newBest) { record.bestScore = score; record.bestAt = at; }
  if (firstFinish) record.firstFinishedAt = at;
  memories.games[gameId] = record;
  return { firstPlay, firstFinish, newBest, bestScore: record.bestScore };
}

export function validateCompanionMemories(memories) {
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const nonnegative = value => Number.isSafeInteger(value) && value >= 0;
  if (!object(memories) || memories.version !== 1 || !object(memories.games) || Object.keys(memories.games).length > MEMORY_GAME_IDS.length) throw new Error('Invalid companion memories');
  for (const [id, record] of Object.entries(memories.games)) {
    if (!MEMORY_GAME_IDS.includes(id) || !object(record) || !Number.isSafeInteger(record.plays) || record.plays < 1 ||
        !['firstPlayedAt', 'lastPlayedAt', 'bestScore', 'bestAt'].every(key => nonnegative(record[key])) ||
        (record.firstFinishedAt !== null && !nonnegative(record.firstFinishedAt))) throw new Error('Invalid companion memory');
  }
}
