// src/init/fsmSetup.js
import { FSM } from '../core/stateMachine.js';
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
import proverbMonsterDexState from '../screens/Dex/proverbMonsterDexScreen.js';
// 追加
import profileScreen       from '../screens/profileScreen.js';
import gradeQuizScreen     from '../screens/gradeQuizScreen.js';

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
    proverbMonsterDex: proverbMonsterDexState,
    gradeQuiz:        gradeQuizScreen,
    // 追加
    profile:          profileScreen,
    // 共通バトル画面を追加
    battle:           battleFactory('default'),
  };
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
                        'profile'];
    
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
  subscribe('changeScreen', switchScreen);

  // デバッグ用にグローバル公開
  window.switchScreen = switchScreen;

  return fsm;
}
