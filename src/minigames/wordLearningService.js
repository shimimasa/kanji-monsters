import { isSaveSessionReady, saveGameData } from '../core/gameState.js';
import { captureSaveContext } from '../core/saveData.js';

import { reviewIds } from './learningSelection.js';


export function createWordLearningService({ storageKey, contentIds, gameId, trackTimeouts = false, ready = isSaveSessionReady, capture = captureSaveContext,
  save = saveGameData, now = Date.now } = {}) {
  const ids = new Set(contentIds);
  let activeRun = null;
  function read() {
    try {
      if (!ready()) return null;
      const context = capture(), [slot, epoch, raw] = JSON.parse(context);
      if (!raw || !ready() || capture() !== context) return null;
      const learning = JSON.parse(raw).player?.miniGames?.[storageKey];
      return { owner: JSON.stringify([slot, epoch]), history: learning?.items || {} };
    } catch { return null; }
  }
  const getHistory = () => read()?.history || {};
  const getReviewIds = () => reviewIds(Object.fromEntries(Object.entries(getHistory()).filter(([id]) => ids.has(id))));
  const getPracticeIds = requested => {
    if (!Array.isArray(requested)) return [];
    const history = getHistory();
    return [...new Set(requested)].filter(id => ids.has(id) && typeof history[id]?.lastCorrect === 'boolean').slice(0, 10);
  };
  return {
    getHistory, getReviewIds, getPracticeIds,
    beginRun(sessionId) {
      const owner = read()?.owner;
      const pending = [], observed = new Set();
      let closed = false;
      const run = {
        pendingCount() { return pending.length; },
        observe(event) {
          if (closed || activeRun !== run || event.sessionId !== sessionId || (event.gameId && event.gameId !== gameId) ||
              !['correct', 'incorrect'].includes(event.type) || !ids.has(event.payload?.contentId) ||
              typeof event.payload?.attemptId !== 'string' || observed.has(event.payload.attemptId)) return;
          observed.add(event.payload.attemptId);
          pending.push({ id: event.payload.contentId, attemptId: event.payload.attemptId,
            correct: event.type === 'correct', timeout: trackTimeouts && event.payload.reason === 'timeout', at: Math.max(0, Math.floor(now())) });
        },
        flush() {
          if (closed || activeRun !== run || !owner || owner !== read()?.owner) return { ok: false };
          if (!pending.length) return { ok: true };
          const batch = [...pending];
          const result = save(snapshot => {
            const progress = snapshot.player.miniGames ??= { version: 1, games: {}, companions: {} };
            const learning = progress[storageKey] ??= { version: 1, items: {}, recentAttempts: [] };
            for (const entry of batch) {
              if (learning.recentAttempts.includes(entry.attemptId)) continue;
              const item = learning.items[entry.id] ??= { correct: 0, incorrect: 0, lastAnsweredAt: 0, lastCorrect: false };
              if (entry.timeout) item.timedOut = (item.timedOut || 0) + 1;
              else item[entry.correct ? 'correct' : 'incorrect']++;
              if (trackTimeouts) { item.timedOut ??= 0; item.lastReason = entry.timeout ? 'timeout' : 'answer'; }
              item.lastCorrect = entry.correct; item.lastAnsweredAt = entry.at;
              learning.recentAttempts.push(entry.attemptId);
            }
            learning.recentAttempts = learning.recentAttempts.slice(-64);
          });
          if (result.ok) pending.splice(0, batch.length);
          return result;
        },
        close() { closed = true; },
      };
      activeRun = run;
      return run;
    },
  };
}
