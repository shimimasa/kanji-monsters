import { publish } from '../core/eventBus.js';
import { gameState } from '../core/gameState.js';
import { loadProfileSummary, loadAchievementsSummary } from '../models/profile.js';

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

    // プロフィールは汎用メニューBGM
    publish('playBGM', 'title');

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
      background: '#2c1810', // 図鑑と同系色
      color: 'white',
      fontFamily: '"UDデジタル教科書体", sans-serif',
      padding: '16px',
      zIndex: '100000',          // 最前面に
      pointerEvents: 'auto',     // クリックを受ける
    });

        // ヘッダー（ナビ＋リンク）
        const header = document.createElement('div');
        Object.assign(header.style, {
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          margin: '16px',
          background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.85), rgba(59, 130, 246, 0.6))',
          border: '1px solid rgba(59, 130, 246, 0.4)',
          borderRadius: '12px',
          padding: '12px',
          boxShadow: '0 4px 12px rgba(30, 58, 138, 0.3)'
        });
    
        const backBtn = document.createElement('button');
        backBtn.textContent = '← もどる';
        Object.assign(backBtn.style, {
          background: 'linear-gradient(135deg, #6c757d, #5a6268)',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          padding: '8px 12px',
          cursor: 'pointer'
        });
        backBtn.onclick = () => {
          publish('playSE', 'decide');
          const targetScreen = gameState.previousScreen || 'stageSelect';
          publish('changeScreen', targetScreen);
        };
    
        const title = document.createElement('h2');
        title.textContent = 'プロフィール / 称号';
        title.style.margin = '0';
        title.style.fontSize = '20px';
        title.style.flex = '1';
    
        const toKanjiDexBtn = document.createElement('button');
        toKanjiDexBtn.textContent = '漢字図鑑';
        toKanjiDexBtn.style.background = 'linear-gradient(135deg, #6c757d, #5a6268)';
        toKanjiDexBtn.style.color = 'white';
        toKanjiDexBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        toKanjiDexBtn.style.borderRadius = '8px';
        toKanjiDexBtn.style.padding = '8px 12px';
        toKanjiDexBtn.style.cursor = 'pointer';
        toKanjiDexBtn.onclick = () => publish('changeScreen', 'kanjiDex');
    
        const toMonsterDexBtn = document.createElement('button');
        toMonsterDexBtn.textContent = 'モンスター図鑑';
        toMonsterDexBtn.style.background = 'linear-gradient(135deg, #6c757d, #5a6268)';
        toMonsterDexBtn.style.color = 'white';
        toMonsterDexBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        toMonsterDexBtn.style.borderRadius = '8px';
        toMonsterDexBtn.style.padding = '8px 12px';
        toMonsterDexBtn.style.cursor = 'pointer';
        toMonsterDexBtn.onclick = () => publish('changeScreen', 'monsterDex');

        // ステータス（スキルポイントを振る唯一の画面。未使用SPがあればバッジで知らせる）
        const skillPoints = gameState.playerStats?.skillPoints || 0;
        const toStatusBtn = document.createElement('button');
        toStatusBtn.textContent = skillPoints > 0 ? `ステータス (+${skillPoints})` : 'ステータス';
        toStatusBtn.style.background = skillPoints > 0
          ? 'linear-gradient(135deg, #f39c12, #d68910)'
          : 'linear-gradient(135deg, #6c757d, #5a6268)';
        toStatusBtn.style.color = 'white';
        toStatusBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        toStatusBtn.style.borderRadius = '8px';
        toStatusBtn.style.padding = '8px 12px';
        toStatusBtn.style.cursor = 'pointer';
        toStatusBtn.onclick = () => publish('changeScreen', 'status');

        const toAchievementsBtn = document.createElement('button');
        toAchievementsBtn.textContent = 'トロフィー';
        toAchievementsBtn.style.background = 'linear-gradient(135deg, #6c757d, #5a6268)';
        toAchievementsBtn.style.color = 'white';
        toAchievementsBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        toAchievementsBtn.style.borderRadius = '8px';
        toAchievementsBtn.style.padding = '8px 12px';
        toAchievementsBtn.style.cursor = 'pointer';
        toAchievementsBtn.onclick = () => publish('changeScreen', 'achievements');

        header.append(backBtn, title, toStatusBtn, toAchievementsBtn, toKanjiDexBtn, toMonsterDexBtn);

        const summary = loadProfileSummary();

    // 統計（豪華カード）
    const statsDiv = document.createElement('div');
    Object.assign(statsDiv.style, {
      background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.7), rgba(59, 130, 246, 0.4))',
      border: '1px solid rgba(59,130,246,0.3)',
      borderRadius: '12px',
      padding: '16px',
      margin: '16px',
      boxShadow: '0 2px 8px rgba(30,58,138,0.2)'
    });

    const statsTop = document.createElement('div');
    statsTop.style.display = 'grid';
    statsTop.style.gridTemplateColumns = 'repeat(auto-fit, minmax(220px, 1fr))';
    statsTop.style.gap = '12px';

    const infoCard = document.createElement('div');
    infoCard.style.background = 'rgba(0,0,0,0.35)';
    infoCard.style.border = '1px solid #8B4513';
    infoCard.style.padding = '12px';
    infoCard.style.borderRadius = '10px';
    const playtime = summary.stats.playtimeSeconds || 0;
    const hh = Math.floor(playtime / 3600);
    const mm = Math.floor((playtime % 3600) / 60);
    const ss = Math.floor(playtime % 60);
    const playtimeStr = `${hh}時間 ${mm}分 ${ss}秒`;
    infoCard.innerHTML = `
      <div><strong>プレイヤー:</strong> ${summary.player.name}</div>
      <div><strong>レベル:</strong> ${summary.player.level}（EXP: ${summary.player.exp}/${summary.player.next}）</div>
      <div><strong>勝利数:</strong> ${summary.stats.enemiesDefeated} / <strong>ボス撃破:</strong> ${summary.stats.bossesDefeated}</div>
      <div><strong>総正解:</strong> ${summary.stats.totalCorrect} / <strong>弱点ヒット:</strong> ${summary.stats.weaknessHits} / <strong>回復成功:</strong> ${summary.stats.healsSuccessful}</div>
      <div><strong>総プレイ時間:</strong> ${playtimeStr}</div>
    `;

    const barsCard = document.createElement('div');
    barsCard.style.background = 'rgba(0,0,0,0.35)';
    barsCard.style.border = '1px solid #8B4513';
    barsCard.style.padding = '12px';
    barsCard.style.borderRadius = '10px';

    const makeBar = (label, value, total) => {
      const wrap = document.createElement('div');
      wrap.style.margin = '8px 0';
      const rate = total > 0 ? Math.round((value / total) * 100) : 0;
      wrap.innerHTML = `<div style="margin-bottom:4px">${label}: ${value}/${total} (${rate}%)</div>`;
      const bar = document.createElement('div');
      Object.assign(bar.style, {
        background: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: '10px',
        height: '12px',
        overflow: 'hidden'
      });
      const fill = document.createElement('div');
      Object.assign(fill.style, {
        background: 'linear-gradient(90deg, #28a745, #20c997)',
        height: '100%',
        width: `${rate}%`,
        transition: 'width 0.6s ease'
      });
      bar.appendChild(fill);
      wrap.appendChild(bar);
      return wrap;
    };

    // 便宜上、総漢字数を「図鑑に登録された全漢字数」として表示（mastered はセッション）
    barsCard.appendChild(makeBar('漢字収集', summary.collection.kanjiCount, summary.collection.kanjiCount));
    barsCard.appendChild(makeBar('モンスター収集', summary.collection.monsterCount, summary.collection.monsterCount));
    barsCard.appendChild(makeBar('マスター漢字（セッション）', summary.collection.masteredCount, summary.collection.kanjiCount || 1));

    // こんしゅうのがんばり（週次の成長を見せる）
    const weeklyCard = document.createElement('div');
    weeklyCard.style.background = 'rgba(0,0,0,0.35)';
    weeklyCard.style.border = '1px solid #8B4513';
    weeklyCard.style.padding = '12px';
    weeklyCard.style.borderRadius = '10px';
    const weekly = summary.weekly || { thisWeek: 0, lastWeek: 0, diff: 0 };
    let weeklyMessage;
    if (weekly.thisWeek === 0 && weekly.lastWeek === 0) {
      weeklyMessage = 'こんしゅうから きろくがはじまるよ！';
    } else if (weekly.diff > 0) {
      weeklyMessage = `先週より +${weekly.diff}回 よめた！`;
    } else if (weekly.diff === 0) {
      weeklyMessage = '先週とおなじペースだよ';
    } else {
      weeklyMessage = `先週のペースまで あと${-weekly.diff}回`;
    }
    weeklyCard.innerHTML = `
      <h3 style="margin:0 0 8px; font-size:16px;">こんしゅうのがんばり</h3>
      <div style="font-size:24px; font-weight:700;">${weekly.thisWeek}回 よめた</div>
      <div style="opacity:0.85;">先週: ${weekly.lastWeek}回</div>
      <div style="color:#7CFC9A; margin-top:6px; font-weight:700;">${weeklyMessage}</div>
    `;

    statsTop.append(infoCard, barsCard, weeklyCard);
    statsDiv.appendChild(statsTop);


        // 概要（豪華カード風）
        const overview = document.createElement('div');
        Object.assign(overview.style, {
          background: 'rgba(0,0,0,0.35)',
          border: '1px solid #8B4513',
          padding: '12px',
          margin: '16px',
          boxShadow: '3px 3px 5px rgba(0,0,0,0.3)',
          borderRadius: '10px'
        });
        overview.innerHTML = `
          <h3 style="margin:0 0 8px; font-size:16px;">概要</h3>
          <div>プレイヤー: ${summary.player.name}</div>
          <div>レベル: ${summary.player.level}（EXP: ${summary.player.exp}/${summary.player.next}）</div>
          <div>勝利数: ${summary.stats.enemiesDefeated} / ボス撃破: ${summary.stats.bossesDefeated}</div>
          <div>総正解: ${summary.stats.totalCorrect} / 弱点ヒット: ${summary.stats.weaknessHits} / 回復成功: ${summary.stats.healsSuccessful}</div>
        `;
    
        const collection = document.createElement('div');
        Object.assign(collection.style, {
          background: 'rgba(0,0,0,0.35)',
          border: '1px solid #8B4513',
          padding: '12px',
          margin: '16px',
          boxShadow: '3px 3px 5px rgba(0,0,0,0.3)',
          borderRadius: '10px'
        });
        collection.innerHTML = `
          <h3 style="margin:0 0 8px; font-size:16px;">収集状況</h3>
          <div>漢字収集数: ${summary.collection.kanjiCount}</div>
          <div>マスター漢字（セッション）: ${summary.collection.masteredCount}</div>
          <div>モンスター図鑑数: ${summary.collection.monsterCount}</div>
        `;
    
        const titles = document.createElement('div');
        Object.assign(titles.style, {
          background: 'rgba(0,0,0,0.35)',
          border: '1px solid #8B4513',
          padding: '12px',
          margin: '16px',
          boxShadow: '3px 3px 5px rgba(0,0,0,0.3)',
          borderRadius: '10px'
        });
    
        const titlesHeader = document.createElement('div');
        Object.assign(titlesHeader.style, { display:'flex', gap:'8px', alignItems:'baseline' });
    
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
    
        // 実績（モデル経由で取得）
        loadAchievementsSummary().then(({ unlocked, progress }) => {
          titlesSummary.textContent = `解除 ${progress.unlocked}/${progress.total}（${progress.percentage}%）`;
          list.innerHTML = '';
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
            card.style.background = 'linear-gradient(135deg, rgba(139, 69, 19, 0.8), rgba(160, 82, 45, 0.6))';
            card.style.boxShadow = '2px 2px 4px rgba(0,0,0,0.25)';
            card.style.borderRadius = '10px';
            const tt = document.createElement('div');
            tt.textContent = `🏆 ${a.title}`;
            tt.style.fontWeight = 'bold';
            tt.style.marginBottom = '4px';
            const desc = document.createElement('div');
            desc.textContent = a.description || '';
            desc.style.opacity = '0.9';
            desc.style.fontSize = '12px';
            card.append(tt, desc);
            list.appendChild(card);
          });
        }).catch(() => {
          titlesSummary.textContent = '';
        });
    
        titles.append(titlesHeader, list);
    
        // 画面構成
        this.container.append(header, statsDiv, overview, collection, titles);
        document.body.appendChild(this.container);
        
        import('../tutorial/TutorialManager.js').then(m => m.default.startIfNeeded('profile', {}));
      
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
