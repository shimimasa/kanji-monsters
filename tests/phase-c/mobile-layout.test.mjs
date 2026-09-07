import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { getContainedRect, gameUnitsForCssPixels, MIN_TOUCH_TARGET_CSS_PX } from '../../src/ui/viewportLayout.js';

test('portrait canvas preserves 4:3 content and maps a 44px target correctly', () => {
  const rect = getContainedRect({ left: 0, top: 0, width: 390, height: 700 }, 800, 600);
  assert.deepEqual(rect, { left: 0, top: 203.75, width: 390, height: 292.5, scale: 0.4875 });
  assert.equal(Math.ceil(gameUnitsForCssPixels(MIN_TOUCH_TARGET_CSS_PX, rect.scale)), 91);
});

test('landscape letterboxing is included in coordinate calculations', () => {
  const rect = getContainedRect({ left: 0, top: 0, width: 900, height: 600 }, 800, 600);
  assert.deepEqual(rect, { left: 50, top: 0, width: 800, height: 600, scale: 1 });
});

test('HTML input and kana controls retain readable 44px-class targets', () => {
  const css = fs.readFileSync('style.css', 'utf8');
  const kanaPad = fs.readFileSync('src/ui/kanaPad.js', 'utf8');
  assert.match(css, /#kanjiInput[\s\S]*?min-height:\s*48px/);
  assert.match(kanaPad, /min-height:\s*44px/);
  assert.match(kanaPad, /height:\s*calc\(44px/);
});
