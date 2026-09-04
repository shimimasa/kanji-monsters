// src/screens/Dex/proverbDexScreen.js
//
// ことわざ図鑑。
//
// なぜ要るか:
//   public/data に ことわざ400件（読み・意味・例文・結びつくゴトモン名つき）が
//   用意されていたのに、src からは一度も参照されていなかった。
//   バトルの手ざわりは変えずに、読み物として置く。
//   早く終わった子の待ち時間や、読めた子へのごほうびに使える。
//
// どこまで出すか:
//   既定は「小学生」向けの147件だけ。中学生以上の253件は、選び直した時だけ出す。
//   読めない語がずらりと並ぶ画面を最初に見せない（対象は漢字が苦手な子）。
//
// 作り:
//   漢字図鑑と同じく DOM で組む（canvas は裏に隠す）。文章を読ませる画面なので、
//   canvas に自前で折り返しを書くより、ブラウザに任せるほうが確実で速い。

import { publish } from '../../core/eventBus.js';
import { gameState } from '../../core/gameState.js';
import { loadProverbs } from '../../loaders/dataLoader.js';
import { toDisplayReading } from '../../utils/romaji.js';

/** 出す範囲。既定は小学生 */
const LEVELS = [
  { value: '小学生', label: '小学生むけ' },
  { value: '中学生', label: '中学生むけ' },
  { value: '高校生', label: '高校生むけ' },
  { value: '一般',   label: 'おとなむけ' },
  { value: 'all',    label: 'ぜんぶ' }
];

const proverbDexScreen = {
  canvas: null,
  ctx: null,
  container: null,
  proverbs: [],
  level: '小学生',
  keyword: '',

  enter(arg) {
    this.canvas = (arg && typeof arg.getContext === 'function')
      ? arg
      : document.getElementById('gameCanvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    publish('playBGM', 'bgm_kanjiDex');

    // 背面のキャンバスを隠す（前の画面が透けないように）
    this._canvasRef = this.canvas || null;
    if (this._canvasRef) {
      this._prevCanvasVisibility = this._canvasRef.style.visibility;
      this._prevCanvasPointer = this._canvasRef.style.pointerEvents;
      this._canvasRef.style.visibility = 'hidden';
      this._canvasRef.style.pointerEvents = 'none';
    }

    this.level = '小学生';
    this.keyword = '';
    this._buildUI();

    // データは開いた時に初めて取りに行く
    loadProverbs().then(list => {
      this.proverbs = Array.isArray(list) ? list : [];
      this._renderList();
    });

    this._keyHandler = (e) => {
      if (e.key === 'Escape') this._goBack();
    };
    window.addEventListener('keydown', this._keyHandler);
  },

  _goBack() {
    publish('playSE', 'decide');
    publish('changeScreen', 'kanjiDex');
  },

  _buildUI() {
    const container = document.createElement('div');
    container.id = 'proverbDexContainer';
    Object.assign(container.style, {
      position: 'fixed',
      inset: '0',
      background: 'linear-gradient(160deg, #2c1810, #1a0f0a)',
      color: '#f5efe6',
      fontFamily: '"UDデジタル教科書体", "Hiragino Maru Gothic ProN", sans-serif',
      display: 'flex',
      flexDirection: 'column',
      zIndex: '50',
      overflow: 'hidden'
    });

    // === 上のバー ===
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      flexWrap: 'wrap',
      padding: '12px 16px',
      background: 'rgba(0, 0, 0, 0.35)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.15)'
    });

    const back = document.createElement('button');
    back.textContent = '📚 かんじ図鑑へ';
    Object.assign(back.style, {
      background: 'linear-gradient(135deg, #6c757d, #5a6268)',
      color: 'white',
      border: '1px solid rgba(255,255,255,0.2)',
      borderRadius: '8px',
      padding: '8px 16px',
      cursor: 'pointer',
      fontSize: '15px'
    });
    back.addEventListener('click', () => this._goBack());

    const title = document.createElement('span');
    title.textContent = 'ことわざ図鑑';
    Object.assign(title.style, { fontSize: '20px', fontWeight: 'bold', marginRight: '8px' });

    const levelSelect = document.createElement('select');
    Object.assign(levelSelect.style, {
      background: 'rgba(255,255,255,0.12)',
      color: 'white',
      border: '1px solid rgba(255,255,255,0.3)',
      borderRadius: '6px',
      padding: '6px 10px',
      fontSize: '15px',
      cursor: 'pointer'
    });
    LEVELS.forEach(({ value, label }) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      opt.style.color = '#000';
      levelSelect.appendChild(opt);
    });
    levelSelect.value = this.level;
    levelSelect.addEventListener('change', () => {
      this.level = levelSelect.value;
      this._renderList();
    });

    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'ことばで さがす';
    Object.assign(search.style, {
      background: 'rgba(255,255,255,0.12)',
      color: 'white',
      border: '1px solid rgba(255,255,255,0.3)',
      borderRadius: '6px',
      padding: '6px 10px',
      fontSize: '15px',
      minWidth: '160px'
    });
    search.addEventListener('input', () => {
      this.keyword = search.value.trim();
      this._renderList();
    });

    this.countLabel = document.createElement('span');
    Object.assign(this.countLabel.style, { marginLeft: 'auto', fontSize: '14px', opacity: '0.85' });

    header.appendChild(back);
    header.appendChild(title);
    header.appendChild(levelSelect);
    header.appendChild(search);
    header.appendChild(this.countLabel);

    // === 一覧 ===
    const list = document.createElement('div');
    Object.assign(list.style, {
      flex: '1',
      overflowY: 'auto',
      padding: '16px',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
      gap: '12px',
      alignContent: 'start'
    });
    this.listEl = list;

    container.appendChild(header);
    container.appendChild(list);
    document.body.appendChild(container);
    this.container = container;

    this._renderList();
  },

  /** いまの絞り込みに合うことわざ */
  _filtered() {
    const keyword = this.keyword;
    return this.proverbs.filter(p => {
      if (!p) return false;
      if (this.level !== 'all' && p.difficulty !== this.level) return false;
      if (!keyword) return true;
      return (p.text || '').includes(keyword)
        || (toDisplayReading(p.reading) || '').includes(keyword)
        || (p.meaning || '').includes(keyword);
    });
  },

  _renderList() {
    if (!this.listEl) return;
    this.listEl.textContent = '';

    const items = this._filtered();

    if (this.countLabel) {
      this.countLabel.textContent = this.proverbs.length === 0
        ? 'よみこみ中…'
        : `${items.length}こ`;
    }

    if (this.proverbs.length === 0) return;

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'みつかりませんでした。ほかの ことばで さがしてみよう。';
      Object.assign(empty.style, { opacity: '0.8', padding: '8px' });
      this.listEl.appendChild(empty);
      return;
    }

    for (const p of items) {
      this.listEl.appendChild(this._card(p));
    }
  },

  _card(p) {
    const card = document.createElement('div');
    Object.assign(card.style, {
      background: 'rgba(255, 255, 255, 0.06)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '10px',
      padding: '12px 14px',
      lineHeight: '1.6'
    });

    // データの reading は 400件中388件がローマ字で入っている。
    // 漢字が読めない子に読み方を渡すのが役目なのに、ローマ字では役に立たない
    // （ローマ字を習うのは3年生）。ひらがなに直してから出す。
    const readingText = toDisplayReading(p.reading);
    const reading = document.createElement('div');
    reading.textContent = readingText || '';
    Object.assign(reading.style, { fontSize: '15px', opacity: '0.9' });

    const text = document.createElement('div');
    text.textContent = p.text || '';
    Object.assign(text.style, { fontSize: '20px', fontWeight: 'bold', margin: '2px 0 8px' });

    const meaning = document.createElement('div');
    meaning.textContent = p.meaning || '';
    Object.assign(meaning.style, { fontSize: '14px' });

    card.appendChild(reading);
    card.appendChild(text);
    card.appendChild(meaning);

    if (p.example_sentence) {
      const example = document.createElement('div');
      example.textContent = `つかいかた: ${p.example_sentence}`;
      Object.assign(example.style, {
        fontSize: '13px',
        opacity: '0.85',
        marginTop: '8px',
        borderTop: '1px dashed rgba(255,255,255,0.2)',
        paddingTop: '8px'
      });
      card.appendChild(example);
    }

    if (p.monsterName) {
      const monster = document.createElement('div');
      monster.textContent = `👾 ${p.monsterName}`;
      Object.assign(monster.style, { fontSize: '13px', marginTop: '6px', opacity: '0.9' });
      card.appendChild(monster);
    }

    return card;
  },

  update() {
    // 画面は DOM 側にある。canvas は隠してあるので描くものは無い
  },

  exit() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    this.listEl = null;
    this.countLabel = null;

    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }

    if (this._canvasRef) {
      this._canvasRef.style.visibility = this._prevCanvasVisibility ?? '';
      this._canvasRef.style.pointerEvents = this._prevCanvasPointer ?? '';
      this._canvasRef = null;
      this._prevCanvasVisibility = null;
      this._prevCanvasPointer = null;
    }

    this.canvas = this.ctx = null;
  }
};

export default proverbDexScreen;
