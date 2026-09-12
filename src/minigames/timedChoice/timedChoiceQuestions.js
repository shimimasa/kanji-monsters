// Small, self-authored probe fixture. This is not the canonical kanji curriculum.
export const TIMED_CHOICE_FIXTURE = Object.freeze([
  ['anzen', '安全', 'あんぜん'],
  ['kibou', '希望', 'きぼう'],
  ['mirai', '未来', 'みらい'],
  ['shizen', '自然', 'しぜん'],
  ['bunka', '文化', 'ぶんか'],
  ['heiwa', '平和', 'へいわ'],
  ['yuujou', '友情', 'ゆうじょう'],
  ['yuuki', '勇気', 'ゆうき'],
  ['doryoku', '努力', 'どりょく'],
  ['seichou', '成長', 'せいちょう'],
  ['yakusoku', '約束', 'やくそく'],
  ['hakken', '発見', 'はっけん'],
  ['bouken', '冒険', 'ぼうけん'],
  ['kisetsu', '季節', 'きせつ'],
  ['chikyuu', '地球', 'ちきゅう'],
  ['uchuu', '宇宙', 'うちゅう'],
  ['kenkou', '健康', 'けんこう'],
  ['koutsuu', '交通', 'こうつう'],
  ['tosho', '図書', 'としょ'],
  ['ongaku', '音楽', 'おんがく'],
].map(([fixtureId, word, reading]) => Object.freeze({ fixtureId, word, reading })));

function takeRandom(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new TypeError('random must return a finite value in [0, 1)');
  }
  return value;
}

function shuffled(items, random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.floor(takeRandom(random) * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

export function generateTimedChoiceQuestions({ sessionId, random = Math.random } = {}) {
  if (typeof sessionId !== 'string' || !sessionId) throw new TypeError('sessionId is required');
  if (typeof random !== 'function') throw new TypeError('random must be a function');
  const selected = shuffled(TIMED_CHOICE_FIXTURE, random).slice(0, 10);
  return Object.freeze(selected.map((entry, index) => {
    const distractors = shuffled(
      TIMED_CHOICE_FIXTURE.filter(candidate => candidate.fixtureId !== entry.fixtureId), random,
    ).slice(0, 3);
    const choices = shuffled([entry, ...distractors], random).map(candidate => Object.freeze({
      choiceId: `reading:${candidate.fixtureId}`,
      text: candidate.reading,
    }));
    return Object.freeze({
      fixtureId: entry.fixtureId,
      problemId: `${sessionId}:timed:${index + 1}:${entry.fixtureId}`,
      prompt: `「${entry.word}」の よみは？`,
      choices: Object.freeze(choices),
      correctChoiceId: `reading:${entry.fixtureId}`,
      skillId: 'kanji.vocabulary.reading',
    });
  }));
}
