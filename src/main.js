import { initializeSaveSession } from './core/saveBootstrap.js';
import { readSaveState } from './core/saveData.js';
/* ----------------------------- 依存モジュール ----------------------------- */
import { gameState, saveGameData, loadGameData } from './core/gameState.js';
import { setCanvas, update as updateScreen, render as renderScreen } from './core/screenManager.js';
import { loadStartupImages, loadRemainingUIImages } from './loaders/assetsLoader.js';
import { createFrameClock } from './core/frameClock.js';
import { loadFirebaseSdk } from './services/firebase/sdkLoader.js';
import {
  initializeFirebaseServices,
  signInAnonymouslyIfNeeded,
  getCurrentUser,
  recoverKrbSaveFromFirestoreIfMissing,
  syncAllCaches,
  startDataSync
} from './services/firebase/firebaseController.js';
import { showBootProgress, updateBootProgress, hideBootProgress, showBootError } from './ui/bootProgress.js';
import { AudioManager } from './audio/audioManager.js';
import reviewQueue from './models/reviewQueue.js';
import { FSM } from './core/stateMachine.js';
import { setupFSM } from './init/fsmsetup.js';
import { checkAchievements } from './core/achievementManager.js';
import { addKanji } from './models/kanjiDex.js';
import practiceBattleScreen from './screens/practiceBattleScreen.js';
import KanaPad from './ui/kanaPad.js';
import TextScale from './ui/textScale.js';
import Ruby from './ui/ruby.js';
import Speech from './audio/speech.js';
import { createAchievementToasts, drawAchievementToast } from './ui/achievementToasts.js';
import { installRotateHint } from './ui/rotateHint.js';


/* ----------------------------- ログ静音化 ----------------------------- */
// 本番ビルドでは冗長ログ（log/debug/info）を黙らせる。
// console.log 447箇所の logger（src/utils/logger.js）移行が完了するまでの暫定措置。
if (!import.meta.env.DEV) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
}

/* ----------------------------- 実績通知システム ----------------------------- */
// 1まいずつ 順番に出す（ui/achievementToasts.js）。音は そのまいを 出す時に 鳴らす
const achievementToasts = createAchievementToasts({ onShow: () => publish('playSE', 'achievement') });

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
subscribe('stopBGM', (duration = 0) => audio.stopBGM(duration));
subscribe('setBGMVolume', v => { audio.setBGMVolume(v); try { saveGameData(); } catch {} });
subscribe('setSEVolume', v => { audio.setSEVolume(v); try { saveGameData(); } catch {} });
subscribe('getBGMVolume', callback => callback(audio.getBGMVolume()));
subscribe('getSEVolume', callback => callback(audio.getSEVolume()));
// ────────────────
// モバイルブラウザの自動再生制限対策：
// 最初のユーザー操作のときだけ BGM を始動させる
// ────────────────
document.body.addEventListener(
  'pointerdown',
  () => {
    publish('playBGM', 'title');   // ここは publish のままでOK（購読が先にある）
    // 音声合成も同じ「最初のタップ」で解錠しておく（外から呼ぶと鳴らない端末があるため）
    Speech.unlock();
  },
  { once: true }
);

/* ----------------------------- アプリ初期化 ----------------------------- */
const frameClock = createFrameClock(performance.now());
let __achvCheckAccum = 0;
function loop(now) {
  const { logicDeltaMs: dt, playtimeDeltaMs } = frameClock.tick(now, document.hidden);
  
  // プレイ時間の統計更新（毎フレーム）
  gameState.playerStats.playtimeSeconds += playtimeDeltaMs / 1000;
  __achvCheckAccum += playtimeDeltaMs;
  
  // ロジック更新
  updateScreen(dt);
  // 描画
  renderScreen();
  
  // 実績の定期チェック（プレイ時間系など）
  if (__achvCheckAccum >= 15000) {
    checkAchievements().catch(() => {});
    __achvCheckAccum = 0;
  }
  
  // 実績通知の描画
  drawAchievementToast(ctx, canvas, achievementToasts.current());
  
  requestAnimationFrame(loop);
}

(async function initGame() {
  console.log('🔧 Init start');
  // ゲーム内の50音パッドを用意する。入力欄は index.html に静的に置いてあるので、
  // ここで捕まえておけば、どの画面が入力欄を出しても自分で追従できる。
  // 文字サイズの設定は、どこかが描き始める前に入れておく（描画は canvas 一本）
  TextScale.install();
  Ruby.install();
  KanaPad.install();
  // スマホを よこに 持った時、canvas の 画面では「たてに してね」を 出す（ui/rotateHint.js）
  installRotateHint();
  // 日本語の声は非同期に届く端末があるので、先に選んでおく
  Speech.warmUp();
  // 1) 画像 & JSON プリロード
  // await initAssets();
  showBootProgress();
  await loadStartupImages((n, total) => updateBootProgress(n, total, '画面を準備中…'));
  updateBootProgress(0, 1, 'データを準備中…');
  try {
    window.fsm = await setupFSM();
  } catch (error) {
    console.error('Required game data could not be loaded', error);
    showBootError('ゲームのデータを読み込めませんでした。通信を確認して、もういちど試してください。');
    return;
  }
  updateBootProgress(1, 1, 'データを準備中…');
  hideBootProgress();
  requestAnimationFrame(loop);

  // セーブ確認が終わるまでタイトル側の開始操作は既存ガードで止まる。
  const connectCloud = async (recoverMissing = false) => {
    await loadFirebaseSdk();
    if (!initializeFirebaseServices()) throw new Error('Cloud connection unavailable');
    await signInAnonymouslyIfNeeded();
    if (recoverMissing) await recoverKrbSaveFromFirestoreIfMissing();
  };
  const session = await initializeSaveSession(() => connectCloud(true));
  if (!session.ok) {
    console.error('Save startup blocked', session.error);
    const errorPanel = showBootError('記録を安全に読み込めませんでした。元の記録は保持しています。もう一度読み込むか、設定からバックアップを読み込んでください。', {
      back: () => { hideBootProgress(); publish('changeScreen', 'settings'); },
      recover: readSaveState().status === 'corrupt' ? async () => {
        await loadFirebaseSdk();
        if (!initializeFirebaseServices()) throw new Error('Cloud unavailable');
        await signInAnonymouslyIfNeeded();
        if (!errorPanel.isConnected) return;
        const isCurrent = () => errorPanel.isConnected;
        const recovered = await initializeSaveSession(() => recoverKrbSaveFromFirestoreIfMissing({ replaceCorrupt: true, isCurrent }), { recoverCorrupt: true, isCurrent });
        if (!recovered.ok) throw recovered.error;
        if (errorPanel.isConnected) location.reload();
      } : null,
    });
    return;
  }
  const preloadRemaining = () => loadRemainingUIImages().catch(() => {});
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(preloadRemaining, { timeout: 2000 });
  } else {
    setTimeout(preloadRemaining, 300);
  }
  if (window.fsm.currentState === window.fsm.states.title) {
    window.fsm.change('title');
  }

  // セーブデータ読み込み完了後に実績チェックを実行（プレイ時間や累計系実績のチェック）
  try {
    await checkAchievements();
    console.log('✅ ゲーム起動時の実績チェック完了');
  } catch (error) {
    console.error('❌ ゲーム起動時の実績チェックでエラー:', error);
  }

  // プレイヤー名が未設定の場合は、タイトルの「スタート」から
  // playerNameInput 画面（ゲーム内UI）で入力してもらう（起動時のネイティブpromptは廃止）
  // 3) BattleScreen 側のセットアップ
  // ステージIDのフォールバック（セーブから復元済みの「前回のステージ」は上書きしない）
  if (!gameState.currentStageId) {
    gameState.currentStageId = 'hokkaido_area1';
  }

  // 既存のローカルセーブはすぐ開始し、クラウド接続は背後で行う。
  // 欠損セーブだけは上の復旧確認を待つため、初期値で上書きしない。
  connectCloud(false).then(() => {
    startDataSync();
    return syncAllCaches();
  }).then(() => {
    console.log('[StepD Step3-2A] syncAllCaches done');
  }).catch(error => {
    console.warn('Cloud sync unavailable; local play continues', error);
  });

   // 4) FSMは既に初期状態で'title'画面を設定済みのため、追加の画面遷移は不要

  // オートセーブ開始
  __setupAutosaveFromSettings();

  console.log('✅ Init done → Start loop');
})();

// ── 追加: オートセーブ管理 ──
let __autosaveTimer = null;
function __setupAutosaveFromSettings() {
  try {
    const enabled = (localStorage.getItem('autosaveEnabled') ?? '1') === '1';
    const minutes = parseInt(localStorage.getItem('autosaveMinutes') || '5', 10);
    if (__autosaveTimer) { clearInterval(__autosaveTimer); __autosaveTimer = null; }
    if (enabled) {
      const ms = Math.max(1, Math.min(60, Number.isFinite(minutes) ? minutes : 5)) * 60 * 1000;
      __autosaveTimer = setInterval(() => {
        try { saveGameData(); } catch (e) { console.warn('autosave failed:', e); }
      }, ms);
    }
  } catch (e) {
    console.warn('autosave setup error:', e);
  }
}
subscribe('updateAutosaveSettings', ({ enabled, minutes }) => {
  try {
    if (typeof enabled === 'boolean') localStorage.setItem('autosaveEnabled', enabled ? '1' : '0');
    if (Number.isFinite(minutes)) localStorage.setItem('autosaveMinutes', String(minutes));
  } catch {}
  __setupAutosaveFromSettings();
});

// ── 追加：音量設定／取得をEventBus経由に ──
subscribe('setBGMVolume', v => audio.setBGMVolume(v));
subscribe('setSEVolume', v => audio.setSEVolume(v));
subscribe('getBGMVolume', callback => callback(audio.getBGMVolume()));
subscribe('getSEVolume', callback => callback(audio.getSEVolume()));

// 実績のお知らせ。同時に いくつ来ても 1まいずつ（2つめ以降が ボタンに かぶらない）。
// multipleAchievementsUnlocked の「まとめ」は achievementToasts が 自分で作るので 使わない
subscribe('achievementUnlocked', (achievementData) => {
  console.log(`🎉 実績解除通知: ${achievementData.title}`);
  achievementToasts.push(achievementData);
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
