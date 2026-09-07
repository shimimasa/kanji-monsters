// src/core/saveSlots.js
//
// 1台の端末を、何人かの子で分けて使うための「セーブスロット」。
//
// なぜ要るか:
//   セーブは krb_save の1つきりで、Firestore も匿名認証の uid ひとつ。
//   学校の共用iPadでは、2人目が遊んだ時点で1人目の記録の上に書かれる。
//   やり直しのきく話ではないので、教室に出す前に要る。
//
// 作りの方針:
//   ・スロット1は今までどおり素のキー（krb_save など）をそのまま使う。
//     いま遊んでいる子のデータには一切触らない＝移行の risk がゼロ。
//   ・スロット2以降に切り替える時だけ、いまのキー一式を控えに退避し、
//     行き先の控えを書き戻す。切り替えの直後はページを読み込み直して、
//     メモリ上の古い状態が残らないようにする。
//   ・Firestore もスロット2以降は users/{uid}/slots/{n}/... の下に分ける
//     （スロット1は users/{uid}/... のまま）。
//   ・名前は krb_save の player.name をそのまま使う。別に持たない。

import { migrateSave, confirmedSaveKey } from './saveData.js';
import { writeStorageTransaction, recoverStorageTransaction } from './storageTransaction.js';

export const MAX_SLOTS = 3;

// このモジュール自身のキー。控えの中身と混ざらないよう krb_ は付けない
// （krb_ で始まるキーは「子どものデータ」として丸ごと退避の対象になるため）。
const CURRENT_SLOT_KEY = 'yomitabi_slot';
const slotStoreKey = (n) => `yomitabi_slot_data_${n}`;

/** 子ども1人ぶんのデータにあたるキー（完全一致） */
const OWNED_EXACT = [
  'krb_save', 'kanjiGameSave',
  'playerStats', 'unlockedStages', 'kanjiBattleScores',
  'quickReviewBuffer', 'dailyPracticeStats', 'bs_blockHistory',
  'lastPlayedStage',
  // 見え方の設定は、その子に付いて回るべきものなので一緒に持ち運ぶ
  'cbMode', 'bigFont', 'weaknessScope', 'exampleMode', 'rubyMode'
];

/** 子ども1人ぶんのデータにあたるキー（前方一致） */
const OWNED_PREFIXES = [
  'krb_',                  // krb_save / krb_kanji_dex / krb_monster_dex / krb_review_queue / krb_wrong_kanji
  'clear_',
  'stage_clear_',
  'stage_first_clear_at_',
  'bonus_',
  'tutorial_seen_'
];

/**
 * 端末ごとの設定（音量・入力方法など）はスロットに入れない。
 * 先生が端末を用意した時の設定が、子どもを変えるたびに戻るのは不便なため。
 */
function isOwnedKey(key) {
  if (!key) return false;
  if (key === CURRENT_SLOT_KEY || key.startsWith('yomitabi_slot_data_')) return false;
  if (OWNED_EXACT.includes(key)) return true;
  return OWNED_PREFIXES.some(prefix => key.startsWith(prefix));
}

/** いま使っているスロット番号（1始まり） */
export function getCurrentSlot() {
  try {
    const raw = parseInt(localStorage.getItem(CURRENT_SLOT_KEY) || '1', 10);
    if (Number.isInteger(raw) && raw >= 1 && raw <= MAX_SLOTS) return raw;
  } catch {}
  return 1;
}

/** localStorage 上の「いまの子ども」のデータを丸ごと取り出す */
function collectOwnedEntries() {
  const entries = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!isOwnedKey(key)) continue;
      entries[key] = localStorage.getItem(key);
    }
  return entries;
}

/** いまのスロットの中身を控えに書き出す（切り替えの前に必ず呼ぶ） */
export function snapshotCurrentSlot() {
  const slot = getCurrentSlot();
  try {
    localStorage.setItem(slotStoreKey(slot), JSON.stringify(collectOwnedEntries()));
    return true;
  } catch { return false; }
}

/** 控えから、その子の名前を読み出す（無ければ null） */
function readNameFromEntries(entries) {
  try {
    const raw = entries && entries['krb_save'];
    if (!raw) return null;
    const save = JSON.parse(raw);
    const name = save?.player?.name;
    return (typeof name === 'string' && name.trim()) ? name.trim() : null;
  } catch {
    return null;
  }
}

/**
 * スロットの一覧。名前は各スロットの krb_save から読む。
 * @returns {{index:number, name:string|null, isCurrent:boolean, used:boolean}[]}
 */
export function listSlots() {
  const current = getCurrentSlot();
  const slots = [];
  for (let index = 1; index <= MAX_SLOTS; index++) {
    let entries;
    if (index === current) {
      entries = collectOwnedEntries();
    } else {
      try {
        const raw = localStorage.getItem(slotStoreKey(index));
        entries = raw ? JSON.parse(raw) : null;
      } catch {
        entries = null;
      }
    }
    const name = readNameFromEntries(entries);
    slots.push({
      index,
      name,
      isCurrent: index === current,
      used: !!(entries && Object.keys(entries).length > 0)
    });
  }
  return slots;
}

/**
 * スロットを切り替える。
 * 呼び出し側は、この直後にページを読み込み直すこと（メモリ上の古い状態を残さないため）。
 * @param {number} next 行き先のスロット番号
 * @returns {boolean} 切り替えたら true
 */
export function switchToSlot(next) {
  if (!Number.isInteger(next) || next < 1 || next > MAX_SLOTS) return false;
  if (!recoverStorageTransaction().ok) return false;
  const current = getCurrentSlot();
  if (next === current) return false;

  try {
    if (!recoverStorageTransaction().ok) return false;
    const slotValue = localStorage.getItem(CURRENT_SLOT_KEY);
    if (slotValue !== null && !/^[1-3]$/.test(slotValue)) return false;
    const raw = localStorage.getItem(slotStoreKey(next));
    const target = raw === null ? {} : JSON.parse(raw);
    if (!target || typeof target !== 'object' || Array.isArray(target) ||
        Object.entries(target).some(([key, value]) => !isOwnedKey(key) || typeof value !== 'string')) return false;
    if (target.krb_save !== undefined) migrateSave(JSON.parse(target.krb_save));
    const confirmed = localStorage.getItem(confirmedSaveKey(String(next)));
    if (confirmed !== null && target.krb_save !== confirmed) return false;
    const source = collectOwnedEntries();
    const entries = { [slotStoreKey(current)]: JSON.stringify(source) };
    for (const key of new Set([...Object.keys(source), ...Object.keys(target)])) entries[key] = target[key] ?? null;
    entries[CURRENT_SLOT_KEY] = String(next);
    entries.yomitabi_storage_epoch = `${Date.now()}-${Math.random()}`;
    return writeStorageTransaction(entries).ok;
  } catch { return false; }
}

/**
 * Firestore の置き場所をスロットで分ける。
 * スロット1は今までどおり users/{uid} の直下。2以降は users/{uid}/slots/{n} の下。
 * どちらも users/{userId}/... の中なので、セキュリティルールはそのままで足りる。
 * @param {object} db firestore インスタンス
 * @param {string} uid
 * @returns {object} DocumentReference（この下に profile / progress が並ぶ）
 */
export function userRootRef(db, uid, slot = getCurrentSlot()) {
  const root = db.collection('users').doc(uid);
  return slot === 1 ? root : root.collection('slots').doc(String(slot));
}
