# YOMITABI MiniGame Authoring Guide v1

Status: **Platform v1 implementation manual**

Normative contract reference: [`src/minigames/README.md`](src/minigames/README.md)

Per-game gate: [`YOMITABI_MINIGAME_AUTHORING_CHECKLIST_V1.md`](YOMITABI_MINIGAME_AUTHORING_CHECKLIST_V1.md)

## 1. Purpose

This guide turns the boundaries proven by MINIGAME-01 through MINIGAME-07 into an authoring workflow. It explains how to add a game without teaching the Host that game's mechanics or enlarging Contract v1.

Every rule is labelled by intent:

- **STABLE CONTRACT**: a game author may depend on this public boundary.
- **PLATFORM INVARIANT**: a constraint required by the current v1 architecture.
- **GAME-LOCAL**: the game owns the design and may choose a different representation.
- **PROVISIONAL**: present in one or more implementations, but not safe to treat as shared API.
- **DEFERRED**: deliberately not designed in v1.

The probe fixtures and UX demonstrate architecture. They are not, by themselves, curriculum, pedagogy, localization, or production-content standards.

## 2. 5-minute Quick Start

1. Create `src/minigames/<gameId>/` with Core, View, and fixture modules.
2. Export a Definition with exactly `id`, `title`, `create`, and `createView`.
3. Return all six Instance methods: `enter`, `update`, `setPaused`, `snapshot`, `dispatch`, and `exit`.
4. Keep commands, payloads, snapshot fields, scoring, phases, and results game-local.
5. Add one static registry entry and one title entry. Do not change Host behavior.
6. Emit only `problemPresented`, `correct`, `incorrect`, and `sessionComplete` using the v1 envelope.
7. Add Core, lifecycle, and scope tests. Start from the checklist, not by copying a whole probe.
8. Run the full regression, stage-ID integrity, `git diff --check`, and production build.
9. Perform real browser certification separately; DOM tests are not browser certification.

If the game appears to require a Host branch, a new common event, or a Stable method, stop and evaluate a Contract limitation before implementing it.

## 3. Stable Contract

The complete Stable surface proven across seven games is intentionally small:

```js
// Definition
{ id, title, create, createView }

// Instance returned by create(...)
{ enter, update, setPaused, snapshot, dispatch, exit }

// View returned by createView(...)
{ root, update, stopInput, dispose, canvas? }
```

The current Host supplies `sessionId`, `random`, and `onEvent` to `create`. The long-term location of random injection remains **PROVISIONAL**. It supplies View context such as `document`, snapshot access, generic `dispatch`, Back, and Replay through the existing registry/Host integration; named callback adapters remain game-local.

Stable does **not** include command names, payload schemas, snapshot schemas, View callback names, state-field names, result schemas, fixture formats, keyboard bindings, score models, loader APIs, deadline fields, or cancellation tokens.

## 4. Definition

**STABLE CONTRACT**

| Field | Responsibility |
| --- | --- |
| `id` | Stable registry key and LearningEvent `gameId` value for this game. |
| `title` | User-facing registry title. |
| `create(context)` | Constructs one isolated game instance. |
| `createView(context)` | Constructs the View object owned by the Host. |

Definitions are static registry entries. Do not add per-game protocol versions, runtime discovery, capability negotiation, or dependency resolution.

The Definition must have the exact four fields. A test-only direct Core construction may accept extra game-local injected dependencies, such as a loader, but the Host must not learn those dependencies.

## 5. Instance

### `enter()`

**STABLE CONTRACT**: start one session after the Host has created Core, Companion, and View and applied external pause.

Use `enter()` to commit initial session state, present the first problem, or begin game-owned resource acquisition. It is called synchronously by the Host. MINIGAME-07 proves that it may start a Promise internally without making `enter()` an async Contract or requiring the Host to await it.

Do not depend on its return value. Do not emit a learning outcome before the corresponding Core state exists.

### `update(dtMs)`

**STABLE CONTRACT**: accept milliseconds from the existing main RAF through the Host. The Host also calls `update(0)` after an accepted command so the current snapshot is rendered immediately.

Use it for realtime simulation, deadlines, and frame-driven progression. Validate the delta, treat negative movement as zero, and make large deltas safe. A large frame must not duplicate a timeout or completion. Per-frame work should be bounded; avoid scanning an entire fixture when only current entities matter.

Do not use `Date.now()` or `performance.now()` as Core truth for gameplay arbitration. Do not start a second continuous RAF or interval.

### `setPaused(paused)`

**STABLE CONTRACT**: receive the Host-computed OR of manual and visibility pause reasons.

Store the boolean needed by Core validation. Do not reconstruct visibility/manual reasons in the game. External pause blocks gameplay input and active progression. A game-local simulation pause may exist, but it is not a replacement for this method and is not a shared pause type.

### `snapshot()`

**STABLE CONTRACT**: return the current presentation state without committing, emitting, loading, scheduling, or touching DOM.

Snapshots must not expose mutable references to authoritative Core collections. Freeze or copy nested objects/arrays where mutation could leak back into Core. All field names and nesting remain **GAME-LOCAL**.

### `dispatch(command)`

**STABLE CONTRACT**: synchronously accept an opaque command object from Host/View and return exactly `true` only when the command was accepted. Return `false` for unknown, malformed, paused, stale, invalid-phase, replayed, or already-consumed commands.

The Host does not inspect `command.type` or payload. See sections 7 and 8.

### `exit()`

**STABLE CONTRACT**: synchronously invalidate the session and release game-owned resources. It must be idempotent.

After exit, update, commands, callbacks, Promise settlements, and observers from the old session must not change current gameplay or emit outcomes. Do not emit `sessionComplete` for an aborted session.

Only the boolean acceptance result of `dispatch` is a Stable return semantic. Return values of the other five methods are **PROVISIONAL / GAME-LOCAL**, and the Host must not rely on them.

## 6. View

**STABLE CONTRACT**

```js
{
  root,                         // Host-mounted DOM root
  update(snapshot, companion), // render current state
  stopInput(),                  // synchronously block input
  dispose(),                    // remove listeners and owned DOM/resources
  canvas                        // optional Companion presentation surface
}
```

The View owns rendering, DOM/canvas nodes, accessible labels/states, and input listeners. It translates pointer/keyboard intent into game-local commands.

The View must not own scoring, authoritative selection, problem completion, LearningEvent emission, Storage writes, a continuous scheduler, or async correctness state. CSS transitions and animation events may decorate the UI but cannot decide gameplay.

Named callbacks such as `onAnswer` or `onSubmit`, DOM structure, CSS classes, and whether a registry adapter is used are **PROVISIONAL / GAME-LOCAL**.

## 7. dispatch

Opaque routing is the shared mechanism; vocabulary is not.

Examples currently used include `submit`, `next`, `answer`, `select`, `reorder`, and `toggle`. These are examples, not reserved or required names. A new operation normally becomes another game-local command handled inside its Core.

```js
dispatch(command) {
  if (!command || typeof command !== 'object') return false;
  if (command.type === 'gameLocalAction') return applyAction(command.payload);
  return false;
}
```

When `dispatch` returns `true`, the Host synchronously calls `update(0)` and redraws. Therefore return `true` only after the accepted state change is committed. Do not return a Promise and do not use an observer result as acceptance.

## 8. snapshot

The snapshot is a read model, not a universal state schema. Include only what this View needs, for example a local `phase`, current problem, selected IDs, remaining time, feedback, or result.

Rules:

- Reading it is side-effect free.
- View mutation cannot mutate Core.
- DOM state is derived from it, never the reverse.
- Failure/loading state may be represented locally.
- Result fields remain local even when several games happen to use similar counters.

Do not add a field to every game merely to make snapshots look uniform.

## 9. identity

**PLATFORM INVARIANT**: an old callback, command, entity action, or async result must not change the current session.

Choose identities that fit the mechanic:

- session identity separates enter/replay lifetimes;
- problem or entity identity separates visible targets;
- attempt/action identity enforces one-time completion;
- generation identity separates async loads or retries.

The names `sessionId`, `problemId`, `attemptId`, `token`, and `generation` are proven patterns, not a mandatory payload schema. Validate identity in Core even when the View disables a button.

For an action that completes an attempt, use this order:

1. Validate active/paused/phase/identity.
2. Consume or invalidate the attempt.
3. Commit score, counters, result, and phase.
4. Notify observers.

This single-consume pattern resolves double clicks, stale callbacks, deadline races, and reentrant observer calls.

## 10. LearningEvent

**STABLE CONTRACT**: every event uses version 1 and the envelope:

```js
{
  version,
  gameId,
  sessionId,
  seq,
  type,
  problemId,
  activeElapsedMs,
  payload
}
```

The fixed types are:

- `problemPresented`: a problem is actually active and answerable/presented.
- `correct`: the game-defined successful completion of that problem.
- `incorrect`: a completed attempt that did not meet the game-defined success condition.
- `sessionComplete`: the complete session result has already been committed.

`seq` increases monotonically within the session, and `sessionId + seq` identifies an observed event. `activeElapsedMs` is session-wide active elapsed time supplied through Host updates; it is not a problem deadline and stops during external pause.

Event types are coarse; payloads hold game-local detail. MINIGAME-05 represents timeout as `incorrect` plus a local reason. MINIGAME-06 represents full success as `correct` and partial/zero completion as `incorrect`, preserving score/classification in payload/result. This is the proven range, not a universal grading ontology.

Loading, load success, load failure, cancellation, animation completion, and UI clicks are infrastructure/presentation facts, not LearningEvents. A load failure before a problem is presented is not `incorrect`.

Commit before calling `onEvent`. Catch synchronous observer exceptions and rejection from thenables/Promises. Ignore observer return values. Reentrant dispatch must see the already-consumed state and fail safely.

Payload field names and schemas are **GAME-LOCAL**. Do not promote `score`, `reason`, `choiceId`, or any other detail to Stable merely because one probe uses it.

## 11. pause

The Host keeps manual and visibility reasons separately and passes only their OR to `setPaused`.

Core and View provide two layers:

```text
View: disable/suppress user interaction while paused
Core: reject gameplay commands while paused
```

During pause, active simulation and deadlines stop, and `activeElapsedMs` does not advance. Resume preserves valid game-local selection and remaining deadline. Resuming one Host reason cannot release another.

Feedback waits and mechanic-specific simulation holds are game-local phases, not extra external pause reasons.

## 12. lifecycle

The Host owns at most one Core, View, and Companion. Its established exit order is:

1. `view.stopInput()`
2. invalidate Host session acceptance
3. `game.exit()`
4. Companion dispose
5. Host listener cleanup
6. `view.dispose()` and DOM cleanup

Game authors must make that order sufficient: `exit()` invalidates Core identities and resource callbacks; `stopInput()` prevents new View input; `dispose()` removes all View listeners/nodes. Repeated exit is harmless. Replay creates a new session; it must never revive an old attempt or Promise settlement.

## 13. Companion

Companion is an optional display-only LearningEvent consumer. The current adapter maps `correct` to attack and other fixed types to idle. It does not read game payloads or score.

Game progress, input, scoring, results, and completion must work when the companion is unowned, its image is pending or fails, or reduced motion is enabled. Do not add a game-ID branch or a game-specific Companion protocol.

The current selected/default companion policy is **PROVISIONAL**, not a game authoring dependency.

## 14. Collection

The Collection adapter provides read-only owned IDs from the confirmed active save. A mini-game may be presented with ownership information through the platform, but it must not unlock, mutate, or persist ownership.

Collection schema paths and selected-companion persistence are outside Contract v1.

## 15. Storage

**PLATFORM INVARIANT**: MiniGame Core and View do not directly access Storage, save APIs, global `gameState`, SRS, XP, rank, battle state, or curriculum persistence.

The probes are session-local. A future common persistence connection requires an explicit platform decision; do not invent a save key in one game.

## 16. result

Results are immutable **GAME-LOCAL** snapshot data rendered by that game's View. The Host only checks whether a result exists for Replay; it does not interpret result fields.

Do not create a common `MiniGameResult` wrapper just to align names. A common result integration becomes justified only when at least two games have a real shared consumer that cannot operate through existing events or local snapshots.

Failure/loading/cancellation state is not automatically a completed learning result.

## 17. realtime/deadline

Use Host `update(dtMs)` and Core-local elapsed state:

```text
update(delta):
  if inactive, paused, or not in an advancing phase: return
  dt = finite non-negative delta
  activeElapsed += dt
  mechanicElapsed += dt
  if mechanicElapsed >= deadline:
    consumeAttemptAsTimeoutOnce()
```

For answer/deadline races, processing order wins: if dispatch consumes first, the later update does nothing; if update consumes first, the late answer fails. Do not attempt wall-clock simultaneity arbitration.

Keep deadline, remaining-time, and timeout payload/result fields local. A CSS animation end is never the completion trigger. Current v1 games use the main RAF/Host update and own no continuous RAF or interval.

## 18. partial credit

Keep selection, scoring formula, thresholds, classification, points, and result local. Score inside Core, not View.

The proven pattern is:

```text
score = gameLocalScoring(authoritativeSelection)
consume attempt
commit score/result/phase
if game-defined full success:
  emit correct
else:
  emit incorrect with game-local score/classification payload
```

Do not assume every game must use 0..1, points, or `fullCorrect`. If a future shared consumer must distinguish partial credit from zero and cannot safely use a game-local payload, evaluate a Contract v2 trigger rather than silently changing event meaning.

## 19. async/cancellation

Keep loaders and readiness inside the game instance. `enter()` starts work and returns synchronously; Host does not await it or understand loading/ready/failure.

**Async Safety Pattern**

```text
generation += 1
myGeneration = generation
active = true
commit loading state

startPromise()
attach resolve and reject handlers immediately

on resolve/reject:
  if not active: discard
  if myGeneration != generation: discard
  if phase is no longer loading: discard
  otherwise commit ready or failure state

exit:
  active = false
  generation += 1
  invalidate attempt
  optionally abort owned work
```

Resolve during pause may commit data while the paused flag remains set; input waits for resume. Reject during pause may commit a local failure state. Loading/ready/failure phases and these policies remain game-local.

Attach rejection handling at start so a late reject cannot become unhandled. Do not start loads from View or expose raw mutable results.

`AbortController` may reduce bandwidth or work and belongs to game-local resource cleanup. It is not the correctness boundary: a loader may ignore abort or deliver a late callback, so generation/session validation remains mandatory. Do not add shared AbortSignal, async enter/exit, `onReady`, or a global async manager without a proven multi-game need.

## 20. accessibility

The source/DOM baseline used by the probes is:

- interactive targets at least 44 CSS px;
- a complete keyboard path;
- visible `:focus-visible` treatment;
- selected/correct/error state conveyed by text, symbol, border, or ARIA as well as color;
- appropriate `aria-pressed`, `aria-checked`, labels, or live feedback;
- no unintended horizontal overflow;
- explicit portrait and landscape behavior;
- reduced motion does not remove functionality.

These are authoring requirements, but source assertions alone are not visual certification. Validate computed dimensions, focus, overflow, and interaction in a real browser/device before production release.

## 21. tests

Use the established structure:

```text
tests/minigame-XX/
  core.test.mjs
  lifecycle.test.mjs
  scope.test.mjs
  scope-contract.mjs
  <small test utility when needed>
```

Core checklist:

- deterministic creation and fixture integrity;
- valid input and malformed/unknown rejection;
- stale session/problem/attempt/entity/generation rejection;
- pause and resume state preservation;
- single completion and double-submit rejection;
- commit-before-event and event order/identity;
- observer throw, rejected Promise, arbitrary return, reentrant dispatch, snapshot read;
- immutable snapshot/result data;
- exit, replay, and late callback rejection;
- mechanic-specific races using manual delta/deferred Promises, never real sleeps.

Lifecycle checklist:

- registry and title entry;
- actual Host integration and View rendering;
- pointer and keyboard routes;
- visibility/manual pause OR semantics;
- Companion owned/unowned, pending/failure, reduced motion;
- Back, Replay, repeated enter/exit;
- listener and DOM cleanup;
- Storage isolation.

Scope checklist:

- changed-file allowlist;
- Host and Contract protection;
- LearningEvent type/envelope protection;
- Companion/Collection protection;
- package/lock and save schema protection;
- no direct Storage access;
- no game-owned continuous scheduler;
- no unapproved runtime dependency.

Run the entire repository suite, not only the new directory. Never delete, skip, mark todo, or weaken an assertion to make a probe pass.

## 22. Browser QA

Automated DOM tests are **not** Browser Certification. A production candidate needs a separately recorded real-browser pass covering at least:

- portrait and landscape layouts;
- computed horizontal overflow;
- computed touch targets;
- keyboard, focus, and IME/repeat/modifier handling;
- visibility and manual pause interaction;
- Companion owned/unowned and image failure;
- reduced motion;
- runtime exceptions and unhandled rejections;
- unexpected external requests;
- unexpected RAF/interval ownership;
- repeated enter/exit and Replay.

MINIGAME-01 through MINIGAME-07 have automated coverage but no completed browser certification at this checkpoint because no browser binding was available.

## 23. anti-patterns

1. Add `if (gameId === ...)` or a game import to Host.
2. Switch on `command.type` in Host.
3. Use DOM classes, checkbox state, or canvas pixels as scoring truth.
4. Emit LearningEvents from View.
5. Write Storage/save/Collection from Core or View.
6. Rely only on disabled UI to prevent double completion.
7. Rely only on AbortController for async correctness.
8. Complete a deadline from CSS `animationend` or a View timer.
9. Add a LearningEvent type for each game mechanic, timeout, score, or load state.
10. Add a universal command/result/score abstraction because it might be useful later.
11. Return a Promise from `dispatch` or require Host to await `enter()`.
12. Treat a Technical Probe fixture as production curriculum without content review.

## 24. decision tree

```text
New operation?
  -> Add a game-local dispatch command.

Intermediate state?
  -> Keep authoritative state in Core and expose a read-only snapshot.

Time-dependent?
  -> Advance Core-local time through update(delta) and single-consume completion.

Partial credit?
  -> Keep score/result/classification local; use coarse event + detailed payload.

Async work?
  -> Use a session/generation gate; Abort is optional cleanup only.

Need persistence or a shared result consumer?
  -> Stop and gather cross-game requirements; do not write Storage locally.

Need Host, View shape, fixed event meaning, or scheduler ownership changed?
  -> Stop. Evaluate a Contract v2 trigger before implementation.
```

## 25. production readiness

### Architecture

- [ ] Exact Definition and Instance shapes are preserved.
- [ ] Host/adapters/Stable contract semantics are unchanged.
- [ ] Commands, state, identities, score, async, and result stay game-local.
- [ ] Full regression, integrity, diff check, and build pass.

### Gameplay

- [ ] Every completion path is unique and Core-gated.
- [ ] Pause, Back, Replay, failure, and repeated lifecycle are safe.
- [ ] Large delta, stale input, and late callbacks cannot duplicate completion.

### Learning

- [ ] `skillId` and fixture identities are deliberate.
- [ ] `correct`/`incorrect` classification matches the game's success semantic.
- [ ] Feedback exposes needed detail without changing the common event model.
- [ ] Content has pedagogy, curriculum, license, language, and editorial review.

### Accessibility and QA

- [ ] Keyboard, focus, touch, non-color state, and reduced motion are covered.
- [ ] Automated suites pass with zero fail/cancel/skip/todo.
- [ ] Real-browser and target-device certification is recorded separately.

## 26. Contract v2 triggers

Consider v2 only when evidence shows one of these cannot be handled safely in v1:

- Host game-specific knowledge is unavoidable.
- Multiple games require Host-awaited async readiness or shared cancellation/resource lifecycle.
- At least two games require a common result consumer that local results/events cannot support.
- Fixed LearningEvent types cannot express a required common-consumer reaction without semantic ambiguity.
- The View return shape is insufficient in multiple games.
- A mechanic cannot be represented by the Host/main scheduler.
- Multiple games require a common persistence connection.

These are not triggers: making APIs prettier, aligning types, anticipating future use, one game's preference, unifying callback names, or making result objects look alike.

## 27. templates

### Core template

```js
export function createExampleGame({ sessionId, random = Math.random, onEvent = () => {} }) {
  let active = true;
  let paused = false;
  let state = createInitialState({ sessionId, random });

  return {
    enter() {
      // Commit initial active/problem/loading state; keep the call synchronous.
    },
    update(dtMs) {
      // Advance only valid, active, unpaused game-local state.
    },
    setPaused(value) {
      if (active) paused = !!value;
    },
    snapshot() {
      // Return immutable/copy-isolated presentation data only.
      return Object.freeze({ ...state, paused, active });
    },
    dispatch(command) {
      // Validate Core state and identity; true only after accepted commit.
      return false;
    },
    exit() {
      // Idempotently invalidate identities, callbacks, and owned resources.
      if (!active) return;
      active = false;
    },
  };
}
```

### View template

```js
export function createExampleView({ document, getSnapshot, dispatch, onBack, onReplay }) {
  const root = document.createElement('section');
  let inputActive = true;
  const removeListeners = [];

  return {
    root,
    update(snapshot, companionSnapshot) {
      // Render snapshots; never score or emit LearningEvents here.
    },
    stopInput() {
      inputActive = false;
    },
    dispose() {
      inputActive = false;
      removeListeners.splice(0).forEach(remove => remove());
      root.remove();
    },
    // canvas: optional
  };
}
```

### LearningEvent flow

```text
commit problem
emit problemPresented

validate completion
consume attempt
commit score/counters/result/phase
emit correct OR incorrect

commit completed result
emit sessionComplete once
```

Use the async pattern in section 19, deadline pattern in section 17, and partial-credit pattern in section 18 as proven patterns—not mandatory shared abstractions.

## 28. checklist

Before review, copy [`YOMITABI_MINIGAME_AUTHORING_CHECKLIST_V1.md`](YOMITABI_MINIGAME_AUTHORING_CHECKLIST_V1.md) into the work item and attach evidence for every applicable box. Any proposed Stable, Host, event, adapter, persistence, scheduler, package, or lock change must be treated as a stop-and-review item, not routine game authoring.
