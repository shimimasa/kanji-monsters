import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { answerKind, createCompanionPlay } from '../../src/minigames/companionPlay.js';
import { createMathInvaderGame } from '../../src/minigames/mathInvader/mathInvaderGame.js';

// 2026-10-02, the teacher's choice: an enemy that reaches the barrier (けいさんインベーダー) or the
// gate (漢字防衛隊) is a time-out. The child gave no answer, so there is no wrong-answer buzzer
// and the playtest log says 'timeout'; a typed wrong answer stays 'incorrect'.
test('answerKind tells a time-out from a wrong answer', () => {
  assert.equal(answerKind({ type: 'incorrect', payload: { reason: 'escaped' } }), 'timeout');
  assert.equal(answerKind({ type: 'incorrect', payload: { reason: 'wrong' } }), 'incorrect');
  assert.equal(answerKind({ type: 'incorrect', payload: { reason: 'attemptsExhausted' } }), 'incorrect');
  assert.equal(answerKind({ type: 'incorrect', payload: { classification: 'partial' } }), 'partial');
  assert.equal(answerKind({ type: 'correct', payload: {} }), 'correct');
});

test('an enemy reaching the barrier makes the companion react as a time-out; a wrong answer as incorrect', () => {
  const events = [], game = createMathInvaderGame({ sessionId: 'iv', random: () => 0.3, onEvent: e => events.push(e) });
  game.enter();
  for (let i = 0; i < 400 && !events.some(e => e.payload?.reason === 'escaped'); i++) game.update(100);
  const escape = events.find(e => e.type === 'incorrect' && e.payload?.reason === 'escaped');
  assert.ok(escape, 'an enemy reached the barrier');
  const play = createCompanionPlay('iv', { gameId: 'mathInvader' });
  play.observe(escape);
  assert.equal(play.snapshot().reaction, 'timeout');
  assert.equal(play.snapshot().combo, 0);
  play.observe({ ...escape, seq: escape.seq + 1000, payload: { ...escape.payload, reason: 'wrong' } });
  assert.equal(play.snapshot().reaction, 'incorrect');
  // The invader already counted the two apart: no wrong answer was typed.
  assert.ok(game.snapshot().escaped >= 1); assert.equal(game.snapshot().incorrect, 0);
});

test('the shell plays the shield sound for a time-out and the buzzer only for a wrong answer', () => {
  const shell = readFileSync(new URL('../../src/minigames/miniGameShell.js', import.meta.url), 'utf8');
  assert.match(shell, /reaction === 'timeout'\) publish\('playSE', 'shield1'\)/);
  assert.match(shell, /reaction === 'incorrect'\) publish\('playSE', 'wrong'\)/);
});
