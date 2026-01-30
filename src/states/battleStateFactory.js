// src/states/battleStateFactory.js
import { getEnemiesByStageId, getKanjiByStageId } from '../loaders/dataLoader.js';
import battleScreenState from '../screens/battleScreen.js';
import { publish } from '../core/eventBus.js';
import { gameState, battleState, resetStageProgress, saveGameData } from '../core/gameState.js';

export default function createBattleState(stageId){
  let enemies, kanjiPool;

  return {
    enter(props) {
      // stageIdがなければgameStateから取得（デフォルト値対応）
      const currentStageId = stageId === 'default' ? gameState.currentStageId : stageId;
      console.log(`🎮 battleStateFactory.enter() - ステージ: ${currentStageId}`, { props });
      
      // ステージ毎のデータをセット
      enemies    = getEnemiesByStageId(currentStageId);
      kanjiPool  = getKanjiByStageId(currentStageId);
      gameState.currentStageId = currentStageId;
      resetStageProgress(currentStageId);
      
      // キャンバス要素を取得 (propsまたはDOM)
      let canvas = props;
      if (!canvas || typeof canvas !== 'object' || !canvas.getContext) {
        console.log('引数からキャンバスを取得できません。DOMから取得します。');
        canvas = document.getElementById('gameCanvas');
      }
      
      if (!canvas) {
        console.error('gameCanvas要素が見つかりません');
        alert('ゲーム画面が見つかりません。ステージ選択に戻ります。');
        publish('changeScreen', 'stageSelect');
        return;
      }
      
      console.log('🖼️ キャンバス要素を取得しました:', canvas);
      
      battleScreenState.enter(canvas, () => {
        // ステージクリア後の処理
        // P0-2 StepA(例外A): clear_* は互換ミラーとして残すが、必ずSSoT(krb_save)更新を先に行う（StepBで廃止予定）
        try { saveGameData(); } catch {}
        // P0-2 StepC-1: clear_* 互換ミラー書き込みを停止（読み取り互換は saveData.isStageCleared の legacy fallback で維持）
        // localStorage.setItem(`clear_${currentStageId}`, '1');
        // 新しい勝利画面に遷移（データ付き）
        const resultData = {
          stageId: gameState.currentStageId,
          correct: gameState.correctKanjiList,
          wrong:   gameState.wrongKanjiList,
          time:    battleState.timeRemaining, // チャレンジモードの場合
          playerHp: gameState.playerStats.hp
        };
        publish('changeScreen', 'resultWin', resultData);
      });
    },
    update(dt) {
      battleScreenState.update(dt);
    },
    exit() {
      battleScreenState.exit();
    }
  };
}
