# MINIGAME-03 QA

Unit, lifecycle, and scope tests:

`node --experimental-default-type=module --test tests/minigame-03/*.test.mjs`

Functional QA uses an isolated headless Chrome profile, Vite on `127.0.0.1:49771`,
CDP on `127.0.0.1:49772`, and only the certified artificial E0 fixture. Never use
a real user profile or save. The driver blocks all external requests.

`node tools/minigame-03/functional-qa.mjs <e0-cert-01/fixture.json> <new-output-directory>`

The driver covers the title route, button and keyboard choices, correct/incorrect,
ten-question result, replay, owned/unowned Companion, pending/failure, reduced
motion, visibility/manual pause, portrait/landscape touch, duplicate submission,
Core/Storage isolation, and ten enter/exit cycles.

Synthetic visibility and CDP touch/keyboard checks are not physical device
certification. Screenshots, profiles, logs, and JSON stay outside the worktree.
Performance collection is a small stall/resource probe, not a benchmark.
