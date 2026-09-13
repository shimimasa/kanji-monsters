import { isSaveSessionReady, saveGameData } from '../core/gameState.js';
import { captureSaveContext } from '../core/saveData.js';
import { ownedIdsFromSnapshot } from './collectionAdapter.js';
import { getMonsterById } from '../loaders/dataLoader.js';
import { getBonusMonsterFolder } from '../utils/monsterImagePaths.js';
import { growthStatus, calculateXP, supportStyle } from './companionGrowth.js';
import { scoreRank, betterRank } from './scoreRank.js';

const folders = ['','grade1-hokkaido','grade2-touhoku','grade3-kantou','grade4-chuubu','grade5-kinki','grade6-chuugoku','grade7-asia','grade8-europe','grade9-america','grade10-africa','grade11-shikoku','grade12-kyuusyuu'];
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
// All reads use the confirmed active save. No second inventory or Storage keys.
export function createGotomonService({ ready = isSaveSessionReady, capture = captureSaveContext,
  save = saveGameData, lookup = getMonsterById } = {}) {
  const tickets = new WeakMap();
  let activeTicket = null;
  function read() {
    try {
      if (!ready()) return null;
      const context = capture(), [slot, epoch, raw] = JSON.parse(context);
      if (!raw || !ready() || capture() !== context) return null;
      return { snapshot: JSON.parse(raw), owner: JSON.stringify([slot, epoch]) };
    } catch { return null; }
  }
  const getGotomonById = id => {
    const data = lookup(id);
    if (!data) return { id, name: id, imageUrl: null };
    const folder = getBonusMonsterFolder(id) || folders[data.grade] || folders[1];
    return { id, name: data.name || id, imageUrl: `/assets/images/monsters/full/${folder}/${id}.webp`,
      category: data.category || '', support: supportStyle(data.category) };
  };
  const getOwnedGotomon = () => ownedIdsFromSnapshot(read()?.snapshot).map(getGotomonById);
  const getProgress = () => read()?.snapshot.player.miniGames ?? {};
  const getSelectedGotomon = () => {
    const owned = getOwnedGotomon(), selectedId = getProgress().selectedGotomonId;
    return owned.find(item => item.id === selectedId) ?? owned[0] ?? null;
  };
  return {
    getOwnedGotomon, getSelectedGotomon, getGotomonById, getProgress,
    getGrowth: id => growthStatus(getProgress().companions?.[id]),
    getOwner: () => read()?.owner ?? null,
    beginPlay({ sessionId, gameId, gotomonId }) {
      if (!sessionId || !gameId || !getOwnedGotomon().some(friend => friend.id === gotomonId)) return null;
      activeTicket = Object.freeze({ sessionId });
      tickets.set(activeTicket, { owner: read()?.owner, gameId, gotomonId, receipt: null });
      return activeTicket;
    },
    setSelectedGotomon(id) {
      if (!getOwnedGotomon().some(item => item.id === id)) return { ok: false };
      return save(snapshot => {
        if (!snapshot.player.collection.gotomonIds.includes(id)) throw new Error('Companion is not owned');
        snapshot.player.miniGames ??= { version: 1, games: {}, companions: {} };
        snapshot.player.miniGames.selectedGotomonId = id;
      });
    },
    awardGotomonPlayResult({ owner, sessionId, gameId, gotomonId, score, correct, maxCombo,
      ticket, completed = false, finished = false, activeElapsedMs = 0, timeMs = null }) {
      if (!owner || owner !== read()?.owner || !sessionId || !gameId) return { ok: false };
      const run = ticket && tickets.get(ticket);
      if (ticket && (!run || ticket !== activeTicket || ticket.sessionId !== sessionId || run.owner !== owner ||
          run.gameId !== gameId || run.gotomonId !== gotomonId || !completed)) return { ok: false };
      if (run?.receipt) return { ok: true, reward: { ...run.receipt, duplicate: true } };
      let reward;
      const outcome = save(snapshot => {
        if (!snapshot.player.collection.gotomonIds.includes(gotomonId)) throw new Error('Companion is not owned');
        const progress = snapshot.player.miniGames ??= { version: 1, games: {}, companions: {} };
        progress.games ??= {}; progress.companions ??= {};
        const game = progress.games[gameId] ??= { bestScore: 0, plays: 0 };
        if (game.lastSessionId === sessionId || (Array.isArray(game.recentSessionIds) && game.recentSessionIds.includes(sessionId))) { reward = { duplicate: true, bestScore: game.bestScore }; return; }
        const previousBest = count(game.bestScore), points = count(score);
        const previousTime = count(game.bestTimeMs) || null;
        const roundedTime = Math.round(timeMs);
        const validTime = !!run && completed && finished && gameId==='mathSprint' && count(correct)>=8 && Number.isSafeInteger(roundedTime) && roundedTime>0 && typeof timeMs==='number';
        if(validTime)game.bestTimeMs=Math.min(previousTime??Infinity,roundedTime);
        game.bestScore = Math.max(previousBest, points); game.plays = count(game.plays) + 1;
        game.lastSessionId = sessionId; game.bestCombo = Math.max(count(game.bestCombo), count(maxCombo));
        game.recentSessionIds = [...(Array.isArray(game.recentSessionIds) ? game.recentSessionIds : []), sessionId].slice(-64);
        const friend = progress.companions[gotomonId] ??= { plays: 0, friendship: 0, medals: [] };
        const before = growthStatus(friend), rank = scoreRank(gameId, points, count(correct));
        const earnedXP = run ? calculateXP({ completed, finished, correct, rank: rank.rank, newBest: points > previousBest, activeElapsedMs }) : 0;
        const after = growthStatus({ xp: before.xp + earnedXP });
        friend.xp = after.xp; friend.level = after.level;
        friend.bestRank = betterRank(rank.rank, friend.bestRank || 'C');
        game.bestRank = betterRank(rank.rank, game.bestRank || 'C');
        const earned = 1 + Math.min(3, Math.floor(count(correct) / 3));
        friend.plays = count(friend.plays) + 1; friend.friendship = count(friend.friendship) + earned;
        friend.medals ??= [];
        if (friend.plays >= 5 && !friend.medals.includes('five-plays')) friend.medals.push('five-plays');
        reward = { earned, friendship: friend.friendship, plays: friend.plays,
          newBest: points > previousBest, bestScore: game.bestScore, medals: [...friend.medals],
          before, after, earnedXP: after.xp - before.xp, levelUp: after.level > before.level, rank,
          bestTimeMs:game.bestTimeMs??null,previousTimeMs:previousTime,newTimeBest:validTime&&(!previousTime||roundedTime<previousTime) };
      });
      if (outcome.ok && run) run.receipt = reward;
      return { ...outcome, reward: outcome.ok ? reward : null };
    },
  };
}
export const gotomonService = createGotomonService();
