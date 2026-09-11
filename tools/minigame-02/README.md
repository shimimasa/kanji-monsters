# MINIGAME-02 QA

Unit/lifecycle/scope tests:

`node --experimental-default-type=module --test tests/minigame-02/*.test.mjs`

Functional QA uses an isolated headless Chrome profile, Vite on `127.0.0.1:49761`,
CDP on `127.0.0.1:49762`, and only the certified artificial E0 fixture.
Never point the driver at a real user profile or save. All external requests are blocked.

`node tools/minigame-02/functional-qa.mjs <e0-cert-01/fixture.json> <new-output-directory>`

The driver covers the title route, spawn/select/switch, correct/incorrect/retry,
clear/game over, owned/unowned companion, pending/failure, reduced motion,
visibility/manual/answer pause, portrait/landscape touch, keyboard/IME/repeat,
double submission, Core/Storage isolation, and ten enter/exit cycles.

Synthetic composition and visibility events are not physical OS/IME certification.
Screenshots, profiles, logs, and result JSON stay outside the worktree. Preserve failed
runs separately. Performance collection is a small probe and not a benchmark claim.
