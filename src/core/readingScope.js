// src/core/readingScope.js
//
// 「敵の弱点が示されている時は、その読み系統だけを正解にする」ための判定。
//
// なぜ要るか:
//   これまでは単漢字を出して、どの読みでも正解にしていた。「生」なら
//   せい／しょう／なま／き のどれでも通る。知っている読みを1つ持っていれば
//   最後まで進めてしまい、その字の他の読みには一度も出会わないまま終わる。
//   画面には「弱点は音読み！」と出ているのだから、そこを合わせてもらうほうが
//   示している意味とも合うし、読みを増やす機会にもなる。
//
// 子どもへの当たり方（ここが肝心）:
//   系統ちがいは「まちがい」ではない。その字はちゃんと読めている。
//   傷も付けず、学習記録にも残さず、「よめてるよ。いまは おんよみで」と
//   伝えてもう一度書かせる。「おしい」入力と同じ扱いにする。
//
// 逃げ道:
//   その字にその系統の読みが無い時（訓読みしか無い字に音読みを求める、など）は
//   この決まりを外して今までどおり全部の読みを正解にする。
//   答えようのない問題を作らないため。

import { getReadings, getReadingsOf } from '../utils/readings.js';

const STORAGE_KEY = 'weaknessScope';

// NOTE: textScale / palette と同じ作り。判定は1問につき数回しか走らないが、
//       正史は localStorage に置き、読み取りはモジュール内に持った値で済ませる。
let enabledCache = null;

function readFromStorage() {
  try {
    // 既定は ON。弱点を出しておいて何でも通るほうが、示していることと食い違う。
    return (localStorage.getItem(STORAGE_KEY) ?? '1') === '1';
  } catch {
    return true;
  }
}

/** 弱点の読み系統だけを正解にする設定か */
export function isEnabled() {
  if (enabledCache === null) enabledCache = readFromStorage();
  return enabledCache;
}

/** 外から localStorage を書き換えた時（セーブの読み込みなど）に呼ぶ */
export function refresh() {
  enabledCache = readFromStorage();
}

export function setEnabled(on) {
  try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch {}
  enabledCache = !!on;
}

/** 系統の呼び名（子どもに見せる言葉） */
export function labelOf(system) {
  if (system === 'onyomi') return 'おんよみ';
  if (system === 'kunyomi') return 'くんよみ';
  return '';
}

/**
 * この問題で正解にする読みの一覧と、系統をしぼったかどうかを返す。
 *
 * @param {Object} kanji いま出している漢字
 * @param {Object} enemy いま戦っている敵（weakness を持つことがある）
 * @returns {{readings: string[], scopedTo: ('onyomi'|'kunyomi'|null)}}
 *   readings … 正解にする読み（ひらがな正規化済み）
 *   scopedTo … しぼった系統。しぼっていなければ null
 */
export function getAcceptedReadings(kanji, enemy) {
  const all = getReadings(kanji || {});
  if (!isEnabled()) return { readings: all, scopedTo: null };

  const weakness = enemy && enemy.weakness;
  if (weakness !== 'onyomi' && weakness !== 'kunyomi') {
    return { readings: all, scopedTo: null };
  }

  const scoped = getReadingsOf(kanji || {}, weakness);
  // その系統の読みを持っていない字は、しぼると答えようがなくなる
  if (scoped.length === 0) return { readings: all, scopedTo: null };

  return { readings: scoped, scopedTo: weakness };
}

export default { isEnabled, setEnabled, refresh, labelOf, getAcceptedReadings };
