import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLinkRounds, LINK_PAIRS } from '../../src/minigames/gotomonLink/linkContent.js';
import { createLinkGame, LINK_CLEAR_MS } from '../../src/minigames/gotomonLink/linkGame.js';

const seeded = seed => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const grade1 = JSON.parse(readFileSync(new URL('../../public/data/kanji_g1_proto.json', import.meta.url), 'utf8'));
const valueOf = label => label.includes('+') ? label.split('+').reduce((a, b) => a + Number(b), 0) : label.split('−').map(Number).reduce((a, b) => a - b);

function newLink({ seed = 3, mode = 'kanji' } = {}) {
  const events = [], sessionId = `lnk${seed}`;
  const rounds = buildLinkRounds({ random: seeded(seed), mode, gradeKanji: grade1 });
  const game = createLinkGame({ sessionId, random: seeded(seed + 1), onEvent: event => events.push(event), content: { rounds } });
  assert.equal(game.enter(), true);
  const link = (left, right) => game.dispatch({ type: 'link', payload: { sessionId, attemptId: game.snapshot().attemptId, leftId: left.leftId, rightId: right.rightId } });
  const fitting = left => game.snapshot().rights.find(r => r.pairId === left.pairId);
  const wrongFor = left => game.snapshot().rights.find(r => r.pairId !== left.pairId && !r.linked);
  return { game, events, rounds, link, fitting, wrongFor, sessionId };
}

test('each mode makes two boards of six pairs; on a board every right card fits one left card', () => {
  for (const mode of ['kanji', 'english', 'math']) {
    for (let seed = 1; seed <= 8; seed++) {
      const rounds = buildLinkRounds({ random: seeded(seed), mode, gradeKanji: grade1 });
      assert.equal(rounds.length, 2, mode);
      for (const board of rounds) {
        assert.equal(board.pairs.length, LINK_PAIRS, mode);
        assert.equal(new Set(board.pairs.map(p => p.right)).size, LINK_PAIRS, `${mode} rights`);
        assert.equal(new Set(board.pairs.map(p => p.left)).size, LINK_PAIRS, `${mode} lefts`);
        for (const pair of board.pairs) {
          assert.ok(pair.explain && pair.contentId, mode);
          if (mode === 'math') assert.equal(valueOf(pair.left), Number(pair.right), pair.left);
        }
      }
      if (mode === 'kanji') {
        assert.deepEqual(rounds.map(r => r.label), ['漢字と読み', '漢字と意味']);
        rounds[0].pairs.forEach(p => assert.ok(p.sentence && p.sentence.kanji === p.left));
        const lefts = rounds.flatMap(r => r.pairs.map(p => p.left));
        assert.equal(new Set(lefts).size, lefts.length, 'different kanji on the two boards');
      }
    }
  }
});

test('a line to the fitting card stays; one to another card springs back and marks the left card', () => {
  const { game, events, link, fitting, wrongFor } = newLink();
  const [first, second] = game.snapshot().lefts;
  assert.equal(link(first, wrongFor(first)), true);
  let s = game.snapshot();
  assert.equal(s.incorrect, 1); assert.equal(s.lefts[0].linked, false); assert.equal(s.lefts[0].hint, true);
  assert.equal(s.lastLine.correct, false); assert.ok(s.lastLine.otherExplain);
  const slip = s.missed[0];
  if (slip.contentId.startsWith('reading:')) { assert.equal(slip.build.script, 'kana'); assert.ok(slip.build.sentence); } else assert.equal(slip.build, null);
  assert.equal(link(first, fitting(first)), true);
  assert.equal(link(second, fitting(second)), true);
  s = game.snapshot();
  assert.equal(s.answered, 2, 'the second line on a left card is not a second result');
  assert.equal(s.correct, 1); assert.equal(s.joined, 2);
  assert.ok(s.lefts[0].linked && s.rights.find(r => r.pairId === first.pairId).linked);
  assert.deepEqual(events.filter(e => e.type !== 'problemPresented').map(e => e.type), ['incorrect', 'joined', 'correct']);
  // A joined card cannot be joined again.
  assert.equal(link(first, fitting(first)), false);
  const ids = events.filter(e => ['correct', 'incorrect', 'joined'].includes(e.type)).map(e => e.problemId);
  assert.equal(new Set(ids).size, ids.length);
});

test('a finished board shows for a moment, then the next; after the last the play ends', () => {
  for (const mode of ['kanji', 'english', 'math']) {
    const { game, events, link, fitting } = newLink({ mode, seed: 5 });
    for (let board = 0; board < 2; board++) {
      for (const left of game.snapshot().lefts) link(left, fitting(left));
      assert.equal(game.snapshot().phase, 'cleared');
      for (let t = 0; t < LINK_CLEAR_MS - 100; t += 50) game.update(50);
      assert.equal(game.snapshot().roundIndex, board, 'the board stays a moment');
      for (let t = 0; t < 200; t += 50) game.update(50);
    }
    const end = game.snapshot();
    assert.equal(end.phase, 'completed', mode);
    assert.equal(end.result.answered, 12); assert.equal(end.result.correct, 12);
    assert.equal(events.at(-1).type, 'sessionComplete');
    assert.equal(events.filter(e => e.type === 'problemPresented').length, 2);
  }
});

test('commands are refused while paused, with a stale attempt, or from another session', () => {
  const { game, sessionId, fitting } = newLink();
  const s = game.snapshot(), left = s.lefts[0], right = fitting(left);
  const send = payload => game.dispatch({ type: 'link', payload: { sessionId, attemptId: s.attemptId, leftId: left.leftId, rightId: right.rightId, ...payload } });
  assert.equal(send({ sessionId: 'x' }), false);
  assert.equal(send({ attemptId: 'stale' }), false);
  assert.equal(send({ rightId: 'nope' }), false);
  game.setPaused(true);
  assert.equal(send({}), false);
  game.setPaused(false);
  assert.equal(send({}), true);
  game.exit();
  assert.equal(game.snapshot().aborted, true);
  assert.equal(createLinkGame({ sessionId: 's', content: null }).enter(), false);
});
