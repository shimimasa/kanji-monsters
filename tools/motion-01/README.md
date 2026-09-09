# MOTION-01 standalone

HKD-E01の既存1枚画像をslime profileで動かす開発用hostです。製品battleには接続していません。

このworktreeで実行します。

```powershell
node tools/motion-01/server.mjs
# http://127.0.0.1:49731/
node --experimental-default-type=module --test tests/motion-01/*.test.mjs
```

サーバーはlocalhost限定・明示したファイルだけを配信します。終了はCtrl+Cです。npm script、製品entry、packageの変更はありません。

## 確認手順

1. idle / attack / hit / defeatを選び、再生または進捗sliderで観察する。同actionボタンは再発火。defeat終端は保持し、通常のidleへ戻すには新sessionで再入場する。
2. Legacy / Motion / 静止を切り替える。232×112と174×84はclipの論理寸法。画像は既存の240×120描画を維持し、小サイズでは全体を0.75倍する。
3. 途中で「動きを減らす」を切り替える。進捗は変えず、idle/attack/hitは静止、defeatは静的縮小・透過となる。
4. Sprint mockの正解通知を押す。同じengineがattackを描く。採点・EXP・保存・問題生成はない。celebrateは未実装。
5. pending / failureでも操作が続き、緑の既存fallback相当が出ることを確認する。host退出、再入場も試す。

## 接続契約

`motionProfile.js`はprofile/action/progress/layout/reducedMotionからposeを返すpure関数です。`motionTimeline.js`も入力を変更せず表示状態を返します。`monsterMotionHost.js`がsessionごとにその状態と画像参照を保持します。sample/presentは時間を進めません。`bridges.mjs`のみヨミタビのdamage→hit、Sprintのcorrect→attackを解釈します。

呼出側は外部timerからupdateし、既存Canvas2D contextとimageRect/clipRectをpresentへ渡します。描画失敗・未readyならfalseを返し、呼出側が静止または既存fallbackを描きます。animation終了callbackはなく、学習Coreを呼びません。

Motion Engineとhostにはtimer/RAFがありません。このデモの再生ボタンだけが33msのsetIntervalを使う観察用transportです。退出・非表示で停止します。MOTION-02ではこのtransportを持ち込まず、既存game update/render cycleを使います。

画像は既存assetsLoaderのalpha処理をそのまま使います。同loaderの画像cache/進行中requestは既存loader所有です。Motion hostは退出時に参照を解放し、late resolve/rejectを無視します。既存cache自体の破棄やfetch中止を保証するものではありません。

## 比較の限界

Legacy側は現行の画像寸法・枠・背景・attack/defeat式を参照した開発用比較です。hitの既存Math.randomは変更せず、このhostだけ決定的ジッターで近似します。枠の角丸描画と画像背面の薄い暗幕も比較hostの共通描画なので、実battle全体のpixel一致を保証しません。画像fit・切抜き・透過処理の改善は行っていません。

デモ3面を同時描画する数値を製品性能として扱わないでください。実battle、IME/Tutorial、学校端末・mobile実機、正式Legacy/Motion/V1a比較は別工程です。

## MOTION-01 checkpointからMOTION-02への必須条件

- A. Motion samplingはdisplay-only。
- B. animation完了を回答・採点・HP・EXP・保存・次問・敵交代へ接続しない。
- C. 画像readyを回答条件にしない。
- D. 新RAF / setIntervalを製品へ持ち込まない。
- E. 既存game update/render cycleを使う。
- F. 既存画像fit / alpha処理 / background / frameを同時改善しない。
- G. save / learning / SRS / 教材 / IME / Tutorialの意味変更0。
- H. MOTION-01のdemo setIntervalは製品transportではない。
- I. Sprint mockは実Sprint integrationではない。
- J. 正式性能比較はMOTION-02後の別工程。
