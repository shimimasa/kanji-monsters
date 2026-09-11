# MINIGAME-01 — Math Sprint MVP

実施日: 2026-09-11。判定対象は、ヨミタビ内の10問加減算と所有HKD-E01のvisual companion。Platform全体の完成や正式性能認証ではない。

## 1. Executive Summary

タイトルの「ミニゲーム：けいさんスプリント」から、加算5問・減算5問、回答、feedback、次問、結果、もういちど、戻るまでを実装した。HKD-E01を所有している場合は既存画像とslime Motionを表示する。未所有でも10問を完走できる。

既存339試験、追加34試験、計373 PASS。fail / cancelled / skipped / todo はすべて0。stage integrity、production build PASS。隔離Chromeの最終機能QAは74項目PASS。新規RAF・interval・永続save schema・Storage key・画像・profile・runtime dependencyは0。

起動直後に既存画像loaderのLong Taskが重なる制約は残る。追跡で既存PNG透明度処理と区別し、新しいミニゲームの50ms超処理は観測しなかった。実機スマートフォンやOS IMEの認証はしていない。

## 2. Git / checkpoint

| 項目 | 実際の状態 |
|---|---|
| 起点branch | `experiment/2d-monster-motion` |
| 指定・現在HEAD | `7166de414c766f96a713d3f4c43be37bc6182db3` |
| 起点tag | `yomitabi-motion-02-checkpoint-2026-09` |
| tag object | `191b763ad65b23f1e7f7856dcd2cd79bc5fb223b` |
| tagのcommit | 上記7166de4と一致 |
| 新branch | `experiment/minigame-math-sprint` |
| 新worktree | `C:/kanji-game-latest/artifacts/minigame-01/worktree` |
| 初期 `git status --porcelain` | 空。HEAD確認後、npm ciとbaselineを実行 |
| commit / push / tag | 実施0。変更は未stage・未commit |

worktree addはGit管理領域のPermission denied後、同一コマンドを権限付きで実行して成功。npm ciも既存npm cacheへのEPERM後、同一操作の権限付き再実行で成功した。22 packages installed。既存audit警告5件（moderate 1 / high 4）に対するupgrade/fixはしていない。

main、2D stable、3D研究branch、既存Motion branch/tagの参照は不変。新branch作成後の[refs](../baseline/refs.txt)と[最終Git監査](../git-final.json)は一致する。既存worktreeへ書込み・branch切替・reset・clean等は行っていない。

参照文書: [Platform Strategy](../../../YOMITABI_MINIGAME_PLATFORM_STRATEGY.md)、[MOTION-03A adoption](../../motion-03a/YOMITABI_MOTION_03A_ADOPTION_GATE_REPORT.md)、[MOTION-02 freeze](../../motion-02/freeze-01/YOMITABI_MOTION_02_GIT_FREEZE.md)、[MOTION-02 integration](YOMITABI_MOTION_02_BATTLE_INTEGRATION_REPORT.md)、[MOTION-01 slice](YOMITABI_MOTION_01_TECHNICAL_SLICE_REPORT.md)。現在のGit objectを基準とし、過去の報告時点の未commit記述とは区別した。

## 3. Files changed

既存tracked変更は3ファイル。

| ファイル | 変更 |
|---|---|
| [src/init/fsmsetup.js](src/init/fsmsetup.js) | Host import、`miniGame` state登録、安全リスト登録 |
| [src/screens/titleScreen.js](src/screens/titleScreen.js) | DOM入口buttonと画面退出時の除去 |
| [tests/motion-02/scope-audit.mjs](tests/motion-02/scope-audit.mjs) | 今回認可された入口差分・明示追加pathの監査契約を接続 |

追加15ファイル。

| ファイル群 | 内容 |
|---|---|
| `src/minigames/registry.js` | 1 entry |
| `src/minigames/miniGameHost.js` | FSM境界、session/View/Companion寿命、pause |
| `src/minigames/collectionAdapter.js` | 確認済みsave contextから所有IDをread-only導出 |
| `src/minigames/companionAdapter.js` | 学習eventからdisplay-only action |
| `src/minigames/mathSprint/mathSprintGame.js` | 非永続Core、採点、結果、event |
| `src/minigames/mathSprint/mathSprintGenerator.js` | 有限問題poolとshuffle |
| `src/minigames/mathSprint/mathSprintInput.js` | 既存submission helperの問題単位binding |
| `src/minigames/mathSprint/mathSprintView.js` | DOM UI、CSS、表示更新 |
| `tests/minigame-01/core.test.mjs` | generator / Core / input / events |
| `tests/minigame-01/lifecycle.test.mjs` | 実Host/ViewとCompanion / collection / isolation |
| `tests/minigame-01/scope.test.mjs` | 保護境界とnegative fixtures |
| `tests/minigame-01/scope-contract.mjs` | 固定入口hashと明示追加path |
| `tools/minigame-01/functional-qa.mjs` | 架空fixtureのみを受け付ける隔離CDP QA |
| `tools/minigame-01/README.md` | 再検証手順と確認範囲 |
| 本報告書 | 判定と証拠 |

logs、screenshots、trace、Chrome profile、baseline distはworktree外の`artifacts/minigame-01/`に保存した。

## 4. MiniGame Host

既存`main RAF → FSM.update(dtMs) → miniGameHost.update`だけを使う。Host外向きは`enter(props) / update(dtMs) / exit()`、pause理由を分けるため`setPaused(boolean)`を追加した。`inspect()`は読取り専用の検証境界。

Host update内でCoreのactive time、Companion timeline、Viewの状態差分、Canvas2D presentを更新する。Viewは独立したRAFを持たない。game instanceは`enter / update / exit / setPaused`と、ゲーム固有の`submit / next / snapshot`を持つ。

FSM本体・main loop・battleScreenを改変せず、Math Sprint専用のDOM screenをbodyへ置いた。数式・input・padはCSS px、Companionだけ小さなCanvas2D。既存gameCanvas全体の座標倍率へ入力UIを従属させないことで、44pxの操作領域とkeyboard時のscrollを保つ。

## 5. Registry

静的な`miniGameRegistry.mathSprint`の1件だけ。id=`mathSprint`、title=`けいさんスプリント`、create=`createMathSprintGame`。plugin loader、resolver、version negotiationなし。

Viewは初号専用の接続であり、複数ゲームの表示schemaを汎用化していない。2本目が存在する前に共通contract v1とは呼ばない。

## 6. Math Sprint Core

`gameId=mathSprint / mode=tenQuestions`。加算5・減算5、一つの難易度、時間制限なし。stateはfactory closure内だけにあり、gameStateへの追加もsave projectionへの追加もない。

phaseは`ready → answering → feedback → answering ... → completed`。pauseは別boolean。第10問のsubmitで直接completedへ進み、結果を固定する。誤答もansweredを1増やし、再回答は認めず正答を表示する。

正解はcorrect/streakを増加しmaxStreak更新。誤答はincorrect増加・streak=0。常に`answered = correct + incorrect`。Companionの状態をCoreへ渡していない。

## 7. Generator

既存Calculation SprintのquestionGeneratorをimportしていない。MINIGAME-01の小さな独立generatorを作成した。

加算は`a=1..8 / b=1..9-a`の36候補。減算は`a=1..9 / b=1..a`の45候補。各poolを注入randomでshuffleし、5問ずつ取り出して10問をshuffleする。完全に同じoperand/operatorの重複はない。`a+b`と`b+a`は異なる式として扱う。

random呼出しは固定88回。retry loopもmodule-global historyもなく、constant randomでも終了する。randomの範囲が不正ならRangeError。1,000 seedsについて同一列、10問、5+5、全operand/answer範囲を検査した。sessionIdも注入するため、教材列の再現性とsession identityを分離できる。

## 8. Input

DOM text inputに`inputmode=numeric / enterkeyhint=done`を付与。0〜9 pad、削除、回答、Enterを提供。入力の数字列全体を検査し、全角→半角、trim後に`^\d+$`とsafe integerを要求する。空欄・符号・小数点・指数表記・混在文字は未回答。`Number('')`や`parseInt`の部分読取りは使わない。

既存`createInputSubmission`を再利用した。問題ごとにbindingを作り、Enter repeat、IME composition、pause、lock、disposeを扱う。`bindInputSubmission`をそのまま使う場合に足りないrepeat判定を、小さなMath用bindingで補った。既存helper本体は変更なし。

## 9. Token / Submission Gate

各提示問題は`problemId`とsession内tokenの組で識別する。教材内容はimmutable、現在有効なtokenはCore snapshotの別fieldで保持。新問題提示時に新しいtokenを作り、submitを受理したらobserverより先にnullへ消費する。

submitはactive、pause、phase、source sessionId、source tokenを照合する。DOM bindingは当該session/tokenを閉じ込めるため、古いcallbackが新問題の正答を送っても採点できない。NextにもsessionId/problemId gateがある。

Enter連打、button連打、Enter+button、key repeat、IME、古いtoken/session、退出後callbackを試験した。UI lockは補助であり、一次防御はCoreのtoken消費である。

## 10. LearningEvent

eventは`problemPresented / correct / incorrect / sessionComplete`の4種類だけ。共通envelopeは`version, gameId, sessionId, seq, type, problemId, activeElapsedMs, payload`。回答payloadにattemptId（消費token）、入力値、正答を持つ。problemPresentedにはoperation/skillId、sessionCompleteには固定結果を持つ。

順序はCore commit → event通知 → Companion observe。eventとpayloadはfreeze。observerのreturnを採点に使わず、Promiseをawaitしない。同期例外とPromise rejectionを隔離する。通知中の再入submit/Nextも拒否する。

10問完走は問題提示10＋正誤10＋終了1＝21イベント。seqはsessionごとに1から始まる。update/snapshot/View更新ではeventを発火しない。新教科用の意味論、streak/round event、global event logは追加していない。

## 11. Companion Adapter

既存`monsterMotionHost`、`motionTimeline`、`motionProfile`、`monsterRenderer`、HKD-E01 manifestを変更せず利用。`battleMotionBridge`は使わない。

| 通知 | 表示 |
|---|---|
| enter / problemPresented | idle |
| correct | attack、750msのdisplay残時間 |
| incorrect | idle。責める反応なし |
| sessionComplete | idle、UIの「10もん おつかれさま！」 |

最新reactionへ切替し、queueを積まない。sessionId+seqで古い通知を拒否する。750msは採点・Next・結果に一切渡さない。attack中のNextをtouchでも検査した。reduced motionは既存preferenceと既存neutral poseを使い、action/profile追加0。

画像は既存`/assets/images/monsters/full/grade1-hokkaido/HKD-E01.webp`のみ。既存E01 cacheがあれば再利用し、なければmanifestの同URLをImageで読む。汎用`loadMonsterImage`は別path探索・代替画像生成を含むため、初号の単一画像制約に合わせ呼ばない。新たなalpha加工や画像生成はしない。失敗時は文字fallback、pendingでも回答可能。遅延loadはdispose済みMotion hostを復活させない。

## 12. Collection Read Boundary

正史は`krb_save.player.collection.gotomonIds`。`readActiveCollection()`が既存`isSaveSessionReady()`と`captureSaveContext()`を使い、hydrate済みで現在も一致するcontextのraw snapshotから導出する。前後でready/contextを照合し、読取失敗・未確認・context変更は空配列とする。

`readSaveState()`は内部にtransaction recoveryを含むため、このadapterから呼ばない。read-onlyという名前だけで復旧書込みを持ち込まない。`krb_monster_dex`の直接read/writeは製品側に0。mini-gameからStorageへ直接アクセスしない。

## 13. Owned / Unowned

ownedMonsterIdsにHKD-E01がある場合だけsession内selected=HKD-E01とする。未所有時はMotion host/image loadを作らず、Companion領域を非表示にする。双方の10問完走をブラウザーで確認した。

picker、永続selectedCompanionId、所有権の自動付与は0。QAでowned/unownedを切り替えるのは、生成済み架空fixtureのコピーだけ。

## 14. Pause / Visibility

visibilitychangeでhiddenを取得し、Core pause・input disabled・activeElapsed停止を反映する。visibleでは同じ問題/token/input bufferから継続する。`visibilityPaused`と`manualPaused`を分離し、visible復帰でmanual pauseを解除しない。

Companionにもpaused時dt=0を渡す。新timerによる追いつき計算はなく、既存mainのframeClockを利用する。ブラウザーはvisibilityイベントを合成して検査、単体では実Hostのlistenerから同条件を検査した。

## 15. Exit / Replay

exitは冪等。input binding停止 → Host session invalid → Core exit/破棄 → Companion dispose → listener/viewport/inert復元 → DOM除去の順。途中退出はabortedで結果なし・sessionCompleteなし。既にcompletedの結果を再完了させる処理もない。

もういちどは旧Host sessionを終了して新sessionId、新token、新seq=1で開始する。古いView callbackはvalid/current instance照合で拒否し、前sessionのevent dedupeを継承しない。

## 16. UI / Layout

title、数式、input、pad、回答、feedback、次へ、進捗、correct count、Companion、戻るを表示。結果では結果項目とreplayを表示する。runner・敵・distance/combo meter等はない。

DOM screenは最大幅660 CSS px、縦画面は1列、横画面は問題とCompanionの2列。結果のCompanionは中央。戻るをsticky headerに置き、短いviewportでもscrollして操作できる。underlying app要素はscreen中だけinertにし、退出時に元へ戻す。

## 17. Mobile / Touch / Keyboard

| 条件 | 確認 |
|---|---|
| 1086×723 | タイトル入口、問題、結果、keyboard Enter |
| 390×844 | 横overflowなし、44px以上の主要button、touch pad/delete/回答/次問 |
| 844×390 | 同上、5列padで高さを抑制 |
| 390×420 | keyboardで高さが減る状況の代用。問題/input/回答を操作可能 |
| IME | compositionstart/end、isComposing、229、Enter repeatを合成イベントで検査 |

visualViewport resize/scrollを追従し、利用可能なVirtualKeyboard geometrychangeではkeyboard上端までscreenを縮める。両方のlistenerを退出時に除去。geometryの単体検証も実施した。

[縦](../browser-final-03/mobile-390x844.png)、[横](../browser-final-03/mobile-844x390.png)、[keyboard高さ代用](../browser-final-03/keyboard-height-simulation.png)を保存・目視した。物理touch端末、iOS/Android実機keyboard、OS日本語IMEの実変換は未検証。エミュレーション結果を実機認証と呼ばない。

## 18. Result

第10問submit時点で`answered / correct / incorrect / accuracy / maxStreak`だけのimmutable resultを1回固定する。accuracyは0〜1で保持し、表示で百分率にする。

混在ケースはanswered=10、correct=8、incorrect=2、accuracy=.8、maxStreak=4。UIに「10もん おつかれさま！」「8 / 10」「80%」「4」「もういちど」「もどる」を表示し、最後が誤答なら正答も知らせる。[結果画面](../browser-final-03/result.png)。ranking / XP / Monster level / badge / best recordは0。

## 19. Core Isolation

実Host/Viewを使うテストで、初期HP=73、EXP=31、所有E01の架空saveをhydrateし、Storage set/removeを禁止した状態で10問・結果・replay・exitを実行。書込み試行0、gameState全体とStorage全体の前後一致を確認。

ブラウザーでも実gameStateと全Storageを比較し、既存playtimeSeconds以外の変化0。漢字SRS/正誤、HP/EXP、stage progression、collectionは不変。ブラウザーfixtureのautosaveは測定差分を明確にするため無効にした。製品の既存playtime/autosave機構そのものは変更していない。

Math Sprint結果と進捗はreloadで失われる。新save schema/new localStorage keyは0。

## 20. Lifecycle

単体: 実Host/Viewで10 enter/exit、input buffer保持、pause、pending image、callback無効化、listener0、DOM0、Companion参照0。RAF/interval呼出しは試験中禁止。

ブラウザー: 登録元の最初のアプリframeが`src/minigames/`のlistenerを追跡し、10回の退出ごとに0を確認。root DOM0、Host.inspect().companion=nullも各回確認。戻り先titleが正当に保持するcanvas listener2個とは区別した。新RAF0・interval0。

通信中Imageのブラウザー内部cacheやOS/GPU memory全体の解放、長時間heap安定性の正式認証は対象外。late completionが旧sessionを復活させないことを検証した。

## 21. Tests

`node --experimental-default-type=module --test tests/minigame-01/*.test.mjs`

| suite | PASS |
|---|---:|
| core.test.mjs | 26 |
| lifecycle.test.mjs | 5 |
| scope.test.mjs | 3 |
| MINIGAME-01計 | 34 |

fail/cancelled/skipped/todoすべて0。[追加試験log](../minigame-tests-final.log)。input・events・image・isolation・lifecycleは複数assertを各試験にまとめ、単純な行数や件数だけを網羅性の代用にしていない。

## 22. Existing Regression

実装前の[clean baseline](../baseline/verification.json)と、実装後の[最終全既存suite](../verification-final/verification.json)で次を維持。

| Command | PASS | fail / cancelled / skipped / todo |
|---|---:|---|
| npm.cmd run test:phase-a | 86 | 0 / 0 / 0 / 0 |
| npm.cmd run test:phase-b | 22 | 0 / 0 / 0 / 0 |
| npm.cmd run test:phase-c | 17 | 0 / 0 / 0 / 0 |
| npm.cmd run test:no-go | 143 | 0 / 0 / 0 / 0 |
| MOTION-01 | 39 | 0 / 0 / 0 / 0 |
| MOTION-02 | 32 | 0 / 0 / 0 / 0 |
| 既存計 | 339 | 0 / 0 / 0 / 0 |
| 追加を含む計 | 373 | 0 / 0 / 0 / 0 |

`verify_stage_id_integrity.mjs` PASS。Motion scope検査のassert削除・skipは0。旧「stableでbattle以外の編集禁止」を、今回必要なtitle/FSMの確定全文LF hashだけ追加許可する形に更新した。新規pathも列挙し、余分なhook・移動・欠落・許可外pathのnegative fixturesを保持/追加。battleの9 hook位置・内容・除去後全文一致、Motion Engine/checkpoint一致、package/lock byte検証は維持した。

## 23. Build / Bundle

`npm.cmd run build` PASS。[最終build log](../verification-final/build.log)、[実測bundle比較](../bundle-final.json)。package/lock変更0、runtime dependency追加0。

| disk bytes / gzip参考値 | baseline | MINIGAME-01 | 増分 |
|---|---:|---:|---:|
| main JS bytes | 560,367 | 577,323 | +16,956 |
| main gzip | 158,867 | 165,310 | +6,443 |
| 全JS bytes | 573,692 | 588,740 | +15,048 |
| 全JS gzip合算 | 164,307 | 169,725 | +5,418 |
| CSS bytes | 48,657 | 48,657 | 0 |

Viewのscreen-local CSS文字列はJS側に含まれる。Motion hostを初号から同期利用するため、従来lazy host chunkはmainへ統合された。既存battle bridgeのsource/契約は変更していないが、初期bundleの増分はある。大型chunk/CJS/既存static-dynamic import警告は残る。gzipはローカルzlib参考値でHTTP通信量や起動速度ではない。

## 24. Browser Functional QA

Browser skillを適用したが、接続候補は空で`No browser is available`。専用profileのheadless Chrome 152.0.7977.83、Node v22.14.0、localhost Vite/CDPへfallbackした。実ユーザーprofile/saveは使っていない。QA終了後に専用ChromeとViteを停止した。

fixtureはE0 `e0-cert-01 / Fresh MemoryStorage`の生成物のみを受入れ、owned/unownedをコピー上で作る。pageの外部requestをFetchで拒否。最終各runでFirebase/外部成功0、runtime exception0。

[最終74 checks](../browser-final-03/result.json)、[追跡付き74 checks](../browser-final-trace/result.json)。title入口→10問mixed→result→replay→exit、owned/unowned、Motion/reduced、pause/buffer、全角/不正/IME、keyboard/double submit、mobile touch、10往復、image pending/failure/lateを確認した。11枚の各runスクリーンショットを保存し、代表のdesktop/mobile/result/failure/titleを目視した。

初回browser-01は、Core commit直後でまだ描画されていないNextをdriverが押したためtimeout。可視DOM・input enabledを待つようdriverを修正した。browser-finalのlistener監査はtitleの再登録2件を混同。登録元frameへ判定を絞った。browser-final-02では注入scriptの改行と前runのinit script再利用が検査環境を汚染した。driverを修正し、各起動で新しいChrome targetに切り替えることで最終runは解消。失敗JSONは各directoryに保持し、製品PASSの証拠とは分けた。

性能は大規模benchmarkではない。最終通常runのHost update最大1.1ms、新RAF0/interval0。表示中に51ms/60msのLong Taskを観測したため一旦性能判定を保留し、trace付きで再確認。trace runではHost最大1.2ms、表示中Long Task65ms、最長のminigame-origin FunctionCallは1.661ms。[trace解析](../browser-final-trace/trace-analysis.json)は50ms超FunctionCallを既存`assetsLoader.js:428 img.onload`のPNG透明度処理へ特定した。該当長い呼出しは起動各回で56.34〜83.201ms。新HostのE01画像経路はこのloaderを呼ばない。新規50ms超処理、runaway timer、input block、resource accumulationは観測0。既存cold処理の重なりは残るため、全appのLong Task0や正式性能GOを宣言しない。MOTION-03A battle値の流用0。

## 25. Known Limitations

- 実機OS keyboard/IME、iOS/Android、多様な学校端末は未検証。viewport/touchのemulationと区別する。
- 起動中の既存PNG透明度処理がmini-game表示後に重なるLong Taskは残る。既存loaderの改変は今回行わない。
- gameは1本・1mode・1difficulty。HostのView配線は初号専用。汎用Platform contract v1は未確定。
- result/progress/selected companionはsession memoryだけ。未確認saveの場合も算数は遊べるがCompanionなし。
- 初期JS bundle増分あり。既存Motion hostのstatic共有によりchunk構成が変わる。
- 機能QAはheadless Chromeと合成IME/visibilityイベント。人による連続animationの好みや正式heap/performance認証ではない。

## 26. MINIGAME-02 Readiness

後続レビューに渡せる境界はregistry、Host session寿命、Core commit後event、read-only collection、display-only companion、input token gate。実装・unit/integration・browser evidenceは揃った。

共通contract v1を確定する場合は、この1本で必要だった境界を評価し、2本目で本当に異なる部分を比較してから行う。今はMath Invader、永続save、party/EXP、1000体展開へ進まない。次のGit freezeもユーザーの別依頼で扱う。

## 27. Decision

ヨミタビの同じアプリ内で、捕獲済みHKD-E01を仲間として表示しながら10問の加減算を最後まで遊べる最小実装を完成した。未所有時の完走も成立。学習CoreとMonsterの表示を分離し、既存339試験・新34試験、integrity/build、74項目の機能QAを満たした。

PASSはMINIGAME-01の限定機能範囲。実機keyboard認証・既存cold処理改善・Platform v1・Git freezeは含めない。commit/push/tagは行わず、ここで終了する。

MINIGAME-01 PASS  MATH SPRINT MVP COMPLETE
