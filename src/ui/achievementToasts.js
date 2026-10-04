// src/ui/achievementToasts.js
// 「じっせき ゲット！」のお知らせ。canvas の下寄り（y450〜530）の真ん中に、1つずつ 順番に出す。
//
// 以前（main.js）は 来た分を ぜんぶ 同時に 上へ 積み重ねて描いていた。2つ以上 同時に 来ると
// 2つめが ステージクリアの画面の ボタンに かぶり、さらに「新しい実績を N件 解除」の まとめも
// 足されて 3まい 重なっていた。消す処理も 時刻の ぴったり一致を 探していて あてにならなかった。
//
// - いつも 1まいだけ。3秒 出したら つぎ
// - 3つ以上 たまったら、2つめ以降を「ほかにも N こ」の 1まいに まとめる
// - 音は そのまいを 出す時に 鳴らす（重ならない）

export const SHOW_MS = 3000;
export const POPUP = { width: 400, height: 80, bottomGap: 150 }; // canvas の下から 150（800×600 で y450）

/**
 * @param {{ now?: () => number, onShow?: (toast) => void }} [options]
 */
export function createAchievementToasts({ now = () => Date.now(), onShow = () => {} } = {}) {
  const waiting = [];
  let showing = null;   // { title, description, shownAt }

  function collapseIfMany() {
    // 3つ以上 待っていたら（＝出しているのと あわせて 4つ以上）、2つめ以降を 1まいに まとめる
    if (waiting.length < 3) return;
    const first = waiting.shift();
    const rest = waiting.splice(0);
    const count = rest.reduce((n, item) => n + (item.count || 1), 0);
    waiting.push(first, { title: `ほかにも ${count}こ ゲット！`, description: 'プロフィールの トロフィーで みられるよ', count });
  }

  function advance() {
    const t = now();
    if (showing && t - showing.shownAt < SHOW_MS) return showing;
    showing = null;
    if (waiting.length) {
      showing = { ...waiting.shift(), shownAt: t };
      onShow(showing);
    }
    return showing;
  }

  return {
    push(achievement) {
      if (!achievement) return;
      waiting.push({ title: achievement.title || '', description: achievement.description || '' });
      collapseIfMany();
      advance();
    },
    /** いま出す 1まい（なければ null）。毎フレーム呼ぶ */
    current: advance,
    /** 出しているのと 待っているのを あわせた数（テスト用） */
    size: () => (showing ? 1 : 0) + waiting.length,
  };
}

/** 1まいを canvas に描く */
export function drawAchievementToast(ctx, canvas, toast, time = Date.now()) {
  if (!toast) return;
  const { width: popupWidth, height: popupHeight, bottomGap } = POPUP;
  const popupX = (canvas.width - popupWidth) / 2;
  const y = canvas.height - bottomGap;

  ctx.save();
  // 外側の影
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;
  const gradient = ctx.createLinearGradient(popupX, y, popupX, y + popupHeight);
  gradient.addColorStop(0, '#FFD700');
  gradient.addColorStop(1, '#FFA500');
  ctx.fillStyle = gradient;
  ctx.fillRect(popupX, y, popupWidth, popupHeight);
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#B8860B';
  ctx.lineWidth = 3;
  ctx.strokeRect(popupX, y, popupWidth, popupHeight);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(popupX + 10, y + 10, 60, popupHeight - 20);

  ctx.fillStyle = '#000';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 24px "UDデジタル教科書体", sans-serif';
  ctx.fillText('🏆', popupX + 25, y + popupHeight / 2 - 10);
  // 「実績解除」は 読めない子が多いので ひらがなで
  ctx.font = 'bold 18px "UDデジタル教科書体", sans-serif';
  ctx.fillText('じっせき ゲット！', popupX + 80, y + 25);
  ctx.font = '16px "UDデジタル教科書体", sans-serif';
  ctx.fillStyle = '#333';
  let title = toast.title || '';
  if (title.length > 20) title = title.substring(0, 20) + '...';
  ctx.fillText(title, popupX + 80, y + 44);
  ctx.font = '14px "UDデジタル教科書体", sans-serif';
  ctx.fillStyle = '#222';
  let desc = toast.description || '';
  if (desc.length > 28) desc = desc.substring(0, 28) + '...';
  ctx.fillText(desc, popupX + 80, y + 64);

  // キラキラ
  const sparkles = ['✨', '⭐', '💫'];
  for (let i = 0; i < 3; i++) {
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#FFF';
    ctx.fillText(sparkles[i], popupX + popupWidth - 60 + i * 20, y + 20 + Math.sin(time / 500 + i) * 10);
  }
  ctx.restore();
}
