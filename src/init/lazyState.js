// src/init/lazyState.js
// 画面（FSM の状態）を、はじめて入る時に 読み込む。
//
// ミニゲーム41本の コードは 約1.6MB あり、本編や タイトルだけ 遊ぶ時にも 最初に ぜんぶ 読み込んでいた。
// ミニゲームの 土台（miniGameHost）と 広場（miniGameHubScreen）を この包みで 登録すると、
// Vite が それぞれ 別の ファイルに 分け、広場を 開いた時に 初めて 読み込む（2026-10-04）。
//
// FSM が 呼ぶのは enter / exit / update だけ（core/fsm.js）。読み込み中に 別の画面へ 移ったら、
// 読み込みが 終わっても enter しない（入場の 世代で 見分ける）。exit は enter した時だけ。
export function lazyState(load) {
  let real = null, pending = null, generation = 0, entered = false;
  const get = () => (pending ||= load().then(module => (real = module.default ?? module)));
  const enterNow = (screen, args) => { entered = true; return screen.enter?.(...args); };
  return {
    enter(...args) {
      const entry = ++generation;
      if (real) return enterNow(real, args);
      return get().then(screen => { if (entry === generation) enterNow(screen, args); },
        error => console.error('画面の読み込みに失敗しました:', error));
    },
    exit(...args) {
      generation++;
      if (!entered) return;
      entered = false;
      return real.exit?.(...args);
    },
    update(dt) {
      if (entered) return real.update?.(dt);
    },
    /** 先に 読み込んでおく */
    preload() { return get(); },
    /** テスト・診断用 */
    get loaded() { return !!real; },
  };
}
