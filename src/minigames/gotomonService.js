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
import { titleProgress, earnedTitleIds, newTitles } from './companionTitles.js';
import { stickerSummary } from './companionStickers.js';
import { typeOf } from './gotomonTypes.js';
import { moveFor, supporterXP, MAX_SUPPORTERS } from './gotomonMoves.js';
import { LEGEND_IDS, recipeFor, regionOf, candidates, firstPair, canBreed } from './gotomonBreeding.js';

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
      category: data.category || '', support: supportStyle(data.category), type: typeOf(data),
      // わざ: the type's Lv1 move, the stronger one from Lv7.
      move: moveFor(typeOf(data), growthStatus(companions?.[id]).level),
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
  // はいごう: every legend with its recipe, whether its region is known, and who can stand on each side.
  function getBreedingBook() {
    const progress = getProgress(), companions = progress.companions ?? {}, bred = progress.breeding ?? {};
    const owned = getOwnedGotomon(), ownedIds = new Set(owned.map(item => item.id));
    const friends = owned.map(item => Object.freeze({ ...item, region: regionOf(lookup(item.id)), level: growthStatus(companions[item.id]).level }));
    const known = new Set(friends.map(friend => friend.region).filter(Boolean));
    const legends = LEGEND_IDS.map(id => {
      const recipe = recipeFor(id), sides = candidates(recipe, friends);
      return Object.freeze({ gotomon: getGotomonById(id, companions), recipe, owned: ownedIds.has(id), bred: !!bred[id],
        revealed: known.has(recipe.region), a: sides.a, b: sides.b, pair: ownedIds.has(id) ? null : firstPair(recipe, friends) });
    });
    return { friends, legends };
  }
  return {
    getOwnedGotomon, getSelectedGotomon, getGotomonById, getProgress,
    getGrowth: id => growthStatus(getProgress().companions?.[id]),
    // パーティ: the supporters chosen last time that are still owned (never the companion itself).
    getParty(companionId = null) {
      const owned = new Set(getOwnedGotomon().map(item => item.id)), party = getProgress().party;
      return (Array.isArray(party) ? party : []).filter(id => owned.has(id) && id !== companionId).slice(0, MAX_SUPPORTERS);
    },
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
    // がんばりの称号: the child's titles over every companion.
    getTitles: () => titleProgress(getProgress().companions),
    // みんなのシール帳: how far each owned companion has come (stickers, きせかえ, ひみつ).
    getCompanionCards() {
      const companions = getProgress().companions ?? {};
      return getOwnedGotomon().map(gotomon => {
        const friend = companions[gotomon.id], secrets = secretsFor(lookup(gotomon.id), friend);
        return Object.freeze({ gotomon, level: growthStatus(friend).level, friendship: count(friend?.friendship), stickers: stickerSummary(friend?.stickers),
          outfits: Object.values(outfitProgress(friend, { gameCount: GAME_COUNT })).filter(p => p.unlocked).length,
          secrets: secrets.filter(s => s.open).length, secretTotal: secrets.length });
      });
    },
    gameCount: GAME_COUNT,
    getBreedingBook,
    // Meets the legend: it joins the collection, and both parents stay.
    breed({ legendId, parentA, parentB } = {}) {
      const recipe = recipeFor(legendId);
      if (!recipe) return { ok: false };
      const { friends } = getBreedingBook();
      if (friends.some(friend => friend.id === legendId) || !canBreed(recipe, friends, parentA, parentB)) return { ok: false };
      const outcome = save(snapshot => {
        const ids = snapshot.player.collection.gotomonIds;
        if (!ids.includes(parentA) || !ids.includes(parentB)) throw new Error('Parent is not owned');
        if (ids.includes(legendId)) throw new Error('Already met');
        const progress = snapshot.player.miniGames ??= { version: 1, games: {}, companions: {} };
        const levels = [parentA, parentB].map(id => growthStatus(progress.companions?.[id]).level);
        if (levels.some(level => level < 5)) throw new Error('Parents need Lv5');
        ids.push(legendId);
        progress.breeding = { ...(progress.breeding ?? {}), [legendId]: { parents: [parentA, parentB], at: Math.max(0, Math.floor(now())) } };
      });
      return { ...outcome, gotomon: outcome.ok ? getGotomonById(legendId) : null };
    },
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
    beginPlay({ sessionId, gameId, gotomonId, supporterIds = [] }) {
      const owned = new Set(getOwnedGotomon().map(friend => friend.id));
      if (!sessionId || !gameId || !owned.has(gotomonId)) return null;
      // Supporters ride along only if owned, not the companion, and not twice.
      const supporters = [...new Set(Array.isArray(supporterIds) ? supporterIds : [])].filter(id => owned.has(id) && id !== gotomonId).slice(0, MAX_SUPPORTERS);
      activeTicket = Object.freeze({ sessionId });
      tickets.set(activeTicket, { owner: read()?.owner, gameId, gotomonId, supporters, receipt: null });
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
    // Saves the companion and its supporters together (the start button of the picker).
    setParty(companionId, supporterIds = []) {
      const owned = new Set(getOwnedGotomon().map(item => item.id));
      const party = [...new Set(supporterIds)].filter(id => owned.has(id) && id !== companionId).slice(0, MAX_SUPPORTERS);
      if (!owned.has(companionId)) return { ok: false };
      return save(snapshot => {
        if (!snapshot.player.collection.gotomonIds.includes(companionId)) throw new Error('Companion is not owned');
        snapshot.player.miniGames ??= { version: 1, games: {}, companions: {} };
        snapshot.player.miniGames.selectedGotomonId = companionId;
        snapshot.player.miniGames.party = party.filter(id => snapshot.player.collection.gotomonIds.includes(id));
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
        const titlesBefore = earnedTitleIds(progress.companions);
        const friend = progress.companions[gotomonId] ??= { plays: 0, friendship: 0, medals: [] };
        const before = growthStatus(friend), rank = scoreRank(gameId, points, count(correct));
        const outfitBefore = outfitProgress(friend, { gameCount: GAME_COUNT });
        const earnedXP = run ? calculateXP({ completed, finished, correct, rank: rank.rank, newBest: points > previousBest, activeElapsedMs }) : 0;
        const after = growthStatus({ xp: before.xp + earnedXP });
        friend.xp = after.xp; friend.level = after.level;
        // パーティ: each supporter gets half the companion's XP (nothing else changes for it).
        const supporters = (run?.supporters ?? []).filter(id => snapshot.player.collection.gotomonIds.includes(id)).map(id => {
          const mate = progress.companions[id] ??= { plays: 0, friendship: 0, medals: [] };
          const was = growthStatus(mate), now = growthStatus({ xp: was.xp + supporterXP(after.xp - before.xp) });
          mate.xp = now.xp; mate.level = now.level;
          return { id, earnedXP: now.xp - was.xp, level: now.level, levelUp: now.level > was.level, newMove: was.level < 7 && now.level >= 7 };
        });
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
          memory, sticker, newPhotos, newCases, journeyBest, supporters,
          // The stronger わざ is learned at Lv7.
          newMove: before.level < 7 && after.level >= 7,
          // きせかえ opened by this run (a sticker, a level or なかよし).
          newTitles: newTitles(titlesBefore, progress.companions),
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
      let mark = false, titles = [];
      const outcome = save(snapshot => {
        const companions = snapshot.player.miniGames?.companions, had = earnedTitleIds(companions);
        mark = markStickerReview(companions?.[run.gotomonId], run.gameId);
        titles = newTitles(had, companions);
      });
      if (outcome.ok) reviewable.delete(sessionId);
      return { ...outcome, mark: outcome.ok && mark, newTitles: outcome.ok ? titles : [], gameId: run.gameId };
    },
  };
}
export const gotomonService = createGotomonService();
