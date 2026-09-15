# Kanji Defense Content 120 Recertification

## 境界

**Core: unchanged / View: unchanged / Content: intentionally changed**。

Candidate 1は別版。tag・release branchは `a9cb2b294e68229b31805a46666d2249ff273ac3` を保持。今回の99問を、以前の人間レビュー済み21問と混同しない。

## OLD CONTENT BASELINE

`KANJI_DEFENSE_GOLDEN_CONTENT`: 24問、オブジェクト単位で全件旧commitと一致。

旧使用集合: 21問。`kd-g4-003` 以下、`kd-g4-004` 位置、`kd-g4-011` 結果を除外した状態を完全保持。

旧Content全体のSHA-256（UTF-8/LF正規化）：`7f1976f0031da6a5ee44fe2ac2bc053a379d66735ec3393015b7f0935a66a126`。

旧scope-contract・旧goldenの検査は削除していない。Content全体のbyte固定だけを、承認された新境界に更新。

## CONTENT 120 BASELINE

使用集合＝旧21＋新99。新ID `kd-g4-025`〜`kd-g4-123`。旧除外IDは再使用しない。versionは `kanji-defense-content-120-v1`。既存export名はruntime互換のため維持する。

| File | SHA-256（UTF-8/LF） |
| --- | --- |
| kanjiDefenseContent.js | 05f2c4e83117a20d0a14a47020e24ba637b88367d871f0f31eaaf7b31fb28e69 |
| kanjiDefenseContent120.js | 77c8bb97438a496a4f47ae6c4070f1329e5d72993ef68c4836a0496f2fcd2e82 |
| kanjiDefenseGame.js | db6fd03383d540cfe4b8a52c105b23095dfd8b3be7ee7904f8ff6e11e0d23fc6 |
| kanjiDefenseView.js | 41ef447dc9e4812d60c429c87acf5c421bd582c900cabaa6c63e2a70fcf9ce44 |

## 再検証

| Check | Result |
| --- | --- |
| Core/ViewとCandidateの比較 | PASS、変更なし |
| 旧golden24/使用21の完全保持 | PASS |
| 新99のschema・ID・参照・重複 | PASS |
| 全120のロードと実抽選 | PASS |
| 全120のaccepted readingを実Coreへ投入 | PASS、カタカナ＋内部空白を含む |
| 読みの正規化処理 | 変更なし。新許容入力を推測で足していない |
| IME関連自動テスト・再回答・二重送信 | 既存59件内でPASS、全120の二重送信拒否も追加検査 |
| 12問完走 | CoreテストPASS、Chrome画面で12体撃退を確認 |
| 60セッション×3seed | 全seed合算で全120到達、平均6回/item |
| 390×844 | 新規中盤/終盤/最長語、入力欄、結果/再挑戦を確認 |
| 既存防衛回帰 | 59 PASS / 0 FAIL |

証跡：`artifacts/content-120/defense-final.log`、`content-tests.log`、`browser-flow/kanjiDefense-result.png`、`longest/results.json`。

実Windows IMEの人間操作、iPhone/iPad Safari実機、音の人間確認は今回実施していない。自動compositionテストをREAL IME認証とは呼ばない。

Future target: 144

判定：Content 120の自動再認証PASS。元Candidateの認証書は別版のまま保持。
