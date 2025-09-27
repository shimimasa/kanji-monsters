import basePractice from './practiceBattleScreen.js';
import { gameState, battleState, saveGameData } from '../core/gameState.js';
import { publish } from '../core/eventBus.js';
import { getKanjiByStageId } from '../loaders/dataLoader.js';

const quickReviewPracticeScreen = {
  ...basePractice,

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
          const ids   = this.wrongTargets?.ids ? new Set([...this.wrongTargets.ids].map(v => String(v))) : new Set();
          const texts = this.wrongTargets?.texts ? new Set([...this.wrongTargets.texts].map(s => String(s).trim())) : new Set();
    
          const pool = stageKanji.filter(k => {
            const idKey = String(k.id);
            const textKey = String(k.kanji).trim();
            return (ids.size && ids.has(idKey)) || (texts.size && texts.has(textKey));
          });
          const list = pool.map(k => (k.kanji || k.text || '')).filter(Boolean);
    
          try { alert(`誤答の復習が完了しました！\n今回マスター: ${list.length ? list.join(' ') : '（なし）'}`); } catch {}
    
          publish('playBGM', 'title');
          const target = (gameState.previousScreen === 'worldStageSelect') ? 'worldStageSelect' : 'stageSelect';
          publish('changeScreen', target);
        } catch (e) {
          console.error('❌ quickReviewPractice._completeQuickReview error:', e);
          publish('changeScreen', gameState.previousScreen || 'stageSelect');
        }
      },

  // 常に誤答ターゲットからだけ生成
  _buildUnmasteredKanjiList() {
    try {
      const stageId = gameState.currentStageId;
      const stageKanji = getKanjiByStageId(stageId) || [];

      const ids = this.wrongTargets?.ids ? new Set([...this.wrongTargets.ids].map(v => String(v))) : new Set();
      const texts = this.wrongTargets?.texts ? new Set([...this.wrongTargets.texts].map(s => String(s).trim())) : new Set();

      const pool = stageKanji.filter(k => {
        const idKey = String(k.id);
        const textKey = String(k.kanji).trim();
        return (ids.size && ids.has(idKey)) || (texts.size && texts.has(textKey));
      });

      this.unmasteredKanji = pool.filter(k => !this._isKanjiMastered(k.id));
      if (this.unmasteredKanji.length === 0) {
        this._completeQuickReview();
      }
    } catch (e) {
      console.error('❌ quickReviewPractice._buildUnmasteredKanjiList error:', e);
      this.unmasteredKanji = [];
      this._completeQuickReview();
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