# MiniGame Platform Contract v1

Contract version: **1**. This is an in-app contract for the static registry and
one active FSM mini-game. It is not a plugin protocol or persistence schema.

## Definition

Every registry entry has `id`, `title`, `create(context)`, and
`createView(context)`. Do not add per-game contract versions, runtime discovery,
dependency resolution, or capability negotiation.

## Game instance

Every game instance provides:

- `enter()`
- `update(dtMs)` using milliseconds from the existing main RAF
- `setPaused(boolean)` for Host-owned external pause
- `snapshot()` without commits, events, or DOM side effects
- synchronous `dispatch({ type, payload })`, returning only `true` when accepted
- idempotent `exit()`

Unknown commands return `false`. The Host forwards commands without inspecting
`type` and refreshes with `update(0)` only after an accepted command. A game may
keep private or compatibility methods such as Sprint `next()` and Invader
`select()`; they are not contract methods.

Only the existence and side-effect semantics of the lifecycle methods, plus the
boolean acceptance result of `dispatch`, are shared. Snapshot fields and the
return values of the other lifecycle methods are game-specific.

## View

`createView` returns `root`, `update(snapshot, companionSnapshot)`,
`stopInput()`, and `dispose()`. `canvas` is optional. Registry-side adapters may
translate the existing named View callbacks to `dispatch`; the Host must not
gain game-specific command branches. Views display snapshots and own their DOM,
input bindings, and listeners. They do not commit learning outcomes or emit
LearningEvents.

## Host context

`create` receives `sessionId`, injected `random`, and `onEvent`. `onEvent` is a
sink for already committed events. The long-term location of `random` remains
provisional. Games do not receive Storage, save APIs, global game state, SRS,
player HP/EXP, Collection, or Companion objects.

## LearningEvent v1

The required envelope is `version`, `gameId`, `sessionId`, `seq`, `type`,
`problemId`, `activeElapsedMs`, and game-specific `payload`. Version is `1`.
The fixed event types are `problemPresented`, `correct`, `incorrect`, and
`sessionComplete`.

Core state is committed before notification. Observers cannot change scoring or
progress through a return value, Promise, exception, animation, or render pass.
`sessionId + seq` identifies an observed event. Each game owns command validity,
stale-input rejection, and one-time consumption; its concrete command identity
fields and token structure are game-specific and provisional.

## Pause and lifecycle

The Host keeps visibility and manual pause reasons separate and passes their OR
to `setPaused`. Game-internal simulation pauses remain game state. Resuming one
reason cannot release another or replay accumulated frame time.

The Host owns at most one game, View, and Companion. Exit order is: stop input,
invalidate the session, exit the game, dispose the Companion, remove Host
listeners, then dispose the View/DOM. Old sessions and late callbacks must be
rejected. Exit is idempotent.

## Collection and Companion

Collection access is read-only through `ownedMonsterIds` derived from the
confirmed active save. Games do not read or write Storage directly. Companion is
optional and display-only. The default mapping is `correct` to attack and
`problemPresented`, `incorrect`, and `sessionComplete` to idle. Image or motion
completion never gates input, scoring, results, or session completion.

## Non-negotiables

- Under the current v1 lifecycle, advance through Host `update`; do not own a
  separate `requestAnimationFrame` or continuous interval.
- Reject stale, invalid, replayed, and already-consumed commands in game Core;
  exact identity fields remain game-specific.
- Commit Core state before LearningEvent, then start visual reactions.
- Emit `sessionComplete` once; aborted sessions do not emit it.
- Clean up input, listeners, DOM, Companion, and game-specific entities on exit.
- Do not add game-ID branches to Host, Companion, or Collection.
- Do not connect mini-games directly to save, SRS, HP, EXP, or battle Core.

## Game-specific responsibilities

Problem generation, difficulty, answer semantics, normalization, score, retry,
life, enemies, spawn, stages, rounds, result details, input widgets, and visual
mechanics stay in the game. The shared contract does not define a persistent
result wrapper or selected-companion persistence.

The exact command names and payloads, registry-to-View callback argument names,
snapshot fields, and result schemas remain provisional or game-local. Games may
add commands without expanding the Host contract.

## Breaking changes

Use Contract v2 for removal, renaming, or semantic changes to required fields or
methods; the millisecond clock or scheduler owner; LearningEvent identity; the
LearningEvent envelope or fixed event meanings; commit-before-event;
display-only Companion; or exit/cleanup ownership. Additive game commands,
payload fields, result details, and registry entries remain v1.
