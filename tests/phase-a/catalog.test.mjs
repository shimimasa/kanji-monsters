import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = name => JSON.parse(fs.readFileSync(new URL('../../public/data/' + name, import.meta.url), 'utf8'));
export const kanji = Array.from({ length: 10 }, (_, i) => read(`kanji_g${i + 1}_proto.json`)).flat();
const stages = [...read('stages_proto.json'), ...read('stages.bonus.json')];
const enemies = ['enemies_proto.json', 'enemies_legend.json', 'enemy_bonus.json', 'enemy_world.json', 'shikoku.kyusyuu.json'].flatMap(read);
test('E07: all 2136 characters remain and duplicate IDs = 0', () => {
  assert.equal(kanji.length, 2136);
  const seen = new Set(); const dup = [];
  for (const k of kanji) { if (seen.has(k.id)) dup.push(k.id); seen.add(k.id); }
  assert.deepEqual(dup, []);
});
test('E07: missing stage kanji references = 0', () => {
  const ids = new Set(kanji.map(k => k.id));
  assert.deepEqual(stages.flatMap(s => (s.kanjiPoolIdList || []).filter(id => !ids.has(id)).map(id => `${s.stageId}:${id}`)), []);
});
test('E07: missing enemy references = 0, each stage keeps its enemy count', () => {
  const ids = new Set(enemies.map(e => e.id));
  assert.deepEqual(stages.flatMap(s => (s.enemyIdList || []).filter(id => !ids.has(id)).map(id => `${s.stageId}:${id}`)), []);
  for (const s of stages) assert.equal(s.enemyIdList.length, 10, s.stageId);
});
