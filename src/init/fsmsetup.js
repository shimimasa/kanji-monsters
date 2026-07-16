// src/init/fsmSetup.js
// P0-1 Step3-2: FSM実装の正史を core/fsm.js に統一（互換挙動は core/fsm.js 側で担保）
import { FSM } from '../core/fsm.js';
import { gameState } from '../core/gameState.js';
import battleFactory       from '../states/battleStateFactory.js';
import gradeSelectState    from '../states/gradeSelectState.js';
import regionSelectState   from '../screens/regionSelectScreen.js';
import prefSelectState     from '../states/prefSelectState.js';
import stageSelectState    from '../screens/stageSelectScreen.js';
import titleState          from '../screens/titleScreen.js';
import menuScreenState     from '../screens/menuScreen.js';
import { loadAllGameData } from '../loaders/dataLoader.js';
import { subscribe }       from '../core/eventBus.js';
import settingsState       from '../screens/settingsScreen.js';
import reviewStage         from '../screens/reviewStage.js';
import kanjiDexScreen      from '../screens/Dex/kanjiDexScreen.js';
import monsterDexState     from '../screens/Dex/monsterDexScreen.js';
import resultWinState      from '../screens/resultWinScreen.js';
import gameOverState       from '../screens/gameOverScreen.js';
import resultScreenState   from '../screens/resultScreen.js';
import statusScreen        from '../screens/statusScreen.js';
import achievementsScreen  from '../screens/achievementsScreen.js';
import playerNameInputState from '../screens/playerNameInputScreen.js';
import stageLoadingState   from '../screens/stageLoadingScreen.js';
import courseSelectScreen from '../screens/courseSelectScreen.js';
import continentSelectScreen from '../screens/continentSelectScreen.js';
import worldStageSelectScreen from '../screens/worldStageSelectScreen.js';
// 追加
import profileScreen       from '../screens/profileScreen.js';
import gradeQuizScreen     from '../screens/gradeQuizScreen.js';
import monsterCaptureScreen from '../screens/monsterCaptureScreen.js';
// ★★★ 練習バトル画面を追加 ★★★
import practiceBattleScreen from '../screens/practiceBattleScreen.js';
import quickReviewPracticeScreen from '../screens/quickReviewPracticeScreen.js';

export async function setupFSM() {
  const { stageData } = await loadAllGameData();

  // 各画面／ステートを登録
  const states = {
    title:            titleState,
    playerNameInput:  playerNameInputState,
    menu:             menuScreenState,
    status:           statusScreen,
    achievements:     achievementsScreen,
    gradeSelect:      gradeSelectState,
    regionSelect:     regionSelectState,
    prefSelect:       prefSelectState,
    stageSelect:      stageSelectState,
    settings:         settingsState,
    reviewStage:      reviewStage,
    kanjiDex:         kanjiDexScreen,
    monsterDex:       monsterDexState,
    resultWin:        resultWinState,
    result:           resultScreenState,
    gameOver:         gameOverState,
    stageLoading:     stageLoadingState,
    courseSelect:     courseSelectScreen,
    continentSelect:  continentSelectScreen,
    worldStageSelect: worldStageSelectScreen,
    gradeQuiz:        gradeQuizScreen,
    // 追加
    profile:          profileScreen,
    monsterCapture:   monsterCaptureScreen,
    // ★★★ 練習バトル画面を追加 ★★★
    practiceBattle:   practiceBattleScreen,
    quickReviewPractice: quickReviewPracticeScreen,
    // 共通バトル画面を追加
    battle:           battleFactory('default'),
  };
  // ...
  // ステージごとのバトルステートを一括登録
  stageData.forEach(s => {
    states[s.stageId] = battleFactory(s.stageId);
  });

  // FSM 初期化（開始画面はタイトル）
  const fsm = new FSM('title', states);

  // changeScreen イベントに応じて FSM を切り替えるラッパー
  function switchScreen(name, props) {
    console.log(`画面遷移: ${name}, props=`, props); // デバッグログを追加
    
    // 特定の画面名の場合は直接遷移する（安全リスト）
    const safeScreens = ['title', 'menu', 'stageSelect', 'stageLoading', 'battle', 
                        'worldStageSelect', 'continentSelect', 'courseSelect',
                        // 追加
                        'profile',
                        'monsterCapture',
                        // ★★★ 練習バトル画面を安全リストに追加 ★★★
                        'practiceBattle',
                        'quickReviewPractice'];
    
    if (safeScreens.includes(name)) {
      console.log(`安全な画面[${name}]への遷移を許可`);
      fsm.change(name, props);
      return;
    }
    
    // stageIdと同名の画面への遷移を防止する安全対策
    if (stageData.some(s => s.stageId === name)) {
      console.warn(`ステージID[${name}]への直接遷移を検出。battleに変更します。`);
      gameState.currentStageId = name;
      fsm.change('battle', props);
      return;
    }
    
    // その他の画面への遷移
    fsm.change(name, props);
  }
  // P0-1(設計憲法A): changeScreen payload（string / {name,props} / [name,props]）を setupFSM 側で正規化し、遷移入口をここに集約する
  function __normalizeChangeScreenPayload(payload) {
    if (Array.isArray(payload)) return switchScreen(payload[0], payload[1]);
    if (payload && typeof payload === 'object' && 'name' in payload) return switchScreen(payload.name, payload.props);
    return switchScreen(payload);
  }
  subscribe('changeScreen', __normalizeChangeScreenPayload);

  // P0-1 Step5(設計憲法A): window.switchScreen は開発/デバッグ用途限定（production では露出しない）
  if (import.meta?.env?.DEV) {
    window.switchScreen = switchScreen;
  }

  return fsm;
}