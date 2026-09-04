// src/ui/kanaPad.js
//
// ゲームの中に持つ50音パッド。
//
// なぜ要るか:
//   読みの入力は端末のキーボードに任せていたが、入力欄には仕様に無い
//   inputmode="kana" が指定されていた（有効値は none/text/tel/url/email/
//   numeric/decimal/search）。ブラウザはこれを無視するので、子どもには
//   「その端末で最後に使われたキーボード」が出る。ローマ字入力が出てきた
//   時点で、漢字が苦手な低学年の子はそこで手が止まる。
//   50音表なら、学校で見慣れた並びのまま、指1本で読みを書ける。
//
// 作りの方針:
//   各画面は #kanjiInput の keydown で Enter を拾って答え合わせをしている。
//   このパッドは値を書き込んで Enter を投げるだけにして、画面側のロジックには
//   触らない。表示・非表示も入力欄の display を見て自分で決める。

/** 五十音表（左から あ行→わ行、上から あ段→お段）。null は空きマス */
const GOJUON_ROWS = [
  ['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ'],
  ['い', 'き', 'し', 'ち', 'に', 'ひ', 'み', null, 'り', 'を'],
  ['う', 'く', 'す', 'つ', 'ぬ', 'ふ', 'む', 'ゆ', 'る', 'ん'],
  ['え', 'け', 'せ', 'て', 'ね', 'へ', 'め', null, 'れ', null],
  ['お', 'こ', 'そ', 'と', 'の', 'ほ', 'も', 'よ', 'ろ', null]
];

/** 「゛」を付ける／外す */
const DAKUTEN = {
  'か':'が','き':'ぎ','く':'ぐ','け':'げ','こ':'ご',
  'さ':'ざ','し':'じ','す':'ず','せ':'ぜ','そ':'ぞ',
  'た':'だ','ち':'ぢ','つ':'づ','て':'で','と':'ど',
  'は':'ば','ひ':'び','ふ':'ぶ','へ':'べ','ほ':'ぼ',
  'う':'ゔ'
};

/** 「゜」を付ける／外す */
const HANDAKUTEN = { 'は':'ぱ','ひ':'ぴ','ふ':'ぷ','へ':'ぺ','ほ':'ぽ' };

/** 大きい仮名 ⇔ 小書き */
const SMALL = {
  'あ':'ぁ','い':'ぃ','う':'ぅ','え':'ぇ','お':'ぉ',
  'や':'ゃ','ゆ':'ゅ','よ':'ょ','つ':'っ','わ':'ゎ'
};

/** 値→キーの逆引きを作る */
const invert = (map) => Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));
const UNDAKUTEN = invert(DAKUTEN);
const UNHANDAKUTEN = invert(HANDAKUTEN);
const UNSMALL = invert(SMALL);

/** 押すたびに付け外しする（同じキーを2回押せば元に戻る） */
function toggleLastChar(text, addMap, removeMap) {
  if (!text) return text;
  const last = text[text.length - 1];
  const next = removeMap[last] || addMap[last];
  if (!next) return text; // 変えられない文字は触らない
  return text.slice(0, -1) + next;
}

const STYLE_ID = 'kanaPadStyle';
const PAD_ID = 'kanaPad';

const CSS = `
#${PAD_ID} {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2147483646;
  box-sizing: border-box;
  padding: 6px 6px calc(6px + env(safe-area-inset-bottom, 0px));
  background: rgba(28, 35, 48, 0.97);
  border-top: 2px solid rgba(255, 255, 255, 0.18);
  display: none;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
}
#${PAD_ID}.kanaPad--open { display: block; }
#${PAD_ID} .kanaPad__grid {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 4px;
  max-width: 720px;
  margin: 0 auto;
}
#${PAD_ID} .kanaPad__tools {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  max-width: 720px;
  margin: 6px auto 0;
}
#${PAD_ID} button {
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 8px;
  background: #3b4a63;
  color: #fff;
  font-family: "UDデジタル教科書体", "Hiragino Sans", sans-serif;
  font-size: clamp(15px, 3.6vw, 24px);
  font-weight: bold;
  padding: 0;
  /* 横に広い端末（iPadの横向きなど）で高くなりすぎないよう、画面の高さでも抑える */
  height: clamp(30px, min(7.2vw, 6.2vh), 46px);
  line-height: 1;
  cursor: pointer;
}
#${PAD_ID} button:active { background: #5a7196; transform: translateY(1px); }
#${PAD_ID} button.kanaPad__blank { visibility: hidden; }
#${PAD_ID} .kanaPad__tools button { background: #4a5b78; font-size: clamp(13px, 3vw, 19px); }
#${PAD_ID} .kanaPad__tools button.kanaPad__submit { background: #2f8f4e; }
#${PAD_ID} .kanaPad__tools button.kanaPad__erase { background: #6b5a3a; }
`;

const KanaPad = {
  el: null,
  inputEl: null,
  _observer: null,
  _installed: false,

  /** 端末のキーボードを使う設定になっているか（正史は localStorage） */
  isEnabled() {
    try {
      return (localStorage.getItem('inputMethod') || 'kanaPad') !== 'device';
    } catch {
      return true;
    }
  },

  /**
   * 起動時に1回だけ呼ぶ。入力欄は index.html に静的に置かれているので、
   * ここで捕まえて display の変化を見張る。
   */
  install() {
    if (this._installed) return;
    this.inputEl = document.getElementById('kanjiInput');
    if (!this.inputEl) return;

    this._injectStyle();
    this._buildPad();

    // 入力欄の見え方が変わったらパッドの出し入れを合わせる。
    // 各画面が style を直接いじる作りなので、属性の変化を見るのが確実。
    this._observer = new MutationObserver(() => this.sync());
    this._observer.observe(this.inputEl, { attributes: true, attributeFilter: ['style', 'hidden'] });
    window.addEventListener('resize', () => this._notifyLayout());

    this._installed = true;
    this.sync();
  },

  _injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  },

  _buildPad() {
    if (document.getElementById(PAD_ID)) {
      this.el = document.getElementById(PAD_ID);
      return;
    }
    const pad = document.createElement('div');
    pad.id = PAD_ID;

    const grid = document.createElement('div');
    grid.className = 'kanaPad__grid';
    for (const row of GOJUON_ROWS) {
      for (const kana of row) {
        grid.appendChild(this._makeKey(kana));
      }
    }
    pad.appendChild(grid);

    const tools = document.createElement('div');
    tools.className = 'kanaPad__tools';
    // 「゛」「゜」だけだと点の数の差が小さくて見分けにくいので、呼び名を添える
    tools.appendChild(this._makeTool('てんてん ゛', () => this._modifyLast(DAKUTEN, UNDAKUTEN)));
    tools.appendChild(this._makeTool('まる ゜', () => this._modifyLast(HANDAKUTEN, UNHANDAKUTEN)));
    tools.appendChild(this._makeTool('ちいさく', () => this._modifyLast(SMALL, UNSMALL)));
    tools.appendChild(this._makeTool('けす', () => this._backspace(), 'kanaPad__erase'));
    tools.appendChild(this._makeTool('よむ！', () => this._submit(), 'kanaPad__submit'));
    pad.appendChild(tools);

    document.body.appendChild(pad);
    this.el = pad;
  },

  _makeKey(kana) {
    const btn = document.createElement('button');
    btn.type = 'button';
    if (kana === null) {
      btn.className = 'kanaPad__blank';
      btn.disabled = true;
      btn.textContent = '　';
      return btn;
    }
    btn.textContent = kana;
    this._bindPress(btn, () => this._insert(kana));
    return btn;
  },

  _makeTool(label, action, extraClass) {
    const btn = document.createElement('button');
    btn.type = 'button';
    if (extraClass) btn.className = extraClass;
    btn.textContent = label;
    this._bindPress(btn, action);
    return btn;
  },

  /**
   * 押した瞬間に反応させる。既定動作を止めるのは、入力欄からフォーカスが
   * 外れたり、押した拍子に画面がスクロールするのを防ぐため。
   */
  _bindPress(btn, action) {
    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      action();
    };
    btn.addEventListener('pointerdown', handler);
    // pointer 非対応の端末向け
    btn.addEventListener('touchstart', handler, { passive: false });
  },

  _setValue(next) {
    if (!this.inputEl) return;
    this.inputEl.value = next;
    // 画面側が input を見て何かしている場合に備えて通知しておく
    this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
  },

  _insert(kana) {
    if (!this.inputEl) return;
    // 読みが12文字を超えることはない。押しっぱなしの暴発を止めるための上限
    if (this.inputEl.value.length >= 12) return;
    this._setValue(this.inputEl.value + kana);
  },

  _modifyLast(addMap, removeMap) {
    if (!this.inputEl) return;
    this._setValue(toggleLastChar(this.inputEl.value, addMap, removeMap));
  },

  _backspace() {
    if (!this.inputEl) return;
    this._setValue(this.inputEl.value.slice(0, -1));
  },

  /** 各画面がすでに持っている Enter の処理に乗せる */
  _submit() {
    if (!this.inputEl) return;
    this.inputEl.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      bubbles: true,
      cancelable: true
    }));
  },

  /** 入力欄が見えているか */
  _isInputVisible() {
    const el = this.inputEl;
    if (!el || el.hidden) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  },

  /** 入力欄の見え方に合わせてパッドを出し入れする */
  sync() {
    if (!this.el || !this.inputEl) return;
    const shouldOpen = this.isEnabled() && this._isInputVisible();
    const isOpen = this.el.classList.contains('kanaPad--open');
    if (shouldOpen === isOpen) return;

    this.el.classList.toggle('kanaPad--open', shouldOpen);
    // パッドを出す時は端末のキーボードが出ないようにする。
    // readOnly なら iPad でもタップでキーボードが上がってこない。
    this.inputEl.readOnly = shouldOpen;
    if (shouldOpen) {
      try { this.inputEl.blur(); } catch {}
    }
    this._notifyLayout();
  },

  /** パッドの高さを画面側に知らせる（入力欄と盤面の位置合わせに使う） */
  _notifyLayout() {
    if (!this.el) return;
    const open = this.el.classList.contains('kanaPad--open');
    const height = open ? this.el.offsetHeight : 0;
    window.dispatchEvent(new CustomEvent('kanapad:layout', { detail: { open, height } }));
  }
};

export default KanaPad;
