# 漢字ヨミタビ 独立QA 最終CODE GO判定

**最終判定：CODE NO-GO**

監査日：2026-09-06（JST）。対象：HEAD `d58c4ce116ba4b029de5fb36ebfb4629ed5a89f6` に、監査開始時の未コミット・未追跡の実装とテストを含めた現在の作業ツリー。

**FINAL-QA-01の指定A／B、再入場の両完了順、正常Tutorial開始は、独立実行で合格した。** battle／practiceBattle／quickReviewPracticeの以前の所有権漏れも再発しなかった。しかし、重点確認対象battleに直接隣接する **resultWin → stageSelect** で、同じ未保護のTutorial予約によるP1を再現した。離脱済みの結果画面が、現在のステージ選択に全画面overlayを追加する。

既存214 PASSと今回の独立重点検査44 PASSだけで全体合格にはしない。隣接経路の独立検査2件は、実遷移成功後の対象アサーションでFAILした。このコード上の残件を解消して再判定するまで、PROMPTのStable Baseline工程へ進める判定にはしない。

実iPad／iPhone／Android、実IME、実Firebase、公開環境、子どもの試遊、音の実聴、全教材の人的校閲が未確認であることは、CODE NO-GOの理由にしていない。

**監査方法・原本保持**

- 指定の `YOMITABI_QUALITY_AUDIT.md`、`YOMITABI_V1_REGRESSION_AUDIT.md`、`YOMITABI_NO_GO_REAUDIT.md`、`YOMITABI_CODE_GO_FINAL_AUDIT.md`、`YOMITABI_FINAL_QA01_FIX_REPORT.md` を読み、症状・完了条件・変更範囲を確認した。「FIXED」「PASS」の記載や過去ログは今回の合格証拠にしていない。
- 現行の画面enter／exit、FSM、入力購読、lifecycle、TutorialManager／TutorialGuide／tutorialData、関連する保存・教材処理と現行テストを確認し、Node.js v22.14.0で再実行した。
- 今回の独立シナリオ、DOM／Canvas／時計fixture、ESM loaderはOS一時領域に作成した。メモリStorageには現行テストの共通helperを再利用した。修正担当者が追加したnavigationテストだけに依存せず、別のシナリオと観測を実行した。
- 独立loaderが変えるのは、実Tutorial dynamic import結果の受渡しを保留する境界だけ。製品のguard、画面遷移、startIfNeeded、_start、guide構築・破棄の処理はそのまま実行した。観測用ラッパーも実処理を呼ぶ。
- Storageは架空データ、DOMはEventTarget等の代用品、Canvasは描画APIの呼出し記録。実ブラウザーの描画・重なり判定・物理タップの測定ではない。ネットワーク上の発生頻度や遅延秒数も測っていない。
- `src/`、`tests/`、`public/data/`と主要設定等、計164ファイルの開始・終了時SHA-256差分は0。製品コード、既存テスト、教材を変更していない。buildは一時出力先を使用し、既存distを上書きしていない。リポジトリに追加した成果物は本書のみ。

**1. FINAL-QA-01再注入：A／Bとも合格**

Canvas内部800×600、表示矩形left=13／top=27／width=390／height=700。containのCSS座標を検査側で計算し、Canvasへ登録された実クリック購読にイベントを送った。courseの入場直後350msの抑止を越える400msを進めた。

| 条件 | 旧course Tutorial開始 | 旧overlay追加 | 現guide破棄 | 現画面の観測状態変更 |
| --- | ---: | ---: | ---: | ---: |
| A：実course.enter → import保留 → 日本編クリック → 実exit → regionSelect相当 → import完了 | 0 | 0 | 0 | 0 |
| B：実name入力 → 実FSMのcourseSelect → import保留 → 世界編クリック → 実continentSelect.enter／update → import完了 | 0 | 0 | 0 | 0 |
| B追加：同じ実FSM経路で、現画面guide保護の観測用guideを置く | 0 | 0 | 0 | 0 |

AはregionSelect遷移イベントとcourse.canvas=nullへの到達を確認してから、次画面相当の状態とguideを置いた。保留解除後もguideのオブジェクト同一性を保持した。

Bは実name.enterで作られた入力欄へ「そら」を設定し、DOMのkeydown Enterをdispatchした。実入力購読から名前を保存し、正規saveのplayer.nameとgameStateの双方で「そら」を確認。実FSMがcourse.exitを呼び、continentSelectを現画面としてupdateした後に旧importを完了させた。元々guideがない条件でもTutorialManager._destroyの呼出しは0。観測用guideを置く追加条件でも破棄0だった。

Bの現画面・canvas同一性・camera状態を保持し、完了後に実大陸選択ハンドラーへアジア位置をクリックすると、isZooming=true／zoomTarget.name='アジア'となった。これは現ハンドラーの動作確認であり、物理タップの認証ではない。

状態比較にはstage、grade、名前、現在問題、敵配列、playerStats、正誤リスト、進行、turn、入力可否、正規save原文を含めた。BではcameraとFSMの現画面も比較した。「変更0」はこれらの観測対象についての結果で、全グローバル変数の全書込みを網羅したという意味ではない。DOM追加・guide破棄は別途観測している。

**2. courseSelect再入場race：両完了順で合格**

実course.enter世代1 → 実exit → 実course.enter世代2を実行し、2つのimport予約への到達を確認した。

| Promise完了順 | 世代1開始 | 世代2開始 | overlay総追加数 | 最終overlay数 | 新guideへの旧世代干渉 |
| --- | ---: | ---: | ---: | ---: | --- |
| 旧 → 新 | 0 | 1 | 1 | 1 | なし |
| 新 → 旧 | 0 | 1 | 1 | 1 | なし。同一guideを保持 |

各完了直後にもoverlay数が最大1であることを確認した。旧世代はstartIfNeededへの到達自体が0。overlayを追加してすぐ消した場合を見逃さないよう、残存数だけでなくbody.appendChildを通った総追加数を数えた。

現行courseの根拠は `src/screens/courseSelectScreen.js:12` のactivate、`:49` のguard、`:143` のdeactivate。`src/core/screenLifecycle.js` のguardは予約時generationを保持し、activeとgenerationの双方を検査する。再入場でactive=trueに戻っても旧予約は通らない。

**3. 正常Tutorial：未閲覧ユーザーへ1回開始**

courseSelectに留まり実importを完了させると、実courseSelect Tutorial開始1、実overlay追加1／残存1を確認した。同じPromiseへの再resolveでも追加されない。全Tutorialを止めて異常系を通している実装ではない。

さらに、course既読時とtutorialEnabled=0では開始0。これらでは現世代のstartIfNeededには到達し、製品の既読／設定判定によって抑止されることを確認した。

**4. Tutorial依存経路の重点確認と隣接調査**

| 経路 | 独立実行した条件と結果 |
| --- | --- |
| battle | 実enter／exit後の遅いTutorialで開始・追加・次guide破棄・観測状態変更が全て0。再入場2世代の両順序、現世代正常開始も合格 |
| practiceBattle | 同上。通常練習ではquickReviewTargetsを設定せず、通常練習の実入場を通した |
| quickReviewPractice | 同上。入場するステージの実pool内のIDを復習対象に指定し、実quick → practice → battleの委譲を通した |
| 上記3画面の3世代 | 旧→中→新、新→中→旧、中→旧→新。各回の所有者3個は別物、activeはfalse／false／true。現世代のguideだけ1、旧世代の開始0 |
| practice／quickのbonus背景 | 実bonus入場でImage取得へ到達し、exit後にonload完了。次画面背景マーカー保持、旧Tutorial追加0 |
| battleの予約処理 | 実誤答・levelUpでtimeout／rAF／interval生成を確認。実exitで全解除、transform復元。捕捉済みtimeout／rAFを後から呼んでも次画面snapshot不変 |
| courseSelect | 前節A／B、再入場両順序、正常開始、設定・既読の独立実行で合格 |
| regionSelect／stageSelect | 同じ選択導線の隣接画面。現行guardを確認し、実離脱、再入場両順序、現世代正常開始で合格 |
| title | courseの戻り先。既存guardを対照として同じ離脱・再入場・正常開始を独立実行し合格 |
| resultWin → stageSelect | **同じ未保護の予約が残存。実害を再現。次節のP1** |

battleは入場時に所有者を作り、practiceは非同期予約前に取得した同一所有者を親enterへ渡す。根拠は `battleScreen.js:809`／`:823`、`practiceBattleScreen.js:90`／`:149`／`:161`。quickは自身のthisでpracticeへ委譲する。今回の独立実行でも、以前の所有者が置き去りになる症状は再発しなかった。

resultWinは `src/states/battleStateFactory.js:59` が直接遷移する勝利画面であり、resultWin自身のクリックからstageSelectへ戻る。重点対象と無関係な画面を無差別に調べたものではない。修正報告の「範囲外」という記載だけで安全とは判定せず、直接隣接するこの同一原因だけを追加実行した。profile／settings／図鑑にも未保護importがあることは静的に見つかったが、それらの実害を再現済みとは扱わず、本判定の根拠には加えていない。

**5. 公開阻止残件 FINAL-QA-02：P1 — 離脱済みresultWinのTutorialがステージ選択を覆う**

今回の識別子をFINAL-QA-02とする。FINAL-QA-01とREAUDIT-01の別呼出し元に残る同種の障害であり、今回の3画面修正が新たに作った回帰とは断定しない。

原因は `src/screens/resultWinScreen.js:134` のguardなしdynamic import callback。`:648` のexitはイベントと参照を解放するが、予約済み開始を無効化しない。遅いcallbackはcanvas=nullでも `TutorialManager.startIfNeeded('resultWin', ...)` へ進み、実tutorialDataが結果説明を返す。`TutorialManager.js:38` が既存guideを破棄し、`TutorialGuide.js:19` 以降の実コードがbodyへ全画面overlayを追加する。

**再現1：実FSM・実ステージ選択・共有importを登録順に完了**

1. 正常セーブ、Tutorial有効、resultWin未閲覧、stageSelect既読を用意する。ステージ案内は閲覧済みだが勝利案内はまだ、という設定。
2. 実FSMでresultWinへ入り、実績チェックを含む実enterが完了して実クリック購読とTutorial import予約へ到達したことを確認。Tutorial結果の受渡しだけを保留する。
3. 実updateが「ステージ選択へ」を描いたことを確認し、その実ボタン中央のCSS座標へclickをdispatch。
4. 実FSMによるresultWin.exit → stageSelect.enter／updateを確認。resultWin.canvas=null、overlay=0。
5. 結果画面とステージ選択が予約した同じTutorial moduleの結果を、登録順に同じ処理内で両方へ渡す。完了順逆転を前提にしない。
6. 現在のstageSelectを再updateして観測する。

```text
FSM現画面                 stageSelect
離脱済みresultWin開始     1
離脱後のoverlay追加       1
最終overlay数             1
観測ゲーム状態変更        0
overlay.position          fixed
overlay.width / height    100vw / 100vh
overlay.zIndex            100002
overlay.pointerEvents     auto
期待overlay追加           0
対象アサーション          1 !== 0（Node終了コード1）
```

stageSelectの既読判定は正常に働いて新しい案内を開始しないため、古い結果説明のoverlayが残る。次画面へ架空のguideは置いていない。FSMが正しい画面を指すことやゲーム状態が不変であることだけでは、bodyへ追加された入力遮蔽DOMを防げない。

**再現2：実新guideを開始してから旧resultWinを完了**

同じ実FSM経路でstageSelect未閲覧とし、stage側importを先に渡して実stageSelect guideを開始する。そのguideの実destroyを観測しつつ旧resultWin importを完了すると、旧開始1、追加overlay1、現stage guide破棄1、guide同一性喪失、最終overlay1となった。観測ゲーム状態変更は0。これも対象のoverlay追加アサーションでFAILした。

再現1を主証拠とし、再現2は新guideへの干渉を調べた制御された完了順の追加証拠とする。共通moduleの通信がその順序で自然に完了する頻度を主張しない。

**P1の理由：** 離脱済み画面の説明が現画面の主要操作を全画面要素で覆い、現在のguideがあれば破棄する。以前のFINAL-QA-01／REAUDIT-01と同じ判定基準。閉じれば戻れることは確認対象の重大性をP2へ下げる理由にはしない。セーブ消失P0や永久的な入力不能とは区別する。

再判定には、resultWinのこの予約を入場寿命・世代に所属させ、実離脱後の旧開始／DOM追加／現guide破棄を0にする必要がある。正常な現世代の勝利Tutorialと再入場両順序を維持し、今回合格した4重点画面へ回帰させないこと。今回は修正していない。

**6. 過去の阻害条件：今回の変更による回帰は検出せず**

Tutorial lifecycleは既存テストに加えて前述の独立実行を行った。それ以外は現行テストの内容・注入原因・アサーションを読んで再利用し、今回のログで結果を確認した。過去の独立実験を今回すべて再実行したという意味ではない。

| ID | 今回の確認と結果 |
| --- | --- |
| REAUDIT-01 | practice／quick／battleの独立実enter／exit、旧import、2・3世代、正常guide、bonus背景、battle予約解除で以前の所有権漏れの再発なし。結果画面の別漏れはFINAL-QA-02として分離 |
| REAUDIT-02 | 現行loadingテストの正常／503／旧grade6代用の対照を再実行。正常と旧代用は同じ失敗oracleに対してAssertionError・終了1となり、指定メッセージ `failed curriculum must not be a success` を親テストが検査。意図しないtimeoutのPASSではない |
| NEW-01 | 実練習の入力購読で誤答→2,200ms→正答、待機中・正答直後連打。誤答1／正答1、支援区分revealed、次問予約1、1,100ms後入力復帰。回帰なし |
| NEW-02 | 完了時空Enter続行、終了クリック、普通の空欄拒否、記録非増加、実updateで両選択の描画。回帰なし |
| NEW-03 | 攻撃／回復×正答／誤答にジャーナルQuotaを注入。失敗時原文・正誤リスト・combo保持、入力復帰、予約0。解除後同問題の記録・save各1。4経路合格 |
| NEW-04 | 実quiz handlerにQuota→解除→同問題再送。失敗時answers／stats／予約0、解除後回答1／保存1／予約1。回帰なし |
| NEW-05 | 実review.enter／update、390px表示の戻る5点と回答5点、44 CSS px目標、composition中の回答抑止を現行mobileテストで再確認。回帰なし |
| NEW-06 | grade7正常313件・88通常面の定義pool集合一致。503、不正JSON、明示reject、fetch／本文保留、対象到達後9,999ms未完了→10,000ms期限、grade7 abort、遅い完了の無視、正常化再試行。代用なし |
| E01 | phase-aの元スロット退避Quota、不正行先、復元途中失敗、番号書込失敗、正常1→2→1、復旧journalを再実行。元セーブ・現スロット保持。P0再発なし |
| E02 | 破損JSON原文保持、未知版拒否、空／不正型backup拒否、明示import、原本退避・復元ミラー失敗、復旧journalを再実行。no-go/recoveryの拒否・離脱・期限切れも合格。P0再発なし |

保存は現行saveSlotsの行先検証→storageTransaction、saveDataの検証・原本退避を確認した。loadingの失敗assertは対象URLへの到達、HTTP値、本文未読／解析エラーの同一性、他教材の完了、abortを検査している。旧代用の対照はfallback追加と最終catalog検証除去を組み合わせるメモリ上の変異であり、製品ファイルを書き戻さない。

**7. 今回の実行結果・再現資料**

| 実行 | 結果 |
| --- | --- |
| `npm.cmd run test:phase-a` | 86 PASS／0 FAIL |
| `npm.cmd run test:phase-b` | 22 PASS／0 FAIL |
| `npm.cmd run test:phase-c` | 17 PASS／0 FAIL |
| `npm.cmd run test:no-go` | 89 PASS／0 FAIL |
| 今回の独立重点検査 `independent.test.mjs` | 44 PASS／0 FAIL |
| 隣接結果画面 `adjacent-result.test.mjs` | **0 PASS／2 FAIL、終了1。FINAL-QA-02の2条件** |
| ステージID整合検査 | oldIdHits=0、参照整合OK、終了0 |
| `git diff --check` | 終了0。既存の改行形式警告あり |
| 一時出力先への本番build | 終了0、Vite 5.4.19、5.63秒。main 523.39kB／gzip156.61kB、Tutorial別chunk9.34kB |
| 原本SHA-256比較 | 164ファイル、差分0 |

各テスト実行のcancelled／skipped／todoは0。隣接検査の2 FAILは構文エラー・import失敗・fixture初期化失敗ではなく、所定の実画面遷移後に観測したoverlay追加1に対する期待0の失敗。後片付けでも予期しないconsole.error／alertがないことを検査した。

今回の証拠保存先：

```text
C:/Users/socce/AppData/Local/Temp/yomitabi-code-decision-7cbd8306a7b64fedb8d511e7302a482b/
```

`before-hashes.json`／`after-hashes.json`、`before-status.txt`／`after-status.txt`、4スイートのlog、`decision-loader.mjs`、`fixture.mjs`、`independent.test.mjs`／`independent.log`、`adjacent-result.test.mjs`／`adjacent-result.log`、`stage-integrity.log`、`diff-check.log`、`build.log`／`dist/`を保存した。OS一時領域のため永続保管は保証しない。

再実行例（現在の作業ツリーの製品モジュールを読む）：

```powershell
$qaDecision = 'C:/Users/socce/AppData/Local/Temp/yomitabi-code-decision-7cbd8306a7b64fedb8d511e7302a482b'
node --experimental-default-type=module --test "$qaDecision/independent.test.mjs"
node --experimental-default-type=module --test "$qaDecision/adjacent-result.test.mjs"
```

後者は今回のコードで2 FAILを返す。grade7の対照が意図的に出す失敗とは別の、製品残件の失敗である。

**Stable Baseline後の公開前検証として分離する事項**

実端末の表示・物理タップ・向き変更・キーボード、実IMEのイベント順序、実Storageと強制終了、実Firebaseの復旧・競合・アクセス制御、公開環境の配信更新・旧SW退役、子どもの操作理解、音の実聴、全教材の人的校閲は未確認。これらの未確認だけでCODE NO-GOにはしていない。ビルドのCJS／import混在／chunkサイズ警告も本判定の阻害根拠ではない。
