import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('every normal world stage has a bounded explicit kanji pool', () => {
  const stages = JSON.parse(fs.readFileSync('public/data/stages_proto.json', 'utf8'));
  const worlds = stages.filter(stage => /^(asia|europe|america|africa)_/.test(stage.stageId) && !/bonus/i.test(stage.stageId));
  assert.ok(worlds.length > 0);
  for (const stage of worlds) {
    assert.ok(Array.isArray(stage.kanjiPoolIdList), `${stage.stageId} has no explicit pool`);
    assert.ok(stage.kanjiPoolIdList.length > 0 && stage.kanjiPoolIdList.length <= 60, `${stage.stageId} pool=${stage.kanjiPoolIdList.length}`);
  }
});

test('stage definitions are consulted before world-grade fallback', () => {
  const source = fs.readFileSync('src/loaders/dataLoader.js', 'utf8');
  const explicit = source.indexOf('st.kanjiPoolIdList');
  const fallback = source.indexOf("canonId.startsWith('asia_')");
  assert.ok(explicit >= 0 && fallback >= 0 && explicit < fallback);
});
