# YOMITABI 漢字防衛隊 Release Certification Report

Date: 2026-09-12

Current integrated status: **CHILD PLAYTEST NOT AUTHORIZED**.

The repo-local Playwright rerun supersedes the historical browser-environment block below for automated browser scope: system Chrome completed 47/47 checks with Desktop, 390×844, 844×390, runtime, performance and lifecycle PASS. Project owner manual QA dated 2026-09-12 records Actual Windows Japanese IME and real mobile soft keyboard as PASS, closing the Browser/Input gate. Unspecified device, OS and browser versions are explicitly `NOT RECORDED`. The Human Content Review pack remains unsigned with 0 human-approved items, and full-session → result → Replay adult QA is not explicitly recorded. These remaining gates prevent child authorization.

Current source-of-truth regression is 70 test files / **649 PASS**, fail / cancelled / skipped / todo = 0. Production build and stage integrity pass. The Limited UX runtime pool is 21 pre-reviewed items and excludes `以下`、`位置`、`結果`; 12-item sessions remain unique. Browser/Input is complete. Limited Child UX Pilot remains NOT AUTHORIZED solely because Adult Full-Session QA is only partial. Formal educational playtest/public release additionally remain blocked by Human Content Review. See `YOMITABI_KANJI_DEFENSE_CHILD_PLAYTEST_READINESS_FINAL_REPORT.md`; sections below retain earlier certification history.

## 1. Executive Summary

漢字防衛隊のArchitecture GateはPASSした。現checkpointの専用58 testsはPASSし、retry、escape、routeBroken、pause、identity、observer isolation、IME event gate、cleanup、Storage isolationに回帰はない。

Release Certificationとchild playtest readinessは**BLOCKED**である。supported browser runtimeにreal browserが0件で、viewport、actual IME、soft keyboard、computed touch/overflow、console/network/performanceを認証できない。また24語はAI/engineering pre-reviewまでで、人間の国語教材reviewを完了していない。

製品コード修正は行っていない。現在証明できない品質を推測でPASSにせず、browser再実行手順、24語item review、child playtest protocolを固定した。

## 2. Git / Build State

- Starting branch: `product/kanji-defense`
- Starting HEAD: `cd1056b3f2fe9540ee65a0869ba504e61ad36e38`
- Starting tag: `yomitabi-kanji-defense-mvp-2026-09`
- Final worktree: 2 modified scope-contract allowlists and 4 untracked certification artifacts; nothing staged
- Stage ID integrity: PASS (`oldIdHits: 0`; referenced IDs are a subset of stages)
- Production build: PASS (Vite 5.4.19; 125 modules)
- Main JavaScript bundle: 649.70 kB / gzip 196.44 kB
- Build warnings: existing dynamic/static import and 500 kB chunk-size warnings only
- Certification差分: report/protocol/pre-review/browser evidenceとscope allowlist maintenanceのみ
- Product source delta during certification: 0
- Remote push: 実施しない

## 3. Certification Scope

Gate A Architecture/Regression、Gate B Real Browser/Device UX、Gate C Content、Gate D Child Playtest Readinessを独立判定した。新mechanic、content expansion、reward、persistence、Contract/Event変更、UI redesignはscope外。

## 4. Architecture Gate

**PASS.** Definition/Instance/ViewはContract v1 exact surfaceを維持する。Host、LearningEvent source、Companion、Collection、Storage/save、main RAF、Math Invader、package/lockに変更なし。Coreがselection/attempt/token/entityを検証し、View disabledだけに依存しない。

Retryはfirst wrongで旧attempt/tokenを無効化し、新identityを発行する。comboは0、lifeは不変、hintをcommitし、completion eventは出さない。correct retryまたはsecond wrong/escapeだけがterminalになる。stale Enter、double submit、old targetは拒否される。

Escapeはenemyを除去して`incorrect`を一度通知しlifeを1減らす。life 0ではその時点の残active threatsだけを`routeBroken`で一度ずつcloseし、未spawn encounterを提示せず、result commit後に`sessionComplete`を一度通知する。

## 5. Regression

Final source of truth (2026-09-12): all `.test.mjs` files were run with `--test-concurrency=1`; **647/647 PASS**, fail 0, cancelled 0, skipped 0, todo 0. The dedicated kanjiDefense suite is 58/58 PASS. No assertion was removed or weakened and no test was skipped or marked todo.

| Suite | PASS |
| --- | ---: |
| minigame-01 | 34 |
| minigame-02 | 26 |
| minigame-03 | 21 |
| minigame-04 | 27 |
| minigame-05 | 36 |
| minigame-06 | 33 |
| minigame-07 | 39 |
| minigame-contract-v1 | 16 |
| minigame-platform-v1 | 18 |
| minigame-production-kanji-defense | 58 |
| motion-01 | 39 |
| motion-02 | 32 |
| no-go | 143 |
| phase-a | 86 |
| phase-b | 22 |
| phase-c | 17 |
| **Total** | **647** |

## 6. Browser Environment

Supported browser-control runtimeを初期化しdefault browserを要求した結果は`No browser is available`、supported browser inventoryは`[]`だった。別backend、DOM simulation、source inspectionを代替browser certificationにしていない。

## 7. Browser Certification

**FAIL — ENVIRONMENT BLOCKED, PRODUCT RESULT UNKNOWN.** 詳細は`YOMITABI_KANJI_DEFENSE_BROWSER_CERTIFICATION.md`。Screenshots、computed layout、actual device/IME、console/network traceは取得不能。

`RELEASE CERTIFICATION BLOCKED: REAL BROWSER UNAVAILABLE`

## 8. Desktop

NOT RUN。TitleからBackまでのreal smoke flow、tab order、three-target readability、rendering performanceは未認証。

## 9. Portrait

390 × 844、360 × 800ともNOT RUN。CSS sourceとDOM testは存在するが、overflow、visual viewport、focused-input layoutを証明しない。

## 10. Landscape

844 × 390はNOT RUN。height media ruleはあるが、lane/prompt/inputの同時可視性を証明しない。

## 11. IME

Automated DOM testではcomposition中Enter、`isComposing`、repeat Enterを拒否し、composition終了後だけsubmitできる。actual Japanese IMEのcompositionupdate、focus loss、target switch、Back/pause競合はNOT RUN。したがってIMEはsource/DOM level PASS、real browser certificationは未完了。

## 12. Soft Keyboard

NOT RUN。input occlusion、layout jump、selected Monster/threat visibility、scroll restorationはrelease blockerとして未認証。

## 13. Touch / Pointer

Synthetic pointer/click pathはPASS。Monster、Back、Submit、Replayに44px source ruleがある。実computed size、tap accuracy、lane target overlapはNOT RUN。

## 14. Focus / Keyboard

Focusable Monster buttons、text input、Back、Replayと`:focus-visible` sourceを確認。lane keys 1〜3とEnterのDOM testsはPASS。実tab order、focus ring contrast、IME focus behaviorはNOT RUN。

## 15. Pause / Visibility

Core/Host testsはmanual/visibility OR、movement/spawn/input/activeElapsed freeze、typed text保持、resume位置維持をPASS。hidden-tab real transitionとforeground復帰はNOT RUN。movementは1 update最大250msにboundされ、background catch-up全滅を防ぐ設計である。

## 16. Reduced Motion

CSSはMonster transitionを停止し、Companion adapterはreduced motionをdisplay-onlyで扱う。機能継続のautomated testはPASS。actual media emulationとvisual readabilityはNOT RUN。

## 17. Image Failure

Synthetic image errorでtext-safe fallbackが表示され、target/Coreが継続するtestはPASS。real decode failure、layout shift、network error renderingはNOT RUN。

## 18. Runtime / Network

Observer throw/rejected Promise/reentrant dispatchはCore testで隔離済み。新external loader/requestはsourceにない。real console error、unhandled rejection、request logはNOT RUN。

## 19. Performance

Core updateは最大3 entitiesのO(3)、game-owned RAF/intervalなし。ten-cycle automated lifecycleでDOM/listener/scheduler accumulationなし。real frame pacing、typing/submit/switch latency、long task、image decode、replay degradationは未測定。

## 20. Repeated Lifecycle

Automated ten-cycle enter/exitとfull result/replay/BackはPASSし、old callbacks、DOM/listeners、Monster/Companionを残さない。real ten-cycle操作はNOT RUN。

## 21. Content Review

24語をitem単位で`YOMITABI_KANJI_DEFENSE_CONTENT_REVIEW.md`へ記録した。source identity/schema/reading形式はautomated PASS。AI/engineering pre-reviewでは明白な誤読、攻撃的内容、固有名詞依存を検出しなかった。

## 22. Approved / Revised / Removed Items

- APPROVE (PRE): 21
- REVISE: 3 — `以下`（meaningと短すぎるhint）、`位置`（短すぎるhint）、`結果`（meaning/hintの曖昧さ）
- REMOVE: 0
- Human certified: **0**

21語はhuman review候補でありchild-use認証ではない。人間review後に16語以上を確保すれば12問非重複の短縮playtest packを構成できる。

`CONTENT PRE-REVIEW COMPLETE`

`EDITORIAL HUMAN REVIEW STILL REQUIRED`

## 23. Child-facing Safety

Source/logic reviewでは過剰点滅、新loot/paywall、forced endless play、保存streak shame、個人情報収集はない。life 0でも結果へ進み、誤答文言は`もう一度`とcorrect reading確認で、子どもを責めない。新audioはなくsilent-safe。Monsterは既存の年齢対象assetを使う。

ただしvisual intensity、Monsterの怖さ、focused soft keyboard、実failure feedbackの受け止めはreal adult QA/child observation前なので未認証。critical safety defectはsource上0、real-browser unknown。

## 24. Playtest Readiness

**NO.** Gate AだけPASS、Gate Bはblocked、Gate Cはhuman pending。Protocolはreadyだがtest buildを未成年へ提示するauthorizationは出さない。次の許可対象はreal-browserを使ったadult internal QAである。

## 25. Playtest Protocol

`YOMITABI_KANJI_DEFENSE_CHILD_PLAYTEST_PROTOCOL.md`に9〜12人、guardian consent/child assent、匿名ID、raw typed text非保存、neutral observer script、stop rule、observation sheet、post-play questions、iteration decisionを固定した。

## 26. Metrics

Rule understanding median ≤30秒、first completion ≥80%、replay intent ≥60%、learning recognition ≥80%、accuracy 55〜85%。補助指標はfirst correct target time、input errors、mis-selection、retry success、escape、average active Monsters、active session duration。

## 27. Typing Bias Risk

**重大になり得る未測定risk。** Scoreはtyping speedを直接加点せず、target選択中は全体速度35%、retryあり、巨大delta boundあり。ただし実IME/soft keyboardと子どもの入力速度を測っていない。参加者25%以上で「口頭正解できるが入力前escape」が複数回ならmechanical tuning必須とする。

## 28. Strategy Validation Plan

2〜3体時にnearest threat確認、lane switching、優先理由を観察する。全員が位置を見ず左から処理する、またはtarget切替を避ける場合はstrategy claimを弱める。learning difficultyとspeed/spawnは同時変更しない。

## 29. Known Limitations

- Real browser/device evidence 0。
- Human editorial certification 0/24。
- Three content items need revision before sign-off。
- Session duration、30秒理解、strategy、typing bias、frustration、replay motivationは未測定。
- Actual viewport、soft keyboard、computed target、overflow、focus、image decode、runtime/network/performanceはunknown。

## 30. Blockers

1. Supported real browser bindingがない。
2. Desktop、390 × 844、844 × 390、actual IME/soft keyboardを含むadult QAが未完了。
3. 人間の国語教材reviewが未完了。
4. `以下`、`位置`、`結果`のrevision decisionが未処理。

## 31. Final Decision

- A Architecture / regression: **PASS**。
- B Real Browser Certification: **NO**。
- C 390 × 844: **NOT CERTIFIED**。
- D 844 × 390: **NOT CERTIFIED**。
- E IME safety: **AUTOMATED PASS / REAL BROWSER NOT CERTIFIED**。
- F Soft keyboard gameplay: **NOT CERTIFIED**。
- G Three-target readability: **STRUCTURAL TEST PASS / VISUAL NOT CERTIFIED**。
- H Pause/background: **CORE/HOST PASS / REAL VISIBILITY NOT CERTIFIED**。
- I Runtime exception/unhandled rejection 0: **NODE TEST PASS / REAL BROWSER NOT CERTIFIED**。
- J Child-test usable words: **0 certified**。21 pre-approved candidates、3 revise。
- K Human editorial review: **NO**。
- L Typing bias: **MATERIAL UNMEASURED RISK**。
- M Child-facing safety blocker: **NO SOURCE-LEVEL CRITICAL DEFECT; REAL UX UNKNOWN**。
- N Child playtest protocol: **YES, READY**。
- O Proceed to child playtest: **NO**。

Overall status: **RELEASE CERTIFICATION BLOCKED**。

`READY FOR ADULT QA ONLY`

`ADULT QA READY`

`RELEASE CERTIFICATION BLOCKED: REAL BROWSER UNAVAILABLE`

`RELEASE CERTIFICATION BLOCKED: BROWSER QA PENDING`

`RELEASE CERTIFICATION BLOCKED: CONTENT REVIEW PENDING`

`CHILD PLAYTEST NOT READY`
