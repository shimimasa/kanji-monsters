# YOMITABI MINIGAME-07 Async / Cancellation Technical Probe Report

Date: 2026-09-12 (Asia/Tokyo)

## 1. Executive Summary

MINIGAME-07「よみこみクイズ」 (`asyncChoice`) は、MiniGame Platform Contract v1を変更せず、Promise resolve/reject、exit、new session/replay、pause、cancellationの競合を安全に隔離できた。`enter()`は同期のままloadingをcommitしてreturnし、HostはPromise、loading、ready、failure、AbortControllerを理解しない。

安全性の一次防御はgame instance内の`active + load generation + phase` gateである。exitはgenerationを即時無効化し、optionalなgame-local AbortControllerもresource cleanupとしてabortする。abortを無視して届くlate resolve/rejectもgateで捨てる。Promiseには開始時点でresolve/reject handlerを付けるため、late rejectによるunhandled rejectionは0である。

MINIGAME-07 39 tests、全571 tests、stage ID integrity、`git diff --check`、production buildはPASSした。Host、Contract文書、LearningEvent、Companion、Collection、main RAF、package/lockの変更は0。browser bindingは0件のためBrowser CertificationはNOT RUNである。

## 2. Git / checkpoint

- 開始checkpoint: `d2b0dcced635b7fa536914e0cbe7dbc11adbe705`
- 開始tag: `yomitabi-minigame-06-checkpoint-2026-09`
- 作業branch: `experiment/minigame-async-cancellation-probe`
- local checkpoint tag: `yomitabi-minigame-07-checkpoint-2026-09`
- upstream: 未設定
- push: 未実施

専用worktree `artifacts/minigame-03/worktree`だけを変更した。main worktreeのFirebase cacheと既存untracked artifacts/`.claude`は別作業として保持し、変更・stage・checkpointへ混入していない。他worktreeも変更していない。

## 3. Files changed

Product:

- `src/minigames/asyncChoice/asyncChoiceQuestions.js`（新規）
- `src/minigames/asyncChoice/asyncChoiceGame.js`（新規）
- `src/minigames/asyncChoice/asyncChoiceView.js`（新規）
- `src/minigames/registry.js`（definition追加のみ）
- `src/screens/titleScreen.js`（entry追加のみ）

Tests:

- `tests/minigame-07/core.test.mjs`、`lifecycle.test.mjs`、`scope.test.mjs`、`scope-contract.mjs`、test-only `deferred.mjs`（新規）
- 既存exact-registry assertionsを6から7 definitionsへ更新
- Contract regressionへAsync gameのcommit-before-eventとloading中exit command rejectionを追加
- cumulative scope allowlist/hashへreviewed deltaを追加

Documentationは本reportのみ。Contract文書、tooling、dependenciesの変更は0。

## 4. Contract v1 compliance

| Surface | Result | Evidence |
| --- | --- | --- |
| Definition shape | PASS / unchanged | exact seven-registry tests |
| synchronous Instance lifecycle | PASS / unchanged | `enter()` return is not Promise |
| View return shape | PASS / unchanged | actual Host/View lifecycle |
| opaque dispatch | PASS | `answer`/`next` only game-local |
| Host async awareness | 0 | Host byte-identical |
| LearningEvent envelope/types | PASS / unchanged | exact field/type tests |
| pause / cleanup | PASS / unchanged | settle-during-pause and exit races |
| Companion / Collection | PASS / unchanged | byte protection and runtime tests |

## 5. Async Core

Coreはloader開始、settlement、fixture validation、generation invalidationを所有する。Viewはloadを開始せず、snapshotを描画するだけである。`enter()`はloadingをcommitし、loaderを1回だけ呼び、同期的に`true`を返す。

Promise completion後の表示更新は既存main RAF→Host `update()`で行われる。Hostへのready callbackやasync hookは追加していない。

## 6. Loader model

`createAsyncChoiceGame`はgame-local optionとして`loadQuestions({signal, sessionId, generation})`を受け取れる。production loaderはrepo内self-authored fixtureをmicrotaskで返し、fetch、Firebase、HTTP、画像、音声へ依存しない。

testsではproductionへ持ち込まないmanual deferred utilityを使用し、resolve/reject順序をsleepなしで制御した。

## 7. Loading / Ready / Failure state

phasesはGAME-LOCALで、`idle`、`loading`、`ready`、`answering`、`feedback`、`completed`、`failed`を使用する。

- loading: answer/next/scoring/Eventを拒否
- ready: questions commit済みだが、pause等により未提示
- answering: problem提示済み
- failed: current loaderのthrow/reject/malformed result。`loadError: questionsUnavailable`だけを公開

failureは学習結果ではなく、resultや`incorrect`へ変換しない。

## 8. Session / Generation identity

各load開始時にmonotonic generationを発行する。settlement適用条件は`active && generation一致 && phase === loading`である。exit時にgenerationを増やすため、同じinstanceのlate callbackは即座にstaleになる。new Host enterは新game instanceと新sessionIdを作る。

session IDはquestion/problem/attempt/Eventにも伝播する。具体的generation fieldとtoken構造はGAME-LOCAL / PROVISIONALで、Stable Contractへ追加しない。

## 9. Resolve race

Resolve-before-exitではfixtureをvalidate/shuffle/freezeし、current questionsへcommitして最初のproblemを提示する。Exit-before-resolveではgeneration gateがfalseとなり、questions、phase、Event、resultのどれも更新しない。

A resolve→B resolve、およびB resolve→A resolveの両順序をtestし、BだけがB sessionのproblemを持つことを確認した。

## 10. Reject race

Reject-before-exitではcurrent sessionだけが`failed`へcommitする。problem未提示なのでLearningEventは0。Exit-before-rejectではrejection handler自体は実行されるがgeneration gateでstate適用を拒否する。

loader同期throw、Promise reject、malformed resolveを同じgame-local failureとして処理する。Error object/外部messageはsnapshotへ公開しない。

## 11. Exit while pending

exitは`active=false`、generation invalidate、attempt invalidate、optional abort、observer切断を同期実行する。late resolve/rejectはproblem、Event、UI、resultを復活させない。exitはidempotentで、abortも一回だけである。

## 12. Replay while pending

Hostの既存`enter()`は先にold sessionをexitしてから新instance/sessionを作る。Session A pending中に新enterでSession Bを開始し、A settlementがBのproblem/Companion/DOMを変更しないことを確認した。

completed後の既存ReplayもBをloadingで開始し、新sessionId/seqを生成する。Hostはload状態を解釈しない。

## 13. Cancellation model

AbortControllerは利用可能なruntimeでのみgame-localに生成し、signalをloaderへ渡す。exit時abortは不要resourceの早期停止を促す最適化であり、正しさの根拠ではない。

AbortControllerがない環境ではcontrollerなしで動作し、generation gateが安全性を維持する。shared AbortSignal、Host context追加、global cancellation registryは不要だった。

## 14. Pause interaction

pause中resolveはquestionsを`ready`までcommitするが、problem提示と`problemPresented`をresumeまで遅延する。従ってpause中inputは存在せず、resume後に初めてanswer可能になる。

pause中rejectはcurrent failureをcommitし、Eventは0。resumeしてもfailedのままでViewがfailureを表示する。visibility/manual pauseのOR合成は既存Hostのまま。

loading/ready/failedはproblem未提示なので`activeElapsedMs`を進めない。answering/feedback中だけ既存active session deltaを加算し、pause中は停止する。

## 15. Dispatch

game-local commandsは`answer`と`next`だけ。loading/ready/failed/paused/completed/exit後、stale session/problem/attempt、unknown choiceはCoreが拒否する。Hostはopaque commandをforwardし、accept時だけ既存`update(0)`を行う。

## 16. LearningEvent

固定4 typesだけを使用する。load開始、load成功、ready、load failure、abort/cancelにEventを出さない。最初の`problemPresented`はload成功後かつpause解除後、problemが実際に提示される時だけ発行する。

各回答はcommit-before-`correct|incorrect`、10問完了だけが`sessionComplete`を一回発行する。load failureとaborted sessionはsessionCompleteを発行しない。envelopeの8 fields、version、seq、`activeElapsedMs`は変更0。

## 17. Companion

adapterはbyte-identical。loading/failure専用Eventやanimationはなく、問題提示/回答後の既存LearningEvent mappingだけを受け取る。owned/unowned、pending image、failure、reduced motionがasync readinessやscoringを止めない。

## 18. Collection

adapterはbyte-identical。loader/Core/ViewはCollectionとStorageへアクセスせず、save key、progress、schema、SRS、XP、ranking、score persistenceを追加していない。

## 19. View

既存return shape `root/update/stopInput/dispose`＋optional `canvas`だけを使用する。loading status、failure alert、question/choices、feedback、Next、result、Replay、Back、Companionをsnapshotから描画する。

buttonsは44 CSS px以上、keyboard 1〜4、focus-visible、portrait/landscape rules、horizontal overflow回避をsource/DOM testで確認。View-owned Promise、scheduler、network accessは0。

## 20. Result

game-local immutable resultは`answered/correct/incorrect/accuracy`だけ。loading/failure/cancellationを共通resultへ混在させず、Hostはresult shapeを理解しない。MiniGameResult wrapperは不要だった。

## 21. Lifecycle

Host cleanup順序（stop input、session invalidate、Core exit、Companion dispose、Host listeners、View/DOM dispose）は変更0。pending load中の10回enter/exit、new enter、completed replay、late callbackでDOM/listener/game/Companion leak 0を確認した。

## 22. Resource cleanup

Coreはcurrent token invalidation後にoptional abortを行う。loader rejection handlerは開始直後から接続済みで、abortやlate rejectを必ずconsumeする。View listeners、DOM、Companion image lifecycleは既存ownerがdisposeする。

## 23. Core isolation

Coreはdocument/window、Storage/save、gameState、Companion/Collection、Motion/battle、wall clock、scheduler、networkへ依存しない。observerのthrow、rejected Promise、snapshot read、reentrant dispatchも回答stateを巻き戻さず、duplicate completionを起こさない。

## 24. Tests

MINIGAME-07: **39 PASS**。

- Core: 23（fixture、loading、resolve/reject、A/B ordering、pause、identity、answer、observer、result、abort、unhandled rejection）
- Lifecycle: 9（registry/view、Host loading/resolve、failure UI、pending exit/new enter、keyboard/pause、repeated cleanup、Storage）
- Scope: 7（allowlist、byte protection、Host async knowledge 0、sync enter/generation、LearningEvent、local-only loader、protected paths）

初回全回帰でContract exit fixtureが全gameを同期readyと仮定してnull problemを参照した。Async loading用のold command fixtureへ拡張し、exit後reject assertionは維持した。test削除、skip/todo、weakeningは0。

## 25. Existing regression

既知のWindows/Node runner IPC issueを避けるため、serialized all-suite runをsource of truthとして実行し、さらにsuite別にも再実行した。

| Suite | PASS | fail | cancelled | skipped | todo |
| --- | ---: | ---: | ---: | ---: | ---: |
| minigame-01 | 34 | 0 | 0 | 0 | 0 |
| minigame-02 | 26 | 0 | 0 | 0 | 0 |
| minigame-03 | 21 | 0 | 0 | 0 | 0 |
| minigame-04 | 27 | 0 | 0 | 0 | 0 |
| minigame-05 | 36 | 0 | 0 | 0 | 0 |
| minigame-06 | 33 | 0 | 0 | 0 | 0 |
| minigame-07 | 39 | 0 | 0 | 0 | 0 |
| minigame-contract-v1 | 16 | 0 | 0 | 0 | 0 |
| motion-01 | 39 | 0 | 0 | 0 | 0 |
| motion-02 | 32 | 0 | 0 | 0 | 0 |
| no-go | 143 | 0 | 0 | 0 | 0 |
| phase-a | 86 | 0 | 0 | 0 | 0 |
| phase-b | 22 | 0 | 0 | 0 | 0 |
| phase-c | 17 | 0 | 0 | 0 | 0 |
| **Total** | **571** | **0** | **0** | **0** | **0** |

## 26. Browser QA

Browser runtime default discoveryは`No browser is available`、binding一覧は`[]`だった。実ブラウザーでのdelayed resolve/reject、exit/replay、pause、viewport、runtime exception/unhandled rejection、external request、RAF/interval certificationは0 checksである。

Core/DOM/lifecycle automated testsはPASSしたがBrowser PASSとは表現しない。製品sourceを変更して環境制約を回避していない。

**BROWSER CERTIFICATION NOT RUN**

## 27. Integrity / Build / Bundle

- stage ID integrity: PASS (`oldIdHits: 0`, referenced subset OK)
- `git diff --check`: PASS（content error 0、GitのLF/CRLF checkout warningのみ）
- production build: PASS (Vite 5.4.19, 122 modules)
- package/lock/runtime dependency delta: 0
- protected Contract/Host/adapter/games 01〜06/core/main RAF paths: delta 0
- production loader external network dependency/request code: 0

既存のVite CJS、static/dynamic import、500 kB超chunk warningsは非fatalのまま残る。

| Artifact | MINIGAME-06 | MINIGAME-07 | Delta |
| --- | ---: | ---: | ---: |
| main JS | 645,887 B | 660,878 B | +14,991 B |
| main JS gzip | 183,753 B | 187,555 B | +3,802 B |
| all JS | 657,304 B | 672,295 B | +14,991 B |
| all JS gzip | 188,170 B | 191,972 B | +3,802 B |
| CSS | 48,657 B | 48,657 B | 0 B |

## 28. Stable Contract evaluation

Stable surface変更0。既存の同期`enter/update/dispatch/exit`、session identity、stale rejection、snapshot View、cleanupだけでasync lifecycleを隔離できた。async readiness、Promise return、cancel hook、AbortSignal、load stateはStableへ追加していない。

## 29. Provisional findings

- `loadQuestions` injection、AbortController、generation/token名はGAME-LOCAL / PROVISIONAL。
- loading/ready/failed phaseと`loadError` fieldはGAME-LOCAL。
- loading時間をactiveElapsedへ含めないpolicyは本gameのproblem未提示semantics。
- pause中resolveをreadyで待機させるpolicyはgame-localだが、既存pauseを変更しない。
- retry、shared cache、streaming content、network authは未検証・DEFERRED。

## 30. Async Contract evaluation

ASYNC LIFECYCLE ISOLATIONはContract v1で成立した。Promise自体をHostへ露出せず、instanceがsettlementを内部commitし、既存Host updateが次frameにsnapshotを描画する。exit/new sessionは同期generation invalidationにより、abort非協力的loaderのlate completionも遮断する。

## 31. Contract v2 trigger evaluation

現probeではtriggerなし。次が複数gameで実証された場合にv2候補となる。

- Hostがgame表示前に共通readinessをawaitしないと安全性/UXを満たせない。
- async resource cleanup完了を待つ共通exit保証が必要。
- shared streaming/caching/auth lifecycleがgame-local gateでは表現不能。
- cancellation signalをHost-owned resourceと協調させる必要が複数gameで発生。
- late completionをinstance identityだけで隔離できない具体例が再現。

## 32. Known limitations

- Browser Certification未実施。
- production loaderはlocal fixtureのmicrotask resolveであり、実network latency/auth/streamingは対象外。
- retry、同一instance内の二回目load、shared cacheは未実装。
- abort APIはresource節約を確認したが、transport固有のabort完了保証は検証していない。
- fixtureはarchitecture probe用self-authored教材でcurriculum certification対象外。

## 33. Decision

| Question | Decision |
| --- | --- |
| A Stable Contract変更0で成立したか？ | **YES** |
| B Host変更0か？ | **YES** |
| C HostはPromiseをawaitしていないか？ | **YES** |
| D Hostはloading / ready / failureを理解していないか？ | **YES** |
| E `enter()`をasync化せず成立したか？ | **YES** |
| F late resolveを旧sessionとして拒否できたか？ | **YES** |
| G late rejectを安全に無視できたか？ | **YES** |
| H replay後の旧Promise completionを拒否できたか？ | **YES** |
| I exit後の旧Promise completionを拒否できたか？ | **YES** |
| J pause中のasync completionを安全に扱えたか？ | **YES** |
| K unhandled rejection 0か？ | **YES** |
| L LearningEvent type追加0か？ | **YES** |
| M LearningEvent envelope変更0か？ | **YES** |
| N Companion / Collection変更0か？ | **YES** |
| O shared async managerは不要だったか？ | **YES** |
| P AbortControllerをStable Contractへ追加する必要はなかったか？ | **YES** |
| Q Contract v2が必要になったか？ | **NO** |

**MINIGAME-07 TECHNICAL PROBE PASS**

**ASYNC LIFECYCLE ISOLATION PROVEN**

**LATE COMPLETION SAFELY REJECTED**

**CONTRACT V2 NOT REQUIRED**

**BROWSER CERTIFICATION NOT RUN**
