// src/fsm.js
// ESモジュールスタイルのシンプル状態マシン（FSM）クラス

export class FSM {
  /**
   * @param {string} initialState - 最初に遷移する状態の名前
   * @param {Object<string, { enter?: Function, update?: Function, exit?: Function }>} states
   */
  constructor(initialState, states) {
    this.states = states;
    this.currentState = null;
    // P0-1(互換維持): core/stateMachine.js と同様に初期状態へ自動遷移する
    this.change(initialState);
  }

  /**
   * 状態を切り替える
   * @param {string} stateName - 遷移先状態名
   * @param  {...any} args    - enter() に渡す引数
   */
  change(stateName, ...args) {
    // P0-1(互換維持): core/stateMachine.js と同等の遷移ログを残す（1操作1ログの期待を維持）
    console.log(
      `FSM: 状態遷移 ${this.currentState ? Object.keys(this.states).find(key => this.states[key] === this.currentState) : 'null'} → ${stateName}`,
      args.length <= 1 ? args[0] : args
    );

    const next = this.states[stateName];
    if (!next) {
      throw new Error(`FSM: 状態 "${stateName}" が見つかりません`);
    }

    // P0-1(互換維持): 画面遷移のたびに、HTMLで追加されたUI要素をクリアする（kanjiInputは保護）
    const uiOverlay = document.getElementById('uiOverlay');
    if (uiOverlay) {
      // 子要素を配列に変換してループ処理（NodeListは動的に変化するため）
      const children = Array.from(uiOverlay.children);
      children.forEach(child => {
        // IDが'kanjiInput'ではない要素のみを削除
        if (child.id !== 'kanjiInput') {
          uiOverlay.removeChild(child);
        }
      });
    }

    // 旧状態の exit()
    if (this.currentState && typeof this.currentState.exit === 'function') {
      this.currentState.exit();
    }
    // 新状態へ
    this.currentState = next;
    if (typeof this.currentState.enter === 'function') {
      this.currentState.enter(...args);
    }
  }

  /**
   * 現在の状態を更新する
   * @param {number} dt - 経過時間など任意のパラメータ
   */
  update(dt) {
    if (this.currentState?.update) {
      this.currentState.update(dt);
    }
  }
}
