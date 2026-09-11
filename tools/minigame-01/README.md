# MINIGAME-01 QA

Worktree root: `node --experimental-default-type=module --test tests/minigame-01/*.test.mjs`.
Existing 339 tests/integrity/build: `node tools/motion-02/verify.mjs ../verification-NEW`.

Browser skill discovery was empty. Functional fallback uses isolated headless Chrome,
fresh disposable profile, Vite `127.0.0.1:49751`, CDP `127.0.0.1:49752`.
Never point the driver at a real user's profile. All external page requests are blocked.

`node tools/minigame-01/functional-qa.mjs <artificial-e0-fixture.json> ../browser-NEW`

Driver requires E0 `e0-cert-01 / Fresh MemoryStorage` provenance and changes only
the artificial fixture's ownership. Product code never creates ownership or save keys.
IME composition and visibility events are synthetic; touch/keyboard use CDP input.
390x420 is a keyboard-height simulation, not certification on a physical phone/OS IME.
Screenshots and JSON remain outside the worktree. Preserve failed runs separately.
No benchmark claim; record only this slice's observed stalls and resource checks.
