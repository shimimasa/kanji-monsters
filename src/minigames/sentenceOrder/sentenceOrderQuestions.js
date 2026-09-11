// Small, self-authored probe fixture. This is not a canonical Japanese curriculum.
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
  fixture('library-book', ['わたしは', 'きのう', '図書館で', '本を', '読みました。']),
  fixture('morning-bird', ['朝早く', '小鳥が', '庭の木で', '鳴いていました。']),
  fixture('science-observe', ['理科の時間に', 'みんなで', '植物の成長を', '観察しました。']),
  fixture('umbrella-rain', ['雨が', '降りそうなので', '青いかさを', '持っていきます。']),
  fixture('river-clean', ['地域の人たちが', '日曜日に', '川辺を', 'きれいにしました。']),
  fixture('train-trip', ['わたしたちは', '電車に乗って', '海の近くまで', '出かけました。']),
  fixture('curry-help', ['弟は', '夕食のカレーを', '作るのを', '手伝いました。']),
  fixture('stars-visible', ['雲が晴れると', '夜空に', 'たくさんの星が', '見えました。']),
  fixture('meeting-opinion', ['話し合いで', '一人ずつ', '自分の考えを', '発表しました。']),
  fixture('sports-water', ['運動した後は', '水分を', '少しずつ', 'とりましょう。']),
  fixture('museum-note', ['博物館で', '気づいたことを', 'ノートに', '書き留めました。']),
  fixture('wind-laundry', ['強い風が', '吹いたので', '母は', '洗濯物を', '取りこみました。']),
  fixture('garden-seed', ['春になったら', '学校の花だんに', 'ひまわりの種を', 'まきます。']),
  fixture('map-route', ['地図を見ながら', '駅までの道を', '友だちに', '説明しました。']),
  fixture('lunch-thanks', ['給食を作った人へ', '感謝の気持ちをこめて', '手紙を', '書きました。']),
  fixture('festival-drum', ['祭りが始まると', '広場から', '太鼓の音が', '聞こえてきました。']),
  fixture('recycle-paper', ['使い終わった紙を', '種類ごとに', '分けて', '回収箱へ', '入れました。']),
  fixture('shadow-change', ['太陽が動くにつれて', '校庭の木の影も', '少しずつ', '変わりました。']),
  fixture('recipe-check', ['料理を始める前に', '必要な材料を', 'もう一度', '確かめました。']),
  fixture('promise-arrive', ['約束の時刻に', '間に合うように', '家を', '早めに', '出ました。']),
]);

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

export function generateSentenceOrderQuestions({ sessionId, random = Math.random } = {}) {
  if (typeof sessionId !== 'string' || !sessionId) throw new TypeError('sessionId is required');
  if (typeof random !== 'function') throw new TypeError('random must be a function');
  const selected = shuffled(SENTENCE_ORDER_FIXTURE, random).slice(0, 10);
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
    });
  }));
}
