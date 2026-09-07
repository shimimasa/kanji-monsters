# 漢字ヨミタビ REAUDIT-01／02 最終修正報告

作業日：2026-09-06（JST）  
対象：`main`、HEAD `d58c4ce116ba4b029de5fb36ebfb4629ed5a89f6` に、開始時から存在した作業ツリー変更を含む実装。

`YOMITABI_NO_GO_REAUDIT.md`を全文読み、現在のコードと障害再注入で原因を確認した。実施範囲はREAUDIT-01の所有権修正、REAUDIT-02のテスト改善、それらの再発防止テストと指定回帰確認。本書はコード修正・検証の報告であり、**最終GO／NO-GO判定は実施しない**。

## 1. REAUDIT-01の実際の根本原因

修正前の実`practice.enter()`は、既存の`this._lifecycle`をactivateし、ボーナス背景取得とTutorialManagerの動的importにそのguardを登録していた。その後に呼ぶ`battleScreenState.enter.call(this, canvasEl)`が、同じ`this`の`_lifecycle`へ別の新規所有者を代入していた。

親は置換前の所有者を停止しない。実`practice.exit()`と親exitが停止するのは置換後の所有者だけで、先に登録したPromiseのguardは有効なまま残る。再入場によるオブジェクト再利用でも、旧所有者の無効化にはならなかった。

実際のTutorialManagerとTutorialGuideを通すと、旧処理は`_start('practiceBattle', ...)`へ到達し、次画面のguideをdestroyしてbodyへ全画面overlayを追加した。画面IDとturnのマーカー自体が変化しなくても、次画面のDOMとguideへの干渉は起きる。ボーナス背景にも同じ所有権漏れを確認した。

さらに、派生画面からの初期化でも親が`battle`用チュートリアルを予約するため、新世代で`practiceBattle`と`battle`の双方が開始することも再現した。これは今回の「新しい画面世代に属するguideのみ最大1」という条件に関係する同じenter契約の問題として整理した。

## 2. 変更内容

- `battleScreen.js`に`_beginScreenLifecycle()`を追加。以前の所有者を停止し、入場ごとの新しい所有者を作成・activateする。
- 親`enter(canvasEl, onVictory, entryLifecycle = null)`に、派生画面が既に開始した所有者を受け取る契約を明記した。受け取った所有者を置換・再activateしない。
- `practiceBattleScreen.js`は非同期処理の登録より前にこの共通開始処理を呼び、得た所有者を親enterへ渡す。オブジェクト定義時のlifecycle生成を除去した。
- 親が直接入場した場合だけ`battle`チュートリアルを予約する。派生画面では入場元がチュートリアル開始を担当する。通常battleのimportも同じlifecycle.guardで管理する。

個々のPromiseへ`if (!this._active) return`を追加する対応にはしていない。製品側の変更はこの2ファイルだけで、教材ローダー、保存処理、ゲームバランス、UI、型・構成には変更を加えていない。

## 3. lifecycle所有権の整理

| 入場経路 | 所有者の作成 | 親初期化 | チュートリアル開始責任 | 離脱 |
| --- | --- | --- | --- | --- |
| 通常battle | battle.enterが新規作成 | 作成済み所有者を使用 | battle | battle.exitが停止 |
| practiceBattle | practice.enterの冒頭で新規作成 | 第3引数で同一所有者を共有 | practiceBattle | practice.exitと委譲先のbattle.exitが同一所有者を停止 |
| quickReviewPractice | 委譲先のpractice.enterがquick自身に新規作成 | practice経由で同一所有者を共有 | practiceBattle用ガイド | quick→practice→battleのexitが同一所有者を停止 |

有効な所有者は1回の画面入場につき1つ。親子は同じ入場を初期化するため同じ所有者を共有する。再入場では新しい所有者を作り、旧所有者のguardが新世代で有効になることを防ぐ。既存の二重deactivateは停止済み所有者に対して行われ、旧処理を再有効化しない。既存の通常戦闘用generation・managed timeout・levelUp停止処理は維持した。

## 4. REAUDIT-01の修正前FAIL／修正後PASS

追加した`tests/no-go/entry-lifecycle.test.mjs`で**製品のenter／exitを実行**した。親enterをスタブに差し替えていない。TutorialManagerの実import結果の受け渡しだけをテスト用ESM loaderで保留し、実際のguard、`startIfNeeded`、`_start`、`createGuide`、body.appendChildまで実行する。DOM・Canvas・Image・タイマーはNode内の制御可能な代用品。

修正前に最初の9ケースを実行し、8 FAIL／1 PASSを確認してから製品コードを修正した。同じ9ケースは修正後すべてPASS。さらに通常battleの正常なチュートリアル開始を確認する正の対照を追加し、最終10ケースすべてPASS。

| ケース | 修正前の観測 | 修正後の観測 |
| --- | --- | --- |
| CASE 1 practice.enter→import保留→exit→次画面相当→import完了 | **FAIL**。旧開始1、overlay追加1、次guide破棄1 | **PASS**。すべて0、次画面マーカーとguideを保持 |
| CASE 2 bonus練習enter→背景保留→exit→背景完了 | **FAIL**。次画面の背景マーカーが旧画像に置換 | **PASS**。旧背景反映0、マーカー保持 |
| CASE 3 enter→exit→即再入場、旧import→新import | **FAIL**。旧practiceガイドと新practice／battleガイドが開始 | **PASS**。新practiceガイド1だけ、overlay1 |
| CASE 3の逆順、新import→旧import | **FAIL**。旧ガイドが後から開始し新ガイドを破棄 | **PASS**。新ガイドの同一性を保持、旧開始0 |
| CASE 4 quickReviewPractice | 上記4条件でそれぞれ**FAIL** | 同じ4条件ですべて**PASS** |
| CASE 5 通常battle.enter→誤答→levelUp→exit | **PASS** | **PASS**。timeout／rAF／intervalが解除されtransform復元。捕捉したtimeout・rAFを後から実行してもマーカー不変、旧import開始0 |
| 正の対照：現世代の通常battle | 修正後に追加 | **PASS**。実battleガイド1、overlay1。全チュートリアルを止めただけでは通らない |

修正前のCASE 1のassert出力抜粋：

```text
expected: starts: 0, overlays: 0, destroyed: 0
actual:   starts: 1, overlays: 1, destroyed: 1
state:    stage: next-screen, turn: next-screen（双方同じ）
```

再実行コマンド：

```text
node --experimental-default-type=module --test tests/no-go/entry-lifecycle.test.mjs
```

`tutorial-import-loader.mjs`の文字列置換はimport結果を保留するための注入箇所。対象が1箇所でなければエラーにするが、文字列の存在自体を合格証拠にはしていない。合否は実画面処理と実ガイドが起こした副作用で決まる。

## 5. quickReviewPracticeへの影響

quickReviewPracticeはbasePractice.enter／exitへ`call(this, ...)`で委譲するため、修正前には同じ漏れが存在した。実quickReviewPractice.enter／exitによる遅いチュートリアル・ボーナス背景・再入場の両順序で確認した。

基底practiceの修正で同じ所有権契約が適用されるため、`quickReviewPracticeScreen.js`自体は今回変更していない。既存の復習対象選定、学習記録、次問予約は変更せず、既存のquick review学習記録テストもPASSした。

## 6. REAUDIT-02のテスト欠陥

開始時の`loading.test.mjs`は、固定30回のmicrotask待機後にclockを11,000ms進めていた。grade7のURLへ到達したこと、503を返したこと、失敗理由がその503であることをassertしていなかった。このため、先行処理のdeadline発火によるnullでも「grade7 fails explicitly」が通る。

今回も開始時のテスト内容を保存してから、メモリ上でgrade7の503注入先を`NEVER_REQUESTED`へ変更して再実行した。全応答を正常にしても旧テストは**誤ってPASS**し、実際の捕捉理由は次のtimeoutだった。

```text
BEFORE_TEST_FAILURE_REASON 読み込みが時間内に終わりませんでした。もう一度ためしてください。
ok 1 - NEW-06: grade7 fails explicitly, then retries all 88 defined pools
```

これは開始時テストの偽陽性を示す対照であり、現在の製品ローダーにgrade7代用が残っていたという意味ではない。

## 7. テストの改善内容

`loading.test.mjs`の教材取得4ケースを、明示的な応答注入と原因検証へ置き換えた。

- 正常系・503・不正JSON・明示的通信拒否では、`loadAllGameData()`自体の完了をawaitする。固定microtask回数と11秒clock進行は使わない。
- リクエストURL、HTTP status、本文読取状態、注入mode、AbortSignalを記録する。503は対象URLのHTTP失敗メッセージ、不正JSONは実際に注入したSyntaxErrorオブジェクト、通信拒否は対象URLを含む注入エラーを照合する。
- grade7のfetch保留／本文保留は、対象URL到達のPromiseをawaitし、他URLの本文完了を確認した後にだけclockを進める。9,999msでは未完了、10,000msで指定のtimeout、grade7だけabort。他教材のabortや異常は許容しない。
- 保留を後から解除してもgrade7は0のまま。正常fetchで同じローダーを再試行し、正常状態へ戻ることを確認する。
- 正常時は14の教材URL集合、grade7の313件とID集合、通常88ステージの定義ID集合、および各ステージの`kanjiPoolIdList`との完全一致を検証する。件数だけでは合格しない。
- grade7 503に加え、必須ステージ定義503も対象URLと理由を確認する。

製品APIの戻り値は成功時のデータオブジェクト／失敗時nullである。本テスト・本書の`success:true/false`はその結果をBoolean化した観測値で、製品APIへsuccessフィールドを追加していない。

SDK・ロゴ・stageLoadingの既存3テストは別条件であり、従来の待機処理を維持している。その固定待機は今回のgrade7対照の合格根拠には使わない。

## 8. 反事実対照による旧不具合の検出

`curriculum-fixture.mjs`の**同じ失敗oracle**を、独立したNode子プロセスの正常／現行503／旧fallbackへ適用した。子プロセスの任意の異常終了を合格扱いせず、観測したsuccess・grade7・URL・注入statusと、特定assertion・終了コードを照合する。

| 対照 | 実際の観測 | 失敗oracleの結果 |
| --- | --- | --- |
| CONTROL A 正常教材 | success:true、grade7=313、88ステージの定義と出題ID集合が一致 | 正常oracle PASS |
| CONTROL B grade7だけ503 | grade7 URLへ1回到達、503、本文未読、success:false、grade7=0、代用ステージpool=0 | 503 oracle PASS。原因は指定URLのHTTP失敗 |
| CONTROL C 正常なのに503失敗oracleを適用 | grade7応答200、注入なし、success:true、grade7=313 | **意図どおりFAIL**、終了1、`failed curriculum must not be a success` |
| CONTROL D 旧grade6代用を再導入 | grade7応答503、success:true、grade7=191、grade6=191 | **意図どおりFAIL**、終了1、同じassertion |

CONTROL C／Dを包む親テストのPASSは、「失敗すべき子のoracleが実際に指定理由でFAILした」ことを意味する。

CONTROL DではESM loaderが**メモリ上だけ**で上級取得失敗をgrade6代用に変更し、現在の最終catalog参照検証も外して、旧症状である「代用して成功」を再構成した。現在は参照検証も第二の防御なので、代用だけ戻した場合と混同しない。歴史上のコミット全体の復元ではなく、旧症状の反事実対照である。製品ファイルへの書戻しやテスト専用分岐はない。

## 9. NEW-01〜NEW-06の再検証

指定スイートに加え、前回の独立監査用障害注入スクリプトを今回の一時ディレクトリへコピーし、現在の製品モジュールで再実行した。前回の実行結果は流用していない。補助確認は20 PASS／0 FAIL、記録した予期しないエラー0。

| ID | 今回再注入した条件 | 結果 |
| --- | --- | --- |
| NEW-01 | 実入力購読で誤答→待機→再回答正解、誤答2回後の正解、連打 | PASS。誤答2／正答1だけ記録、正解の支援区分revealed、入力復帰 |
| NEW-02 | 練習完了時の空Enter／空`yomitabi:submit`で続行、実座標クリックで終了 | PASS。続行・終了で記録増加0、通常空欄は拒否 |
| NEW-03 | 通常攻撃／回復×正答／誤答。ジャーナル失敗と、正規save書込を継続失敗させて再試行 | PASS。失敗中の原文・HP・入力を保持／復帰、解除後同じ問題を1回記録 |
| NEW-04 | 学年クイズ正答／誤答、保存2回失敗→解除→連打再回答 | PASS。失敗中の記録と次問予約0、解除後各1 |
| NEW-05 | 390px幅、描画した戻るボタンから独立したcontain座標計算で中心・四隅付近をクリック、黒帯もクリック | PASS。ボタン内だけ反応。黒帯付き／比率一致の双方で確認 |
| NEW-06 | **今回改善したテスト**の正常・503・不正JSON・取得保留・本文保留・再試行・正常／旧fallback対照 | PASS。失敗理由の照合、grade7代用なし、正常313件と88ステージ集合一致 |

関連するタイトル保存失敗時の成功通知抑止も再実行。正規save書込を2回失敗させた間は成功通知0、解除後の保存で成功通知1。通常戦闘の既存timeout／rAF／敗北後exit、levelUp interval、reduced motion、学習表示の支援区分に関する既存・補助確認もPASSした。

## 10. E01／E02の再検証

**E01：原本保持**

架空のchild-Aとchild-Bを用意し、スロット1→2で次の書込をそれぞれ継続的にQuota失敗させた：`yomitabi_phase_a_pending`、`yomitabi_slot_data_1`、`krb_save`、`yomitabi_slot`、`yomitabi_storage_epoch`。

5条件とも`switchToSlot(2) === false`。元`krb_save`の原文、復習queueの原文、行先スロットの原文を保持し、現在スロットは1。元セーブに含む子どもの名前・回答記録・checkpointも原文一致で保持を確認した。phase-aの正常往復、破損行先、復元途中失敗のテストもPASS。

**E02：不正backup・破損saveの非上書き**

設定画面と同じ`saveNow(data, {replace:true})`入口へ`{}`、null、配列、未知version999、player型不正を注入し、すべて拒否、元セーブ原文一致。壊れたJSON、空文字、JSON null、未知版の保存原文には`loadSave()`と`loadGameData()`を実行し、原文を保持、正常データとして採用しないことを確認した。復元ミラーの書込失敗と有効な空saveの復元も既存phase-aでPASS。

実際のファイル選択UIや実Firestoreへ不正ファイルを送った試験ではない。コードの復元入口とメモリStorageへの障害注入による原本保持確認である。

## 11. 全テスト結果

最終状態で指定の4スイートをすべて実行した。phase-a／b／c実行後に調整したのは新規教材テストの期待集合だけで、製品コードと他スイートに変更はない。調整後のtest:no-goを再実行している。

| コマンド | 最終結果 |
| --- | --- |
| `npm.cmd run test:phase-a` | 86 PASS、0 FAIL、終了0 |
| `npm.cmd run test:phase-b` | 22 PASS、0 FAIL、終了0 |
| `npm.cmd run test:phase-c` | 17 PASS、0 FAIL、終了0 |
| `npm.cmd run test:no-go` | 70 PASS、0 FAIL、終了0 |
| 前回独立監査用障害注入の今回再実行 | 20 PASS、0 FAIL、記録エラー0 |

指定4スイート合計195 PASS。件数自体を品質の根拠とせず、第4節の修正前FAILと、第8節の失敗oracleの対照結果を検出力の証拠とする。

## 12. 本番build結果

`npm.cmd run build -- --outDir C:/Users/socce/AppData/Local/Temp/yomitabi-final-fix-4dbfc43c129e47ea8a3a7bdc19084c91/dist`を実行。通常のVite production buildを、既存distを保持するため一時出力先へ向けた。

**終了0、Vite 5.4.19、6.55秒で成功。** 主JS 523.11 kB（gzip 156.57 kB）、CSS 48.35 kB、TutorialManagerの分離chunk 9.34 kB。

CJS Node API非推奨、静的／動的import混在、500 kB超chunkの警告は残る。出力先がプロジェクト外のため自動emptyしない案内もある。今回の変更範囲ではこれらの構成は変更していない。デプロイは実施していない。

## 13. 変更ファイルと既存作業の保持

開始前にgit status、branch、diffを確認。既に多数の未コミット変更が存在したため、HEADとの差分全体を今回の変更とは扱っていない。開始時の`src/`、`tests/`、`public/data/`をSHA-256で保存し、終了時に比較した。既存ファイルの内容が変化したのは下記の製品2ファイルとloadingテストだけで、製品dataLoaderとquickReviewPracticeは開始時と同一。

| ファイル | 今回の変更 |
| --- | --- |
| `src/screens/battleScreen.js` | 所有者開始処理、親子共有契約、入場元ごとのガイド責任 |
| `src/screens/practiceBattleScreen.js` | 入場冒頭の所有者作成と親への引渡し |
| `tests/no-go/loading.test.mjs` | grade7の原因検証・正常対照・反事実対照 |
| `tests/no-go/entry-lifecycle.test.mjs` | 新規。実enter／exitのCASE 1〜5と通常battle正の対照 |
| `tests/no-go/helpers/tutorial-import-loader.mjs` | 新規。実import結果の受渡しを保留する試験用loader |
| `tests/no-go/helpers/curriculum-fixture.mjs` | 新規。URL記録、明示障害注入、共通oracle |
| `tests/no-go/helpers/grade7-counterfactual-loader.mjs` | 新規。メモリ上の旧fallback対照 |
| `tests/no-go/helpers/grade7-control-worker.mjs` | 新規。同じ失敗oracleを子プロセスで実行 |
| `YOMITABI_CODE_NO_GO_FINAL_FIX.md` | 本報告書 |

reset／checkout／revert／clean、コミット、既存distの上書きは実施していない。

証拠・開始時コピー・ログの保存先：

```text
C:\Users\socce\AppData\Local\Temp\yomitabi-final-fix-4dbfc43c129e47ea8a3a7bdc19084c91\
  before-hashes.json
  battleScreen.js / practiceBattleScreen.js / loading.test.mjs（開始時コピー）
  lifecycle-before.log / lifecycle-after.log
  loading-before-false-positive.log / control-d.log
  phase-a.log / phase-b.log / phase-c.log / no-go.log
  independent.mjs / independent.log / independent-results.json
  build.log / dist\
```

主要な再発防止テストと反事実対照はリポジトリ側に保存したため、一時ログが削除されても現在のコードで再実行できる。修正前の結果は本書の観測値と一時保存した開始時コピー・ログで区別する。

## 14. 残存リスク

- 今回のテストは遅いPromise、背景、タイマー、DOM副作用を再現するが、実ブラウザー全体のイベント順序・描画・タッチを網羅しない。
- 今後新しい派生画面が親enterを呼ぶ場合も、非同期処理を登録する前に所有者を開始して親へ渡す契約を守る必要がある。既存の通常戦闘全体の設計変更は行っていない。
- チュートリアルが離脱前に既に表示済みの場合など、今回指定された「保留したimportの離脱後完了」と異なる全経路の再監査は実施していない。
- 反事実対照とimport保留のloaderは対象コードの形が変わると明示エラーになる。その際は試験注入箇所を更新する必要がある。単なるloaderエラーを旧症状検出の成功とは扱わない。
- 既存の静的文字列確認テストには限界が残る。今回のREAUDIT-01／02はそれだけで合格扱いにしていない。
- 本書の確認範囲を超える過去監査の残件やbuild警告について、新たな改善には着手していない。

## 15. 実機でのみ確認可能な事項

実端末の実IME、ソフトキーボード、タッチ座標とoverlayの見え方、ブラウザーの画面離脱・復帰順序、OSのreduced motion設定の伝達、実ストレージ容量不足、実Firebase、公開環境のキャッシュ／通信、実際の子どもによる試遊は未確認。これらをコード上の障害注入結果と混同しない。

今回の作業は上記のコード修正とテスト改善までで終了する。
