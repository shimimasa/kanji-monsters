// Short runs end at a natural question or room boundary. Other games keep their
// complete board or story until they have a separately reviewed short ending.
export const SHORT_COURSE_COUNTS = Object.freeze({
  gotomonPush: 5,
  gotomonBreakout: 6,
  gotomonSlash: 6,
  gotomonRace: 6,
  gotomonSeek: 6,
  gotomonJump: 6,
  gotomonTag: 6,
  gotomonGolf: 6,
  gotomonHop: 6,
  gotomonLand: 6,
  gotomonTrace: 6,
  gotomonToss: 6,
  gotomonFishing: 6,
  gotomonDelivery: 5,
  gotomonDrum: 6,
  gotomonShooter: 6,
});

export const supportsShortCourse = gameId => Object.hasOwn(SHORT_COURSE_COUNTS, gameId);
export const shortCourseCount = gameId => SHORT_COURSE_COUNTS[gameId] ?? null;
export const courseUnit = gameId => gameId === 'gotomonPush' ? 'へや' : gameId === 'gotomonGolf' ? 'ホール'
  : gameId === 'gotomonLand' ? 'ステージ' : gameId === 'gotomonToss' ? '球'
  : gameId === 'gotomonDelivery' ? 'こ' : '問';
export const courseCountLabel = (gameId, short = false) => `${short ? shortCourseCount(gameId) : ['gotomonPush', 'gotomonDelivery'].includes(gameId) ? 10 : 12}${courseUnit(gameId)}`;
