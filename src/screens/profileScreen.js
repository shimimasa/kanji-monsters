import { publish } from '../core/eventBus.js';
import { gameState } from '../core/gameState.js';
import { getUnlockedAchievements, getAchievementProgress } from '../core/achievementManager.js';
import { loadDex as loadKanjiDex } from '../models/kanjiDex.js';
import { loadDex as loadMonsterDex } from '../models/monsterDex.js';

const profileScreen = {
  container: null,

  enter(arg) {
    // 既存コンテナあれば掃除
    if (this.container) this.container.remove();

    // キャンバスを一時的に隠す（背景が残って見えないようにする）
    const canvas = document.getElementById('gameCanvas');
    this._canvasRef = canvas || null;
    if (canvas) {
      this._prevCanvasVisibility = canvas.style.visibility;
      this._prevCanvasPointer = canvas.style.pointerEvents;
      canvas.style.visibility = 'hidden';
      canvas.style.pointerEvents = 'none';
    }

    // コンテナ生成
    this.container = document.createElement('div');
    this.container.id = 'profileScreenContainer';
    Object.assign(this.container.style, {
      position: 'fixed',         // 画面全面に固定
      left: '0',
      top: '0',
      width: '100vw',
      height: '100vh',
      overflowY: 'auto',
      background: 'rgba(0,0,0,0.9)', // 背景をより濃く（透けをさらに抑制）
      color: 'white',
      fontFamily: '"UDデジタル教科書体", sans-serif',
      padding: '16px',
      zIndex: '100000',          // 最前面に
      pointerEvents: 'auto',     // クリックを受ける
    });

    // ヘッダー
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.gap = '8px';
    header.style.alignItems = 'center';
    header.style.marginBottom = '12px';

    const title = document.createElement('h2');
    title.textContent = 'プロフィール / 称号';
    title.style.margin = '0';
    title.style.fontSize = '20px';

    const backBtn = document.createElement('button');
    backBtn.textContent = '← もどる';
    backBtn.onclick = () => {
      publish('playSE', 'decide');
      const targetScreen = gameState.previousScreen || 'stageSelect';
      publish('changeScreen', targetScreen);
    };

    const toKanjiDexBtn = document.createElement('button');
    toKanjiDexBtn.textContent = '漢字図鑑';
    toKanjiDexBtn.onclick = () => publish('changeScreen', 'kanjiDex');

    const toMonsterDexBtn = document.createElement('button');
    toMonsterDexBtn.textContent = 'モンスター図鑑';
    toMonsterDexBtn.onclick = () => publish('changeScreen', 'monsterDex');

    header.append(backBtn, title, toKanjiDexBtn, toMonsterDexBtn);

    // 概要（プレイヤー情報）
    const overview = document.createElement('div');
    overview.style.background = 'rgba(0,0,0,0.5)';
    overview.style.border = '1px solid #8B4513';
    overview.style.padding = '12px';
    overview.style.marginBottom = '12px';
    overview.style.boxShadow = '3px 3px 5px rgba(0,0,0,0.3)';

    const ps = gameState.playerStats || {};
    const name = gameState.playerName || '(ななし)';
    const level = ps.level ?? 1;
    const exp = ps.exp ?? 0;
    const next = ps.nextLevelExp ?? 100;
    const enemiesDefeated = ps.enemiesDefeated ?? 0;
    const bossesDefeated = ps.bossesDefeated ?? 0;
    const totalCorrect = ps.totalCorrect ?? 0;
    const weaknessHits = ps.weaknessHits ?? 0;
    const healsSuccessful = ps.healsSuccessful ?? 0;

    overview.innerHTML = `
      <h3 style="margin:0 0 8px; font-size:16px;">概要</h3>
      <div>プレイヤー: ${name}</div>
      <div>レベル: ${level}（EXP: ${exp}/${next}）</div>
      <div>勝利数: ${enemiesDefeated} / ボス撃破: ${bossesDefeated}</div>
      <div>総正解: ${totalCorrect} / 弱点ヒット: ${weaknessHits} / 回復成功: ${healsSuccessful}</div>
    `;

    // 収集状況
    const collection = document.createElement('div');
    collection.style.background = 'rgba(0,0,0,0.5)';
    collection.style.border = '1px solid #8B4513';
    collection.style.padding = '12px';
    collection.style.marginBottom = '12px';
    collection.style.boxShadow = '3px 3px 5px rgba(0,0,0,0.3)';

    const kanjiDex = loadKanjiDex();
    const monsterDex = loadMonsterDex();

    // マスター済み漢字（セッション内）
    let masteredCount = 0;
    const prog = gameState.kanjiReadProgress || {};
    for (const id in prog) {
      if (prog[id]?.mastered) masteredCount++;
    }

    collection.innerHTML = `
      <h3 style="margin:0 0 8px; font-size:16px;">収集状況</h3>
      <div>漢字収集数: ${kanjiDex.size}</div>
      <div>マスター漢字（セッション）: ${masteredCount}</div>
      <div>モンスター図鑑数: ${monsterDex.size}</div>
    `;

    // 称号（実績）一覧
    const titles = document.createElement('div');
    titles.style.background = 'rgba(0,0,0,0.5)';
    titles.style.border = '1px solid #8B4513';
    titles.style.padding = '12px';
    titles.style.marginBottom = '12px';
    titles.style.boxShadow = '3px 3px 5px rgba(0,0,0,0.3)';

    const titlesHeader = document.createElement('div');
    titlesHeader.style.display = 'flex';
    titlesHeader.style.gap = '8px';
    titlesHeader.style.alignItems = 'baseline';

    const titlesH3 = document.createElement('h3');
    titlesH3.textContent = '称号一覧';
    titlesH3.style.margin = '0 8px 8px 0';
    titlesH3.style.fontSize = '16px';

    const titlesSummary = document.createElement('div');
    titlesSummary.style.opacity = '0.85';

    titlesHeader.append(titlesH3, titlesSummary);

    const list = document.createElement('div');
    list.style.display = 'grid';
    list.style.gridTemplateColumns = 'repeat(auto-fill, minmax(240px, 1fr))';
    list.style.gap = '8px';

    // 非同期で実績を取得してレンダリング
    getAchievementProgress().then(progress => {
      titlesSummary.textContent = `解除 ${progress.unlocked}/${progress.total}（${progress.percentage}%）`;
    }).catch(() => {
      titlesSummary.textContent = '';
    });

    getUnlockedAchievements().then((unlocked) => {
      if (!unlocked || unlocked.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = '称号はまだありません。';
        list.appendChild(empty);
        return;
      }
      unlocked.forEach(a => {
        const card = document.createElement('div');
        card.style.border = '1px solid #8B4513';
        card.style.padding = '8px';
        card.style.background = 'rgba(0,0,0,0.35)';
        card.style.boxShadow = '2px 2px 4px rgba(0,0,0,0.25)';

        const title = document.createElement('div');
        title.textContent = `🏆 ${a.title}`;
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '4px';

        const desc = document.createElement('div');
        desc.textContent = a.description || '';
        desc.style.opacity = '0.9';
        desc.style.fontSize = '12px';

        card.append(title, desc);
        list.appendChild(card);
      });
    });

    titles.append(titlesHeader, list);

    // 全体を組み立て
    this.container.append(header, overview, collection, titles);
    document.body.appendChild(this.container);
  },

  exit() {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    // キャンバスの表示状態を元に戻す
    if (this._canvasRef) {
      this._canvasRef.style.visibility = this._prevCanvasVisibility ?? '';
      this._canvasRef.style.pointerEvents = this._prevCanvasPointer ?? '';
      this._canvasRef = null;
      this._prevCanvasVisibility = null;
      this._prevCanvasPointer = null;
    }
  },

  update(dt) {},
  render() {},
};

export default profileScreen;
