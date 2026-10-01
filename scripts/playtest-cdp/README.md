# ブラウザでの実プレイ確認（headless Chrome + CDP）

npm パッケージは追加していません（Node 22 の fetch / WebSocket だけで動きます）。

1. ビルドしてプレビューを起動する
   `npm run build` → `npx vite preview --port 4173 --strictPort`
2. headless Chrome を起動する（プロファイルはどこでもよい）
   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --remote-debugging-port=9333 --user-data-dir=<一時フォルダ>/play-profile --window-size=1280,800 --no-first-run --hide-scrollbars about:blank
   ```
3. 操作する
   - `node cdp.mjs nav http://localhost:4173/` … ページを開く
   - `node cdp.mjs eval "<js>"` … ページ内でJSを実行（ボタン探し・状態の読み取り）
   - `node cdp.mjs shot out.png` … スクリーンショット
   - `node cdp.mjs viewport 390 844` … 画面幅を変える（Windowsでは幅512が下限）
   - `node tap.mjs x y 150` … **指に近いタップ**（押して0.15秒で離す）。`element.click()` では
     「毎フレームDOMを作り直してタップが消える」不具合を見逃すので、確認は必ずこちらで行う。

注意:
- localhost にはセーブがない。タイトルの「だれが あそぶ？」で名前を作ると遊べる。
- Claude in Chrome はタブが裏に回ると描画ループが止まるので、アーケード系の確認には向かない。

テストの一括実行と基準との比較: `bash scripts/playtest-cdp/run-all-tests.sh`
（最後に `SAME-FAILS` と出れば、落ちているのは既知の凍結・許可リスト系ゲートだけ）

## ミニゲームを通しで遊ばせる（2026-09-30 追加）

- `bash scripts/playtest-cdp/enter-game.sh <gameId> [<selectのaria-label> <value>]`
  … 広場からゲームを開き、開始オプションを選んで「スタート」まで押す。
  例: `enter-game.sh gotomonMaze とびらのもんだい math`、`enter-game.sh gotomonMerge けいさんのもんだい times`
- `node scripts/playtest-cdp/tapnow.mjs "<要素を返すJS>"` … 同じ接続で位置を測ってすぐ指タップ（動く的でも外れにくい）
- `node scripts/playtest-cdp/errs.mjs` … 3秒間、例外とコンソールエラーを集める（`no errors` なら合格）
- `bots/` … 算数モードなら答えを計算して、実際のタップ・なぞり・スワイプで最後まで遊ぶボット。
  引数は `<秒数> [わざとまちがえる回数]`（swipebot は `<秒数> wrong`）。
  | ボット | ゲーム | enter-game の開始オプション |
  |---|---|---|
  | swipebot | ゴトモン・スラッシュ | 切るもんだい math |
  | drumbot | リズムたいこ（音符がたいこに来た瞬間に押す） | たいこのもんだい math |
  | racebot | ゴトモン・レース | レースのもんだい math |
  | mergebot | けいさん2048（答え＋スワイプ） | （なし＝たし算・ひき算） |
  | linkbot | 線つなぎ（第3引数 `tap` でタップ→タップ） | つなぐもの math |
  | seekbot | ゴトモンさがし | さがすもんだい math |
  | mazebot | ゴトモン迷路 | とびらのもんだい math |
  | jumpbot | ゴトモン・ジャンプ（塔を指でおさえたまま動かす） | 雲のもんだい math |
  | tagbot | ゴトモンおにごっこ（▲▼◀▶を押す） | ふだのもんだい math |
  | golfbot | ゴトモン・ミニゴルフ（旗をタップ→コースを押して引っぱって離す） | 旗のもんだい math |
  | hopbot | ゴトモン・川わたり（▲▼◀▶を押す。荷車と丸太の速さを画面から2回読んで判断） | おうちのもんだい math |
  | othbot | 漢字オセロ（読みは分からないので答えはランダム） | （なし） |
- 画面幅を変えたら最後に `node cdp.mjs viewport 1280 800` で戻す。

