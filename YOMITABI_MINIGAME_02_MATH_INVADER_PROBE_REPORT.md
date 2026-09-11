# YOMITABI MINIGAME-02 Math Invader Minimal Probe Report

実施日: 2026-09-11 JST

## 1. Executive Summary

Math Sprint用に作ったMiniGame Hostへ、複数の問題が同時に存在し、敵選択と継続updateを持つMath Invader Minimal Probeを接続した。有限10問、加算5問/減算5問、同時enemy最大3体、固定降下速度、life 3、正答で解決、誤答でlife減少と同じenemyへの再回答、clear/game overまでを実装した。

結論はPASS。Hostの外向き`enter / update / exit / setPaused`、LearningEvent envelope、Collection adapter、Companion adapter、Sprint generator、submission helperを再利用できた。新RAF、interval、save schema、Storage key、dependency、battle変更は0。

Hostは完全無変更ではなかった。Sprint Viewを直接importする仮定と`mathSprintScreen`固定参照をRegistryのview factoryと`view.root`へ置き換えた。また、誤答直後に新attemptを発行するゲームで見つかったView再bind raceを、accepted submit/select後の同期`update(0)`で解消した。Host内に`mathInvader`分岐はない。

既存373 testsと追加26 testsは合計399 PASS。integrity/build PASS。隔離headless Chromeによる最終Browser Functional QAは77 checks PASS、外部/Firebase成功0、runtime exception 0。

## 2. Git / checkpoint

| 項目 | 値 |
|---|---|
| 基点branch | `experiment/minigame-math-sprint` |
| checkpoint commit | `f067a6ce8c611b0f68d8ba456a4fb511e5dfc9e2` |
| checkpoint tag | `yomitabi-minigame-01-checkpoint-2026-09` |
| tag peeled commit | `f067a6ce8c611b0f68d8ba456a4fb511e5dfc9e2` |
| 新branch | `experiment/minigame-math-invader-probe` |
| 新worktree | `C:/kanji-game-latest/artifacts/minigame-02/worktree` |
| baseline status | clean |

新worktreeはcheckpoint commitから直接作成した。main、2D stable、Motion branch/tag、3D branch/tag、MINIGAME-01 branch/tagを変更していない。commit、push、tagは実施していない。

baselineは268 + MOTION-01 39 + MOTION-02 32 + MINIGAME-01 34 = 373 PASS、FAIL/cancelled/skipped/todo全0、integrity/build PASS。

## 3. Files changed

変更:

- `src/minigames/miniGameHost.js`
- `src/minigames/registry.js`
- `src/minigames/mathSprint/mathSprintView.js`
- `src/screens/titleScreen.js`
- `tests/minigame-01/scope-contract.mjs`
- `tests/motion-02/scope-audit.mjs`

追加:

- `src/minigames/mathInvader/mathInvaderGame.js`
- `src/minigames/mathInvader/mathInvaderView.js`
- `tests/minigame-02/core.test.mjs`
- `tests/minigame-02/lifecycle.test.mjs`
- `tests/minigame-02/scope.test.mjs`
- `tests/minigame-02/scope-contract.mjs`
- `tools/minigame-02/functional-qa.mjs`
- `tools/minigame-02/README.md`
- 本報告書

`src/init/fsmsetup.js`は変更0。同じ`miniGame` FSM screenとHostを使用した。screenshots、Chrome profile、JSON、失敗run、build output、`node_modules`はworktree外のartifactに保持した。

## 4. Existing Host reuse

Host外向きcontractは`enter(props) / update(dtMs) / exit() / setPaused(boolean)`のまま。既存main RAF → FSM → Host → game update/View/Companionという経路を使用した。

必要だったHost変更は次の範囲。

1. hardcoded `createMathSprintView`をRegistry definitionの`createView`へ移した。
2. hardcoded `document.getElementById('mathSprintScreen')`を`view.root`へ変えた。
3. Invaderだけが必要とする敵選択を、gameId分岐なしの`onSelect → game.select`として渡した。
4. accepted submit/select後に`host.update(0)`でViewを同期した。
5. ViewがCanvasを持たない将来形でもHostが壊れないよう、Canvas presentを存在確認した。

Host内に`mathInvader`文字列、switch/case、Invader state解釈、enemy/spawn/life/projectile処理はない。既存Sprintのenter/answer/Next/replay/exitは34 testsで維持した。

## 5. Registry second entry

Registryは`mathSprint`と`mathInvader`の2 entriesになった。

各definitionは`id / title / create / createView`を持つ。View factoryをRegistryへ持たせたため、単純な2entry追加だけではない。これはHostがSprint Viewを直接所有していた仮定を除くための最小変更であり、plugin loader、dependency resolver、version negotiationは追加していない。

## 6. Math Invader Core

CoreはDOM、Motion、Storage、scheduler、gameStateに依存しないsession memory。modeは`minimalProbe`。

- problem pool: 10
- addition/subtraction: Sprint generatorの5/5
- max enemies: 3
- starting life: 3
- spawn interval: 900ms
- descent speed: `0.000035` normalized y/ms、1種類
- completion: 10 resolvedでclear、life 0でgame over

enemyの正史はCore state。DOM element、dataset、CSS positionは表示だけ。

## 7. Enemy identity

各enemyは`enemyId / problemId / question / answer / operation / skillId / lane / y / state / attemptId / token`を持つ。

選択切替時は前enemyのattemptId/tokenを無効化し、新しいenemyへ新attemptを発行する。resolved enemyはactive配列から除外され、古いenemyId/problemId/tokenによるsubmitは拒否される。

## 8. Spawn / update

初回enterで1体をspawnし、以後はHostの`dtMs`を積算して最大3体までspawnする。10問poolを超えない。

長い1 frameでもspawn accumulatorを「1体spawn可能」までに制限し、1 updateで複数体をburst spawnしない。visibility/manual pause中は積算0。enemy選択中はactive learning timeを進めるが、降下とspawn simulationは停止する。降下dtは100msにclampし、resume/長frameの位置jumpを抑える。

初号にはenemyの画面下到達による追加penaltyを入れていない。yは操作可能範囲内で止まり、lifeを減らすのは誤答だけ。

## 9. Selection / Input

enemy buttonをclick/touchすると、そのenemyを選択して盤面降下をpauseし、数値inputへfocusする。別enemyへ切替可能。

InputはMINIGAME-01の`bindMathSprintInput`を変更せず利用した。numeric input、数字pad、削除、Enter、回答button、全角数字、IME composition、key repeat、double submissionを同じgateで処理する。

## 10. Attempt / Token

submitは`sessionId / enemyId / problemId / attemptId / token`の全identity一致を要求する。tokenはcounterやeventより前に消費する。

誤答時は同じenemyを残し、古いattemptを再利用せず新attemptId/tokenを発行する。enemy切替、解決、exit、session切替で古いcallbackを拒否する。

Browser QAの2回目で、誤答commit後から次frameのView rebind前に入力すると、新入力がView更新で消えるraceを検出した。Hostがaccepted command後に同期`update(0)`することで、新attempt bindingを入力受付前に確定した。失敗runは`artifacts/minigame-02/browser-final/`へ残し、修正後runと分離した。

## 11. Correct / Incorrect

正答順序:

1. token消費
2. correct/resolved/streak/enemy state commit
3. clearならresult固定
4. `correct` LearningEvent通知
5. Companion attackとdisplay-only projectile
6. clearなら`sessionComplete`

誤答順序:

1. token消費
2. incorrect/life/streak commit
3. lifeが残れば新attempt発行、0ならgame over result固定
4. `incorrect` LearningEvent通知
5. Companion idle
6. game overなら`sessionComplete`

弾到達、Motion完了、View更新は採点条件ではない。

## 12. Life / Clear / GameOver

lifeはMath Invader session専用で初期3、誤答ごとに1減少する。ヨミタビplayer HPへ接続していない。

10体resolvedで`outcome='clear'`、life 0で`outcome='gameOver'`。resultは`outcome / correct / incorrect / resolved / life / accuracy / maxStreak`のimmutable objectとして1回固定する。両終了で`sessionComplete`は1回だけ。

## 13. LearningEvent reuse

既存envelopeを変更せず使用した。

`version / gameId / sessionId / seq / type / problemId / activeElapsedMs / payload`

event typeも`problemPresented / correct / incorrect / sessionComplete`の4種類のまま。enemyId、attemptId、life、resolvedはInvader eventのpayloadだけに置き、共通schemaへenemyY/spawnSpeed等を追加していない。

Observerの例外、false、未解決Promise、reject Promiseを隔離し、Core進行をblockしない。snapshot/View updateでeventは再発火しない。

## 14. Companion reuse

`src/minigames/companionAdapter.js`はcheckpointからbyte変更0。

- problemPresented: idle
- correct: attack
- incorrect: idle
- sessionComplete: idle

owned HKD-E01だけを表示し、unownedではhost/image load 0。画像pending/failure中も回答可能。reduced motionは既存adapter/Motion Engine経路を使用する。Invader専用Motion code、profile、画像は0。

## 15. Collection reuse

`src/minigames/collectionAdapter.js`はcheckpointからbyte変更0。確認済みactive save snapshotの`krb_save.player.collection.gotomonIds`だけをread-onlyで導出する。

`krb_monster_dex`へ製品codeから直接accessせず、ownershipの自動追加・書込み・selectedCompanionId永続化は0。

## 16. Projectile / Visual

projectileはCSSの小さな表示要素。Coreが正答をcommitしLearningEventを通知した後に、360msの表示stateを生成する。独自RAF、timeout、Web Animation callbackは持たない。Host updateで寿命を減らし、終了後に除去する。

projectile stateは採点callbackを持たず、late hitでenemyを再処理できない。exitでprojectile配列とDOM参照を破棄する。

## 17. Pause

pause理由を次のように分離した。

- visibility/manual: HostがORし、gameのexternal pauseとして渡す
- answer: selectedEnemyIdによるsimulation pause

visibility/manual pauseはinput、activeElapsed、spawn、descent、projectileを止める。answer pauseはspawn/descentだけを止め、回答時間はactiveElapsedへ含める。enemy解決でanswer pauseが解除されても、Host側のvisibility/manual pauseは解除されない。resume時のdt蓄積burstはない。

## 18. Exit / Lifecycle

exitはinput停止、session invalid、Core exit、enemy/token/projectile破棄、Companion dispose、visibility/viewport/keyboard/DOM listener解除、DOM cleanupの順。冪等。

unit/lifecycleとBrowserの各10 enter/exitで、session/Companion null、root DOM 0、mini-game listener 0、新RAF/interval 0を確認した。pending imageのlate completionも旧sessionを復活させない。

## 19. Core Isolation

Math Invader sourceはsave API、localStorage/sessionStorage、漢字Core、player HP/EXP、stage progressionを参照しない。

架空E0 fixtureでgameStateとStorageを開始前/clear後に比較し、既存playtimeを除く差分0。unit testではStorage write/deleteを例外化した状態でgame overまで進め、write 0を確認した。新save schema/key 0、collection変更0。

## 20. Tests

`node --experimental-default-type=module --test tests/minigame-02/*.test.mjs`

| File | tests |
|---|---:|
| `core.test.mjs` | 16 |
| `lifecycle.test.mjs` | 6 |
| `scope.test.mjs` | 4 |
| 合計 | 26 |

26 PASS、FAIL/cancelled/skipped/todo全0。

generator再利用、max3/有限10/spawn、select/switch/old token、correct/incorrect/retry、life、clear/game over、commit-before-event、observer隔離、pause、shared input、Sprint+Invader同一Host、Companion/Collection、Core/Storage isolation、10 lifecycle、strict scopeを検証した。

## 21. Existing Regression

| Suite | PASS |
|---|---:|
| phase-a | 86 |
| phase-b | 22 |
| phase-c | 17 |
| no-go | 143 |
| Baseline subtotal | 268 |
| MOTION-01 | 39 |
| MOTION-02 | 32 |
| MINIGAME-01 | 34 |
| Existing subtotal | 373 |
| MINIGAME-02 | 26 |
| Total | 399 |

全suiteでFAIL/cancelled/skipped/todoは0。MOTION-02のbattle 9 hook、Motion Engine/checkpoint、package/lockを維持した。

## 22. Build / Bundle

`node scripts/verify_stage_id_integrity.mjs` PASS。`npm.cmd run build` PASS、107 modules transformed。

| Bundle | MINIGAME-01 | MINIGAME-02 | delta |
|---|---:|---:|---:|
| main JS bytes | 577,323 | 591,025 | +13,702 |
| main gzip | 165,310 | 169,422 | +4,112 |
| all JS bytes | 588,740 | 602,442 | +13,702 |
| all JS gzip | 169,725 | 173,838 | +4,113 |
| CSS bytes | 48,657 | 48,657 | 0 |

main SHA-256は`765e17a0c89b228d3ce1cd288962e6b8a27c3584d217c320fd57e78df750b96d`。gzipはlocal zlib参考値。既存ViteのCJS、dynamic/static import、500kB chunk警告は残る。新dependency 0。

## 23. Browser Functional QA

最終証拠:

- `C:/kanji-game-latest/artifacts/minigame-02/browser-final-02/result.json`
- status: PASS
- checks: 77
- external/Firebase success: 0
- runtime exceptions: 0
- mini-game RAF: 0
- mini-game interval: 0
- max Host update: 0.6ms

経路はtitle → Invader → spawn3 → select/switch → correct → incorrect → retry → 10 resolved → clear result → exit/reenter、およびunowned 3誤答 → game over。owned/unowned、pending/failure、reduced motion、visibility/manual/answer pause、390x844、844x390、mouse/touch/keyboard、全角/IME/repeat/double submit、10 lifecycleを確認した。

headless ChromeのPerformanceObserverで70msのlong taskを1件観測したが、Host update最大は0.6msで、mini-game sourceの新schedulerも0。今回の小規模probeでは発生元を新Invader codeへ帰属できず、性能benchmarkや全stall 0の主張はしない。

初回`browser-01`はPASS。mobile Companionを盤面外へ移した後の`browser-final`で誤答直後raceを再現してFAILし、修正後の`browser-final-02`が最終PASS。失敗証拠を削除していない。実ユーザーsave/profileは不使用。Firebase requestは遮断した。

## 24. Cross-game Boundary Evaluation

A. **MiniGame Hostは変更なしでは使えなかった。** lifecycle、pause、RAF接続は再利用できたが、View factory/rootのhardcodeとcommand後View同期を一般化する最小変更が必要だった。

B. **Registryは2entry化だけでは済まなかった。** 各entryへ`createView`を追加し、Sprint/Invader双方のCore+View pairをRegistryで選べるようにした。

C. **LearningEvent envelope変更は不要。** 4 event typeも変更0。

D. **Companion adapter変更は不要。** byte再利用。

E. **Collection adapter変更は不要。** byte再利用。

F. **Input helperの挙動はSprint固有ではなかった。** 変更0で複合identityを渡せた。ただしファイル名/API名が`mathSprint`配下にあり、配置と命名はSprint固有。

G. **Math Sprint固有game logicをHostへ移す必要はなかった。** View選択をHostからRegistryへ移し、HostからSprint固有知識を減らした。

## 25. What Was Sprint-Specific

- Hostによる`createMathSprintView`直接import
- Hostによる`mathSprintScreen`固定DOM lookup
- RegistryがCore factoryだけを持ち、View選択が外に出ていたこと
- input helperのpath/name
- Sprintの`submit → feedback → next`では、同一enemyへ即retryする再bind raceが表面化しなかったこと
- game instanceの`next()`はSprint固有、`select()`はInvader固有

## 26. What Is Truly Shared

- FSMの1 screenとしてのHost
- main RAFからの`update(dtMs)`
- `enter / update / exit / setPaused`
- sessionIdとold-session拒否
- accepted command後の同期View更新
- seedable finite 10問generator
- whole-integer normalizeとsubmission gate
- LearningEvent envelope、seq、observer隔離、commit-before-event
- read-only Collection boundary
- display-only Companion adapter
- visibility/manual pause合成
- View/Companion/listener/DOM cleanup

## 27. Contract-v1 Implications

本probeから、definitionの`create`と`createView`、instanceのlifecycle、snapshot、HostからViewへ渡すcommand callbackは共通候補になる。

一方、`next`と`select`を全gameへ空methodとして強制すべきではない。現在のHostは`submit / next / select`を個別に接続しており、3本目のmechanicでさらにcommandが増えるなら、小さな`dispatch(command)`境界を検討できる。今回はcontract v1を確定せず、名前変更やshared input移動も行わない。

## 28. Known Limitations

- probeは1 speed、加減算、有限10問だけ。
- enemy bottom到達、衝突、stage、timer、score倍率、audio、ranking、card、saveは未実装。
- yは操作範囲内で停止し、game overは誤答3回だけ。
- input helperは再利用可能だがSprint directoryに残る。
- ViewはDOM/CSS。Canvas enemy engineや大量entity性能を証明しない。
- Browser QAはheadless Chromeとsynthetic visibility/IME。物理mobile、OS keyboard、日本語IME実機認証ではない。
- observed 70ms long taskのstack帰属と長時間heap/GPU安定性は未検証。
- Platform contract v1、persistent progress、selected companion pickerは未確定。

## 29. MINIGAME-03 Readiness

2つ目のmechanicにより、Host lifecycle、RegistryによるCore/View選択、LearningEvent、Collection、Companion、input identity、pause、cleanupの共通性を比較できる材料が揃った。

次の別タスクではSprintとInvaderの差分を基にcontract v1を決定できる。ただし本probeのPASSから自動的にcontractを固定せず、Math Invader完成版、save永続化、party/EXP、1000体、3Dへ進まない。

## 30. Decision

Math Sprintの単一問題/Next型とは異なる、複数enemy・selection・継続update・retry・life・2種類の終了を同じMiniGame Hostで成立させた。必要なHost変更はSprint View hardcodeの除去とcommand後View同期に限定され、gameId分岐、LearningEvent破壊、Companion/Collection変更、新scheduler/save/dependency/battle変更は発生しなかった。

MINIGAME-02 PASS  SECOND MECHANIC PROVEN
