# YOMITABI MiniGame Contract v1 Fixation Report

Date: 2026-09-11 (Asia/Tokyo)

## 1. Executive Summary

MINIGAME-02 checkpointを起点に、SprintとInvaderの2本で成立した境界だけをContract v1として固定した。新機能、ゲームルール、save、package、battle、Motion Engineは変更していない。

実装変更は、Hostの個別callbackを同期`dispatch(command)`へ集約すること、両Coreへ既存methodを呼ぶ薄いadapterを加えること、Registryで既存View callbackをcommandへ変換することに限定した。View、Collection、Companion、input、LearningEvent、Sprint/InvaderのCore本体は維持した。

既存399件とContract-v1 15件は合計414 PASS。fail / cancelled / skipped / todoは0。stage integrityとproduction buildもPASS。隔離Browser QAはSprint 74 checks、Invader 77 checksがPASSした。

## 2. Git / checkpoint

| 項目 | 値 |
|---|---|
| checkpoint commit | `5a233875de3fdfcbd334349f89943b7af5481987` |
| checkpoint tag | `yomitabi-minigame-02-checkpoint-2026-09` |
| tag peeled commit | `5a233875de3fdfcbd334349f89943b7af5481987` |
| branch | `experiment/minigame-contract-v1` |
| worktree | `C:/kanji-game-latest/artifacts/minigame-contract-v1/worktree` |
| 実装開始時HEAD | checkpoint commitと一致 |
| commit / push / tag | 0 |

新branch/worktreeはcheckpointから作成した。main、stable、Motion、3D、MINIGAME-01、MINIGAME-02の既存refsは変更していない。reset、restore、clean、stash、rebase、branch切替は行っていない。

変更した製品sourceは`miniGameHost.js`、`registry.js`、Sprint/Invaderのgame moduleだけ。追加文書は`src/minigames/README.md`、追加testは`tests/minigame-contract-v1/`。既存scope監査3ファイルには今回の明示pathと確定hashだけを追加した。

## 3. Contract document

`src/minigames/README.md`を短い実装者向け正式文書として追加した。Definition、Instance、View、Host context、LearningEvent、Pause/Lifecycle、Collection/Companion、Non-negotiables、game固有責務、v2条件を記載した。

Architecture Reviewの全文は複製していない。plugin protocol、runtime negotiation、永続schemaへ拡張していない。

## 4. Contract version

Contract versionは1。今回はruntimeで照合する利用箇所がないため、`MINIGAME_CONTRACT_VERSION`定数は追加しなかった。文書とLearningEventの既存`version: 1`で十分であり、definitionごとのversion fieldもない。

## 5. Definition v1

Registryの2 definitionは次の4 fieldを必須とする。

- `id`
- `title`
- `create(context)`
- `createView(context)`

`subject`、`capabilities`、definition version、loader、resolverは追加していない。contract testはSprintとInvaderの両entryについて4 fieldを検証する。

## 6. Instance v1

両game instanceで次を固定した。

- `enter()`
- `update(dtMs)`
- `setPaused(boolean)`
- `snapshot()`
- `dispatch(command)`
- `exit()`

Sprintの`submit/next`、Invaderの`submit/select`は互換用の内部methodとして残るが、Hostは呼ばない。新しい`start/resume/render/dispose`等の空methodは追加していない。

## 7. dispatch(command)

`dispatch({ type, payload })`は同期で、受理時だけ`true`、拒否時は`false`を返す。unknown commandは両gameで`false`。Promise、global bus、queue、middlewareはない。

Sprint adapterは`submit`と`next`へ、Invader adapterは`submit`と`select`へ薄く委譲する。Hostは`type`を読まず、`game.dispatch(command) === true`のときだけ`host.update(0)`を1回行う。拒否commandと旧session callbackではView更新0。

command payloadの詳細はPROVISIONALであり、v1の共通fieldへ昇格させていない。

## 8. View compatibility

Sprint/Invader View sourceはcheckpointとbyte一致する。Registryの薄いadapterが既存`onSubmit/onNext/onSelect` callbackをcommandへ変換するため、View内部にPlatform busを導入していない。

View return contractは既存どおり`root / update / stopInput / dispose`、`canvas`はoptional。callback引数名とpayload形はPROVISIONAL。Hostから特定ViewのimportやgameId別callback分岐はない。

## 9. Host context

gameの`create` contextは既存の`sessionId / random / onEvent`を維持する。Storage、save API、global gameState、SRS、player HP/EXP、Collection、CompanionをCoreへ渡していない。

`random`の長期的位置はPROVISIONALであり、今回移動や抽象化をしていない。

## 10. LearningEvent v1

既存envelopeを変更せず固定した。

- `version`
- `gameId`
- `sessionId`
- `seq`
- `type`
- `problemId`
- `activeElapsedMs`
- `payload`

event typeは`problemPresented / correct / incorrect / sessionComplete`の4つ。Contract testは全field、version 1、連番、4 type、sessionComplete終端を確認する。Core stateをcommitしてからobserverへ通知する順序を両gameで検証した。observerの返値、Promise、例外、animationは学習進行条件にならない既存試験も維持した。

## 11. Pause model

Hostは`visibilityPaused`と`manualPaused`を別々に保持し、そのORを`setPaused(boolean)`へ渡す。片方のresumeで他方を解除しないことを新Contract testで確認した。

Invaderのanswer/select pauseはgame内部状態のままで、Platform APIへ昇格していない。新timerやresume時の蓄積dt再生もない。

## 12. Collection

`collectionAdapter.js`はcheckpointとbyte一致する。確認済みactive saveから`ownedMonsterIds`を導出するread-only境界を維持した。各gameへのStorage direct access、ownership書込、新key、新save schemaは0。

selected companionの永続化とpolicyはContract v1に含めずPROVISIONALのままとした。

## 13. Companion

`companionAdapter.js`はcheckpointとbyte一致する。`problemPresented → idle`、`correct → attack`、`incorrect → idle`、`sessionComplete → idle`の既存default mappingを維持した。

Companionはoptionalかつdisplay-only。画像load、motion、projectile、animation完了を入力、採点、次問、result、sessionCompleteの条件にしない。Host/CompanionにgameId分岐はない。

## 14. Lifecycle

FSM MiniGame Hostと既存main RAFだけを使用し、同時active gameは1つ。`enter`は既存sessionを先に`exit`する。exitはinput停止、session無効化、Core exit、Companion dispose、Host listener解除、View/DOM cleanupの順で冪等。

新Contract testは同じHostでSprintからInvaderへ切替え、旧dispatch port拒否、listener 0、View/Companionの1回dispose、二重exitを確認した。既存10 lifecycle試験も維持した。新`requestAnimationFrame`と継続`setInterval`は0。

## 15. Contract tests

`tests/minigame-contract-v1/`に3 test file、scope contract 1 fileを追加した。

| file | PASS | 主な固定事項 |
|---|---:|---|
| `contract.test.mjs` | 7 | Definition、Instance、Sprint/Invader dispatch、LearningEvent、commit順、exit/old session |
| `host.test.mjs` | 3 | accepted後だけupdate(0)、1 active game、pause OR、旧port、View return |
| `scope.test.mjs` | 5 | 明示allowlist、Core adapter以外不変、共有adapter byte一致、Host分岐0、scheduler/save/battle隔離 |
| 合計 | 15 | fail / cancelled / skipped / todo 0 |

既存assertの削除、skip、期待値緩和は0。MINIGAME-02の確定source hashには旧checkpoint hashと今回の確定Contract-v1 hashだけを許可し、negative mutation fixtureを維持した。

## 16. Sprint compatibility

Sprint Coreのphase、token、問題列、採点、score、result、LearningEventは変更していない。差分除去後のgame module全文がcheckpointと一致するscope testを追加した。

`submit / next`をdispatch経由で実行し、二重submit、旧session、旧problem、消費済みtokenが拒否される。既存MINIGAME-01 34 testsとBrowser 10問・result・replay・exit経路がPASSした。

## 17. Invader compatibility

Invader Coreのenemy、attempt、life、spawn、retry、projectile、clear/game over、resultは変更していない。差分除去後のgame module全文がcheckpointと一致するscope testを追加した。

`select / submit`をdispatch経由で実行し、旧session、旧attempt、解決済みenemyが拒否される。既存MINIGAME-02 26 testsとBrowser select・correct・incorrect・retry・clear/game over・exit経路がPASSした。

## 18. Existing 399 regression

| suite | PASS |
|---|---:|
| Baseline phase-a | 86 |
| Baseline phase-b | 22 |
| Baseline phase-c | 17 |
| Baseline no-go | 143 |
| MOTION-01 | 39 |
| MOTION-02 | 32 |
| MINIGAME-01 | 34 |
| MINIGAME-02 | 26 |
| 既存合計 | 399 |
| Contract-v1 | 15 |
| 全合計 | 414 |

全suiteでfail / cancelled / skipped / todoは0。`verify_stage_id_integrity.mjs`もPASSした。package/lock、battleScreen、Motion、save/漢字Core、public assetのcheckpoint差分は0。

## 19. Build / Bundle

`npm.cmd run build`は107 modulesでPASS。新runtime dependencyとpackage/lock差分は0。既存ViteのCJS、static/dynamic import、500kB chunk警告は残る。

| disk bytes / local zlib gzip | MINIGAME-02 | Contract-v1 | 増分 |
|---|---:|---:|---:|
| main JS | 591,025 | 591,392 | +367 |
| main gzip | 169,422 | 169,560 | +138 |
| all JS | 602,442 | 602,809 | +367 |
| all JS gzip | 173,838 | 173,977 | +139 |
| CSS | 48,657 | 48,657 | 0 |

main JS SHA-256は`a284a186b5a5c02b00f4dcad384cd713d59d3138dc2b0db5d8dbbf0616944b05`。gzipは通信量の保証ではなくlocal参考値。

## 20. Browser QA

認証済み架空E0 fixture `e0-cert-01 / Fresh MemoryStorage`、隔離headless Chrome 152.0.7977.83、新規一時profile、localhost Vite/CDPを使用した。実ユーザーsave/profileは不使用。外部requestはすべて遮断し、Firebase成功接続は0。完了後、専用Vite/Chromeを停止し4 portの閉鎖を確認した。

| 経路 | checks | external success | runtime exception | mini-game RAF / interval | max Host update |
|---|---:|---:|---:|---:|---:|
| Math Sprint | 74 PASS | 0 | 0 | 0 / 0 | 1.1ms |
| Math Invader | 77 PASS | 0 | 0 | 0 / 0 | 0.5ms |

Sprintはtitle、answer/next、result、replay、exit、owned/unowned、Companion、二重submit、mobile/touch/keyboard、pause、10 lifecycleを確認。Invaderはtitle、select、correct/incorrect/retry、clear/game over、exit/reenterと同じ共有境界を確認した。

Sprint runで57msと75msのLong Taskを観測したが、Host update最大1.1msで、今回の小さなcommand adapterへの帰属はない。性能benchmarkや物理端末/OS IME認証は主張しない。

## 21. Stable / Provisional boundary

STABLEとして固定したもの:

- Definitionの`id/title/create/createView`
- FSM Host、main RAF、1 active session
- Instanceの`enter/update/setPaused/snapshot/dispatch/exit`
- session identity、old session reject、commit-before-event
- LearningEvent v1
- read-only Collection、display-only Companion
- external pause composition、idempotent exit、cleanup
- 新RAF/interval禁止
- Host/Companion/CollectionのgameId分岐禁止

PROVISIONALとして残したもの:

- command payloadの詳細
- View factory callbackの引数名
- `random`の長期的位置
- 共通MiniGameResult wrapper
- selected companion policy

## 22. Breaking-change rules

必須field/methodの削除・改名・意味変更、dt単位やscheduler ownerの変更、session/event identityの変更、LearningEvent envelopeまたは4 typeの意味変更、commit-before-event、display-only Companion、exit/cleanup ownershipの変更はContract v2とする。

game command/payload/result詳細やregistry entryの追加は、stable invariantを守る限りv1内の追加とする。runtime negotiationやplugin互換層は導入しない。

## 23. Known limitations

- 共通MiniGameResult wrapperは固定していない。
- command payloadとView callback引数は3本目で再評価できる。
- selected companionはHKD-E01所有時のsession内解決で、永続policyはない。
- Browser QAはheadless Chromeと合成visibility/IMEであり、物理mobile/OS keyboard認証ではない。
- Sprint runのLong Taskは発生元stackを認証していない。
- Contract testは現在の2 gameから得た境界を守るもので、外部plugin protocolではない。

## 24. Third-game readiness

3本目はgame logic、game view、registry entry、必要なら小さなregistry adapterだけで追加できる。Host、Collection、CompanionにgameId分岐を増やさず、Instance lifecycle、同期dispatch、LearningEvent v1、session/token gate、external pause、cleanupを満たすことを追加checklistにできる。

3本目で見直してよいのはpayload形、View callback引数、randomの位置、Result wrapper、selected companion policy。今回それらを先取り実装していない。

## 25. Decision

2つの異なるmechanicの既存挙動を変えず、STABLE境界を短い正式文書、最小実装、15件のcontract test、既存399回帰、integrity/build、両Browser経路で固定できた。STOP条件に該当するCore書換え、Host gameId分岐、View再設計、LearningEvent/Companion/Collection/save変更、新schedulerは発生していない。

今回の完了範囲はContract v1 fixationまで。3本目game、Math Invader完成版、save v3、party/EXP/level、1000体、selectedCompanion永続化、ranking、3D、main merge、Git commit/push/tagへ進んでいない。

CONTRACT-V1 FIXED  READY FOR THIRD GAME
