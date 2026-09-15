# Content Bank Inventory — 基準と拡張後

## 承認後の確定状態

停止時Inventoryを再実行して一致を確認した後、承認された順序で拡張した。以下の初回調査記録は旧版の説明として保持する。現在の正本と件数は次表のとおり。

| Game | Canonical Bank | Current | Target | Shared? |
| --- | --- | ---: | ---: | --- |
| けいさんスプリント | mathSprint/mathContent.js → mathSprintGenerator.js | 120概念（136表示式） | 120 | インベーダーと共有 |
| けいさんインベーダー | 同じMATH_CONTENT / generateSessionProblems | 同じ120 | 120 | 別bankなし |
| えいたんご4たく | englishChoiceQuestions.js（旧20）＋englishContent.js（新100） | 120 | 120 | なし |
| 文ならべ | sentenceOrderQuestions.js（旧ID20）＋sentenceContent.js（新100） | 120 | 120 | なし |
| タイムことば | timedChoiceQuestions.js（旧20）＋timedContent.js（新100） | 120 | 120 | 防衛と7語だけ共通 |
| えらんで完成 | multiSelectQuestions.js（旧20）＋multiContent.js（新100） | 120 | 120 | なし |
| よみこみクイズ | asyncChoiceQuestions.js（旧20）＋asyncContent.js（新100） | 120 | 120 | なし |
| 漢字防衛隊 | kanjiDefenseContent.js（旧使用21）＋kanjiDefenseContent120.js（新99） | 120使用 / 旧golden24保持 | 120 | 4年生漢字IDを参照 |

パスは `src/minigames/` 以下。既存runtime exportとsession/choice参照方式を維持。Mathだけ固定canonical fixtureIdと旧表示variantを追加。各ジャンルの学習判定・Core/View・XPは変えない。

`scripts/audit-content-inventory.mjs` は固定commitを読み取るため、今後も旧Inventoryを再現する。現在の全件検査は `scripts/validate-content-120.mjs all`、現在の一覧・分布・simulationは `scripts/audit-content-120.mjs`。

---
## 以下は初回停止時のInventory（履歴）

基準：`child-playtest-candidate-1` → `a9cb2b294e68229b31805a46666d2249ff273ac3`。
調査ブランチ：`feature/content-bank-120`。開始HEADは基準と一致。releaseブランチとtagも同じhashで、変更していない。既存のFirebaseキャッシュ差分・未追跡の別実験資料・認証書はそのまま保持。

**教材追加前のInventory。120化は未着手。** 現行条件と120化が両立しない点、既存教材の修正承認が必要な点を下記に記録した。生成器の関数名や過去レポートより、実際のデータとCoreを正とする。

## 正本と件数

| Game | Canonical Bank | Current | Target | Shared? |
| --- | --- | ---: | ---: | --- |
| けいさんスプリント | `src/minigames/mathSprint/mathSprintGenerator.js` の有限集合 | 81式 | 120 | インベーダーと共有 |
| けいさんインベーダー | 同じ `generateSessionProblems` をimport | 同じ81式 | 同じ120 | 別bankを作らない |
| えいたんご4たく | `src/minigames/englishChoice/englishChoiceQuestions.js` / ENGLISH_CHOICE_FIXTURE | 20 | 120 | なし |
| 文ならべ | `src/minigames/sentenceOrder/sentenceOrderQuestions.js` / SENTENCE_ORDER_FIXTURE | 20 | 120 | なし |
| タイムことば | `src/minigames/timedChoice/timedChoiceQuestions.js` / TIMED_CHOICE_FIXTURE | 20 | 120 | なし。防衛との語の重なりはある |
| えらんで完成 | `src/minigames/multiSelect/multiSelectQuestions.js` / RAW_FIXTURE → MULTI_SELECT_FIXTURE | 20 | 120 | なし |
| よみこみクイズ | `src/minigames/asyncChoice/asyncChoiceQuestions.js` / RAW_FIXTURE → ASYNC_CHOICE_FIXTURE | 20 | 120 | なし |
| 漢字防衛隊 | `src/minigames/kanjiDefense/kanjiDefenseContent.js` / GOLDEN → LIMITED_UX_CONTENT | 実使用21、golden24 | 実使用120 | 本編のg4漢字IDを参照 |

## Schema / ID / 学習目標

| Bank | 元データとruntime ID | 正解・誤答 | カテゴリ／難易度 |
| --- | --- | --- | --- |
| math | `{a,b,operation,answer}`。固定教材IDなし。runtimeはsession:problem:N | 数値再計算、自由入力。不正数値は受理しない | addition-within-9 / subtraction-within-9。difficulty欄なし |
| english | `{id,prompt,meaning}`。problemIdに既存idを埋め込む。choiceId=meaning:id | 自分の意味が正解。他語の意味3つを抽選 | english.basicVocabulary.meaning。difficulty欄なし |
| sentence | fixtureId/prompt/chunks[{chunkId,text}]/correctOrder/skillId | 配列の完全一致だけ正解。自然な別順を許容する契約ではない | japanese.sentenceOrder.basic。3〜6文節、現行は4〜5。difficulty欄なし |
| timed | fixtureId/word/reading。promptは「『語』の よみは？」、choiceId=reading:id | 漢字語の読みを4択。他語の読み3つが誤答 | kanji.vocabulary.reading。**一般語彙知識や読解ではなく読み**。5秒はCoreのまま |
| multi | fixtureId/prompt/choices[{choiceId,text}]/correctChoiceIds/skillId | 現行5択中3正解。IDはfixtureId:素材id | 季節・動物・都道府県・品詞・物質・宇宙・英語過去形・エネルギー。difficulty欄なし |
| async | fixtureId/prompt/choices/correctChoiceId/skillId | 現行4択、正解1ID | 理科・算数・社会・国語・英語の短い知識問題。**読解本文はない**。difficulty欄なし |
| defense | fixtureId/prompt/acceptedReadings/focusKanjiIds/meaning/hint/skillId | 正規化した許容読みとの一致。未許可の読みを推測で足さない | kanji-reading-g4。kd-g4-NNNとg4-NNNの現行契約 |

英語のmeaningは文脈を限定しない簡単な訳。新語の同義訳や同じ読みを足すとランダム誤答が実質正解になる危険がある。IDだけ除外する現行distractor生成を、教材の意味・読み重複も含めて監査する必要がある。

## Sampling / Validation / Runtime

- math：加算36式（a=1..8、b=1..9-a）と減算45式（a=1..9、b=1..a）。各集合をFisher–Yatesし5問ずつ、全10問を再shuffle。全正答は0..9。単一共有生成器、通信なし。既存テストもoperand/answer範囲と5対5を固定している。
- 既存mathの重複単位は順序付き `(a,operation,b)`。3+5と5+3は別式として出題する。式として81、交換法則でまとめた学習概念として65（加算20＋減算45）。追加時も両指標を併記し、交換だけの大量水増しはしない。
- english/timed：bank全体をshuffleして10問。誤答もbankから3問、4択の表示順をshuffle。乱数・session引数検証あり。意味の一意性や日本語の正しさは自動では保証しない。
- sentence：20件から10件。文節をshuffleし、最初から正答配列なら一度rotate。文節ID・置換の整合はCore/既存テストで確認するが、自然な別解は判定しない。
- multi：全体から10問、5択の順序をshuffle。部分点は `max(0,TP*誤答数-FP*正答数)/(正答数*誤答数)`。正答集合以外に**誤答が1つ以上必須**。全選択肢正解は「乱発しない」以前に現行score関数が拒否する。正答集合全選択=1、全選択=0を現行20問で検証済み。
- async：`loadAsyncChoiceFixture` は内蔵fixtureをPromiseで返す（remote読解ファイルではない）。AbortSignal、prepare側で最低10件・fixtureId重複・選択肢3〜4・正答ID参照を検証。Coreの世代番号/cancellation/再試行を保持する。
- defense：GOLDEN24から003「以下」/004「位置」/011「結果」を既存のHuman Content Review待ちとして除外→21から12をshuffle。除外3問を99問の追加数へ数えたり勝手に復帰させない。既存12モンスターは教材件数と別。Content変更はPhase B/Cで明示再認証し、Core/Viewは不変。
- defense正規化：NFKC、前後/内部空白除去、カタカナ→ひらがな。送り仮名は「覚える」→「おぼえる」のように表記全体。validatorは12件以上、ID形式、prompt最大12文字、acceptedReadingsの非空ひらがな/正規化重複、focus ID形式等を確認。ただしfocus IDの実在・文字との対応は追加の参照照合が必要。
- bankの元配列はバンドルに静的import。ロガー・育成・表示・音・本編を変更する必要はない。samplingは既存random注入を使用できる。

## 文字数の実測（Unicode code point）

| 対象 | 最小 | 中央値 | 最大 |
| --- | ---: | ---: | ---: |
| 英単語 | 3 | 4 | 7 |
| 日本語訳 | 1 | 2 | 4 |
| 文ならべ完成文 | 18 | 23 | 27 |
| タイムことばの漢字 | 2 | 2 | 2 |
| タイムことばの読み | 3 | 4 | 5 |
| 複数選択の問題 | 9 | 13 | 23 |
| 複数選択の選択肢 | 1 | 3 | 7 |
| よみこみの問題 | 7 | 10.5 | 16 |
| よみこみの選択肢 | 1 | 2 | 6 |
| 防衛の実使用語 | 2 | 2 | 3 |

新規timedは原則2字の語と3〜5字の読みを基準にする。よみこみを長い読解本文に置き換えるのは学習目標変更になるため行わない。長い選択肢や文章の390×844確認は追加後に行うもので、今回は未実施。

## 先に判断が必要な点

1. **現在の計算範囲の全組合せは81しかない。** 120式には数値範囲の拡張が必要。IDや表記変更では増えない。20以内の非負整数の加減算への拡張を提案するが、within-9という既存教材契約・テスト期待値を無断変更しない。
2. **既存文ならべの保持と自然な唯一解の条件が衝突する。** library-bookとmorning-birdで自然な別順をCoreに送信し不正解になることを実再現した。既存を残したまま100問足しても、この重大な曖昧性は解消しない。ID保持の改稿には承認が必要。
3. よみこみ `oxygen` は「呼吸で取り入れる」だけでは窒素も該当する。限定表現への改稿提案を別紙へ記載。その他の全文意味レビューも承認後に行う。

## 再現

`node --experimental-default-type=module scripts/audit-content-inventory.mjs`

出力：`artifacts/content-120/inventory.json`。実生成器600セッションで81式／65概念、算数の正答再計算、既存bankのロード、複数選択score、文ならべ別解拒否を確認。600は有限集合監査用であり、拡張後の60セッション評価ではない。
現在は必要条件の確認待ち。20→40の新規投入、120件review packet、拡張後sampling/ブラウザ認証はまだ行っていない。
