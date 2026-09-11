// Small, self-authored probe fixture. This is not the canonical English curriculum.
export const ENGLISH_CHOICE_FIXTURE = Object.freeze([
  ['apple', 'apple', 'りんご'],
  ['book', 'book', '本'],
  ['cat', 'cat', 'ねこ'],
  ['dog', 'dog', 'いぬ'],
  ['sun', 'sun', '太陽'],
  ['moon', 'moon', '月'],
  ['water', 'water', '水'],
  ['school', 'school', '学校'],
  ['friend', 'friend', '友だち'],
  ['family', 'family', '家族'],
  ['red', 'red', '赤'],
  ['blue', 'blue', '青'],
  ['run', 'run', '走る'],
  ['eat', 'eat', '食べる'],
  ['read', 'read', '読む'],
  ['happy', 'happy', 'うれしい'],
  ['big', 'big', '大きい'],
  ['small', 'small', '小さい'],
  ['morning', 'morning', '朝'],
  ['night', 'night', '夜'],
].map(([id, prompt, meaning]) => Object.freeze({ id, prompt, meaning })));

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

export function generateEnglishChoiceQuestions({ sessionId, random = Math.random } = {}) {
  if (typeof sessionId !== 'string' || !sessionId) throw new TypeError('sessionId is required');
  if (typeof random !== 'function') throw new TypeError('random must be a function');
  const selected = shuffled(ENGLISH_CHOICE_FIXTURE, random).slice(0, 10);
  return Object.freeze(selected.map((entry, index) => {
    const distractors = shuffled(
      ENGLISH_CHOICE_FIXTURE.filter(candidate => candidate.id !== entry.id), random,
    ).slice(0, 3);
    const choices = shuffled([entry, ...distractors], random).map(candidate => Object.freeze({
      choiceId: `meaning:${candidate.id}`,
      text: candidate.meaning,
    }));
    return Object.freeze({
      problemId: `${sessionId}:english:${index + 1}:${entry.id}`,
      prompt: entry.prompt,
      choices: Object.freeze(choices),
      correctChoiceId: `meaning:${entry.id}`,
      skillId: 'english.basicVocabulary.meaning',
    });
  }));
}
