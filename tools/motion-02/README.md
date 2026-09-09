# MOTION-02 functional QA

通常battleの `hokkaido_area1 / HKD-E01` に限定した表示接続。正式benchmarkではない。
製品コードの時計は既存battle update。ここにあるNode側の待機は検査用で、製品へimportしない。

## 自動回帰

worktree rootから実行する。出力先には新しいディレクトリを指定する。

```powershell
node tools/motion-02/verify.mjs C:/kanji-game-latest/artifacts/motion-02/verification-NEW
```

現在の期待値はBaseline 268 / MOTION-01 39 / MOTION-02 32、合計339 PASS、全失敗区分0。旧Standalone scopeの38 PASS / 1 FAILは過去の記録として保持する。両scope suiteは共通helperで、stable由来のbattle以外不変、9個の承認hookの内容・位置固定、除去後のbattle全文一致、明示した新規pathだけの許可、package/lock byte・SHA一致を検査する。hookの変更・移動・複製・余分な文・許可外path等を拒否するnegative fixtureも既存件数内で検査し、skipしない。

checkpoint後も同じGit履歴を持つclean worktreeから実行する。scope監査はstableとMOTION-01 checkpointのGit objectを参照するため、履歴のないsource ZIP単独を再現証拠にはしない。確定SHA・tag・remote値を記すFreeze文書とraw logは `artifacts/motion-02/freeze-01/` に置き、検証commitのsourceへ混ぜない。

## Headed Chrome

ブラウザーは専用の架空save profileだけを使う。実ユーザーprofile、Firebase成功接続は禁止。
Vite dev serverは `127.0.0.1:49741`、専用ChromeのCDPは `127.0.0.1:49742`。
新規profileで開始し、終了時は起動したserver/Chromeを停止する。

```powershell
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 49741 --strictPort
```

Chromeはheaded、専用 `--user-data-dir`、`--remote-debugging-port=49742` で起動する。
`start-qa.mjs` が受け入れるのは既存E0認証工程の `e0-cert-01` / `Fresh MemoryStorage` fixtureのみ。fixture実体はGitに含めない。初回bootstrapの外部通信をCDP Fetchで拒否し、その後もFirebase関係domainをNetworkでblockする。

```powershell
node tools/motion-02/start-qa.mjs <certified-artificial-fixture.json> <new-output-directory> <unique-fixture-generation>
node tools/motion-02/route-qa.mjs <new-output-directory>
```

routeはtitle→通常stage→E01を実UIで操作し、Tutorial未読/既読を確認する。Vite HMRでは同名moduleの無query importが別instanceになるため、検査対象battleは製品が実際にロードしたresource URLから参照する。開発中にsrcを変更した場合は新しいQA sessionで再確認する。

- `functional-qa.mjs`: 架空fixtureの未撃破E01から、composition中Enter、誤答attack、正答hit/defeat、E02、保存本体のTutorial既読を検査。
- `lifecycle-layout-qa.mjs`: **未撃破E01**から10往復、3 viewport × pad OFF/ON、reduced motion。撃破済みcheckpointではE02へ復帰するため、この検査には別の初期状態の架空fixtureを使う。
- `input-isolation-qa.mjs`: Tab、CDP touchによるheal、横画面padの同session Legacy比較。入力幅の既存収束処理が完了前の場合、厳密比較が失敗することがある。失敗JSONを残す。
- `legacy-isolation-qa.mjs`: 844×390 / pad ONのlayoutが落ち着いた後、表示bridgeだけを有効/無効にして配置を比較する。Coreは変更しない。
- `bundle-audit.mjs <baseline-dist> <new-json-path>`: disk bytes / SHA / gzip参考値。実通信や性能合格の証拠ではない。

失敗時の出力も保存し、同じ出力先を再利用しない。Browserの画像取得中にもゲーム時計は進むため、取得完了後のJSON actionがidleになっていても、撮影開始時に観察したhit区間と同時刻とは限らない。OSの実IME変換そのものと、CDP compositionイベントの検査は区別する。

正式性能、Sprint、他profile、battle以外への展開、commit/push/tagは別タスク。
