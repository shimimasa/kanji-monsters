import { gameState } from '../core/gameState.js';
import { drawButton, isMouseOverRect, drawThemeBackground, drawPanelBackground } from '../ui/uiRenderer.js';
import { getCurrentUser } from '../services/firebase/firebaseController.js';
import { publish } from '../core/eventBus.js';

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

    // バトル設定パネル
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
  
    /** 表示・アクセシビリティ設定パネルを作成 */
    createDisplayPanel() {
      const panel = document.createElement('div');
      panel.className = 'settings-panel';
      
      const title = document.createElement('h3');
      title.className = 'panel-title';
      title.textContent = '表示・アクセシビリティ';
      panel.appendChild(title);
      
      // 色弱フレンドリーモード
      const cbGroup = this._createAccessibilityToggleWithTooltip(
        'cbMode',
        '色弱フレンドリーモード',
        '赤と緑の区別がつきやすい配色に変更します。色覚に配慮したカラーパレットを使用し、より快適にゲームをお楽しみいただけます。'
      );
      panel.appendChild(cbGroup);
      
      // 大きな文字モード
      const fontGroup = this._createAccessibilityToggleWithTooltip(
        'bigFont',
        '文字サイズ +20%',
        'ゲーム内の全ての文字を20%大きく表示します。小さな文字が見づらい場合や、より読みやすい表示をお求めの方におすすめです。'
      );
      panel.appendChild(fontGroup);
      
      // アクセシビリティ設定のイベントリスナーを設定
      this.setupAccessibilityEvents();
      
      return panel;
    },
  
    /** ツールチップ付きアクセシビリティトグルを作成 */
    _createAccessibilityToggleWithTooltip(toggleId, labelText, tooltipText) {
      const group = document.createElement('div');
      group.className = 'setting-group';
      
      const toggle = document.createElement('label');
      toggle.className = 'toggle-switch';
      
      // ツールチップ付きのラベル構造を作成
      const labelContainer = document.createElement('div');
      labelContainer.className = 'toggle-label-container';
      
      const labelSpan = document.createElement('span');
      labelSpan.className = 'toggle-label';
      labelSpan.textContent = labelText;
      
      const tooltipTrigger = document.createElement('span');
      tooltipTrigger.className = 'tooltip-trigger';
      tooltipTrigger.textContent = '？';
      tooltipTrigger.setAttribute('data-tooltip', tooltipText);
      
      labelContainer.appendChild(labelSpan);
      labelContainer.appendChild(tooltipTrigger);
      
      toggle.innerHTML = `
        <input type="checkbox" id="${toggleId}">
        <span class="slider"></span>
      `;
      toggle.appendChild(labelContainer);
      
      // ツールチップイベントを設定
      this._setupTooltipEvents(tooltipTrigger, tooltipText);
      
      group.appendChild(toggle);
      return group;
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
  
    /** バトル設定パネルを作成 */
    createBattlePanel() {
      const panel = document.createElement('div');
      panel.className = 'settings-panel';
      
      const title = document.createElement('h3');
      title.className = 'panel-title';
      title.textContent = 'バトル設定';
      panel.appendChild(title);
      
      // 回復回数設定
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
  
    /** アクセシビリティ設定のイベントリスナーを設定 */
    setupAccessibilityEvents() {
      const saveAccessibility = () => {
        const cbMode = document.getElementById('cbMode');
        const bigFont = document.getElementById('bigFont');
        
        if (cbMode) {
          localStorage.setItem('cbMode', cbMode.checked ? '1' : '0');
        }
        if (bigFont) {
          localStorage.setItem('bigFont', bigFont.checked ? '1' : '0');
        }
        this.applyAccessibility();
        
        // アクセシビリティ設定変更時のフィードバック
        publish('playSE', 'decide');
      };
  
      // 少し遅延してから初期値を設定
      setTimeout(() => {
        const cbModeCheckbox = document.getElementById('cbMode');
        const bigFontCheckbox = document.getElementById('bigFont');
        
        if (cbModeCheckbox) {
          cbModeCheckbox.checked = localStorage.getItem('cbMode') === '1';
          cbModeCheckbox.addEventListener('change', saveAccessibility);
        }
        
        if (bigFontCheckbox) {
          bigFontCheckbox.checked = localStorage.getItem('bigFont') === '1';
          bigFontCheckbox.addEventListener('change', saveAccessibility);
        }
        
        this.applyAccessibility();
      }, 100);
    },
  
    /** アクセシビリティ設定を適用 */
    applyAccessibility() {
      document.body.classList.toggle('cb-mode', localStorage.getItem('cbMode') === '1');
      document.body.classList.toggle('big-font', localStorage.getItem('bigFont') === '1');
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
  
  export default settingsScreenState;// js/settingsScreen.js