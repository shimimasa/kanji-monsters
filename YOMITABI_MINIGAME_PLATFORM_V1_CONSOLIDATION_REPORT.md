# YOMITABI MiniGame Platform v1 Consolidation Report

Date: 2026-09-12 (Asia/Tokyo)

Scope: MINIGAME-01 through MINIGAME-07, Contract v1 authoring consolidation

## 1. Executive Summary

The repository implementation, seven probe reports, Contract reference, Host, registry/title integration, LearningEvent behavior, adapters, and tests were audited as source of truth. MINIGAME-01〜07 all run through the same four-field Definition, six-method Instance, View return shape, opaque dispatch, four-type LearningEvent, pause, and cleanup boundaries.

The probes add evidence for cross-subject choice, multi-step state, realtime/deadline completion, partial credit, and async lifecycle isolation without adding a Stable surface. The reusable result is documented in [`YOMITABI_MINIGAME_AUTHORING_GUIDE_V1.md`](YOMITABI_MINIGAME_AUTHORING_GUIDE_V1.md) and a copyable gate in [`YOMITABI_MINIGAME_AUTHORING_CHECKLIST_V1.md`](YOMITABI_MINIGAME_AUTHORING_CHECKLIST_V1.md). No product behavior, registry/title visibility, Host, LearningEvent implementation, Companion, Collection, Storage/save, package, lock, scheduler, or dependency change was made.

The architecture is ready to move from Technical Probe expansion to production game/content authoring. Real-browser certification remains a separate pending release gate.

## 2. Git / checkpoint

Audit base:

- worktree: `C:\kanji-game-latest\artifacts\minigame-03\worktree`
- base branch: `experiment/minigame-async-cancellation-probe`
- base HEAD: `e28bc7abb37f0dc34c4bc5fbf749cee040bf5cae`
- base tag: `yomitabi-minigame-07-checkpoint-2026-09`
- consolidation branch: `experiment/minigame-platform-v1-consolidation`
- base worktree state: clean; staged/unstaged/untracked changes 0
- upstream: none; remote push not authorized and not performed
- local checkpoint tag: `yomitabi-minigame-platform-v1-consolidation-2026-09` (final commit hash is reported in the handoff rather than embedded recursively in this file)

The main worktree's pre-existing Firebase cache, `.claude/`, and unrelated untracked reports were left untouched and are excluded from this checkpoint.

## 3. Audit scope

Audited directly:

- final Contract audit and MINIGAME-03〜07 reports;
- all seven game Core/View/fixture implementations;
- `src/minigames/README.md`, registry, title entries, and `miniGameHost.js`;
- LearningEvent production sites and fixed envelope/type tests;
- Companion/Collection adapters, pause/lifecycle, stale rejection, scheduler and Storage boundaries;
- all current test suites, integrity checks, package/lock status, build, and bundle artifacts;
- browser binding availability.

Out of scope by design: MINIGAME-08, Contract v2, new LearningEvent/result/command/async/scheduler/persistence frameworks, curriculum implementation, and probe visibility changes.

Final diff classification:

| Class | Included | Files / decision |
| --- | --- | --- |
| A. Product code | no behavior change | `src/minigames/README.md` link-only; Host/registry/title/games/adapters 0 delta |
| B. Tests | yes | new `tests/minigame-platform-v1/` plus cumulative allowlist/hash maintenance |
| C. Contract docs | yes | README role links and Authoring Guide |
| D. Reports | yes | this consolidation report and copyable checklist artifact |
| E. Tooling | no | tooling delta 0 |
| F. Unrelated/pre-existing | excluded | main worktree cache/config/untracked reports untouched |

## 4. 01〜07 Cross-Probe Matrix

| Dimension | 01 Math Sprint | 02 Math Invader | 03 English Choice | 04 Sentence Order | 05 Timed Choice | 06 Multi Select | 07 Async Choice |
| --- | --- | --- | --- | --- | --- | --- | --- |
| subject | arithmetic | arithmetic | English vocabulary | Japanese sentence order | Kanji vocabulary | mixed categories | mixed subjects |
| input | numeric submit | entity select + numeric submit | 4-choice | reorder + submit | choice or deadline | multi-toggle + submit | choice after load |
| multi-step | no | select then submit | no | repeated reorder then submit | no | repeated toggle then submit | no |
| realtime | elapsed only | entity/spawn simulation | elapsed only | elapsed only | frame deadline | elapsed only | elapsed after presentation |
| deadline | no | no | no | no | yes | no | no |
| partial credit | no | no | no | no | no | yes | no |
| async | observer only | observer only | observer only | observer only | observer only | observer only | question loader + optional abort |
| dispatch commands | `submit`,`next` | `select`,`submit` | `answer`,`next` | `reorder`,`submit`,`next` | `answer`,`next` | `toggle`,`submit`,`next` | `answer`,`next` |
| update dependency | active elapsed | simulation/spawn/elapsed | active elapsed | active elapsed | deadline + elapsed | active elapsed | active elapsed/render cadence |
| LearningEvent | fixed 4 | fixed 4 | fixed 4 | fixed 4 | fixed 4; timeout detail | fixed 4; score detail | fixed 4; no load event |
| result | local counters/streak | local clear/game-over | local counters | local counters | local timed-out count | local score/full-rate | local counters |
| pause | external | external + local simulation hold | external | external | external/deadline freeze | external/selection retained | external/settlement safe |
| stale rejection | session + token | session/entity/attempt/token | session/problem/attempt | session/problem/attempt | session/problem/attempt/consume | session/problem/attempt/consume | session/problem/attempt/generation |
| Companion | generic consumer | generic consumer | generic consumer | generic consumer | generic consumer | generic coarse consumer | generic consumer |
| Collection | read-only adapter | read-only adapter | read-only adapter | read-only adapter | read-only adapter | read-only adapter | read-only adapter |
| Storage write | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| own RAF/timer | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Common needs are lifecycle, opaque routing, Core validation, LearningEvent ordering, external pause, cleanup, and presentation adapters. Every command vocabulary, mechanic state, identity representation, payload, scoring rule, result, keyboard convention, deadline, and loader remains game-specific.

## 5. Stable Contract v1

| Surface | Status | Evidence | Consolidated rule |
| --- | --- | --- | --- |
| Definition `id/title/create/createView` | **STABLE** | 01〜07 exact registry tests | exact four-field public Definition |
| Instance method set | **STABLE** | 01〜07 + Host lifecycle | `enter/update/setPaused/snapshot/dispatch/exit` |
| View return shape | **STABLE** | 01〜07 lifecycle | `root/update/stopInput/dispose`, optional `canvas` |
| opaque dispatch | **STABLE** | numeric/choice/reorder/toggle games | Host forwards object without type inspection |
| dispatch boolean acceptance | **STABLE** | Host + all games | `true` accepted; otherwise rejected/ignored |
| accepted-command `update(0)` | **STABLE** | Host byte source/tests | synchronous render refresh |
| side-effect-free snapshot | **STABLE** | Core/View isolation tests | presentation read model only |
| LearningEvent v1 envelope/four types | **STABLE** | 01〜07 event tests | fixed coarse learning events |
| commit-before-event/observer isolation | **STABLE** | race/reentrancy tests | commit and consume before notification |
| external pause OR semantics | **STABLE** | Host/lifecycle tests | visibility OR manual passed to Core |
| stale/replayed/consumed rejection | **STABLE semantic** | 01〜07 Core tests | representation remains local |
| lifecycle cleanup/replay isolation | **STABLE semantic** | 01〜07 lifecycle | old sessions cannot mutate current state |
| Companion display-only | **STABLE boundary** | adapter + failures | correctness never depends on it |
| Collection read-only | **STABLE boundary** | adapter/scope tests | no ownership/save mutation |
| Host/main update ownership | **PLATFORM INVARIANT** | realtime/deadline probes | no game-owned continuous scheduler in v1 |

No Stable field, method, event type, or semantic was added during consolidation.

## 6. Platform invariants

- Host remains game-agnostic and owns one active Core/View/Companion.
- Core is authoritative for state, identity, scoring, completion, and stale rejection.
- View renders and captures input; it does not decide learning outcomes.
- Completion uses validate → consume/invalidate → commit → notify.
- External pause blocks gameplay input and active progression.
- Old sessions, callbacks, entities, attempts, and Promise settlements cannot change the current session.
- Learning observers and visual failures cannot roll back or gate gameplay.
- Core/View do not directly access Storage, save, battle, SRS, XP, rank, or curriculum state.
- Continuous progression uses the existing main RAF through Host `update`.
- Exit is idempotent and cleans owned input/listeners/DOM/resources.

## 7. Game-local surface

GAME-LOCAL items include command names, payload fields, snapshot shape, phase/state names, problem/entity/attempt/generation token names, fixtures and randomization, normalization, answer semantics, deadline values, score formulas/classifications, feedback, result fields, DOM structure, CSS classes, keyboard bindings, and loader/failure/retry policy.

Keeping these local is deliberate: seven mechanics share routing and safety semantics without sharing their vocabulary or data shapes.

## 8. Provisional surface

The following may be reused as examples but are not authoring dependencies:

- `onAnswer`/`onSubmit` registry-to-View callback adapters;
- concrete `sessionId/problemId/attemptId/token/generation` payload arrangements;
- lifecycle return values other than dispatch acceptance;
- current selected/default Companion policy;
- current keyboard number-key/Enter conventions;
- exact fixture module layout and ten-question session length;
- pause-time async settlement policy;
- current timeout/partial payload field names.

DEFERRED items include common persistence, curriculum/progress, selected Companion persistence, universal score/result/answer APIs, shared async manager, and a generalized scheduler.

## 9. LearningEvent model

The Stable envelope remains `version/gameId/sessionId/seq/type/problemId/activeElapsedMs/payload`, version 1. The fixed types are `problemPresented`, `correct`, `incorrect`, and `sessionComplete`.

Across the proven range, `correct` is the game-defined successful problem completion; `incorrect` is a completed attempt that did not meet that success condition. Timeout is coarse `incorrect` with local reason. Partial/zero credit are coarse `incorrect` with local score/classification; full success is `correct`. Existing common Companion behavior only needs the coarse type and does not interpret score.

Loading, load completion/failure, cancellation, input toggles/reorders, and animation completion are not learning outcomes and emit no new type. All outcomes are committed before notification; observer return/throw/rejection/reentrancy is isolated. Payload schemas remain game-local.

## 10. Lifecycle model

Host enter exits any prior session, creates the Definition/Core/Companion/View, installs Host listeners, applies external pause, calls synchronous `game.enter()`, and renders. Accepted dispatch causes `update(0)`. Main updates advance Core and Companion and render View.

Exit order remains stop input → invalidate Host session → Core exit → Companion dispose → Host listener cleanup → View dispose/DOM cleanup. Core exit invalidates identities and async generations. Replay enters a new session. The semantic guarantee is isolation and cleanup; internal arrays/helper names are implementation detail.

## 11. Identity/stale rejection

MINIGAME-01/02 use token/entity-specific identities; 03〜06 use session/problem/attempt gates; 07 adds load generation. This proves a common semantic, not a common schema: every command or late result must prove it belongs to the active state and has not been consumed.

The Guide standardizes the validation/consume/commit/notify pattern while leaving field names and token construction local.

## 12. Time-dependent pattern

MINIGAME-05 proves a deadline with only `update(dtMs)`. Core-local elapsed advances in answering state, freezes on pause, and consumes the attempt once at deadline. Dispatch-first makes answer win; update-first makes timeout win. Huge delta cannot produce duplicate completion. No wall clock, game RAF, interval, timeout command, Host timeout branch, or scheduler abstraction is required.

## 13. Partial-credit pattern

MINIGAME-06 keeps selection, deterministic bounded score, classification, points, feedback, and result local. Full success maps to `correct`; non-full completion maps to `incorrect` with detailed payload. This is semantically valid for current consumers because `incorrect` is not defined as zero earned points. A future common consumer requiring first-class partial-vs-zero behavior would be a v2 trigger, not grounds to add an event now.

## 14. Async pattern

MINIGAME-07 starts its loader inside synchronous `enter()`. Resolve/reject handlers are attached immediately and can commit only when active + generation + expected phase still match. Exit/replay increments generation, so old settlement is discarded. Optional AbortController reduces work but is not the correctness boundary. Host does not await Promise or understand loading/ready/failure; load failure remains local and emits no LearningEvent.

## 15. View boundary

All seven Views use `root/update/stopInput/dispose` and optional `canvas`. They render snapshot and Companion presentation data and send commands. Scoring, authoritative selection/order/time/readiness, event emission, persistence, and continuous scheduling remain outside View.

Source/DOM tests cover keyboard routes, 44px rules, focus-visible, non-color state, orientation rules, overflow intent, reduced motion, and cleanup. They do not certify computed browser behavior.

## 16. Companion / Collection

`companionAdapter.js` and `collectionAdapter.js` retain no game-ID branch. Companion consumes coarse LearningEvent types, is optional/display-only, and cannot gate correctness. Collection only exposes confirmed read-only ownership IDs. Partial score, timeout, load state, and results remain unknown to both adapters.

The current selected Companion policy remains PROVISIONAL. MiniGames do not unlock or persist Collection state.

## 17. Storage boundary

All seven games have direct Storage/save writes 0 and save-schema changes 0. Session results are not persisted. Common progress, SRS, XP, rank, curriculum, best-score, and selected-companion persistence remain DEFERRED. A one-game save key is not permitted as an authoring shortcut.

## 18. Result boundary

Each game has an immutable local result suited to its mechanic. Host does not parse fields; it only permits Replay when a result exists. No common persistence or analytics consumer requires a wrapper, so `MiniGameResult` remains **NOT NEEDED**.

## 19. Scheduler boundary

Current v1 architecture owns progression through the main RAF and generic Host `update(dtMs)`. Games 01〜07 own no continuous RAF, interval, worker timer, or clock service. This rule supports current platform lifecycle; it is not a claim that all future realtime mechanics are forbidden. A mechanic demonstrably impossible under Host/main scheduling is a v2 trigger.

## 20. Browser certification status

The in-app browser runtime was checked at consolidation start. Default selection returned `No browser is available`; the available browser list was empty. Product source was not modified to work around this.

Automated DOM/lifecycle tests are not Browser Certification. MINIGAME-01〜07 remain:

**BROWSER CERTIFICATION STILL PENDING**

The Authoring Guide includes a real-browser checklist for layout, computed touch/overflow, keyboard/focus, visibility pause, Companion failure, reduced motion, runtime/unhandled errors, network, scheduler ownership, and repeated lifecycle.

## 21. Bundle audit

Full serialized regression results from the current repository are:

| Suite | Pass | Fail | Cancelled | Skipped | Todo |
| --- | ---: | ---: | ---: | ---: | ---: |
| minigame-01 | 34 | 0 | 0 | 0 | 0 |
| minigame-02 | 26 | 0 | 0 | 0 | 0 |
| minigame-03 | 21 | 0 | 0 | 0 | 0 |
| minigame-04 | 27 | 0 | 0 | 0 | 0 |
| minigame-05 | 36 | 0 | 0 | 0 | 0 |
| minigame-06 | 33 | 0 | 0 | 0 | 0 |
| minigame-07 | 39 | 0 | 0 | 0 | 0 |
| minigame-contract-v1 | 16 | 0 | 0 | 0 | 0 |
| minigame-platform-v1 | 12 | 0 | 0 | 0 | 0 |
| motion-01 | 39 | 0 | 0 | 0 | 0 |
| motion-02 | 32 | 0 | 0 | 0 | 0 |
| no-go | 143 | 0 | 0 | 0 | 0 |
| phase-a | 86 | 0 | 0 | 0 | 0 |
| phase-b | 22 | 0 | 0 | 0 | 0 |
| phase-c | 17 | 0 | 0 | 0 | 0 |
| **Total** | **583** | **0** | **0** | **0** | **0** |

Files were run one at a time to avoid conflating the known Windows Node-runner IPC/concurrency issue with assertion results. New consolidation coverage is 12/12. No test was deleted, skipped, marked todo, or weakened.

Verification:

| Gate | Result |
| --- | --- |
| stage ID integrity | PASS (`oldIdHits: 0`, referenced IDs subset of stages) |
| `git diff --check` | PASS |
| production build | PASS, Vite 5.4.19, 122 modules |
| package / lock delta | 0 |
| Host / registry / title / adapters / main product delta | 0 |
| new runtime dependency | 0 |

Current bundle after a fresh production build:

| Artifact | Current | MINIGAME-07 checkpoint | Consolidation delta |
| --- | ---: | ---: | ---: |
| main JS | 660,878 B | 660,878 B | 0 B |
| main JS gzip | 187,555 B | 187,555 B | 0 B |
| all JS | 672,295 B | 672,295 B | 0 B |
| all JS gzip | 191,972 B | 191,972 B | 0 B |
| CSS | 48,657 B | 48,657 B | 0 B |

Documentation and test-only changes are not imported into production; measured bundle delta is 0.

Historical checkpoints show main JS growth from 591,392 B at the Contract-v1 baseline before MINIGAME-03/04 to 660,878 B after MINIGAME-07: +69,486 B raw. Gzip grew from 169,560 B to 187,555 B: +17,995 B. CSS remained 48,657 B. No Contract bundle budget is defined, and no measured runtime performance failure exists.

This growth supports reviewing probe visibility/content before production release, but does not justify code splitting or a refactor in this consolidation task.

## 22. Probe retention recommendation

Current action is **Option A: retain all seven entries unchanged** so the checkpoint preserves tested behavior and exact registry/title integration.

For production release, recommend a product/content review leading toward **Option C for low-value probe content**: remove non-production probes from the public title/registry while retaining their source/tests as architecture fixtures, or replace their fixtures with reviewed production content. Do not implement this until a visibility policy and test migration are explicitly approved; no existing dev-only catalog mechanism should be invented solely for hiding probes.

## 23. Contract v2 triggers

Start v2 evaluation only with concrete cross-game evidence:

1. Host game-specific knowledge is unavoidable.
2. Multiple games require Host-awaited async readiness or shared cancellation/resource lifecycle.
3. At least two games require a common result consumer unsupported by current events/local snapshots.
4. Fixed LearningEvent semantics cannot drive a required common consumer safely.
5. The View shape is insufficient in multiple games.
6. Host/main scheduling cannot express a required mechanic.
7. Multiple games require a common persistence connection.

Not triggers: prettier APIs, uniform types, future speculation, one game's callback/field preference, or visually aligned result objects. No trigger is present in MINIGAME-01〜07.

## 24. Known limitations

- Real-browser/device certification has not run.
- Probe fixture/UX quality has not passed production curriculum/editorial review.
- Bundle budget and public probe-retention policy are not defined.
- No persistent result/progress, streaming/auth loader, shared cancellation, or external-content lifecycle has been proven.
- The four-type LearningEvent model is sufficient only for the current consumer and probe range; future common partial-credit semantics may add pressure.
- The static registry and single-active-game Host are the validated topology; plugin discovery and concurrent games are outside v1.

## 25. Final decision

| Question | Decision | Evidence |
| --- | --- | --- |
| A. MINIGAME-01〜07は同一Contract v1で成立しているか | **YES** | seven exact Definitions/Instances and full regression |
| B. Stable surfaceを追加せずGuide化できたか | **YES** | documentation/test-only consolidation |
| C. game-localとStableの境界は明確か | **YES** | classifications, Guide, and checklist |
| D. LearningEvent 4-type modelは現在probe範囲で十分か | **YES** | timeout, partial, async all add 0 types |
| E. time-dependent patternはgame-localで書けるか | **YES** | MINIGAME-05 |
| F. partial-credit patternはgame-localで書けるか | **YES** | MINIGAME-06 |
| G. async/cancellation patternはgame-localで書けるか | **YES** | MINIGAME-07 |
| H. Hostはgame-agnosticを維持しているか | **YES** | Host product bytes unchanged; no command/game branches |
| I. MiniGameResult wrapperは依然不要か | **YES** | no shared result consumer |
| J. shared command vocabularyは依然不要か | **YES** | opaque routing handles all command sets |
| K. Contract v2開始根拠はあるか | **NO** | no trigger observed |
| L. 新game量産へ移行可能か | **YES** | Guide/checklist and regression gate ready |
| M. 実ブラウザーcertificationは完了したか | **NO / NOT CERTIFIED** | available browser bindings 0 |

**MINIGAME PLATFORM V1 CONSOLIDATION PASS**

**AUTHORING GUIDE V1 READY**

**TECHNICAL PROBE PHASE COMPLETE**

**CONTRACT V2 NOT REQUIRED**

**BROWSER CERTIFICATION STILL PENDING**

With Stable Contract coverage, authoring documentation, regression, integrity, and build gates satisfied and no v2 trigger, further architecture-only probes now have lower information value than production content/game authoring. Recommended next phase: (1) Browser Certification, (2) production game selection, (3) curriculum/content design, (4) checklist-driven authoring workflow, (5) template reuse without new framework, and (6) release QA.
