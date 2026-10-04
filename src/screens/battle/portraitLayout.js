// src/screens/battle/portraitLayout.js
// スマホを たてに 持った時の バトルの 配置（2026-10-04）。
//
// バトルは 800×600 で 描いていたので、幅390px の スマホでは 0.49倍に 縮み、敵の名前・HP・
// 「弱点は音読み！」などが 実寸6〜8px で 読めなかった。横幅が 足りないのが 原因なので、
// たて長の 画面では 盤面そのものを 480×680 に して、部品を たてに 並べなおす（約0.81倍 → 文字は 13px 前後）。
//
//   y  10〜 60  もどる・れんしゅうへ ／ 自分の HP（小さく）
//   y  88〜218  敵の 絵 ／ 敵の 名前と HP
//   y 246       弱点の 案内
//   y 266〜416  1つまえの漢字 ／ 出題の 漢字 ／ あいぼうの 絵
//   y ～538     会話ログ（入力欄の 上）
//   y ～605     入力欄 ＋「たんまつで書く」
//   y ～668     こうげき・かいふく・ヒント
//
// 切りかえるのは「幅600px以下で たて長」の時だけ。iPad や パソコンは これまでどおり 800×600。
export const PORTRAIT = Object.freeze({ W: 480, H: 680 });
export const LANDSCAPE = Object.freeze({ W: 800, H: 600 });

export const PORTRAIT_LAYOUT = Object.freeze({
  stage: { x: 10, y: 10, w: 130, h: 50 },
  practice: { x: 146, y: 10, w: 140, h: 50 },
  player: { x: 300, y: 6, scale: 0.62 },              // 260×130 の パネルを 縮めて 右上へ
  enemy: { ex: 20, ey: 98, ew: 220, eh: 110 },       // 枠は ex-10・ey-10 から ew+20 × eh+20
  enemyStatus: { x: 258, y: 88, w: 212, h: 100 },
  kanji: { centerX: 240, centerY: 348, width: 160, height: 140 },  // 弱点の 案内は 上に 20（「あと Nたい」と 重ならない）
  prev: { x: 10, y: 278, w: 130, h: 150 },
  companion: { x: 338, y: 282 },                      // 出題の 漢字の 右
  buttons: { left: 10, right: 470, gap: 5, bottomGap: 12 },
  input: { left: 10, width: 320 },                    // 右に「たんまつで書く」
});

/** スマホを たてに 持っているか（幅600px以下で、高さが 幅の1.25倍以上） */
export function wantsPortrait(win = globalThis.window) {
  if (!win || !Number.isFinite(win.innerWidth)) return false;
  return win.innerWidth <= 600 && win.innerHeight >= win.innerWidth * 1.25;
}

export function isPortraitCanvas(canvas) {
  return !!canvas && canvas.width === PORTRAIT.W && canvas.height === PORTRAIT.H;
}

function setSize(canvas, size, portrait) {
  canvas.width = size.W;
  canvas.height = size.H;
  try { canvas.classList?.toggle?.('yt-portrait', portrait); } catch {}
}

/** 画面の向きに あわせて 盤面の 大きさを 切りかえる。切りかえたら true（ctx の 状態は 初期化される） */
export function syncPortraitCanvas(canvas, win = globalThis.window) {
  if (!canvas) return false;
  const want = wantsPortrait(win), is = isPortraitCanvas(canvas);
  if (want === is) return false;
  setSize(canvas, want ? PORTRAIT : LANDSCAPE, want);
  return true;
}

/** バトルを 出る時: ほかの 画面は 800×600 で 描くので 戻す */
export function restoreLandscapeCanvas(canvas) {
  if (isPortraitCanvas(canvas)) setSize(canvas, LANDSCAPE, false);
}

/** こうげき・かいふく・ヒント（いちばん下）。h は 指で 押せる 高さ（getLearningControls と 同じ） */
export function portraitButtons(h) {
  const { left, right, gap, bottomGap } = PORTRAIT_LAYOUT.buttons;
  const w = Math.floor((right - left - gap * 2) / 3);
  const y = PORTRAIT.H - h - bottomGap;
  return {
    attack: { x: left, y, w, h },
    heal: { x: left + w + gap, y, w, h },
    hint: { x: left + (w + gap) * 2, y, w, h },
  };
}

/**
 * たての 盤面で、読みの 入力欄を「こたえる」の すぐ上・左寄せに 置く。右に「たんまつで書く」
 * （バトル・れんしゅうと 同じ 置き方。学年まとめ・復習で 使う）
 */
export function placePortraitInput(canvas, inputEl, submitY, doc = globalThis.document, win = globalThis.window) {
  if (!canvas || !inputEl) return;
  const s = inputEl.style, rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / canvas.width, rect.height / canvas.height);
  const left = rect.left + (rect.width - canvas.width * scale) / 2, top = rect.top + (rect.height - canvas.height * scale) / 2;
  const inputH = inputEl.offsetHeight || 48;
  s.removeProperty('width'); s.bottom = 'auto';
  s.width = `${Math.round(320 * scale)}px`;
  s.left = `${Math.round(left + 10 * scale)}px`;
  s.top = `${Math.round(top + (submitY - 8) * scale - inputH)}px`;
  inputEl.dataset.toggleSide = 'right';
  const toggle = doc?.getElementById?.('kanaPadToggle');
  if (toggle && !toggle.hidden) {
    const r = inputEl.getBoundingClientRect();
    toggle.style.left = `${Math.round(Math.min(r.right + 8, (win?.innerWidth ?? 9999) - (toggle.offsetWidth || 140) - 4))}px`;
    toggle.style.top = `${Math.round(r.top + (r.height - (toggle.offsetHeight || 40)) / 2)}px`;
  }
}
