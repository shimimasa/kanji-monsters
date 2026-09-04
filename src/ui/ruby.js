// src/ui/ruby.js
//
// 画面の漢字に、必要なところだけ ふりがな を振る。
//
// なぜ要るか:
//   監査②で2つ挙がっていた。UIに配当外の漢字が出ていることと、図鑑の文が
//   低学年には読めないこと。どちらも「読めない字が、読み方の分からないまま
//   出ている」という同じ問題なので、表示側で1本にして解ける。
//   対象は漢字が苦手な子なのに、案内の文が読めないせいで進めないのでは筋が通らない。
//
// どう実現するか:
//   textScale が font の代入を横取りしているのと同じ考え方で、2Dコンテキストの
//   fillText を1箇所で受ける。呼び出し側は今までどおり書ける。
//   子どもが目にする描画は 70箇所ほどに散っていて、1つずつ直すと必ず漏れる。
//
// 絶対に守ること:
//   1) **辞書に載っている語だけに振る。推測はしない。**
//      漢字1字の読みは文脈で変わる（「生」は せい／しょう／なま／き）。
//      機械的に振ると平気で嘘のふりがなが出る。読めない子に嘘を渡すのは、
//      何も振らないより悪い。
//   2) **1文字の語は辞書に入れない。**
//      バトルの出題は漢字を1字だけ大きく出す。1字の語に振ると答えがそのまま見える。
//      2文字以上に限れば、出題に触れずに済む。

const STORAGE_KEY = 'rubyMode';

let installed = false;

// NOTE: fillText は1フレームに何十回も走る。textScale で毎フレーム localStorage を
//       読んでページが固まった前例があるので、判定用の値はここに持っておく。
let enabledCache = null;

/**
 * ふりがなを振る語。**ここに無い語には振らない。**
 *
 * 子どもが実際に目にする描画（fillText / ボタンのラベル / ログ）を機械抽出し、
 * 1〜2年の配当に無い漢字を含む文字列から拾った。
 * 1文字の語は上の決まりのとおり入れない。
 */
const RUBY_WORDS = {
  // 画面の名前・行き先
  '漢字': 'かんじ',
  '全漢字': 'ぜんかんじ',
  '図鑑': 'ずかん',
  '漢字図鑑': 'かんじずかん',
  '選択': 'せんたく',
  '冒険': 'ぼうけん',
  '冒険先': 'ぼうけんさき',
  '挑戦': 'ちょうせん',
  '大陸': 'たいりく',
  '地方': 'ちほう',
  '設定': 'せってい',
  '一覧': 'いちらん',
  '次のページ': 'つぎのページ',
  '閉じる': 'とじる',
  'もう一度': 'もういちど',

  // 学びの言葉
  '復習': 'ふくしゅう',
  '総復習': 'そうふくしゅう',
  '学習': 'がくしゅう',
  '学習中': 'がくしゅうちゅう',
  '学年': 'がくねん',
  '学年順': 'がくねんじゅん',
  '画数': 'かくすう',
  '画数順': 'かくすうじゅん',
  '習熟度': 'しゅうじゅくど',
  '習熟度順': 'しゅうじゅくどじゅん',
  '習得': 'しゅうとく',
  '部首': 'ぶしゅ',
  '音読み': 'おんよみ',
  '訓読み': 'くんよみ',
  '目安': 'めやす',
  '正解': 'せいかい',
  '正解数': 'せいかいすう',
  '不正解': 'ふせいかい',
  '不正解数': 'ふせいかいすう',
  '結果': 'けっか',
  '結果発表': 'けっかはっぴょう',
  '進捗': 'しんちょく',
  '履歴': 'りれき',
  '統計': 'とうけい',
  '連続': 'れんぞく',
  '最高': 'さいこう',
  '現在': 'げんざい',
  '前回': 'ぜんかい',
  '実績': 'じっせき',
  '戦績': 'せんせき',
  '解除': 'かいじょ',
  '解除済': 'かいじょずみ',
  '未解除': 'みかいじょ',
  '収集済': 'しゅうしゅうずみ',
  '状況': 'じょうきょう',
  '通常': 'つうじょう',
  '解放': 'かいほう',
  '最適': 'さいてき',
  '自動': 'じどう',
  '獲得': 'かくとく',
  '準備': 'じゅんび',
  '準備中': 'じゅんびちゅう',

  // バトルの言葉
  '攻撃': 'こうげき',
  '攻撃力': 'こうげきりょく',
  '防御': 'ぼうぎょ',
  '態勢': 'たいせい',
  '最大値': 'さいだいち',
  '上限': 'じょうげん',
  '弱点': 'じゃくてん',

  // 地方の名前（読みが割れやすいので入れておく）
  '北海道': 'ほっかいどう',
  '東北': 'とうほく',
  '関東': 'かんとう',
  '中部': 'ちゅうぶ',
  '近畿': 'きんき',
  '中国': 'ちゅうごく',
  '四国': 'しこく',
  '九州': 'きゅうしゅう',
  '奥地': 'おくち',
  '市街地': 'しがいち'
};

/** 実際に引く辞書（1文字の語は落とす） */
const DICT = (() => {
  const map = new Map();
  for (const [word, reading] of Object.entries(RUBY_WORDS)) {
    // 1文字の語は入れない。バトルの出題（漢字1字）に振ってしまうため
    if (!reading || word.length < 2) continue;
    map.set(word, reading);
  }
  return map;
})();

/** 辞書の最長語。最長一致で見る幅に使う */
const MAX_WORD_LENGTH = (() => {
  let max = 0;
  for (const word of DICT.keys()) max = Math.max(max, word.length);
  return max;
})();

const HAS_KANJI = /[一-鿿]/;
const PX_IN_FONT = /(\d+(?:\.\d+)?)px/;

function readFromStorage() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** ふりがなを振る設定になっているか */
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

// 同じ文字列が毎フレーム来るので、区切った結果を覚えておく。
// ふりがなの要らない文字列（ほとんどがこれ）は null を覚えて素通しにする。
const segmentCache = new Map();
const SEGMENT_CACHE_LIMIT = 500;

/**
 * 文字列を「ふりがなを振る区間」と「そのままの区間」に分ける。
 * 辞書の最長一致。載っていない語には触らない。
 *
 * @param {string} text
 * @returns {Array<{text: string, ruby: string|null}>|null} 振るものが無ければ null
 */
export function segment(text) {
  if (!text || !HAS_KANJI.test(text)) return null;

  const cached = segmentCache.get(text);
  if (cached !== undefined) return cached;

  const parts = [];
  let plain = '';
  let found = false;

  for (let i = 0; i < text.length;) {
    let hit = null;
    const limit = Math.min(MAX_WORD_LENGTH, text.length - i);
    for (let len = limit; len >= 2; len--) {
      const candidate = text.substr(i, len);
      const reading = DICT.get(candidate);
      if (reading) { hit = { word: candidate, reading }; break; }
    }

    if (hit) {
      if (plain) { parts.push({ text: plain, ruby: null }); plain = ''; }
      parts.push({ text: hit.word, ruby: hit.reading });
      i += hit.word.length;
      found = true;
    } else {
      plain += text[i];
      i++;
    }
  }
  if (plain) parts.push({ text: plain, ruby: null });

  const result = found ? parts : null;
  if (segmentCache.size >= SEGMENT_CACHE_LIMIT) segmentCache.clear();
  segmentCache.set(text, result);
  return result;
}

// 幅の計測は、ふりがなを振る文字列1つにつき何回も走る。
// 同じ字を同じフォントで測り直す必要は無いので覚えておく。
const widthCache = new Map();
const WIDTH_CACHE_LIMIT = 1000;

function measureCached(ctx, text) {
  const key = ctx.font + '|' + text;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  const width = ctx.measureText(text).width;
  if (widthCache.size >= WIDTH_CACHE_LIMIT) widthCache.clear();
  widthCache.set(key, width);
  return width;
}

/** 本文のフォント指定から、ふりがな用の小さいフォント指定を作る */
function rubyFontOf(font) {
  const text = String(font || '');
  const match = text.match(PX_IN_FONT);
  if (!match) return null;
  const size = parseFloat(match[1]);
  if (!Number.isFinite(size) || size <= 0) return null;
  // 小さくしすぎると読めない。本文の半分、ただし10px は下回らない
  const rubySize = Math.max(10, Math.round(size * 0.5));
  return { font: text.replace(PX_IN_FONT, rubySize + 'px'), size: rubySize };
}

/** textAlign を見て、文字列の左端がどこに来るかを出す */
function leftEdgeOf(ctx, x, width) {
  switch (ctx.textAlign) {
    case 'center':
      return x - width / 2;
    case 'right':
    case 'end':
      return x - width;
    default:
      return x;
  }
}

/** textBaseline を見て、本文の上端がどこに来るかを出す */
function topEdgeOf(ctx, y, size) {
  switch (ctx.textBaseline) {
    case 'top':
    case 'hanging':
      return y;
    case 'middle':
      return y - size / 2;
    case 'bottom':
    case 'ideographic':
      return y - size;
    default: // alphabetic
      return y - size * 0.8;
  }
}

/**
 * 2Dコンテキストの fillText を横取りして、辞書に載っている語にふりがなを足す。
 * 起動時に1回だけ呼ぶ（描画が始まる前）。
 */
export function install() {
  if (installed) return;
  if (typeof CanvasRenderingContext2D === 'undefined') return;

  const proto = CanvasRenderingContext2D.prototype;
  const originalFillText = proto.fillText;
  if (typeof originalFillText !== 'function') return;

  // ふりがな自身を描く時に、この横取りへ再び入らないようにするための目印
  let drawingRuby = false;

  proto.fillText = function (text, x, y, maxWidth) {
    // 本文はいつもどおり描く。ふりがなはその上に足すだけ
    if (maxWidth === undefined) originalFillText.call(this, text, x, y);
    else originalFillText.call(this, text, x, y, maxWidth);

    if (drawingRuby) return;
    if (!isEnabled()) return;
    if (typeof text !== 'string') return;

    const parts = segment(text);
    if (!parts) return;

    const ruby = rubyFontOf(this.font);
    if (!ruby) return;

    const baseFont = this.font;
    const baseSize = parseFloat((baseFont.match(PX_IN_FONT) || [])[1]) || 16;
    const totalWidth = measureCached(this, text);

    let cursor = leftEdgeOf(this, x, totalWidth);
    const rubyY = topEdgeOf(this, y, baseSize) - 2;

    drawingRuby = true;
    this.save();
    this.textAlign = 'center';
    this.textBaseline = 'bottom';

    for (const part of parts) {
      const width = measureCached(this, part.text);
      if (part.ruby) {
        this.font = ruby.font;
        // 下の絵に負けないよう、細く縁を取ってから塗る
        this.lineWidth = 3;
        this.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        this.strokeText(part.ruby, cursor + width / 2, rubyY);
        originalFillText.call(this, part.ruby, cursor + width / 2, rubyY);
        this.font = baseFont;
      }
      cursor += width;
    }

    this.restore();
    drawingRuby = false;
  };

  installed = true;
  refresh();
}

export default { install, isEnabled, setEnabled, refresh, segment };
