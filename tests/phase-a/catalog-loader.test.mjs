import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { installStorage } from './storage-helper.mjs';
installStorage();
const loader = await import('../../src/loaders/dataLoader.js');
test('E07: a stale cached duplicate catalog is rejected instead of entering current learning IDs', async () => {
  globalThis.fetch=async()=>({ok:true,json:async()=>[{id:'g5-041',kanji:'許'},{id:'g5-041',kanji:'均'}]});
  await loader.loadKanjiGradesPhased({eager:[5],lazy:[],idle:[]});
  assert.equal(loader.kanjiData.some(k=>k.id==='g5-041'),false);
});
test('E07: current grade data loads both formerly duplicated characters independently', async () => {
  const grade=JSON.parse(fs.readFileSync(new URL('../../public/data/kanji_g5_proto.json',import.meta.url),'utf8'));
  globalThis.fetch=async()=>({ok:true,json:async()=>grade});
  await loader.loadKanjiGradesPhased({eager:[5],lazy:[],idle:[]});
  assert.ok(loader.kanjiData.some(k=>k.id==='g5-041-8a31'));
  assert.ok(loader.kanjiData.some(k=>k.id==='g5-041-5747'));
});
