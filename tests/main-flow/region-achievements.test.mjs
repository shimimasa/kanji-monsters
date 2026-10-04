import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { installStorage } from '../phase-a/storage-helper.mjs';
installStorage();
globalThis.fetch = async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(new URL('../../public' + url, import.meta.url), 'utf8')) });
const loader = await import('../../src/loaders/dataLoader.js');
await loader.loadAllGameData();
const { gameState } = await import('../../src/core/gameState.js');
const { checkCondition } = await import('../../src/core/achievementManager.js');
const achievements = JSON.parse(fs.readFileSync(new URL('../../public/data/achievements.json', import.meta.url), 'utf8'));
const list = Array.isArray(achievements) ? achievements : achievements.achievements;
const byId = id => list.find(a => a.id === id);

// 地方の 実績は その地方の 通常ステージを ぜんぶ クリアした時（2026-10-04）。
// 以前: 北海道は 奥地 1つで 出ていた／東北・関東は 地方名と 比べていて 取れなかった
const clear = (...ids) => { gameState.stageProgress = Object.fromEntries(ids.map(id => [id, { cleared: true }])); };
const normalOf = prefix => loader.stageData.filter(s => s.stageId.startsWith(prefix + '_') && !/_bonus$/.test(s.stageId)).map(s => s.stageId);

test('北の大地の覇者 needs both 北海道 stages, not the summary', t => {
  for (const key of ['log', 'warn', 'error']) t.mock.method(console, key, () => {});
  clear('hokkaido_area1');
  assert.equal(checkCondition(byId('clear_hokkaido'), gameState.playerStats), false, 'one stage is not the region');
  clear('hokkaido_area1', 'hokkaido_area2');
  assert.equal(checkCondition(byId('clear_hokkaido'), gameState.playerStats), true, 'the locked summary is not needed');
});

test('東北制覇 and 関東統一 can be earned (they never could)', t => {
  for (const key of ['log', 'warn', 'error']) t.mock.method(console, key, () => {});
  for (const [id, prefix] of [['clear_tohoku_all', 'tohoku'], ['clear_kanto_all', 'kanto']]) {
    const stages = normalOf(prefix);
    assert.ok(stages.length >= 2, prefix);
    clear(...stages.slice(1));
    assert.equal(checkCondition(byId(id), gameState.playerStats), false, `${id}: one missing`);
    clear(...stages);
    assert.equal(checkCondition(byId(id), gameState.playerStats), true, `${id}: all cleared`);
  }
});
