// src/core/exampleMode.js
//
// 「例文の中で読ませる」出題モード。
//
// なぜ要るか:
//   単漢字だけを見せて読ませると、「読める」が字と読みの1対1の記憶で止まりやすい。
//   文の中に置かれた時にどう読むかは別の力で、そこが実際に本を読む力につながる。
//   「生」を せい とだけ覚えた子は、「生きる」を読めないままになる。
//
// どこまでやるか:
//   例文データ（examples）を持っているのは1年の80字だけで、他の学年は0件。
//   持っていない字では今までどおり単漢字で出す。モード自体は既定で OFF にして、
//   1年の子に使う時だけ先生が入れる形にした。
//
// 出題の作り方:
//   例文は「学校（ガッコウ）で 字（ジ）を 学（まな）ぶ。」のように、漢字のうしろに
//   丸かっこで読みが添えてある。答えにあたる丸かっこだけを（？）に伏せる。
//   ほかの丸かっこは、1年生がその文を読むための助けなので残す。
//   伏せるところが見つからない例文は使わない（答えが見えたままになるため）。

import { toHiragana } from '../utils/readings.js';

const STORAGE_KEY = 'exampleMode';

// NOTE: 出題のたびに参照するので localStorage は読みに行かない
//       （textScale / palette と同じ作り）
let enabledCache = null;

function readFromStorage() {
  try {
    // 既定は OFF。例文を持つのが1年の80字だけなので、全員に入れる設定ではない
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** 例文モードになっているか */
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

/** 伏せ字。丸かっこの中がここに置き換わる */
export const BLANK = '？';

/**
 * 答えにあたる丸かっこだけを（？）に伏せる。
 * ほかの丸かっこ（読みの助け）は残す。
 *
 * @param {string} sentence 例文
 * @param {string} answer ひらがな正規化済みの答え
 * @returns {string|null} 伏せた例文。伏せるところが無ければ null
 */
export function blankOutReading(sentence, answer) {
  if (!sentence || !answer) return null;

  let done = false;
  const blanked = String(sentence).replace(/[（(]([^）)]*)[）)]/g, (whole, inner) => {
    if (done) return whole;
    if (toHiragana(inner) !== answer) return whole;
    done = true;
    return `（${BLANK}）`;
  });

  return done ? blanked : null;
}

/**
 * その漢字のすぐうしろに付いている丸かっこを伏せ、中身を答えにする。
 *
 * examples の reading と例文の中身がずれている字がいくつかあるため
 * （「本」は reading が もと なのに例文は 本（ホン）、
 *   「生」は い なのに 生（は）える）、読みからは探せない。
 * 例文に書いてあるほうを正としてそこを伏せる。文の中でどう読むかを
 * 問うモードなので、その文での読みが答えで正しい。
 *
 * @param {string} sentence
 * @param {string} word 例文の中で読ませたい語（多くはその漢字1字）
 * @returns {{sentence: string, answer: string}|null}
 */
function blankOutAfterWord(sentence, word) {
  if (!sentence || !word) return null;

  const index = String(sentence).indexOf(word + '（');
  if (index === -1) return null;

  const open = index + word.length;
  const close = String(sentence).indexOf('）', open);
  if (close === -1) return null;

  const answer = toHiragana(String(sentence).slice(open + 1, close));
  if (!answer) return null;

  return {
    sentence: String(sentence).slice(0, open) + `（${BLANK}）` + String(sentence).slice(close + 1),
    answer
  };
}

/**
 * 例文データから1問組み立てる（設定は見ない。設定込みの入口は getQuestion）。
 *
 * @param {Object} kanji
 * @returns {{sentence: string, answer: string, word: string}|null}
 */
export function buildQuestion(kanji) {
  const examples = kanji && Array.isArray(kanji.examples) ? kanji.examples : null;
  if (!examples || examples.length === 0) return null;

  const ex = examples[0];
  if (!ex || !ex.sentence) return null;

  const word = ex.word || kanji.text || kanji.kanji || '';

  // 1) 例文の reading が入った丸かっこを伏せる（多くはこれで足りる）
  const answer = toHiragana(ex.reading || '');
  if (answer) {
    const sentence = blankOutReading(ex.sentence, answer);
    if (sentence) return { sentence, answer, word };
  }

  // 2) reading と例文がずれている字は、漢字のうしろの丸かっこを伏せる
  const byWord = blankOutAfterWord(ex.sentence, word);
  if (byWord) return { sentence: byWord.sentence, answer: byWord.answer, word };

  // 伏せるところが無い例文は使わない（答えが見えたままになる）
  return null;
}

/**
 * いまの設定で、この漢字を例文の問題にできるなら返す。
 * モードが OFF か、例文を持たない字なら null（＝今までどおり単漢字で出す）。
 */
export function getQuestion(kanji) {
  if (!isEnabled()) return null;
  return buildQuestion(kanji);
}

export default { isEnabled, setEnabled, refresh, getQuestion, buildQuestion, blankOutReading, BLANK };
