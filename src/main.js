/* ----------------------------- 依存モジュール ----------------------------- */
import { gameState, updatePlayerName } from './core/gameState.js';
import { setCanvas, update as updateScreen, render as renderScreen } from './core/screenManager.js';
import { initAssets } from './loaders/assetsLoader.js';
import { loadAllGameData } from './loaders/dataLoader.js';
import {
  initializeFirebaseServices,
  signInAnonymouslyIfNeeded,
  loadAllStageClearStatus,
  getCurrentUser,
  initializeNewPlayerData,
  loadPlayerData
} from './services/firebase/firebaseController.js';
import { AudioManager } from './audio/audioManager.js';
import { subscribe, publish } from './core/eventBus.js';
import reviewQueue from './models/reviewQueue.js';
import DataSync from './services/firebase/dataSync.js';
import { FSM } from './core/stateMachine.js';
import { setupFSM } from './init/fsmsetup.js';
import { checkAchievements } from './core/achievementManager.js';
import { addKanji } from './models/kanjiDex.js';
import practiceBattleScreen from './screens/practiceBattleScreen.js';


/* ----------------------------- 実績通知システム ----------------------------- */
const achievementNotificationQueue = [];

/* ----------------------------- DOM / Canvas ----------------------------- */
const canvas = document.getElementById('gameCanvas');
canvas.width = 800;  // 追加: ゲーム内部の基準幅
canvas.height = 600; // 追加: ゲーム内部の基準高さ
const ctx    = canvas.getContext('2d');
setCanvas(canvas);
// ★ ここで AudioManager を生成して export
const audio = new AudioManager();

// ── 先にイベント購読を登録（最重要） ──
import { subscribe, publish } from './core/eventBus.js';
subscribe('playSE',  name => audio.playSE(name));
subscribe('playBGM', (name, loop = true) => audio.playBGM(name, loop));

// ────────────────
// モバイルブラウザの自動再生制限対策：
// 最初のユーザー操作のときだけ BGM を始動させる
// ────────────────
document.body.addEventListener(
  'pointerdown',
  () => {
    publish('playBGM', 'title');   // ここは publish のままでOK（購読が先にある）
  },
  { once: true }
);

/* ----------------------------- アプリ初期化 ----------------------------- */
let lastTime = performance.now();
function loop(now) {
  const dt = now - lastTime;
  lastTime = now;
  
  // プレイ時間の統計更新（毎フレーム）
  gameState.playerStats.playtimeSeconds += dt / 1000;
  
  // ロジック更新
  updateScreen(dt);
  // 描画
  renderScreen();
  
  // 実績通知の描画
  drawAchievementNotifications(ctx);
  
  requestAnimationFrame(loop);
}

/**
 * 実績解除通知のポップアップを描画する
 * @param {CanvasRenderingContext2D} ctx キャンバスコンテキスト
 */
function drawAchievementNotifications(ctx) {
  if (achievementNotificationQueue.length === 0) return;
  
  // 画面下部に表示するための基準位置
  const baseY = canvas.height - 150;
  const popupWidth = 400;
  const popupHeight = 80;
  const popupX = (canvas.width - popupWidth) / 2;
  
  achievementNotificationQueue.forEach((notification, index) => {
    const y = baseY - (index * (popupHeight + 10)); // 複数の通知は上に重ねて表示
    
    // 背景（リッチなスタイル）
    ctx.save();
    
    // 外側の影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
    
    // グラデーション背景
    const gradient = ctx.createLinearGradient(popupX, y, popupX, y + popupHeight);
    gradient.addColorStop(0, '#FFD700'); // ゴールド
    gradient.addColorStop(1, '#FFA500'); // オレンジ
    
    ctx.fillStyle = gradient;
    ctx.fillRect(popupX, y, popupWidth, popupHeight);
    
    // 枠線
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#B8860B'; // ダークゴールド
    ctx.lineWidth = 3;
    ctx.strokeRect(popupX, y, popupWidth, popupHeight);
    
    // アイコン部分の背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(popupX + 10, y + 10, 60, popupHeight - 20);
    
    // テキスト描画
    ctx.fillStyle = '#000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    // 🏆アイコンと「実績解除！」
    ctx.font = 'bold 24px "UDデジタル教科書体", sans-serif';
    ctx.fillText('🏆', popupX + 25, y + popupHeight / 2 - 10);
    
    ctx.font = 'bold 18px "UDデジタル教科書体", sans-serif';
    ctx.fillText('実績解除！', popupX + 80, y + 25);
    
    // 実績タイトル
    ctx.font = '16px "UDデジタル教科書体", sans-serif';
    ctx.fillStyle = '#333';
    
    // 長いタイトルは省略
    let title = notification.title;
    if (title.length > 20) {
      title = title.substring(0, 20) + '...';
    }
    
    ctx.fillText(title, popupX + 80, y + 50);
    
    // キラキラエフェクト（簡易版）
    const sparkles = ['✨', '⭐', '💫'];
    for (let i = 0; i < 3; i++) {
      const sparkleX = popupX + popupWidth - 60 + (i * 20);
      const sparkleY = y + 20 + (Math.sin(Date.now() / 500 + i) * 10);
      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#FFF';
      ctx.fillText(sparkles[i], sparkleX, sparkleY);
    }
    
    ctx.restore();
  });
}

(async function initGame() {
  console.log('🔧 Init start');
  // 1) 画像 & JSON プリロード
  await initAssets();

  // ▼ FSM の初期化を切り出し
  window.fsm = await setupFSM();

  // 2) Firebase
  if (!initializeFirebaseServices()) return;
  const user = await signInAnonymouslyIfNeeded();
  console.log('UID:', user?.uid);
  
  // loadPlayerData()はsignInAnonymouslyIfNeeded()内で既に呼び出されているため、
  // ここでの重複呼び出しは不要です
  
  await loadAllStageClearStatus();

  // セーブデータ読み込み完了後に実績チェックを実行（プレイ時間や累計系実績のチェック）
  try {
    await checkAchievements();
    console.log('✅ ゲーム起動時の実績チェック完了');
  } catch (error) {
    console.error('❌ ゲーム起動時の実績チェックでエラー:', error);
  }

  // プレイヤーデータを読み込む処理を追加
  await loadPlayerData();

  // ─────────── プレイヤー名自動入力 ───────────
  // データ未設定時に名前を聞いて gameState にセット、Firestore に書き込む
  if (!gameState.playerName || ['ゲスト', 'ななしのごんべえ', '新規プレイヤー'].includes(gameState.playerName)) {
    const inputName = prompt('プレイヤー名を入力してください（5文字以内）', '');
    if (inputName) {
      const name = inputName.trim().slice(0, 5);
      updatePlayerName(name);
      if (user && user.uid) {
          await initializeNewPlayerData(user.uid, name);
        }
      }
    }
  // 3) BattleScreen 側のセットアップ
   // 🔽 ここでステージ ID を仮にセット
  gameState.currentStageId = 'hokkaido_area1';

  // DataSync 初期化（Firestore → localStorage のマージ監視開始）
  DataSync.initialize();

  // 4) FSMは既に初期状態で'title'画面を設定済みのため、追加の画面遷移は不要

  console.log('✅ Init done → Start loop');
  requestAnimationFrame(loop);
})();



// ── 追加：音量設定／取得をEventBus経由に ──
subscribe('setBGMVolume', v => audio.setBGMVolume(v));
subscribe('setSEVolume', v => audio.setSEVolume(v));
subscribe('getBGMVolume', callback => callback(audio.getBGMVolume()));
subscribe('getSEVolume', callback => callback(audio.getSEVolume()));

// 実績解除イベントの購読
subscribe('achievementUnlocked', (achievementData) => {
  console.log(`🎉 実績解除通知: ${achievementData.title}`);
  
  // 通知キューに追加
  achievementNotificationQueue.push({
    title: achievementData.title,
    description: achievementData.description,
    timestamp: Date.now()
  });
  
  // 3.5秒後に通知を自動削除
  setTimeout(() => {
    const index = achievementNotificationQueue.findIndex(
      n => n.timestamp === Date.now() - 3500
    );
    if (index !== -1) {
      achievementNotificationQueue.splice(index, 1);
    }
    // より確実な削除のため、最初の要素を削除（FIFO）
    if (achievementNotificationQueue.length > 0) {
      achievementNotificationQueue.shift();
    }
  }, 3500);
});

// 漢字図鑑に追加するイベントを購読
subscribe('addToKanjiDex', id => {
  addKanji(id);
});

// ... アプリ初期化後などの適切な位置で ...
subscribe('addToReview', id => {
  reviewQueue.add(id);
});

// Firestoreユーザーデータ削除イベント

   subscribe('deleteUserData', async (payload) => {
     try {
       const { uid, callback } = payload || {};
       const { deleteUserData } = await import('./services/firebase/firebaseController.js');
       const ok = uid ? await deleteUserData(uid) : false;
       callback && callback({ success: !!ok });
     } catch (e) {
       console.error('deleteUserData handler failed:', e);
       if (payload && payload.callback) payload.callback({ success: false, error: e?.message || 'unknown error' });
     }
   });
;