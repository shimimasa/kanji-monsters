import test from 'node:test';
import assert from 'node:assert/strict';

import { createFrameClock, advanceTimer } from '../../src/core/frameClock.js';

test('logic time is clamped and background gaps do not count as play time', () => {
  const clock = createFrameClock(1000);
  assert.deepEqual(clock.tick(1016, false), { logicDeltaMs: 16, playtimeDeltaMs: 16 });
  assert.deepEqual(clock.tick(6016, false), { logicDeltaMs: 100, playtimeDeltaMs: 0 });
  assert.deepEqual(clock.tick(6032, true), { logicDeltaMs: 0, playtimeDeltaMs: 0 });
  assert.deepEqual(clock.tick(6048, false), { logicDeltaMs: 16, playtimeDeltaMs: 16 });
});

test('millisecond timers have the same duration at 30, 60, and 120 fps', () => {
  for (const fps of [30, 60, 120]) {
    let timer = 750;
    let elapsed = 0;
    const dt = 1000 / fps;
    while (timer > 0) {
      timer = advanceTimer(timer, dt);
      elapsed += dt;
    }
    assert.ok(elapsed >= 750 && elapsed < 750 + dt + 0.001);
  }
});
