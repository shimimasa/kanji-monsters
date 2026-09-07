# 漢字ヨミタビ FINAL-QA-01 修正報告

作業日：2026-09-06（JST）。対象：`main`、HEAD `d58c4ce116ba4b029de5fb36ebfb4629ed5a89f6` と開始時の作業ツリー変更。

`YOMITABI_CODE_GO_FINAL_AUDIT.md`を全文読み、FINAL-QA-01とその直接的な再発防止に限定して実装した。正式な回帰テストを先に追加し、製品修正前に10 FAIL／9 PASS、修正後に同じ19件すべてPASSを確認した。指定4スイートは計214 PASS、build成功。

本書は修正と検証の報告であり、CODE GO／CODE NO-GOの最終判定は行わない。

**1. FINAL-QA-01の根本原因**

コース選択のenterはTutorialManagerのdynamic importへcallbackを予約するが、そのcallbackを画面の入場世代に結び付けていなかった。exitは入力イベントを解除してcanvas／ctxを解放するだけだった。

そのため、350msの入場直後入力抑止を越えて日本編／世界編を選んだ後でも、旧importが完了すると`startIfNeeded('courseSelect', ...)`へ到達した。TutorialManagerは既存guideをdestroyして新しいTutorialGuideを構築するため、旧コース説明の全画面overlayが次画面を覆った。canvasがnullになってもTutorialの座標fallbackがあるので、canvas解放だけでは開始を止められない。

activeフラグの確認だけでは、exit後に再入場してactiveがtrueへ戻った際に旧Promiseも通ってしまう。必要なのは、callbackを登録した入場世代と完了時の世代が一致すること。

**2. 調査範囲と変更ファイル**

Tutorial開始の呼出し元を検索し、指定された導線について次を確認した。

| 画面 | 開始方式と今回の扱い |
| --- | --- |
| title | 既存lifecycleのactivate／guard／deactivateあり。製品変更なし。今回の正式テストで離脱・再入場両順序・正常開始を確認 |
| playerNameInput | Tutorial開始予約なし。実入力購読とFSM経由のCASE Bに使用。変更なし |
| courseSelect | 未保護のimport callback。今回修正 |
| regionSelect | コース選択の日本編の直後にあり、同じ未保護のimport callback。離脱／再入場で修正前FAILを確認し、同一原因として修正 |
| continentSelect | Tutorial開始予約なし。実enter／update／クリックをCASE Bで使用。変更なし |
| stageSelect | regionSelectの先のステージ選択で同じ未保護のimport callback。離脱／再入場で修正前FAILを確認し、同一原因として修正 |
| battle | 入場単位の所有者とguardあり。変更なし |
| practiceBattle | 入場冒頭で所有者を作り、親battle.enterへ同一所有者を渡す。変更なし |
| quickReviewPractice | practiceへ自身のthisで委譲し、同じ入場所有権を使う。変更なし |

変更した製品は次の3ファイルのみ。

| ファイル | 変更 |
| --- | --- |
| `src/screens/courseSelectScreen.js` | 既存createScreenLifecycleを使用。入場時activate、Tutorial callbackのguard、離脱時deactivate |
| `src/screens/regionSelectScreen.js` | 同じ3点を近接経路へ適用 |
| `src/screens/stageSelectScreen.js` | 同じ3点を近接経路へ適用 |
| `tests/no-go/navigation-tutorial.test.mjs` | 新規。CASE A／B／C、正常開始、近接画面、title対照、既読／無効設定の19件 |
| `tests/no-go/helpers/navigation-tutorial-fixture.mjs` | 新規。架空Storage、DOM／Canvas、時計、実Tutorialの副作用観測 |
| `tests/no-go/helpers/navigation-tutorial-loader.mjs` | 新規。対象画面の実dynamic importの受渡しだけを保留 |
| `YOMITABI_FINAL_QA01_FIX_REPORT.md` | 本書 |

開始前にgit status、branch、diffを確認し、開始時diffと3画面の原本を一時保存した。開始時156ファイルのSHA-256比較で、既存ファイルの変更は上記3画面だけ、追加は上記テスト3ファイルと本書。既存未コミット変更をreset／checkout／revert／cleanしていない。共通lifecycle、TutorialManager／TutorialGuide、battle／practice／quickReview、教材・保存・難易度・既存テストは変更していない。

**3. lifecycle／generationの扱い**

3画面にそれぞれ独立した`createScreenLifecycle()`を置き、既存titleと同じ使い方を適用した。

- enter冒頭の`activate()`は内部で旧世代をdeactivateし、generationを進めてからactiveにする。
- `guard(callback)`は予約時点のgenerationを閉じ込める。
- exit冒頭の`deactivate()`はactiveをfalseにし、さらにgenerationを進める。
- 再入場時は同じ画面オブジェクト・lifecycleオブジェクトでも新しいgenerationとなる。旧callbackは新世代がactiveでも一致しない。
- 現世代のcallbackだけがTutorialManagerへ到達するため、旧世代が新guideをdestroyしない。

識別単位は「画面ごとのlifecycleと入場世代」。battle／practiceのような親子enterによる所有者の受渡しはこの3画面にはないため、新たな継承契約は追加していない。既存共通処理を使うだけで、Tutorial frameworkは新設していない。

**4. 修正前FAILの再現**

製品コードを変更する前に、以下を正式テストとして保存し実行した。

```powershell
node --experimental-default-type=module --test tests/no-go/navigation-tutorial.test.mjs
```

結果：19件中 **10 FAIL／9 PASS、終了コード1**。初期化やimport失敗ではなく、対象の実副作用に対するassertionが失敗した。テストの後片付けでも予期しないconsole.errorがないことを検査している。

| 条件 | 修正前の観測 |
| --- | --- |
| CASE A 日本編へ遷移後の旧import | starts=1、overlay追加=1、次guide破棄=1、観測状態変更=0。期待0／0／0／0に対してFAIL |
| CASE B 実FSMでcontinentSelectへ遷移後 | 現画面はcontinentSelectだが、旧starts=1、overlay追加=1。期待0／0に対してFAIL |
| CASE C course、旧→新 | 旧courseと新courseの双方が開始。FAIL |
| CASE C course、新→旧 | 新courseの後に旧courseが開始。FAIL |
| region／stageの離脱と再入場両順序 | 各3件が同じ理由でFAIL、合計6件 |
| 4画面の正常開始、title離脱・再入場、course既読／無効設定 | 修正前から9 PASS |

overlay数は現在のbodyに残る数だけでなく、`body.appendChild`を通った全追加数を観測した。一度追加してすぐ消す実装も合格にはならない。

**5. 修正後PASS**

3画面の修正後、同じ19件を変更せず再実行し、**19 PASS／0 FAIL、終了コード0**。既存test:no-goにも通常のファイルglobで含まれるため、package.jsonへの実行定義追加は不要。

Storage／DOM／Canvas／時計はNode内の代用品。製品の画面enter／exit、入力購読、FSM、startIfNeeded、_start、createGuideは実処理を通す。import結果の保留位置を探す文字列検査は注入箇所の確認であり、合否は動作のassertionで判定する。

**6. 日本編遷移（CASE A）**

実course.enterでimportを保留し、performanceの時計を400ms進め、日本編ボタン中央のCSS座標にclickイベントを送った。内部800×600、表示390×700、left=13／top=27のcontain表示として座標を独立計算し、Canvasへ登録された実ハンドラーを通した。

regionSelectへのイベントを受け、実course.exitを呼び、次画面相当のstageマーカーとguideを設定してからimportを完了した。

修正後は旧course開始0、overlay追加0、次guide破棄0、次guide同一性保持。現在問題、playerStats、turn、入力可否、stage、正規save原文を含むsnapshotの変更0。全グローバル変数の全書込みを網羅したという意味ではない。

**7. 世界編の実FSM経路（CASE B）**

実name.enterと入力購読で「あお」を確定し、実`FSM.change`でcourseSelectへ遷移した。courseのimportを保留したまま400ms進めて世界編をクリック。実course.exit → 実continentSelect.enter／updateを実行した後で旧importを完了した。

修正後はFSMの現画面=continentSelect、旧course開始0、overlay追加0。ゲームsnapshotと現地図のcamera状態を保持。さらに現地図の実クリック購読へアジアのマーカー位置を送り、`isZooming=true`、`zoomTarget.name='アジア'`となることを確認した。

操作領域へ追加される遮蔽DOMは0で、現画面のハンドラーも動く。Nodeのイベント代用品はブラウザーの重なり判定を実装していないため、物理タップによる検証とは区別する。

**8. 離脱・再入場の順序入替（CASE C）**

course enter #1 → import #1保留 → exit → course enter #2 → import #2保留を実行した。

| 完了順序 | 修正後 |
| --- | --- |
| #1 → #2 | #1開始0、#2開始1、全overlay追加1、現overlay1 |
| #2 → #1 | #2開始1、#1開始0、全overlay追加1、現overlay1。#2のguideオブジェクトを保持 |

両順序とも観測snapshot不変。regionSelect、stageSelect、既存titleでも同じ両順序を確認した。

**9. 正常な現世代Tutorial開始**

course.enter後に画面へ留まりimportを完了すると、未閲覧のcourseSelect Tutorialが1回開始し、実overlayを1個追加する。保留Promiseを再度resolveしようとしても追加されない。常時開始を禁止する修正にはなっていない。

regionSelect／stageSelect／titleの現世代正常開始も各1回。course既読フラグ、tutorialEnabled=0による開始抑止も維持した。

**10. battle／practice／quickReviewへの回帰確認**

既存`entry-lifecycle.test.mjs`の10件を修正後のtest:no-goで全て再実行しPASS。

- practiceとquickReviewPracticeの実enter→exit→遅いTutorial／bonus背景完了。
- 両画面の再入場で、旧→新／新→旧のTutorial完了順序。
- 通常battleの実enter／exitによるtimeout、rAF、levelUp interval解除と遅いcallbackの無効化。
- 通常battleの現世代guide正常開始。

加えてscreensのquick review学習結果受渡し・次問1回、通常battleの正答／誤答／撃破後離脱、lifetimeのlevelUpと名前確定、phase-bのlifecycleと入力制御を含め全てPASS。製品と既存テストのbattle／practice／quickReview各ファイルは開始時のSHA-256と一致する。

**11. NEW-01〜NEW-06とREAUDIT-02**

| 対象 | 今回再実行した既存重要条件 | 結果 |
| --- | --- | --- |
| NEW-01 | 練習誤答→フィードバック→再正答、待機中／直後連打、revealed記録 | PASS |
| NEW-02 | 完了時空Enter続行、終了クリック、通常空欄拒否、記録増加なし、実update描画 | PASS |
| NEW-03 | 攻撃／回復×正答／誤答のQuota→入力復帰→同問題1回記録 | 4経路PASS |
| NEW-04 | クイズ保存失敗→再試行で回答・保存・次問予約各1 | PASS |
| NEW-05 | 390px復習の戻る／回答中央・四隅、黒帯、IME中入力 | PASS |
| NEW-06 | grade7の正常、503、不正JSON、通信reject、fetch／本文保留、期限後完了、正常化再試行 | PASS |
| REAUDIT-02 | 正常応答と旧grade6代用へ同じ失敗oracleを適用し、指定assertionでFAILすることを確認する対照テスト | PASS |

grade7失敗理由・対象URL・abort・正常313件と88定義pool集合の照合を含む改善済みテストを実行した。テスト内容やdataLoaderを緩めてはいない。

**12. E01／E02**

phase-a全86件、no-go/recovery全7件を修正後に実行してPASS。E01のスロット退避Quota、行先復元途中失敗、スロット番号書込失敗、不正行先、正常1→2→1の原本保持を確認した。

E02の破損JSON原文保持、未知版の拒否、不正型・空JSONによる上書き拒否、復元ミラー失敗、原本退避失敗、復旧journalを含む既存検査もPASS。今回、保存形式・保存処理・復旧処理は変更していない。

これは既存重要テストの今回の実行結果であり、実端末Storageや実Firestoreの認証ではない。

**13. 全test suite結果**

| コマンド | PASS | FAIL | 終了コード |
| --- | ---: | ---: | ---: |
| `npm.cmd run test:phase-a` | 86 | 0 | 0 |
| `npm.cmd run test:phase-b` | 22 | 0 | 0 |
| `npm.cmd run test:phase-c` | 17 | 0 | 0 |
| `npm.cmd run test:no-go` | 89 | 0 | 0 |
| 合計 | **214** | **0** | — |

cancelled／skipped／todoも全て0。test:no-goは既存70件＋今回19件。Node.js v22.14.0で実行した。`git diff --check`も終了0で、既存の改行形式警告は残る。

**14. build結果**

既存distを上書きせず、次の一時出力先へ本番buildを実行した。

```powershell
npm.cmd run build -- --outDir C:/Users/socce/AppData/Local/Temp/yomitabi-qa01-fix-0fcd1bc4605a427fabe02d38dd7c9781/dist
```

終了0、Vite 5.4.19、5.43秒。main 523.39kB／gzip156.61kB、CSS48.35kB、TutorialManager別chunk9.34kB。CJS API非推奨、静的／動的import混在、500kB超chunkの警告は残る。配信・デプロイは行っていない。

**15. 残存リスクと範囲の限界**

- 今回閉じた範囲はcourseSelectと、直接つながるregionSelect／stageSelectの未完了Tutorial予約。全画面・全非同期処理の安全性を証明するものではない。
- 呼出し元調査ではprofile、settings、resultWin、漢字／モンスター図鑑にもguardなしのTutorial importがあることを静的に確認した。これらの個別経路の再現検査・製品修正は今回の近接する選択導線の範囲に含めていない。全Tutorial呼出し元を修正済みとは扱わない。
- importそのものの通信取消や取得失敗時の新しいUI、既に表示済みのguideの寿命、TutorialGuide内部のレイアウト追従処理は変更していない。今回の対策は、旧入場世代の完了callbackを実行しないこと。
- 世代判定は実FSMがexitを呼ぶ契約に基づく。CASE Bでその契約を実行確認した。画面オブジェクトを外部から直接改変する経路まで保証するものではない。

3D化、新機能、UI刷新、ゲームバランス、TypeScript化、大規模リファクタリング、その他の品質改善は実施していない。

証拠保存先：

```text
C:/Users/socce/AppData/Local/Temp/yomitabi-qa01-fix-0fcd1bc4605a427fabe02d38dd7c9781/
  before.diff
  before-hashes.json / after-hashes.json
  courseSelectScreen.before.js / regionSelectScreen.before.js / stageSelectScreen.before.js
  navigation-before.log / navigation-after.log
  phase-a.log / phase-b.log / phase-c.log / no-go.log
  build.log / dist/
```

一時領域はOSにより削除され得る。正式な回帰テストはリポジトリに追加してあるため、一時ログがなくても現行実装の再試験は可能。

**16. 実機でしか確認できない事項**

実ブラウザーでの遅いchunk取得と画面遷移、実際のoverlayの重なり・タッチ操作、モバイルの向き変更・ソフトキーボード、実IMEの確定順序、実Firebaseとの同期、公開環境の配信・更新、子どもの説明理解と操作は今回未確認。Nodeテストによるコード上の再現／抑止と分離する。

今回はFINAL-QA-01修正の結果を提出する。最終GO判定、PROMPTや3D化の次工程には進んでいない。
