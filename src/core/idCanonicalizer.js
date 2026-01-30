// src/core/idCanonicalizer.js
// P1(ID規約): stageId の表記揺れ吸収はここ 1 箇所に集約する。
// - 正史: public/data の stageId（stages_proto.json）に合わせる
// - 既存挙動を壊さないため、未知のIDは例外にせず「できる範囲で整形して返す」

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
};

const WORLD_CANON = {
  // 世界ステージはコード側の正史として先頭小文字に統一する
  asia: 'asia',
  europe: 'europe',
  america: 'america',
  africa: 'africa',
};

/**
 * stageId を正史表記へ正規化する。
 *
 * - 入力: 任意（基本は string 想定）
 * - 仕様:
 *   - trim
 *   - bonus の区切りゆれ: bonus-g1 / BONUS_G1 -> bonus_g1
 *   - 先頭トークン（region）だけ表記ゆれ辞書で正規化
 *   - 世界ステージは先頭小文字（asia/europe/america/africa）へ寄せる（コード側の正史）
 *   - 不明IDは例外にせず、可能な範囲で整形して返す
 */
export function canonicalizeStageId(raw) {
  const original = (raw === null || raw === undefined) ? '' : String(raw);
  const trimmed = original.trim();
  if (!trimmed) return trimmed;

  // 学年ボーナス（区切りゆれ吸収）
  // 例: bonus-g1 / BONUS_G1 / bonus_g01 -> bonus_g1
  const bonusM = /^bonus[-_]?g0*(\d+)$/i.exec(trimmed);
  if (bonusM) return `bonus_g${parseInt(bonusM[1], 10)}`;

  // "_" 区切りを前提に先頭トークンだけ補正する（他の部分は基本維持）
  const parts = trimmed.split('_');
  const headRaw = parts[0] || '';
  const headLower = headRaw.toLowerCase();

  let head = headRaw;
  if (headLower in WORLD_CANON) {
    head = WORLD_CANON[headLower]; // 正史（コード側の小文字）に合わせる
  } else if (headLower in REGION_ALIASES) {
    head = REGION_ALIASES[headLower];
  } else {
    // その他は「日本のステージは小文字」が多いので、明示的な世界以外は lower に寄せる（安全策）
    head = headLower;
  }

  if (parts.length === 1) return head;

  // area の大小ゆれをすべて小文字へ（例: Area1 / AREA1 -> area1）
  let rest = parts.slice(1).join('_');
  rest = rest.toLowerCase().replace(/^area/i, 'area');

  return `${head}_${rest}`;
}

