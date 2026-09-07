import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyReadingAnswer, createInputSubmission } from '../../src/core/answerSubmission.js';

function event(key = 'Enter', extra = {}) {
  return { key, preventDefault() {}, ...extra };
}

test('空欄は確定せず、近似入力は再入力、自力正解だけが正解になる', () => {
  assert.equal(classifyReadingAnswer('   ', ['がっこう']).kind, 'blank');
  assert.equal(classifyReadingAnswer('かっこう', ['がっこう']).kind, 'near-miss');
  assert.equal(classifyReadingAnswer('ガッコウ', ['がっこう']).kind, 'correct');
  assert.equal(classifyReadingAnswer('こうこう', ['がっこう']).kind, 'incorrect');
});

test('連続Enterは一度だけ確定する', () => {
  let calls = 0;
  const input = createInputSubmission(() => { calls++; return true; });
  assert.equal(input.handleKeydown(event(), 'いち').accepted, true);
  assert.equal(input.handleKeydown(event(), 'いち').accepted, false);
  assert.equal(input.handleKeydown(event(), 'いち').accepted, false);
  assert.equal(calls, 1);
});

test('IME composition中のEnterは変換確定だけで、回答を確定しない', () => {
  let calls = 0;
  const input = createInputSubmission(() => { calls++; return true; });
  input.compositionStart();
  assert.equal(input.handleKeydown(event('Enter', { isComposing: true, keyCode: 229 }), 'いち').reason, 'composition');
  input.compositionEnd();
  assert.equal(calls, 0);
  assert.equal(input.handleKeydown(event(), 'いち').accepted, true);
  assert.equal(calls, 1);
});

test('近似入力はロックせず、画面離脱後の送信は無視する', () => {
  let calls = 0;
  const input = createInputSubmission(value => {
    calls++;
    return classifyReadingAnswer(value, ['がっこう']).kind !== 'near-miss';
  });
  assert.equal(input.submit('かっこう').accepted, false);
  assert.equal(input.submit('がっこう').accepted, true);
  input.deactivate();
  input.unlock();
  assert.equal(input.submit('がっこう').reason, 'inactive');
  assert.equal(calls, 2);
});

