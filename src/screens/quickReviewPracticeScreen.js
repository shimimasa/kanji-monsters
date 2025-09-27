import basePractice from './practiceBattleScreen.js';
import { gameState, battleState, saveGameData } from '../core/gameState.js';
import { publish } from '../core/eventBus.js';
import { getKanjiByStageId } from '../loaders/dataLoader.js';

  // 進捗用の内部状態（ファイル先頭のプロパティ群の近くに）
  quickProgress = { current: 0, target: 0 };

const quickReviewPracticeScreen = {
  ...basePractice,
  // セッション追跡用の集合
  pendingReviewIds: new Set(),
  originalReviewIds: new Set(),
  masteredThisSession: new Set(),

  enter(canvasEl, onComplete) {
    try {
      this.onPracticeComplete = onComplete;
      gameState.gameMode = 'practice';
  
      // 1) まず quickReviewTargets
      let qr = gameState.quickReviewTargets;
      let hasIds = Array.isArray(qr?.ids) && qr.ids.length > 0;
      let hasTexts = Array.isArray(qr?.texts) && qr.texts.length > 0;
  
      // 2) 空ならローカル退避から復元
      if (!qr || (!hasIds && !hasTexts)) {
        try {
          const buf = JSON.parse(localStorage.getItem('quickReviewBuffer') || 'null');
          if (buf && (Array.isArray(buf.ids) && buf.ids.length || Array.isArray(buf.texts) && buf.texts.length)) {
            qr = { stageId: buf.stageId, ids: buf.ids || [], texts: buf.texts || [] };
            gameState.quickReviewTargets = qr;
            hasIds = Array.isArray(qr.ids) && qr.ids.length > 0;
            hasTexts = Array.isArray(qr.texts) && qr.texts.length > 0;
          }
        } catch {}
      }
  
      // 3) それでも空なら wrongKanjiList から復元
      if (!qr || (!hasIds && !hasTexts)) {
        const wrongRaw = Array.isArray(gameState.wrongKanjiList) ? gameState.wrongKanjiList : [];
        const texts = Array.from(new Set(wrongRaw.map(w => (typeof w === 'string')
          ? w : (w?.text || w?.kanji || String(w || ''))).filter(Boolean)));
        const ids = Array.from(new Set(wrongRaw.map(w => (typeof w === 'object' && w && 'id' in w)
          ? w.id : null).filter(v => v !== null && v !== undefined)));
        qr = { stageId: gameState.currentStageId, ids, texts };
        gameState.quickReviewTargets = qr;
        hasIds = ids.length > 0; hasTexts = texts.length > 0;
      }
  
      // 最終チェック
      if (!qr || (!hasIds && !hasTexts)) {
        alert('復習対象の漢字が見つかりませんでした。');
        publish('changeScreen', gameState.previousScreen || 'stageSelect');
        return;
      }
  
      // ステージIDを強制同期（照合の母集団を正す）
      if (qr.stageId && String(gameState.currentStageId || '') !== String(qr.stageId)) {
        gameState.currentStageId = qr.stageId;
      }
  
      // 誤答限定を強制
      this.wrongOnlyMode = true;
      this.reviewMode = false;
      this.wrongTargets = {
        ids: new Set(qr.ids || []),
        texts: new Set(qr.texts || []),
      };

      // 復習対象のID集合を構築（文字指定→IDへ同定）
      try {
        const stageId = qr.stageId || gameState.currentStageId;
        const stageKanji = getKanjiByStageId(stageId) || [];
        const idSet = new Set([...this.wrongTargets.ids].map(v => String(v)));
        const textSet = new Set([...this.wrongTargets.texts].map(s => String(s).trim()));

        if (textSet.size > 0) {
          stageKanji.forEach(k => {
            const key = String(k.kanji).trim();
            if (textSet.has(key)) idSet.add(String(k.id));
          });
        }

        this.pendingReviewIds = idSet;
        this.originalReviewIds = new Set(idSet);
        this.masteredThisSession = new Set();
      } catch (e) {
        console.error('❌ 復習対象ID構築エラー:', e);
        this.pendingReviewIds = new Set();
        this.originalReviewIds = new Set();
        this.masteredThisSession = new Set();
      }
  
      basePractice.enter.call(this, canvasEl, onComplete);
    } catch (e) {
      console.error('❌ quickReviewPractice.enter error:', e);
      publish('changeScreen', gameState.previousScreen || 'stageSelect');
    }
  },

    // 確認ダイアログなし版：一覧を出してステージ選択へ戻る
    _completeQuickReview() {
        try {
          battleState.inputEnabled = false;
    
          const stageId = gameState.currentStageId;
          const stageKanji = getKanjiByStageId(stageId) || [];
          const list = stageKanji
            .filter(k => this.originalReviewIds.has(String(k.id)))
            .map(k => (k.kanji || k.text || ''))
            .filter(Boolean);
    
          try { alert(`誤答の復習が完了しました！\n今回マスター: ${list.length ? list.join(' ') : '（なし）'}`); } catch {}
    
          publish('playBGM', 'title');
          const target = (gameState.previousScreen === 'worldStageSelect') ? 'worldStageSelect' : 'stageSelect';
          publish('changeScreen', target);
        } catch (e) {
          console.error('❌ quickReviewPractice._completeQuickReview error:', e);
          publish('changeScreen', gameState.previousScreen || 'stageSelect');
        }
      },

  // 常に「セッションの未消化集合」からだけ生成（グローバルのマスター状態に依存しない）
  _buildUnmasteredKanjiList() {
    try {
      const stageId = gameState.currentStageId;
      const stageKanji = getKanjiByStageId(stageId) || [];

      const pool = stageKanji.filter(k => this.pendingReviewIds.has(String(k.id)));

      this.unmasteredKanji = pool;
      if (this.pendingReviewIds.size === 0) {
        this._completeQuickReview();
      }
    } catch (e) {
      console.error('❌ quickReviewPractice._buildUnmasteredKanjiList error:', e);
      this.unmasteredKanji = [];
      this._completeQuickReview();
    }
  },

  // 出題選択は都度 pendingReviewIds から作る
  _pickNextUnmasteredKanji() {
    try {
      const stageId = gameState.currentStageId;
      const stageKanji = getKanjiByStageId(stageId) || [];

      if (!this.pendingReviewIds || this.pendingReviewIds.size === 0) {
        this._completeQuickReview();
        return;
      }

      const pool = stageKanji.filter(k => this.pendingReviewIds.has(String(k.id)));
      if (pool.length === 0) { this._completeQuickReview(); return; }

      let idx = Math.floor(Math.random() * pool.length);
      if (pool.length > 1 && this.lastPickedKanjiId) {
        let guard = 0;
        while (pool[idx].id === this.lastPickedKanjiId && guard < 10) {
          idx = Math.floor(Math.random() * pool.length);
          guard++;
        }
      }
      const selectedKanji = pool[idx];
      this.lastPickedKanjiId = selectedKanji.id;

      const toHiragana = (s) => {
        if (!s) return '';
        const t = String(s).trim();
        return t.replace(/[\u30a1-\u30f6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
      };
      const processReadings = (readings) => {
        try {
          if (!readings) return [];
          if (Array.isArray(readings)) return readings.map(r => toHiragana(String(r).trim())).filter(Boolean);
          if (typeof readings === 'string') return readings.split(' ').map(r => toHiragana(r.trim())).filter(Boolean);
          return [];
        } catch { return []; }
      };

      gameState.currentKanji = {
        id: selectedKanji.id,
        text: selectedKanji.kanji,
        kunyomi: processReadings(selectedKanji.kunyomi),
        onyomi: processReadings(selectedKanji.onyomi),
        meaning: selectedKanji.meaning || '',
        strokes: selectedKanji.strokes || 0,
        radical: selectedKanji.radical || '',
        jlpt: selectedKanji.jlpt || '',
      };

      gameState.hintLevel = 0;
      this.practiceStats.lastQuestionTime = Date.now();
    } catch (e) {
      console.error('❌ quickReviewPractice._pickNextUnmasteredKanji error:', e);
      this._completeQuickReview();
    }
  },

  // 正解時にIDを消し込み（本当にマスター済みになった場合のみ）
  _handlePracticeCorrect(answer) {
    try {
      if (typeof basePractice._handlePracticeCorrect === 'function') {
        basePractice._handlePracticeCorrect.call(this, answer);
      }
      if (gameState.currentKanji && gameState.currentKanji.id !== undefined) {
        const idKey = String(gameState.currentKanji.id);
        if (this._isKanjiMastered(gameState.currentKanji.id)) {
          if (this.pendingReviewIds.has(idKey)) this.pendingReviewIds.delete(idKey);
          this.masteredThisSession.add(String(gameState.currentKanji.text || ''));
        }
      }
    } catch (e) {
      console.error('❌ quickReviewPractice._handlePracticeCorrect error:', e);
    }
  },

  // レビュー解放はしない
  _completePractice() {
    try {
      // 保存はしない（レビュー解放フラグも立てない）
      this._completeQuickReview();
    } catch (e) {
      console.error('❌ quickReviewPractice._completePractice error:', e);
      this._completeQuickReview();
    }
  },

// 誤答ベースの進捗パネル描画（practiceBattleScreen と同じ見た目で中身だけ差し替え）
_drawEnhancedProgressPanel() {
  if (!this.ctx) return;
  try {
    const { x, y, w, h } = this.panelConfig?.progress || { x: 100, y: 480, w: 350, h: 70 };

    // 背景と枠
    const gradient = this.ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, 'rgba(30, 60, 114, 0.95)');
    gradient.addColorStop(1, 'rgba(20, 40, 80, 0.95)');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(x, y, w, h);
    this.ctx.strokeStyle = '#4caf50';
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(x, y, w, h);

     // タイトル
     this.ctx.fillStyle = 'white';
     this.ctx.textAlign = 'left';
     this.ctx.font = 'bold 18px "UDデジタル教科書体", sans-serif';
     this.ctx.fillText('📊 マスター進捗（復習）', x + 18, y + 24);
 
     // 集合ベースの進捗
     const total = Math.max(1, (this.originalReviewIds?.size || 0));
     const masteredCount = Math.max(0, total - (this.pendingReviewIds?.size || 0));
     const targetRatio = Math.min(1, masteredCount / total);
 
     // イージング
     this.quickProgress = this.quickProgress || { current: 0, target: 0 };
     this.quickProgress.target = targetRatio;
     this.quickProgress.current += (this.quickProgress.target - this.quickProgress.current) * 0.12;
 
     // 右上の数値
     const progressLabel = `${masteredCount} / ${total} (${Math.round(this.quickProgress.current * 100)}%)`;
     this.ctx.font = 'bold 16px "UDデジタル教科書体", sans-serif';
     this.ctx.textAlign = 'right';
     this.ctx.fillStyle = 'white';
     this.ctx.fillText(progressLabel, x + w - 18, y + 24);

     // バー
    const barX = x + 18;
    const barY = y + h - 24;
    const barW = w - 36;
    const barH = 12;

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.fillRect(barX, barY, barW, barH);

    const pg = this.ctx.createLinearGradient(barX, barY, barX + barW, barY);
    pg.addColorStop(0, '#2ecc71');
    pg.addColorStop(1, '#27ae60');
    this.ctx.fillStyle = pg;
    this.ctx.fillRect(barX, barY, barW * this.quickProgress.current, barH);

    this.ctx.strokeStyle = 'white';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(barX, barY, barW, barH);
  } catch (e) {
    console.error('❌ 復習進捗パネル描画エラー:', e);
  }
},

// 改善UIの描画を上書きして、上の進捗パネルを呼ぶ
_drawImprovedPracticeUI() {
  try {
    this._drawPreviousKanjiPanelWithReadings?.();
    this._drawCurrentKanjiDetailPanel?.();
    // ここだけ自分の進捗バーに差し替え
    this._drawEnhancedProgressPanel();
    if (this.reviewMode) {
      this._drawReviewModeBadge?.();
      this._drawReviewScoreCounter?.();
    } else {
      this._drawPracticeModeBadge?.();
    }
    this._drawOperationGuide?.();
    this._drawDetailedStats?.();
  } catch (e) {
    console.error('❌ 改善UI描画(復習)エラー:', e);
  }
},


  exit() {
    try {
      if (typeof basePractice.exit === 'function') {
        basePractice.exit.call(this);
      }
    } finally {
      this.wrongOnlyMode = false;
      this.wrongTargets = { ids: new Set(), texts: new Set() };
      try { delete gameState.quickReviewTargets; } catch {}
    }
  },
};

export default quickReviewPracticeScreen;