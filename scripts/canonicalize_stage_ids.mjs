import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * P1-3 データ側 canonical 化
 *
 * NOTE:
 * - この repo は package.json に "type": "module" が無いため、Node から src/ の ESM を直接 import できない。
 * - そのため、ここでは src/core/idCanonicalizer.js と同等の正規化ルールをスクリプト内に同梱する。
 * - 追加前提: Asie/Asie_ は Asia の揺れとして扱う（asie -> asia）
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const TARGET_FILES = [
  'public/data/stages_proto.json',
  'public/data/enemies_proto.json',
  'public/data/enemy_world.json',
  'public/data/kanji_g7_proto.json',
  'public/data/kanji_g8_proto.json',
  'public/data/kanji_g9_proto.json',
  'public/data/kanji_g10_proto.json',
];

const REGION_ALIASES = {
  // 日本（ローマ字の表記ゆれ）
  hokkaidou: 'hokkaido',
  touhoku: 'tohoku',
  kantou: 'kanto',
  chuubu: 'chubu',
  chuugoku: 'chugoku',
  cyuugoku: 'chugoku',
  // 念のため
  kyusyu: 'kyushu',
  kyuushu: 'kyushu',
  // P1-3 前提: フランス語(?)揺れ Asie -> Asia
  asie: 'asia',
};

const WORLD_CANON = {
  asia: 'asia',
  europe: 'europe',
  america: 'america',
  africa: 'africa',
};

function canonicalizeStageId(raw) {
  const original = (raw === null || raw === undefined) ? '' : String(raw);
  const trimmed = original.trim();
  if (!trimmed) return trimmed;

  // 学年ボーナス（区切りゆれ吸収）
  // 例: bonus-g1 / BONUS_G1 / bonus_g01 -> bonus_g1
  const bonusM = /^bonus[-_]?g0*(\d+)$/i.exec(trimmed);
  if (bonusM) return `bonus_g${parseInt(bonusM[1], 10)}`;

  const parts = trimmed.split('_');
  const headRaw = parts[0] || '';
  const headLower = headRaw.toLowerCase();

  let head;
  if (headLower in WORLD_CANON) {
    head = WORLD_CANON[headLower];
  } else if (headLower in REGION_ALIASES) {
    head = REGION_ALIASES[headLower];
  } else {
    head = headLower;
  }

  if (parts.length === 1) return head;

  let rest = parts.slice(1).join('_');
  rest = rest.toLowerCase().replace(/^area/i, 'area');
  return `${head}_${rest}`;
}

function stripBom(s) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function parseJsonLenient(text, label) {
  const raw = stripBom(text);
  try {
    return JSON.parse(raw);
  } catch {
    // trailing comma を雑に除去（JSON5ではないが、enemy_world.json が現状この形）
    const cleaned = raw.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      throw new Error(`Failed to parse JSON (${label}): ${e2?.message || String(e2)}`);
    }
  }
}

function stringifyJson(obj) {
  return JSON.stringify(obj, null, 2) + '\n';
}

function rewriteStageIdString(v) {
  // 前提: Asie_ を Asia_ として扱う（この後 canonicalize で小文字へ）
  const s = String(v ?? '');
  const pre = s.replace(/^Asie_/i, 'Asia_');
  return canonicalizeStageId(pre);
}

function transformObjectInPlace(obj, fileRelPath) {
  let changed = 0;
  const seen = new Set();

  const bump = (before, after) => {
    if (before !== after) changed += 1;
    // 変換後 stageId が空は想定外なのでログ対象にしておく（停止はしない）
    if (!after) seen.add(`EMPTY@${fileRelPath}`);
  };

  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }

    if (Object.prototype.hasOwnProperty.call(node, 'stageId')) {
      const cur = node.stageId;
      if (typeof cur === 'string') {
        const next = rewriteStageIdString(cur);
        bump(cur, next);
        node.stageId = next;
      } else if (Array.isArray(cur)) {
        const nextArr = cur.map((x) => (typeof x === 'string' ? rewriteStageIdString(x) : x));
        // 配列要素の差分数を数える（ざっくり）
        for (let i = 0; i < Math.max(cur.length, nextArr.length); i++) {
          if (cur[i] !== nextArr[i]) changed += 1;
        }
        node.stageId = nextArr;
      }
    }

    for (const v of Object.values(node)) visit(v);
  };

  visit(obj);
  return { changed, notes: Array.from(seen) };
}

function usage() {
  return [
    'Usage:',
    '  node scripts/canonicalize_stage_ids.mjs --write',
    '  node scripts/canonicalize_stage_ids.mjs            # dry-run (no write)',
    '',
    'Options:',
    '  --write   Write changes to files (default: dry-run)',
  ].join('\n');
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('-h') || args.has('--help')) {
    console.log(usage());
    process.exit(0);
  }

  const doWrite = args.has('--write');

  let totalChanged = 0;
  const perFile = [];

  for (const rel of TARGET_FILES) {
    const abs = path.join(ROOT, rel);
    const beforeText = await fs.readFile(abs, 'utf8');
    const json = parseJsonLenient(beforeText, rel);
    const { changed, notes } = transformObjectInPlace(json, rel);
    totalChanged += changed;

    const afterText = stringifyJson(json);

    perFile.push({
      file: rel,
      changed,
      bytesBefore: beforeText.length,
      bytesAfter: afterText.length,
      notes,
    });

    if (doWrite) {
      await fs.writeFile(abs, afterText, 'utf8');
    }
  }

  console.log(`P1-3 canonicalize_stage_ids: ${doWrite ? 'WRITE' : 'DRY-RUN'}`);
  for (const r of perFile) {
    const note = r.notes.length ? ` notes=${r.notes.join(',')}` : '';
    console.log(`- ${r.file}: changed=${r.changed} bytes=${r.bytesBefore}->${r.bytesAfter}${note}`);
  }
  console.log(`TOTAL changed=${totalChanged}`);
  if (!doWrite) {
    console.log('No files were written (dry-run). Re-run with --write to apply changes.');
  }
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});

