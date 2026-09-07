# 漢字ヨミタビ Tutorial非同期開始の所有権修正

実施日：2026-09-06（JST）。対象は `main`、HEAD `d58c4ce116ba4b029de5fb36ebfb4629ed5a89f6` と開始時の未コミット・未追跡変更を含む作業ツリー。

**FINAL-QA-02を製品修正前に正式テストで再現し、同じ漏れを実行確認した計5画面を修正した。現在存在する12画面のTutorial開始経路をMatrixで検証し、54件PASS。指定4スイートは計268件PASS、build成功。** 本書は実装・検証報告であり、CODE GO判定は行わない。

`YOMITABI_CODE_GO_DECISION.md` を全文確認した。過去報告のFIXED／PASSを今回の実行結果の代用にしていない。開始前にgit status、branch、diffを確認・保存した。既存変更をreset／checkout／revert／cleanしていない。

**1. Tutorial呼び出し経路一覧**

`src/` の全96 JavaScriptファイルを検索し、TutorialManager、TutorialGuide、startIfNeeded、forceStart、createGuide、Tutorial関連参照と全dynamic importを確認した。dynamic importは21か所、うちTutorialの直接importは11か所。quickReviewPracticeの委譲を加え、開始元は12画面だった。以下の位置は修正後コード。

| 画面 | 開始経路・位置 | 修正前 | 修正後 |
| --- | --- | --- | --- |
| title | `src/screens/titleScreen.js:71` → startIfNeeded('title') | SAFE | SAFE |
| courseSelect | `src/screens/courseSelectScreen.js:49` → startIfNeeded('courseSelect') | SAFE | SAFE |
| regionSelect | `src/screens/regionSelectScreen.js:79` → startIfNeeded('regionSelect') | SAFE | SAFE |
| stageSelect | `src/screens/stageSelectScreen.js:284` → startIfNeeded('stageSelect') | SAFE | SAFE |
| battle | `src/screens/battleScreen.js:1075` → startIfNeeded('battle') | SAFE | SAFE |
| practiceBattle | `src/screens/practiceBattleScreen.js:149` → startIfNeeded('practiceBattle') | SAFE | SAFE |
| quickReviewPractice | 自身のthisでpracticeBattleへ委譲し、practiceBattleのTutorialを開始 | SAFE | SAFE |
| resultWin | `src/screens/resultWinScreen.js:140` → startIfNeeded('resultWin') | UNSAFE | SAFE |
| profile | `src/screens/profileScreen.js:339` → startIfNeeded('profile') | UNSAFE | SAFE |
| settings | `src/screens/settingsScreen.js:76` → startIfNeeded('settings') | UNSAFE | SAFE |
| kanjiDex | `src/screens/Dex/kanjiDexScreen.js:122` → startIfNeeded('kanjiDex') | UNSAFE | SAFE |
| monsterDex | `src/screens/Dex/monsterDexScreen.js:315` → startIfNeeded('monsterDex') | UNSAFE | SAFE |

指定されたplayerNameInput、continentSelect、およびworldStageSelect、proverbDexにはTutorial開始予約がない。achievements、gameOver、gradeQuiz、loading、menu、monsterCapture、result、reviewStage、stageLoading、statusにも同予約はない。名前にTutorialを含む `screens/tutorialScreen.js` と `screens/tutorialBattle.js` は空ファイルで、実行される開始処理はない。

共通内部経路は `TutorialManager.startIfNeeded / forceStart → _start → TutorialGuide.createGuide`。Manager以外にcreateGuideの直接呼出し元はなく、forceStartの外部呼出し元も見つからなかった。`sessionTimer.startIfNeeded` は利用時間計測でありTutorialではない。保存処理のtutorialフラグは設定・既読情報であり、開始予約ではない。

**2. SAFE／UNSAFE分類と修正前の実行確認**

SAFEは入場世代とactiveを検証するlifecycle guardを持つ経路、UNSAFEは離脱済みの非同期完了でも開始できる経路、SYNC_SAFEは非同期の開始予約を持たない経路として分類した。予約自体がない画面はSYNC_SAFE（開始経路なし）、Manager／Guideの同期構築はSYNC_SAFEとする。Guideの後続レイアウト待ちは第19項で区別する。

製品コード変更前に「SAFE 7画面、UNSAFE 5画面、指定されたその他画面は開始予約なし」と簡潔に報告した。その後、UNSAFEの5画面すべてで実enter → Tutorial import受渡し保留 → 実exit → 次guide設置 → import完了を実行した。静的推測だけを理由に変更していない。

| 修正前の実行画面 | 離脱済み開始 | overlay追加 | 次guide破棄 | 観測ゲーム状態変更 |
| --- | ---: | ---: | ---: | ---: |
| resultWin | 1 | 1 | 1 | 0 |
| profile | 1 | 1 | 1 | 0 |
| settings | 1 | 1 | 1 | 0 |
| kanjiDex | 1 | 1 | 1 | 0 |
| monsterDex | 1 | 1 | 1 | 0 |

修正後は全5画面で上記4値が0。現在検索で見つかったTutorial開始経路にUNKNOWNは残っていない。この分類はTutorial非同期開始についての分類であり、各画面の全機能の安全認証ではない。

**3. FINAL-QA-02の根本原因**

旧resultWinはdynamic importのthenから無条件にstartIfNeededを呼んでいた。exitによるcanvas参照・イベント解除は、登録済みPromise callbackを無効化しない。旧callbackは離脱後もManagerへ到達し、Managerの `_start` が現guideをdestroyしてから新しい全画面overlayをbodyへ追加する。canvas=nullのときも開始でき、再入場時にはcanvasが再設定されるため、canvasの有無だけでは旧世代を識別できない。

さらにresultWinにはimport予約前の `await checkAchievements()` がある。importだけを現在のlifecycle.guardで包むと、このawaitの古い継続が再入場後の新世代guardを取得する余地がある。そのため、enter冒頭で世代を取得し、await後にもその同じ世代の有効性を検査する必要があった。

**4. 修正した画面**

resultWin、profile、settings、kanjiDex、monsterDexの5画面に、既存の `createScreenLifecycle` による所有者、enter冒頭のactivate、Tutorial import callbackのguard、exit冒頭のdeactivateを追加した。

resultWinのみ、enter冒頭の `entryGeneration` を保持し、実績チェックawait後に `active && generation === entryGeneration` を確認する。無効な入場の継続はTutorial予約へ進まない。画面固有UI、ゲームルール、Tutorialの文章・配置は変更していない。

**5. 修正しなかった画面と理由**

title、courseSelect、regionSelect、stageSelect、battle、practiceBattle、quickReviewPracticeは既存の世代保護を確認し、実行でも離脱・再入場の両順序を通過した。battleは入場所有者を作り、practiceは予約前に取得した同じ所有者を親enterへ渡す。quickも自身のthisでこの経路を通る。所有者を追加で置き換える変更は不要だった。

第1項の開始予約を持たない画面は変更していない。screenLifecycle、TutorialManager、TutorialGuide、tutorialDataも変更していない。Managerへ到達する前に呼出し元の所有権を確認する既存設計で対処でき、大規模な共通基盤追加は必要なかった。

**6. 共通化した所有権ルール**

各enterは独立した世代を持ち、exitはその世代を無効化する。Tutorialの予約callbackは予約時の世代を閉じ込め、完了時のactiveと世代が一致するときだけstartIfNeededを呼べる。再入場でactiveが戻っても、世代が異なる古いPromiseは実行できない。

先行awaitがある場合もenter開始時の世代を維持し、await後に確認してから予約する。旧世代はManager自体に到達しないため、現在guideのdestroyやoverlay追加も起こさない。import通信そのもののキャンセルは要件とせず、完了結果の適用を制御する。

**7. resultWin修正前FAIL**

正式回帰テスト `tests/no-go/tutorial-navigation-matrix.test.mjs` の先頭2件を製品修正前に追加・実行し、**0 PASS／2 FAIL、終了1**を得た。

実FSMでresultWinへ入り、実enterがimport予約・クリック購読へ到達した後に、実updateの「ステージ選択へ」描画を確認。内部座標(400,505)に対応するCSS座標でclickをdispatchし、実resultWin.exit → 実stageSelect.enter／update、resultWin.canvas=nullを確認してから旧importを完了した。

| 修正前条件 | 旧result開始 | overlay追加 | 現stage guide破棄 | 最終overlay |
| --- | ---: | ---: | ---: | ---: |
| stage既読、共有module結果を登録順で両画面へ受渡し | 1 | 1 | 0（現guideなし） | 1 |
| stage未読、実stage guideを先に開始してから旧result完了 | 1 | 1 | 1 | 1（旧result） |

両方とも実遷移後の期待0に対するアサーションで失敗した。前者ではposition=fixed、100vw×100vh、zIndex=100002、pointerEvents=autoの旧overlayを観測した。後者では実stage guideの同一性も失われた。

続けて、製品修正前のMatrixを54件へ展開し、**34 PASS／20 FAIL**。FAIL内訳はこの2件、UNSAFE 5画面の離脱・再入場両順序15件、resultWinのimport前await離脱・再入場3件。正常開始の正例と既存SAFE経路は通過した。

**8. resultWin修正後PASS**

| 修正後CASE A | 旧開始 | 旧overlay追加 | 現guide破棄 | 観測ゲーム状態変更 |
| --- | ---: | ---: | ---: | ---: |
| 実FSMでstageSelectへ離脱、stage既読 | 0 | 0 | 0 | 0 |
| 実FSMでstageSelectへ離脱、実stage guideを先に開始 | 0 | 0 | 0 | 0 |

前者の最終overlayは0。後者は現在のstage guideとそのoverlay 1個を保持する。旧resultWinはstartIfNeededへ進まない。第7項の正式2テストがともにPASSした。

**9. 再入場race結果**

各画面で実enter #1 → import #1保留 → 実exit → 実enter #2 → import #2保留を実行した。以下は両Promiseの完了直後ごとにも確認した結果。

| 画面 | #1→#2 | #2→#1 | 旧世代開始／旧overlay追加／旧世代の現guide破棄 | 現世代開始／overlay総追加・最終数 |
| --- | --- | --- | --- | --- |
| title | PASS | PASS | 0／0／0 | 1／1・1 |
| courseSelect | PASS | PASS | 0／0／0 | 1／1・1 |
| regionSelect | PASS | PASS | 0／0／0 | 1／1・1 |
| stageSelect | PASS | PASS | 0／0／0 | 1／1・1 |
| battle | PASS | PASS | 0／0／0 | 1／1・1 |
| practiceBattle | PASS | PASS | 0／0／0 | 1／1・1 |
| quickReviewPractice | PASS | PASS | 0／0／0 | 1／1・1 |
| resultWin（CASE B） | PASS | PASS | 0／0／0 | 1／1・1 |
| profile | PASS | PASS | 0／0／0 | 1／1・1 |
| settings | PASS | PASS | 0／0／0 | 1／1・1 |
| kanjiDex | PASS | PASS | 0／0／0 | 1／1・1 |
| monsterDex | PASS | PASS | 0／0／0 | 1／1・1 |

resultWinではさらにimport前の実績チェック結果受渡しを保留し、離脱のみと再入場の両完了順も検証した。離脱のみでは旧継続のimport予約0、再入場では現世代の予約1／開始1／overlay1。旧継続が新世代の所有権を取得することも防止した。

**10. 正常Tutorial開始結果**

全12画面で、Tutorial有効・未閲覧の実enterから離脱せずimportを完了すると、その画面の実Tutorialが1回開始し、実Guideが最初の説明見出しとoverlayを構築した。保留Promiseの再resolveでも追加開始はない。quickReviewPracticeのTutorial IDは既存仕様どおりpracticeBattle。

resultWinのCASE Cも開始1／overlay1。既存のanchor参照エラーに対するGuideの代替位置表示は発生しているため、ここでのPASSは開始・説明構築・所有権についてであり、期待位置への強調表示の合格ではない。詳細は第19項。

**11. Tutorial Navigation Matrix結果と検証範囲**

**54 PASS／0 FAIL**。正常入場と離脱前完了をまとめた正例、離脱後完了、exit再入場の旧→新、新→旧を12画面共通形式で実行した48件に、実FSMのFINAL-QA-02 2件、呼出し元の棚卸し整合1件、resultWinの先行await 3件を加えた。

各画面の実enter／exit、実Manager.startIfNeeded／_start／_destroy、実Guide.createGuideを実行する。loaderはTutorial dynamic importの実module結果の受渡しだけを保留し、製品callbackとguardはそのまま使う。実績チェック用の追加試験も実checkAchievementsを呼び、結果の受渡しだけを保留する。画面初期化そのものを成功stubへ差し替えていない。

旧世代のstartIfNeeded到達0、開始0、overlay追加0、現guide破棄0を検査した。overlayは残存数だけでなくbody.appendChildの総追加回数も計測するため、一度追加してすぐ消した場合も見逃さない。新guideのオブジェクト同一性も確認する。画面状態比較はstage、grade、name、問題、敵、playerStats、正誤リスト、進行、turn、入力可否、正規save原文を対象とする。全グローバル書込みの網羅を意味しない。

DOMはEventTargetと要素ツリー、Canvasは描画呼出しの記録、Storageは既存のメモリhelper、教材は現在のローカルJSONを使用する。タイマー・rAF・Image・IntersectionObserverの配信を制御する。innerHTML解析、実ブラウザーのレイアウト・重なり・物理タップは再現していない。棚卸しテストは新しいTutorial import元が追加された際に、Matrixへの追加漏れを検出する補助であり、あらゆる別名・計算文字列の静的検出を保証するものではない。

検証整備中のログも保持した。最初の拡張実行では既存centerBox例外を発見し、正確な既知エラーだけを区別して再実行した。製品修正直後の54件中1件は、実績計算自身の正当なsave更新までsnapshot差分に含めて失敗した。実績計算完了後・enterへの結果受渡し前にsnapshotを採るよう隔離を修正し、Tutorial継続の状態不変assertを維持した。保存ロジックの変更や期待値の緩和で通したものではない。

**12. FINAL-QA-01再検証**

既存 `tests/no-go/navigation-tutorial.test.mjs` の19件を再実行してPASS。指定Aの日本編選択→exit→regionSelect相当、指定Bの実name入力→実FSMのcourseSelect→世界編選択→実continentSelect→旧import完了を含む。旧course開始、旧overlay追加、現guide破棄、観測状態変更はいずれも0。再入場両順序、正常開始、既読／無効設定、title／regionSelect／stageSelectの重要条件もPASS。

加えて今回のMatrixでcourseSelect、regionSelect、stageSelect、titleの実enter／exitと実Guideを実行し、現在コードの所有権を再確認した。

**13. REAUDIT-01／REAUDIT-02再検証**

REAUDIT-01：既存 `entry-lifecycle.test.mjs` の10件がPASS。practice／quickの離脱後Tutorial・bonus背景完了、再入場順序、battleの離脱時タイマー・rAF・levelUp処理と正常動作を確認。今回のMatrixでもbattle／practice／quickそれぞれ4条件を実行し、旧開始0・旧追加0・現guide破棄0、正常開始1を確認した。

REAUDIT-02：現行loadingテストを再実行。正常grade7、503失敗、旧grade6代用の対照に同じ失敗oracleを適用する条件がPASS。正常と旧代用の子プロセスは意図したAssertionError・終了1となり、親テストが `failed curriculum must not be a success` を検証する。別原因のtimeoutを成功証拠にしていない。

**14. NEW-01〜NEW-06結果**

| ID | 再実行した重要条件 | 結果 |
| --- | --- | --- |
| NEW-01 | 実practice入力で誤答→2,200ms→正答、待機中と正答直後の連打。誤答1／正答1、revealed、次問予約1、1,100ms後の入力復帰 | PASS |
| NEW-02 | 完了時の空Enter続行、終了クリック、通常空欄拒否、余分な回答記録なし、実updateで両操作を描画 | PASS |
| NEW-03 | battle攻撃／回復×正答／誤答に保存Quota注入。原文・リスト保持、入力復帰、予約0、解除後の同問題再試行で記録・save各1 | PASS |
| NEW-04 | 実quiz handlerのQuota失敗→解除→再送。失敗時answers／stats／予約0、成功時回答1／保存1／次問予約1 | PASS |
| NEW-05 | 実reviewの390px表示、戻る5点・回答5点、44 CSS px目標、composition中の回答抑止 | PASS |
| NEW-06 | grade7正常313件、88通常面のpool集合一致、503・不正JSON・reject、fetch／本文保留、到達後9,999ms未完了→10,000ms期限、abort、遅い完了無視、正常化再試行 | PASS |

これらは現行の重要テストを読み、今回実行したログによる結果。過去の独立実験すべてを新規に作り直したという意味ではない。

**15. E01／E02結果**

E01：元スロット退避Quota、不正行先、復元・スロット番号書込み失敗、正常1→2→1、復旧journalをphase-aで再実行し、元セーブと現スロットの保持を確認した。P0再発なし。

E02：破損JSON原文保持、未知版・空／不正backup拒否、明示import、原本退避失敗、復元mirror失敗、復旧journalを再実行した。no-goの復旧拒否・離脱・期限切れもPASS。P0再発なし。実Firebaseや実端末のStorage強制終了試験は含まない。

**16. 全テスト結果・再実行方法**

| 実行 | PASS | FAIL | 終了コード |
| --- | ---: | ---: | ---: |
| `npm.cmd run test:phase-a` | 86 | 0 | 0 |
| `npm.cmd run test:phase-b` | 22 | 0 | 0 |
| `npm.cmd run test:phase-c` | 17 | 0 | 0 |
| `npm.cmd run test:no-go` | 143 | 0 | 0 |
| 指定4スイート合計 | **268** | **0** | — |
| Matrix単独（上記no-goにも含まれる） | 54 | 0 | 0 |

全実行のcancelled／skipped／todoは0。Matrix54件はno-goの143件に含むため、合計へ二重計上していない。既存no-go 89件は維持した。

```powershell
node --experimental-default-type=module --test tests/no-go/tutorial-navigation-matrix.test.mjs
npm.cmd run test:phase-a
npm.cmd run test:phase-b
npm.cmd run test:phase-c
npm.cmd run test:no-go
```

証拠保存先：

```text
C:/Users/socce/AppData/Local/Temp/yomitabi-tutorial-fix-70a8304f7a3d4276b2a01f45b3ae02b6/
```

`result-before.log`、`matrix-before.log`、`matrix-after-final.log`、4スイートのlog、`build.log`、全Tutorial／dynamic import検索結果、開始時diff・status、前後SHA-256を保存した。整備途中の `matrix-initial.log` と `matrix-after.log` も残した。OS一時領域の保存期間は保証されないが、回帰テスト本体はリポジトリ内に追加してある。修正前FAILはその時点の実行記録であり、現在コードで再実行すればPASSする。

**17. build結果**

`npm.cmd run build -- --outDir C:/Users/socce/AppData/Local/Temp/yomitabi-tutorial-fix-70a8304f7a3d4276b2a01f45b3ae02b6/dist` は終了0。Vite 5.4.19、5.94秒。main 523.94kB／gzip 156.71kB、Tutorial別chunk 9.34kB／gzip 4.42kB。既存distを上書きしていない。

CJS API、static／dynamic import混在、500kB超chunkの警告は残る。今回のbuild失敗はない。設定・依存関係を変更していない。

**18. 今回の変更ファイル・既存変更の保全**

| ファイル | 今回の変更 |
| --- | --- |
| `src/screens/resultWinScreen.js` | lifecycle追加、先行awaitの世代検査、Tutorial guard、exit無効化 |
| `src/screens/profileScreen.js` | lifecycleによるTutorial開始保護 |
| `src/screens/settingsScreen.js` | 同上 |
| `src/screens/Dex/kanjiDexScreen.js` | 同上 |
| `src/screens/Dex/monsterDexScreen.js` | 同上 |
| `tests/no-go/tutorial-navigation-matrix.test.mjs` | 新規。54件の正式回帰テスト |
| `tests/no-go/helpers/tutorial-navigation-fixture.mjs` | 新規。実画面・実Guideの観測と共通fixture |
| `tests/no-go/helpers/tutorial-navigation-loader.mjs` | 新規。実import等の結果受渡しを保留 |
| `tests/no-go/helpers/tutorial-navigation-dom.mjs` | 新規。DOM／Canvas試験用要素 |
| `YOMITABI_TUTORIAL_LIFECYCLE_FIX.md` | 新規。本報告書 |

開始時のsrc／tests／public/dataと主要設定等164ファイルをSHA-256で比較し、差分は上記の製品5ファイルだけだった。既存テスト・教材・設定等の他159ファイルは一致した。5ファイルのHEADとの差分には開始前からのUI・保存等の変更も含まれるため、それらを今回の変更として数えていない。今回加えた内容は開始時diffと対照した。`git diff --check` は終了0（既存の改行形式警告あり）。過去監査・最終判定の文書を変更していない。

**19. 残存するTutorial関連リスク**

`src/tutorial/tutorialData.js:81` のresultWin anchorは未定義の `centerBox` を参照する。GuideがReferenceErrorを捕捉して代替矩形で表示する既存問題であり、画面に留まった正常開始でも発生する。今回のUI・配置変更の範囲外として残した。テストでは `Tutorial anchor error:` と `ReferenceError: centerBox is not defined` の組合せだけを既知fallbackとして別記し、TAP診断に回数を出す。他のconsole.errorやalertは失敗扱いのままで、Guideをstubに置き換えていない。

今回閉じたのは、検索で見つかった現在の呼出し元による「古い非同期開始が現画面に適用される」経路である。すでに開始済みのguideを外部遷移時に自動終了する一般契約、Guideのレイアウト再試行rAFの破棄時キャンセル、dynamic import失敗時の案内・再試行は追加していない。現行Guideの再試行は既存要素の位置更新で、新規Tutorial開始やoverlay再追加の経路ではない。

resultWinの実績計算自体の保存作用をキャンセルする変更もしていない。今回追加した先行await検査は、離脱済みenterの継続が新たなTutorial予約やその後の画面初期化へ進むことを防ぐ。今後、先行awaitや別の開始元を追加する場合にも同じ所有権ルールと実行試験が必要。

**20. 実機でのみ確認可能な事項**

実iPad／iPhone／Androidの表示・物理タップ・向き変更・キーボード、実IMEのイベント順序、実Storage制約と強制終了、実Firebaseの復旧・競合・アクセス制御、公開環境でのchunk配信と更新・旧SW、実際の子どもの試遊、音の実聴、全教材の人的校閲は未確認として分離する。Node上で順序を制御した結果を、実端末上の頻度や操作性の測定結果とは扱わない。

今回の作業はTutorial lifecycle修正とその検証・報告まで。CODE GO判定、PROMPT、Stable Baseline、3D化には進んでいない。
