# YOMITABI 漢字防衛隊 Manual Input Certification

Certification date: `2026-09-12`
Tester: `Project owner / manual QA`
Evidence basis: project owner completion attestation supplied to Release QA
Build / commit: `cd1056b3f2fe9540ee65a0869ba504e61ad36e38`

## 1. Evidence boundary

This record formalizes the project owner's statement that every required item in the Actual Windows Japanese IME and Real Mobile Soft Keyboard final checklists passed. Device-specific values not supplied by the tester are recorded as `NOT RECORDED`; they are not inferred. This is manual evidence, not a replay of QA and not a claim that screenshots/device logs were supplied.

## 2. Actual Windows Japanese IME environment

```text
Date: 2026-09-12
Tester: Project owner / manual QA
PC: NOT RECORDED
Windows version: NOT RECORDED
Browser: NOT RECORDED
Browser version: NOT RECORDED
IME: Windows Japanese IME; specific version NOT RECORDED
Build / commit: cd1056b3f2fe9540ee65a0869ba504e61ad36e38
URL: NOT RECORDED
```

## 3. Actual Windows Japanese IME result

| Required case | Result |
| --- | --- |
| Japanese IME normal input | PASS |
| Layout remains usable while composing | PASS |
| Composition Enter does not submit | PASS |
| Finalized text remains in input | PASS |
| Enter after composition submits once | PASS |
| Repeated Enter causes no duplicate submit | PASS |
| Target switch sends nothing to old target | PASS |
| Focus loss causes no unexpected submit | PASS |
| Pause accepts no gameplay command | PASS |
| Resume preserves and continues input | PASS |
| Back prevents stale input reaching old session | PASS |
| Retry input works normally | PASS |

Blockers: none reported.
Minor issues: none reported.
Notes: device/version metadata was not supplied.

`ACTUAL WINDOWS IME PASS`

## 4. Real Mobile Soft Keyboard environment

```text
Date: 2026-09-12
Tester: Project owner / manual QA
Device: NOT RECORDED
OS: NOT RECORDED
Browser: NOT RECORDED
Browser version: NOT RECORDED
Screen size: NOT RECORDED
Keyboard: real mobile soft keyboard; product/version NOT RECORDED
Build / commit: cd1056b3f2fe9540ee65a0869ba504e61ad36e38
URL: NOT RECORDED
```

## 5. Real Mobile Soft Keyboard result

| Required case | Result |
| --- | --- |
| Portrait lanes/prompt/input/Submit/Back usable | PASS |
| Input remains usable with keyboard open | PASS |
| Selected Monster and threat remain visible | PASS |
| Target switch works with keyboard open | PASS |
| Two/three-Monster gameplay remains usable | PASS |
| Correct submit works | PASS |
| Wrong → retry works | PASS |
| Layout restores after keyboard closes | PASS |
| Orientation change preserves gameplay | PASS |
| No destructive horizontal scroll | PASS |
| Background return causes no mass escape or duplicate spawn | PASS |

Blockers: none reported.
Minor issues: none reported.
Notes: device/version metadata was not supplied.

`REAL MOBILE SOFT KEYBOARD PASS`

## 6. Browser / Input Gate

| Component | Result |
| --- | --- |
| Playwright automated real-browser | PASS — 47/47 |
| Actual Windows Japanese IME | PASS |
| Real Mobile Soft Keyboard | PASS |

`BROWSER / INPUT GATE COMPLETE`

## 7. Adult Internal QA coverage

The attestation covers game launch、actual IME、mobile keyboard、correct、wrong/retry、pause/background、target selection and gameplay continuation. Back/stale-input behavior was checked in the IME scenario.

It does not explicitly state that one continuous adult session reached result and then completed Replay and Back. Therefore:

`PARTIAL MANUAL QA COMPLETE`

Remaining adult QA evidence: one dated full-session record through result → Replay → Back against the authorized build.

## 8. Certification decision

The Browser/Input gate is closed. This record does not certify Human Content Review or authorize child playtest by itself.

`ACTUAL WINDOWS IME PASS`

`REAL MOBILE SOFT KEYBOARD PASS`

`BROWSER / INPUT GATE COMPLETE`
