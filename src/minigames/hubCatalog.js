// How the mini-game square groups its games: by what the child wants to practice.
// Pure data; the hub screen renders it and tests check every game is in it once.

export const HUB_SUBJECTS = Object.freeze([
  Object.freeze({ id: 'all', label: 'ぜんぶ' }),
  Object.freeze({ id: 'kanji', label: '漢字' }),
  Object.freeze({ id: 'english', label: '英語' }),
  Object.freeze({ id: 'math', label: '算数' }),
  Object.freeze({ id: 'language', label: 'ことば・社会' }),
]);

// Games that practice one subject, easier and shorter first.
const ONLY = Object.freeze({
  kanji: Object.freeze(['photoRally', 'kanjiBingo', 'kanjiMemory', 'gotomonShop', 'kanjiSort', 'gotomonParts', 'gotomonOthello', 'tripSugoroku', 'kanjiDefense']),
  english: Object.freeze(['englishChoice', 'gotomonFishing', 'gotomonSnake']),
  math: Object.freeze(['mathSprint', 'gotomonToss', 'gotomonColoring', 'mathInvader', 'gotomonMeteor', 'gotomonMerge', 'gotomonBubble', 'gotomonPuyo', 'gotomonBreakout']),
  language: Object.freeze(['sentenceOrder', 'timedChoice', 'proverbDetective', 'multiSelect', 'asyncChoice', 'gotomonDelivery']),
});

// Games where the child picks the subject (their `mode`), newest first, with the subjects each offers.
const CHOOSE = Object.freeze([
  ['gotomonPush', ['kanji', 'english', 'math']], ['gotomonTrace', ['kanji', 'english', 'math']], ['gotomonLand', ['kanji', 'english', 'math']], ['gotomonHop', ['kanji', 'english', 'math']],
  ['gotomonGolf', ['kanji', 'english', 'math']], ['gotomonTag', ['kanji', 'english', 'math']], ['gotomonJump', ['kanji', 'english', 'math']],
  ['gotomonMaze', ['kanji', 'english', 'math']], ['gotomonSeek', ['kanji', 'english', 'math']], ['gotomonRace', ['kanji', 'english', 'math']],
  ['gotomonDrum', ['kanji', 'english', 'math']], ['gotomonSlash', ['kanji', 'english', 'math']], ['gotomonLink', ['kanji', 'english', 'math']],
  ['gotomonShooter', ['english', 'kanji']],
].map(([id, subjects]) => Object.freeze({ id, subjects: Object.freeze(subjects) })));

// The newest games: they wear NEW until they are played.
export const NEWEST = Object.freeze(['gotomonPush', 'gotomonTrace', 'gotomonLand', 'gotomonHop', 'gotomonGolf']);

// The subject a finished run counts for (the sticker book's 漢字・英語・算数 rewards): a game's own
// subject, or the one chosen at the start for a game with a choice.
export function subjectOf(gameId, mode = null) {
  const own = Object.entries(ONLY).find(([, ids]) => ids.includes(gameId))?.[0];
  if (own) return own;
  return CHOOSE.find(item => item.id === gameId)?.subjects.includes(mode) ? mode : null;
}

const label = id => HUB_SUBJECTS.find(subject => subject.id === id)?.label ?? id;

// The sections shown for a tab: on ぜんぶ, one per subject and then the games with a choice;
// on a subject, its own games and then the games that can be played in it.
export function hubSections(subject = 'all') {
  if (subject === 'all') {
    return Object.freeze([
      ...['kanji', 'english', 'math', 'language'].map(id => Object.freeze({ id, title: label(id), games: ONLY[id] })),
      Object.freeze({ id: 'choose', title: '漢字・英語・算数から えらべる', games: Object.freeze(CHOOSE.map(item => item.id)) }),
    ]);
  }
  const choose = CHOOSE.filter(item => item.subjects.includes(subject)).map(item => item.id);
  return Object.freeze([
    Object.freeze({ id: subject, title: `${label(subject)}の ゲーム`, games: ONLY[subject] ?? Object.freeze([]) }),
    ...(choose.length ? [Object.freeze({ id: 'choose', title: `${label(subject)}でも あそべる ゲーム`, games: Object.freeze(choose) })] : []),
  ]);
}

// The subjects a game with a choice offers (empty for one-subject games).
export const choiceSubjects = gameId => CHOOSE.find(item => item.id === gameId)?.subjects ?? Object.freeze([]);

// The mode a game starts in when opened from a subject tab (null: the game's own default).
export const modeForSubject = (gameId, subject) => (choiceSubjects(gameId).includes(subject) ? subject : null);
