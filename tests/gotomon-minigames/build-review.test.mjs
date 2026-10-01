import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSlashProblems } from '../../src/minigames/gotomonSlash/slashContent.js';
import { createSlashGame } from '../../src/minigames/gotomonSlash/slashGame.js';
import { createOthelloGame } from '../../src/minigames/gotomonOthello/othelloGame.js';
import { buildTarget, buildTiles, createBuildReview, BUILD_REVIEW as R } from '../../src/minigames/buildReview.js';
import { lookalikesOf } from '../../src/minigames/gotomonTrace/traceGame.js';

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
        if (mode === 'math') { assert.equal(target.answer, answerOf(item)); assert.equal(target.script, 'digits'); }
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
  assert.equal(om.build.sentence, s.problem.sentence);
});
