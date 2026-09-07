# 漢字ヨミタビ — 2D Stable Baseline

評価日：2026-09-07（JST）  
対象：`main` の HEAD `d58c4ce116ba4b029de5fb36ebfb4629ed5a89f6` **と、評価開始時の未コミット・未追跡の製品コード／教材／テストを合わせた作業ツリー**。  
今回の成果物：本書のみ。実装・描画・教材・テストの編集、依存追加、Gitへの書込み、公開作業は実施していない。

## 1. Baseline概要

**現在の作業ツリーを2D Stable Baseline候補として採用できる。定義と今回のコード検証は完了したが、Git上の復帰基点は未確定である。3D Vertical Sliceは、品質改善を含むcommitとtagを別工程で確定し、そのcommitだけからテスト・buildを再現してから開始する。**

これは「現在の学習ゲームの意味と回帰条件を保つ基準」であり、全端末で完成した公開版の認証ではない。分類単位はファイル全体ではなく責務・処理ブロックとする。同じファイルにKEEP、INTERFACE、REPLACEABLEが混在する。

指定の6文書を読み、現在の保存・学習・入力・教材・Tutorial・戦闘・画面遷移のコードと、正式テストの対象・assertを照合した。調査は交換境界と既存品質修正への依存を中心とし、全素材・全教材の人的校閲や全実行経路の証明ではない。

| 文書 | 履歴としての位置づけ／今回への引継ぎ |
| --- | --- |
| [YOMITABI_QUALITY_AUDIT.md](YOMITABI_QUALITY_AUDIT.md) | 元37項目。E01/E02の原本保護、学習記録、入力、離脱等の完了条件の出発点 |
| [YOMITABI_V1_REGRESSION_AUDIT.md](YOMITABI_V1_REGRESSION_AUDIT.md) | A/B/C後のNEW-01〜06。共通関数や文字列検査だけでは画面の回帰を防げなかった証拠 |
| [YOMITABI_NO_GO_REAUDIT.md](YOMITABI_NO_GO_REAUDIT.md) | NEW-01〜06の修正確認後、REAUDIT-01の練習所有権漏れとREAUDIT-02の教材テスト検出漏れを発見 |
| [YOMITABI_CODE_GO_FINAL_AUDIT.md](YOMITABI_CODE_GO_FINAL_AUDIT.md) | FINAL-QA-01：コース選択離脱後の旧Tutorialを発見。当時はCODE NO-GO |
| [YOMITABI_CODE_GO_DECISION.md](YOMITABI_CODE_GO_DECISION.md) | FINAL-QA-02：resultWin → stageSelectで旧Tutorialを発見。当時はCODE NO-GO |
| [YOMITABI_TUTORIAL_FINAL_QA.md](YOMITABI_TUTORIAL_FINAL_QA.md) | 全12画面の開始所有権等を確認しCONDITIONAL CODE GO。位置のP2と実環境未確認を分離し、Baseline工程を許容 |

古いNO-GOの見出しを現在の未修正状態と読み替えない。一方、最新QAの「全12画面」はTutorial開始経路の範囲であり、全画面の全asyncの安全保証へ拡大しない。最終QAの独立97件は過去の追加証拠として参照し、**今回再実行した268件に加算しない**。

## 2. 現在のGit状態

### 2.1 評価開始時の確認

| 項目 | 観測値 |
| --- | --- |
| branch | `main`（upstream：`origin/main`） |
| HEAD | `d58c4ce116ba4b029de5fb36ebfb4629ed5a89f6` |
| ローカルのorigin/main | HEADと同一。ahead / behind = `0 / 0` |
| staged | 0件。`git diff --cached --stat`は空 |
| 追跡済み未コミット変更 | 54ファイル。削除・競合の表示なし、全て作業ツリー側の変更 |
| 未追跡 | 79ファイル（`--untracked-files=all`）。本書追加前の値 |
| 追跡済み差分量 | 5,733行追加／2,857行削除。うちFirebase cacheが3,900行追加／868行削除。未追跡ファイルの内容は含まない |
| Gitの確認範囲 | status、rev-parse、log、rev-list、diffの読み取り。fetchしていないため、リモートサーバーの最新状態までは未確認 |
| 環境 | Windows、Node.js `v22.14.0`、npm `10.9.2`、build時Vite `5.4.19` |

Gitがユーザー共通ignoreを読めない警告、および既存LF/CRLF警告を出した。リポジトリ内の状態と差分を確認し、`git diff --check`は終了0。ユーザー共通ignoreの内容は未確認で、未追跡一覧はこの環境での観測値である。

### 2.2 HEADに既にある主要変更

| commit | 日時（JST） | 内容 |
| --- | --- | --- |
| `d58c4ce` / `9889ce2` | 2026-09-05 13:38 / 13:30 | ボーナス名統一、地図で重なるピン整理のmerge／実装 |
| `b670ccc` / `98d8905` | 同日11:50 / 11:43 | 力だめしの背景を学年のステージ画像にするmerge／実装 |
| `ae7efce` / `8b0b30a` | 同日11:29 / 11:27 | 力だめし画面刷新・画面崩れの修正 |
| `26f6a50` | 同日11:27 | 弱点の読み系統限定を既定OFFへ変更 |

**後続の品質改善はまだこのHEADにない。** 例えばHEADのpackage.jsonには今回の正式4テストコマンドがなく、新しい保存・入力・lifecycle等の18モジュールとtests全体も未追跡である。HEADへのtagだけでは、今回合格した状態へ戻れない。

### 2.3 未コミット変更の棚卸し

以下は追跡済み54ファイルの全内訳。パスはルート相対、同じ行内では記載ディレクトリを共通接頭辞とする。

| 群 | 変更ファイル | 意味／扱い |
| --- | --- | --- |
| ルート等（9） | `.firebase/hosting.ZGlzdA.cache`、`README.md`、`firebase.json`、`index.html`、`manifest.json`、`package.json`、`public/sw.js`、`style.css`、`vercel.json` | cache以外は製品説明、起動・入力表示、配信・旧SW退役、正式テスト登録。cacheは生成物 |
| 教材（8） | `public/data/`：`kanji_g5_proto.json`、`kanji_g6_proto.json`、`kanji_g7_proto.json`、`kanji_g8_proto.json`、`kanji_g9_proto.json`、`kanji_g10_proto.json`、`stages_proto.json`、`stages.bonus.json` | 衝突ID・参照修正とステージpool。コードのID移行と一組 |
| 保存・モデル（7） | `src/core/`：`gameState.js`、`reviewExport.js`、`saveData.js`、`saveSlots.js`。`src/models/`：`kanjiDex.js`、`monsterDex.js`、`reviewQueue.js` | セーブ保護、統合記録、復元、SRS、CSV |
| 起動・ロード・音・cloud（6） | `src/main.js`、`src/audio/audioManager.js`、`src/loaders/assetsLoader.js`、`src/loaders/dataLoader.js`、`src/services/firebase/dataSync.js`、`src/services/firebase/firebaseController.js` | ローカル起動、取得失敗・期限、音切替、cloud文脈 |
| 画面（18） | `src/screens/`：`battleScreen.js`、`courseSelectScreen.js`、`gradeQuizScreen.js`、`playerNameInputScreen.js`、`practiceBattleScreen.js`、`profileScreen.js`、`quickReviewPracticeScreen.js`、`regionSelectScreen.js`、`resultWinScreen.js`、`reviewStage.js`、`settingsScreen.js`、`stageLoadingScreen.js`、`stageSelectScreen.js`、`titleScreen.js`、`worldStageSelectScreen.js`、`Dex/kanjiDexScreen.js`、`Dex/monsterDexScreen.js`、`battle/theme.js` | 共通処理への接続、失敗時入力復帰、画面離脱、Tutorial、操作矩形と学習表示 |
| Tutorial・UI・入力補助（6） | `src/tutorial/tutorialData.js`、`src/ui/bootProgress.js`、`src/ui/kanaPad.js`、`src/ui/uiRenderer.js`、`src/utils/coordinateUtils.js`、`src/utils/readings.js` | 案内、再試行UI、かなパッド確定、座標・読み処理 |

未追跡79ファイルは次の内訳。

| 群 | 数 | 内訳／所在 |
| --- | ---: | --- |
| 新しい製品モジュール | 18 | `src/core/`の`answerSubmission`、`asyncDeadline`、`battleBalance`、`battleRetry`、`frameClock`、`kanjiIdMigration`、`learningOutcome`、`learningPresentation`、`saveBootstrap`、`saveProjection`、`saveValidation`、`screenLifecycle`、`storageTransaction`（全て`.js`）。`src/services/firebase/`の`cloudSave.js`、`sdkLoader.js`。`src/ui/`の`learningControls.js`、`motionPreferences.js`、`viewportLayout.js` |
| テストとhelper | 44 | 34個の`.test.mjs`と10個のhelper。§10に全テストファイルとhelperを列挙 |
| 文書 | 16 | ルートの監査・修正報告・計画15件と`docs/PHASE_A_DATA_MIGRATION.md`。§11で保存対象を列挙 |
| 個人環境設定 | 1 | `.claude/settings.local.json`。Baselineの製品構成へ含めない |

### 2.4 今回実行したテストとbuild

| コマンド | PASS | FAIL | 終了 |
| --- | ---: | ---: | ---: |
| `npm.cmd run test:phase-a` | 86 | 0 | 0 |
| `npm.cmd run test:phase-b` | 22 | 0 | 0 |
| `npm.cmd run test:phase-c` | 17 | 0 | 0 |
| `npm.cmd run test:no-go` | 143 | 0 | 0 |
| 合計 | **268** | **0** | — |
| `node scripts/verify_stage_id_integrity.mjs` | oldIdHits=0、参照整合OK | — | 0 |
| `git diff --check` | 差分検査成功 | — | 0 |
| `npm.cmd run build -- --outDir <今回の一時領域>/dist` | build成功、4.51秒 | — | 0 |

全スイートのcancelled / skipped / todoは0。正式no-goにTutorial Matrix54件が含まれ、二重加算しない。no-goログでは既知のresultWin centerBox fallbackも観測された。

buildは既存`dist/`を出力先にしていない。mainは523.94kB（gzip156.71kB）、Tutorial chunkは9.34kB（gzip4.42kB）、CSSは48.35kB。CJS API、static/dynamic import混在、500kB超chunkの既存警告がある。依存の再インストールはせず、現node_modulesでの実行結果である。

証拠保存先：`C:/Users/socce/AppData/Local/Temp/yomitabi-2d-baseline-17b7912597304941910de10bfa95f137/`。開始時status、開始・終了時SHA-256、4スイートの`test-phase-a.log`／`test-phase-b.log`／`test-phase-c.log`／`test-no-go.log`、`build.log`、`stage-integrity.log`、`diff-check.log`を保持する。OS一時領域のため恒久保管とはみなさず、主要な結果と契約は本書に残す。

原本保持の最終確認：`src/`、`tests/`、`public/`、`scripts/`、`docs/`、`.claude/`、`.firebase/`とルート既存ファイルの**4,161ファイルを開始・終了時SHA-256で比較し、変更0**。Git statusの増分は本書1件のみで、HEADは同一、stagedは空のまま。終了時の未追跡数は本書を含め80件。14章と全44テスト／helperの文書掲載、文書リンクの存在も確認した。

同じHEADで異なる作業ツリーを取り違えないため、評価対象の主要ファイルのSHA-256を補記する。これは現在のファイル原文の指紋であり、将来のGit改行正規化後のblob hashとは別物である。

| ファイル | SHA-256 |
| --- | --- |
| `src/screens/battleScreen.js` | `B9D489A137A7DAE6F9F70B4CC62543CDFF7FF1E6F821015142347DFAC45AE8B6` |
| `src/core/gameState.js` | `CFAE58791F95545881C4F12854A848657BC91D0CD5EB153DA60088A27000AECA` |
| `src/core/saveData.js` | `6E7A66933E58FF33351225E77CB84CE1E57A691ADB6392E72B58E4E3D0AF0007` |
| `src/core/answerSubmission.js` | `4DA2B6534EA2A90CFCF0CBD44F6D5E1DB428349995E2D9C542B275942DDC0B44` |
| `src/core/learningOutcome.js` | `D1EAB57D6C9F484D5EB281666FFE027AE5114A8C3F00361E916E60B9A327D090` |
| `src/core/screenLifecycle.js` | `6B6776B3EDBCEDD22C3751658AA2F53835BDD2966F604D0F68F84766345D785D` |
| `package-lock.json` | `CD00E39CFB76D2A1C602948616A688476E9C77E335D7C2B295AB630E358E4B74` |

## 3. KEEP

**KEEPは3D表示の都合で意味・学習範囲・保存互換・難易度を変えない責務。** 将来の独立した不具合修正まで禁止する意味ではないが、3D変更に紛れ込ませない。

| 対象 | 現行実装 | 保持する意味 |
| --- | --- | --- |
| 漢字教材・ID | `public/data/kanji_g*_proto.json`、`kanjiIdMigration.js`、`dataLoader.js` | 2,136字、ID一意、9組の旧衝突の移行・曖昧原本保全。3DモデルIDへ漢字IDを転用しない |
| 読み判定・出題制約 | `utils/readings.js`、`core/readingScope.js`、`core/exampleMode.js`、battleの`getQuestionScope`／正誤処理 | かな正規化、近似入力の再回答、例文優先、弱点限定設定。登録された読みの想起という学習目的 |
| 学習記録・支援区分 | `gameState.js`、`learningOutcome.js`、`reviewExport.js`、各学習画面 | 1回答1記録、sourceと支援の分離、自力判定、旧累計を推測で再分類しない |
| 復習・SRS | `models/reviewQueue.js`、`battleRetry.js`、`reviewStage.js` | その場の再出題と翌日以降の予定を区別。既存項目の再誤答を反映、復習0件でボーナスへ迂回しない |
| 練習・短期復習・学年クイズ | `practiceBattleScreen.js`、`quickReviewPracticeScreen.js`、`gradeQuizScreen.js` | 誤答後に正式な再回答、支援ありの記録、完了時の続行／終了、今回のクイズ範囲の結果 |
| 保存・スロット・バックアップ | `saveData.js`、`saveSlots.js`、`saveValidation.js`、`saveProjection.js`、`storageTransaction.js`、`saveBootstrap.js` | `krb_save`を正史とするv2、3スロット、復元時の空状態置換、失敗時原本と復旧情報保持 |
| cloud整合 | `services/firebase/cloudSave.js`等、save context | slot／epoch／revisionの検査。遅い応答で別の子や新状態を上書きしない |
| 学年・ステージ選択 | 選択画面群、`stageData`、`bonusManager.js` | 通常88面の定義pool、grade1〜10の既存範囲、ボーナスの解放条件と敵編成 |
| 進行・ゲームルール | battleの攻撃／回復／敵行動／撃破、`battleBalance.js`、result／capture画面、`sessionTimer.js` | HP・盾・弱点・コンボ・EXP・回復回数、旗5、クリア一回確定、捕獲、学年内難度、既定じっくり、タイムのbalance版分離 |
| 図鑑・達成・設定の意味 | `models/`、図鑑・プロフィール・結果・設定画面、`achievementManager.js` | 収集と習得を混同しない。支援込み／今回範囲を正しく表示し、設定を保存・復元する |

§3のKEEPには`battleScreen.js`内のロジックも含む。`src/core/`だけがゲームロジックという分類にはしない。

## 4. INTERFACE

以下の「現行契約」は実際に使われている入出力と副作用。純粋関数でないものはその旨を明記する。将来Adapterの構造案は§9で別に示す。

| 境界／入口 | 入力 | 現在の返り値・状態変化／維持条件 |
| --- | --- | --- |
| 教材初期化 `dataLoader.loadAllGameData()` | 引数なし。現在のローカルJSONとfetch | 共有Promise。成功で`{kanjiData, enemyData, stageData}`、読込内部で捕捉した失敗は`null`、公開配列等を空へ戻し次回再取得可能。返却`kanjiData`は主にgrade1〜6で、全学年の検索は学年別getterを通る |
| `getKanjiByStageId(stageId)` | canonical化可能な既存stage ID | 漢字オブジェクト配列。通常定義の`kanjiPoolIdList`優先、`bonus_gN`は当該学年全体。旧・定義外IDの学年fallbackは残るが、**取得できない別学年をgrade6で代用しない**。返却データをRendererで書き換えない |
| `getKanjiByGrade(grade)` / `getKanjiById(id)` | 学年番号／漢字ID | 配列（未取得なら`[]`）／漢字オブジェクト（未知IDなら`null`）。漢字は`id, kanji, grade, onyomi, kunyomi, meaning, strokes, examples`等を持つ。`examples`等は任意 |
| `getEnemiesByStageId(stageId)` | 既存stage IDと暗黙の練習進捗・設定・乱数 | 敵オブジェクト配列。通常は敵catalogをfilterする順、ボーナスは最大5体と幻置換。`gameState.__bonusPhantomInfo`も書くので純粋getterではない。通常のID接頭辞／北海道代替経路も残る。出現規則はKEEP |
| `getMonsterById(id)` / stage参照 | モンスターID／`stageData.find(s => s.stageId === id)` | monsterオブジェクトまたは`null`／stageまたは`undefined`。敵の`id,name,weakness,isBoss,grade,exp`等とstageの`stageId,name,grade,enemyIdList,kanjiPoolIdList`を意味契約とする。外見resourceは別対応表へ |
| `computeEnemyParams(options)` | `isBoss,stageIndex,playerLevel,playerAtk,playerMaxHp` | `{hp,atk,level,exp}`。battle.enterが敵cloneへ適用する。`getBossShieldHits(stageIndex)`は1〜3、`stageBestTimeKey(id)`は`id@balance-2` |
| `pickNextKanji()` | 引数なし。stage pool、敵弱点、直近履歴、学習統計、retry queue | 成否boolean。成功時`gameState.currentKanji`を`{_recordQuestion,id,text,onyomi,kunyomi,readings,...}`として生成し、ヒント・近似回数・再出題待ち・入力ゲート等を更新。**問題オブジェクトを返すAPIではない** |
| `classifyReadingAnswer(raw, readings)` | 入力文字列と許可された読みの配列 | `{kind,normalized,nearMiss}`。kindは`blank/correct/near-miss/incorrect`。通常battleはこの関数の直呼びではなく`toHiragana`＋scope照合＋wrong-system／near-miss処理を使う |
| `bindInputSubmission(inputEl,onSubmit,options)` | DOM input、確定callback、任意のcommand | controller（`submit,handleKeydown,unlock,dispose`等）。`{accepted,reason}`を返す。composition／229／inactive／locked／blankを拒否、callbackのtrueでロック維持。`yomitabi:submit`も同じ入口 |
| `commitLearningOutcome(id,isCorrect,context)` | 漢字ID、正誤、`question,source,reading,hintLevel,answerRevealed` | 成功`{ok:true,quality,independent}`。拒否`{ok:false,reason:'duplicate'}`、保存失敗`{ok:false,reason:'save',error}`。記録とSRSを保存し、失敗はメモリとトークンも巻き戻す |
| attack／healの結果 | DOM回答＋現在問題・敵・player・設定・乱数 | 現状、公開された`DamageResult`戻り値はない。`handleAttack/handleHeal`→内部関数がHP／盾／combo／記録／演出／予約を直接変更する。結果は確定後の状態差として観測。Rendererが再計算しない |
| `saveGameData(updateSnapshot?)` / `saveNow(save,options?)` | メモリ状態と任意の候補編集callback／save候補、明示replace等 | 同期で保存結果を返す。`ok`を確認してから成功扱い。`loadGameData()`は非同期booleanで、検証済み保存からメモリ・ミラーを再構築 |
| `switchToSlot(next)` | 整数1〜3 | boolean。同じ番号、不正番号、不正行先、保存失敗はfalse。成功は退避・行先復元・番号・epochの更新。呼出側はその後ページ再読込で旧メモリを残さない |
| `loadBgImage(stageId)` / `loadMonsterImage(enemy)` | stage ID／既存敵データ | 2D Image取得Promise、`images['bg_'+id]`／`images[enemy.id]`へのcache。代替／失敗処理を持つ。これは2D向け資源APIであり、Meshを同じ戻り値へ混ぜない |
| `createScreenLifecycle()` | activate、各callback登録、deactivate | activateは世代を返す。guardは予約時世代＋activeを検査。timeout／rAFは離脱で解除。Renderer側の追加ロードにも同じ所有期間が必要 |
| screen entry | 通常battle：`enter(canvas,onVictory,entryLifecycle?)` | statefulな初期化、`update(dt)`、`exit()`。練習は先に得た同じlifecycleを親へ渡す。onVictoryは現在の進行判定から呼ばれ、描画成功のcallbackではない |
| EventBus | `publish(event,payload)` | returnはundefined。**payloadは1個だけ**。subscribeも解除関数を返さない。3Dフレームごとの購読追加で多重登録しない |
| 画面遷移 | `changeScreen`の文字列、`{name,props}`、`[name,props]` | `setupFSM`が正規化、旧exit→新enter。stage ID直接指定はbattleへ補正。`publish('changeScreen','resultWin',resultData)`の第3引数は現状届かず、結果／捕獲画面はgameStateの補完に依存 |
| 音 | `playSE`／`playBGM`へ既存key、`stopBGM`へduration、`Speech.speak(reading)` | 音の副作用。`main.js`がAudioへ接続。旧BGMフェード完了は開始時の音声だけを止める。毎フレーム再生せず回答・出現等の出来事に対応 |

ダメージの保持対象は、攻撃力、既マスター問題の一回2倍、±10%乱数と丸め、弱点1.5倍、5コンボ1.5倍とリセット、盾中の弱点正解は盾−1／HPダメージ0、弱点外正解はHPダメージ1、HP下限0。敵攻撃は`atk || 5`でplayer HPを減らす。回復は現在の`calculateHealAmount()`と設定・回数・最大HP制限を維持する。**3Dの接触判定やアニメーションイベントは正誤・ダメージの入力にしない。**

## 5. REPLACEABLE

| 置換可能な表示 | 現在の箇所 | 置換時に残す依存／制約 |
| --- | --- | --- |
| 戦闘背景の画像・グラデーション | `battleScreen.js:1208`付近 | stage IDを受けて見た目を選ぶだけ。教材pool、ステージ進行、取得失敗判定を背景都合で変えない |
| モンスター画像と見た目の動作 | 同`:1301`〜、`:1470`付近 | `currentEnemy.img`、enemyAction／timerからの位置・回転・alpha。敵ID、HP、弱点、盾、出現順はKEEP |
| モンスター枠・シールド外観 | `drawMonsterFrame`（`:6416`）、盾描画 | 見た目は交換可能。ただしframe関数は表示矩形を返し、`_lastMonsterFrameArea`をシールド破壊演出が参照。矩形提供を失わせない |
| 石版・攻撃・被弾・盾破壊の装飾 | `startStoneAttackEffect`、`startFlashEffect`、shake／shield描画 | 開始関数と描画更新には状態変更が混在。装飾だけを分離し、問題・HP・入力復帰・予約を所有させない。reduced motionの重点契約を維持 |
| 装飾粒子・枠・光・影 | draw系helper、`successParticles`等 | 視覚表現は交換可能。EXP粒子系はキューから実EXPへ至る接続があるため**丸ごと削除／置換可ではない** |

学習UIの全文、入力欄、ボタン、HPの意味、ヒントの情報量、答え表示、ふりがなをまとめてREPLACEABLEにはしない。最初のSliceは既存2D UIとDOM入力を維持する。3D化しても、実績通知・捕獲・図鑑で使う2D素材は必要なので、画像資産の一括削除は対象外。

## 6. UNKNOWN

UNKNOWNは未分類の業務ロジックではなく、現在の2Dコードだけで3Dとしての成立を判定できない選択肢である。

| 判断保留 | Sliceで必要な証拠 |
| --- | --- |
| 2D UIと3D表示の合成方式、canvasの分割・サイズ・透過 | 漢字、入力、ボタン、通知、Tutorialの前後関係とcontain座標が維持される実表示。現gameCanvasの2D contextを単に3Dへ変更する案は適用不可 |
| 全モンスターの立体表現、モデル対応表、接地・サイズ・カメラ | 代表敵での視認性、既存IDとの対応。全素材のモデル化可否は未判断 |
| 実端末のGPU負荷、メモリ、復帰、context喪失、起動時間 | 対象端末での測定。2Dのbuild成功やNodeのtimer試験では代替しない |
| 演出待ちの抽出後の挙動 | 撃破、敵交代、旗5、EXP、捕獲→結果、再入場を、演出完了・未完了・重複・離脱の条件で比較 |
| 既存EXP演出キューの稼働範囲 | 通常撃破は即EXP反映だが旧キュー処理も生きている。全呼出元と練習継承への影響を抽出時に検証 |
| 最終敵撃破の複数予約・イベント補完への影響 | 現コードは捕獲への予約とstageClearPendingへの予約を並行して持つ。実exitが後続処理を無効化し得るため、見かけだけで単一勝利経路へ整理しない。今回、これを新たな再現済みP1とは認定していない |
| Tutorial anchorの3D対象への追従 | 初期Sliceでは2D学習UIのanchorを維持。3Dオブジェクトを指す必要性・カメラ追従方式は未判断 |
| ランダムな出題／戦闘と描画の分離 | 現在Math.randomを抽選・ダメージ・描画が共有。同じ時間だけ再生しても同一乱数列を再現できない。検査では論理入力に使う乱数条件を固定して式・候補集合を比較する |

これらの不確定性を解消する目的のVertical Sliceは可能。解消前に全面3D化へ拡大する根拠にはしない。

## 7. PROTECTED CORE

**次の領域は3D表示を作るために意味挙動を変更する必要がない。3D branchで変更する場合、理由と回帰テストを必須とする。** ファイル名だけでなく、各画面内の呼出順・失敗分岐も保護する。

| ID | 保護対象と所在 | 3Dのために変更が必要か／不変条件 |
| --- | --- | --- |
| PC-01 | E01：`saveSlots`、`storageTransaction`、settingsの切替入口 | 不要。退避／復元／番号／epoch失敗で元の子の原本と現slotを保ち、journalによる復旧可能性を残す |
| PC-02 | E02：`saveData`、`saveValidation`、`saveProjection`、バックアップimport/export | 不要。不正JSON・未知版・型不正は拒否、破損原文を既定saveで潰さない。有効な空backupは空へ置換。退避失敗では復元しない |
| PC-03 | E04/E05：`saveBootstrap`、gameStateのhydrate／context、`cloudSave`／SDK／controller | 不要。初期saveを復旧前に作らず、明示復旧・期限・isCurrent・slot/epoch/revisionを保持。同期の都合で描画を永久待機させない |
| PC-04 | E07：漢字JSON、stage参照、`kanjiIdMigration` | 不要。旧衝突9組は証拠がある分だけ移行。不明分を`legacyAmbiguousKanji`に保持し推測分配しない |
| PC-05 | 学習記録・T04：`beginQuestion`、`recordKanjiAnswer`、`commitLearningOutcome`、各画面のcommit前後 | 不要。同一tokenは一回、新しい正式再回答は別token。保存成功前に正誤リスト・combo・statsを進めない。失敗後は同じ問題を再試行可能 |
| PC-06 | 復習・T02/T03：`reviewQueue`、`battleRetry`、`reviewStage`と復習入口 | 不要。初回誤答は次の午前4時、既存再誤答は翌日相当へ戻す。弱点候補外の予約保持、空復習で解放条件迂回なし |
| PC-07 | ヒント分類：`learningOutcome`、battle／practice／quick／review／quiz、CSV／結果表示 | 不要。`independent/hint1/hint2/hint3/revealed/unknown`を保持。qualityは正答hint0=5、1=4、2/3=3、答え表示・誤答=1。near-missの答え提示や練習誤答後を自力へ格上げしない |
| PC-08 | 入力ゲート・IME：`answerSubmission`、`kanaPad`、名前と各学習画面の購読 | 不要。composition、isComposing、229で送信しない。連打一件、空回答拒否、完了commandだけ空入力可、dispose後無効 |
| PC-09 | Tutorial lifecycle：全12画面のenter／exit、`screenLifecycle`、Manager／Guide | 意味変更不要。通常／練習／quickの同一所有者共有、resultの先行await世代確認、遅い旧importによる開始・overlay追加・現guide破棄0。正常未読開始と既読／無効設定も維持 |
| PC-10 | 画面離脱後async：battleの`_generation`／managed timeout、levelUp interval、各画面lifecycle | 意味変更不要。新しいRendererの資源破棄を同じ寿命へ接続する追加は必要になり得るが、既存guard・取消を外さない。旧callbackでHP・問題・遷移・Canvas／DOMを変更しない |
| PC-11 | 教材取得失敗：`dataLoader`、`asyncDeadline`、起動・stageLoading | 不要。grade7の503／不正JSON／reject／fetch・本文保留を失敗として扱い、10秒期限、遅い成功無視、正常再取得を維持。3D資産不足で教材を代用しない |
| PC-12 | stage progression：旗5、`stageRun`、`recordStageCleared`、result／capture、`bonusManager`、学年選択 | 不要。クリア後の旗解除、同run重複加算なし、別run再クリア＋1。敵の見た目で進行・収集・解放を決定しない |
| PC-13 | 学習表示・操作座標・動き軽減 | 見た目の変更は可能だが契約維持。答えとヒントの意味、44 CSS pxの主要操作、DOM入力48px、黒帯を含む座標、既存reduced motion重点経路を壊さない |

変更ルールは次の順とする。

1. 差分に該当PC-ID、関数・呼出元、変更理由、表示Adapterだけでは足りない理由を記載する。単に「3D用」は理由にしない。
2. 期待する意味が変わらないことを、変更前の2D基点と比較する回帰条件として先に定義する。既存症状なら元監査IDを添える。
3. 正式4スイートとbuildを維持し、触る境界の実enter／exit・入力・失敗注入試験を通す。新しいasyncには旧→新／新→旧の完了順、離脱後完了、正常完了を含める。
4. 変更理由と試験結果をレビュー可能な差分として残す。意味を変える独立修正は3D演出の差分と分け、元のBaseline tagは更新しない。

## 8. 現在のGame Logic / Presentation構造

### 8.1 実際の呼出経路

```text
main.loop(now)
  ├─ frameClock.tick → logicDeltaMs / playtimeDeltaMs
  ├─ screenManager.update → window.fsm.update
  │    └─ battleStateFactory.update → battleScreen.update(dt)
  │          ├─ 敵演出timer更新、EXPキュー処理、勝利遷移判定
  │          └─ 背景・モンスター・漢字・UI・演出を同じ2D ctxへ描画
  ├─ screenManager.render → 現FSMにrenderがなく通常は処理なし
  └─ 実績通知をmainの2D ctxへ描画

DOM入力 / Canvasボタン / かなパッド
  → answerSubmission → attack / heal / 各画面の採点
      → 読み・scope判定 → commitLearningOutcome → save + SRS
      → 成功した回答のゲーム状態変更 + UI/SE/演出の直接呼出し
      → managed timeout / 撃破待ち → 敵交代・次問・画面遷移
```

`screenManager.render`という名前の関数はあるが、現行`core/fsm.js`にはrenderメソッドがない。ここを差し替えるだけでは既存戦闘描画を置換できない。

### 8.2 責務別の所在と結合

| 責務 | 現在の実装・主な位置 | 分類と結合 |
| --- | --- | --- |
| ゲーム状態 | `gameState.js:46/73`のbattleState／gameState、battleScreenStateの各プロパティ | GAME LOGICと表示stateが複数objectへ分散。currentEnemyにはHPとImageが同居 |
| 漢字問題選択 | battle`:5727` pickNextKanji、`:5791`重み抽選、`:5847`pickFromPool | GAME LOGIC。敵弱点pool、直近5問、重み3/4/2/1、再出題予約。最後にゲート解除とログ表示も行う |
| 入力 | battle.enter`:915`付近、`:3458`registerHandlers、handleClick、DOM input | INTERFACE／PROTECTED。ボタン矩形は毎回共通layoutで更新。CanvasとDOMを両方使う |
| 正誤判定 | `getQuestionScope:4708`、`onAttack:4815`、`onHeal:5399` | GAME LOGIC。近似・別読み系統は再入力。学習commitとDOM装飾が同じ関数に混在 |
| ダメージ計算 | onAttackのbaseDamage以降、`enemyTurn:5688`、`calculateHealAmount:6200` | GAME LOGIC。式・状態適用・SE・盾破壊座標・待ち予約が隣接 |
| 敵状態 | enter`:965`付近でclone→難度適用、`spawnEnemy:4625`、撃破分岐 | GAME LOGIC。loader順、最後の敵のboss補完、盾初期化、画像cacheの注入を同時に行う |
| player状態 | gameStateのHP/EXP等、onHeal、`addPlayerExp`、`updatePlayerExp:6099` | GAME LOGIC。ゲーム上のHPと`playerHpDisplay/Target`は別。表示値をHP計算へ戻さない |
| アニメーション | update、enemyAction／timer、各effect、`waitForDefeatAnimationThen:5977` | 混在。敵timerをupdateで減らし、撃破待ちはrAFと2秒上限、世代検査、一回実行で後続ゲーム処理を解放する |
| モンスター描画 | update`:1301`〜、`drawMonsterFrame:6416` | PRESENTATION。返すframeAreaが盾破壊位置に使われ、描画がレイアウト情報供給も兼ねる |
| 背景描画 | update`:1208`、`stageBgImage`、assets cache | PRESENTATION。練習も同じロード資産と親初期化を利用 |
| UI描画 | 漢字・ヒント・前問・HP/EXP・ログ・ボタン、`ui/`とDOM入力位置調整 | PRESENTATION＋意味契約。正誤・ヒント・入力可否と一致させる必要がある |
| 音 | 行動内publish、Speech、`main.js:54`〜→audioManager | 表現だが発火タイミングの契約あり。旧BGM停止の所有権修正を保護 |
| 画面遷移 | `setupFSM`、battleFactory、撃破分岐、result／capture、exit | GAME LOGIC＋lifecycle。演出callbackの独断で遷移させない |

### 8.3 抽出時に見落とせない現行結合

- `update(dt)`は約1,500行の混在処理。先頭のenemyActionTimer更新を削ると撃破待ちの条件が変わる。`:1617`のEXPキュー消費は`updatePlayerExp → addPlayerExp → saveGameData`へ至る。`:2084`のstageClearPending判定もゲーム遷移を予約する。
- 通常の敵撃破は`:5140`でEXPを即反映する。一方、`startExpParticleEffect → expAnimQueue → updatePlayerExp`という別経路も残る。「すべて粒子到着でEXP付与」とも「粒子は全部無害」とも扱わない。
- 最終敵撃破は`:5211`付近で捕獲への待ちとベストタイム／stageClearPendingへの待ちを別々に予約する。`battleFactory`のonVictoryと、捕獲画面経由の結果遷移の両方を調べず統合しない。
- `practiceBattleScreenState = {...battleScreenState}`、quickもpracticeの展開と`call(this)`で共有する。浅いコピー、同名メソッドの上書き、通常battleを直接参照するファイル内関数がある。新しいクラスへ機械的に移すとthisと所有者の意味が変わる。
- 攻撃内の`updateEnemyUI()`は即座にctxへ描く。Renderer抽出には毎フレーム描画だけでなく、この直接描画も境界へ寄せる必要がある。
- 描画と論理がMath.randomを共有するため、絵の描画回数とゲーム用乱数の消費が干渉する。保持対象は出題集合・重み・ダメージ式と結果条件。ランダムな1プレイの完全一致を未検証のまま保証しない。

## 9. 3D交換ポイント候補

**実現可能な最小候補は「既存の戦闘controllerから、背景と敵の見た目へ渡す表示情報」の境界。現時点で完成済みAdapterはない。**

```text
既存 Game State + 戦闘controller + 入力/保存/SRS/lifecycle（保護）
  ├─ 既存2D学習UI / DOM input / かなパッド / Tutorial
  └─ Render Adapter（将来、値のsnapshotと表示領域を作る）
       ├─ Existing 2D Canvas Renderer
       └─ Future 3D Renderer
```

以下は**将来案であり、今回追加したAPIではない**。

| Adapterの候補契約 | 入力／出力と制限 |
| --- | --- |
| 表示snapshotの生成 | 現stage ID、enemy ID／name／isBoss／HP／盾／weakness、enemyAction／残り時間、reducedMotion、表示領域 → 値のsnapshot。元のgameState、question token、Set、DOMへの書込可能参照を渡さない |
| `render(view, layout)` | snapshotと描画領域 → 描画副作用のみ、ゲーム結果の戻り値なし。同じsnapshotを複数回描いてもHP・記録・次問は進まない |
| `resize(layout)` | contain後のCSS領域・内部論理領域 → 表示資源だけ更新。入力矩形・Tutorial anchorの基準と一致 |
| `dispose()` | そのRendererの資源・予約を解放。何度呼んでも安全、遅いload完了は旧世代として無視。学習状態・saveを消さない |
| 外見資源の対応 | monster ID／stage ID → 2D画像または3D表示資源。未用意の外見はfallback表示へ。学習問題・敵HP・ステージを別物に変えない |

最初の交換では、背景`:1208`付近とモンスター画像・姿勢`:1320`〜`:1490`付近を対象候補にする。漢字・入力・ボタン・HP表示・Tutorialは既存方式で維持し、敵IDに対応した表示だけを検証する。

最小限の分離は、(1)敵表示領域の計算を描画の副産物から独立させる、(2)敵／背景を描く処理へ値を渡す、(3)その範囲の直接ctx呼出しをAdapterへ集める、(4)モデル等のload／disposeを現画面世代へ接続する、の順が候補となる。各段階で2D表示とテストを維持してから進む。

`update`全体をRendererへ移す場合は最小交換の範囲を超える。先に敵timer、EXP・レベル処理、勝利判定、撃破待ちの進行責任をcontroller側へ分ける必要がある。特に、3D animationの完了通知をHP確定・保存・次問の唯一の条件にしない。最初のSliceは既存の論理側の待ち・期限・世代検査を維持する。

障害は、単一2D canvasとmainの実績通知、描画・当たり判定・Tutorialの共通座標、enemy.imgの混在、実EXPへつながる表示キュー、共有this／lifecycle、EventBus第3引数の欠落である。これらをまとめてリファクタリングする計画にはしない。

## 10. 3D化後も維持するテスト

### 10.1 維持必須の回帰条件

| Baseline条件 | 期待する結果 | 現行証拠／補足 |
| --- | --- | --- |
| セーブ | 成功は実書込後。Quota／未知版／破損／復旧journalで原本保持、失敗を成功表示しない | phase-a保存群、no-go/lifetime・screens |
| スロット | 1→2→1で名前・学習・旗・復習が一致。退避・復元・番号失敗は元slotを保つ | phase-a/save-safety・context・cloud |
| バックアップ | 不正・空JSON拒否、有効な空saveは全置換、退避・mirror失敗時原本／メモリ保持 | phase-a/restore・validation・save-integration |
| 漢字ID | 2,136件、重複0、漢字／敵参照切れ0。旧衝突9組の曖昧記録は保持 | phase-a/catalog・catalog-loader・id-migration、stage integrity |
| 復習・SRS | 既存の6日先予定を再誤答で翌日へ。再出題予約を一時候補外で消さない。復習0件の空状態 | phase-b/review-outcome・lifecycle-retry、no-go/mobile |
| ヒント分類 | 0/1/2/3/4と答え開示を区別し、自力の進捗だけ進める。旧累計を自力へ推測変換しない | phase-a/recording、phase-b/review-outcome・presentation、no-go/screens・presentation |
| 通常戦闘の正誤 | 攻撃／回復×正誤、空・近似入力、保存失敗→再試行で記録一件、リスト／comboと保存が一致 | no-go/screens。通常ダメージ・盾・5コンボ・全撃破遷移の全組合せは現行suiteで網羅していない |
| 練習 | 誤答→2,200ms→正答、支援区分revealed、1,100ms後入力復帰。待機中連打拒否、完了空Enterと終了は記録を追加しない | no-go/screens・mobile、phase-a/quick-review-recording |
| 学年クイズ | 正解・answers・保存・次問一回。空欄・近似・IMEで記録しない。今回10問と自力数を区別 | no-go/screens・mobile、phase-b/presentation |
| IME／かなパッド | composition/isComposing/229の確定抑止、通常Enterとyomitabi:submitの同一ゲート | phase-b/answer-submission・screen-wiring、no-go/screens・mobile。実IMEは未確認 |
| 画面離脱 | 実exitでtimeout/rAF/intervalを停止、transform復元。捕捉済み旧callbackを後から呼んでも不変 | no-go/entry-lifecycle・screens・lifetime・loading・recovery |
| Tutorial | 全12画面で正常未読開始1、旧開始・旧overlay総追加・現guide破棄0。両完了順、result先行awaitも検査 | no-go/tutorial-navigation-matrix・navigation-tutorial・entry-lifecycle |
| stage progression | 旗5を保存・読込しクリア後解除。同runクリア一回、別run＋1。通常88面のpool集合維持 | phase-a/restore・recording、no-go/loading、phase-c/stage-pools |
| 難易度・時間 | 学年直行の係数、balance-2の記録key、論理delta上限100ms、非表示playtime0、主要敵演出のms更新 | phase-c/battle-balance・frame-clock |
| 操作と音 | 390/768pxの対象ボタン44 CSS px、描画と5点タップ一致、黒帯変換、入力48px、旧BGMで新曲を止めない | no-go/mobile、phase-c/mobile-layout、phase-b/audio-lifecycle |
| 教材・起動失敗 | grade7失敗を別教材で成功にしない。対象URL到達、9,999/10,000ms、abort、遅い完了、再試行 | no-go/loadingとhelper。正常応答／旧代用対照を同じoracleで検出 |

### 10.2 正式テストの全ファイル一覧

**以下34ファイルの268件を継続PASS対象とする。** P0だけ、または保存コアだけに縮小しない。共通UIや練習に影響するため、3D変更でも正式4コマンドすべてを実行する。

| ディレクトリ | ファイル | 保持する検査 |
| --- | --- | --- |
| `tests/phase-a/` | `bootstrap.test.mjs` | 復旧前の初期値抑止、legacy先行移行 |
| 同上 | `catalog-loader.test.mjs` | 旧重複catalog拒否、現在の両字取得 |
| 同上 | `catalog.test.mjs` | 2,136字、一意ID、教材／敵参照 |
| 同上 | `cloud.test.mjs` | snapshot復旧、空remote、slot、revision、名前変更、cloud reset分離 |
| 同上 | `context.test.mjs` | hydrate前保存、旧タブ／旧slot書込み拒否 |
| 同上 | `id-migration.test.mjs` | 9組の曖昧／証拠あり移行、退避失敗、衝突先保護 |
| 同上 | `model-storage.test.mjs` | queue／図鑑の正規saveとmirrorの整合 |
| 同上 | `quick-review-recording.test.mjs` | 短期復習の新しい記録context |
| 同上 | `recording.test.mjs` | 支援区分、全source、stageRun一回確定 |
| 同上 | `restore.test.mjs` | 空状態復元、旗5、mirror失敗、legacy置換 |
| 同上 | `save-integration.test.mjs` | 実保存結果、journal復旧、原本退避、破損journal拒否 |
| 同上 | `save-safety.test.mjs` | E01/E02/E03/E04、正常slot往復 |
| 同上 | `validation.test.mjs` | 不正型／mirror拒否、明示resetのslot分離 |
| `tests/phase-b/` | `answer-submission.test.mjs` | 正規化・近似・連打・IME・inactive |
| 同上 | `audio-lifecycle.test.mjs` | 古いBGMフェードと新BGMの競合 |
| 同上 | `lifecycle-retry.test.mjs` | 離脱guard、候補外retry保持、空復習導線 |
| 同上 | `presentation.test.mjs` | クイズ範囲とCSV支援分類 |
| 同上 | `review-outcome.test.mjs` | SRS品質・再誤答・一回記録・保存失敗復帰 |
| 同上 | `screen-wiring.test.mjs` | 各学習画面・かなパッドの共通入口、exit、完了・案内 |
| `tests/phase-c/` | `battle-balance.test.mjs` | 学年内難度・盾・旧タイム分離 |
| 同上 | `frame-clock.test.mjs` | 非表示時間、delta上限、30/60/120fpsのtimer |
| 同上 | `mobile-layout.test.mjs` | contain・黒帯・DOM寸法 |
| 同上 | `public-contract.test.mjs` | 名称、SDK非同期、SW退役範囲、安定背景URL |
| 同上 | `stage-pools.test.mjs` | 世界の明示poolと優先順 |
| 同上 | `startup.test.mjs` | ロゴ先行、取得Promise共有、有効ローカル優先 |
| `tests/no-go/` | `entry-lifecycle.test.mjs` | REAUDIT-01：実親子enter／exit、旧背景、rAF／interval |
| 同上 | `lifetime.test.mjs` | タイトル保存失敗、levelUp、認証、名前の遅いcloud |
| 同上 | `loading.test.mjs` | NEW-06／REAUDIT-02対照、deadline、SDK・Image・stageLoading |
| 同上 | `mobile.test.mjs` | 実描画矩形とタップ、IME tap、空復習、完了・失敗表示 |
| 同上 | `navigation-tutorial.test.mjs` | FINAL-QA-01、実name→course→continent、隣接・再入場・正常開始 |
| 同上 | `presentation.test.mjs` | 実Tutorial anchor、支援込み文言、reduced motion |
| 同上 | `recovery.test.mjs` | 明示破損復旧、拒否・離脱・期限の原本保持 |
| 同上 | `screens.test.mjs` | NEW-01〜04、実入力・保存再試行・hint・IME・離脱 |
| 同上 | `tutorial-navigation-matrix.test.mjs` | FINAL-QA-02、全12画面×開始/離脱/両再入場、呼出元棚卸し、result先行await |

再現に必要な10 helperもcommit対象：`tests/phase-a/storage-helper.mjs`と`tests/no-go/helpers/`の`curriculum-fixture.mjs`、`grade7-control-worker.mjs`、`grade7-counterfactual-loader.mjs`、`navigation-tutorial-fixture.mjs`、`navigation-tutorial-loader.mjs`、`tutorial-import-loader.mjs`、`tutorial-navigation-dom.mjs`、`tutorial-navigation-fixture.mjs`、`tutorial-navigation-loader.mjs`。一時ファイル依存に置き換えない。

### 10.3 テストの限界と抽出時の追加条件

Node上のStorage／DOM／Canvas／時計／通信の代用品を使う。画面の実コードを通るテストと、ソース文字列・式・設定だけを調べるテストが混在する。特に`screen-wiring`、`public-contract`、`stage-pools`等の一部は静的検査。正式268 PASSを実ブラウザー・実サーバー・全ボス遷移の合格証明にしない。

Renderer交換に着手する段階では、現在未整備の次の比較検査を追加する。今回の文書作成では新テストを実装しない。

- 固定した論理乱数・回答列で、弱点／盾／5コンボ／マスター倍率／回復制限／HP0を2D基点と比較する。
- 非最終撃破→敵交代、5体撃破→保存→再読込、最終撃破→捕獲→結果→地図を通し、EXP／capture／clearが一回だけ成立することを比較する。
- 同じ表示snapshotを0回・1回・複数回描画しても、採点・保存・次問を追加しない。描画だけ遅延・失敗してもcontrollerの期限と戻る操作が成立する。
- Rendererのload／dispose／resizeと画面再入場の旧→新／新→旧を試し、旧資源やoverlayが新画面を変更しない。

既存テストのskip、assert削除、失敗を握りつぶすmockでPASSを作らない。将来の抽出でソース文字列検査の参照位置が変わる場合は、元の振る舞いのassertを維持した代替と変更理由を同じ差分に示す。まずは既存2D経路の正式テストをそのまま通す。

## 11. Git / branch / tag戦略

**今回実行するのは提案まで。git add／commit／tag／branch作成／switch／stash／push等は実行していない。**

### 11.1 commitする変更

§2の追跡済み53ファイル（54からFirebase cacheを除く）と新しい製品18ファイル、tests44ファイルは、今回の品質改善を成立させる一体の候補である。共通処理だけ、呼出元だけ、教材IDだけを先に確定して、不完全な状態へstable tagを付けない。

長期間の改善が同じ画面に重なっているため、事後に推測でA/B/Cへ切り刻むより、**現在の検証済み品質改善を一つの整合したcommitとして確定**する案が適切。文書は同じcommitまたは直後の文書commitでもよいが、stable tagは全製品・テスト・定義文書が揃った最終commitを指す。

既存`package-lock.json`、Vite設定、未変更の教材・音・画像・scripts等はHEADにある構成を継承する。package.jsonの変更は正式テストコマンド追加で、現lockfileは未変更。3D用依存の追加や依存更新はBaseline確定と混ぜない。

残す文書（現在未追跡16件＋本書）：

- `PROJECT_EVIDENCE.md`
- `PHASE_A_IMPLEMENTATION_REPORT.md`、`PHASE_B_IMPLEMENTATION_REPORT.md`、`PHASE_C_IMPLEMENTATION_REPORT.md`
- `docs/PHASE_A_DATA_MIGRATION.md`
- `YOMITABI_QUALITY_AUDIT.md`、`YOMITABI_V1_REMEDIATION_PLAN.md`、`YOMITABI_V1_REGRESSION_AUDIT.md`
- `YOMITABI_NO_GO_FIX_REPORT.md`、`YOMITABI_NO_GO_REAUDIT.md`、`YOMITABI_CODE_NO_GO_FINAL_FIX.md`
- `YOMITABI_CODE_GO_FINAL_AUDIT.md`、`YOMITABI_FINAL_QA01_FIX_REPORT.md`、`YOMITABI_CODE_GO_DECISION.md`
- `YOMITABI_TUTORIAL_LIFECYCLE_FIX.md`、`YOMITABI_TUTORIAL_FINAL_QA.md`
- `YOMITABI_2D_STABLE_BASELINE.md`

古いNO-GO文書も、何を壊してはいけないかを説明する履歴として残す。過去のFAILをPASSへ書き換えない。

### 11.2 commitに含めないもの

| 対象 | 理由／保持方法 |
| --- | --- |
| `.firebase/hosting.ZGlzdA.cache`の今回の差分 | deploy生成cache。今回のbuild・品質の正史ではない。既に追跡済みなので今回勝手に削除／追跡解除しない。選択的stageから外し元の作業ツリーに保持 |
| `.claude/settings.local.json` | 個人の環境設定。製品の再現条件には使わない |
| `node_modules/`、`dist/`、`artifacts/` | .gitignore対象。生成物・依存実体。再現はlockfileと正式コマンドで行う |
| 一時build／ログ／障害注入出力／個人save | 通常の製品commitには含めない。長期証拠は匿名の入力条件・テストコード・要約をrepoに残し、生ログは必要なら別の保管先へ |

これらを除外するためのreset／checkout／revert／clean、全体stash、削除は不要。元の作業場所の除外物を保持し、選択したcommitだけから別のクリーンな作業場所で再現確認する案とする。

### 11.3 推奨構成と確定順序

```text
main
  └─ 品質改善 + 教材移行 + 全テスト + 監査/本書を含む最終2D commit
       ├─ annotated tag: yomitabi-2d-stable-2026-09
       └─ branch: experiment/3d-vertical-slice
```

この命名案は適切。ただしtagの作成済み確認は今回しておらず、将来作成前に同名の有無を確認する。同名がある場合に上書きせず、新しい識別名を選ぶ。

1. 別途Git書込みを行う工程で、上記対象を選択的にstageして差分を確認し、commitする。
2. そのcommitだけを読む別のクリーンなcheckout等で、Node/npm・lockfileに従って依存を準備し、4スイート、stage integrity、buildを再実行する。未追跡のsrc／helperを取り忘れていないことを確認する。
3. 合格した最終commitへ注釈付きstable tagを付ける。注釈にはfull SHA、評価日、268 PASS、build結果、本書、既知残件を記す。元tagを後から移動しない。
4. `experiment/3d-vertical-slice`は**tagが指すcommitから**分岐する。将来進んだmainや今の未固定HEADを起点にしない。mainの2Dを維持し、3D変更は実験branchへ限定する。
5. 2D再現はtagの別checkoutで行う。コードの巻戻しと個人学習データの巻戻しを混同しない。実験は架空save・隔離した保存領域で行い、同じブラウザーoriginの実データを共有しない。

remoteへの保管・pushは別途許可された工程で行う。本書は実施済みcommit/tagの存在を主張しない。実施後はtagのSHAを別の確定記録へ残し、今回の「未固定」という履歴を消さない。

## 12. BASELINE KNOWN LIMITATIONS

既知のコード残件、未確認条件、3Dで新たに生じる問題を区別して記録する。

| ID | 種別 | Baseline時点の状態／判定範囲 |
| --- | --- | --- |
| BL-01 / TUTORIAL-FINAL-P2-01 | 既知P2 | `tutorialData.js:81`のresultWin anchorが未定義centerBoxを参照。Guideの例外処理で代替矩形となる。今回も正式testでfallback観測。本文・終了・既読操作は最終QAで確認済み、意図した位置の強調は未合格 |
| BL-02 | Tutorialの保証範囲 | Guideのanchor再試行rAFはdestroyで取消なし。既表示guideの一般的な外部遷移時終了、import取得失敗の案内／再試行は旧開始予約の検査とは別。最終QAで再現済みP1とされていない |
| BL-03 | 実端末未確認 | iPad／iPhone／Android等の表示、物理タップ、回転、文字拡大・ルビ、かなパッドとソフトキーボード、全画面の重なり・FPS。Nodeの矩形検査だけで合格扱いしない |
| BL-04 | 実IME未確認 | Windows日本語IMEやモバイルの実compositionend／keydown順。合成イベントでのPASSと分ける |
| BL-05 | 実保存環境未確認 | ブラウザーの実Quota・強制終了・実際の複数タブ、ファイル選択を含む復元。メモリStorageの原本保全とは別 |
| BL-06 | 実Firebase未確認 | 実認証、復旧、競合、slot分離、サーバーのアクセス制御。代用品による契約確認は実ルールの保証ではない |
| BL-07 | 公開環境未確認 | chunk／教材／素材の更新、応答ヘッダー、旧SW退役、ホーム画面、学校回線cold start。設定上m4aや深いURLの実配信は別確認 |
| BL-08 | 音の実聴未確認 | BGM/SE/読み上げの音量、ループ、autoplay、形式fallback。旧曲フェード競合の自動テスト成功と分ける |
| BL-09 | 子どもの試遊未確認 | 最初の30秒、単独開始・中断、ボスの音訓／盾理解、テンポ、上達実感、楽しさ。小1/3/6直行の数式検査は実クリア時間を測っていない |
| BL-10 | 教材の人的校閲未実施 | 全読み・例文・説明文の教育的正確性。単字の読み中心で、例文データは主に小1の80字。IDの一意性だけで内容を認証しない |
| BL-11 | 既存の表現・テンポ | 復習の1,000ms自動次問、短期復習のOK／キャンセル、ボーナス結果の「よめた漢字」、小さな補助文字、画面・素材の統一感の残件。3Dの新規回帰と区別 |
| BL-12 | 時間・動き・build | audio fadeのframeごと0.016秒、一部装飾のframeカウンター、全reduced motion経路の未網羅、CJS/import/chunk警告。全演出がFPS独立とはしない |
| BL-13 | 構造・試験範囲 | 巨大battle、浅い展開継承、EventBus第3引数欠落、最終撃破の複数予約、Math.random共有。§6/8/10の静的リスクと追加試験対象。今回、全戦闘通しプレイは実施していない |

将来の不具合票には、Baseline tag／3D commit、端末・設定、手順、2Dでの再現可否、関連BL-IDを記す。同条件で2Dにもあるものは既存残件、3Dだけに出るものは3D回帰、比較していないものは起源未判定とする。「実端末が未確認だった」だけで3D固有の不具合を既知扱いにしない。既知P2から入力不能・データ消失へ悪化した場合も新たな回帰として扱う。

## 13. 3D Vertical Slice開始条件

| Gate | 条件 | 今回の状態 |
| --- | --- | --- |
| GO-01 | 正式4スイート全PASS、FAIL/cancelled/skipped/todo=0 | **達成：268 PASS** |
| GO-02 | build PASS、stage ID整合PASS、既存警告を記録 | **達成** |
| GO-03 | KEEP／INTERFACE／REPLACEABLE／UNKNOWNとPROTECTED COREを定義 | **達成：本書** |
| GO-04 | 既知の重大修正・Tutorial全12経路の回帰証拠、既知残件の記録 | **達成：最終Tutorial QA＋今回の正式suite再実行**。全経路安全保証ではない |
| GO-05 | 品質改善・教材・全テスト・本書を含む2D commitとimmutableなtag、commit単独の再現確認 | **未達：ユーザー指示によりGit書込みは今回実施しない** |
| GO-06 | そのtagから実験branchを作り、2Dを別checkoutで再現できる | **未実施：GO-05の後** |
| GO-07 | 最初の交換範囲を敵／背景に限定し、既存UIと論理の所有権を維持 | **候補定義済み**。開始時に§9の範囲を作業単位として採用 |
| GO-08 | 架空データ・隔離した保存領域で実験し、元の学習データへ影響させない | **方針定義済み**。実験環境の準備は未実施 |

したがって、**Baseline定義工程は完了。3D実験の技術的準備へ進める評価だが、実際の3D Vertical Slice開始はGO-05/06/08を満たしてから**とする。描画交換時には§10.3の境界検査も実装差分と一緒に通す。

実端末・実IME・実Firebase・試遊・校閲は公開の品質確認として残す。未実施だけで、隔離した3D実験を禁止する追加条件にはしない。一方、新たな再現可能P0/P1が見つかった場合は既知制約に埋めず、原因を切り分けて開始／拡大を再判定する。

## 14. 3D化で絶対にやってはいけない変更

1. 未コミットの品質改善をreset／checkout／revert／cleanや一括削除で失わせる。未追跡src・tests・監査文書を生成物扱いして消す。
2. 現HEADだけにstable tagを付けて「268件PASSの基点」と呼ぶ。tagを別commitへ後から移動する。
3. 3D導入のためにsave形式・漢字ID・学年pool・既存学習記録を変更、初期化、推測移行する。
4. E01/E02の検証・退避・journal・rollback・slot/context保護を省略し、保存失敗を成功扱いする。
5. 正答やSRSを3D接触・animation完了・モデル取得成功に依存させる。RendererからHP、EXP、問題token、学習記録、stage進行を直接更新する。
6. `update()`を描画専用と誤認して丸ごと置換する。EXPキュー・勝利判定・敵timer・撃破待ちを装飾として削る。
7. practice／quickの親子lifecycleを分断し、予約後に古い所有者をactiveのまま置き去りにする。旧asyncで新しい画面・guide・背景を変更する。
8. 入力ゲートを迂回し、composition Enterを回答にする。連打で記録を増やす、通常空回答を受け付ける、正式再回答を永久lockする。
9. ヒント・答え開示後を自力に変更する。表示を豪華にするため正解条件や読み・復習・回復ルールを変える。
10. 教材取得や3D資源取得の失敗を、別学年・別ステージ・別の敵ルールで隠す。既存の期限・再試行・戻るをなくす。
11. 正式テストを減らす、skipする、対象assertを弱める、Tutorialを全面停止して旧overlayテストだけ通す。対照試験の意図的FAILを一般的エラー抑制へ変える。
12. Canvas／DOM／Tutorialの重なり・座標・動き軽減を無視して、見えるボタンと押せる場所を分離する。
13. 2D画像・音・データを一括削除し、図鑑・捕獲・クイズ・復帰用2D経路を壊す。個人の実saveや実cloudを実験用fixtureにする。
14. 既知P2・実環境未確認と、3Dで新しく生じた入力不能・進行・保存の回帰を混同する。コード検証結果を公開承認へ読み替える。

今回の作業では3Dライブラリ、Three.js、Babylon.js、Blender、Unityを導入していない。描画・製品コードは変更せず、commit／tag／branch作成も行っていない。
