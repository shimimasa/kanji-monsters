# YOMITABI MiniGame Authoring Checklist v1

Copy this checklist into each new MiniGame work item. Mark non-applicable mechanic sections `N/A` with a reason; do not silently omit them. Contract reference: [`src/minigames/README.md`](src/minigames/README.md). Implementation guidance: [`YOMITABI_MINIGAME_AUTHORING_GUIDE_V1.md`](YOMITABI_MINIGAME_AUTHORING_GUIDE_V1.md).

## Scope and Git safety

- [ ] Work starts from the intended checkpoint/branch and the initial HEAD/tag/worktree state is recorded.
- [ ] Staged, unstaged, untracked, other-worktree, artifact, cache, package, and lock changes are classified.
- [ ] Changed-file allowlist includes only this game, its integration, tests, and report/docs.
- [ ] Unrelated or pre-existing changes are not staged, reverted, or deleted.
- [ ] No reset, clean, force push, unrelated merge, or unapproved dependency operation was used.

## Stable Definition and Instance

- [ ] Definition has exactly `id`, `title`, `create`, and `createView`.
- [ ] Registry entry is static and title entry routes by `gameId` without Host changes.
- [ ] Instance provides `enter`, `update`, `setPaused`, `snapshot`, `dispatch`, and `exit`.
- [ ] `enter()` remains a synchronous Host contract, including when it starts async work.
- [ ] `update(dtMs)` uses Host delta and safely handles non-finite, negative, zero, and large values.
- [ ] `setPaused(boolean)` consumes Host external pause state without reimplementing pause reasons.
- [ ] `snapshot()` is side-effect free and does not leak mutable Core references.
- [ ] `dispatch(command)` is synchronous and returns `true` only for an accepted, committed action.
- [ ] Unknown/malformed/invalid commands return `false`.
- [ ] `exit()` is idempotent and invalidates the session before late work can commit.
- [ ] Return values other than dispatch acceptance are not used as common Contract semantics.

## Game-local boundaries

- [ ] Command names and payloads remain game-local.
- [ ] Snapshot fields, phases, state names, and identity token names remain game-local.
- [ ] Fixture format, generator, normalization, scoring, feedback, and keyboard mapping remain game-local.
- [ ] Result shape is immutable and game-local; no `MiniGameResult` wrapper was added.
- [ ] No universal command, score, assessment, state, loader, timer, or result framework was added.

## Core validation and identity

- [ ] Core validates active state, external pause, phase, command shape, and relevant identity.
- [ ] Stale session, problem/entity, attempt/action, and generation identities are rejected where applicable.
- [ ] UI disabled state is not the only duplicate/stale defense.
- [ ] Completion follows validate → consume/invalidate → commit → notify.
- [ ] Double click/submit, replayed action, stale callback, and reentrant dispatch cannot complete twice.
- [ ] One problem/attempt emits at most one completion event.
- [ ] Replay creates a new identity boundary and old callbacks cannot alter it.

## LearningEvent v1

- [ ] Envelope remains exactly `version/gameId/sessionId/seq/type/problemId/activeElapsedMs/payload`.
- [ ] Version remains `1`.
- [ ] Only `problemPresented`, `correct`, `incorrect`, and `sessionComplete` are emitted.
- [ ] `problemPresented` occurs only after the problem is active/presented.
- [ ] `correct` matches the game's defined successful completion.
- [ ] `incorrect` represents a completed attempt that did not meet that success condition.
- [ ] Timeout/partial/choice/classification detail stays in game-local payload when semantically valid.
- [ ] Loading, load success/failure, cancellation, clicks, and animations are not LearningEvents.
- [ ] `seq` is monotonic and session-scoped; `sessionId + seq` identifies the event.
- [ ] `activeElapsedMs` remains session-wide active elapsed, not mechanic-local time.
- [ ] State, consumed identity, counters, result, and phase are committed before observer notification.
- [ ] Observer throw, rejected Promise, arbitrary return, snapshot read, and reentrant dispatch are isolated.
- [ ] `sessionComplete` is emitted once only after completed result commit; abort/failure does not emit it.

## View and accessibility

- [ ] View returns `root`, `update`, `stopInput`, `dispose`, and only optional `canvas`.
- [ ] View renders snapshots and dispatches intent; it does not score, persist, emit events, or own truth.
- [ ] `stopInput()` blocks new input before Host invalidates/exits Core.
- [ ] `dispose()` removes all View listeners and owned DOM/resources.
- [ ] Pointer and complete keyboard paths use the same Core command gate.
- [ ] Interactive targets are at least 44 CSS px.
- [ ] `:focus-visible` is visible.
- [ ] Selected/correct/error state is not communicated by color alone and has suitable ARIA/text.
- [ ] Portrait, landscape, reduced-motion, and horizontal-overflow source rules exist.
- [ ] CSS animation/transition completion is never gameplay truth.

## Pause and lifecycle

- [ ] Visibility and manual pause compose by Host OR semantics.
- [ ] Core rejects gameplay commands while externally paused.
- [ ] View suppresses/disabled input while paused as a second defense.
- [ ] Active elapsed, deadline, and simulation progression freeze while paused where applicable.
- [ ] Resume preserves legitimate game-local state and does not replay wall time.
- [ ] Back, Replay, repeated enter/exit, and exit during every phase are safe.
- [ ] Exit-after-exit is harmless.
- [ ] Listener count and DOM return to baseline after disposal.

## Companion, Collection, Storage, and platform isolation

- [ ] Host remains byte/semantically game-agnostic: no game ID, command, score, timeout, or async branch.
- [ ] LearningEvent source/envelope/fixed types remain protected.
- [ ] Companion adapter has no game/payload branch and remains display-only.
- [ ] Game works with Companion owned, unowned, image pending/failure, and reduced motion.
- [ ] Collection adapter remains read-only and has no game branch.
- [ ] Core/View contain no direct Storage, save, `gameState`, SRS, XP, rank, curriculum, or battle access.
- [ ] No save key/schema, selected-companion persistence, score persistence, or progress write was added.
- [ ] Package and lock files have no delta; no runtime dependency was added.

## Realtime/deadline (when applicable)

- [ ] Core time advances only from `update(dtMs)`, not wall clock, CSS, or DOM.
- [ ] Game owns no continuous RAF, interval, worker timer, or global clock service.
- [ ] Only the advancing phase changes mechanic-local elapsed.
- [ ] Large delta consumes a deadline at most once.
- [ ] Dispatch-first means answer wins; update-first means timeout wins.
- [ ] Answer-after-timeout and timeout-after-answer are rejected by the same Core consume gate.

## Partial credit (when applicable)

- [ ] Authoritative selection and scoring live in Core.
- [ ] Formula is deterministic, bounded, and resists trivial all-choice full credit.
- [ ] Score, points, thresholds, classification, and result remain game-local.
- [ ] Full success/other completion mapping to `correct`/`incorrect` is semantically documented.
- [ ] Detailed score/classification remains payload/result data, not a new common event or Host concern.
- [ ] A common consumer does not require a distinction lost by the coarse event mapping.

## Async/cancellation (when applicable)

- [ ] Loader/resource dependency is game-local and not an external network requirement unless separately approved.
- [ ] A session/generation token is captured before starting async work.
- [ ] Resolve and reject handlers are attached immediately.
- [ ] Settlement checks active session, generation, and expected phase before commit.
- [ ] Exit/replay invalidates generation before old completion can commit.
- [ ] Late resolve and late reject are both discarded without events/state changes.
- [ ] Promise rejection is handled; unhandled rejection is zero.
- [ ] Pause-time settlement preserves external pause and input rejection.
- [ ] AbortController, when used, is cleanup only; identity/generation remains the correctness gate.
- [ ] Host does not await `enter`, receive AbortSignal, or understand loading/ready/failure.

## Automated tests

- [ ] Core tests cover deterministic fixture, normal paths, invalid/stale inputs, pause, uniqueness, observer isolation, immutable result, exit, and replay.
- [ ] Mechanic races use manual delta or deferred Promise controls; no real sleep/flaky timing.
- [ ] Lifecycle tests cover Registry, title, Host, View, input, pause OR, Companion, cleanup, and Storage isolation.
- [ ] Scope tests protect Host, Contract, LearningEvent, adapters, package/lock, scheduler, and changed-file boundaries.
- [ ] Existing assertions were not deleted, skipped, marked todo, or weakened.
- [ ] New suite passes independently.
- [ ] Every existing repository suite passes.
- [ ] Final totals record pass, fail, cancelled, skipped, and todo from current output.

## Integrity, build, and release QA

- [ ] Stage ID integrity passes.
- [ ] `git diff --check` passes.
- [ ] Production build passes.
- [ ] Current main/all JS gzip and CSS sizes are recorded and compared with the chosen checkpoint.
- [ ] Final diff is classified as Product / Tests / Docs / Reports / Tooling / Unrelated.
- [ ] Real Browser Certification status is reported separately from automated DOM tests.
- [ ] Browser QA covers portrait, landscape, computed overflow/touch targets, keyboard/focus, visibility pause, Companion failure, reduced motion, runtime errors, network, RAF/interval, and repeated lifecycle.
- [ ] Curriculum, pedagogy, license/provenance, localization, and editorial review are complete before production content release.

## Stop and Contract v2 review

- [ ] No Stable method/field/semantic change is required.
- [ ] No Host game-specific knowledge is required.
- [ ] No fixed LearningEvent meaning/envelope/type change is required.
- [ ] No shared result consumer, persistence connection, scheduler, cancellation manager, or View extension is unavoidable across multiple games.
- [ ] If any box above fails, implementation stopped and evidence was recorded instead of expanding v1 opportunistically.

## Sign-off

- Game ID / title:
- Author / reviewer:
- Base branch / HEAD / tag:
- Test command and totals:
- Build artifact sizes:
- Browser certification: PASS / NOT RUN / FAILED
- Contract v2 trigger: NO / YES (link evidence)
- Release decision: READY / NOT READY
