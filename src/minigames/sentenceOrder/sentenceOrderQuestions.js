import { SENTENCE_CONTENT_ADDITIONS } from './sentenceContent.js';
import { SENTENCE_CHALLENGE_CONTENT } from './sentenceChallengeContent.js';
import { selectLearningEntries } from '../learningSelection.js';
// Canonical sentence bank. Corrections and ambiguity evidence are documented.
const fixture = (fixtureId, texts) => {
  const chunks = texts.map((text, index) => Object.freeze({
    chunkId: `${fixtureId}:chunk:${index + 1}`,
    text,
  }));
  return Object.freeze({
    fixtureId,
    prompt: '文節を正しい順に並べてください。',
    chunks: Object.freeze(chunks),
    correctOrder: Object.freeze(chunks.map(chunk => chunk.chunkId)),
    skillId: 'japanese.sentenceOrder.basic',
  });
};

export const SENTENCE_ORDER_FIXTURE = Object.freeze([
  fixture('library-book', ['図書館で借りた', '本を読み終えて', '返しました。']),
  fixture('morning-bird', ['庭の木で鳴く', '小鳥の声に', '耳をすませました。']),
  fixture('science-observe', ['観察してきた', '植物の成長を', '記録しました。']),
  fixture('umbrella-rain', ['雨が', '降りそうなので青いかさを', '持っていきます。']),
  fixture('river-clean', ['川辺を', 'きれいにするために', 'ごみを拾いました。']),
  fixture('train-trip', ['海の近くを走る', '電車の窓から', '景色を眺めました。']),
  fixture('curry-help', ['夕食に食べる', 'カレー作りを', '手伝いました。']),
  fixture('stars-visible', ['雲の切れ間に見える', '星の数を', '数えました。']),
  fixture('meeting-opinion', ['自分の考えを', '伝えるための', '言葉を選びました。']),
  fixture('sports-water', ['運動で失った', '水分を補うために', '水を飲みました。']),
  fixture('museum-note', ['博物館で気づいた', 'ことを忘れないように', '書き留めました。']),
  fixture('wind-laundry', ['風で飛びそうな', '洗濯物を', '取りこみました。']),
  fixture('garden-seed', ['春にまく', 'ひまわりの種を', '用意しました。']),
  fixture('map-route', ['駅までの道を示す', '地図を指して', '説明しました。']),
  fixture('lunch-thanks', ['給食を作った', '人に感謝する', '手紙を書きました。']),
  fixture('festival-drum', ['祭りの始まりを告げる', '太鼓の音に', '耳をすませました。']),
  fixture('recycle-paper', ['使い終わった', '紙を分けるための', '箱を用意しました。']),
  fixture('shadow-change', ['太陽の動きで変わる', '木の影を', '調べました。']),
  fixture('recipe-check', ['料理に使う', '材料がそろったか', '確かめました。']),
  fixture('promise-arrive', ['約束に', '遅れないようにと', '急いで家を出ました。']),
  ...SENTENCE_CONTENT_ADDITIONS.map(({id,chunks}) => fixture(id,chunks)),
]);
export const SENTENCE_CHALLENGE_FIXTURE = Object.freeze(SENTENCE_CHALLENGE_CONTENT.map(({ id, chunks, explanation }) =>
  Object.freeze({ ...fixture(id, chunks), prompt: '言葉のまとまりを正しい順に並べてください。', explanation })));

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

const sameOrder = (left, right) => left.every((value, index) => value === right[index]);

export function generateSentenceOrderQuestions({ sessionId, random = Math.random, sentenceLevel = 'standard', reviewContentIds, history } = {}) {
  if (typeof sessionId !== 'string' || !sessionId) throw new TypeError('sessionId is required');
  if (typeof random !== 'function') throw new TypeError('random must be a function');
  if (!['standard', 'challenge'].includes(sentenceLevel)) throw new TypeError('Unknown sentence level');
  const review = Array.isArray(reviewContentIds) ? [...SENTENCE_ORDER_FIXTURE, ...SENTENCE_CHALLENGE_FIXTURE].filter(entry => reviewContentIds.includes(entry.fixtureId)).slice(0, 10) : [];
  const selected = review.length ? review : selectLearningEntries(
    shuffled(sentenceLevel === 'challenge' ? SENTENCE_CHALLENGE_FIXTURE : SENTENCE_ORDER_FIXTURE, random), history, undefined, entry => entry.fixtureId);
  return Object.freeze(selected.map((entry, index) => {
    let initialOrder = shuffled(entry.correctOrder, random);
    // A correct initial layout would bypass the interaction being probed. Rotate once,
    // without retrying or consuming more random values, if Fisher-Yates returns identity.
    if (sameOrder(initialOrder, entry.correctOrder)) {
      initialOrder = [...initialOrder.slice(1), initialOrder[0]];
    }
    return Object.freeze({
      problemId: `${sessionId}:sentence:${index + 1}:${entry.fixtureId}`,
      fixtureId: entry.fixtureId,
      prompt: entry.prompt,
      chunks: entry.chunks,
      correctOrder: entry.correctOrder,
      initialOrder: Object.freeze(initialOrder),
      skillId: entry.skillId,
      ...(entry.explanation || review.length ? { explanation: entry.explanation || '正しい文を声に出して読み、言葉のつながりをたしかめよう。' } : {}),
    });
  }));
}
