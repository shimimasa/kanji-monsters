# Candidate 1 GO / NO-GO

実施者：________　日付：________　Candidate hash：________　端末：________

ソフトウェア検証の詳細・最終hashは `CHILD_PLAYTEST_CANDIDATE_1_CERTIFICATION.md`。下のチェックは運営者が当日に埋める。空欄をPASSと扱わない。

| 項目 | 当日確認 | 条件 |
| --- | --- | --- |
| Candidate固定 | □ | 最初の3〜5人の途中変更なし |
| commit/tag | □ | manifestのtagをdereferenceし証明書hashと一致 |
| 通常build | □ | APIなし。productionでフラグ1でもなし |
| 観察build | □ | mode＋flag＋localhost。5181起動、5182はOFF |
| logger | □ | start前null、同意、二重start拒否、4マーク、end |
| JSON export | □ | ended、truncated:false、ID/run一致、JSON VERIFIED |
| 初期save | □ | 3体・Lv1/XP0・記録なし・音量・チュートリアル一致 |
| reset | □ | 専用Chromeのみ。end/export確認/clear/NEXTを人が予行 |
| 全8ゲーム | □ | QA PASSに加え、採用端末で入力・結果・再挑戦 |
| 保存 | □ | clearでsave維持、NEXTで同条件、通常ユーザーへ触れない |
| 音量 | □ | ミュート保持＋人が全8本のBGM/正解/コンボ/技を聴く |
| 個人情報 | □ | 匿名ログ、無記名シート、同意書分離、保存責任者・削除日 |
| 観察シート | □ | 匿名ID/run照合、支援/未観測、質問は終了後 |
| 運用runbook | □ | 操作担当・観察担当、児童へDevToolsを見せない |
| 自動回帰 | □ | 648/0、防衛59/0、build、diff、logger、Dry Run |
| Windows Chrome | □ | インストール版の自動操作PASSと人の実操作を区別 |
| 実IME | □ | かな/変換/Enter/Backspace/再回答/ポーズ/戻るを人が実行 |
| iPad/iPhone | □対象外 □確認 | Safari/指/keyboard/safe-area/音。viewportだけは不可 |
| 未確認項目 | □ | 対象端末で必要な未認証が残ったら実施開始しない |

Windows自動Chromeはソフトウェア検証。実IME・聴感・Safari等は **MANUAL CHECK REQUIRED**。対象外機器は対象外と記し、その機器へ認証を広げない。
ログ欠損・save破壊・進行不能・未固定はNO-GO。端末未認証だけなら「FROZEN — MANUAL DEVICE CHECK REQUIRED」とし、人による確認後に運営責任者が当日GOを記入する。

当日：□GO □NO-GO　未確認／中止理由：________________　実施責任者（別管理）：________________
