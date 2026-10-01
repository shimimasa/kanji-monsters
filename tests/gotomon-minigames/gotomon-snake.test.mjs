import test from 'node:test';
import assert from 'node:assert/strict';
import { createSnakeGame, pickSnakeWords, SNAKE_RULES as R } from '../../src/minigames/gotomonSnake/snakeGame.js';
import { createQuizWorld } from '../../src/minigames/gameplay/quizWorlds.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

function newSnake({ seed = 3, pace = 'normal' } = {}) {
  const events = [], sessionId = `snk${seed}`;
  const game = createSnakeGame({ sessionId, random: seeded(seed), pace, onEvent: event => events.push(event), content: null });
  assert.equal(game.enter(), true);
  const turn = to => game.dispatch({ type: 'turn', payload: { sessionId, attemptId: game.snapshot().attemptId, to } });
  const next = () => game.dispatch({ type: 'next', payload: { sessionId } });
  // Steers toward a letter along the shorter way round the wrapping board.
  const steerTo = letterWanted => {
    const s = game.snapshot(), head = s.snake[0], token = s.tokens.find(t => t.letter === letterWanted(s));
    if (!token) return;
    let dc = token.c - head.c, dr = token.r - head.r;
    if (Math.abs(dc) > R.columns / 2) dc -= Math.sign(dc) * R.columns;
    if (Math.abs(dr) > R.rows / 2) dr -= Math.sign(dr) * R.rows;
    const to = dc !== 0 ? (dc > 0 ? 'right' : 'left') : (dr > 0 ? 'down' : 'up');
    if (to !== s.direction) turn(to);
  };
  const play = (ms, want = s => s.next) => { for (let t = 0; t < ms && game.snapshot().phase === 'answering'; t += 16) { steerTo(want); game.update(16); } };
  return { game, events, sessionId, turn, next, play };
}

test('eight short plain words are picked', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const words = pickSnakeWords({ random: seeded(seed) });
    assert.equal(words.length, R.words);
    assert.equal(new Set(words.map(w => w.word)).size, R.words);
    for (const w of words) { assert.match(w.word, /^[a-z]{3,6}$/); assert.ok(w.meaning); }
  }
});

test('the board always holds the next letter once, plus decoys, off the snake', () => {
  const { game, next, play } = newSnake({ seed: 4 });
  let checks = 0;
  while (game.snapshot().phase !== 'completed' && checks < 5000) {
    const s = game.snapshot();
    if (s.phase === 'answering') {
      assert.equal(s.tokens.filter(t => t.letter === s.next).length, 1, `${s.word.word}: next ${s.next}`);
      assert.ok(s.tokens.length >= R.decoys + 1);
      for (const t of s.tokens) assert.ok(!s.snake.slice(0, 1).some(cell => cell.c === t.c && cell.r === t.r));
      play(160);
    } else next();
    checks++;
  }
  assert.equal(game.snapshot().phase, 'completed');
});

test('eating letters in order spells the word; each joins the body; eight words end the run', () => {
  const { game, events, next, play } = newSnake({ seed: 5 });
  const first = game.snapshot().word.word;
  play(60 * 1000);
  const done = game.snapshot();
  assert.equal(done.phase, 'feedback');
  assert.deepEqual(done.snake.slice(1).map(cell => cell.letter).join(''), first);
  while (game.snapshot().phase !== 'completed') { if (game.snapshot().phase === 'feedback') next(); else play(60 * 1000); }
  const { result } = game.snapshot();
  assert.equal(result.answered, R.words);
  assert.equal(events.filter(event => ['correct', 'incorrect'].includes(event.type)).length, R.words);
  assert.equal(events.filter(event => event.type === 'sessionComplete').length, 1);
});

test('a wrong letter says so and lights the next one; the second wrong letter marks the word missed', () => {
  const { game, events, play } = newSnake({ seed: 6 });
  const decoy = st => st.tokens.find(t => t.letter !== st.next)?.letter;
  const slips = () => game.snapshot().lastSlip?.slip ?? 0;
  const eatWrong = () => { const was = slips(); for (let i = 0; i < 400 && slips() === was && game.snapshot().phase === 'answering'; i++) play(100, decoy); };
  const want = game.snapshot().next;
  eatWrong();
  let st = game.snapshot();
  assert.equal(st.lastSlip.expected, want);
  assert.equal(st.tokens.find(t => t.tokenId === st.hintTokenId)?.letter, st.next);
  assert.equal(events.filter(event => event.type === 'incorrect').length, 0, 'the first slip only warns');
  eatWrong();
  assert.equal(events.filter(event => event.type === 'incorrect').length, 1);
  assert.equal(game.snapshot().missed[0].word, st.word.word);
  eatWrong();
  assert.equal(events.filter(event => event.type === 'incorrect').length, 1, 'one result per word');
  play(60000);
  assert.equal(game.snapshot().phase, 'feedback');
  assert.equal(events.at(-1).type, 'spelled');
});

test('a wrong letter met by going straight on is told but not counted; one the snake turned toward is', () => {
  // Never turn: the snake runs straight and meets whatever lies in its rows; none of it counts.
  for (const seed of [2, 5, 9]) {
    const { game } = newSnake({ seed });
    for (let t = 0; t < 60000 && game.snapshot().phase === 'answering'; t += 16) game.update(16);
    const s = game.snapshot();
    if (s.lastSlip) assert.equal(s.lastSlip.counted, false, `seed ${seed}`);
    assert.equal(s.incorrect, 0, `seed ${seed}: straight runs are no spelling slips`);
  }
  // Turning toward wrong letters counts: the second one marks the word missed.
  const { game, play } = newSnake({ seed: 7 });
  play(60000, st => st.tokens.find(t => t.letter !== st.next)?.letter);
  assert.equal(game.snapshot().incorrect, 1);
});

test('edges wrap and the body can be crossed: the snake never crashes; ゆっくり is slower; pause stops it', () => {
  const { game, turn } = newSnake({ seed: 7 });
  turn('left');
  for (let i = 0; i < 400 && game.snapshot().phase === 'answering'; i++) {
    game.update(50);
    const head = game.snapshot().snake[0];
    assert.ok(head.c >= 0 && head.c < R.columns && head.r >= 0 && head.r < R.rows);
  }
  const fast = newSnake({ seed: 9 }), slow = newSnake({ seed: 9, pace: 'slow' });
  const moved = g => { const a = g.game.snapshot().snake[0]; for (let i = 0; i < 30; i++) g.game.update(50); const b = g.game.snapshot().snake[0]; return Math.abs(b.c - a.c) + Math.abs(b.r - a.r); };
  assert.ok(moved(slow) < moved(fast));
  fast.game.setPaused(true); const at = fast.game.snapshot().snake[0]; fast.game.update(5000);
  assert.deepEqual(fast.game.snapshot().snake[0], at);
});

test('old attempts, bad directions and paused turns are refused', () => {
  const { game, sessionId, turn } = newSnake({ seed: 10 });
  assert.equal(turn('sideways'), false);
  game.setPaused(true); assert.equal(turn('up'), false); game.setPaused(false);
  assert.equal(game.dispatch({ type: 'turn', payload: { sessionId, attemptId: 'old', to: 'up' } }), false);
  assert.equal(createSnakeGame({ sessionId: 'x', content: { words: [] } }).enter(), false);
});

test('the snake world counts spelled words', () => {
  const world = createQuizWorld('snake', growthStatus().effects);
  world.context({ mode: 'snake', phase: 'answering', problem: { problemId: 'p' } });
  world.answer(true, {}, 1); world.answer(false, {}, 0);
  assert.match(world.snapshot().summary, /英単語を2語つづった · まちがいなし 1語/);
});
