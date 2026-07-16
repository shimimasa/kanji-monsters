// src/screens/monsterCaptureScreen.js
import { publish } from '../core/eventBus.js';
import { gameState, saveGameData } from '../core/gameState.js';
import { addMonster, loadDex } from '../models/monsterDex.js';

import { getAllMonsterIds, getMonsterById, stageData } from '../loaders/dataLoader.js';
const monsterCaptureScreen = {
  canvas: null,
  container: null,
  candidates: [],        // 表示候補（最大10）
  captureLimit: 1,       // 捕獲可能数（通常4 / ボーナス1）
  selected: new Set(),   // 選択済み

  enter(defeatedMonsters) {
    this.canvas = document.getElementById('gameCanvas');
    if (this.canvas) {
      this._prevCanvasVisibility = this.canvas.style.visibility;
      this._prevCanvasPointer = this.canvas.style.pointerEvents;
      this.canvas.style.visibility = 'hidden';
      this.canvas.style.pointerEvents = 'none';
    }

    // 背面スクロールを抑止（退出時に復元）
    this._prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const stageId = gameState.currentStageId;
    const isBonus = /^bonus_g/i.test(String(stageId || ''));

    // 捕獲可能数: 通常は常に4、ボーナスは常時1（正式仕様）
    // かつてのクリア回数による逓減(4→3→2→1)は廃止。反復による報酬減少は
    // 再挑戦の動機を削ぐため、逓減ではなく「未収集を優先提示」で周回の意味を保つ。
    this.captureLimit = isBonus ? 1 : 4;

    // 候補生成: このステージのモンスターのみ
    this.dex = loadDex(); // ← 修正: インスタンスに保持
    const defeatedIds = Array.isArray(defeatedMonsters)
      ? defeatedMonsters.map(m => m.id).filter(Boolean)
      : [];

    let stageIds = defeatedIds.length > 0
      ? defeatedIds.slice()
      : (Array.isArray(gameState.enemies) ? gameState.enemies.map(e => e.id).filter(Boolean) : []);
    stageIds = Array.from(new Set(stageIds));
    if (stageIds.length > 10) {
      shuffle(stageIds);
    }
    // 未収集のゴトモンを先頭に（収集済みは後ろ、枠あふれ時は未収集を優先して残す）
    const uncollected = stageIds.filter(id => !this.dex.has(id));
    const collected = stageIds.filter(id => this.dex.has(id));
    this.candidates = uncollected.concat(collected).slice(0, 10);

    this._createDOM();

    publish('playBGM', 'yomitomo');

  },

  _createDOM() {
    if (this.container) this.container.remove();

    this.container = document.createElement('div');
    Object.assign(this.container.style, {
      position: 'fixed',
      left: '0', top: '0',
      width: '100vw',
      height: '100vh',           // フォールバック
      zIndex: '100001',
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      // モバイル快適化
      touchAction: 'pan-y',
      overscrollBehavior: 'contain',
      paddingBottom: 'env(safe-area-inset-bottom)'
    });
    // 対応ブラウザでは実表示高を使用
    this.container.style.height = '100dvh';

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      width: '90vw', maxWidth: '1000px',
      background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.85), rgba(59, 130, 246, 0.6))',
      border: '2px solid rgba(59,130,246,0.5)',
      borderRadius: '16px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      padding: '16px',
      color: '#fff',
      // スクロール可能に
      maxHeight: '90dvh',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      display: 'flex',
      flexDirection: 'column'
    });

    const header = document.createElement('div');
    header.textContent = `ヨミトモにしよう！：最大 ${this.captureLimit} 体選べます（全${this.candidates.length}候補）`;
    Object.assign(header.style, { fontSize: '20px', fontWeight: '700', marginBottom: '12px' });

    const grid = document.createElement('div');
    Object.assign(grid.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '12px'
    });

    for (const id of this.candidates) {
      const m = getMonsterById(id);
      if (!m) continue;

      const already = this.dex && this.dex.has(id); // ← 修正: this.dex

      const card = document.createElement('div');
      Object.assign(card.style, {
        background: 'linear-gradient(135deg, rgba(139,69,19,0.85), rgba(160,82,45,0.7))',
        border: '2px solid #8B4513',
        borderRadius: '12px',
        padding: '10px',
        cursor: already ? 'not-allowed' : 'pointer', // ← 追加：捕獲済みは選択不可
        userSelect: 'none',
        transition: 'all .2s',
        opacity: already ? '0.55' : '1' // ← 追加：捕獲済みは半透明
      });

      const thumb = document.createElement('img');
      const folderMap = {
        1:'grade1-hokkaido', 2:'grade2-touhoku', 3:'grade3-kantou',
        4:'grade4-chuubu',   5:'grade5-kinki',   6:'grade6-chuugoku',
        7:'grade7-asia',     8:'grade8-europe', 9:'grade9-america',
        10:'grade10-africa', 11:'grade11-shikoku', 12:'grade12-kyuusyuu'
      };
      const idStr = String(m.id);
      const folder = folderMap[m.grade] || folderMap[1];
      thumb.src = idStr.startsWith('PRV-')
        ? `/assets/images/monsters/thumb/${m.id}.webp`
        : `/assets/images/monsters/thumb/${folder}/${m.id}.webp`;
      Object.assign(thumb.style, { width: '100%', borderRadius: '8px' });

      const name = document.createElement('div');
      name.textContent = m.name;
      Object.assign(name.style, { fontWeight: '700', marginTop: '6px', textAlign: 'center' });

      const badge = document.createElement('div');
      const updateBadge = () => {
        // ← 変更：捕獲済みは常時「ヨミトモ」表示、選択中表示は未捕獲のみ
        const selected = this.selected.has(id);
        badge.textContent = already ? 'ヨミトモ！' : (selected ? '選択中' : '');
        Object.assign(badge.style, {
          marginTop: '4px',
          textAlign: 'center',
          color: already ? '#ffd700' : (selected ? '#00ffb3' : 'transparent'),
          fontWeight: '700'
        });
        card.style.outline = selected ? '3px solid #00ffb3' : 'none';
      };
      updateBadge();

      card.addEventListener('click', () => {
        // ← 追加：捕獲済みは選択不可
        if (already) {
          try { publish('playSE', 'wrong'); } catch {}
          return;
        }
        if (this.selected.has(id)) {
          this.selected.delete(id);
        } else {
          if (this.selected.size >= this.captureLimit) return;
          this.selected.add(id);
        }
        updateBadge();
        publish('playSE', 'decide');
      });

      card.appendChild(thumb);
      card.appendChild(name);
      card.appendChild(badge);
      grid.appendChild(card);
    }

    const footer = document.createElement('div');
    Object.assign(footer.style, {
      display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px',
      // 常に下に貼り付け
      position: 'sticky',
      bottom: '0',
      background: 'linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,0.25))',
      backdropFilter: 'blur(4px)',
      padding: '8px 0'
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'スキップ';
    Object.assign(cancelBtn.style, buttonStyle('gray'));
    cancelBtn.onclick = () => {
      publish('playSE', 'cancel');
      this._goResultWin();
    };

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'ヨミトモを確定';
    Object.assign(confirmBtn.style, buttonStyle('green'));
    confirmBtn.onclick = () => {
      publish('playSE', 'decide');
      for (const id of this.selected) addMonster(id);
      this._goResultWin();
    };

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    panel.appendChild(header);
    panel.appendChild(grid);
    panel.appendChild(footer);
    this.container.appendChild(panel);
    document.body.appendChild(this.container);
  },

  // 学年ボーナス初クリア時のレビュー値スナップショット保存（同学年の全ステージ）
  // ※ かつての stage_clear_* カウンタ更新は捕獲逓減の廃止に伴い削除
  _snapshotBonusReviewScores(stageId) {
    if (!stageId) return;
    if (!/^bonus_g(\d+)$/i.test(String(stageId))) return;
    try {
      const mg = /^bonus_g(\d+)$/i.exec(String(stageId));
      const g = parseInt(mg[1], 10);
      if (!gameState.practiceProgress) gameState.practiceProgress = {};
      const targets = Array.isArray(stageData) ? stageData.filter(s => s && s.grade === g) : [];
      for (const stg of targets) {
        const sid = String(stg.stageId || '');
        const entry = Object.assign({}, gameState.practiceProgress[sid] || {});
        const cur = Number(entry.reviewScore || 0);
        if (typeof entry.reviewScoreSnapshot !== 'number') {
          entry.reviewScoreSnapshot = Math.max(0, cur);
          gameState.practiceProgress[sid] = entry;
        }
      }
      try { saveGameData(); } catch {}
    } catch {}
  },

  _goResultWin() {
    const resultData = {
      stageId: gameState.currentStageId,
      correct: gameState.correctKanjiList,
      wrong: gameState.wrongKanjiList,
      time: gameState.timeRemaining ?? 0,
      playerHp: gameState.playerStats.hp
    };
    this._snapshotBonusReviewScores(gameState?.currentStageId);
    publish('changeScreen', 'resultWin', resultData);
  },

  exit() {
    if (this.container) this.container.remove();
    if (this.canvas) {
      this.canvas.style.visibility = this._prevCanvasVisibility ?? '';
      this.canvas.style.pointerEvents = this._prevCanvasPointer ?? '';
    }
    // 背面スクロールを復元
    if (this._prevBodyOverflow !== undefined) {
      document.body.style.overflow = this._prevBodyOverflow;
      this._prevBodyOverflow = undefined;
    }
    this.container = null;
    this.canvas = null;
    this.candidates = [];
    this.selected.clear();
  },

  update() {},
  render() {}
};

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buttonStyle(kind) {
  const base = {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff',
    cursor: 'pointer'
  };
  if (kind === 'green') {
    return Object.assign(base, { background: 'linear-gradient(135deg, #28a745, #20c997)' });
  }
  return Object.assign(base, { background: 'linear-gradient(135deg, #6c757d, #5a6268)' });
}

export default monsterCaptureScreen;