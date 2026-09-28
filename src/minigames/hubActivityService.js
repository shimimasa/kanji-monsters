import { isSaveSessionReady, saveGameData } from '../core/gameState.js';
import { captureSaveContext } from '../core/saveData.js';

export function createHubActivityService({ ready = isSaveSessionReady, capture = captureSaveContext, save = saveGameData } = {}) {
  return {
    recordStart({ gameId, owner, gameIds }) {
      if (!gameIds.includes(gameId) || !owner) return { ok: false };
      try {
        if (!ready()) return { ok: false };
        const context = capture(), [slot, epoch, raw] = JSON.parse(context);
        if (!raw || owner !== JSON.stringify([slot, epoch]) || capture() !== context) return { ok: false };
        return save(snapshot => {
          const progress = snapshot.player.miniGames ??= { version: 1, games: {}, companions: {} };
          const previous = progress.hubActivity?.startedGames || [];
          progress.hubActivity = { version: 1, lastGameId: gameId,
            startedGames: [...new Set([...previous.filter(id => gameIds.includes(id)), gameId])] };
        });
      } catch { return { ok: false }; }
    },
  };
}
export const hubActivityService = createHubActivityService();
