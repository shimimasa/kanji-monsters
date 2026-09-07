# 漢字ヨミタビ 独立QA 最終コード監査

**最終判定：CODE NO-GO**

監査日：2026-09-06（JST）。対象：HEAD `d58c4ce116ba4b029de5fb36ebfb4629ed5a89f6` と、監査開始時に存在した未コミット・未追跡の実装およびテスト。

REAUDIT-01の練習／短期復習の所有権漏れ、REAUDIT-02のgrade7テスト欠陥、NEW-01〜NEW-06は、今回の再現条件では解消した。E01／E02のP0も再発しなかった。しかし、名前入力の遷移先であるコース選択から、同じTutorialManagerへ至る依存経路に、**離脱後の旧Tutorialが次画面を覆うP1（FINAL-QA-01）**を再現した。

既存195テストの成功を全体合格には置き換えない。今回のCODE NO-GOは現在のコードを動かした結果に基づく。実機・実IME・実Firebase・公開環境・実際の子どもが未確認であることを理由にしていない。

**監査方法と原本保持**

- 指定された5文書を読み、過去の症状、要求された完了条件、変更範囲を確認した。過去のPASS数や修正報告は今回の合格証拠に流用していない。
- 現行の入場／離脱、入力購読、保存、教材ローダー、TutorialManager／TutorialGuide、関連テストを確認し、Node.js v22.14.0で再実行した。
- Storageは架空データのメモリ実装。DOM／Canvas／Image／時計は制御可能な代用品。実DOM構築コードの呼出しと追加された要素を観測したが、実ブラウザーの描画や物理タップの測定ではない。
- 一時検査用ESM loaderは、Tutorialの実import結果の受渡しを保留する。画面のenter／exit、guard、Tutorial開始・guide構築を成功スタブには置き換えない。grade6代用の反事実対照だけは、明示した製品ロジックをメモリ上で変換した。
- 今回作成した独立検査は、既存lifecycleテストのDOM／時計fixtureを内容確認のうえ一時ファイルへ抽出し、別のシナリオとアサーションを追加した。通常練習へ短期復習対象を設定しないこと、短期復習の対象IDを入場ステージ内から選ぶことを補った。
- 前回監査の独立スクリプトも内容を読んで一時コピーし、現在の製品モジュールで20条件を再実行した。過去のログは合否に使っていない。
- `src/`、`tests/`、`public/data/`の156ファイルを開始・終了時SHA-256で比較し、差分0。製品コード・既存テストは編集していない。buildは一時出力先を使用。リポジトリに追加した成果物は本書のみ。

**1. REAUDIT-01：FIXED（指定された練習／短期復習の経路）**

現在の`battleScreen.js:809`は旧所有者を停止して入場単位の所有者を作る。`practiceBattleScreen.js:90`がその所有者を非同期登録前に取得し、`:161`で親enterの第3引数へ渡す。親の`:823`は受け取った所有者を再生成・再activateしない。通常battleのTutorial開始は`:1074`の直接入場分岐に限定される。

既存`entry-lifecycle.test.mjs`の10条件を再実行したうえで、以下の独立検査を実施した。

| 条件 | 今回の観測 |
| --- | --- |
| 通常practice.enter → Tutorial import保留 → 実exit → 次画面相当 → import完了 | 旧開始0、overlay追加0、次guide破棄0、guide同一性保持。観測した状態変更0 |
| quickReviewPracticeで同じ順序 | 同じく0／0／0／0 |
| 通常battleで同じ順序 | 同じく0／0／0／0 |
| practice／quickでenter → exit → 即再入場 | 既存テストで旧→新、新→旧の両順序を再実行。現世代のpracticeBattleガイド1だけ |
| practice／quick／battleの3世代 | old→middle→new、new→middle→old、middle→old→new。所有者3個は別物、activeはfalse／false／true。新世代guideだけ1、overlay1、旧世代の状態変更0 |
| bonus背景の遅い完了 → 離脱後 | 既存実enter／exitテストで次画面背景マーカーを保持 |
| bonus_g1 → exit → bonus_g2、背景を旧→新／新→旧で完了 | practice／quickとも旧背景による上書き0、新背景は反映。各世代のImage取得到達も確認 |
| practice → 実battle入場 → 新battleガイド開始 → 旧practice import完了 | 新guideの同一性保持、overlay1、旧所有者はinactive |
| 通常battleの誤答・レベルアップ・離脱 | timeout／rAF／interval解除、transform復元。捕捉済みcallbackを後から実行しても次画面マーカー不変 |

独立snapshotはstage IDだけでなく、現在問題、敵、playerStats、turn、入力可否、正規save原文を含めた。これは観測対象の変更0であり、全グローバル変数への全書込みを網羅したという意味ではない。

新世代の実Tutorial開始も確認したため、全Tutorialを止めて0にしただけの結果ではない。独立lifecycle追加検査は17 PASS。

**2. REAUDIT-02：FIXED**

現行`loading.test.mjs`と`helpers/curriculum-fixture.mjs`を読んだうえで、実行による検出力を確認した。

| 対照 | grade7への実応答 | 観測 | 同じ503失敗oracle |
| --- | --- | --- | --- |
| 正常教材（正常oracle） | 200 | success=true、grade7=313。14教材URL、88通常ステージの定義・出題ID集合が一致 | 正常系PASS |
| 現行503 | 対象URLに1回、503、本文未読 | success=false、grade7=0、asia_area1代用pool=0 | PASS、終了0 |
| 正常応答なのに503失敗oracleを適用 | 200、障害注入なし | success=true、grade7=313 | **FAIL、終了1** |
| 旧grade6 fallback症状を再導入 | 503 | success=true、grade7=191、grade6=191 | **FAIL、終了1** |

後二者の失敗理由は`AssertionError: failed curriculum must not be a success`。timeout、import失敗、構文エラー、任意の異常終了を「検出成功」にしていない。

さらに、workerの共通oracleだけでなく、**現行`loading.test.mjs`の「CONTROL B: /data/kanji_g7_proto.json 503 fails for that cause, then retries」自体**に次の対照を適用した。

- fetch fixtureを全て正常応答にする：当該テストは0 PASS／1 FAIL、上記のtrue対falseアサーションで失敗。
- 実dataLoaderへ旧代用症状を戻す：同じテストが0 PASS／1 FAIL、同じアサーションで失敗。クエリ付きmodule URLにも変換を適用した。

旧症状の再構成は「上級取得失敗時にgrade6を代用」と「最終catalog／参照検証を外す」の複合変異。最終検証も現在の防御なので、fallbackだけ戻した場合や歴史上のコミットそのものの復元とは区別する。製品ファイルへの書戻しはない。

503は対象URLを含むHTTP失敗メッセージと照合。不正JSONは注入したSyntaxErrorの同一性、明示rejectは注入メッセージを照合した。fetch／本文保留はgrade7への到達後、他の到達済み教材の本文完了を確認して時計を進め、9,999msで未完了、10,000msで期限切れ、grade7だけabortする検査を再実行した。遅い完了後もgrade7は空で、正常応答に戻して同じloaderを再試行すると正常集合へ戻る。

「単にtimeoutになったのでgrade7失敗テストをPASS」とする旧欠陥は、今回の対照では残っていない。

**3. NEW-01〜NEW-06**

FIXEDは、以下の以前の障害条件を現在のコードへ再注入して解消を確認した意味。実端末の全操作を認証する意味ではない。

| ID | 判定 | 再注入と観測 |
| --- | --- | --- |
| NEW-01 練習の誤答再回答 | **FIXED** | 実入力購読へ誤答→2,200ms→正答。追加で誤答2回→正答、待機中・正答直後の連打。記録は誤答2／正答1だけ、正答支援区分revealed、1,100ms後に入力復帰。ゲート解除と新しい問題トークンの発行を確認 |
| NEW-02 練習完了の空入力続行／終了 | **FIXED** | 完了後の空Enter、空yomitabi:submitで続行。実座標クリックで終了してstageSelectへ。続行・終了による学習件数増加0、通常の空回答は拒否。実updateの両選択描画も既存テストで再確認 |
| NEW-03 通常戦闘の保存失敗再試行 | **FIXED** | 攻撃／回復×正答／誤答。ジャーナルQuotaに加え、krb_save書込を継続失敗させ2回送信してから解除。失敗中は原文・HP・敵HP・正誤リスト保持、入力復帰。解除後は同じ問題を1回だけ記録 |
| NEW-04 学年クイズの保存失敗再試行 | **FIXED** | 正答／誤答、保存2回失敗→解除→購読経由の回答連打。失敗中answers=0、次問予約=0、原文保持。解除後answers=1、対応する正誤1、次問予約1、正規saveと一致 |
| NEW-05 390px復習戻る | **FIXED** | 実review.enter／updateの描画矩形を観測し、共通逆変換関数に依存しないcontain計算で中心・四隅内側をクリック。黒帯あり／なしで各5点成功、黒帯クリックは反応0 |
| NEW-06 grade7教材取得失敗 | **FIXED** | 503、不正JSON、明示reject、fetch／本文保留、遅い完了、正常化後の再試行。代用なし、対象原因を確認。正常時grade7=313、88面の定義集合一致。正常／旧代用対照によるテスト検出力は前節 |

NEW-05の独立条件は内部800×600、DOM矩形left=13、top=27、width=390、height=700。倍率0.4875、上下黒帯203.75px。観測した戻る矩形は内部[20,20,230,91]、実寸換算112.125×44.3625 CSS px。黒帯なし390×292.5でも確認した。

**4. E01／E02：P0再発なし**

E01はchild-Aの名前・回答記録・旗5・復習queue、行先にchild-Bを用意し、実`switchToSlot(2)`へ以下の継続的Quota障害をそれぞれ再注入した。

| 失敗する書込 | 切替結果 | 元krb_save／復習queue／行先控え | 現スロット |
| --- | --- | --- | --- |
| yomitabi_phase_a_pending | false | 全て原文一致 | 1 |
| yomitabi_slot_data_1 | false | 全て原文一致 | 1 |
| krb_save | false | 全て原文一致 | 1 |
| yomitabi_slot | false | 全て原文一致 | 1 |
| yomitabi_storage_epoch | false | 全て原文一致 | 1 |

既存phase-aの正常1→2→1、不正行先、途中書込失敗、番号失敗、復旧journalの検査も再実行した。現在の`saveSlots.js:157`以降は行先を検証してtransactionを使う。`storageTransaction.js`は変更前の文字列をjournalへ持ち、失敗時に戻し、戻せない間は復旧用原本を保持する。

E02は設定画面と同じ`saveNow(data,{replace:true})`入口へ`{}`、null、配列、version999、player型不正を投入し、全拒否・元セーブ原文一致を確認した。壊れたJSON、空文字、JSON null、未知版を正規saveへ置いた`loadSave()`／`loadGameData()`も原文を保持し、正常記録として採用しなかった。

復元ミラーの書込失敗、原本退避失敗、有効な空backupへの置換、破損クラウド復旧の拒否／離脱／期限切れはphase-aとno-go/recoveryで再実行した。有効な復元元がない破損記録を修復できるという判断ではなく、先行上書きで原本を失わないことの確認である。

**5. 変更依存関係に基づく確認**

| 経路 | 確認結果 |
| --- | --- |
| battle → lifecycle → Tutorial | 実入場・離脱・3世代・正常guide・誤答後・撃破後・levelUpで旧処理の干渉を検出せず |
| practice → battle親enter → lifecycle | 親子が同一所有者を共有。通常練習の入場を含む独立検査で再生成漏れを検出せず |
| quickReviewPractice → practice → battle | 同じ所有権を使用。遅いTutorial／bonus背景と再入場を確認。回答記録・次問1回の既存テストも成功 |
| stageLoading → assets → deadline | 既存の期限・exit後完了に加え、北海道→離脱→東北の再入場で旧→新／新→旧完了を独立実行。旧進捗変更0、新画面へのbattle遷移1。新stage IDを保持 |
| name → 保存 → 非同期cloud | 実enter・入力購読・exit・再入場を実行。cloud transactionの到達を待って保留を確認。ローカル確定でcourseSelectへ1回遷移。旧cloud完了後の追加遷移0、新入力「みどり」と新ゲートを保持 |
| name → courseSelect → TutorialManager／TutorialGuide | **FINAL-QA-01のP1を再現。次節参照** |

最新修正の2画面で新たに作られた回帰は今回の条件では確認しなかった。しかし、同じ共有Tutorialの呼出し元まで依存関係をたどると、未保護の入場予約が残る。全画面の無差別な再監査や全37項目の再採点はしていない。

**6. FINAL-QA-01：P1 — コース選択の旧Tutorialが離脱後に次画面を覆う**

関連：E08、U04、名前入力後の導線。**今回新しく確認した残存経路**であり、最新のbattle／practice修正が新たに作ったREGRESSIONとは断定しない。

原因は`src/screens/courseSelectScreen.js:45`のguardなしの動的import callback。`:138`のexitはイベント解除とcanvas／ctxの解放だけで、予約済み開始を無効化しない。遅いcallbackが`TutorialManager.startIfNeeded('courseSelect', ...)`へ到達し、`TutorialManager.js:38`で既存guideを破棄して`TutorialGuide.js:19`以降の全画面overlayをbodyへ追加する。

**再現A：次画面のguide保護**

1. 正常セーブ、Tutorial有効、courseSelect既読フラグなしを用意。
2. 実courseSelect.enter(canvas)を呼び、Tutorialの実import結果の受渡しを保留。
3. 入場直後の350ms入力抑止を越える400msを時計で進め、見える日本編ボタンを実handleClickでクリック。
4. 発行されたregionSelect遷移で実course.exitを呼び、次画面相当状態とguideを設定。
5. importを完了する。

観測：旧courseSelect開始1、overlay追加1、次guide破棄1、guide同一性喪失。stageマーカーは不変でも、次画面DOMとguideへ干渉する。

**再現B：実FSM・実遷移先でも確認**

次画面の代用品だけによる判定を避けるため、別プロセスで実`core/fsm.js`、実name／courseSelect／continentSelectを接続して確認した。

1. 実name.enterと入力購読で「あお」を確定し、実FSMでcourseSelectへ遷移。
2. courseのTutorialだけを保留。400ms後、世界編ボタン中央のclickをCanvasの実購読へdispatch。
3. 実course.exit → 実continentSelect.enter／updateに到達し、overlayが0であることを確認。
4. 保留したcourse importを完了し、さらに現画面をupdate。

```text
FSMの現画面             continentSelect
ローカル確定した名前      あお
離脱済みcourse開始       1
追加されたoverlay        1
overlay.position         fixed
overlay.width/height     100vw / 100vh
overlay.zIndex           100002
overlay.pointerEvents    auto
期待                     overlay 0
アサーション             1 !== 0（終了コード1）
```

この再現Bでは次画面へ架空のguideを置いていない。大陸選択にはこの古いガイドを置換する新Tutorial開始がなく、旧コース説明が残る。遅い同一importの完了順が偶然逆転することにも依存しない。

保留したのはimport結果の受渡しだけで、courseのguardを外す等の製品ロジック変異は使っていない。実配信の発生率やネットワーク秒数は測っていないが、別チャンクのTutorial取得中に主要操作で先へ進める現行コードの経路を再現している。

**P1とする理由：** 離脱済み画面の処理が現画面の主要操作領域を全画面要素で覆い、別guideがあれば破棄する。閉じて復帰できることは前回REAUDIT-01と同じであり、同じ判定基準を適用する。データ消失P0ではない。これを限定的注意だけで次工程へ送るCONDITIONAL CODE GOにはしない。

再判定には、コース選択を含む関連Tutorial予約を入場世代へ所属させ、離脱・再入場で旧開始／DOM追加／次guide破棄が0になる実経路の確認が必要。通常の現世代Tutorial開始も維持すること。今回は修正していない。

**7. 今回の実行結果と証拠**

| 実行 | 結果 |
| --- | --- |
| npm.cmd run test:phase-a | 86 PASS、0 FAIL |
| npm.cmd run test:phase-b | 22 PASS、0 FAIL |
| npm.cmd run test:phase-c | 17 PASS、0 FAIL |
| npm.cmd run test:no-go | 70 PASS、0 FAIL |
| 今回追加の独立lifecycle検査 | 17 PASS |
| 今回追加のstageLoading／name検査 | 3 PASS |
| 前回独立スクリプトの現行コード再実行 | 20 PASS、0 FAIL、最終記録errors=[] |
| FINAL-QA-01の独立検査 | **2 FAIL**。次guide保護と実FSM経路で同じP1を確認 |
| grade7正常／旧代用を現行503テストへ適用 | **各1 FAIL（期待どおりの検出）**。製品残件の2 FAILとは別 |
| node scripts/verify_stage_id_integrity.mjs | oldIdHits=0、参照整合OK |
| git diff --check | 終了0。既存の改行形式警告あり |
| 一時出力先への本番build | 終了0、Vite 5.4.19、6.02秒。main 523.11kB／gzip156.57kB、Tutorial別chunk 9.34kB |
| 原本SHA-256比較 | 156ファイル、差分0 |

独立追加検査の準備中、短期復習へ別学年のIDを渡したfixture、DOM撤去後の後片付け、存在しないunsubscribeのimport、cloud到達前の早すぎるassertに起因する失敗があった。これらは一時検査側を修正して再実行した。製品の不具合や合格証拠には数えていない。FINAL-QA-01の2 FAILはいずれも初期化成功・所定画面への遷移を確認した後の、対象副作用のアサーション失敗である。

証拠保存先（OS一時領域のため、長期保管時は別途保管すること）：

```text
C:/Users/socce/AppData/Local/Temp/yomitabi-code-go-qa-cdc2514632cf4288923898c70e21a329/
```

- `before-hashes.json`／`after-hashes.json`：原本照合。
- `phase-a.log`／`phase-b.log`／`phase-c.log`／`no-go.log`：今回の正式スイート実行。
- `fixture.mjs`、`independent-lifecycle.test.mjs`／同log、`independent-adjacent.test.mjs`／同log：今回の追加検査。
- `prior-independent.mjs`／同log、`independent-results.json`：前回独立スクリプトの今回の実行。
- `grade7-full-test-loader.mjs`、`grade7-full-healthy.log`／`grade7-full-fallback.log`、`grade7-worker-*.json`／`*.stderr`：検出力対照。
- `course-import-loader.mjs`、`course-late-repro.test.mjs`／同log、`course-fsm-repro.test.mjs`／同log：公開阻止P1の再現。
- `build.log`／`dist/`：今回の本番build。

主要な独立再現の実行例：

```powershell
$qa = 'C:/Users/socce/AppData/Local/Temp/yomitabi-code-go-qa-cdc2514632cf4288923898c70e21a329'
node --experimental-default-type=module --test "$qa/independent-lifecycle.test.mjs"
node --experimental-default-type=module --test "$qa/independent-adjacent.test.mjs"
node --experimental-default-type=module --test "$qa/course-fsm-repro.test.mjs"
```

最後のコマンドは現在のコードで対象アサーションがFAILする。`prior-independent.mjs`は各結果をJSONへ記録する方式なので、終了コード0だけで合格と読まない。

**後工程の品質確認として分離する事項**

実機レイアウト、実IME、実Storageの容量管理・強制終了、実Firebaseと公開設定、音の実聴、教材校閲、実際の子どもの操作理解は今回の合格範囲に含めない。ビルドのCJS／import混在／大きいchunk警告や既存の軽度な表現・テンポ差も、今回のCODE NO-GOの理由ではない。判定を止める根拠は、上記FINAL-QA-01の再現可能なP1である。
