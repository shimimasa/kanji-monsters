// js/settingsScreen.js
import { gameState, saveGameData } from '../core/gameState.js';
import { drawButton, isMouseOverRect, drawThemeBackground, drawPanelBackground } from '../ui/uiRenderer.js';
import { getCurrentUser } from '../services/firebase/firebaseController.js';
import { publish } from '../core/eventBus.js';

// レベルプリセット定義
const LEVEL_PRESETS = {
  'elementary1': { 
    level: 1, 
    label: '小学1年生レベル', 
    exp: 0,
    description: '基本的なひらがな・カタカナの漢字から学習'
  },
  'elementary4': { 
    level: 11, 
    label: '小学4年生レベル', 
    exp: calculateExpForLevel(11),
    description: '小学校中学年レベルの漢字から学習'
  },
  'junior1': { 
    level: 30, 
    label: '中学1年生レベル', 
    exp: calculateExpForLevel(30),
    description: '中学校レベルの漢字から学習'
  }
};

// レベル計算関数（gameState.jsから移植）
function calculateExpForLevel(level) {
  if (!Number.isInteger(level) || level < 1) {
    return 100;
  }
  if (level === 1) {
    return 100;
  }
  const previousLevelExp = calculateExpForLevel(level - 1);
  return Math.floor(previousLevelExp * 1.2) + 20;
}

const settingsScreenState = {
  canvas: null,
  ctx: null,
  _clickHandler: null,

  /** 画面表示時の初期化 */
  enter(arg) {
    // canvas 引数が HTMLCanvasElement ならそれを使い、そうでなければ DOM から取得
    this.canvas = (arg && typeof arg.getContext === 'function')
      ? arg
      : document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');

    // uiOverlay要素を取得し、存在しない場合はdocument.bodyにフォールバック
    const uiRoot = document.getElementById('uiOverlay') || document.body;

    // 既存のDOM要素をクリーンアップ
    this.cleanupDOM();

    // 設定画面専用のコンテナを作成
    this.createSettingsContainer(uiRoot);

    // クリックイベント登録
    this.registerHandlers();
  },

  /** 設定画面専用のコンテナを作成 */
  createSettingsContainer(uiRoot) {
    // メインコンテナ
    const settingsContainer = document.createElement('div');
    settingsContainer.id = 'settingsContainer';
    settingsContainer.className = 'settings-container';
    
    // DOM要素としてタイトルを生成
    const settingsTitle = document.createElement('h2');
    settingsTitle.textContent = '設定';
    settingsTitle.className = 'settings-title';
    settingsContainer.appendChild(settingsTitle);
    
    // ゲームモード設定パネル
    const gameModePanel = this.createGameModePanel();
    settingsContainer.appendChild(gameModePanel);
    
    // オーディオ設定パネル
    const audioPanel = this.createAudioPanel();
    settingsContainer.appendChild(audioPanel);

    // バトル設定パネル（レベル変更機能を含む）
    const battlePanel = this.createBattlePanel();
    settingsContainer.appendChild(battlePanel);
    
    // ボタンセクションを作成
    const buttonSection = this.createButtonSection();
    settingsContainer.appendChild(buttonSection);
    
    uiRoot.appendChild(settingsContainer);
  },

  /** ゲームモード設定パネルを作成 */
  createGameModePanel() {
    const panel = document.createElement('div');
    panel.className = 'settings-panel';
    
    const title = document.createElement('h3');
    title.className = 'panel-title';
    title.textContent = 'ゲームモード設定';
    panel.appendChild(title);
    
    // ゲームモード選択
    const modeGroup = document.createElement('div');
    modeGroup.className = 'setting-group';
    
    const modeLabel = document.createElement('div');
    modeLabel.className = 'setting-label-with-tooltip';
    
    const modeLabelText = document.createElement('span');
    modeLabelText.className = 'setting-label';
    modeLabelText.textContent = 'ゲームモード';
    
    const modeTooltipTrigger = document.createElement('span');
    modeTooltipTrigger.className = 'tooltip-trigger';
    modeTooltipTrigger.textContent = '？';
    
    modeLabel.appendChild(modeLabelText);
    modeLabel.appendChild(modeTooltipTrigger);
    
    // ラジオボタン群のコンテナ
    const modeRadioContainer = document.createElement('div');
    modeRadioContainer.className = 'radio-container';
    
    // じっくりモード
    const jikkuriLabel = document.createElement('label');
    jikkuriLabel.className = 'radio-label';
    jikkuriLabel.innerHTML = `
      <input type="radio" name="gameMode" value="jikkuri" id="jikkuriMode">
      <span class="radio-custom"></span>
      じっくりモード
    `;
    
    // チャレンジモード
    const challengeLabel = document.createElement('label');
    challengeLabel.className = 'radio-label';
    challengeLabel.innerHTML = `
      <input type="radio" name="gameMode" value="challenge" id="challengeMode">
      <span class="radio-custom"></span>
      チャレンジモード
    `;
    
    modeRadioContainer.appendChild(jikkuriLabel);
    modeRadioContainer.appendChild(challengeLabel);
    
    // モードの説明文
    const modeDescription = document.createElement('div');
    modeDescription.className = 'mode-description';
    modeDescription.id = 'modeDescription';
    
    modeGroup.appendChild(modeLabel);
    modeGroup.appendChild(modeRadioContainer);
    modeGroup.appendChild(modeDescription);
    panel.appendChild(modeGroup);
    
    // ツールチップとイベントリスナーを設定
    this._setupTooltipEvents(
      modeTooltipTrigger,
      'じっくりモード: 時間制限なし、ゆっくり考えながらプレイできます。\nチャレンジモード: 時間制限あり、スピードと正確性が求められます。'
    );
    this.setupGameModeEvents();
    
    return panel;
  },

  /** ゲームモード設定のイベントリスナーを設定 */
  setupGameModeEvents() {
    // 初期値をローカルストレージから取得
    const savedGameMode = localStorage.getItem('gameMode') || 'jikkuri';
    
    // 少し遅延してから初期値を設定
    setTimeout(() => {
      const jikkuriRadio = document.getElementById('jikkuriMode');
      const challengeRadio = document.getElementById('challengeMode');
      const modeDescription = document.getElementById('modeDescription');
      
      if (jikkuriRadio && challengeRadio && modeDescription) {
        // 保存されたモードに応じてラジオボタンを設定
        if (savedGameMode === 'jikkuri') {
          jikkuriRadio.checked = true;
        } else {
          challengeRadio.checked = true;
        }
        
        // 初期説明文を設定
        this._updateModeDescription(savedGameMode, modeDescription);
        
        // イベントリスナーを設定
        jikkuriRadio.addEventListener('change', () => {
          if (jikkuriRadio.checked) {
            this._saveModeAndUpdateDescription('jikkuri', modeDescription);
          }
        });
        
        challengeRadio.addEventListener('change', () => {
          if (challengeRadio.checked) {
            this._saveModeAndUpdateDescription('challenge', modeDescription);
          }
        });
      }
    }, 100);
  },

  /** ゲームモードを保存し、説明文を更新 */
  _saveModeAndUpdateDescription(mode, descriptionElement) {
    // ローカルストレージに保存
    localStorage.setItem('gameMode', mode);
    
    // 説明文を更新
    this._updateModeDescription(mode, descriptionElement);
    
    // フィードバックSE再生
    publish('playSE', 'decide');
    
    console.log('ゲームモード設定完了:', mode);
    
    // 設定変更の視覚的フィードバック
    descriptionElement.style.color = '#2ecc71';
    descriptionElement.style.fontWeight = 'bold';
    setTimeout(() => {
      descriptionElement.style.color = '';
      descriptionElement.style.fontWeight = '';
    }, 1000);
  },

  /** モードの説明文を更新 */
  _updateModeDescription(mode, descriptionElement) {
    const descriptions = {
      jikkuri: '🐌 じっくりモード：時間制限なしで、ゆっくり考えながら漢字の読みを学習できます。初心者の方やじっくり学びたい方におすすめです。',
      challenge: '⚡ チャレンジモード：時間制限ありで、スピードと正確性が求められます。ゲーム感覚で楽しみたい方や、実力を試したい方におすすめです。'
    };
    
    descriptionElement.textContent = descriptions[mode] || descriptions.jikkuri;
  },

  /** オーディオ設定パネルを作成 */
  createAudioPanel() {
    const panel = document.createElement('div');
    panel.className = 'settings-panel';
    
    const title = document.createElement('h3');
    title.className = 'panel-title';
    title.textContent = 'オーディオ設定';
    panel.appendChild(title);
    
    // BGM音量スライダー
    const bgmGroup = document.createElement('div');
    bgmGroup.className = 'setting-group';
    
    const bgmLabel = document.createElement('label');
    bgmLabel.className = 'setting-label';
    bgmLabel.textContent = 'BGM音量';
    
    const bgmSlider = document.createElement('input');
    bgmSlider.type = 'range';
    bgmSlider.id = 'bgmVolumeSlider';
    bgmSlider.className = 'volume-slider';
    bgmSlider.min = '0';
    bgmSlider.max = '1';
    bgmSlider.step = '0.01';
    bgmSlider.value = '0.7';
    
    const bgmValue = document.createElement('span');
    bgmValue.className = 'volume-value';
    bgmValue.textContent = '70%';
    
    bgmGroup.appendChild(bgmLabel);
    bgmGroup.appendChild(bgmSlider);
    bgmGroup.appendChild(bgmValue);
    panel.appendChild(bgmGroup);
    
    // SE音量スライダー
    const seGroup = document.createElement('div');
    seGroup.className = 'setting-group';
    
    const seLabel = document.createElement('label');
    seLabel.className = 'setting-label';
    seLabel.textContent = 'SE音量';
    
    const seSlider = document.createElement('input');
    seSlider.type = 'range';
    seSlider.id = 'seVolumeSlider';
    seSlider.className = 'volume-slider';
    seSlider.min = '0';
    seSlider.max = '1';
    seSlider.step = '0.01';
    seSlider.value = '0.7';
    
    const seValue = document.createElement('span');
    seValue.className = 'volume-value';
    seValue.textContent = '70%';
    
    seGroup.appendChild(seLabel);
    seGroup.appendChild(seSlider);
    seGroup.appendChild(seValue);
    panel.appendChild(seGroup);
    
    // イベントリスナーを設定
    this.setupAudioEvents(bgmSlider, bgmValue, seSlider, seValue);
    
    return panel;
  },

  /** オーディオ設定のイベントリスナーを設定 */
  setupAudioEvents(bgmSlider, bgmValue, seSlider, seValue) {
    // BGM音量の初期値を取得
    publish('getBGMVolume', (volume) => {
      bgmSlider.value = volume;
      bgmValue.textContent = Math.round(volume * 100) + '%';
    });

    // BGM音量変更イベント（リアルタイム更新）
    bgmSlider.addEventListener('input', (e) => {
      const volume = parseFloat(e.target.value);
      bgmValue.textContent = Math.round(volume * 100) + '%';
      publish('setBGMVolume', volume);
    });

    // BGM音量変更イベント（設定完了時のフィードバック）
    bgmSlider.addEventListener('change', (e) => {
      publish('playSE', 'decide');
      console.log('BGM音量設定完了:', parseFloat(e.target.value));
    });

    // SE音量の初期値を取得
    publish('getSEVolume', (volume) => {
      seSlider.value = volume;
      seValue.textContent = Math.round(volume * 100) + '%';
    });

    // SE音量変更イベント（リアルタイム更新）
    seSlider.addEventListener('input', (e) => {
      const volume = parseFloat(e.target.value);
      seValue.textContent = Math.round(volume * 100) + '%';
      publish('setSEVolume', volume);
      // テスト用にSEを再生
      publish('playSE', 'decide');
    });

    // SE音量変更イベント（設定完了時のフィードバック）
    seSlider.addEventListener('change', (e) => {
      console.log('SE音量設定完了:', parseFloat(e.target.value));
    });
  },

  /** バトル設定パネルを作成（レベル変更機能付き） */
  createBattlePanel() {
    const panel = document.createElement('div');
    panel.className = 'settings-panel';
    
    const title = document.createElement('h3');
    title.className = 'panel-title';
    title.textContent = 'バトル設定';
    panel.appendChild(title);
    
    // レベル設定グループを追加
    const levelGroup = this.createLevelSettingGroup();
    panel.appendChild(levelGroup);
    
    // 既存の回復回数設定
    const healGroup = document.createElement('div');
    healGroup.className = 'setting-group';
    
    const healLabel = document.createElement('div');
    healLabel.className = 'setting-label-with-tooltip';
    
    const healLabelText = document.createElement('span');
    healLabelText.className = 'setting-label';
    healLabelText.textContent = '回復回数の上限';
    
    const healTooltipTrigger = document.createElement('span');
    healTooltipTrigger.className = 'tooltip-trigger';
    healTooltipTrigger.textContent = '？';
    
    healLabel.appendChild(healLabelText);
    healLabel.appendChild(healTooltipTrigger);
    
    // スライダーと値表示のコンテナ
    const healControlContainer = document.createElement('div');
    healControlContainer.className = 'slider-container';
    
    const healSlider = document.createElement('input');
    healSlider.type = 'range';
    healSlider.id = 'healCountSlider';
    healSlider.className = 'heal-count-slider';
    healSlider.min = '1';
    healSlider.max = '5';
    healSlider.step = '1';
    healSlider.value = '3'; // デフォルト値
    
    const healValue = document.createElement('span');
    healValue.className = 'heal-count-value';
    healValue.textContent = '3回';
    
    healControlContainer.appendChild(healSlider);
    healControlContainer.appendChild(healValue);
    
    healGroup.appendChild(healLabel);
    healGroup.appendChild(healControlContainer);
    panel.appendChild(healGroup);
    
    // ツールチップとイベントリスナーを設定
    this._setupTooltipEvents(
      healTooltipTrigger,
      '各ステージで使用できる回復の回数上限を設定します。難易度を調整したい時にご利用ください。'
    );
    this.setupBattleEvents(healSlider, healValue);
    
    return panel;
  },

  /** レベル設定グループを作成 */
  createLevelSettingGroup() {
    const levelGroup = document.createElement('div');
    levelGroup.className = 'setting-group';
    
    const levelLabel = document.createElement('div');
    levelLabel.className = 'setting-label-with-tooltip';
    
    const levelLabelText = document.createElement('span');
    levelLabelText.className = 'setting-label';
    levelLabelText.textContent = '学習レベル';
    
    const levelTooltipTrigger = document.createElement('span');
    levelTooltipTrigger.className = 'tooltip-trigger';
    levelTooltipTrigger.textContent = '？';
    
    levelLabel.appendChild(levelLabelText);
    levelLabel.appendChild(levelTooltipTrigger);
    
    // 現在のレベル表示
    const currentLevelDisplay = document.createElement('div');
    currentLevelDisplay.className = 'current-level-display';
    currentLevelDisplay.id = 'currentLevelDisplay';
    
    // ラジオボタン群のコンテナ
    const levelRadioContainer = document.createElement('div');
    levelRadioContainer.className = 'radio-container level-radio-container';
    
    // 各レベルプリセットのラジオボタンを作成
    Object.entries(LEVEL_PRESETS).forEach(([key, preset]) => {
      const levelOption = document.createElement('label');
      levelOption.className = 'radio-label level-option';
      levelOption.innerHTML = `
        <input type="radio" name="playerLevel" value="${key}" id="level_${key}">
        <span class="radio-custom"></span>
        <div class="level-option-content">
          <div class="level-option-title">${preset.label}</div>
          <div class="level-option-description">${preset.description}</div>
          <div class="level-option-stats">レベル ${preset.level}</div>
        </div>
      `;
      levelRadioContainer.appendChild(levelOption);
    });
    
    // 確認ボタン
    const confirmButton = document.createElement('button');
    confirmButton.className = 'level-change-button';
    confirmButton.textContent = 'レベル変更を適用';
    confirmButton.id = 'confirmLevelChange';
    confirmButton.disabled = true;
    
    levelGroup.appendChild(levelLabel);
    levelGroup.appendChild(currentLevelDisplay);
    levelGroup.appendChild(levelRadioContainer);
    levelGroup.appendChild(confirmButton);
    
    // ツールチップとイベントリスナーを設定
    this._setupTooltipEvents(
      levelTooltipTrigger,
      'プレイヤーの学習レベルを変更できます。レベルを変更すると、経験値・HP・攻撃力が調整されます。'
    );
    this.setupLevelEvents();
    
    return levelGroup;
  },

  /** レベル設定のイベントリスナーを設定 */
  setupLevelEvents() {
    setTimeout(() => {
      this.updateCurrentLevelDisplay();
      
      // ラジオボタンの変更イベント
      const levelRadios = document.querySelectorAll('input[name="playerLevel"]');
      const confirmButton = document.getElementById('confirmLevelChange');
      
      levelRadios.forEach(radio => {
        radio.addEventListener('change', () => {
          if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.classList.add('enabled');
          }
        });
      });
      
      // 確認ボタンのクリックイベント
      if (confirmButton) {
        confirmButton.addEventListener('click', () => {
          this.handleLevelChange();
        });
      }
    }, 100);
  },

  /** 現在のレベル表示を更新 */
  updateCurrentLevelDisplay() {
    const display = document.getElementById('currentLevelDisplay');
    if (!display) return;
    
    // gameStateから現在のレベルを取得
    const currentLevel = gameState?.playerStats?.level || 1;
    const currentExp = gameState?.playerStats?.exp || 0;
    
    // 現在のレベルに対応するプリセットを見つける
    let currentPreset = null;
    for (const [key, preset] of Object.entries(LEVEL_PRESETS)) {
      if (preset.level === currentLevel) {
        currentPreset = preset;
        break;
      }
    }
    
    if (currentPreset) {
      display.innerHTML = `
        <div class="current-level-info">
          <span class="current-level-label">現在のレベル:</span>
          <span class="current-level-value">${currentPreset.label} (Lv.${currentLevel})</span>
        </div>
      `;
    } else {
      display.innerHTML = `
        <div class="current-level-info">
          <span class="current-level-label">現在のレベル:</span>
          <span class="current-level-value">カスタムレベル (Lv.${currentLevel})</span>
        </div>
      `;
    }
  },

  /** レベル変更処理 */
  handleLevelChange() {
    const selectedRadio = document.querySelector('input[name="playerLevel"]:checked');
    if (!selectedRadio) {
      alert('レベルを選択してください。');
      return;
    }
    
    const selectedPreset = LEVEL_PRESETS[selectedRadio.value];
    if (!selectedPreset) {
      console.error('選択されたプリセットが見つかりません:', selectedRadio.value);
      return;
    }
    
    // 確認ダイアログ
    const confirmMessage = `${selectedPreset.label}（レベル${selectedPreset.level}）に変更しますか？\n\n` +
      'レベル・経験値・HP・攻撃力が調整されます。';
    
    if (!confirm(confirmMessage)) {
      return;
    }
    
    try {
      // レベル変更を実行
      this.applyLevelChange(selectedPreset);
      
      // 成功フィードバック
      publish('playSE', 'levelUp');
      alert(`${selectedPreset.label}に変更しました！`);
      
      // 表示を更新
      this.updateCurrentLevelDisplay();
      
      // 確認ボタンを無効化
      const confirmButton = document.getElementById('confirmLevelChange');
      if (confirmButton) {
        confirmButton.disabled = true;
        confirmButton.classList.remove('enabled');
      }
      
      // ラジオボタンをリセット
      const levelRadios = document.querySelectorAll('input[name="playerLevel"]');
      levelRadios.forEach(radio => {
        radio.checked = false;
      });
      
    } catch (error) {
      console.error('レベル変更中にエラーが発生しました:', error);
      alert('レベル変更に失敗しました。');
    }
  },

  /** レベル変更を適用 */
  applyLevelChange(preset) {
    if (!gameState?.playerStats) {
      throw new Error('gameState.playerStatsが見つかりません');
    }
    
    const stats = gameState.playerStats;
    const oldLevel = stats.level;
    
    // 新しいレベルを設定
    stats.level = preset.level;
    stats.exp = preset.exp;
    
    // レベルに応じてステータスを計算
    // 基本値からレベル差分を計算
    const levelDiff = preset.level - 1; // レベル1からの差分
    
    // HP計算: 基本100 + (レベル-1) × 10
    stats.maxHp = 100 + (levelDiff * 10);
    stats.hp = stats.maxHp; // 満タンで開始
    
    // 攻撃力計算: 基本10 + (レベル-1) × 2
    stats.attack = 10 + (levelDiff * 2);
    
    // 次のレベルに必要な経験値を設定
    if (preset.level < 100) { // 最大レベル制限
      stats.nextLevelExp = calculateExpForLevel(preset.level + 1) - preset.exp;
    } else {
      stats.nextLevelExp = 999999; // 最大レベル到達時
    }
    
    // 回復回数をリセット
    stats.healCount = 3;
    
    // スキルポイントをレベルに応じて設定
    stats.skillPoints = Math.max(0, preset.level - 1);
    
    console.log(`レベル変更完了: ${oldLevel} → ${preset.level}`);
    console.log('新しいステータス:', {
      level: stats.level,
      hp: stats.hp,
      maxHp: stats.maxHp,
      attack: stats.attack,
      exp: stats.exp,
      nextLevelExp: stats.nextLevelExp,
      skillPoints: stats.skillPoints
    });
    
    // セーブデータを更新
    try {
      saveGameData();
    } catch (error) {
      console.warn('セーブデータの保存に失敗:', error);
    }
  },

  /** バトル設定のイベントリスナーを設定 */
  setupBattleEvents(healSlider, healValue) {
    // 初期値をローカルストレージから取得
    const savedHealCount = localStorage.getItem('maxHealCount');
    const initialHealCount = savedHealCount ? parseInt(savedHealCount, 10) : 3;
    
    // スライダーと表示を初期値に設定
    healSlider.value = initialHealCount;
    healValue.textContent = initialHealCount + '回';
    
    // リアルタイム更新（スライダー操作中）
    healSlider.addEventListener('input', (e) => {
      const count = parseInt(e.target.value, 10);
      healValue.textContent = count + '回';
    });
    
    // 設定変更完了時の処理
    healSlider.addEventListener('change', (e) => {
      const count = parseInt(e.target.value, 10);
      
      // ローカルストレージに保存
      localStorage.setItem('maxHealCount', count.toString());
      
      // フィードバックSE再生
      publish('playSE', 'decide');
      
      console.log('回復回数上限設定完了:', count);
      
      // 設定変更の視覚的フィードバック
      healValue.style.color = '#2ecc71';
      healValue.style.fontWeight = 'bold';
      setTimeout(() => {
        healValue.style.color = '';
        healValue.style.fontWeight = '';
      }, 500);
    });
  },

  /** ボタンセクションを作成 */
  createButtonSection() {
    const buttonSection = document.createElement('div');
    buttonSection.className = 'settings-button-section';
    
    // データリセットボタン（ツールチップ付き）
    const resetButtonContainer = document.createElement('div');
    resetButtonContainer.style.position = 'relative';
    resetButtonContainer.style.display = 'flex';
    resetButtonContainer.style.alignItems = 'center';
    resetButtonContainer.style.gap = '10px';
    
    const resetButton = document.createElement('button');
    resetButton.className = 'settings-button danger';
    resetButton.textContent = 'データリセット（はじめから）';
    resetButton.addEventListener('click', () => {
      publish('playSE', 'decide');
      this.resetData();
    });
    
    // ツールチップトリガー
    const resetTooltipTrigger = document.createElement('span');
    resetTooltipTrigger.className = 'tooltip-trigger';
    resetTooltipTrigger.textContent = '？';
    resetTooltipTrigger.style.flexShrink = '0';
    
    resetButtonContainer.appendChild(resetButton);
    resetButtonContainer.appendChild(resetTooltipTrigger);
    
    // ツールチップイベントを設定
    this._setupTooltipEvents(resetTooltipTrigger, '全てのセーブデータが削除され、元に戻せなくなります。レベル、図鑑、ステージ進捗、設定など、ゲームの全ての記録が完全に消去されます。');
    
    // メインメニューへ戻るボタン
    const backButton = document.createElement('button');
    backButton.className = 'settings-button primary';
    backButton.textContent = 'メインメニューへもどる';
    backButton.addEventListener('click', () => {
      publish('playSE', 'decide');
      publish('changeScreen', 'title');
    });
    
    buttonSection.appendChild(resetButtonContainer);
    buttonSection.appendChild(backButton);
    
    return buttonSection;
  },

  /** ツールチップのイベントリスナーを設定 */
  _setupTooltipEvents(triggerElement, tooltipText) {
    let tooltipElement = null;
    
    // マウスオーバーでツールチップ表示
    triggerElement.addEventListener('mouseover', (e) => {
      // 既存のツールチップを削除
      this._removeActiveTooltip();
      
      tooltipElement = document.createElement('div');
      tooltipElement.className = 'settings-tooltip';
      tooltipElement.textContent = tooltipText;
      
      // 位置を計算
      const rect = triggerElement.getBoundingClientRect();
      tooltipElement.style.left = rect.left + 'px';
      tooltipElement.style.top = (rect.bottom + 5) + 'px';
      
      document.body.appendChild(tooltipElement);
      
      // フェードイン効果
      setTimeout(() => {
        if (tooltipElement) {
          tooltipElement.classList.add('show');
        }
      }, 10);
    });
    
    // マウスアウトでツールチップ非表示
    triggerElement.addEventListener('mouseout', () => {
      this._removeActiveTooltip();
      tooltipElement = null;
    });
    
    // クリックでもツールチップを非表示（モバイル対応）
    triggerElement.addEventListener('click', (e) => {
      e.preventDefault();
      this._removeActiveTooltip();
    });
  },

  /** アクティブなツールチップを削除 */
  _removeActiveTooltip() {
    const activeTooltips = document.querySelectorAll('.settings-tooltip');
    activeTooltips.forEach(tooltip => {
      tooltip.remove();
    });
  },

  /** DOM要素のクリーンアップ */
  cleanupDOM() {
    const existingContainer = document.getElementById('settingsContainer');
    if (existingContainer) {
      existingContainer.remove();
    }
  },

  /** 毎フレーム描画 */
  update(dt) {
    const { ctx, canvas } = this;
    
    // テーマ性のある背景を描画
    drawThemeBackground(ctx, canvas.width, canvas.height);
  },

  /** 画面離脱時のクリーンアップ */
  exit() {
    this.unregisterHandlers();
    this.cleanupDOM();
    // アクティブなツールチップも削除
    this._removeActiveTooltip();
    
    this.canvas = null;
    this.ctx = null;
  },

  /** クリックイベント登録 */
  registerHandlers() {
    this._clickHandler = this.handleClick.bind(this);
    this.canvas.addEventListener('click', this._clickHandler);
    this.canvas.addEventListener('touchstart', this._clickHandler);
  },

  /** クリックイベント解除 */
  unregisterHandlers() {
    if (this.canvas && this._clickHandler) {
      this.canvas.removeEventListener('click', this._clickHandler);
      this.canvas.removeEventListener('touchstart', this._clickHandler);
    }
  },

  /** クリック処理 */
    handleClick(e) {
      // Canvas上のボタン処理は全て削除済み
      // 必要に応じて、Canvas背景クリック時の処理のみ残す
      e.preventDefault();
    },

  /** データリセット処理 - 完全版 */
  async resetData() {
    const user = getCurrentUser();
    
    try {
      // 第1段階: 具体的な確認ダイアログ
      const firstConfirm = confirm(
        '【最終確認】レベル、図鑑、ステージの進捗など、全てのセーブデータが完全に削除されます。\n' +
        'この操作は取り消せません。よろしいですか？'
      );
      
      if (!firstConfirm) {
        console.log('データリセット操作がキャンセルされました（第1段階）');
        return;
      }

      // 第2段階: ダブルチェック - 確認ワードの入力
      const confirmWord = prompt(
        '最終確認として、以下の文字を正確に入力してください：\n\n' +
        '「リセット」\n\n' +
        '※ひらがな・カタカナは区別されます'
      );
      
      if (confirmWord !== 'リセット') {
        if (confirmWord === null) {
          console.log('データリセット操作がキャンセルされました（第2段階）');
        } else {
          alert('入力された文字が正しくありません。データリセットを中止します。');
          console.log('データリセット操作が中止されました（確認ワード不一致）');
        }
        return;
      }

      // 第3段階: 実際のデータ削除処理
      console.log('データリセット処理を開始します...');
      
      // ローディング表示
      const loadingElement = this._showLoadingMessage('データを削除中...');
      
      try {
        // 1. LocalStorageの全関連データを削除
        this._clearLocalStorageData();
        
        // 2. Firebase Firestoreのユーザーデータを削除
        if (user?.uid) {
          await this._clearFirebaseUserData(user.uid);
        }
        
        // 3. アクセシビリティ設定も初期化
        this._resetAccessibilitySettings();
        
        // 4. GameStateの初期化
        this._resetGameState();
        
        // ローディング表示を非表示
        this._hideLoadingMessage(loadingElement);
        
        console.log('データリセット処理が完了しました');
        
        // 成功メッセージ表示
        alert('全てのデータが正常にリセットされました。\nタイトル画面に戻ります。');
        
        // 完全リセットのためリロード
        window.location.reload();
        
      } catch (error) {
        console.error('データリセット処理中にエラーが発生しました:', error);
        this._hideLoadingMessage(loadingElement);
        alert('データのリセット中にエラーが発生しました。\n一部のデータが削除されていない可能性があります。');
      }
      
    } catch (error) {
      console.error('データリセット処理でエラーが発生しました:', error);
      alert('データのリセットに失敗しました。');
    }
  },

  /** LocalStorageの全関連データを削除 */
  _clearLocalStorageData() {
    const keysToRemove = [];
    
    // ゲーム関連のキーを収集
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('game_') ||
        key.startsWith('kanji_') ||
        key.startsWith('user_') ||
        key.startsWith('progress_') ||
        key.startsWith('level_') ||
        key.startsWith('dex_') ||
        key.startsWith('battle_') ||
        key.startsWith('achievement_') ||
        key.startsWith('clear_') ||           // ← 追加: ステージクリアフラグ
        key === 'kanjiGameSave' ||            // ← 追加: メインセーブ
        key === 'gameMode' ||                 // ← 追加: ゲームモード
        key === 'maxHealCount' ||             // ← 追加: 回復回数設定
        key === 'bgmVolume' ||
        key === 'seVolume' ||
        key === 'cbMode' ||
        key === 'bigFont' ||
        key === 'lastPlayedStage' ||
        key === 'playerStats' ||
        key === 'unlockedStages'
      )) {
        keysToRemove.push(key);
      }
    }
    
    // 収集したキーのデータを削除
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`LocalStorage key removed: ${key}`);
    });
    
    console.log(`LocalStorage cleaned: ${keysToRemove.length} keys removed`);
  },

  async _clearFirebaseUserData(uid) {
    return new Promise(async (resolve, reject) => {
      try {
        console.log(`Firebase user data deletion started for UID: ${uid}`);
       const to = setTimeout(() => {
         reject(new Error('Firebase data deletion timeout'));
       }, 10000);
       publish('deleteUserData', {
          uid,
          callback: async (result) => {
            if (result && result.success) {
              console.log('Firebase user data cleared successfully');
             clearTimeout(to);
            resolve();
            } else {
              console.error('Failed to clear Firebase user data:', result?.error || 'Unknown error');
             clearTimeout(to);
            reject(new Error(result?.error || 'Failed to delete user data'));
            }
          }
        });
      } catch (error) {
        console.error('Error in _clearFirebaseUserData:', error);
        reject(error);
      }
    });
  },

  /** ゲームステートのリセット */
  _resetGameState() {
    // gameStateがあれば初期化
    if (typeof gameState !== 'undefined' && gameState.reset) {
      gameState.reset();
      console.log('GameState has been reset');
    }
    
    // その他のグローバル状態もリセット
    publish('resetGameState');
  },

  /** アクセシビリティ設定をリセット */
  _resetAccessibilitySettings() {
    document.body.classList.remove('cb-mode');
    document.body.classList.remove('big-font');
    console.log('アクセシビリティ設定がリセットされました');
  },

  /** ローディングメッセージを表示 */
  _showLoadingMessage(message) {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'resetLoadingMessage';
    loadingDiv.className = 'reset-loading-overlay';
    
    const messageContainer = document.createElement('div');
    messageContainer.className = 'loading-message-container';
    
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    
    const messageText = document.createElement('div');
    messageText.className = 'loading-text';
    messageText.textContent = message;
    
    messageContainer.appendChild(spinner);
    messageContainer.appendChild(messageText);
    loadingDiv.appendChild(messageContainer);
    
    document.body.appendChild(loadingDiv);
    return loadingDiv;
  },

  /** ローディングメッセージを非表示 */
  _hideLoadingMessage(loadingElement) {
    if (loadingElement && loadingElement.parentNode) {
      loadingElement.parentNode.removeChild(loadingElement);
    }
  },

  render() {
    this.update(0);
  }
};

export default settingsScreenState;