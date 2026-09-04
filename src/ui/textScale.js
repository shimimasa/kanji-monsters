// src/ui/textScale.js
//
// 文字を大きくする設定。
//
// なぜ要るか:
//   対象は漢字が苦手な子。見えづらさで弾かれる子を作るのは、このゲームの
//   設計思想と食い違う。企画書にも項目だけはあったが、実装は無かった。
//   保存の器（krb_save の settings.bigFont）は既にあり、Firestore にも同期される。
//
// どう実現するか:
//   画面はほぼ canvas で、フォント指定は 199 箇所に散っている。1つずつ直すのは
//   現実的でないうえ、直し漏れがそのまま見えない文字になる。
//   そこで 2D コンテキストの font の代入を1箇所で受けて、px の数値だけを
//   書き換える。呼び出し側は今までどおり書ける。
//
//   ただし文字だけ大きくすると、ボタンや枠から溢れる。
//   小さい文字ほど効きが大きく、大きい文字は増分を頭打ちにする
//   （もともと大きい漢字やタイトルは、これ以上大きくしなくても読める）。

const STORAGE_KEY = 'bigFont';
const SCALE = 1.2;      // 文字の拡大率
const MAX_GAIN_PX = 6;  // 1文字あたりの増分の上限

let installed = false;

// NOTE: font の代入は 1フレームに約200回走る。そのたびに localStorage を読むと
//       毎秒1万回を超える同期読み取りになり、実際にページが固まった。
//       正史は localStorage のままにして、判定用の値はここに持っておく。
let bigFontCache = null;

function readBigFontFromStorage() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** いま大きい文字の設定になっているか（正史は localStorage。krb_save から復元される） */
export function isBigFont() {
  if (bigFontCache === null) bigFontCache = readBigFontFromStorage();
  return bigFontCache;
}

/** 外から localStorage を書き換えた時（セーブの読み込みなど）に呼ぶ */
export function refresh() {
  bigFontCache = readBigFontFromStorage();
  applyToDocument();
}

export function setBigFont(on) {
  try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch {}
  bigFontCache = !!on;
  applyToDocument();
}

/** DOM 側（50音パッドなど）に伝えるための目印と倍率 */
export function applyToDocument() {
  try {
    const on = isBigFont();
    document.documentElement.classList.toggle('yomitabi-big-font', on);
    document.documentElement.style.setProperty('--yomitabi-text-scale', on ? String(SCALE) : '1');
  } catch {}
}

/** 'bold 18px "UDデジタル教科書体", sans-serif' の px だけを大きくする */
export function scaleFontString(value) {
  const text = String(value);
  return text.replace(/(\d+(?:\.\d+)?)px/, (whole, num) => {
    const size = parseFloat(num);
    if (!Number.isFinite(size) || size <= 0) return whole;
    const grown = Math.min(size * SCALE, size + MAX_GAIN_PX);
    return `${Math.round(grown)}px`;
  });
}

/**
 * 2D コンテキストの font の代入を横取りする。
 * 起動時に1回だけ呼ぶ（描画が始まる前）。
 */
export function install() {
  if (installed) return;
  if (typeof CanvasRenderingContext2D === 'undefined') return;

  const proto = CanvasRenderingContext2D.prototype;
  const original = Object.getOwnPropertyDescriptor(proto, 'font');
  if (!original || !original.set || !original.get) return;

  Object.defineProperty(proto, 'font', {
    configurable: true,
    enumerable: original.enumerable,
    get() {
      return original.get.call(this);
    },
    set(value) {
      // NOTE: 読み出しは書き換えた後の値を返す。ctx.font を読んで加工している
      //       箇所が増えると二重に拡大されるので、そういう書き方はしないこと
      //       （現状 src 全体に読み出しは無いことを確認済み）。
      original.set.call(this, isBigFont() ? scaleFontString(value) : value);
    }
  });

  installed = true;
  refresh();
}

export default { install, isBigFont, setBigFont, refresh, applyToDocument, scaleFontString };
