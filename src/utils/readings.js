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

/* ------------------------------------------------------------------ */
/*  「おしい」入力の判定                                                */
/* ------------------------------------------------------------------ */
//
// このゲームは「読める」ことを育てる場なので、読めているのに書き方だけが
// ずれた入力（きよう／きょう、かっこう／がっこう など）を「読めなかった」
// として学習記録に残すのは正しくない。
// ここでは書き方のゆれだけを畳んで比較し、呼び出し側が「おしい、もういちど」
// として無傷でやり直させるための材料を返す。

/** 四つ仮名のゆれ（ぢ/じ・づ/ず）を寄せる */
const YOTSUGANA = { 'ぢ': 'じ', 'づ': 'ず' };

/** 濁点・半濁点を外して清音にする */
const SEION = {
  'が':'か','ぎ':'き','ぐ':'く','げ':'け','ご':'こ',
  'ざ':'さ','じ':'し','ず':'す','ぜ':'せ','ぞ':'そ',
  'だ':'た','ぢ':'ち','づ':'つ','で':'て','ど':'と',
  'ば':'は','び':'ひ','ぶ':'ふ','べ':'へ','ぼ':'ほ',
  'ぱ':'は','ぴ':'ひ','ぷ':'ふ','ぺ':'へ','ぽ':'ほ',
  'ゔ':'う'
};

/** 小書きの仮名を大きい仮名にする */
const KOGAKI = {
  'ゃ':'や','ゅ':'ゆ','ょ':'よ','っ':'つ','ゎ':'わ',
  'ぁ':'あ','ぃ':'い','ぅ':'う','ぇ':'え','ぉ':'お'
};

/** 清音のかな → 母音（長音符「ー」を母音に開くために使う） */
const VOWEL_OF = (() => {
  const rows = {
    'あ': 'あかさたなはまやらわ',
    'い': 'いきしちにひみり',
    'う': 'うくすつぬふむゆる',
    'え': 'えけせてねへめれ',
    'お': 'おこそとのほもよろを'
  };
  const map = {};
  for (const [vowel, kana] of Object.entries(rows)) {
    for (const ch of kana) map[ch] = vowel;
  }
  return map;
})();

const applyMap = (s, map) => [...s].map(ch => map[ch] || ch).join('');

/** 長音符「ー」を直前のかなの母音に開く（こー → こお） */
function openLongVowel(s) {
  let out = '';
  for (const ch of s) {
    if (ch === 'ー' || ch === '－' || ch === '―') {
      const prev = out[out.length - 1];
      out += (prev && VOWEL_OF[prev]) ? VOWEL_OF[prev] : '';
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * のばす音の書き方を寄せる。
 * お段の次の「う」は「お」と同じ音（こうえん／こおえん）、
 * え段の次の「い」は「え」と同じ音（せんせい／せんせえ）。
 */
function normalizeLongVowel(s) {
  let out = '';
  for (const ch of s) {
    const prevVowel = VOWEL_OF[out[out.length - 1]];
    if (ch === 'う' && prevVowel === 'お') out += 'お';
    else if (ch === 'い' && prevVowel === 'え') out += 'え';
    else out += ch;
  }
  return out;
}

/** 書き表し方のゆれだけを畳む。読みとして同じなら同じ文字列になる */
export function foldWritingVariants(input) {
  let s = toHiragana(input);
  s = applyMap(s, YOTSUGANA);   // ぢ→じ・づ→ず（清音化の前に寄せる）
  s = applyMap(s, SEION);       // 濁点・半濁点を外す
  s = applyMap(s, KOGAKI);      // 小書き → 大きい仮名
  s = openLongVowel(s);         // ー → 直前の母音
  s = normalizeLongVowel(s);    // お段＋う → お段＋お など
  return s;
}

/**
 * 入力が「読みとしては合っているのに書き方だけずれている」かを判定する。
 * @param {string} input 子どもが入力した文字列
 * @param {string[]} correctReadings getReadings() の戻り値
 * @returns {{reading: string, kind: string}|null} near-miss なら該当の読みと種類、違えば null
 */
export function findNearMiss(input, correctReadings) {
  const answer = toHiragana(input);
  if (!answer) return null;
  // 完全一致は near-miss ではない（正解として扱う側の仕事）
  if (correctReadings.includes(answer)) return null;

  const folded = foldWritingVariants(answer);
  for (const reading of correctReadings) {
    if (foldWritingVariants(reading) !== folded) continue;
    return { reading, kind: classifyDifference(answer, reading) };
  }
  return null;
}

/**
 * どのゆれで外したのかを見分ける。案内の文言を選ぶために使う。
 * @returns {'kogaki'|'dakuten'|'yotsugana'|'chouon'|'other'}
 */
function classifyDifference(answer, reading) {
  const a = toHiragana(answer);
  const r = toHiragana(reading);
  if (applyMap(a, KOGAKI) === applyMap(r, KOGAKI)) return 'kogaki';
  if (applyMap(a, YOTSUGANA) === applyMap(r, YOTSUGANA)) return 'yotsugana';
  if (applyMap(a, SEION) === applyMap(r, SEION)) return 'dakuten';
  const longVowel = (s) => normalizeLongVowel(openLongVowel(s));
  if (longVowel(a) === longVowel(r)) return 'chouon';
  return 'other';
}

/** near-miss の種類ごとの、子どもに向けた案内文 */
const NEAR_MISS_MESSAGES = {
  kogaki:    'ちいさい「ゃ・ゅ・ょ・っ」で かいてみよう',
  dakuten:   '「゛」や「゜」が いるか みてみよう',
  yotsugana: '「じ」と「ぢ」、「ず」と「づ」の ちがいだよ',
  chouon:    'のばす ところを もういちど',
  other:     'もうすこしで ぴったりだよ'
};

/**
 * near-miss の案内文を返す。2回目からは正しい書き方も見せて、行き止まりにしない。
 * @param {{reading: string, kind: string}} nearMiss findNearMiss() の戻り値
 * @param {number} attempt この問題で near-miss になった回数（1始まり）
 * @returns {string[]} 表示用の行
 */
export function getNearMissLines(nearMiss, attempt = 1) {
  const lines = ['よめてるよ！ おしい！', NEAR_MISS_MESSAGES[nearMiss.kind] || NEAR_MISS_MESSAGES.other];
  if (attempt >= 2) lines.push(`「${nearMiss.reading}」だよ`);
  return lines;
}
