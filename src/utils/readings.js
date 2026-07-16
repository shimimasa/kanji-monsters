// src/utils/readings.js
// 読み（音読み/訓読み）の正規化と取得の共通実装。
// 漢字データの onyomi/kunyomi は配列が正史だが、旧形式（スペース区切り文字列）にも対応する。
// ※ reviewStage / gradeQuiz / worldStageSelect に文字列前提のコピーが存在し、
//    配列データで TypeError になっていたため、battleScreen 版（両対応）へ集約した。

const hiraShift = (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60);
const toHira = (s) => s.replace(/[ァ-ヶ]/g, hiraShift).trim();

/**
 * 入力文字列を判定用のひらがなに正規化する（トリム・空白除去・カタカナ→ひらがな）
 * @param {string} input
 * @returns {string}
 */
export function toHiragana(input) {
  if (!input) return '';
  // 全角スペース、半角スペースをトリム
  let normalized = String(input).trim().replace(/\s+/g, '');
  // カタカナをひらがなに変換
  normalized = toHira(normalized);
  return normalized;
}

/**
 * 漢字データから正解となる読みの一覧（ひらがな正規化済み）を返す
 * @param {{onyomi?: string[]|string, kunyomi?: string[]|string}} k
 * @returns {string[]}
 */
export function getReadings(k) {
  const set = new Set();

  // kunyomiの処理：配列か文字列かをチェック
  if (k.kunyomi) {
    if (Array.isArray(k.kunyomi)) {
      k.kunyomi.forEach(r => {
        if (r && typeof r === 'string') {
          set.add(toHira(r.trim()));
        }
      });
    } else if (typeof k.kunyomi === 'string') {
      k.kunyomi.split(' ').forEach(r => {
        if (r) set.add(toHira(r.trim()));
      });
    }
  }

  // onyomiの処理：配列か文字列かをチェック
  if (k.onyomi) {
    if (Array.isArray(k.onyomi)) {
      k.onyomi.forEach(r => {
        if (r && typeof r === 'string') {
          set.add(toHira(r.trim()));
        }
      });
    } else if (typeof k.onyomi === 'string') {
      k.onyomi.split(' ').forEach(r => {
        if (r) set.add(toHira(r.trim()));
      });
    }
  }

  return [...set].filter(Boolean); // undefined や空文字を除外
}
