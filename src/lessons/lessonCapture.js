import { saveGameData, isSaveSessionReady } from '../core/gameState.js';
import { captureSaveContext } from '../core/saveData.js';
import { readActiveCollection } from '../minigames/collectionAdapter.js';
import { lessonForSlug } from './lessonCatalog.js';

// Captures use the same confirmed collection as the adventure and square games.
// Lesson answers never enter the kanji reading record.
export function createLessonCapture({ save = saveGameData, ready = isSaveSessionReady,
  capture = captureSaveContext, owned = readActiveCollection } = {}) {
  return function captureLesson(slug, { count, total } = {}) {
    const friend = lessonForSlug(slug);
    if (!friend || count !== 5 || total !== 5 || !ready()) return { ok: false, friend: null };
    const context = capture();
    if (owned({ ready, capture }).includes(friend.id)) return { ok: true, friend, newFriend: false };
    let added = false;
    const outcome = save(snapshot => {
      const ids = snapshot.player.collection.gotomonIds;
      if (!ids.includes(friend.id)) { ids.push(friend.id); added = true; }
    });
    if (!outcome?.ok || capture() === context) return { ok: false, friend: null };
    return { ok: true, friend, newFriend: added };
  };
}

export const captureLesson = createLessonCapture();

export function createLessonProgress({ save = saveGameData, ready = isSaveSessionReady,
  capture = captureSaveContext } = {}) {
  return function recordLessonProgress(slug, { count, total } = {}) {
    if (!lessonForSlug(slug) || !Number.isInteger(count) || count < 1 || count > 5 || total !== 5 || !ready()) return { ok: false };
    let context, previous = 0;
    try {
      context = capture();
      const [, , raw] = JSON.parse(context);
      previous = Number(JSON.parse(raw).player?.miniGames?.lessonProgress?.[slug]?.bestStars) || 0;
    } catch { return { ok: false }; }
    if (capture() !== context) return { ok: false };
    if (previous >= count) return { ok: true, bestStars: previous };
    const outcome = save(snapshot => {
      const games = snapshot.player.miniGames ??= { version: 1, games: {}, companions: {} };
      const progress = games.lessonProgress ??= {};
      progress[slug] = { bestStars: count };
    });
    return outcome?.ok && capture() !== context ? { ok: true, bestStars: count } : { ok: false };
  };
}

export const recordLessonProgress = createLessonProgress();
