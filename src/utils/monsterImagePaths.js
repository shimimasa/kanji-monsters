// src/utils/monsterImagePaths.js
// ボーナスステージのモンスター画像の置き場所を1箇所で解決する。
//
// 背景:
//   通常の敵（*-E01 など）は学年フォルダ（grade1-hokkaido / grade7-asia …）に置かれているが、
//   ボーナスステージの「伝説」(*-L01〜L05) と「幻」(*-F01〜F05) だけは
//   monsters/full/日本・monsters/full/海外（thumb も同様）に置かれている。
//   さらに enemies_legend.json の110体中100体には grade フィールドが無いため、
//   学年フォルダだけで解決すると既定の grade1-hokkaido に落ちてしまい、
//   バトルでは北海道のモンスターの絵が代わりに表示され、図鑑では画像が壊れていた。
//   （＝どの地方のご褒美ステージでも北海道の姿が出る状態だった）

/** ボーナス敵IDの接頭辞 → 画像フォルダ */
const BONUS_AREA_BY_PREFIX = {
  // 日本
  HKD: '日本', // 北海道
  TOH: '日本', // 東北
  KNT: '日本', // 関東
  CHB: '日本', // 中部
  KIN: '日本', // 近畿
  CHG: '日本', // 中国
  SKG: '日本', // 四国
  KYU: '日本', // 九州
  // 海外
  AS:  '海外', // アジア
  EUR: '海外', // ヨーロッパ
  AME: '海外', // アメリカ
  AFR: '海外', // アフリカ
};

/**
 * ボーナス敵（伝説/幻）なら画像フォルダ名を返す。通常の敵なら null。
 * 呼び出し側は `getBonusMonsterFolder(id) || gradeFolderMap[grade] || gradeFolderMap[1]` の形で使う。
 * @param {string} monsterId 例: 'SKG-F01'
 * @returns {string|null} '日本' | '海外' | null
 */
export function getBonusMonsterFolder(monsterId) {
  const m = /^([A-Z]+)-[LF]\d+$/.exec(String(monsterId || '').trim());
  if (!m) return null;
  return BONUS_AREA_BY_PREFIX[m[1]] || null;
}
