import test from 'node:test';
import assert from 'node:assert/strict';
import { createAchievementToasts, SHOW_MS } from '../../src/ui/achievementToasts.js';

// じっせきの お知らせは 1まいずつ。同時に来ても 重ならない（2026-10-04）。
function clock() { let t = 1000; return { now: () => t, tick: ms => { t += ms; } }; }

test('one at a time, each for SHOW_MS, the sound with each one', () => {
  const c = clock(), shown = [];
  const toasts = createAchievementToasts({ now: c.now, onShow: t => shown.push(t.title) });
  toasts.push({ title: 'A', description: 'a' });
  toasts.push({ title: 'B', description: 'b' });
  assert.equal(toasts.current().title, 'A');
  assert.deepEqual(shown, ['A'], 'B waits: never two at once');
  c.tick(SHOW_MS - 1); assert.equal(toasts.current().title, 'A');
  c.tick(1); assert.equal(toasts.current().title, 'B');
  assert.deepEqual(shown, ['A', 'B']);
  c.tick(SHOW_MS); assert.equal(toasts.current(), null);
});

test('many at once: the first, then the rest as one 「ほかにも N こ」', () => {
  const c = clock();
  const toasts = createAchievementToasts({ now: c.now });
  for (const title of ['A', 'B', 'C', 'D', 'E']) toasts.push({ title });
  assert.equal(toasts.current().title, 'A');
  c.tick(SHOW_MS); assert.equal(toasts.current().title, 'B');
  c.tick(SHOW_MS); assert.equal(toasts.current().title, 'ほかにも 3こ ゲット！');
  c.tick(SHOW_MS); assert.equal(toasts.current(), null);
  assert.equal(toasts.size(), 0);
});

test('nothing to show is null, and an empty push is ignored', () => {
  const toasts = createAchievementToasts({ now: () => 0 });
  toasts.push(null);
  assert.equal(toasts.current(), null);
});
