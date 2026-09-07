# 漢字ヨミタビ Tutorial 最終独立QA

**最終判定：CONDITIONAL CODE GO**

監査日：2026-09-06（JST）。対象：HEAD `d58c4ce116ba4b029de5fb36ebfb4629ed5a89f6` と、監査開始時の未コミット・未追跡変更を含む現在の作業ツリー。立場は独立QA。製品コード・既存テストは変更していない。

**今回の重点範囲で、現在のコードから再現できる公開阻止P0/P1は検出しなかった。FINAL-QA-02だけでなく、独立検索で確認した全12画面のTutorial非同期開始について、離脱済み処理によるoverlay追加・現guide破棄を検出しなかった。Stable Baselineへ進める。**

CONDITIONALとする理由は、resultWinの案内位置に既存のP2相当の不備が残ることと、実端末・公開環境の確認を別工程に残すため。これらをCODE NO-GOの理由にはしない。公開環境へのリリースを実施・承認したという意味ではない。

**1. 調査方法と独立性**

- 指定の `YOMITABI_CODE_GO_DECISION.md`、`YOMITABI_TUTORIAL_LIFECYCLE_FIX.md`、および品質監査、V1回帰監査、NO-GO再監査、最終コード監査と各修正報告の症状・原因・完了条件・依存範囲を確認した。過去のPASS／FIXED表記やログを今回の合格証拠にはしていない。
- `src/` の全96ファイルを独立検索した。`rg` が環境にないため、PowerShellの再帰ファイル列挙と `Select-String` を使用。TutorialManager、TutorialGuide、startIfNeeded、forceStart、createGuide、tutorial全般、全dynamic importに加え、画面のenter／exit委譲を追った。
- 現行のscreenLifecycle、各開始元のenter／exitと先行await、Manager／Guide／tutorialData、FSM、battleStateFactory、関連テストを確認した。全ソース・全教材の逐語校閲ではない。
- Node.js v22.14.0で、正式4スイートを今回再実行。その後、前回の独立QA用シナリオ44件とFINAL-QA-02の2件を現行コードで再実行し、今回独自に51件を追加実行した。
- 一時fixtureは前回の独立QA用fixtureを基に拡張した。DOM要素の代用品だけは、内容を確認した現行 `tutorial-navigation-dom.mjs` を再利用。今回の51件は実装担当者のMatrix本体・fixtureを呼び出していない。
- 独立ESM loaderは、実Tutorial importの結果受渡しと、追加試験における実checkAchievementsの結果受渡しだけを保留する。画面初期化、guard、Manager開始・破棄、Guide構築は実コードを呼び、成功stubへ置き換えていない。loaderはsrc内のTutorialManager importを検索して扱い、実装報告の画面ホワイトリストに依存しない。
- bodyへのoverlay総追加回数、startIfNeeded到達、実開始、現guideのdestroy、guide同一性を観測した。最終overlay数だけを見て、一度追加してすぐ消した不具合を見逃す判定にはしていない。
- Storageは架空データのメモリ実装、教材は現在のローカルJSON。DOM／Canvas／時計／Image／IntersectionObserverは制御可能な代用品。innerHTML解析、実ブラウザーのレイアウト・入力遮蔽の実測、物理タップ、ネットワーク遅延の発生頻度は測定していない。

**2. Tutorial呼び出し経路の独立棚卸し**

直接Tutorial importは11か所。quickReviewPracticeの委譲を加え、実行対象は12画面だった。src全体のdynamic importは21か所。実装報告に未掲載のTutorial開始画面は見つからなかった。通常battleにはbattleStateFactory経由の入場もあるため、下表に委譲元を補記する。

| 画面 | 現在の開始経路 | 所有権の静的根拠 |
| --- | --- | --- |
| title | titleScreen.js:71 → startIfNeeded('title') | enterでactivate、guard、exit:427でdeactivate |
| courseSelect | courseSelectScreen.js:49 → startIfNeeded('courseSelect') | enter:12でactivate、guard、exit:143でdeactivate |
| regionSelect | regionSelectScreen.js:79 → startIfNeeded('regionSelect') | enterでactivate、guard、exit:834でdeactivate |
| stageSelect | stageSelectScreen.js:284 → startIfNeeded('stageSelect') | enterでactivate、guard、exit:1218でdeactivate |
| battle | battleScreen.js:1075 → startIfNeeded('battle') | :809で旧所有者停止・新所有者作成、:823で選択、exit:3377で停止 |
| practiceBattle | practiceBattleScreen.js:149 → startIfNeeded('practiceBattle') | :90で所有者取得、:161で同一所有者を親へ渡す。exit:2535と親exitで停止 |
| quickReviewPractice | quickReviewPracticeScreen.js:113 → practice.enter.call(this) → 上記practice開始 | quick自身のthisで所有者を保持。exit:441からpractice.exit.call(this) |
| resultWin | resultWinScreen.js:140 → startIfNeeded('resultWin') | enter:44で世代取得、await後:78でactive＋同世代検査、guard、exit:655で停止 |
| profile | profileScreen.js:339 → startIfNeeded('profile') | enterでactivate、guard、exit:344でdeactivate |
| settings | settingsScreen.js:76 → startIfNeeded('settings') | enterでactivate、guard、exit:2139でdeactivate |
| kanjiDex | Dex/kanjiDexScreen.js:122 → startIfNeeded('kanjiDex') | enterでactivate、guard、exit:1105でdeactivate |
| monsterDex | Dex/monsterDexScreen.js:315 → startIfNeeded('monsterDex') | enterでactivate、guard、exit:988でdeactivate |

ファイル名はすべて `src/screens/` からの相対位置。`src/states/battleStateFactory.js` は通常battle.enterへ委譲し、exitもbattle.exitへ渡す。独立した別Tutorialを予約しない。practiceから親battleへ入る場合は `entryLifecycle` によりbattle用Tutorialの二重開始を避ける。

共通内部経路は `TutorialManager.startIfNeeded / forceStart → _start → TutorialGuide.createGuide`。forceStartの外部呼出し元、Manager以外からのcreateGuide呼出し元は検索で見つからなかった。sessionTimerのstartIfNeededは利用時間計測。保存処理のtutorial_seen等はフラグの保存であり、開始予約ではない。

playerNameInput、continentSelect、worldStageSelect、proverbDex、achievements、gameOver、gradeQuiz、loading、menu、monsterCapture、result、reviewStage、stageLoading、statusにはTutorial開始予約がない。tutorialScreen.js／tutorialBattle.jsは0バイトで実行処理がない。これらは「Tutorial開始経路なし」という静的分類で、各画面全体の安全認証ではない。Tutorial開始画面をfixture作成コストのために未検証としたケースはない。

**3. FINAL-QA-02：実resultWin → 実stageSelectで合格**

前回の独立 `adjacent-result.test.mjs` の2条件を現行コードで再実行した。

実FSMでresultWin.enterを開始し、実績計算完了、Tutorial import予約、実クリック購読への到達を確認。import結果だけを保留した。実updateが「ステージ選択へ」を描いたことを確認し、内部座標(400,505)に対応するCSS座標へclickをdispatchした。Canvas内部800×600、表示矩形left=13／top=27／width=390／height=700のcontain変換を検査側で計算した。

実FSMによるresultWin.exit → stageSelect.enter／update、現画面stageSelect、resultWin.canvas=nullに到達してから保留を解除した。

| 条件 | 旧result開始 | 旧overlay追加 | 現guide破棄 | 最終overlay | 観測状態変更 |
| --- | ---: | ---: | ---: | ---: | ---: |
| stage既読。同じ実module結果を旧result→stageの登録順で受渡し | 0 | 0 | 0 | 0 | 0 |
| stage未読。実stage guideを先に開始してから旧resultを完了 | 0 | 0 | 0 | 1（現stage） | 0 |

後者は実stage guideのオブジェクト同一性を保持した。前者は架空の現guideを設置していない。両方とも正式な遷移成功後の対象観測で合格した。加えて今回の独立MatrixでもresultWinの旧startIfNeeded到達0を確認した。

**4. Tutorial Navigation Matrix：全12画面を独立実行**

各行で、実enter → import保留 → 実exit → 次画面の実enter → 次画面の実guide開始 → 旧import完了を実行した。stageSelectの次画面にはcourseSelect、他の11画面にはstageSelectを用いた。これは所有権境界を調べる制御されたenter／exit列であり、全組合せが通常UIの直接リンクだという意味ではない。実ボタン・FSMでの自然な遷移は前節とFINAL-QA-01で別途実行した。

各画面でさらに実enter世代1 → exit → 実enter世代2を作り、旧→新と新→旧をそれぞれ実行した。

| 画面 | 離脱後：旧開始／追加／現破棄 | 再入場 旧→新 | 再入場 新→旧 | 未閲覧で滞在：開始／追加 | 実Guide完了操作 |
| --- | --- | --- | --- | --- | --- |
| title | 0／0／0 | PASS | PASS | 1／1 | PASS |
| courseSelect | 0／0／0 | PASS | PASS | 1／1 | PASS |
| regionSelect | 0／0／0 | PASS | PASS | 1／1 | PASS |
| stageSelect | 0／0／0 | PASS | PASS | 1／1 | PASS |
| battle | 0／0／0 | PASS | PASS | 1／1 | PASS |
| practiceBattle | 0／0／0 | PASS | PASS | 1／1 | PASS |
| quickReviewPractice | 0／0／0 | PASS | PASS | 1／1 | PASS |
| resultWin | 0／0／0 | PASS | PASS | 1／1 | PASS（位置fallbackあり） |
| profile | 0／0／0 | PASS | PASS | 1／1 | PASS |
| settings | 0／0／0 | PASS | PASS | 1／1 | PASS |
| kanjiDex | 0／0／0 | PASS | PASS | 1／1 | PASS |
| monsterDex | 0／0／0 | PASS | PASS | 1／1 | PASS |

離脱後の12条件では旧startIfNeeded到達も全て0。現guideの同一性と、既存1個のoverlayを保持した。再入場の24条件では旧世代の到達・開始・overlay追加・現guide破棄が0、現世代の開始1／overlay総追加1／最終1。各Promise完了直後にも観測し、新guideができた後はその実destroyを監視した。

正常系12条件では、Tutorial有効・未閲覧で滞在し、import完了により実Guideの見出しと本文が構築された。再resolveで追加開始はなく1回だけ。さらに実Guideの「つぎへ／はじめる！」onclickを最後まで呼び、overlay撤去、Manager.guide=null、その画面の既読フラグ1を確認した。すべてのTutorialを止めて異常系だけ合格させる実装ではない。quickReviewPracticeのTutorial IDは既存仕様どおりpracticeBattle。

snapshotはstage、grade、名前、現在問題、敵配列、playerStats、正誤リスト、進行、turn、入力可否、正規save原文を比較した。観測対象の変更0であって、全グローバル書込みを網羅した主張ではない。Guide完了時の既読更新は正常な保存作用として別に確認した。

**5. resultWinの先行await：追加3条件とも合格**

importだけのguardでは、古い `await checkAchievements()` の継続が再入場後の新しい世代を取得できる余地がある。この境界も独立に保留した。

| 条件 | 結果 |
| --- | --- |
| 実績計算の結果受渡し保留 → result.exit → 実stage guide開始 → 旧結果受渡し | 旧Tutorial予約0、現guide破棄0、追加overlay0、現guide・観測状態保持 |
| result旧enter → exit → 新enter、実績結果を旧→新で受渡し | 新世代だけ予約1／開始1／overlay1 |
| 同上、実績結果を新→旧で受渡し。新guide開始後に旧結果を渡す | 旧予約0、新guide同一性保持・破棄0、開始合計1／overlay1 |

実checkAchievements自体は実行し、その結果のenterへの受渡しだけを保留した。実績計算による正当な保存作用を、旧Tutorialの副作用と混同しないよう、計算完了後を比較基点とした。

静的にも、enter開始時のentryGenerationをawait後に照合してからTutorialを予約する構造を確認した。共通screenLifecycleのguardは予約時generationを閉じ込め、activeと同世代の両方を検査する。単なるcanvas有無やactiveフラグだけの判定ではない。

**6. 過去の公開阻害条件**

FINAL-QA-01とREAUDIT-01は、実装担当者の現行テストの再実行に加え、前回の独立シナリオを現在のコードで再実行した。

| ID | 今回の証拠と結果 |
| --- | --- |
| FINAL-QA-01 A | 実course.enter → import保留 → 日本編の実クリック → 実exit → regionSelect相当 → import完了。旧開始0／旧追加0／現guide破棄0／観測状態変更0 |
| FINAL-QA-01 B | 実name入力欄へ「そら」、DOM Enter → 実FSMでcourse → 世界編実クリック → 実continent.enter／update → 旧import完了。guideなし／観測guideあり双方で旧開始・追加・破棄・状態変更0。名前はgameStateと正規saveに一致し、大陸のアジアクリックによるズームも機能 |
| REAUDIT-01 | battle／practice／quickの離脱、再入場両順序、正常開始に加え3世代3順序を独立再実行。所有者3個が別でactive=false／false／true。現世代だけ開始1。practice／quickのbonus背景取得到達→exit→onload完了で次背景保持。実battleの誤答・levelUpによるtimeout／rAF／interval生成→exitで全解除・transform復元、捕捉済みcallbackの後実行でも観測状態不変 |

次の項目は今回のTutorial所有権修正との依存が小さいため、現行の正式テストの注入条件・assertを確認し、今回の再実行を合格証拠とした。過去の独立実験すべてを新規実装し直したという意味ではない。

| ID | 正式テストによる今回の確認 | 結果 |
| --- | --- | --- |
| REAUDIT-02 | loadingの正常／503／正常応答へ失敗oracle／旧grade6代用への同oracle。後2条件は子プロセスのAssertionError・終了1・指定メッセージ `failed curriculum must not be a success` を親が検査 | PASS |
| NEW-01 | 実練習入力で誤答→2,200ms→正答、待機中・正答直後連打。正誤各1、revealed、次問予約1、1,100ms後入力復帰 | PASS |
| NEW-02 | 完了時の空Enter続行、終了クリック、通常空欄拒否、余分な学習記録なし、実updateの両操作描画 | PASS |
| NEW-03 | battle攻撃／回復×正答／誤答のQuota注入→解除→同問題再試行。失敗時原文・リスト・combo保持、入力復帰、予約0。成功時記録・保存各1 | PASS |
| NEW-04 | 実quiz handlerで保存Quota→解除→再送。失敗時answers／stats／予約0、成功時回答・保存・次問予約各1 | PASS |
| NEW-05 | 実reviewの390px表示。戻る・回答の各5位置、44 CSS px目標、composition中の回答抑止 | PASS |
| NEW-06 | grade7正常313件／88通常面のpool集合一致。503、不正JSON、明示reject、fetch／本文保留、対象到達後9,999ms未完了→10,000ms期限、abort、遅い結果無視、再試行 | PASS |
| E01 | スロット退避Quota、不正行先、復元途中・番号書込み失敗、正常1→2→1、復旧journal。元セーブと現スロット保持 | PASS |
| E02 | 破損JSON原文保持、未知版・空／不正型backup拒否、明示import、原本退避・復元mirror失敗、復旧journal。復旧拒否・離脱・期限切れも再実行 | PASS |

**7. 軽度残件と今回の保証範囲**

**TUTORIAL-FINAL-P2-01：resultWinの案内位置がfallbackになる。** `src/tutorial/tutorialData.js:81` は未定義のcenterBoxを参照する。実正常開始でReferenceErrorを確認し、Guideの例外処理（TutorialGuide.js:105以降）が代替矩形を使用した。今回の独立試験では該当するエラー文字列とReferenceErrorの組合せだけを別途記録し、他のconsole.error／alertは失敗扱いを維持した。

実Guideの見出し・本文・完了操作・overlay撤去・既読保存は成立した。したがって旧非同期処理が現画面を覆うP1とは区別し、案内位置のP2相当残件とする。意図した位置の強調表示は合格認証しない。コード修正は今回行っていない。

Guideのレイアウト再試行rAF（TutorialGuide.js:112付近）はdestroy時の取消を持たない。ただし静的に追跡した処理は、既存要素の位置・説明を更新するもので、Manager開始・bodyへのoverlay再追加・現guide破棄へ至らない。すでに表示済みguideを外部遷移で自動終了する一般契約やimport取得失敗時の案内／再試行も、今回の「未完了の旧開始予約」の検証とは別に残る。これらについて実害を再現済みのP1があるとは扱わない。

実iPad／iPhone／Androidの表示・物理タップ・向き変更・キーボード、実IME、実Storage制約と強制終了、実Firebase、公開環境のchunk配信・更新・旧SW退役、子どもの試遊、音の実聴、全教材の人的校閲は今回未確認。これらの未確認や美観だけを理由にCODE NO-GOにはしない。

今回確認したバグクラスは、実enter／exit契約を通る既知のTutorial開始経路では再現しなかった。将来追加する呼出し元や全画面のあらゆる非同期処理まで安全を証明するものではない。

**8. 実行結果・証拠・原本保持**

| 実行 | PASS | FAIL | 終了コード |
| --- | ---: | ---: | ---: |
| npm.cmd run test:phase-a | 86 | 0 | 0 |
| npm.cmd run test:phase-b | 22 | 0 | 0 |
| npm.cmd run test:phase-c | 17 | 0 | 0 |
| npm.cmd run test:no-go | 143 | 0 | 0 |
| 正式4スイート合計 | **268** | **0** | — |
| 前回独立シナリオ＋FINAL-QA-02を現行コードで再実行 | 46 | 0 | 0 |
| 今回の独立Matrix48条件＋先行await3条件 | 51 | 0 | 0 |
| 独立検査合計 | **97** | **0** | — |

cancelled／skipped／todoは全て0。正式no-goの143件には実装担当者のMatrix54件が含まれるため別加算していない。独立97件には既存検査と重なる条件もあり、数字を異なる機能数や網羅率と解釈しない。

一時出力先への `npm.cmd run build -- --outDir .../dist` は終了0、Vite 5.4.19、5.51秒。mainは523.94kB／gzip156.71kB、Tutorial別chunkは9.34kB／gzip4.42kB。CJS／static・dynamic import混在／大きいchunkの既存警告は残る。`git diff --check` は終了0で、既存の改行形式警告のみ。

`src/`、`tests/`、`public/data/`、`scripts/`、`docs/` とルート既存ファイル、計222ファイルを開始時・終了時SHA-256で比較し、差分0。既存の未コミット・未追跡変更を保持した。既存distは上書きしていない。リポジトリに追加した成果物は本書のみ。

証拠保存先：

```text
C:/Users/socce/AppData/Local/Temp/yomitabi-tutorial-final-qa-8a731a793c1146a9aa623b3642ec669e/
```

before-hashes.json／after-hashes.json、before-status.txt／after-status.txt、src-search.txt、4スイートのログ、independent-prior.log、final-matrix.log、build.log、diff-check.log、独立fixture・loader・試験本体、一時distを保存。OS一時領域のため永続保管は保証しない。

再実行例（現在の作業ツリーを読む）：

```powershell
$qaFinal = 'C:/Users/socce/AppData/Local/Temp/yomitabi-tutorial-final-qa-8a731a793c1146a9aa623b3642ec669e'
node --experimental-default-type=module --test "$qaFinal/independent.test.mjs" "$qaFinal/adjacent-result.test.mjs"
node --experimental-default-type=module --test "$qaFinal/final-matrix.test.mjs"
npm.cmd run test:phase-a
npm.cmd run test:phase-b
npm.cmd run test:phase-c
npm.cmd run test:no-go
```

本判定により、既知のTutorial非同期所有権の公開阻止残件は今回の条件で解消を確認した。軽度残件と実環境確認を記録したうえでStable Baselineへ進める。

