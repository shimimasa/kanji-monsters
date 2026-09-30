import { stageData, getMonsterById } from '../loaders/dataLoader.js';

// The Gotomon who appear inside a mini-game (as enemies, moles, passengers …), not
// only the companion. Pure: the lists come in, so tests can pass their own.
//   friends: the child's own Gotomon
//   wild:    Gotomon of the stages the child has reached (Hokkaido at least), and friends
//   boss:    a boss of one of those stages
// Only Gotomon with a picture are cast. Nothing here changes the save.
// The companion itself is left out (it is already on screen as the companion).
export function buildCast({ owned = [], stages = [], lookup = () => null, imageOf = () => null, random = Math.random, limit = 12, exclude = null }) {
  const shuffled = list => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  };
  const card = monster => {
    const imageUrl = imageOf(monster.id);
    return imageUrl ? Object.freeze({ id: monster.id, name: monster.name || monster.id, imageUrl }) : null;
  };
  const friends = owned.filter(item => item?.id !== exclude).map(item => item?.imageUrl ? Object.freeze({ id: item.id, name: item.name, imageUrl: item.imageUrl }) : null).filter(Boolean);
  const seen = new Set([...friends.map(item => item.id), exclude]);
  const met = stages.flatMap(stage => (stage?.enemyIdList || []).map(id => lookup(id)).filter(Boolean));
  const bosses = met.filter(monster => monster.isBoss).map(card).filter(Boolean);
  const wild = met.filter(monster => !monster.isBoss && !seen.has(monster.id) && seen.add(monster.id)).map(card).filter(Boolean);
  return Object.freeze({
    friends: Object.freeze(shuffled(friends).slice(0, limit)),
    wild: Object.freeze(shuffled([...wild, ...friends]).slice(0, limit)),
    boss: bosses.length ? bosses[Math.floor(random() * bosses.length)] : null,
  });
}

// The cast for a play, from the save's collection and the stages already reached.
export function castForPlay(service, random = Math.random, companionId = null) {
  try {
    const visited = new Set(service.getVisitedStageIds?.() ?? ['hokkaido_area1']);
    const stages = stageData.filter(stage => visited.has(stage.stageId));
    return buildCast({ owned: service.getOwnedGotomon?.() ?? [], stages, random, exclude: companionId,
      lookup: id => getMonsterById(id), imageOf: id => service.getGotomonById?.(id)?.imageUrl ?? null });
  } catch {
    return Object.freeze({ friends: Object.freeze([]), wild: Object.freeze([]), boss: null });
  }
}

// Picks the i-th Gotomon of a list, or null when the list is empty.
export const castAt = (list, index) => list?.length ? list[((index % list.length) + list.length) % list.length] : null;
