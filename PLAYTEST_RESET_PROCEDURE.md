# Candidate 1 初期状態復元

対象は運営専用の独立Chromeだけ。通常ユーザーのブラウザにJSONを貼る、Storageを全消去する、設定の「全データリセット」を使うことは禁止。

## 固定セーブ

`tools/kanji-defense-browser-cert/CHILD_PLAYTEST_INITIAL_SAVE.json`

- ID: `child-playtest-candidate-1-initial-v1`
- SHA256: `7867b10ff0893873d9e147cbf3d3ee18d10ca151c73245081aeab8f0c7593f1a`
- 合成運営セーブ（実児童のデータでも、実際に本編を捕獲操作した証跡でもない）。既存v2形式、所有の正本 `player.collection.gotomonIds` のみを使用。
- ゲスト、スロット1。本編Lv1/EXP0、未クリア、学習履歴なし。
- HKD-E01 ジャガイモスライム／HKD-E02 トウモロコシインプ／HKD-E03 ミルクフェアリー。全員Lv1、XP0、なかよし0、プレイ0、ベストなし。最初の選択はE01。
- BGM 0.2 / SE 0.3。既存ゲーム音量の固定初期値であり聴感認証ではない。
- title/courseSelect/stageSelect/battle/regionSelectの既存チュートリアルを既読。他は空の同一状態。広場で全員の観察を開始する。

## 初回

1. Candidateのcommit/tagを確認し、観察サーバーを起動する（Runbook参照）。
2. 別ターミナルで `node --experimental-default-type=module tools/kanji-defense-browser-cert/operator-session.mjs`。
3. 新規Chromeの独立コンテキストが開き、初期セーブ→タイトル→広場へ進む。既存ブラウザへは接続しない。サインイン・外部通信・Service Workerを遮断した運営環境。
4. ゲスト、相棒3体、Lv1/XP0、記録なし、音量を確認。通常プロフィール／公開サイトなら中止する。

## 次の児童

1. 既存一時停止を必要に応じて使い、質問前にloggerをend。
2. summaryを確認→download→ターミナルの `JSON VERIFIED` とファイルの匿名IDを確認→シート照合。
3. `yomitabiPlaytest.clear()`。これはログだけを消す。ゲーム記録はこの時点ではまだ残る。
4. 運営ターミナルに `NEXT`。検証済みJSONがなく、またはログが残っている場合は拒否される。
5. このランチャーが作ったコンテキストだけを閉じ、新しい空の領域へ同じ初期セーブを復元する。保存は既存 `saveNow` の検証・トランザクション・互換キー投影を経由する。独自の所有データを追加しない。
6. 新しい広場で初期値確認→新しい匿名IDでstart。動的な保存日時・内部トランザクション識別子は異なるが、プレイヤー・設定・進行・チュートリアルは同一。

終了はログ処理後に `EXIT`。独立領域のゲーム進行は破棄されるが、検証済みJSONは `playtest-records/` に残る。ユーザーの本編データ・既存Chrome領域は削除しない。

## 失敗時

- 書き出し失敗：clear/NEXTをしない。再出力し、既存ファイルを上書きしない。運営者が先のJSONを確認する。
- リロード／強制終了：未出力ログは復元できない。シートに機器中断・ログ欠損を記録し、その観測を有効な再挑戦率に使わない。次の独立起動からやり直す。失った観測を捏造しない。
- ロガーAPIなし／初期値不一致：児童を呼ぶ前に止め、版・5181番・モード・ハッシュを確認する。
- ランチャーを使わない実機は別途安全な独立領域の復元認証が必要。LANへ公開してlocalhost制限を外す運用は禁止。
