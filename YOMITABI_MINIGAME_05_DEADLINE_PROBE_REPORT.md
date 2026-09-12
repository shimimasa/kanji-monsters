# YOMITABI MINIGAME-05 Deadline / Timeout Technical Probe Report

- Date: 2026-09-12 (Asia/Tokyo)
- Probe: MINIGAME-05 `timedChoice`
- Display name: `タイムことば`
- Dimension: TIME-DEPENDENT COMPLETION
- Base commit: `401cb57b5eeb9233d8320bc2c9e46de95e950fe9`
- Base tag: `yomitabi-minigame-contract-v1-final-audit-2026-09`
- Branch: `experiment/minigame-deadline-probe`
- Worktree: `artifacts/minigame-03/worktree`

## 1. Executive Summary

MiniGame Platform Contract v1を変更せず、Host `update(dtMs)`によるdeadline completionとuser `dispatch(answer)`が同じattemptを競合して完了させるTechnical Probeを実装した。5秒deadlineの漢字語彙4択を10問行い、answerまたはtimeoutの先着処理だけがCoreのattemptをconsumeする。

answerの直後にdeadlineを越えるupdateを行った場合はanswerだけが成立し、deadline updateの直後にlate answerを送った場合はtimeoutだけが成立する。境界時刻の優先順位は壁時計の公平性ではなく、JavaScriptで先に同期処理された`dispatch()`または`update()`を採用する。巨大deltaでも一問のcompletionは1回だけである。

timeoutは既存`incorrect`の「正解を得られず問題を完了した」意味に含め、game-local payloadの`reason: 'timeout'`で区別した。LearningEvent type/envelope、Host、Contract文書、Companion、Collection、main RAF、package/lockの変更は0である。全499 tests、integrity、diff check、production buildはPASSした。利用可能browser bindingは0件のためBrowser CertificationはNOT RUNである。

## 2. Git / checkpoint

- 開始時worktreeはclean、staged/untrackedは0、HEADはfinal-audit checkpoint `401cb57`だった。
- checkpoint保全のため、同HEADから専用branch `experiment/minigame-deadline-probe`を作成した。
- top-level `main`および他worktreeの変更には触れていない。
- `reset`、`clean`、rebase、merge、force操作は行っていない。
- 完了条件を満たしたため、関連差分だけをlocal commit/tag `yomitabi-minigame-05-checkpoint-2026-09`として固定する。
- 対象branchにupstreamはなく、remote destinationの明示もないためpushは行わない。

## 3. Files changed

Product additions:

- `src/minigames/timedChoice/timedChoiceQuestions.js`
- `src/minigames/timedChoice/timedChoiceGame.js`
- `src/minigames/timedChoice/timedChoiceView.js`

Product integration:

- `src/minigames/registry.js`
- `src/screens/titleScreen.js`

New tests/report:

- `tests/minigame-05/core.test.mjs`
- `tests/minigame-05/lifecycle.test.mjs`
- `tests/minigame-05/scope.test.mjs`
- `tests/minigame-05/scope-contract.mjs`
- `YOMITABI_MINIGAME_05_DEADLINE_PROBE_REPORT.md`

Existing test maintenance is limited to exact five-entry registry assertions, reviewed title/registry hashes, cumulative scope allowlists, and five-game Contract assertions. Existing product game implementations and assertions were not removed, skipped, or weakened.

## 4. Contract v1 compliance

Definition is exactly `id/title/create/createView`. Instance is `enter/update/setPaused/snapshot/dispatch/exit`. View returns `root/update/stopInput/dispose` and optional `canvas`; this View supplies `canvas` for the existing Companion presenter. Host receives no new context and has no timeout knowledge.

Stable Contract files and semantics are unchanged. `src/minigames/README.md`, `miniGameHost.js`, `companionAdapter.js`, and `collectionAdapter.js` are byte-identical to base `401cb57`.

## 5. Deadline Core

Core owns the authoritative state: current problem, attempt identity, `phase`, `problemElapsedMs`, `remainingMs`, `deadlineMs`, counters, last answer, and result. DOM/CSS are never sources of truth.

Each question begins with one non-null `attemptId`. Both answer and timeout call the same private consume boundary. The boundary first verifies active/paused/notifying/phase/attempt state, then sets `attemptId = null` before counters, result, or observer notification. No second completion can pass after that commit.

## 6. Question model

The self-authored Technical Probe fixture contains 20 unique common kanji vocabulary entries. A seeded Fisher-Yates selection creates 10 questions with four identity-based reading choices:

```js
{
  fixtureId,
  problemId,
  prompt,
  choices: [{ choiceId, text }],
  correctChoiceId,
  skillId
}
```

Display text and IDs are separate. The fixture is deterministic under injected `random` and is not a canonical curriculum or SRS dataset.

## 7. Time model

- Default game-local deadline: 5000 ms.
- Tests may inject a positive finite `deadlineMs` directly into Core creation.
- `Date.now()` and `performance.now()` are absent.
- `problemElapsedMs` and derived `remainingMs` are game-local snapshot fields.
- LearningEvent `activeElapsedMs` remains the existing session-wide active elapsed field.
- The deadline and event envelope are not conflated or promoted to a Stable schema.

## 8. Update semantics

`update(dtMs)` ignores inactive, paused, ready, completed, and non-finite input. Negative finite values are clamped to zero, matching existing games. While active and not paused, session `activeElapsedMs` advances during answering and feedback. Only answering advances `problemElapsedMs`.

On reaching `problemElapsedMs >= deadlineMs`, Core synchronously consumes the attempt as timeout. A 100000 ms delta clamps problem time to the deadline and creates one completion, not a replay burst. Feedback preserves the problem deadline state; completed sessions ignore later time.

The per-frame path is constant work. No fixture-wide scan is performed during update.

## 9. Answer / Timeout race

| Processing order | Winner | Rejected operation | Result |
| --- | --- | --- | --- |
| valid answer, then deadline update | answer | timeout path sees feedback/null attempt | one answer event |
| deadline update, then late answer | timeout | answer identity/phase gate fails | one incorrect timeout event |
| answer at 4999 ms, then update 1 ms | answer | timeout | answer wins |
| update from 4999 ms by 1 ms, then answer | timeout | late answer | timeout wins |

This is deterministic processing-order precedence. The probe does not invent a wall-clock arbitration or fairness layer.

## 10. Dispatch

Game-local commands are only `answer` and `next`. Timeout is not a command; it arises inside `update()`. Host still forwards an opaque command object and synchronously redraws after accepted dispatch without reading its type.

Command names, payloads, identity fields, and deadline fields remain GAME-LOCAL / PROVISIONAL.

## 11. LearningEvent

Only the existing types are used:

- `problemPresented`
- `correct`
- `incorrect`
- `sessionComplete`

A normal wrong choice and timeout both mean the problem completed without a correct outcome, so both safely use `incorrect`. The payload distinguishes `reason: 'answer'` from `reason: 'timeout'`; timeout has `choiceId: null`. No consumer requires a fifth event type.

The existing envelope remains exactly `version/gameId/sessionId/seq/type/problemId/activeElapsedMs/payload`. Each problem emits one `problemPresented` and exactly one `correct` or `incorrect`; the tenth completion is followed by one `sessionComplete`. State and attempt consumption occur before observer notification.

Observer throw, rejected Promise, arbitrary return, snapshot read, and reentrant dispatch cannot restore or duplicate an attempt.

## 12. Pause

Host continues to combine manual and visibility pause reasons with OR semantics and passes one boolean to Core. While paused:

- answer/next are rejected;
- `activeElapsedMs` is frozen;
- `problemElapsedMs` and `remainingMs` are frozen;
- no timeout occurs.

A problem paused with 2000 ms remaining still has 2000 ms remaining after an arbitrary paused update; it times out only after 2000 ms of resumed Host delta.

## 13. Companion

`companionAdapter.js` is byte-identical to the final-audit checkpoint. Timeout arrives as existing `incorrect`, so existing idle mapping applies. No timeout animation or game-specific branch was added. Owned/unowned, pending image, failed image, and reduced-motion paths do not gate deadline, scoring, result, or replay.

## 14. Collection

`collectionAdapter.js` is byte-identical. Timed Choice receives neither Collection nor Storage objects. No save key, best time, ranking, progress, SRS, XP, schema, or selected-companion persistence was added. Storage isolation tests observe zero writes/deletes during the session lifecycle.

## 15. View

The View displays prompt, four choices, remaining seconds, a progress bar, progress, feedback, Next, result, Companion, Back, and Replay. It uses the existing return shape only.

Remaining time is rendered from Core snapshot state during Host updates. CSS width and ARIA values are presentation only; no CSS transition, animation-end callback, RAF, or DOM time is used for correctness. Buttons have at least 44 px targets, focus-visible styling, and portrait/landscape source rules. Number keys 1-4 use the same Core gate as pointer input.

## 16. Result

The immutable game-local result is:

```js
{ answered, correct, incorrect, accuracy, timedOut }
```

Host does not inspect it beyond the existing truthy replay gate, and the View renders it locally. No common MiniGameResult wrapper or persistence was introduced.

## 17. Lifecycle

Existing Host ownership and exit order are reused unchanged: stop input, invalidate Host session, Core exit, Companion dispose, Host listener cleanup, View dispose/DOM removal. Repeated enter/exit leaves no input listener, DOM, Companion, interval, or RAF accumulation. Old buttons and callbacks cannot affect an exited or replaced session. Replay creates a new session/attempt identity and resets event sequence and deadline.

## 18. Core isolation

Timed Choice Core imports only its local question generator. It has no DOM, window, wall clock, Storage, save, gameState, battle, Motion, Companion, Collection, or scheduler dependency. View also has no Storage or scheduler access. Package/runtime dependencies are unchanged.

## 19. Tests

`tests/minigame-05/` has 36 PASS:

| File | PASS | Coverage |
| --- | ---: | --- |
| `core.test.mjs` | 22 | fixture/determinism/deadline/delta/pause/answer/timeout/races/identity/huge delta/events/observer/result/exit |
| `lifecycle.test.mjs` | 8 | registry/title/Host/timer/UI/race/keyboard/pause/Companion/replay/cleanup/Storage |
| `scope.test.mjs` | 6 | allowlist/Stable bytes/Host isolation/scheduler and Storage absence/event semantic/protected paths |
| **Total** | **36** | fail/cancelled/skipped/todo 0 |

The race tests use manual delta only; no real-time sleep or flaky clock assertion exists.

## 20. Existing regression

All suites were enumerated from the current repo and run separately:

| Suite | PASS |
| --- | ---: |
| phase-a | 86 |
| phase-b | 22 |
| phase-c | 17 |
| no-go | 143 |
| motion-01 | 39 |
| motion-02 | 32 |
| minigame-01 | 34 |
| minigame-02 | 26 |
| minigame-contract-v1 | 16 |
| minigame-03 | 21 |
| minigame-04 | 27 |
| minigame-05 | 36 |
| **Total** | **499** |

`fail 0 / cancelled 0 / skipped 0 / todo 0`。Final Auditの463は固定値として流用せず、現在値をrunnerから再取得した。test削除、skip/todo、assertion weakeningはない。

## 21. Browser QA

Browser runtime discoveryとdefault selectionを再確認したが、利用可能binding一覧は空で`No browser is available`だった。このため実ブラウザーのcountdown、race、visibility、390x844/844x390、computed overflow/touch target、runtime exception/external request、RAF/interval、Host timingのcertificationは0 checksである。

Core/DOM/lifecycle automated testsはPASSしているが、Browser PASSとは表現しない。製品sourceを変更して環境制約を回避していない。

**Browser Certification: NOT RUN**

## 22. Integrity / Build / Bundle

- stage ID integrity: PASS (`oldIdHits: 0`, referenced subset OK)
- `git diff --check`: PASS（内容error 0、checkoutのLF/CRLF warningのみ）
- production build: PASS (Vite 5.4.19, 116 modules)
- package/lock delta: 0
- runtime dependency delta: 0
- protected Host/Contract/adapter/core/main RAF paths: delta 0

Existing Vite CJS/static-dynamic import and >500 kB chunk warnings remain non-fatal.

| Artifact | Final Audit base | MINIGAME-05 | Delta |
| --- | ---: | ---: | ---: |
| main JS | 616,764 B | 629,110 B | +12,346 B |
| main JS gzip | 176,337 B | 179,099 B | +2,762 B |
| all JS | 628,181 B | 640,527 B | +12,346 B |
| all JS gzip | 180,752 B | 183,515 B | +2,763 B |
| CSS | 48,657 B | 48,657 B | 0 B |

## 23. Stable Contract evaluation

No Stable surface changed. This probe adds evidence to existing `update(dtMs)`, opaque dispatch, pause, single-consume, LearningEvent, View, and lifecycle semantics. It does not add a scheduler API, timeout event, deadline field, command vocabulary, result wrapper, or Host capability.

The new evidence supports: a completion may originate from either Host update or user dispatch while the Core remains the sole owner of one-time attempt consumption.

## 24. Provisional findings

The following remain game-local or provisional:

- 5000 ms default deadline and direct Core injection location
- `problemElapsedMs`, `remainingMs`, `deadlineMs`, `timedOut`
- `answer`/`next` command names and payload identities
- `reason: 'answer' | 'timeout'` payload convention
- exact boundary policy as this game's processing-order rule
- countdown/progress-bar rendering and number-key bindings
- result shape and timeout wording

One successful probe is not grounds to make a universal deadline or timeout abstraction Stable.

## 25. Time-dependent evaluation

Hypotheses A-F are all supported:

- Existing `update(delta)` handles deadline completion.
- game-owned scheduler count is zero.
- answer and timeout share a single Core consume gate.
- existing pause semantics freeze deadline and input.
- timeout fits existing `incorrect` plus game-local payload.
- Host remains byte-identical and timeout-agnostic.

TIME-DEPENDENT COMPLETION is therefore proven for this Technical Probe without a Contract v2 trigger.

## 26. Known limitations

- Browser/visual/timing certification is not run.
- The 20-item fixture is Technical Probe material, not a curriculum approval.
- Only one fixed-deadline choice mechanic is tested; adaptive deadlines are unproven.
- Background throttling and real-device frame cadence are represented by deterministic manual deltas, not certified on devices.
- Audio cues, partial credit, asynchronous content, persistent best times, and ranking are out of scope.
- The exact timeout payload/result fields are not Stable Contract.
- The checkpoint is local and not pushed or merged to main.

## 27. Decision

| Question | Decision | Evidence |
| --- | --- | --- |
| A. Stable Contract変更0で成立したか | **YES** | Contract/Host/adapters byte-identical |
| B. Host変更0か | **YES** | base blobと一致 |
| C. Hostはtimeoutを理解していないか | **YES** | timeout literal/branch/import 0 |
| D. game-owned scheduler 0か | **YES** | RAF/interval/timeout/worker/global clock 0 |
| E. `update(delta)`だけでdeadlineを扱えたか | **YES** | manual delta/huge delta tests |
| F. pause中deadline停止が成立したか | **YES** | Core/Host OR-pause tests |
| G. answer後timeoutを拒否できたか | **YES** | answer-first race test |
| H. timeout後late answerを拒否できたか | **YES** | update-first race test |
| I. 1 problemにつきcompletion eventは1つか | **YES** | 10 problems/10 completion events |
| J. timeoutを既存LearningEvent semanticで表現できたか | **YES** | `incorrect` + game-local reason |
| K. LearningEvent type追加0か | **YES** | existing four types only |
| L. View contract変更0か | **YES** | existing return shape |
| M. Companion / Collection変更0か | **YES** | adapter blobs identical |
| N. Contract v2が必要になったか | **NO** | current Stable surfaceで成立 |

**MINIGAME-05 TECHNICAL PROBE PASS**

**TIME-DEPENDENT COMPLETION CONTRACT PROVEN**

**ANSWER / TIMEOUT RACE SAFELY RESOLVED**

**CONTRACT V2 NOT REQUIRED**

**BROWSER CERTIFICATION NOT RUN**
