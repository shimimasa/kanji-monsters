import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * P1-3 検証: stageId の canonical 化後に参照整合が崩れていないことを確認する。
 *
 * チェック:
 * 1) 旧ID（Asia_/Asie_/Europe_/America_/Africa_）が 0 件
 * 2) stages の stageId 集合 ⊇ enemies/kanji の参照 stageId 集合（差分が空）
 *
 * 使い方:
 *   node scripts/verify_stage_id_integrity.mjs
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const TARGET_FILES = {
  stages: 'public/data/stages_proto.json',
  enemies: 'public/data/enemies_proto.json',
  enemyWorld: 'public/data/enemy_world.json',
  kanji: [
    'public/data/kanji_g7_proto.json',
    'public/data/kanji_g8_proto.json',
    'public/data/kanji_g9_proto.json',
    'public/data/kanji_g10_proto.json',
  ],
};

function stripBom(s) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function parseJsonLenient(text, label) {
  const raw = stripBom(text);
  try {
    return JSON.parse(raw);
  } catch {
    // trailing comma を雑に除去（enemy_world.json が現状この形）
    const cleaned = raw.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      throw new Error(`Failed to parse JSON (${label}): ${e2?.message || String(e2)}`);
    }
  }
}

function collectStageIdsFromObject(obj) {
  const ids = new Set();
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(node, 'stageId')) {
      const cur = node.stageId;
      if (typeof cur === 'string') ids.add(cur);
      else if (Array.isArray(cur)) {
        for (const x of cur) if (typeof x === 'string') ids.add(x);
      }
    }
    for (const v of Object.values(node)) visit(v);
  };
  visit(obj);
  return ids;
}

function setDiff(a, b) {
  const out = new Set();
  for (const x of a) if (!b.has(x)) out.add(x);
  return out;
}

function sample(set, n = 10) {
  return Array.from(set).slice(0, n);
}

async function readJson(relPath) {
  const abs = path.join(ROOT, relPath);
  const text = await fs.readFile(abs, 'utf8');
  const json = parseJsonLenient(text, relPath);
  return { relPath, text, json };
}

async function main() {
  const stageFile = await readJson(TARGET_FILES.stages);
  const enemiesFile = await readJson(TARGET_FILES.enemies);
  const enemyWorldFile = await readJson(TARGET_FILES.enemyWorld);
  const kanjiFiles = await Promise.all(TARGET_FILES.kanji.map(readJson));

  // 1) 旧IDが 0 件
  const oldIdRe = /"stageId"\s*:\s*(?:\[\s*)?"(?:Asia_|Asie_|Europe_|America_|Africa_)/g;
  const oldIdHits = [];
  for (const f of [stageFile, enemiesFile, enemyWorldFile, ...kanjiFiles]) {
    const m = f.text.match(oldIdRe);
    if (m && m.length) oldIdHits.push({ file: f.relPath, count: m.length });
  }

  // 2) 集合差分
  const stagesSet = collectStageIdsFromObject(stageFile.json);
  const enemiesSet = collectStageIdsFromObject(enemiesFile.json);
  const worldSet = collectStageIdsFromObject(enemyWorldFile.json);
  const kanjiSet = new Set();
  for (const k of kanjiFiles) {
    for (const x of collectStageIdsFromObject(k.json)) kanjiSet.add(x);
  }

  const referencedSet = new Set([...enemiesSet, ...worldSet, ...kanjiSet]);
  const missingInStages = setDiff(referencedSet, stagesSet);

  const okOldId = oldIdHits.length === 0;
  const okSet = missingInStages.size === 0;

  console.log('P1-3 verify_stage_id_integrity');
  console.log(`- oldIdHits: ${okOldId ? 'OK(0)' : 'NG'}`);
  if (!okOldId) {
    for (const h of oldIdHits) console.log(`  - ${h.file}: ${h.count}`);
  }
  console.log(`- stageId integrity (referenced ⊆ stages): ${okSet ? 'OK' : 'NG'}`);
  if (!okSet) {
    console.log(`  - missingInStages: ${missingInStages.size}`);
    console.log(`    sample: ${sample(missingInStages, 20).join(', ')}`);
  }

  if (!okOldId || !okSet) process.exit(1);
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});

