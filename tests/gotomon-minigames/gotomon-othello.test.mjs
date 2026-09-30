import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSlashProblems } from '../../src/minigames/gotomonSlash/slashContent.js';
import { createOthelloGame, flipsFor, movesFor, OTHELLO_RULES as R } from '../../src/minigames/gotomonOthello/othelloGame.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const grade1 = JSON.parse(readFileSync(new URL('../../public/data/kanji_g1_proto.json', import.meta.url), 'utf8'));
const N = R.size;

function newOthello({ seed = 3 } = {}) {
  const events = [], sessionId = `oth${seed}`;
  const problems = [...buildSlashProblems({ sessionId: 'a', random: seeded(seed), mode: 'kanji', gradeKanji: grade1 }),
    ...buildSlashProblems({ sessionId: 'b', random: seeded(seed + 50), mode: 'kanji', gradeKanji: grade1 })];
  const game = createOthelloGame({ sessionId, random: seeded(seed + 1), onEvent: event => events.push(event), content: { problems } });
  assert.equal(game.enter(), true);
  const answer = (right = true) => { const s = game.snapshot(); const id = right ? s.problem.correctChoiceId : s.problem.choices.find(c => c.choiceId !== s.problem.correctChoiceId).choiceId; return game.dispatch({ type: 'answer', payload: { sessionId, attemptId: s.attemptId, choiceId: id } }); };
  const place = move => game.dispatch({ type: 'place', payload: { sessionId, attemptId: game.snapshot().attemptId, row: move.row, column: move.column } });
  const rival = () => { for (let t = 0; t < 5000 && game.snapshot().phase === 'rival'; t += 100) game.update(100); };
  return { game, events, answer, place, rival, sessionId };
}
const boardOf = rows => rows.join('').split('').map(ch => ch === 'o' ? 'me' : ch === 'x' ? 'rival' : ch === '*' ? 'star' : null);

test('flips follow Othello: every line closed by the player turns; stars close lines and are never turned', () => {
  const board = boardOf(['......', '......', '..xo..', '..ox..', '......', '......']);
  assert.deepEqual(flipsFor(board, 1, 2, 'me').sort(), [14]);
  assert.deepEqual(flipsFor(board, 2, 2, 'me'), [], 'a taken square is no move');
  assert.equal(movesFor(board, 'me').length, 4);
  const long = boardOf(['oxxxx.', '......', '......', '......', '......', '......']);
  assert.deepEqual(flipsFor(long, 0, 5, 'me').sort((a, b) => a - b), [1, 2, 3, 4]);
  const star = boardOf(['*xx...', '......', '......', '......', '......', '......']);
  assert.deepEqual(flipsFor(star, 0, 3, 'me').sort((a, b) => a - b), [1, 2], 'a star closes the child\'s line');
  const guarded = boardOf(['x*o...', '......', '......', '......', '......', '......']);
  assert.deepEqual(flipsFor(guarded, 0, 3, 'rival'), [], 'the rival cannot turn a star');
});

test('a right answer lets the child place on a square that turns stones; then the rival plays', () => {
  const { game, events, answer, place, rival } = newOthello();
  let s = game.snapshot();
  assert.equal(s.phase, 'answering'); assert.equal(s.mine, 2); assert.equal(s.theirs, 2);
  assert.equal(answer(), true);
  s = game.snapshot();
  assert.equal(s.phase, 'placing'); assert.ok(s.legal.length > 0);
  assert.equal(place({ row: 0, column: 0 }), false, 'a square that turns nothing is refused');
  assert.equal(place(s.legal[0]), true);
  s = game.snapshot();
  assert.equal(s.mine, 4); assert.equal(s.theirs, 1); assert.equal(s.phase, 'rival');
  rival();
  s = game.snapshot();
  assert.equal(s.phase, 'answering'); assert.equal(s.lastMove.by, 'rival');
  assert.deepEqual(events.filter(e => e.type !== 'problemPresented').map(e => e.type), ['correct', 'placed']);
});

test('a slip shows the answer and the turn goes to the rival; two right in a row make a star stone', () => {
  const { game, answer, place, rival } = newOthello({ seed: 8 });
  assert.equal(answer(false), true);
  let s = game.snapshot();
  assert.equal(s.phase, 'rival'); assert.equal(s.incorrect, 1); assert.ok(s.lastAnswer.answerText);
  rival();
  answer(); place(game.snapshot().legal[0]); rival();
  assert.equal(game.snapshot().starNext, false);
  answer();
  s = game.snapshot();
  assert.equal(s.starNext, true, 'the second right answer in a row');
  const move = s.legal[0];
  place(move);
  s = game.snapshot();
  assert.equal(s.board[move.row * N + move.column], 'star'); assert.equal(s.stars, 1);
});

test('whole games end with the board full, no moves, or twenty questions; the rival never takes the last stone', () => {
  for (const accuracy of [1, 0.6, 0]) {
    for (let seed = 1; seed <= 25; seed++) {
      const { game, events, answer, place, rival } = newOthello({ seed });
      const r = seeded(seed + 200);
      let guard = 0;
      while (game.snapshot().phase !== 'completed' && guard++ < 400) {
        const s = game.snapshot();
        if (s.phase === 'answering') answer(r() < accuracy);
        else if (s.phase === 'placing') place(s.legal[Math.floor(r() * s.legal.length)]);
        else rival();
        assert.ok(game.snapshot().mine > 0 || game.snapshot().phase === 'completed', 'the child keeps a stone');
      }
      const end = game.snapshot();
      assert.equal(end.phase, 'completed');
      assert.ok(end.board.every(Boolean) || end.answered >= R.maxQuestions || (!movesFor(end.board, 'me').length && !movesFor(end.board, 'rival').length), `${accuracy} ${seed}`);
      assert.ok(end.answered <= R.maxQuestions);
      assert.ok(end.mine > 0);
      assert.equal(end.result.outcome, end.mine > end.theirs ? 'win' : end.mine === end.theirs ? 'draw' : 'lose');
      assert.equal(events.at(-1).type, 'sessionComplete');
      const ids = events.filter(e => ['correct', 'incorrect'].includes(e.type)).map(e => e.problemId);
      assert.equal(new Set(ids).size, ids.length);
    }
  }
});

test('answering well mostly wins (simulated)', () => {
  const wins = accuracy => {
    let won = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const { game, answer, place, rival } = newOthello({ seed });
      const r = seeded(seed + 900);
      while (game.snapshot().phase !== 'completed') {
        const s = game.snapshot();
        if (s.phase === 'answering') answer(r() < accuracy); else if (s.phase === 'placing') place(s.legal[Math.floor(r() * s.legal.length)]); else rival();
      }
      if (game.snapshot().result.outcome === 'win') won++;
    }
    return won / 60;
  };
  const all = wins(1), most = wins(0.8), half = wins(0.5);
  assert.ok(all >= 0.85, `all right ${all}`);
  assert.ok(most >= 0.6, `most right ${most}`);
  assert.ok(half < all, 'answers matter');
});

test('commands are refused out of turn, while paused, with a stale attempt, or from another session', () => {
  const { game, sessionId } = newOthello();
  const s = game.snapshot();
  const send = payload => game.dispatch({ type: 'answer', payload: { sessionId, attemptId: s.attemptId, choiceId: s.problem.correctChoiceId, ...payload } });
  assert.equal(game.dispatch({ type: 'place', payload: { sessionId, attemptId: s.attemptId, row: 1, column: 2 } }), false, 'no placing before answering');
  assert.equal(send({ sessionId: 'x' }), false);
  assert.equal(send({ attemptId: 'stale' }), false);
  assert.equal(send({ choiceId: 'nope' }), false);
  game.setPaused(true);
  assert.equal(send({}), false);
  game.setPaused(false);
  assert.equal(send({}), true);
  game.exit();
  assert.equal(game.snapshot().aborted, true);
  assert.equal(createOthelloGame({ sessionId: 's', content: null }).enter(), false);
});
