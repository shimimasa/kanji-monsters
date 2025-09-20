// js/settingsScreen.js
import { gameState, saveGameData, loadGameData, clearSaveData } from '../core/gameState.js';
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
    
        // セーブとバックアップ
        const savePanel = this.createSavePanel();
        settingsContainer.appendChild(savePanel);
        
    // レベル設定パネル（新規）
    const levelPanel = this.createLevelPanel();
    settingsContainer.appendChild(levelPanel);
    
    // バトル設定パネル（回復回数 + 回復後の敵行動）
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

  /** レベル設定パネルを作成 */
  createLevelPanel() {
    const panel = document.createElement('div');
    panel.className = 'settings-panel';
    
    const title = document.createElement('h3');
    title.className = 'panel-title';
    title.textContent = 'レベル設定';
    panel.appendChild(title);
    
    // レベル設定グループを追加
    const levelGroup = this.createLevelSettingGroup();
    panel.appendChild(levelGroup);
    
    return panel;
  },

  createBattlePanel() {
    const panel = document.createElement('div');
    panel.className = 'settings-panel';
    
    const title = document.createElement('h3');
    title.className = 'panel-title';
    title.textContent = 'バトル設定';
    panel.appendChild(title);
    
    // 回復回数設定
    const healCountGroup = this.createHealCountGroup();
    panel.appendChild(healCountGroup);
    
    // 回復仕様設定（既存）
    const healModeGroup = this.createHealModeGroup();
    panel.appendChild(healModeGroup);

    // 敵の行動タイミング（新規）
    const enemyAttackModeGroup = this.createEnemyAttackModeGroup();
    panel.appendChild(enemyAttackModeGroup);
    
    return panel;
  },

  /** 回復回数設定グループを作成 */
  createHealCountGroup() {
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
    healSlider.value = '3';
    
    const healValue = document.createElement('span');
    healValue.className = 'heal-count-value';
    healValue.textContent = '3回';
    
    healControlContainer.appendChild(healSlider);
    healControlContainer.appendChild(healValue);
    
    healGroup.appendChild(healLabel);
    healGroup.appendChild(healControlContainer);
    
    // ツールチップとイベントリスナーを設定
    this._setupTooltipEvents(
      healTooltipTrigger,
      '各ステージで使用できる回復の回数上限を設定します。難易度を調整したい時にご利用ください。'
    );
    
    // イベントリスナーを設定
    this.setupHealCountEvents(healSlider, healValue);
    
    return healGroup;
  },

  /** 回復後の敵行動設定グループを作成 */
  createHealModeGroup() {
    const healModeGroup = document.createElement('div');
    healModeGroup.className = 'setting-group';
    
    const healModeLabel = document.createElement('div');
    healModeLabel.className = 'setting-label-with-tooltip';
    
    const healModeLabelText = document.createElement('span');
    healModeLabelText.className = 'setting-label';
    healModeLabelText.textContent = '回復後の敵行動';
    
    const healModeTooltipTrigger = document.createElement('span');
    healModeTooltipTrigger.className = 'tooltip-trigger';
    healModeTooltipTrigger.textContent = '？';
    
    healModeLabel.appendChild(healModeLabelText);
    healModeLabel.appendChild(healModeTooltipTrigger);
    
    // ラジオボタン群のコンテナ
    const healModeRadioContainer = document.createElement('div');
    healModeRadioContainer.className = 'radio-container';
    
    // 攻撃なしモード
    const noAttackLabel = document.createElement('label');
    noAttackLabel.className = 'radio-label';
    noAttackLabel.innerHTML = `
      <input type="radio" name="healMode" value="noAttack" id="noAttackMode">
      <span class="radio-custom"></span>
      攻撃なし（安全）
    `;
    
    // 攻撃ありモード
    const withAttackLabel = document.createElement('label');
    withAttackLabel.className = 'radio-label';
    withAttackLabel.innerHTML = `
      <input type="radio" name="healMode" value="withAttack" id="withAttackMode">
      <span class="radio-custom"></span>
      攻撃あり（チャレンジ）
    `;
    
    healModeRadioContainer.appendChild(noAttackLabel);
    healModeRadioContainer.appendChild(withAttackLabel);
    
    healModeGroup.appendChild(healModeLabel);
    healModeGroup.appendChild(healModeRadioContainer);
    
    // ツールチップとイベントリスナーを設定
    this._setupTooltipEvents(
      healModeTooltipTrigger,
      '回復成功後に敵の攻撃があるかどうかを設定します。「攻撃なし」は初心者向け、「攻撃あり」は戦略性が高まります。'
    );
    this.setupHealModeEvents();
    
    return healModeGroup;
  },

  createEnemyAttackModeGroup() {
    const group = document.createElement('div');
    group.className = 'setting-group';

    const label = document.createElement('div');
    label.className = 'setting-label-with-tooltip';

    const labelText = document.createElement('span');
    labelText.className = 'setting-label';
    labelText.textContent = '敵の行動タイミング';

    const tip = document.createElement('span');
    tip.className = 'tooltip-trigger';
    tip.textContent = '？';

    label.appendChild(labelText);
    label.appendChild(tip);

    const radioContainer = document.createElement('div');
    radioContainer.className = 'radio-container';

    const alwaysLabel = document.createElement('label');
    alwaysLabel.className = 'radio-label';
    alwaysLabel.innerHTML = `
      <input type="radio" name="enemyAttackMode" value="always" id="enemyAttack_always">
      <span class="radio-custom"></span>
      ふつう（毎ターン攻撃）
    `;

    const mistakeOnlyLabel = document.createElement('label');
    mistakeOnlyLabel.className = 'radio-label';
    mistakeOnlyLabel.innerHTML = `
      <input type="radio" name="enemyAttackMode" value="onMistakeOnly" id="enemyAttack_onMistakeOnly">
      <span class="radio-custom"></span>
      かんたん（ミス時のみ攻撃）
    `;

    radioContainer.appendChild(alwaysLabel);
    radioContainer.appendChild(mistakeOnlyLabel);

    group.appendChild(label);
    group.appendChild(radioContainer);

    this._setupTooltipEvents(
      tip,
      '敵の攻撃タイミングを切り替えます。\n「通常」は毎ターン攻撃、「ミス時のみ」は不正解の時だけ敵が攻撃します。'
    );
    this.setupEnemyAttackModeEvents();

    return group;
  },

  setupEnemyAttackModeEvents() {
    setTimeout(() => {
      const saved = localStorage.getItem('enemyAttackMode') || 'onMistakeOnly';
      const always = document.getElementById('enemyAttack_always');
      const mistakeOnly = document.getElementById('enemyAttack_onMistakeOnly');
      if (always && mistakeOnly) {
        if (saved === 'onMistakeOnly') mistakeOnly.checked = true;
        else always.checked = true;

        always.addEventListener('change', () => {
          if (always.checked) this._saveEnemyAttackMode('always');
        });
        mistakeOnly.addEventListener('change', () => {
          if (mistakeOnly.checked) this._saveEnemyAttackMode('onMistakeOnly');
        });
      }
    }, 100);
  },

  _saveEnemyAttackMode(mode) {
    try { localStorage.setItem('enemyAttackMode', mode); } catch {}
    publish('playSE', 'decide');
    console.log('敵の行動タイミング設定:', mode);
  },

    /** セーブとバックアップ パネル */
    createSavePanel() {
      const panel = document.createElement('div');
      panel.className = 'settings-panel';
  
      const title = document.createElement('h3');
      title.className = 'panel-title';
      title.textContent = 'セーブとバックアップ';
      panel.appendChild(title);
  
      // ステータス行（最終保存・オートセーブ状態）
      const status = document.createElement('div');
      status.className = 'setting-group';
      const lastSaved = document.createElement('div');
      lastSaved.id = 'lastSavedLabel';
      lastSaved.className = 'save-status';
      lastSaved.textContent = '最終保存: 取得中…';
      const autosaveStatus = document.createElement('div');
      autosaveStatus.id = 'autosaveStatusLabel';
      autosaveStatus.className = 'save-status';
      autosaveStatus.textContent = 'オートセーブ: 取得中…';
      status.appendChild(lastSaved);
      status.appendChild(autosaveStatus);
      panel.appendChild(status);
  
      // 子ども向けヘルプ
      const help = document.createElement('div');
      help.className = 'save-help';
      help.textContent = '💡 「かんたんセーブ」をおすだけでOK！このゲームのつづきを守るよ。';
      panel.appendChild(help);
  
      // かんたんセーブ（主ボタン）
      const mainRow = document.createElement('div');
      mainRow.className = 'settings-button-row compact';
      const btnSaveNow = document.createElement('button');
      btnSaveNow.className = 'settings-button primary big';
      btnSaveNow.textContent = '💾 かんたんセーブ';
      btnSaveNow.addEventListener('click', async () => {
        publish('playSE', 'decide');
        try {
          saveGameData();
          await new Promise(r => setTimeout(r, 150));
          this._showSaveToast('保存しました');
          this._refreshSaveStatus();
        } catch {
          this._showSaveToast('保存に失敗しました');
        }
      });
      mainRow.appendChild(btnSaveNow);
      panel.appendChild(mainRow);
  
      // くわしいメニュー（折りたたみ）
      const advToggle = document.createElement('button');
      advToggle.className = 'settings-button ghost sm';
      advToggle.textContent = 'くわしいメニューをひらく';
      panel.appendChild(advToggle);
  
      const advanced = document.createElement('div');
      advanced.className = 'settings-advanced';
      advanced.hidden = true;
  
      const advNote = document.createElement('div');
      advNote.className = 'subnote';
      advNote.textContent = 'おうちの人といっしょに使ってね。バックアップをつくったり、よみこんだりできます。';
      advanced.appendChild(advNote);
  
      const btnRow1 = document.createElement('div');
      btnRow1.className = 'settings-button-row compact';
  
      const btnExport = document.createElement('button');
      btnExport.className = 'settings-button sm';
      btnExport.textContent = '⬇️ バックアップをつくる (.json)';
      btnExport.addEventListener('click', async () => {
        publish('playSE', 'decide');
        try {
          const mod = await import('../core/saveData.js');
          const data = mod.loadSave();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          a.download = `kanji-save-${ts}.json`;
          document.body.appendChild(a); a.click(); a.remove();
        } catch (e) {
          alert('書き出しに失敗しました');
        }
      });
  
      const btnImport = document.createElement('button');
      btnImport.className = 'settings-button sm';
      btnImport.textContent = '⬆️ バックアップをよみこむ';
      const file = document.createElement('input');
      file.type = 'file'; file.accept = 'application/json'; file.style.display = 'none';
      btnImport.addEventListener('click', () => { publish('playSE','decide'); file.click(); });
      file.addEventListener('change', async (e) => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        try {
          const text = await f.text();
          const data = JSON.parse(text);
          const mod = await import('../core/saveData.js');
          mod.saveNow(data);
          loadGameData();
          this._showSaveToast('バックアップを読み込みました');
          this._refreshSaveStatus();
        } catch (err) {
          console.error(err);
          alert('読み込みに失敗しました。ファイル形式を確認してください。');
        } finally {
          e.target.value = '';
        }
      });
  
      btnRow1.appendChild(btnExport);
      btnRow1.appendChild(btnImport);
      advanced.appendChild(btnRow1);
      panel.appendChild(advanced);
  
      advToggle.addEventListener('click', () => {
        publish('playSE','decide');
        advanced.hidden = !advanced.hidden;
        advToggle.textContent = advanced.hidden ? 'くわしいメニューをひらく' : 'とじる';
      });
  
      // オートセーブ設定（文言をやさしく）
      const autoGroup = document.createElement('div');
      autoGroup.className = 'setting-group';
  
      const autoLabel = document.createElement('div');
      autoLabel.className = 'setting-label';
      autoLabel.textContent = 'オートセーブ（じどう）';
  
      const autoRow = document.createElement('div');
      autoRow.className = 'inline-controls';
      const autoToggle = document.createElement('input');
      autoToggle.type = 'checkbox';
      const autoInterval = document.createElement('select');
      [1,5,10,15].forEach(m => {
        const opt = document.createElement('option');
        opt.value = String(m); opt.textContent = `${m}分`;
        autoInterval.appendChild(opt);
      });
  
      const inlineStatus = document.createElement('span');
      inlineStatus.id = 'autosaveInline';
      inlineStatus.style.marginLeft = '8px';
      autoRow.appendChild(inlineStatus);
  
      try {
        const enabled = (localStorage.getItem('autosaveEnabled') ?? '1') === '1';
        const minutes = parseInt(localStorage.getItem('autosaveMinutes') || '5', 10);
        autoToggle.checked = enabled;
        autoInterval.value = String(Number.isFinite(minutes) ? minutes : 5);
        inlineStatus.textContent = `（いまは: ${enabled ? `${minutes}分ごと` : 'OFF'}）`;
      } catch {}
  
      const applyBtn = document.createElement('button');
      applyBtn.className = 'settings-button';
      applyBtn.textContent = '適用';
      applyBtn.addEventListener('click', () => {
        publish('playSE','decide');
        const enabledNow = !!autoToggle.checked;
        const minutesNow = parseInt(autoInterval.value || '5', 10);
        try {
          publish('updateAutosaveSettings', { enabled: enabledNow, minutes: minutesNow });
          this._showSaveToast('オートセーブ設定を更新しました');
          this._refreshSaveStatus();
          inlineStatus.textContent = `（いまは: ${enabledNow ? `${minutesNow}分ごと` : 'OFF'}）`;
        } catch {}
      });
  
      autoRow.appendChild(autoToggle);
      autoRow.appendChild(autoInterval);
      autoRow.appendChild(applyBtn);
      autoGroup.appendChild(autoLabel);
      autoGroup.appendChild(autoRow);
      panel.appendChild(autoGroup);
  
      // 表示更新とfile input追加
      this._refreshSaveStatus();
      panel.appendChild(file);
  
      return panel;
    },

  _showSaveToast(message) {
    const toast = document.createElement('div');
    Object.assign(toast.style, {
      position: 'fixed', right: '16px', bottom: '16px', zIndex: 100001,
      background: 'rgba(0,0,0,0.85)', color: '#fff', padding: '10px 14px', borderRadius: '8px',
      border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
    });
    toast.textContent = message || '保存しました';
    document.body.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 1200);
  },

  _refreshSaveStatus() {
    const last = document.getElementById('lastSavedLabel');
    const auto = document.getElementById('autosaveStatusLabel');
    // 最終保存
    (async () => {
      try {
        const mod = await import('../core/saveData.js');
        const s = mod.loadSave();
        const t = s?.meta?.lastSavedAt ? new Date(s.meta.lastSavedAt) : null;
        last && (last.textContent = `最終保存: ${t ? t.toLocaleString() : '不明'}`);
      } catch { last && (last.textContent = '最終保存: 不明'); }
    })();
    // オートセーブ
    try {
      const enabled = (localStorage.getItem('autosaveEnabled') ?? '1') === '1';
      const minutes = parseInt(localStorage.getItem('autosaveMinutes') || '5', 10);
      auto && (auto.textContent = `オートセーブ: ${enabled ? `${minutes}分ごと` : 'OFF'}`);
    } catch { auto && (auto.textContent = 'オートセーブ: 不明'); }
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

  /** 回復仕様設定のイベントリスナーを設定 */
  setupHealModeEvents() {
    setTimeout(() => {
      // 初期値をローカルストレージから取得
      const savedHealMode = localStorage.getItem('healMode') || 'noAttack';
      
      // ラジオボタンを設定
      const noAttackRadio = document.getElementById('noAttackMode');
      const withAttackRadio = document.getElementById('withAttackMode');
      
      if (noAttackRadio && withAttackRadio) {
        if (savedHealMode === 'noAttack') {
          noAttackRadio.checked = true;
        } else {
          withAttackRadio.checked = true;
        }
        
        // イベントリスナーを設定
        noAttackRadio.addEventListener('change', () => {
          if (noAttackRadio.checked) {
            this._saveHealModeAndUpdate('noAttack');
          }
        });
        
        withAttackRadio.addEventListener('change', () => {
          if (withAttackRadio.checked) {
            this._saveHealModeAndUpdate('withAttack');
          }
        });
      }
    }, 100);
  },

  /** 回復仕様を保存し、説明文を更新 */
  _saveHealModeAndUpdate(mode) {
    // ローカルストレージに保存
    localStorage.setItem('healMode', mode);
    
    // フィードバックSE再生
    publish('playSE', 'decide');
    
    console.log('回復仕様設定完了:', mode);
    
    // 設定変更の視覚的フィードバック
    const modeDescription = document.getElementById('modeDescription');
    if (modeDescription) {
      modeDescription.style.color = '#2ecc71';
      modeDescription.style.fontWeight = 'bold';
      setTimeout(() => {
        modeDescription.style.color = '';
        modeDescription.style.fontWeight = '';
      }, 1000);
    }
  },

  /** 回復回数設定のイベントリスナーを設定 */
  setupHealCountEvents(healSlider, healValue) {
    // 初期値をローカルストレージから取得
    const savedHealCount = localStorage.getItem('maxHealCount');
    const initialHealCount = savedHealCount ? parseInt(savedHealCount, 10) : 3;
    
    // スライダーと表示を初期値に設定
    healSlider.value = initialHealCount;
    healValue.textContent = initialHealCount + '回';
    
    // リアルタイム更新
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

    // 手動セーブ
    const manualSaveBtn = null;

    // セーブ読込
    const manualLoadBtn = null;

        // セーブ初期化（軽） — 非表示で残す（開発者向け）
        const clearSaveBtn = document.createElement('button');
        clearSaveBtn.className = 'settings-button danger';
        clearSaveBtn.textContent = 'セーブをなおす（こしょう時）';
        clearSaveBtn.title = 'セーブ保存箱だけ作り直します。進み具合は基本的に残ります（復旧用）。';
        clearSaveBtn.addEventListener('click', () => {
          publish('playSE', 'decide');
          if (confirm('セーブ保存箱を作り直します。通常は不要です。続行しますか？')) {
            try { clearSaveData(); alert('セーブの保存箱を作り直しました。'); } catch {}
          }
        });

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

        // 追加ボタンを先頭に配置
        if (manualSaveBtn) {
          buttonSection.appendChild(manualSaveBtn);
        }
        if (manualLoadBtn) {
          buttonSection.appendChild(manualLoadBtn);
        }
    
        // ▼ 可視化条件: 開発者のみ（localStorage/devフラグ or URLにdev=1/hash）
        try {
          const dev =
            localStorage.getItem('devTools') === '1' ||
            ((typeof location !== 'undefined') &&
              ((location.search && location.search.includes('dev=1')) ||
               (location.hash && location.hash.includes('dev'))));
          if (dev) buttonSection.appendChild(clearSaveBtn);
        } catch {}
    
        buttonSection.appendChild(resetButtonContainer);
        buttonSection.appendChild(backButton);
    
        // 隠し操作: 設定ボタン領域で Alt+ダブルクリック → 一時的に表示
        buttonSection.addEventListener('dblclick', (e) => {
          if (e.altKey && !clearSaveBtn.parentNode) {
            try { localStorage.setItem('devTools', '1'); } catch {}
            buttonSection.insertBefore(clearSaveBtn, resetButtonContainer);
            this._showSaveToast('開発者メニューを表示しました');
          }
        });
    
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
      // モバイルの二重発火ガード
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (e.type === 'touchstart') {
        this._lastTouchTime = now;
        if (e.cancelable) e.preventDefault();
      } else if (e.type === 'click') {
        if (this._lastTouchTime && (now - this._lastTouchTime) < 700) return;
      }
      e.preventDefault(); // ダブルタップによる画面拡大などを防ぐ
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