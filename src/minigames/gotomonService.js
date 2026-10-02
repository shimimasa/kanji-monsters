import { isSaveSessionReady, saveGameData } from '../core/gameState.js';
import { captureSaveContext } from '../core/saveData.js';
import { ownedIdsFromSnapshot } from './collectionAdapter.js';
import { getMonsterById } from '../loaders/dataLoader.js';
import { getBonusMonsterFolder } from '../utils/monsterImagePaths.js';
import { growthStatus, calculateXP, supportStyle } from './companionGrowth.js';
import { scoreRank, betterRank } from './scoreRank.js';
import { recordCompanionMemory } from './companionMemories.js';
import { recordSticker, markStickerReview } from './companionStickers.js';
import { outfitProgress, wornItems, outfitItem, OUTFIT_SLOTS } from './companionOutfits.js';
import { hubSections } from './hubCatalog.js';
import { secretsFor, openedSecrets } from './companionSecrets.js';

// The sticker book's slots: every game in the square (the crown asks for all of them).
const GAME_COUNT = new Set(hubSections('all').flatMap(section => section.games)).size;

const folders = ['','grade1-hokkaido','grade2-touhoku','grade3-kantou','grade4-chuubu','grade5-kinki','grade6-chuugoku','grade7-asia','grade8-europe','grade9-america','grade10-africa','grade11-shikoku','grade12-kyuusyuu'];
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
// All reads use the confirmed active save. No second inventory or Storage keys.
export function createGotomonService({ ready = isSaveSessionReady, capture = captureSaveContext,
  save = saveGameData, lookup = getMonsterById, now = Date.now } = {}) {
  const tickets = new WeakMap();
  // Runs that earned a sticker: their build-again review may add the がんばり mark (once).
  const reviewable = new Map();
  let activeTicket = null;
  function read() {
    try {
      if (!ready()) return null;
      const context = capture(), [slot, epoch, raw] = JSON.parse(context);
      if (!raw || !ready() || capture() !== context) return null;
      return { snapshot: JSON.parse(raw), owner: JSON.stringify([slot, epoch]) };
    } catch { return null; }
  }
  // `companions` is passed when many are looked up at once, so the save is read only once.
  const getGotomonById = (id, companions = read()?.snapshot.player.miniGames?.companions ?? {}) => {
    const data = lookup(id);
    if (!data) return { id, name: id, imageUrl: null };
    const folder = getBonusMonsterFolder(id) || folders[data.grade] || folders[1];
    return { id, name: data.name || id, imageUrl: `/assets/images/monsters/full/${folder}/${id}.webp`,
      category: data.category || '', support: supportStyle(data.category),
      // きせかえ: what it wears now (drawn over its picture everywhere it appears).
      outfit: wornItems(companions?.[id], { gameCount: GAME_COUNT }) };
  };
  const getOwnedGotomon = () => {
    const current = read(), companions = current?.snapshot.player.miniGames?.companions ?? {};
    return ownedIdsFromSnapshot(current?.snapshot).map(id => getGotomonById(id, companions));
  };
  const getProgress = () => read()?.snapshot.player.miniGames ?? {};
  const getSelectedGotomon = () => {
    const owned = getOwnedGotomon(), selectedId = getProgress().selectedGotomonId;
    return owned.find(item => item.id === selectedId) ?? owned[0] ?? null;
  };
  return {
    getOwnedGotomon, getSelectedGotomon, getGotomonById, getProgress,
    getGrowth: id => growthStatus(getProgress().companions?.[id]),
    getOwner: () => read()?.owner ?? null,
    // Kanji this child is still learning: review queue, recent slips and more misses than hits.
    getFocusKanjiIds() {
      const study = read()?.snapshot.player.study ?? {};
      const weak = Object.entries(study.answers ?? {}).filter(([, stats]) => count(stats?.incorrect) > 0 && count(stats?.incorrect) >= count(stats?.correct)).map(([id]) => id);
      const ids = [...(Array.isArray(study.reviewQueue) ? study.reviewQueue : []), ...(Array.isArray(study.wrongKanji) ? study.wrongKanji : []), ...weak];
      return [...new Set(ids.filter(id => typeof id === 'string'))];
    },
    // Photo rally spots: stages cleared in the adventure, plus the first one for everyone.
    getVisitedStageIds() {
      const cleared = read()?.snapshot.player.progress?.clearedStages;
      return [...new Set(['hokkaido_area1', ...(Array.isArray(cleared) ? cleared.filter(id => typeof id === 'string') : [])])];
    },
    getAlbum: () => getProgress().album ?? {},
    getCaseFiles: () => getProgress().caseFiles ?? {},
    getJourneys: () => getProgress().journeys ?? {},
    getStickers: id => getProgress().companions?.[id]?.stickers ?? {},
    // ひみつノート: what this companion tells, by なかよし.
    getSecrets: id => secretsFor(lookup(id), getProgress().companions?.[id]),
    getOutfit: id => ({ chosen: { ...(getProgress().companions?.[id]?.outfit ?? {}) },
      progress: outfitProgress(getProgress().companions?.[id], { gameCount: GAME_COUNT }) }),
    // Puts an opened item on (or takes the place's item off with null).
    setOutfit({ gotomonId, slot, itemId = null } = {}) {
      if (!OUTFIT_SLOTS.includes(slot) || (itemId !== null && outfitItem(itemId)?.slot !== slot)) return { ok: false };
      if (!getOwnedGotomon().some(item => item.id === gotomonId)) return { ok: false };
      if (itemId !== null && !outfitProgress(getProgress().companions?.[gotomonId], { gameCount: GAME_COUNT })[itemId]?.unlocked) return { ok: false };
      return save(snapshot => {
        if (!snapshot.player.collection.gotomonIds.includes(gotomonId)) throw new Error('Companion is not owned');
        const progress = snapshot.player.miniGames ??= { version: 1, games: {}, companions: {} };
        progress.companions ??= {};
        const friend = progress.companions[gotomonId] ??= { plays: 0, friendship: 0, medals: [] };
        friend.outfit = { ...(friend.outfit ?? {}), [slot]: itemId };
      });
    },
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
      ticket, completed = false, finished = false, activeElapsedMs = 0, timeMs = null, memoryFinished = finished, photos = null, cases = null, journey = null, subject = null }) {
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
        const outfitBefore = outfitProgress(friend, { gameCount: GAME_COUNT });
        const earnedXP = run ? calculateXP({ completed, finished, correct, rank: rank.rank, newBest: points > previousBest, activeElapsedMs }) : 0;
        const after = growthStatus({ xp: before.xp + earnedXP });
        friend.xp = after.xp; friend.level = after.level;
        friend.bestRank = betterRank(rank.rank, friend.bestRank || 'C');
        game.bestRank = betterRank(rank.rank, game.bestRank || 'C');
        const earned = 1 + Math.min(3, Math.floor(count(correct) / 3));
        const friendshipBefore = count(friend.friendship);
        friend.plays = count(friend.plays) + 1; friend.friendship = count(friend.friendship) + earned;
        friend.medals ??= [];
        if (friend.plays >= 5 && !friend.medals.includes('five-plays')) friend.medals.push('five-plays');
        // Album pages keep each monster's best photo; only a real, completed rally adds to them.
        const newPhotos = [];
        if (run && completed && gameId === 'photoRally' && Array.isArray(photos)) {
          const album = progress.album ??= {};
          for (const photo of photos.slice(0, 10)) {
            const stars = Math.min(3, Math.max(1, Math.floor(Number(photo?.stars) || 0)));
            if (typeof photo?.monsterId !== 'string' || !photo.monsterId || !Number.isFinite(Number(photo?.stars))) continue;
            const entry = album[photo.monsterId];
            if (!entry) newPhotos.push(photo.monsterId);
            album[photo.monsterId] = { stars: Math.max(count(entry?.stars), stars), shots: count(entry?.shots) + 1,
              firstAt: entry?.firstAt ?? Math.max(0, Math.floor(now())) };
          }
        }
        // Case files keep each solved proverb's best stars (proverb detective only).
        const newCases = [];
        if (run && completed && gameId === 'proverbDetective' && Array.isArray(cases)) {
          const files = progress.caseFiles ??= {};
          for (const item of cases.slice(0, 10)) {
            const key = String(item?.caseId ?? '');
            if (!/^\d+$/.test(key) || !Number.isFinite(Number(item?.stars))) continue;
            const stars = Math.min(3, Math.max(1, Math.floor(Number(item.stars))));
            const entry = files[key];
            if (!entry) newCases.push(key);
            files[key] = { stars: Math.max(count(entry?.stars), stars), solves: count(entry?.solves) + 1,
              firstAt: entry?.firstAt ?? Math.max(0, Math.floor(now())) };
          }
        }
        // Trip stamps: the best boss stars per stage (trip sugoroku only).
        let journeyBest = null;
        if (run && completed && gameId === 'tripSugoroku' && typeof journey?.stageId === 'string' && journey.stageId && Number.isFinite(Number(journey?.stars))) {
          const journeys = progress.journeys ??= {};
          const stars = Math.min(3, Math.max(1, Math.floor(Number(journey.stars)))), entry = journeys[journey.stageId];
          if (stars > count(entry?.stars)) journeyBest = stars;
          journeys[journey.stageId] = { stars: Math.max(count(entry?.stars), stars), trips: count(entry?.trips) + 1,
            firstAt: entry?.firstAt ?? Math.max(0, Math.floor(now())) };
        }
        const memory = run && completed ? recordCompanionMemory(friend, { gameId, score: points,
          finished: !!memoryFinished, at: Math.max(0, Math.floor(now())) }) : null;
        // The sticker book: a real run played to the end (rank A or S makes it gold).
        const sticker = run && completed && finished ? recordSticker(friend, { gameId, rank: rank.rank, subject, at: Math.max(0, Math.floor(now())) }) : null;
        reward = { earned, friendship: friend.friendship, plays: friend.plays,
          newBest: points > previousBest, bestScore: game.bestScore, medals: [...friend.medals],
          before, after, earnedXP: after.xp - before.xp, levelUp: after.level > before.level, rank,
          memory, sticker, newPhotos, newCases, journeyBest,
          // きせかえ opened by this run (a sticker, a level or なかよし).
          newSecrets: openedSecrets(lookup(gotomonId), { friendship: friendshipBefore }, friend),
          newOutfits: Object.entries(outfitProgress(friend, { gameCount: GAME_COUNT })).filter(([id, p]) => p.unlocked && !outfitBefore[id].unlocked).map(([id]) => id),
          bestTimeMs:game.bestTimeMs??null,previousTimeMs:previousTime,newTimeBest:validTime&&(!previousTime||roundedTime<previousTime) };
      });
      if (outcome.ok && run) run.receipt = reward;
      if (outcome.ok && reward?.sticker) reviewable.set(sessionId, { owner, gameId, gotomonId });
      return { ...outcome, reward: outcome.ok ? reward : null };
    },
    // The がんばり mark on this run's sticker, once its build-again review was done to the end.
    markReviewSticker({ owner, sessionId } = {}) {
      const run = reviewable.get(sessionId);
      if (!run || !owner || owner !== run.owner || owner !== read()?.owner) return { ok: false };
      let mark = false;
      const outcome = save(snapshot => {
        mark = markStickerReview(snapshot.player.miniGames?.companions?.[run.gotomonId], run.gameId);
      });
      if (outcome.ok) reviewable.delete(sessionId);
      return { ...outcome, mark: outcome.ok && mark, gameId: run.gameId };
    },
  };
}
export const gotomonService = createGotomonService();
