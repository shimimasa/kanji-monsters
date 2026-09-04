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
            anchor: () => buttonRect(ctx?.playButton || { x: 300, y: 350, width: 300, height: 50 }, ctx.canvas)
          }
        ];
  
      case 'regionSelect':
        return [
          {
            title: 'ちいきをえらぼう',
            text: 'マーカーをおすと そのちいきへ。\nはじめは「北海道」から！',
            anchor: () => canvasApprox(ctx?.mapRect, 0.82, 0.175, 50, 50) // 北海道マーカー近辺
          }
        ];
  
      case 'stageSelect':
        return [
          {
            title: '学年タブ',
            text: 'じぶんの学年をタップ/クリック！\n四国・九州はほかのステージをクリアしたら遊べるよ。',
            anchor: () => canvasRect(ctx.canvas, 0, 0, (ctx.canvas?.width||800), 60)
          },
          {
            title: 'ステージをえらぶ',
            text: '左のリストから えらんでね。\nマップのマーカーをおしてもOK！',
            anchor: () => canvasRect(ctx.canvas, 20, 120, ((ctx.canvas?.width||800)/2 - 40), ((ctx.canvas?.height||600) - 180))
          },
          {
            title: 'マスターにちょうせん！',
            text: '「マスター」ボタンで漢字の読みをマスターしよう！マスターを押した後に、ステージに入ろう！',
            anchor: () => canvasRect(ctx.canvas, ( (ctx.canvas?.width||800)/2 - 70 ), 540, 140, 40)
          }
        ];
  
      case 'battle':
        return [
          {
            title: 'もんだい',
            text: 'かんじの よみを いれよう。\nかなで入力 → Enterキー！',
            anchor: () => canvasBottomCenter(ctx.canvas, 320, 80) // 入力域の下辺を目安に
          },
          {
            title: 'てきの弱点',
            text: 'てきには 弱点があるよ！\n「音読み」か「訓読み」…弱点のよみかたで こたえると 大ダメージ！',
            anchor: () => { const c = ctx.canvas || document.getElementById('gameCanvas'); const cw = c?.width || 800; return canvasRect(c, cw - 320, 10, 300, 150); } // 敵パネル＋弱点表示の近辺
          },
          {
            title: 'ヒント',
            text: 'わからないときは ヒントをつかってOK！\n4回おすと こたえも みられるよ。',
            anchor: () => canvasTopRight(ctx.canvas, 180, 80)
          },
          {
            title: 'HPとこうげき',
            text: 'こたえると こうげき！ まちがえると ダメージ！\nがんばって ぜんいん たおそう！',
            anchor: () => canvasTopLeft(ctx.canvas, 260, 120)
          },
          {
            title: 'こわくなったら',
            text: '「れんしゅうへ」をおすと、てきのいない\nれんしゅうモードで ゆっくり おぼえられるよ。',
            anchor: () => canvasRect(ctx.canvas, 20, 64, 120, 32) // れんしゅうへボタン
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
    
          case 'monsterDex':
            return [
              { title: 'ナビ', text: 'ならべかえ や しぼりこみ が できるよ。', anchor: () => domRect('.monster-dex-navigation') },
              { title: 'カード', text: 'ヨミトモにしたゴトモンを みてみよう！\nおすと しょうさいが ひらくよ。', anchor: () => domRect('.monster-card-grid') }
            ];
    
          case 'kanjiDex':
            return [
              { title: 'ならべかえ', text: '学年/五十音 などで ならべかえ！', anchor: () => domRect('.kanji-dex-navigation') },
              { title: 'カード', text: 'かんじカードを おすと しょうさい！', anchor: () => domRect('#kanjiCardGrid') }
            ];
    
          case 'profile':
            return [
              { title: 'プロフィール', text: 'せいせきと しょうごうを チェック！\n図鑑へのショートカットも あるよ。', anchor: () => domRect('#profileScreenContainer') }
            ];
    
          case 'settings':
            return [
              {
                title: 'プレイヤー名',
                text: 'なまえを いれて「変更する」を おそう！\nゲーム内の なまえが かわるよ。',
                anchor: () => domRect('#settingsContainer > .settings-panel:nth-of-type(1) .inline-controls', 20)
              },
              {
                title: '表示設定',
                text: 'タイマーの 表示/非表示を きりかえられるよ。',
                anchor: () => domRect('#settingsContainer > .settings-panel:nth-of-type(2)', 20)
              },
              {
                title: 'BGMおんりょう',
                text: 'ここで おんがくの おおきさを かえられるよ。',
                anchor: () => domRect('#bgmVolumeSlider', 20)
              },
              {
                title: 'SEおんりょう',
                text: 'こうかおんの おおきさを ちょうせい！',
                anchor: () => domRect('#seVolumeSlider', 20)
              },
              {
                title: 'セーブとバックアップ',
                text: '「かんたんセーブ」で いまの つづきを まもれるよ。\nくわしいメニューから バックアップの さくせい/よみこみ もOK！',
                anchor: () => domRect('#settingsContainer > .settings-panel:nth-of-type(4) .settings-button.primary.big', 20)
              },
              {
                title: 'バトルせってい',
                text: 'かいふく回数や 行動タイミングを えらべるよ。',
                anchor: () => domRect('#healCountSlider', 20)
              }
            ];
    
          case 'practiceBattle':
            return [
              { title: 'マスターモード', text: 'かなで よみを入力 → Enter！\nまちがえても へいき、れんしゅうだよ。', anchor: () => canvasBottomCenter(ctx.canvas, 320, 80) }
            ];
        
             case 'courseSelect':
               return [
                 {
                   title: 'このゲームについて',
                   text: '日本編（小学生の漢字）と 世界編（中学生の漢字）があります。\nはじめは 日本編から すすんでいこう！',
                   anchor: () => canvasCenterBox(ctx.canvas, 500, 160)
                 },
                 {
                  title: '日本編',
                  text: 'ここをおすと 日本の地方へ。ステージをクリアして かんじをおぼえよう！',
                  anchor: () => canvasRect(ctx.canvas, (ctx.japan?.x||50), (ctx.japan?.y||150), (ctx.japan?.width||280), (ctx.japan?.height||260))
                },
                {
                  title: '世界編',
                  text: 'ここは ちからが ついてからでもOK。中学生レベルのかんじに ちょうせん！',
                  anchor: () => buttonRect(ctx.world || { x: 430, y: 150, width: 280, height: 260 }, ctx.canvas)
                },
                {
                  title: 'もどる',
                  text: 'わからなくなったら タイトルへ もどれるよ。',
                  anchor: () => buttonRect(ctx.back || { x: 10, y: (ctx.canvas?.height||600)-60, width:120, height:40 }, ctx.canvas)
                }
               ];
    
          default:
            return [];
        }
      }
    
  // 1) キャンバス論理座標 → 画面(CSS px)
 function canvasRectToViewport(canvas, r) {
     const b = canvas?.getBoundingClientRect?.();
     if (!b) return { x: r.x|0, y: r.y|0, w: r.w|0, h: r.h|0 };
     const sx = b.width  / (canvas.width  || b.width);
     const sy = b.height / (canvas.height || b.height);
     return {
       x: Math.round(b.left + r.x * sx),
       y: Math.round(b.top  + r.y * sy),
       w: Math.round(r.w * sx),
       h: Math.round(r.h * sy),
     };
   }    
  
    // 2) キャンバス用ヘルパ（論理座標で受けて画面座標へ）
    function canvasRect(canvas, x, y, w, h) {
      const c = canvas || document.getElementById('gameCanvas');
      return canvasRectToViewport(c, { x, y, w, h });
    }
    function canvasCenterBox(canvas, w, h) {
      const c = canvas || document.getElementById('gameCanvas');
      const cw = c?.width || 800, ch = c?.height || 600;
      return canvasRectToViewport(c, { x:(cw-w)/2, y:(ch-h)/2, w, h });
    }
    function canvasTopLeft(canvas, w, h)      { return canvasRect(canvas, 20, 20, w, h); }
    function canvasTopRight(canvas, w, h)     { const c=canvas||document.getElementById('gameCanvas'); const cw=c?.width||800; return canvasRect(c, cw-w-20, 20, w, h); }
    function canvasBottomCenter(canvas, w, h) { const c=canvas||document.getElementById('gameCanvas'); const cw=c?.width||800, ch=c?.height||600; return canvasRect(c, (cw-w)/2, ch-h-20, w, h); }
  
      // 追加: ボタン矩形（{x,y,width,height}）→画面座標（必ず同じ canvas を使う）
  function buttonRect(btn, canvas) {
    const c = canvas || document.getElementById('gameCanvas');
    const b = btn || { x: 300, y: 350, width: 300, height: 50 };
    return canvasRectToViewport(c, { x: b.x|0, y: b.y|0, w: b.width|0, h: b.height|0 });
  }
  
    function canvasApprox(mapRect, px, py, w, h) {
      const c = document.getElementById('gameCanvas');
      if (!mapRect || !c) return { x: 80, y: 120, w, h }; // フォールバック
      return canvasRectToViewport(c, {
        x: mapRect.x + mapRect.width  * px - w / 2,
        y: mapRect.y + mapRect.height * py - h / 2,
        w, h
      });
    }
  
   // 3) DOM要素（既にCSS px）→そのまま
   function domRect(selector, pad = 8) {
     const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
     if (!el) return { x: 80, y: 120, w: 300, h: 120 };
     const r = el.getBoundingClientRect();
     return { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
   } 

  export default getStepsFor;