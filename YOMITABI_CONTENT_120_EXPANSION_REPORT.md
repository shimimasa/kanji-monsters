# 1 Executive Summary

**CONTENT 120 READY WITH MINOR ISSUES**

共有計算・英語・文ならべ・タイムことば・複数選択・短い教科横断クイズ・漢字防衛隊の7正本を、それぞれ120 canonical itemsへ拡張した。旧Candidateは不変。旧648テストに教材21テストを追加して669 PASS / 0 FAIL、防衛単独59 PASS / 0 FAIL。

「ファイル上120」だけでなく、全候補の実sampler到達、正答/参照、全120防衛読みのCore受理、全8本の通常画面導線、390×844の新規・最長ケースを検証した。意味監査はAIによる第二編集パスであり、人間の教材認証ではない。文ならべの構文多様性と実機確認には留意点が残る。

# 2 Candidate 1 Isolation

固定commit/tag/release branchはいずれも `a9cb2b294e68229b31805a46666d2249ff273ac3`。tag付け直し、releaseへのcommit、push、deployなし。凍結版の観察サーバー/保存物を使用・更新していない。

既存のFirebase cache、3D実験資料、未追跡の認証書等は保持し、教材変更と混ぜていない。

# 3 Branch / Baseline

`feature/content-bank-120`。基点HEADは指定Candidate commit。前回停止理由を記録した2資料とInventoryを読み、基準の81式/各20/防衛21を再確認してから再開した。今回の成果はこのブランチだけへ教材commitとして記録。push/deployは行っていない。

承認範囲：20以内の加減算、指定3問および同程度の重大な曖昧性のID保持修正。教材、loader/sampling、validator、教材テスト、監査資料のみ変更。

# 4 Content Inventory

| Bank | Before | After |
| --- | ---: | ---: |
| Math shared | 81表示式 / 65概念 | 120概念 / 136表示式 |
| English | 20 | 120 |
| Sentence | 20 | 120 |
| Timed | 20 | 120 |
| Multi | 20 | 120 |
| Async | 20 | 120 |
| Defense | 使用21 / golden24 | 使用120 / 旧golden24保持 |

正本、schema、ID、共有関係、runtime依存は `CONTENT_BANK_INVENTORY.md` に記録。問題一覧は7つの `CONTENT_REVIEW_PACKET_<BANK>.md`。

# 5 Math Bank

旧81式を保持。加算の左右交換を同じcanonical itemのvariantへまとめ、旧65概念＋新55概念＝120とした。新規55に左右交換の水増しなし。旧表示順を含めると136式だが、136を120問と数えているのではない。

加算は `a>=1,b>=1,a+b<=20`。減算は `1<=a<=20,1<=b<=20,a-b>=0`。全式をプログラムで再計算。5問＋5問を保持。スプリントとインベーダーの両Coreで新範囲の受信を確認し、画面でも式を確認した。

# 6 English Bank

旧20語を完全保持、新100語。学校・家庭・食物・自然・時間・場所・動作・感情・形容を分散。綴り/訳の一意性を検査。誤答は同カテゴリ2語＋別カテゴリ1語を抽選し、無関係な選択肢ばかりになることを避けた。正答の別語義を誤答へ入れていない。

# 7 Sentence Bank

全120で、自由な主語/副詞/目的語の移動と、ピースの依存関係を第二意味監査。旧19問に具体的別解を確認してID保持改稿。umbrella-rainは本文を全保持し、ピース境界だけを修正した。根拠と旧別解は `CONTENT_CORRECTIONS_PROPOSED.md` に列挙。

全20問を増量の都合で一律置換したのではない。現在は唯一解を明確にするため3ピース中心となった。3〜6という契約は保持しているが、旧4〜5ピースからの構文多様性減少は留意点。配列一致検査を自然な唯一解の証明とは称しない。

# 8 Time Words Bank

実学習目標である漢字語の短時間認識を維持。全120が漢字2字、読み3〜5字。5秒制限は不変。新100に難読固有名詞を入れていない。読み長ゲートで不適合だった「午後」は採用せず「夕方」に変更した。

# 9 Constellation Bank

全120問が5択中3正解・誤答2。素材/正答IDを維持し、全3840選択集合で既存部分点式を検査。分類範囲が曖昧にならないよう、温度・気圧・地理・器官等の条件を明記。旧四季4問は「関係する」を「日本で主に見られる」に限定し、選択肢・正答集合は変更していない。

# 10 Reading Bank

名称はよみこみクイズだが、実内容どおり短い教科横断問題を拡張。長文読解へ変更していない。理科・算数・社会・国語・英語の基礎知識を分散。oxygenの設問だけを承認済みの限定表現へ改稿。旧ID・選択肢・正答oxygenは保持。

# 11 Kanji Defense Bank

旧使用21＋新99＝120。旧golden24も保持。旧review待ち3問は復帰しない。4年生漢字IDと語中文字の対応を全件検査。文脈なしでは読みが競合する候補は採用せず、acceptedReadingsを推測で広げていない。新語一覧には意味とhintも掲載。

Future target: 144

# 12 Canonical Duplicate Audit

全bankでID・exact/normalized duplicate、選択肢・accepted answer重複を検査。Mathは交換法則を同一化。句点/読点は記号を消さない正規化を使用。

意味の近い対概念や別技能は `CONTENT_120_REVIEW_SUMMARY.md` に理由を記録。同一選択肢の順番変更や表記違いだけで件数を増やしていない。

# 13 Semantic Review

生成後、別の自然な正解の存在を重点に第二監査。全840行のreview packetはPASS。これはAIによる編集判断であり、人間の教材監修・児童検証済みという表示ではない。曖昧性を検出した旧問題の修正範囲と不採用候補を明記。理科・地理・公民の一部は文科省、産総研、国交省、国土地理院、参議院の一次資料で照合し、レビュー要約にリンクを記載。

# 14 Difficulty Distribution

詳細は `CONTENT_120_DISTRIBUTION_REPORT.md`。Mathは旧65概念を保持するためeasy65/standard55。他bankはstandard中心（Sentence81、English96、Timed94、Multi111、Async110、Defense115）。難易度は教材監査用分類であり、ゲーム設定・XP・ランクを変更していない。

# 15 Category Distribution

英語は9分野、Timedは学校/生活/時間/自然/言語/社会等、Multi/Asyncは教科分類を分散。追加順の後半だけを難問にしない。全体shuffleなのでファイル順がプレイ順になることもない。

TimedとDefenseの同一語は7/120：希望・自然・努力・季節・健康・説明・目的。全面複製ではなく、認識と入力の共通復習として保持。

# 16 60-Session Simulation

固定seed 1 / 42 / 20260913で、各bankの実samplerを60セッションずつ実行。詳細は `CONTENT_120_SIMULATION_REPORT.md`、生の出現回数は `artifacts/content-120/audit.json`。

10問ゲームは600 exposures/120＝平均5回。旧20問bankの平均30回から改善。防衛は720/120＝平均6回（旧21問では34.29回）。数えるのは主問題であり、誤答選択肢としての表示は含めない。

単一seedでunique118〜120、各bankの3seed合計で全120到達。最大出現は15回で、20〜30回への集中なし。単一60プレイの未出題と、抽選候補に入っていない不具合を区別し、未出題IDも公開した。

# 17 Mobile Longest Cases

Windows上のsystem Chrome 152.0.7977.83、390×844、独立した自動テスト用context。全8ゲームで既存ID・新規中盤/終盤・最長問題/正答/誤答を強制seedで表示。実Host/Core/View/Shellを用い、教材を別の簡易画面へ写して合格扱いにしていない。

全8通常導線と、最長ケース45件を検証。横overflow、縦のはみ出し、選択肢切れなし。検査対象回答コントロールは最小44px。最長入力も実際に入力欄へ入れて確認した。代表スクリーンショットを目視確認。文字サイズ/CSSの変更なし。

証跡：`artifacts/content-120/browser-flow/results.json`、`artifacts/content-120/longest/results.json` と各PNG。よみこみは地点選択後の選択肢表示を必須とし、非表示画面をPASSにしないよう検査を修正。

接続型Browserは利用不能だったため、既存Playwright環境からheadless Chromeを使用。iOS/iPad実機、実ソフトキーボード、人間のIME・音確認は未実施。viewport検査を実機認証とは称しない。

# 18 Kanji Defense Recertification

`KANJI_DEFENSE_120_RECERTIFICATION.md` にOLD CONTENT BASELINEとCONTENT 120 BASELINEを明記。Core/Viewは変更なし。旧24/21保持、新99、読み正規化、実Coreでの全120受理と二重送信拒否、12問完走を検査。Chromeの結果画面でも12体撃退を確認。旧認証資料/テストを消して回避していない。

# 19 Regression

| Check | Result |
| --- | --- |
| 全体回帰＋教材テスト | 669 PASS / 0 FAIL（既存648＋追加21） |
| 防衛単独 | 59 PASS / 0 FAIL |
| 全教材static/runtime gate | PASS |
| 元Candidate Inventory再実行 | PASS、旧件数再現 |
| 全8本の開始→回答→結果→再挑戦→広場 | PASS |
| 保存・相棒選択・ポーズ・音量・旧セーブ導線 | PASS（既存回帰/ブラウザQA） |
| production build | PASS |
| git diff --check | PASS |

build：`npm.cmd run build -- --outDir artifacts/content-120/build`。Node v22.14.0 / npm 10.9.2。凍結版や通常distを上書きしない。717.92KBのJS chunkに500KB警告あり。今回コード分割やUI再設計は行わない。

全体回帰の再現条件は、現行機能テストに旧648件＋教材21件を含め、過去checkpoint専用の `scope.test.mjs` は対象外、現在の漢字防衛隊再認証scopeだけを対象にする。過去scopeは当時のbyte固定を証明する履歴テストであり、削除・期待値改変はしていない。`--test-concurrency=1` で669件を再実行した。

期待値更新は件数、承認範囲、有限RNG呼出数、新Content version/回答lookupのみ。理由は `CONTENT_120_VALIDATION_REPORT.md`。テスト削除なし。

# 20 Candidate 1 Integrity

作業途中・終了時のtagとrelease refは双方 `a9cb2b294e68229b31805a46666d2249ff273ac3`。全8Core/View、共有プレイ/結果/成長/セーブ/音/ロガー境界の比較テストもPASS。

教材用サーバーは別ポート5188。元のpolling設定では大きい作業ツリーの監視が接続を妨げたとみられるため、教材QA起動scriptだけwatchを無効化。既存vite設定・ゲームソースを変えて解決していない。

# 21 Remaining Risks

- 意味監査はAIによるもの。人間編集者の読み合わせ、とくに文ならべの構文多様性・3ピース化の学習負荷を確認するとよい。
- 一部は中学の語彙・知識を含む。対象年齢内でも学習経験の差があるため、難易度の実感は児童テストで確認する。
- 四季の分類は「日本で主に」の代表例を基準とする。全地域で例外が一切ないという命題ではない。
- 120問でも60プレイの再遭遇率は主問題ベースで約80%（防衛約83%）。完全に初見だけの長期プレイにはならない。出現平均は大幅改善した。
- 実Safari/実IME/音の人間確認は未実施。ゲーム/UIを変えていないことと実機認証は別。
- 今回は教材用ブランチのみ。Candidate 1の児童テストへこの教材を混ぜない。

# 22 Final Verdict

**CONTENT 120 READY WITH MINOR ISSUES**

必要な120 canonical items、教材の編集監査、正答/参照、実抽選、スマホ表示、既存回帰、Candidate不変を確認。子どもの反応・再挑戦率や、人間の教材監修完了は主張しない。
