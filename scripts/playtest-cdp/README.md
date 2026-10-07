# ブラウザでの実プレイ確認（headless Chrome + CDP）
理科・社会の授業ゲーム2本は2026-10-07に一時休止した。以下の授業ゲーム通しプレイ手順は、再検討時の記録として残す。現在の広場はミニゲーム50種類のみで、直接URLは休止案内を表示する。
## 理科・社会の授業ゲーム2本（2026-10-06）

ビルドとプレビューを起動し、下記の専用Chrome 9333番を使う。試験用プロファイルにだけ `node --experimental-default-type=module scripts/playtest-cdp/seed-profile.mjs` でセーブを入れ、`node scripts/playtest-cdp/lesson-v2-playtest.mjs 1280 800 --parent` と `node scripts/playtest-cdp/lesson-v2-playtest.mjs 390 844 --parent` を実行する。**各実行前に試験用セーブを入れ直す**。2本各5場面を実タップし、横はみ出し、画像、捕獲と保存キー一致を確かめる。`--shots` を加えると `docs/lesson-pilot/` に画面を保存する。旧版用の `lesson-pilot.mjs` は今の画面の操作には使わない。


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
（最後に `ALL-PASS` と出れば合格。2026-10-04 に いつも落ちていた凍結・許可リスト系ゲート40件を外した。`DIFFERENT` は どこかが壊れている）

## ミニゲームを通しで遊ばせる（2026-09-30 追加）

- `bash scripts/playtest-cdp/enter-game.sh <gameId> [<selectのaria-label> <value>]`
  … 広場からゲームを開き、開始オプションを選んで「スタート」まで押す。
  例: `enter-game.sh gotomonMaze とびらのもんだい math`、`enter-game.sh gotomonMerge けいさんのもんだい times`
- `node scripts/playtest-cdp/tapnow.mjs "<要素を返すJS>"` … 同じ接続で位置を測ってすぐ指タップ（動く的でも外れにくい）
- `node scripts/playtest-cdp/abc-post-drag-smoke.mjs [--touch]` … ABCポストを開始した専用Chromeで、ポストの外へ離しても回答せず、ポストへ届けた時だけ回答することを確かめる。`--touch` は390×844のタッチ操作。
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
  | landbot | ゴトモン・ぼうけんランド（▶を押しっぱなし、穴・段差・どんぐりの前でジャンプ、広間で「はいる」） | ステージのもんだい math |
  | tracebot | ゴトモン・もじなぞり（マスを指でなぞる。第3引数 `tap` でタップ。算数以外は2回まちがえて光る番号をたどる） | なぞるもんだい math |
  | pushbot | ゴトモン・おしだし（答えの はこを タップ→画面から へやを読み、ゲームの solver で押す順を決めて となりのマスをタップ。第2引数 まちがえる回数、第3引数 `help` で相棒に はこんでもらう） | はこのもんだい math |
  | othbot | 漢字オセロ（読みは分からないので答えはランダム） | （なし） |
- 画面幅を変えたら最後に `node cdp.mjs viewport 1280 800` で戻す。


## スマホの画面で 確かめる（2026-10-04 追加）

`cdp.mjs viewport` は Windows では 幅512 が 下限で、スマホを たてに した 状態（幅600以下で たて長 → 盤面 480×680）を 作れない。
1回の 接続の 中で 端末を まねる `emusession.mjs` を 使う。

```
node scripts/playtest-cdp/emusession.mjs 390 844 "nav:http://localhost:4173/" "wait:1500" \
  "tapjs:document.getElementById('titleAdventureButton')" "wait:3000" "tapgame:397,588" "wait:2500" "shot:C:/tmp/quiz.png"
```

- 手順: `nav:<url>` `wait:<ms>` `eval:<js>`（結果を表示）`tap:<x>,<y>`（画面の座標）`tapjs:<要素を返すJS>`
  `tapgame:<x>,<y>`（**盤面の 座標**。表示の 大きさに 合わせて 変換して タップ）`size:<w>,<h>` `shot:<png>`（Windows の パスは C:/... で）
- **起動の たびに 端末の 大きさを 設定しなおすので、直後は 盤面が 一瞬 800×600 に 戻る**。最初の 手順は `wait:1500` に する
  （しないと 最初の タップが ずれる）。
- 押した ボタンが alert を 出すと ページが 止まり、`eval` が 返らなくなる（例：まだ ひらいていない 四国・九州の タブ）。
  そうなったら `node scripts/playtest-cdp/reset-page.mjs` で タブを 閉じて 作りなおす。
- 盤面の 座標の 目安（たて 480×680）：ステージ選択の 力だめし 397,588 ／ 学年まとめの こたえる 240,640 ／ 結果の 復習に挑戦 240,640
