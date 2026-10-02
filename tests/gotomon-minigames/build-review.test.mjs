import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSlashProblems } from '../../src/minigames/gotomonSlash/slashContent.js';
import { createSlashGame } from '../../src/minigames/gotomonSlash/slashGame.js';
import { createOthelloGame } from '../../src/minigames/gotomonOthello/othelloGame.js';
import { buildTarget, buildTiles, createBuildReview, readingTarget, wordTarget, equationTarget, BUILD_REVIEW as R } from '../../src/minigames/buildReview.js';
import { createTossGame } from '../../src/minigames/gotomonToss/tossGame.js';
import { buildTossProblems } from '../../src/minigames/gotomonToss/tossContent.js';
import { createPhotoRallyGame } from '../../src/minigames/photoRally/photoRallyGame.js';
import { buildPhotoRally } from '../../src/minigames/photoRally/photoRallyContent.js';
import { createEnglishChoiceGame } from '../../src/minigames/englishChoice/englishChoiceGame.js';
import { createTimedChoiceGame } from '../../src/minigames/timedChoice/timedChoiceGame.js';
import { lookalikesOf } from '../../src/minigames/gotomonTrace/traceGame.js';
import { partsTarget, placeTarget, proverbTarget, kanjiSplits } from '../../src/minigames/buildReview.js';
import { PROVERB_SPLITS } from '../../src/minigames/proverbDetective/proverbDetectiveGame.js';
import { KANJI_PARTS } from '../../src/minigames/gotomonParts/partsData.js';
import { PREFECTURES } from '../../src/minigames/gotomonDelivery/prefectures.js';
import { PROVERB_CASES } from '../../src/minigames/proverbDetective/proverbCases.js';
import { buildDrumQuestions } from '../../src/minigames/gotomonDrum/drumContent.js';
import { buildLinkRounds } from '../../src/minigames/gotomonLink/linkContent.js';
import { linkBuildTarget } from '../../src/minigames/gotomonLink/linkGame.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const grade1 = JSON.parse(readFileSync(new URL('../../public/data/kanji_g1_proto.json', import.meta.url), 'utf8'));
const answerOf = item => item.plates.find(p => p.plateId === item.answerId).text;
const missedOf = (items, chosen = 'x') => items.map(item => ({ contentId: item.contentId, chosen, build: buildTarget(item) }));
// Taps the cards of `word` in order (the first unused card with each letter).
const spell = (review, word) => {
  for (const ch of word) {
    const s = review.snapshot();
    const k = s.tiles.findIndex((t, i) => t === ch && !s.placed.includes(i));
    assert.ok(k >= 0, `card ${ch}`);
    assert.equal(review.place(k), true);
  }
};

test('every shared question of the three subjects gives an answer to build and a table holding its letters', () => {
  let count = 0, look = 0, letters = 0;
  for (const mode of ['kanji', 'english', 'math']) {
    for (let seed = 1; seed <= 30; seed++) {
      for (const item of buildSlashProblems({ sessionId: 's', random: seeded(seed), mode, gradeKanji: grade1 })) {
        const target = buildTarget(item);
        assert.ok(target?.answer, `${mode} ${item.prompt}`);
        if (mode === 'kanji') { assert.equal(target.answer, answerOf(item)); assert.equal(target.script, 'kana'); assert.equal(target.prompt, item.prompt); assert.ok(target.sentence); }
        if (mode === 'math') { assert.equal(target.answer, `${item.prompt.replace(' = ?', '').replaceAll(' ', '')}=${answerOf(item)}`); assert.equal(target.script, 'equation'); }
        if (mode === 'english') { assert.equal(target.script, 'letters'); assert.match(target.answer, /^[a-z]+$/); assert.match(target.prompt, /は英語で？$/); }
        const tiles = buildTiles(target, seeded(seed + 7));
        const answer = [...target.answer];
        assert.equal(tiles.length, answer.length + R.extra, 'the answer and four other cards');
        const rest = [...tiles];
        for (const ch of answer) rest.splice(rest.indexOf(ch), 1);
        assert.equal(rest.length, R.extra, 'every letter of the answer is on the table');
        assert.equal(new Set(rest).size, R.extra);
        assert.ok(rest.every(ch => !answer.includes(ch)), 'the other cards never repeat a letter of the answer');
        if (mode !== 'math' && rest.some(ch => answer.some(a => lookalikesOf(a, target.script).includes(ch)))) look++;
        if (mode === 'math') assert.ok(rest.some(ch => '+−×'.includes(ch)), 'a number sentence table holds another sign');
        count++; letters += answer.length;
      }
    }
  }
  assert.equal(count, 1080);
  // For the record: how often a kana/letter table holds a look-alike (か/が, b/d …) of the answer.
  assert.ok(look / 720 > 0.8, `look-alike on ${look} of 720 tables`);
  console.log(`build review: ${count} questions, ${(letters / count).toFixed(2)} letters on average, look-alikes on ${look}/720 kana and letter tables`);
});

test('the right letters in order solve a question; next goes on and the end says done', () => {
  const items = buildSlashProblems({ sessionId: 's', random: seeded(4), mode: 'kanji', gradeKanji: grade1 }).slice(0, 2);
  const review = createBuildReview({ missed: missedOf(items), random: seeded(9) });
  let s = review.snapshot();
  assert.equal(s.status, 'building'); assert.equal(s.total, 2); assert.equal(s.length, [...answerOf(items[0])].length);
  assert.equal(s.hintTile, -1, 'no help before a try'); assert.equal(s.shownAnswer, null);
  assert.equal(review.next(), false, 'cannot skip before it is built');
  spell(review, answerOf(items[0]));
  s = review.snapshot();
  assert.equal(s.status, 'solved'); assert.equal(s.shownAnswer, answerOf(items[0])); assert.equal(s.firstTry, 1);
  assert.equal(review.place(0), false, 'no more cards after it is solved');
  assert.equal(review.next(), true);
  spell(review, answerOf(items[1]));
  assert.equal(review.next(), true);
  s = review.snapshot();
  assert.equal(s.status, 'done'); assert.equal(s.solved, 2); assert.equal(s.firstTry, 2);
});

test('a wrong row keeps the right letters, says which letter differs, and the next card glows; two wrong rows show the answer', () => {
  const items = buildSlashProblems({ sessionId: 's', random: seeded(5), mode: 'english' });
  const item = items.find(it => buildTarget(it).answer.length >= 4);
  const review = createBuildReview({ missed: missedOf([item]), random: seeded(2) });
  const answer = buildTarget(item).answer;
  let s = review.snapshot();
  // The first two letters right, then a card that is not in the answer.
  spell(review, answer.slice(0, 2));
  s = review.snapshot();
  const wrong = s.tiles.findIndex(ch => !answer.includes(ch));
  assert.equal(review.place(wrong), true);
  while (!review.snapshot().last && review.snapshot().status === 'building') {
    const t = review.snapshot();
    review.place(t.tiles.findIndex((_, i) => !t.placed.includes(i)));
  }
  s = review.snapshot();
  assert.equal(s.status, 'building');
  assert.equal(s.last.correct, false); assert.equal(s.last.wrongAt, 3); assert.equal(s.last.expected, answer[2]);
  assert.equal(s.word, answer.slice(0, 2), 'the right letters stay');
  assert.equal(s.tiles[s.hintTile], answer[2], 'the next card glows');
  assert.equal(s.shownAnswer, null, 'the answer is not shown after one wrong row');
  // Take back a card: the slots close up.
  assert.equal(review.unplace(0), true);
  assert.equal(review.snapshot().word, answer.slice(1, 2));
  assert.equal(review.unplace(5), false);
  // A second wrong row from the start.
  review.unplace(0);
  while (review.snapshot().tries < 2 && review.snapshot().status === 'building') {
    const t = review.snapshot(), k = t.tiles.findIndex((ch, i) => !t.placed.includes(i) && ch !== answer[t.placed.length]);
    review.place(k >= 0 ? k : t.tiles.findIndex((_, i) => !t.placed.includes(i)));
  }
  s = review.snapshot();
  assert.equal(s.tries, 2); assert.equal(s.shownAnswer, answer);
  spell(review, answer.slice(s.placed.length));
  s = review.snapshot();
  assert.equal(s.status, 'solved'); assert.equal(s.firstTry, 0);
  // Ending on a question that took two rows (the panel reads the snapshot once more).
  assert.equal(review.next(), true);
  s = review.snapshot();
  assert.equal(s.status, 'done'); assert.equal(s.shownAnswer, null); assert.equal(s.tries, 0);
});

test('at most four questions come back, each once; without a build nothing is shown', () => {
  const items = buildSlashProblems({ sessionId: 's', random: seeded(6), mode: 'math' });
  const missed = missedOf([items[0], items[0], ...items.slice(1, 8)]);
  assert.equal(createBuildReview({ missed, random: seeded(1) }).snapshot().total, R.max);
  assert.equal(createBuildReview({ missed: [{ contentId: 'a', chosen: '3' }] }).snapshot().status, 'done');
  assert.equal(createBuildReview().snapshot().total, 0);
  assert.equal(buildTarget({ plates: [{ plateId: 'a', text: 'x' }], answerId: 'b' }), null);
});

test('games carry the build target in their missed list (slash: the content item; othello: its problem)', () => {
  const sessionId = 'sb', problems = buildSlashProblems({ sessionId, random: seeded(3), mode: 'kanji', gradeKanji: grade1 });
  const slash = createSlashGame({ sessionId, random: seeded(4), content: { problems } });
  assert.equal(slash.enter(), true);
  let ball = null;
  for (let t = 0; t < 6000 && !ball; t += 16) { ball = slash.snapshot().balls.find(b => b.state === 'flying' && b.plateId !== slash.snapshot().problem.answerId && b.y < 0.85); if (!ball) slash.update(16); }
  const asked = slash.snapshot().problem;
  assert.equal(slash.dispatch({ type: 'slash', payload: { sessionId, attemptId: slash.snapshot().attemptId, x1: ball.x - 0.12, y1: ball.y, x2: ball.x + 0.12, y2: ball.y } }), true);
  const [miss] = slash.snapshot().missed;
  const item = problems.find(p => p.contentId === asked.contentId);
  assert.equal(miss.build.answer, answerOf(item));
  assert.equal(miss.build.prompt, item.prompt);

  const both = [...problems, ...buildSlashProblems({ sessionId: 'b', random: seeded(53), mode: 'kanji', gradeKanji: grade1 })];
  const othello = createOthelloGame({ sessionId: 'ob', random: seeded(4), content: { problems: both } });
  assert.equal(othello.enter(), true);
  const s = othello.snapshot();
  const wrong = s.problem.choices.find(c => c.choiceId !== s.problem.correctChoiceId);
  assert.equal(othello.dispatch({ type: 'answer', payload: { sessionId: 'ob', attemptId: s.attemptId, choiceId: wrong.choiceId } }), true);
  const [om] = othello.snapshot().missed;
  assert.equal(om.build.answer, s.problem.choices.find(c => c.choiceId === s.problem.correctChoiceId).text);
  assert.equal(om.build.sentence.before, s.problem.sentence.before); assert.equal(om.build.sentence.after, s.problem.sentence.after);
});

test('math builds the whole number sentence; + and × may be turned round, − may not', () => {
  const add = equationTarget({ question: '6 + 9', answer: 15, others: [14, 16, 3] });
  assert.equal(add.answer, '6+9=15'); assert.deepEqual([...add.accept], ['9+6=15']); assert.equal(add.script, 'equation');
  assert.equal(add.prompt, '「6 + 9」の しきと こたえを ならべよう'); assert.equal(add.explain, '6 + 9 = 15');
  assert.deepEqual([...equationTarget({ question: '15 − 9 = ?', answer: '6' }).accept], []);
  assert.deepEqual([...equationTarget({ question: '3×3', answer: 9 }).accept], [], 'the same both ways is one answer');
  assert.equal(equationTarget({ question: '7×8', answer: 56 }).answer, '7×8=56');
  assert.equal(equationTarget({ question: '6 + 9', answer: 14 }), null, 'a sum that does not add up is never taught');
  assert.equal(equationTarget({ question: '15', answer: 15 }), null);
  assert.equal(readingTarget({ word: '山', reading: 'yama' }), null);
  assert.equal(wordTarget({ meaning: 'りんご', word: 'ice cream' }), null);

  // Turned round is right; a wrong sign says which card differs and the right sign glows.
  const review = createBuildReview({ missed: [{ contentId: 'a', chosen: '14', build: add }, { contentId: 'b', build: add }], random: seeded(3) });
  spell(review, '9+6=15');
  let s = review.snapshot();
  assert.equal(s.status, 'solved'); assert.equal(s.shownAnswer, '9+6=15'); assert.equal(s.firstTry, 1);
  review.next();
  spell(review, '6');
  const t = review.snapshot(), minus = t.tiles.findIndex(ch => ch === '−' || ch === '×');
  assert.ok(minus >= 0, 'another sign is on the table');
  review.place(minus);
  spell(review, '9=15');
  s = review.snapshot();
  assert.equal(s.last.correct, false); assert.equal(s.last.wrongAt, 2); assert.equal(s.last.expected, '+');
  assert.equal(s.word, '6'); assert.equal(s.tiles[s.hintTile], '+');
  spell(review, '+9=15');
  assert.equal(review.snapshot().status, 'solved');
});

test('the other choice games carry what to build: photo rally, word reading, English words and the toss game', () => {
  const kanji = Object.fromEntries(grade1.map(k => [k.id, k]));
  const stage = { stageId: 's', grade: 1, kanjiPoolIdList: grade1.slice(0, 30).map(k => k.id) };
  const rally = buildPhotoRally({ sessionId: 'r', stage, random: seeded(2), stageKanji: stage.kanjiPoolIdList.map(id => kanji[id]), gradeKanji: grade1,
    monsters: Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, name: `m${i}` })) });
  const photo = createPhotoRallyGame({ sessionId: 'r', content: rally });
  assert.equal(photo.enter(), true);
  let p = photo.snapshot().problem, wrong = p.choices.find(c => c.choiceId !== p.correctChoiceId);
  photo.dispatch({ type: 'answer', payload: { sessionId: 'r', problemId: p.problemId, attemptId: photo.snapshot().attemptId, choiceId: wrong.choiceId } });
  let m = photo.snapshot().missed[0];
  assert.equal(m.build.answer, p.reading); assert.equal(m.build.sentence.before, p.before); assert.equal(m.chosen, wrong.text);
  assert.ok([...m.build.decoys].every(ch => [...wrong.text, ...p.choices.flatMap(c => [...c.text])].includes(ch)));

  for (const [create, check] of [[createTimedChoiceGame, (b, q, right) => { assert.equal(b.answer, right); assert.equal(b.prompt, q.prompt); }],
    [createEnglishChoiceGame, (b, q, right) => { assert.equal(b.answer, q.prompt.toLowerCase()); assert.equal(b.prompt, `「${right}」は英語で？`); }]]) {
    const game = create({ sessionId: 'c' }); game.enter();
    const s = game.snapshot(), q = s.problem, bad = q.choices.find(c => c.choiceId !== q.correctChoiceId);
    game.answer({ sessionId: s.sessionId, problemId: q.problemId, attemptId: s.attemptId, choiceId: bad.choiceId });
    check(game.snapshot().missed[0].build, q, q.choices.find(c => c.choiceId === q.correctChoiceId).text);
  }

  const problems = buildTossProblems({ sessionId: 't', random: seeded(5) });
  const toss = createTossGame({ sessionId: 't', random: seeded(6), content: { carriers: [], problems } });
  assert.equal(toss.enter(), true);
  const ts = toss.snapshot(), basket = ts.baskets?.find(b => b.basketId !== ts.problem.correctChoiceId);
  toss.dispatch({ type: 'throw', payload: { sessionId: 't', attemptId: ts.attemptId, basketId: basket.basketId } });
  m = toss.snapshot().missed[0];
  assert.equal(m.build.answer, `${problems[0].question.replaceAll(' ', '')}=${problems[0].answer}`);
});

test('for the record: how many questions of each source can come back to build', () => {
  const count = { kanji: [0, 0], english: [0, 0], math: [0, 0] };
  for (let seed = 1; seed <= 20; seed++) for (const mode of ['kanji', 'english', 'math'])
    for (const item of buildSlashProblems({ sessionId: 's', random: seeded(seed), mode, gradeKanji: grade1 })) { count[mode][1]++; if (buildTarget(item)) count[mode][0]++; }
  for (const [mode, [made, all]] of Object.entries(count)) assert.equal(made, all, mode);
  let times = 0;
  for (let seed = 1; seed <= 20; seed++) for (const item of buildTossProblems({ sessionId: 't', random: seeded(seed), level: 'times' })) {
    assert.ok(equationTarget({ question: item.question, answer: item.answer })); times++;
  }
  assert.equal(times, 240);
});

test('the rest: every proverb, kanji-parts row and prefecture can be built, with four other cards on the table', () => {
  const table = (target, seed) => {
    const tiles = buildTiles(target, seeded(seed)), rest = [...tiles];
    for (const ch of target.answer) rest.splice(rest.indexOf(ch), 1);
    assert.equal(rest.length, R.extra, target.answer); assert.equal(new Set(rest).size, R.extra);
    assert.ok(rest.every(ch => ![...target.answer].includes(ch)));
    return tiles;
  };
  let longest = 0;
  for (const [i, item] of PROVERB_CASES.entries()) {
    const t = proverbTarget({ text: item.text, reading: item.reading, meaning: item.meaning, split: PROVERB_SPLITS[item.id] });
    assert.ok(t?.frame, item.text); table(t, i + 1); longest = Math.max(longest, [...t.answer].length);
  }
  const allParts = [...new Set(KANJI_PARTS.flatMap(item => item.parts))];
  for (const [i, item] of KANJI_PARTS.entries()) {
    const t = partsTarget({ ...item, others: [allParts[i % allParts.length]], fill: allParts });
    assert.ok(t, item.kanji); assert.equal(t.answer, item.parts.join('')); table(t, i + 1);
  }
  const names = PREFECTURES.map(p => p.fullName);
  for (const [i, p] of PREFECTURES.entries()) {
    const t = placeTarget({ name: 'ゴトモン', fullName: p.fullName, others: names.slice(i, i + 3), fill: names });
    assert.equal(t.answer, p.fullName); table(t, i + 1);
  }
  assert.equal(partsTarget({ kanji: '休', parts: ['亻', '木'], layout: 'x' }), null);
  console.log(`build review: ${PROVERB_CASES.length} proverbs (longest reading ${longest} kana), ${KANJI_PARTS.length} kanji parts, ${PREFECTURES.length} prefectures`);
});

test('the rest: the drum and the link game carry what to build for every question that has one', () => {
  for (const mode of ['kanji', 'english', 'math']) {
    for (let seed = 1; seed <= 10; seed++) {
      assert.ok(buildDrumQuestions({ sessionId: 'd', random: seeded(seed), mode, gradeKanji: grade1 }).every(q => q.build?.answer), `drum ${mode}`);
      for (const round of buildLinkRounds({ random: seeded(seed), mode, gradeKanji: grade1 })) {
        for (const pair of round.pairs) {
          const t = linkBuildTarget(round.kind, pair);
          if (round.kind === 'meaning') assert.equal(t, null);
          else assert.ok(t?.answer, `${mode} ${round.kind} ${pair.left}`);
        }
      }
    }
  }
});

test('proverbs: only the kanji are built, the written kana stay; the three that split two ways are settled by hand', () => {
  const twoWays = PROVERB_CASES.filter(p => kanjiSplits(p.text, p.reading).ways.length !== 1).map(p => p.id);
  assert.deepEqual(twoWays, Object.keys(PROVERB_SPLITS).map(Number), 'every proverb has one split, or one chosen by hand');
  let all = 0, built = 0;
  for (const p of PROVERB_CASES) {
    const t = proverbTarget({ text: p.text, reading: p.reading, meaning: p.meaning, split: PROVERB_SPLITS[p.id] });
    let k = 0; const letters = [...t.answer];
    assert.equal(t.frame.map(part => part.kana ?? letters.slice(k, k += part.size).join('')).join(''), p.reading, p.text);
    assert.equal(t.frame.filter(part => part.kanji).map(part => part.kanji).join(''), p.text.replace(/[ぁ-んー]/g, ''));
    all += p.reading.length; built += letters.length;
  }
  const oni = proverbTarget({ text: '鬼に金棒', reading: 'おににかなぼう', split: PROVERB_SPLITS[11] });
  assert.deepEqual(oni.frame.map(p => p.size ?? p.kana), [2, 'に', 4]);
  assert.equal(proverbTarget({ text: '鬼に金棒', reading: 'おににかなぼう' }).frame, null, 'two ways and no choice: the whole reading');
  console.log(`build review: proverbs ${(all / PROVERB_CASES.length).toFixed(1)} → ${(built / PROVERB_CASES.length).toFixed(1)} letters to build on average`);
});
