// tutorialData.js
// 画面ごとのガイド手順を定義。座標は canvas 左上起点のpx。
// 必要に応じて ctx からボタンや入力欄の矩形を算出して返す。

export function getStepsFor(screenId, ctx = {}) {
    switch (screenId) {
      case 'title':
        return [
          {
            title: 'ゲームをはじめよう',
            text: 'スタートボタンをおそう！\nなまえを入れたら ぼうけんへ。',
            anchor: () => buttonRect(ctx?.playButton || { x: 300, y: 350, width: 300, height: 50 })
          }
        ];
  
      case 'regionSelect':
        return [
          {
            title: 'ちいきをえらぼう',
            text: 'マーカーをおすと そのちいきへ。\nはじめは「北海道」から！',
            anchor: () => approxRect(ctx?.mapRect, 0.82, 0.175, 50, 50) // 北海道マーカー近辺
          }
        ];
  
      case 'stageSelect':
        return [
          {
            title: '学年タブ',
            text: 'じぶんの学年をタップ/クリック！\n四国・九州は「ちからだめし」だよ。',
            anchor: () => ({ x: 0, y: 0, w: ctx.canvas?.width || 800, h: 60 })
          },
          {
            title: 'ステージをえらぶ',
            text: '左のリストから えらんでね。\nマップのマーカーをおしてもOK！',
            anchor: () => ({ x: 20, y: 120, w: (ctx.canvas?.width || 800) / 2 - 40, h: (ctx.canvas?.height || 600) - 180 })
          },
          {
            title: 'マスターにちょうせん！',
            text: '「マスター」ボタンで れんしゅうもできるよ。',
            anchor: () => buttonRect({ x: 800/2 - 70, y: 540, width: 140, height: 40 })
          }
        ];
  
      case 'battle':
        return [
          {
            title: 'もんだい',
            text: 'かんじの よみを いれよう。\nかなで入力 → Enterキー！',
            anchor: () => bottomCenter(ctx.canvas, 320, 80) // 入力域の下辺を目安に
          },
          {
            title: 'ヒント',
            text: 'わからないときは ヒントをつかってOK！',
            anchor: () => topRight(ctx.canvas, 180, 80)
          },
          {
            title: 'HPとこうげき',
            text: 'こたえると こうげき！ まちがえると ダメージ！\nがんばって ぜんいん たおそう！',
            anchor: () => topLeft(ctx.canvas, 260, 120)
          }
        ];
  
      case 'resultWin':
        return [
          {
            title: 'けっか',
            text: 'できた！ つぎのステージへ すすもう。\n「ヨミトモ」も つかまえられるよ。',
            anchor: () => centerBox(ctx.canvas, 420, 160)
          }
        ];
  
      default:
        return [];
    }
  }
  
  // 位置ユーティリティ
  function buttonRect(btn) { return { x: btn.x, y: btn.y, w: btn.width, h: btn.height }; }
  function centerBox(canvas, w, h) {
    const cw = canvas?.width || 800, ch = canvas?.height || 600;
    return { x: (cw - w) / 2, y: (ch - h) / 2, w, h };
  }
  function topLeft(canvas, w, h)  { return { x: 20, y: 20, w, h }; }
  function topRight(canvas, w, h) { const cw = canvas?.width || 800; return { x: cw - w - 20, y: 20, w, h }; }
  function bottomCenter(canvas, w, h) {
    const cw = canvas?.width || 800, ch = canvas?.height || 600;
    return { x: (cw - w) / 2, y: ch - h - 20, w, h };
  }
  // regionSelect 用（地図比率→px）
  function approxRect(mapRect, px, py, w, h) {
    if (!mapRect) return { x: 560, y: 120, w, h };
    const x = mapRect.x + mapRect.width * px - w / 2;
    const y = mapRect.y + mapRect.height * py - h / 2;
    return { x, y, w, h };
  }
  export default getStepsFor;