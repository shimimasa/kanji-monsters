import { publish } from '../core/eventBus.js';
import { isMouseOverRect } from '../ui/uiRenderer.js';
import { gameState, updatePlayerName, clearSaveData, isSaveSessionReady, saveGameData } from '../core/gameState.js';
import { getCurrentUser } from '../services/firebase/firebaseController.js';
import { getGameCoordinates, isValidCoordinates } from '../utils/coordinateUtils.js';
import { hardResetAllLocalData } from '../core/saveData.js';
import { stageData } from '../loaders/dataLoader.js';
import { listSlots, switchToSlot } from '../core/saveSlots.js';
import { createScreenLifecycle } from '../core/screenLifecycle.js';
import { createAdventureTitle } from './adventureTitle.js';
const titleState = {
  _lifecycle: createScreenLifecycle(),
  /** 画面表示時の初期化 */
  enter(canvas) {
    this._lifecycle.activate();
    // BGM再生
    // publish('playBGM', 'title');
    
    // canvas が未渡しの場合は DOM から取得
    this.canvas = canvas || document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');
    const cx    = this.canvas.width / 2;
    
    // プレイヤー名の有無でUIを変更
    const isReturnPlayer = gameState.playerName && gameState.playerName.trim() !== '';
    
    if (isReturnPlayer) {
      // リピートプレイヤー用のボタン配置（モード統一）
      this.playButton = { x: cx - 150, y: 350, width: 300, height: 50, text: 'つづきから' };

      // 前回あそんだステージの地図へ1タップで戻るクイック再開（特定できる場合のみ表示）
      const resumableStageId = this._getResumableStageId();
      this.continueButton = resumableStageId
        ? { x: cx - 150, y: 408, width: 300, height: 40, text: 'まえの場所から すぐ再開', stageId: resumableStageId }
        : null;

      // 共用の端末では、まず「だれが あそぶ？」を選べることが要る。
      // 設定の奥に置くと押されず、前の子の記録の上に書かれてしまうので、
      // せってい と並べてここに出す。
      this.slotButton = { x: cx - 170, y: 460, width: 160, height: 50, text: 'だれが あそぶ？' };
      this.settingsButton = { x: cx + 10, y: 460, width: 160, height: 50, text: 'せってい' };

      // リセットボタンは誤タップ防止のため、小さく、離れた位置に配置
      this.resetButton = {
        x: cx - 90,
        y: 522,
        width: 180,
        height: 35,
        text: 'はじめから'
      };
    } else {
      // 新規プレイヤー用のボタン配置（モード統一）
      this.playButton = { x: cx - 150, y: 380, width: 300, height: 50, text: 'スタート' };
      this.continueButton = null;
      this.resetButton = null; // リセットボタンは表示しない
      // 空きスロットに入った子も、まちがえたら元の場所に戻れる必要がある。
      // ここに出しておかないと、名前を入れるまで戻る手段が無くなる。
      this.slotButton = { x: cx - 170, y: 450, width: 160, height: 50, text: 'だれが あそぶ？' };
      this.settingsButton = { x: cx + 10, y: 450, width: 160, height: 50, text: 'せってい' };
    }
    
    this.registerHandlers();
    this._injectMiniGameButton();
    // チュートリアル（初回のみ）
    import('../tutorial/TutorialManager.js').then(this._lifecycle.guard(m => m.default.startIfNeeded('title', { canvas: this.canvas, playButton: this.playButton })));
    // 非表示設定なら既存ボタンを確実に除去
    try {
      const showSave = localStorage.getItem('showSaveButton') === '1';
      const old = document.getElementById('titleSaveButton');
      if (!showSave && old) old.remove();
      if (showSave) this._injectSaveButton();
    } catch {}
  },


  // The title is responsive DOM; no hidden canvas drawing loop is needed.
  update() {},

  /** 画面離脱時のクリーンアップ */
  exit() {
    this._adventureTitle?.dispose();
    this._adventureTitle = null;
    this._miniGameButton?.remove();
    this._miniGameButton = null;
    this._lifecycle.deactivate();
    this.unregisterHandlers();
    const old = document.getElementById('titleSaveButton');
    if (old) old.remove();
    const picker = document.getElementById('slotPicker');
    if (picker) picker.remove();
    this.canvas = null;
    this.ctx    = null;
  },

  /** クリックイベント登録 */
  registerHandlers() {
    this._clickHandler = this.handleClick.bind(this);
    this.canvas.addEventListener('click', this._clickHandler);
    this.canvas.addEventListener('touchstart', this._clickHandler, { passive: false });
  },

  /** クリックイベント解除 */
  unregisterHandlers() {
    this.canvas.removeEventListener('click', this._clickHandler);
    this.canvas.removeEventListener('touchstart', this._clickHandler);
  },

  _injectMiniGameButton() {
    this._adventureTitle = createAdventureTitle({
      playerName: gameState.playerName,
      onStart: this._lifecycle.guard(() => this._startGame()),
      onHub: this._lifecycle.guard(() => publish('changeScreen', 'miniGameHub')),
      onSettings: () => publish('changeScreen', 'settings'),
      onDex: () => { gameState.previousScreen = 'title'; publish('changeScreen', 'monsterDex'); },
      onSlots: () => this._openSlotPicker(),
      onResume: this.continueButton ? this._lifecycle.guard(() => this._quickResume()) : null,
      resumeLabel: this._resumeLabel(),
      onReset: this.resetButton ? () => this._resetGameData() : null,
    });
  },

  _injectSaveButton() {
    // 既存があれば削除
    const id = 'titleSaveButton';
    const old = document.getElementById(id);
    if (old) old.remove();
    const btn = document.createElement('button');
    btn.id = id;
    Object.assign(btn.style, {
      position: 'fixed', right: '16px', top: '16px', zIndex: 100000,
      background: 'linear-gradient(135deg, #28a745, #20c997)', color: '#fff',
      border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer'
    });
    btn.textContent = '💾 セーブ';
    btn.onclick = () => {
      try {
        const result = saveGameData();
        if (result.ok) {
          publish('playSE', 'decide');
          this._showSaveToast('セーブしました');
        } else {
          this._showSaveToast('セーブできませんでした。前の記録は残っています。');
        }
      } catch (e) {
        console.error(e);
      }
    };
    document.body.appendChild(btn);
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

  /** セーブの準備が整っていない時はタイトル内で案内する */
  _showSaveNotReady() {
    this._adventureTitle?.showSaveGuide('いまは 本編の つづきを ひらけません。おうちの人と ページを よみこみなおすか、下の「せってい」から バックアップを よみこんでね。もとの きろくは のこっているよ。');
  },

  /** プレイヤー名確認と画面遷移の共通処理 */
_startGame() {
  if (!isSaveSessionReady()) {
    this._showSaveNotReady();
    return;
  }
  // プレイヤー名未設定なら名前入力画面へ遷移
  if (!gameState.playerName) {
    publish('changeScreen', 'playerNameInput');
    return;
  }
  // 直接ステージセレクト（総復習モード）へ
  gameState.currentGrade = 0;
  publish('changeScreen', 'courseSelect');
},

  /** 前回あそんだステージのID（stageDataで実在確認できたもののみ） */
  _getResumableStageId() {
    if (!isSaveSessionReady()) return null;
    try {
      const id = localStorage.getItem('lastPlayedStage');
      if (!id) return null;
      const stage = Array.isArray(stageData) ? stageData.find(s => s.stageId === id) : null;
      return stage ? id : null;
    } catch {
      return null;
    }
  },

  /** 「本編のつづきから」の下に出す、前回の場所（例: 前回：北海道奥地） */
  _resumeLabel() {
    const id = this.continueButton?.stageId;
    const stage = id && Array.isArray(stageData) ? stageData.find(s => s.stageId === id) : null;
    return stage?.name ? `前回：${stage.name}` : '';
  },

  /** クイック再開: 前回ステージの地図（ステージ選択画面）へ直行する */
  _quickResume() {
    if (!isSaveSessionReady()) {
      this._showSaveNotReady();
      return;
    }
    const id = this.continueButton?.stageId;
    const stage = Array.isArray(stageData) ? stageData.find(s => s.stageId === id) : null;
    if (!stage) {
      this._startGame();
      return;
    }
    gameState.currentStageId = id;
    gameState.currentGrade = stage.grade;
    // 世界編（漢検級 = grade 7〜10）は世界ステージ選択へ、それ以外は日本のステージ選択へ
    const target = (stage.grade >= 7 && stage.grade <= 10) ? 'worldStageSelect' : 'stageSelect';
    gameState.previousScreen = target;
    publish('changeScreen', target);
  },

  /** データリセット処理 */
  async _resetGameData() {
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
      
            try {
              // 1. ゲームデータのクリア（完全削除）
              const reset = hardResetAllLocalData();
              if (!reset.ok) throw reset.error;
              
              // 2. Firebase関連データのクリア（必要に応じて）
              const user = getCurrentUser();
              if (user?.uid) {
                // Firebase側のデータも削除（具体的な実装はfirebaseControllerに依存）
                // await clearFirebaseUserData(user.uid);
              }
        
        console.log('データリセット処理が完了しました');
        
        // 成功メッセージ表示
        alert('全てのデータが正常にリセットされました。\nタイトル画面をリロードします。');
        
        // ページをリロードして完全にリセット
        window.location.reload();
        
      } catch (error) {
        console.error('データリセット処理中にエラーが発生しました:', error);
        alert('データのリセット中にエラーが発生しました。\n一部のデータが削除されていない可能性があります。');
      }
      
    } catch (error) {
      console.error('データリセット処理でエラーが発生しました:', error);
      alert('データのリセットに失敗しました。');
    }
  },

  handleClick(e) {
    // モバイルの二重発火ガード
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (e.type === 'touchstart') {
      this._lastTouchTime = now;
      if (e.cancelable) e.preventDefault();
    } else if (e.type === 'click') {
      if (this._lastTouchTime && (now - this._lastTouchTime) < 700) {
        return;
      }
    }
    // 統一された座標変換を使用
    const coords = getGameCoordinates(e, this.canvas);
    if (!isValidCoordinates(coords)) {
      return false; // 黒帯エリアのクリックは無視
    }
    const x = coords.x;
    const y = coords.y;
    
    // ▼ 以下は元のクリック判定ロジック（x, y を使うようにする）
    if (isMouseOverRect(x, y, this.playButton)) {
      publish('playSE', 'decide');
      this._startGame();
      return;
    }

    // クイック再開ボタン（前回の地図へ直行）
    if (this.continueButton && isMouseOverRect(x, y, this.continueButton)) {
      publish('playSE', 'decide');
      publish('playBGM', 'title');
      this._quickResume();
      return;
    }

    // はじめからボタン（リピートプレイヤーのみ）
    if (this.resetButton && isMouseOverRect(x, y, this.resetButton)) {
      publish('playSE', 'decide');
      this._resetGameData();
      return;
    }

    // だれが あそぶ？（セーブスロットの切り替え）
    if (this.slotButton && isMouseOverRect(x, y, this.slotButton)) {
      publish('playSE', 'decide');
      this._openSlotPicker();
      return;
    }

    // 設定ボタン
    if (isMouseOverRect(x, y, this.settingsButton)) {
      publish('playSE', 'decide');
      publish('changeScreen', 'settings');
    }
  },

  /**
   * 「だれが あそぶ？」のパネルを開く。
   *
   * 学校の共用端末で、2人目が1人目の記録の上に書いてしまうのを防ぐためのもの。
   * 選んだあとはページを読み込み直す。メモリ上に前の子の状態が残っていると、
   * 次に保存した時に混ざるため、ここは確実にやり直す。
   */
  _openSlotPicker() {
    if (document.getElementById('slotPicker')) return;

    const overlay = document.createElement('div');
    overlay.id = 'slotPicker';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483646',
      'background:rgba(0,0,0,0.72)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-family:"UDデジタル教科書体","Hiragino Sans",sans-serif'
    ].join(';');

    const panel = document.createElement('div');
    panel.style.cssText = [
      'background:#26324a', 'color:#fff', 'border-radius:14px',
      'padding:20px', 'width:min(90vw,420px)',
      'box-shadow:0 10px 30px rgba(0,0,0,0.5)'
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'だれが あそぶ？';
    title.style.cssText = 'font-size:22px;font-weight:bold;text-align:center;margin-bottom:6px;';
    panel.appendChild(title);

    const note = document.createElement('div');
    note.textContent = 'じぶんの ばしょを えらんでね';
    note.style.cssText = 'font-size:14px;text-align:center;opacity:0.8;margin-bottom:14px;';
    panel.appendChild(note);

    const slotGuide = document.createElement('div');
    slotGuide.setAttribute('role', 'status');
    slotGuide.style.cssText = 'font-size:16px;line-height:1.5;color:#ffe4a8;background:#3b4a63;border:1px solid #f1d494;border-radius:10px;padding:10px;margin-bottom:12px;';
    slotGuide.hidden = true;
    panel.appendChild(slotGuide);

    listSlots().forEach(slot => {
      const row = document.createElement('button');
      row.type = 'button';
      const label = slot.name
        ? `${slot.index}. ${slot.name}`
        : `${slot.index}. あいてる`;
      row.textContent = slot.isCurrent ? `${label}（いま ここ）` : label;
      row.style.cssText = [
        'display:block', 'width:100%', 'margin:0 0 8px',
        'padding:14px', 'font-size:18px', 'font-family:inherit',
        'border-radius:10px', 'border:1px solid rgba(255,255,255,0.25)',
        `background:${slot.isCurrent ? '#3d6f4f' : '#3b4a63'}`,
        'color:#fff', 'cursor:pointer'
      ].join(';');
      row.addEventListener('click', () => {
        publish('playSE', 'decide');
        if (slot.isCurrent) { overlay.remove(); return; }
        if (switchToSlot(slot.index)) {
          // 切り替えたら読み込み直す（前の子の状態を残さない）
          location.reload();
        } else {
          slotGuide.textContent = 'いまは この ばしょへ きりかえられません。おうちの人と いっしょに たしかめてね。いまの きろくは そのままだよ。';
          slotGuide.hidden = false;
          slotGuide.scrollIntoView?.({ block: 'nearest' });
        }
      });
      panel.appendChild(row);
    });

    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'とじる';
    close.style.cssText = [
      'display:block', 'width:100%', 'margin-top:6px', 'padding:12px',
      'font-size:16px', 'font-family:inherit', 'border-radius:10px',
      'border:1px solid rgba(255,255,255,0.25)', 'background:#4a5b78',
      'color:#fff', 'cursor:pointer'
    ].join(';');
    close.addEventListener('click', () => {
      publish('playSE', 'cancel');
      overlay.remove();
    });
    panel.appendChild(close);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  },

  render() {
    this.update(0);
  }
};

export default titleState;
