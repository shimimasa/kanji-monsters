// The first three companions introduce distinct routes without hiding practice.
const COURSES = Object.freeze({
  'HKD-E01': { gameId: 'mathSprint', id: 'potato-shortcut', name: 'ころころ近道',
    description: '障害で力を1使い、転がって近道を狙う。' },
  'HKD-E02': { gameId: 'mathInvader', id: 'corn-barrage', name: '黄金の連射',
    description: '手前の敵を倒して粒を集め、強化弾を撃つ。' },
  'HKD-E03': { gameId: 'timedChoice', id: 'milk-lantern', name: 'しずくの灯台',
    description: '光をしずくに蓄え、必要なときに灯台へ戻す。' },
});

export function companionCourse(gotomonId, gameId) {
  const course = COURSES[gotomonId];
  return course?.gameId === gameId ? course : null;
}
