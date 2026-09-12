# YOMITABI 漢字防衛隊 Browser Certification

Date: 2026-09-12

Current combined status (supersedes the earlier environment-blocked result below): **BROWSER / INPUT GATE COMPLETE**

Automated Playwright real-browser certification, Actual Windows Japanese IME manual QA, and real mobile soft-keyboard manual QA are all PASS. Manual evidence was supplied by `Project owner / manual QA` on 2026-09-12; unspecified device/version metadata remains `NOT RECORDED`. Human Content Review remains a separate pending gate. The original in-app Browser preflight failure is retained below as execution history, not as the current result.

Historical status for the earlier in-app Browser attempt: **NOT RUN — REAL BROWSER UNAVAILABLE**

## Independent capability preflight repeat — 2026-09-12

This preflight was executed for the current Browser/CDP certification request and did not reuse the earlier `No browser is available` observation as its result.

```text
Branch: product/kanji-defense
HEAD: cd1056b3f2fe9540ee65a0869ba504e61ad36e38
Checkpoint tag: yomitabi-kanji-defense-mvp-2026-09
Required certification documents: present
Protected product delta from checkpoint: none
Browser control runtime initialization: available / succeeded
Default browser selection: failed — No browser is available
Supported browser inventory after required troubleshooting: []
Dedicated Chrome control skill/surface exposed in this session: no
Selectable rendered tab/CDP target: no
```

| Requested capability | Preflight result | Blocking reason |
| --- | --- | --- |
| Built-in browser / Chrome Browser use | UNAVAILABLE | supported inventory is empty |
| CDP access | UNAVAILABLE | no browser/tab target exists |
| Console capture | UNAVAILABLE | requires a rendered browser target |
| Network capture/interception | UNAVAILABLE | requires a rendered browser target |
| DOM/computed style | UNAVAILABLE | no page can be opened |
| Viewport emulation/change | UNAVAILABLE | no page/tab binding |
| Screenshot | UNAVAILABLE | no rendered surface |
| Performance information/trace | UNAVAILABLE | no CDP/browser target |
| Actual Japanese IME | UNAVAILABLE | no browser input surface |
| Emulated/real soft keyboard | UNAVAILABLE | no browser/device surface |

Concrete missing dependency: at least one supported Browser binding—an in-app browser or supported Chrome/extension binding—must be exposed by the Codex environment so that a tab and its CDP-backed inspection surface can be created.

Per the mandatory preflight STOP rule, the local Vite server was not started after capability failure. Therefore there is no server process to clean up, no evidence directory containing rendered evidence, and no new screenshot/log/measurement. Starting a server without a selectable browser would not change the certification result.

Current preflight decision: **STOP — REAL RENDERED BROWSER EVIDENCE CANNOT BE ACQUIRED IN THIS ENVIRONMENT**

`BROWSER CERTIFICATION FAIL`

`RELEASE CERTIFICATION BLOCKED: REAL BROWSER/CDP SURFACE UNAVAILABLE`

## Real Browser QA attempt — 2026-09-12

```text
QA date: 2026-09-12
Tester: Codex / YOMITABI Real Browser QA
Commit / build: product/kanji-defense @ cd1056b3f2fe9540ee65a0869ba504e61ad36e38
Build result: PASS — Vite 5.4.19, 125 modules, main JS 649.70 kB / gzip 196.44 kB
OS: Microsoft Windows NT 10.0.26200.0
Device: browser automation host; no selectable browser/device binding
Browser: unavailable
Browser version: N/A
Input method: NOT RUN
Japanese IME: NOT RUN
Viewport: NOT RUN
Server URL: NOT STARTED — no browser target was available
```

Supported browser runtime was initialized for this QA attempt. Default selection returned exactly `No browser is available`. Required discovery troubleshooting was applied, after which the supported browser inventory returned exactly `[]`. No browser tab could be created, so no page navigation, interaction, computed layout, screenshot, console capture, network capture, performance trace, IME event, or soft-keyboard observation occurred.

The worktree contains certification/handoff documentation and scope-allowlist changes, but the product/protected sources are unchanged from the named checkpoint. A successful production build does not certify browser behavior.

### Required scenario result

| Scenario | Result | Evidence |
| --- | --- | --- |
| Desktop smoke flow | NOT RUN | no browser binding |
| 390 × 844 portrait | NOT RUN | no browser binding |
| 844 × 390 landscape | NOT RUN | no browser binding |
| Actual Japanese IME, all 10 cases | NOT RUN | no browser/IME binding |
| Mobile soft keyboard | NOT RUN | no device/browser binding |
| Computed touch targets | NOT RUN | no rendered page |
| Computed horizontal overflow | NOT RUN | no rendered page |
| Three-Monster visual readability | NOT RUN | no rendered page or screenshot |
| Keyboard-only / focus-visible | NOT RUN | no rendered page |
| Manual pause / visibility return | NOT RUN | no browser lifecycle |
| Reduced motion | NOT RUN | no media emulation |
| Image failure | NOT RUN | no browser request interception |
| Runtime / console / network | NOT RUN | no browser log |
| Scheduler runtime observation | NOT RUN | no browser runtime |
| Performance trace | NOT RUN | no browser runtime |
| Ten-cycle lifecycle | NOT RUN | no browser runtime |

### IME case result

| Case | Result |
| --- | --- |
| composition start | NOT RUN |
| Enter during composition | NOT RUN |
| compositionupdate | NOT RUN |
| compositionend | NOT RUN |
| Enter after composition | NOT RUN |
| repeated Enter | NOT RUN |
| target switch during composition | NOT RUN |
| focus loss during composition | NOT RUN |
| pause during composition | NOT RUN |
| Back during composition | NOT RUN |

### Required screenshots and logs

No screenshots, console logs, network export, scheduler observation, or performance trace were produced because no rendered browser session existed. Missing files are evidence of a blocked execution, not a passing result.

### Final questions A–M

- A Desktop smoke flow: **NOT RUN**
- B 390 × 844: **NOT RUN**
- C 844 × 390: **NOT RUN**
- D Actual Japanese IME: **NOT RUN**
- E Soft keyboard gameplay: **NOT RUN**
- F Computed touch targets: **NOT RUN**
- G Horizontal overflow: **NOT RUN**
- H Three-Monster readability: **NOT RUN**
- I Keyboard / focus: **NOT RUN**
- J Pause / visibility: **NOT RUN**
- K Runtime blockers 0: **NOT CERTIFIED**
- L Performance blockers 0: **NOT CERTIFIED**
- M Ten-cycle lifecycle: **NOT RUN**

Browser Certification Decision: **FAIL — ENVIRONMENT BLOCKED; PRODUCT BROWSER QUALITY UNKNOWN**

`BROWSER CERTIFICATION FAIL`

`RELEASE CERTIFICATION BLOCKED: REAL BROWSER UNAVAILABLE`

## Playwright real-browser rerun — 2026-09-12

The previous result above remains as the record of an environment without an in-app Browser binding. A later repo-local Playwright run successfully launched the installed system Chrome and produced real rendered evidence.

### Environment

```text
Branch: product/kanji-defense
HEAD: cd1056b3f2fe9540ee65a0869ba504e61ad36e38
Checkpoint tag: yomitabi-kanji-defense-mvp-2026-09
Browser: system Chrome channel 152.0.7977.83
Renderer mode: headless Chromium, real page/layout/network/CDP
Target: fresh production build + Vite preview
Evidence: artifacts/kanji-defense/browser-certification/run-20260912T110959Z/
Checks: 47 PASS / 0 FAIL / 0 NOT_RUN
```

### Certification levels

| Surface | Status | Evidence |
| --- | --- | --- |
| DESKTOP BROWSER | PASS | 1280×720 full smoke flow |
| PORTRAIT BROWSER | PASS | 390×844 computed layout + screenshot |
| LANDSCAPE BROWSER | PASS | 844×390 computed layout + screenshot after blocker fix |
| PLAYWRIGHT COMPOSITION EVENT | PASS | 12 composition/Enter/stale cases |
| ACTUAL OS IME | PASS | post-run project owner manual QA, 2026-09-12; device metadata not recorded |
| EMULATED SOFT KEYBOARD | PASS | focused 390×500 viewport proxy |
| REAL SOFT KEYBOARD | PASS | post-run project owner manual QA, 2026-09-12; device metadata not recorded |
| RUNTIME | PASS | pageerror 0、unhandled rejection 0、runtime blocker 0 |
| PERFORMANCE | PASS | max observed long task 147ms、action feedback 35–44ms |
| LIFECYCLE | PASS | 5 Back + 5 Replay cycles、final root/listeners 0 |

### Viewports and computed layout

| Viewport | Horizontal metrics | Main target sizes | Result |
| --- | --- | --- | --- |
| 1280×720 | document/body/root 1280/1280、board 756/756 | Monster 225×113.34、Submit 96.06×48、Back 60.03×44 | PASS |
| 390×844 | document/body/root 390/390、board 368/368 | Monster 108.58×100、Submit 96.06×48、Back 60.03×44 | PASS |
| 390×500 proxy | document/body/root 390/390、board 368/368 | input bottom 429、selected bottom 172.66 | PASS |
| 844×390 | document/body/root 844/844、board 724/724 | Monster 215.39×61.89、input / Submit bottom 384、Back 55.53×44 | PASS |
| 844×390 result | document/body/root 844/844 | Replay 97.34×44、Back 55.53×44 | PASS |

All measured main controls were at least 44 CSS px in both axes. All required document/body/root/board horizontal scroll widths were no greater than client widths.

### Smoke Flow

Title → start → first Monster → keyboard lane selection → correct → first wrong/retry → retry correct → second wrong terminal → escape/life decrement → two targets → three targets → result → Replay → Back passed. Retry preserved Monster/life and displayed a hint; second wrong completed once; escape decremented life once.

### Three-Monster and visual evidence

Three unique lanes/prompts were rendered. Each target had an accessible label and threat text. Selection used both `aria-pressed="true"` and the visible text marker `選択中`, not color alone. Required screenshots were visually reviewed, including desktop, portrait, landscape, retry, result and image fallback.

### IME

Synthetic but realistic browser composition events passed compositionstart、compositionupdate、compositionend、Enter during composition、Enter after composition、repeat / double Enter、target switch、blur、pause and Back stale callback checks. This result is explicitly `PLAYWRIGHT COMPOSITION EVENT CERTIFIED`, not actual Windows IME certification.

### Soft Keyboard

390×844 focused input and a 390×500 visual-viewport proxy kept the selected Monster and input visible with no horizontal overflow. A real mobile keyboard was not opened; that gate remains manual.

### Pause / Visibility

Manual pause preserved enemy progress and typed text during a 350ms observation. CDP `Page.setWebLifecycleState` frozen → active produced no catch-up escape, life loss or duplicate spawn.

### Reduced Motion / Image Failure

Reduced-motion media emulation disabled Monster transition while selection and answer completion remained usable. Intercepted Monster image failure exposed the text fallback, retained layout/accessible label, and allowed selection and answer completion.

### Console / Network

Uncaught exception 0、unhandled rejection / pageerror 0、runtime blocker 0。Raw console diagnostics from intentional image aborts and the intentionally blocked existing Firebase SDK bootstrap were retained separately. The existing platform requested `www.gstatic.com` once per isolated context; these known requests were blocked to avoid cloud side effects. Unexpected external request 0; Kanji Defense added no external content request.

### Scheduler / Performance

Game-owned RAF 0、game-owned interval 0。The maximum game-visible long task measured 147ms, below the 200ms blocker threshold. Representative answer feedback latencies were 43ms、35ms、44ms. No child-playtest-blocking lag was observed.

### Ten-cycle

Back cycles 1–5 ended with game root 0 and Host listeners 0. Replay cycles 6–10 retained exactly one game root and one Companion. Final Back ended with game root 0 and listeners 0. No duplicate submit/Monster/Companion or obvious DOM growth was detected.

### Issues / fixes

`KD-BROWSER-001`: the initial 844×390 run placed input / Submit bottom at 414px, clipping 24px. The only product fix changed the low-height landscape board from 170px to 140px. The rerun measured both controls at y 336–384 and passed full-visibility checks.

### Final Decision

`KANJI DEFENSE PLAYWRIGHT HARNESS READY`

`AUTOMATED REAL-BROWSER CERTIFICATION PASS`

`DESKTOP / RESPONSIVE / RUNTIME CERTIFIED`

`PLAYWRIGHT COMPOSITION EVENT CERTIFIED`

`ACTUAL WINDOWS IME PASS`

`REAL MOBILE SOFT KEYBOARD PASS`

`BROWSER / INPUT GATE COMPLETE`

The manual gate closure is recorded in `YOMITABI_KANJI_DEFENSE_MANUAL_INPUT_CERTIFICATION.md`. Child playtest authorization still depends on Human Content Review and completion of the remaining full-session adult QA coverage.

## Environment evidence

The repository browser-control integration was initialized through its supported runtime. Default browser selection returned `No browser is available`; the subsequent supported browser inventory returned an empty list (`[]`). No in-app Browser or connected Chrome runtime was available.

No standalone DOM simulation, source inspection, or unrelated automation backend is represented as real-browser evidence. No production source was changed to bypass the missing binding.

## Certification matrix

| Area | Target / scenario | Result | Evidence |
| --- | --- | --- | --- |
| Desktop | standard desktop viewport, complete smoke flow | NOT RUN | no real browser binding |
| Portrait | 390 × 844 | NOT RUN | no real browser binding |
| Portrait additional | 360 × 800 | NOT RUN | no real browser binding |
| Landscape | 844 × 390 | NOT RUN | no real browser binding |
| Tablet | 768 × 1024 | NOT RUN | no real browser binding |
| IME | composition start/update/end and Enter races | NOT RUN | automated DOM tests only |
| Soft keyboard | focused input and viewport resize | NOT RUN | requires browser/device viewport |
| Touch targets | computed Back/Monster/Submit/Replay dimensions | NOT RUN | source rule is not computed evidence |
| Overflow | body/root/board computed overflow | NOT RUN | source rule is not computed evidence |
| Three Monsters | visual hierarchy and target switching | NOT RUN | automated node count only |
| Focus | tab order and visible focus ring | NOT RUN | source/DOM checks only |
| Pause | manual pause and visibility transition | NOT RUN | Core/Host DOM tests pass |
| Background | hidden-tab return and bounded catch-up | NOT RUN | deterministic delta tests pass |
| Reduced motion | actual media preference | NOT RUN | CSS/source and adapter tests pass |
| Image failure | decode/load failure and layout | NOT RUN | synthetic error event test passes |
| Runtime | console exception/unhandled rejection | NOT RUN | Node observer isolation tests pass |
| Network | unexpected requests | NOT RUN | static imports show no new network loader |
| Scheduler | runtime RAF/interval ownership | NOT RUN | static and lifecycle instrumentation pass |
| Performance | three-target frame/typing/switch latency | NOT RUN | bounded O(3) source only |
| Repeated lifecycle | ten real enter/play/Back/Replay loops | NOT RUN | automated ten-cycle test passes |

## Automated evidence that does not certify the browser

The dedicated lifecycle suite covers pointer dispatch, keyboard lane selection, composition-gated Enter, repeated Enter, pause OR composition, three-target DOM creation, image-error fallback, Companion states, result/replay, Back cleanup, ten repeated lifecycles, Storage isolation, and responsive/accessibility source rules. These checks reduce risk but do not observe browser layout, an actual IME, visual focus, image decoding, rendering performance, or soft-keyboard behavior.

## Required rerun

When a real browser becomes available, execute the smoke flow on desktop, 390 × 844 and 844 × 390 first. Record viewport, browser/version, OS, input method, computed sizes/overflow, console/network logs, scheduler observations, and screenshots for first target, retry, three-target pressure, result, and soft-keyboard layout. Repeat the full-session/replay/Back path at least ten times.

## Outcome

Browser Certification: **FAIL — ENVIRONMENT BLOCKED, PRODUCT RESULT UNKNOWN**

`RELEASE CERTIFICATION BLOCKED: REAL BROWSER UNAVAILABLE`
