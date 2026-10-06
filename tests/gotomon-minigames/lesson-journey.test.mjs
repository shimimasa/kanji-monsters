import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLessonCapture, createLessonProgress } from '../../src/lessons/lessonCapture.js';
import { lessonCatalog } from '../../src/lessons/lessonCatalog.js';

test('理科・社会の2授業は固有のゴトモン・HTML・記録シート・SVGを持つ', () => {
  assert.equal(lessonCatalog.length, 2);
  assert.equal(new Set(lessonCatalog.map(x => x.id)).size, 2);
  assert.deepEqual(lessonCatalog.map(x => x.subject), ['理科', '社会']);
  for (const lesson of lessonCatalog) {
    const html = readFileSync(new URL(`../../public/lessons/elementgirl/${lesson.slug}.html`, import.meta.url), 'utf8');
    const sheet = readFileSync(new URL(`../../public/lessons/elementgirl/${lesson.slug}-sheet.html`, import.meta.url), 'utf8');
    const svg = readFileSync(new URL(`../../public/assets/images/monsters/full/lesson/${lesson.id}.svg`, import.meta.url), 'utf8');
    assert.equal((html.match(/class="badge"/g) || []).length, 5);
    assert.match(html, /yomitabiLessonComplete\?\.\(S\.badges\.size, 5\)/);
    assert.doesNotMatch(html, /<script src="(?:auth|orientation-guard|profile|progress)\.js"/);
    assert.doesNotMatch(html, /confirm\(/);
    assert.match(sheet, /いんさつする/);
    assert.match(svg, /<svg/);
  }
});

test('完走だけを保存し、同じゴトモンは一度だけ仲間になる', () => {
  const snapshot = { player: { collection: { gotomonIds: [] } } };
  let writes = 0, context = 'before';
  const capture = createLessonCapture({
    ready: () => true, capture: () => context,
    owned: () => snapshot.player.collection.gotomonIds,
    save: update => { writes++; update(snapshot); context = `after-${writes}`; return { ok: true }; },
  });
  assert.equal(capture('kururu', { count: 4, total: 5 }).ok, false);
  assert.equal(capture('unknown', { count: 5, total: 5 }).ok, false);
  assert.equal(writes, 0);
  assert.equal(capture('kururu', { count: 5, total: 5 }).newFriend, true);
  assert.equal(capture('kururu', { count: 5, total: 5 }).newFriend, false);
  assert.equal(capture('hitotsubu', { count: 5, total: 5 }).newFriend, true);
  assert.deepEqual(snapshot.player.collection.gotomonIds, ['EL-001', 'EL-002']);
  assert.equal(writes, 2);
});

test('保存できなかった完走は捕獲として扱わない', () => {
  const capture = createLessonCapture({
    ready: () => true, capture: () => 'unchanged', owned: () => [],
    save: () => ({ ok: false }),
  });
  assert.equal(capture('kururu', { count: 5, total: 5 }).ok, false);
});

test('途中で集めた星は確認済みセーブに残り、再プレイでも減らない', () => {
  const snapshot = { player: { miniGames: { games: {}, companions: {} } } };
  let writes = 0;
  const record = createLessonProgress({
    ready: () => true,
    capture: () => JSON.stringify(['1', 'epoch', JSON.stringify(snapshot)]),
    save: update => { writes++; update(snapshot); return { ok: true }; },
  });
  assert.deepEqual(record('kururu', { count: 2, total: 5 }), { ok: true, bestStars: 2 });
  assert.deepEqual(record('kururu', { count: 1, total: 5 }), { ok: true, bestStars: 2 });
  assert.deepEqual(record('kururu', { count: 4, total: 5 }), { ok: true, bestStars: 4 });
  assert.equal(record('kururu', { count: 6, total: 5 }).ok, false);
  assert.equal(writes, 2);
  assert.equal(snapshot.player.miniGames.lessonProgress.kururu.bestStars, 4);
});
