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
