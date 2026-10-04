import test from 'node:test';
import assert from 'node:assert/strict';
import { wantsPortrait, syncPortraitCanvas, restoreLandscapeCanvas, isPortraitCanvas, portraitButtons, PORTRAIT, PORTRAIT_LAYOUT } from '../../src/screens/battle/portraitLayout.js';
import { shouldShowRotateHint } from '../../src/ui/rotateHint.js';

// スマホを たてに 持った時の バトル（2026-10-04）
const fakeCanvas = () => { const classes = new Set(); return { width: 800, height: 600, classList: { toggle: (c, on) => on ? classes.add(c) : classes.delete(c), has: c => classes.has(c) } }; };

test('only a narrow, tall screen gets the tall battle board', () => {
  assert.equal(wantsPortrait({ innerWidth: 390, innerHeight: 844 }), true, 'phone held upright');
  assert.equal(wantsPortrait({ innerWidth: 844, innerHeight: 390 }), false, 'phone sideways');
  assert.equal(wantsPortrait({ innerWidth: 768, innerHeight: 1024 }), false, 'iPad upright keeps 800x600');
  assert.equal(wantsPortrait({ innerWidth: 1366, innerHeight: 768 }), false, 'Chromebook');
});

test('the board switches to 480x680 and back, and other screens get 800x600 again', () => {
  const canvas = fakeCanvas();
  assert.equal(syncPortraitCanvas(canvas, { innerWidth: 390, innerHeight: 844 }), true);
  assert.equal(isPortraitCanvas(canvas), true);
  assert.equal(canvas.classList.has('yt-portrait'), true);
  assert.equal(syncPortraitCanvas(canvas, { innerWidth: 390, innerHeight: 844 }), false, 'no change, no reset');
  assert.equal(syncPortraitCanvas(canvas, { innerWidth: 844, innerHeight: 390 }), true, 'turned sideways');
  assert.deepEqual([canvas.width, canvas.height], [800, 600]);
  syncPortraitCanvas(canvas, { innerWidth: 390, innerHeight: 844 });
  restoreLandscapeCanvas(canvas);
  assert.deepEqual([canvas.width, canvas.height, canvas.classList.has('yt-portrait')], [800, 600, false]);
});

test('the three buttons fit across the bottom of the tall board without overlapping', () => {
  const row = portraitButtons(57);
  const list = [row.attack, row.heal, row.hint];
  list.forEach(b => { assert.ok(b.x >= 0 && b.x + b.w <= PORTRAIT.W); assert.ok(b.y + b.h <= PORTRAIT.H); });
  assert.ok(row.attack.x + row.attack.w <= row.heal.x && row.heal.x + row.heal.w <= row.hint.x);
  const k = PORTRAIT_LAYOUT.kanji;
  assert.ok(k.centerY + k.height / 2 < row.attack.y - 100, 'room for the log and the input between the kanji and the buttons');
});

test('the 「たてに してね」 hint: touch, sideways and short, only over a canvas screen', () => {
  const win = (w, h, coarse = true) => ({ innerWidth: w, innerHeight: h, matchMedia: () => ({ matches: coarse }) });
  const doc = (style = {}, inert = false) => ({ getElementById: () => ({ inert, style }) });
  assert.equal(shouldShowRotateHint(win(844, 390), doc()), true);
  assert.equal(shouldShowRotateHint(win(390, 844), doc()), false, 'upright');
  assert.equal(shouldShowRotateHint(win(1366, 768, false), doc()), false, 'not touch');
  assert.equal(shouldShowRotateHint(win(1024, 700), doc()), false, 'tall enough');
  assert.equal(shouldShowRotateHint(win(844, 390), doc({}, true)), false, 'a DOM screen (title, square) is in front');
  assert.equal(shouldShowRotateHint(win(844, 390), doc({ visibility: 'hidden' })), false, 'capture screen hides the canvas');
});

// ステージ選択の タブ: たての 画面（480幅）では 4つずつ 2段（2026-10-04）
import { tabIndexAt, tabGeometry } from '../../src/ui/canvasUtils.js';

test('two rows of grade tabs: each tab is hit where it is drawn; one row stays as before', () => {
  assert.deepEqual(tabGeometry(8, 480, 2), { perRow: 4, tabW: 120, tabH: 50, height: 100 });
  assert.equal(tabIndexAt(10, 10, 8, 480, 2), 0);
  assert.equal(tabIndexAt(470, 10, 8, 480, 2), 3);
  assert.equal(tabIndexAt(10, 60, 8, 480, 2), 4, 'second row starts with 5年');
  assert.equal(tabIndexAt(470, 99, 8, 480, 2), 7);
  assert.equal(tabIndexAt(10, 120, 8, 480, 2), -1, 'below the tabs');
  assert.equal(tabIndexAt(790, 30, 8, 800, 1), 7, 'landscape: one row of 8');
  assert.equal(tabIndexAt(10, 61, 8, 800, 1), -1);
});
