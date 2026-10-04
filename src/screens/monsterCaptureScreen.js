// src/screens/monsterCaptureScreen.js
import { publish } from '../core/eventBus.js';
import { gameState, saveGameData } from '../core/gameState.js';
import { addMonster, loadDex } from '../models/monsterDex.js';

import { getAllMonsterIds, getMonsterById, stageData } from '../loaders/dataLoader.js';
// ゴトモン拡張を つかまえた画面にも (2026-10-03): タイプと しんかの 予告。表示だけ。
import { typeOf, typeInfo } from '../minigames/gotomonTypes.js';
import { EVOLVE_LEVEL } from '../minigames/companionLooks.js';
import { gotomonService } from '../minigames/gotomonService.js';
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

  // 2026-10-04 作り直し:
  // - 下のボタンの帯は半透明＋ぼかしでカードの上に貼りついていて、2列目の名前が読めなかった。
  //   → カードの一覧だけがスクロールし、ボタンの帯は一覧の下に置く（重ならない）
  // - 文は 1〜2年の漢字と ひらがな だけ（「迎えた」「あいぼう」「最大」「候補」「確定」「選択中」は読めない）
  // - 本編だけ遊ぶ子も あいぼうを えらべるように、ここで「あいぼうに する」を選べる
  _createDOM() {
    if (this.container) this.container.remove();

    this.container = document.createElement('div');
    this.container.id = 'monsterCaptureScreen';
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
      background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.95), rgba(37, 99, 200, 0.92))',
      border: '2px solid rgba(59,130,246,0.5)',
      borderRadius: '16px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      padding: '16px',
      color: '#fff',
      maxHeight: '90dvh',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      overflow: 'hidden'
    });

    const header = document.createElement('div');
    header.textContent = 'なかまに する ゴトモンを えらぼう！';
    Object.assign(header.style, { fontSize: '22px', fontWeight: '700' });
    const counter = document.createElement('div');
    Object.assign(counter.style, { fontSize: '16px', fontWeight: '700', color: '#ffe58a' });

    let current = null;
    try { current = gotomonService.getSelectedGotomon(); } catch { current = null; }
    const companionNote = document.createElement('p');
    companionNote.textContent = `なかまに した ゴトモンは あいぼうに できるよ。あいぼうが Lv${EVOLVE_LEVEL}に なると しんかするよ。タイプが あう あいぼうは、バトルで 力を かしてくれる！`
      + (current ? `（いまの あいぼう: ${current.name}）` : '');
    Object.assign(companionNote.style, { fontSize: '14px', lineHeight: '1.6', color: '#e3f3d4', margin: '0' });

    const grid = document.createElement('div');
    Object.assign(grid.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
      gap: '12px',
      // ここだけスクロールする（ボタンの帯と重ならない）
      flex: '1 1 auto',
      minHeight: '0',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      padding: '4px'
    });

    const refreshers = [];
    const confirmBtn = document.createElement('button');
    const cancelBtn = document.createElement('button');
    const refreshAll = () => {
      // 選んでいない子を「あいぼう」には できない（選ぶのを やめたら 外す）
      if (this.companionPick && !this.selected.has(this.companionPick) && !(this.dex && this.dex.has(this.companionPick))) {
        this.companionPick = null;
      }
      counter.textContent = `えらべるのは ${this.captureLimit}ひき まで（いま ${this.selected.size}ひき）`;
      confirmBtn.textContent = this.selected.size > 0 ? `なかまに する（${this.selected.size}ひき）`
        : (this.companionPick ? 'あいぼうを かえて すすむ' : 'すすむ');
      // 何も えらんでいない時は「すすむ」1つだけ（「えらばないで すすむ」と同じ意味になるので）
      cancelBtn.style.display = this.selected.size > 0 || this.companionPick ? '' : 'none';
      refreshers.forEach(fn => fn());
    };

    for (const id of this.candidates) {
      const m = getMonsterById(id);
      if (!m) continue;

      const already = this.dex && this.dex.has(id); // ← 修正: this.dex

      const card = document.createElement('div');
      card.dataset.monsterId = id;
      Object.assign(card.style, {
        background: 'linear-gradient(135deg, rgba(139,69,19,0.85), rgba(160,82,45,0.7))',
        border: '2px solid #8B4513',
        borderRadius: '12px',
        padding: '10px',
        cursor: already ? 'default' : 'pointer',
        userSelect: 'none',
        transition: 'all .2s',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch'
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
      thumb.alt = m.name;
      // すでに なかまの子は 絵だけ うすくする（ボタンは うすくしない）
      Object.assign(thumb.style, { width: '100%', borderRadius: '8px', opacity: already ? '0.6' : '1' });

      const name = document.createElement('div');
      name.textContent = m.name;
      Object.assign(name.style, { fontWeight: '700', marginTop: '6px', textAlign: 'center' });
      const type = typeInfo(typeOf(m)), typeLabel = document.createElement('div');
      const chip = document.createElement('span'); chip.className = 'capture-type-chip'; chip.textContent = type.name;
      Object.assign(chip.style, { background: type.color, color: '#1c1c1c', borderRadius: '999px', padding: '0 10px', fontSize: '13px', fontWeight: '700' });
      Object.assign(typeLabel.style, { textAlign: 'center', marginTop: '4px' }); typeLabel.appendChild(chip);

      const badge = document.createElement('div');
      Object.assign(badge.style, { marginTop: '4px', textAlign: 'center', fontWeight: '700', minHeight: '1.4em' });

      // 「あいぼうに する」: 選んだ子か、すでに なかまの子だけ。いまの あいぼうには 出さない
      const companionBtn = document.createElement('button');
      companionBtn.type = 'button';
      companionBtn.className = 'capture-companion-button';
      Object.assign(companionBtn.style, { marginTop: '6px', minHeight: '40px', borderRadius: '8px', fontSize: '14px', fontWeight: '700',
        cursor: 'pointer', border: '2px solid #ffd700' });
      companionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.companionPick = this.companionPick === id ? null : id;
        publish('playSE', 'decide');
        refreshAll();
      });

      refreshers.push(() => {
        const selected = this.selected.has(id);
        const isCurrent = current && current.id === id;
        badge.textContent = isCurrent ? 'いまの あいぼう' : (already ? 'なかま だよ' : (selected ? 'えらんだ！' : ''));
        badge.style.color = isCurrent || already ? '#ffd700' : '#00ffb3';
        card.style.outline = selected ? '3px solid #00ffb3' : 'none';
        const canPick = !isCurrent && (selected || already);
        companionBtn.style.display = canPick ? 'block' : 'none';
        const picked = this.companionPick === id;
        companionBtn.textContent = picked ? '★ あいぼうに する' : '☆ あいぼうに する';
        companionBtn.setAttribute('aria-pressed', picked ? 'true' : 'false');
        companionBtn.style.background = picked ? '#ffd700' : 'rgba(0,0,0,0.25)';
        companionBtn.style.color = picked ? '#3b2a12' : '#ffe58a';
      });

      card.addEventListener('click', () => {
        // すでに なかまの子は 選ばない（図鑑には もう いる）
        if (already) return;
        if (this.selected.has(id)) {
          this.selected.delete(id);
        } else {
          if (this.selected.size >= this.captureLimit) { publish('playSE', 'cancel'); return; }
          this.selected.add(id);
        }
        refreshAll();
        publish('playSE', 'decide');
      });

      card.appendChild(thumb);
      card.appendChild(name);
      card.appendChild(typeLabel);
      card.appendChild(badge);
      card.appendChild(companionBtn);
      grid.appendChild(card);
    }

    // ボタンの帯: 一覧の下に置く（以前は sticky で一覧の上に重なり、半透明＋ぼかしで名前が読めなかった）
    const footer = document.createElement('div');
    Object.assign(footer.style, {
      display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap',
      paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.25)'
    });

    cancelBtn.textContent = 'えらばないで すすむ';
    Object.assign(cancelBtn.style, buttonStyle('gray'));
    cancelBtn.onclick = () => {
      publish('playSE', 'cancel');
      this._goResultWin();
    };

    confirmBtn.id = 'captureConfirmButton';
    Object.assign(confirmBtn.style, buttonStyle('green'));
    confirmBtn.onclick = () => {
      publish('playSE', 'capture');
      for (const id of this.selected) addMonster(id);
      // なかまに入れてから あいぼうに する（なかまでない子は あいぼうに できない）
      if (this.companionPick) {
        try { gotomonService.setSelectedGotomon(this.companionPick); } catch (e) { console.warn('あいぼうを かえられませんでした:', e); }
      }
      this._goResultWin();
    };

    footer.appendChild(cancelBtn);
    footer.appendChild(confirmBtn);

    panel.appendChild(header);
    panel.appendChild(counter);
    panel.appendChild(companionNote);
    panel.appendChild(grid);
    panel.appendChild(footer);
    this.container.appendChild(panel);
    this.companionPick = null;
    refreshAll();
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
    padding: '12px 18px',
    minHeight: '48px',
    fontSize: '17px',
    fontWeight: '700',
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
