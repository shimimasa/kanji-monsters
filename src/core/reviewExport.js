// src/core/reviewExport.js
//
// 先生が持ち帰れる「ふりかえり」の書き出し。
//
// なぜ要るか:
//   漢字ごとの正誤は kanjiAnswerStats に全部あるのに、外に出す手段が無かった。
//   どの子がどの字でつまずいているかは、次の授業を組み立てる材料そのものなのに、
//   端末の中に閉じていて先生の手元に来ない。
//
// 形式:
//   CSV（Excel/Numbers/スプレッドシートでそのまま開ける）。
//   先頭に BOM を付ける。付けないと Excel が Shift_JIS と解釈して日本語が化ける。
//
// 言葉づかい:
//   子どもが見る画面ではないが、印刷物が本人の目に触れることはある。
//   「まちがい」ではなく「まだ」と書く。数を突きつける形にしない。

import { gameState } from './gameState.js';
import { kanjiData } from '../loaders/dataLoader.js';
import reviewQueue from '../models/reviewQueue.js';
import { getCurrentSlot } from './saveSlots.js';

/** CSV の1項目を安全に囲む（カンマ・引用符・改行を含んでも壊れないように） */
function csvCell(value) {
  const text = (value === null || value === undefined) ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows) {
  // BOM を付けないと Excel が Shift_JIS と解釈して日本語が化ける
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 読みの配列でも旧形式の文字列でも、見出しに出せる形にする */
function joinReadings(value) {
  if (Array.isArray(value)) return value.join(' ');
  return value ? String(value) : '';
}

/** いま遊んでいる子の名前（無ければ空欄にせず分かる形にする） */
export function currentChildLabel() {
  const name = (gameState.playerName || '').trim();
  return name || 'なまえ未設定';
}

/**
 * 漢字ごとのふりかえり。出会ったことのある字だけを並べる。
 * @returns {string} CSV 本文
 */
export function buildKanjiCsv() {
  const stats = gameState.kanjiAnswerStats || {};
  const dueById = new Map(reviewQueue.getAll().map(entry => [String(entry.id), entry]));
  const byId = new Map((kanjiData || []).map(k => [String(k.id), k]));

  const rows = [[
    '学年', '漢字', 'ID', '音読み', '訓読み',
    'よめた回数', 'まだの回数', 'であった回数', 'よめた割合(%)', 'つぎに であう予定'
  ]];

  const ids = Object.keys(stats).sort((a, b) => {
    const ka = byId.get(a), kb = byId.get(b);
    const ga = ka?.grade ?? 99, gb = kb?.grade ?? 99;
    if (ga !== gb) return ga - gb;
    return a.localeCompare(b);
  });

  for (const id of ids) {
    const entry = stats[id] || {};
    const correct = entry.correct || 0;
    const incorrect = entry.incorrect || 0;
    const total = correct + incorrect;
    if (total === 0) continue;

    const k = byId.get(id);
    const due = dueById.get(id);

    rows.push([
      k?.grade ?? '',
      k?.kanji ?? '',
      id,
      joinReadings(k?.onyomi),
      joinReadings(k?.kunyomi),
      correct,
      incorrect,
      total,
      Math.round((correct / total) * 100),
      due ? formatDate(due.nextReviewAt) : ''
    ]);
  }

  return toCsv(rows);
}

/**
 * 日ごとのふりかえり。いつどれだけ読んだかが並ぶ。
 * @returns {string} CSV 本文
 */
export function buildDailyCsv() {
  const daily = gameState.dailyAnswerStats || {};
  const rows = [['日付', 'よめた回数', 'といた回数', 'よめた割合(%)']];

  for (const day of Object.keys(daily).sort()) {
    const entry = daily[day] || {};
    const correct = entry.correct || 0;
    const total = entry.total || 0;
    rows.push([
      day,
      correct,
      total,
      total > 0 ? Math.round((correct / total) * 100) : ''
    ]);
  }

  return toCsv(rows);
}

/** 書き出したものの中身が分かるファイル名にする（子・スロット・日付） */
export function buildFileName(kind) {
  const safeName = currentChildLabel().replace(/[\\\/:*?"<>|\s]/g, '_');
  return `ヨミタビ_${kind}_${safeName}_スロット${getCurrentSlot()}_${formatDate(Date.now())}.csv`;
}

/**
 * CSV をファイルとして保存させる。
 * @param {string} csv
 * @param {string} fileName
 * @returns {boolean} 保存の手続きを始められたか
 */
export function downloadCsv(csv, fileName) {
  try {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // すぐ revoke するとブラウザによっては保存が始まる前に消えるので、少し置く
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 10000);
    return true;
  } catch (e) {
    console.warn('ふりかえりの書き出しに失敗:', e);
    return false;
  }
}

/** 書き出せる中身があるか（空のファイルを渡さないため） */
export function hasAnything() {
  const stats = gameState.kanjiAnswerStats || {};
  return Object.keys(stats).some(id => {
    const entry = stats[id] || {};
    return (entry.correct || 0) + (entry.incorrect || 0) > 0;
  });
}

export default {
  buildKanjiCsv, buildDailyCsv, buildFileName, downloadCsv, hasAnything, currentChildLabel
};
