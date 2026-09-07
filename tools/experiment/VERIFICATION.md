# E0 verification — 2026-09-07

GO-08 ACHIEVED（下記Windows Chrome headless・device入力・loopback環境について）。B0性能測定、3D実装、実IME・実聴・mobile・公開環境の認証ではない。

## 基点と構成

- Baseline: `2a521dd5aa747314b25e761d976bd4f880cd58c3`
- Annotated tag: `yomitabi-2d-stable-2026-09`
- Tag object: `6fcd0afd23b0066a4f46f1a4169e01c98f490c06`
- 両worktreeの製品tree・依存定義はBaselineのまま。E0差分は `tools/experiment/` のみ。
- 両build 3,963ファイルの内容manifest hash: `8effc5c2e2110a2a5c248c431d3552cf2f4772e747a2dee2b527096c2ab43cad`
- Fixture 13 key、hash: `263e552a487a1851aabd5660c8eaa988d14f7f0ae3f6723867af1e33ec6a8f89`
- Node v22.14.0、npm 10.9.2、Vite 5.4.19。各worktreeでnpm ci（22 packages）を実行。mainの依存は非共有。

## ISO実行結果

| Gate | 結果 | 実行証拠 |
| --- | --- | --- |
| ISO-01 | PASS | 指定SHA・tag・branch確認、専用worktree、製品差分0、両dist hash一致 |
| ISO-02 | PASS | role別新規Chrome profile。local/session Storage・IndexedDB・CacheStorage・SW登録0、controllerなし、firebase undefined |
| ISO-03 | PASS | self ping 200、別port canaryのconnect-src/enforce違反、receiver 0。強制header。HTTP安全性20項目 |
| ISO-04 | PASS | 既存APIから架空生成、全key readback/hash一致、既存readSaveState valid |
| ISO-05 | PASS | 両roleでSDK拒否2件、Auth/Firestore要求0、外部response0、reload後firebase undefined・save valid |
| ISO-06 | PASS | title→架空名→コース→北海道→通常戦闘→正答→誤答→保存→退出→再入場→reload |
| ISO-07 | PASS | manifest、ツールhash、Network/CSP、Storage差分、スクリーンショット、手順、失敗試行を保存 |

| 対象 | origin | Chrome | 最終run |
| --- | --- | --- | --- |
| baseline | `http://127.0.0.1:49721` | 152.0.7977.82 headless | baseline-05 |
| experiment | `http://127.0.0.1:49722` | 同版・別profile | experiment-01 |

reload後、両方とも正答1・誤答1・復習queue 1、stage clear 0、回答記録の保持を機械照合した。乱数で出題は異なり、同じ漢字列の性能比較は行っていない。全10体完走、回復、撃破は今回のE0通し試験の範囲外。

## その他の検証

- 正式phase-a 86 / phase-b 22 / phase-c 17 / no-go 143、合計268 PASS。fail/cancelled/skipped/todo=0。
- stage ID integrity: oldIdHits=0、referenced ⊆ stages、PASS。
- Baseline・experiment build PASS。既存CJS/import/chunk警告は保持。
- E0安全性Node test 5 PASS、HTTP 20 PASS、unknown架空Storageを消さずSTOP PASS、port二重起動EADDRINUSE・fallbackなしPASS。
- 元mainの既存4,165ファイルをSHA-256照合、変更・欠落0。

## 証拠参照

生の証拠はmain workspaceの `artifacts/yomitabi-e0/runs/e0-cert-01/`、正式検証は隣の `initial/`。生成fixture・Storage dump・browser profile・raw Networkをcommitしない。

| 証拠 | SHA-256 |
| --- | --- |
| baseline-05-evidence.json | `5fbcde9692d9d429eee24aa2e4206a85fd4be048718921f05f59e64e3e22e662` |
| experiment-01-evidence.json | `542cdbcb1b906b5fb337b5e3eca0fa8d8ac3fb09451ab89e29e65a1d47ad5fdd` |
| server-manifest.json | `ea8863010d986af697c762fe871dabdf7ce5ae1b90151fb77092cdc069055b4b` |
| unknown-storage-evidence.json | `54effcbd9995c3b1f4cb001f3126b85a3a67f61cd186f7a47a51d8abe6e715de` |
| http-safety-evidence.json | `5775c4b537fd9a908c4e25c6f277c0be1b0894058ba5c404c4856ae837fb36e2` |

## 制約・初期試行

baseline-01は準備ページのクリックが画面外、02はステージの2回目の確認操作不足、03はかなパッドとGuideの重なり、04は退出ボタンの実ラベルとスクリプト想定の相違により中断した。元の製品は変更せず、最終手順を既存UIへ合わせた。各試行は新規profileであり、保存領域を消して再利用していない。

かなパッド表示中のGuide操作については、今回の自動操作で別のキーに届く現象を観測した。最終runでは既存「たんまつで書く」でpadを閉じて正常Tutorial完了。pad表示のままの全操作をPASSにしていない。この2D表示条件を3D回帰と混同せず、別QAで確認する。

アプリのNetwork監視範囲に外部responseはない。Chrome内部の全バックグラウンド通信やPC全体の無通信までを証明するものではない。実Firebase側を読み書きして遮断を確認する方法は使用していない。
