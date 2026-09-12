# YOMITABI 漢字防衛隊 Child Playtest Protocol

Date: 2026-09-12

Status: Formal educational playtest remains blocked by Human Content Review. Limited Child UX Pilot protocol is ready but execution remains blocked until Adult Full-Session QA passes.

## Limited Child UX Pilot overlay

This overlay narrows the study to comprehension、input usability、targeting、strategy、retry、replay intent and frustration. It does not evaluate learning effect、Grade 4 suitability、curriculum alignment or public-release readiness.

- Participants: 5〜8 children across grades 4〜6; normally one session each, with Replay only when self-initiated.
- Content: `kanji-defense-limited-ux-playtest-pre-reviewed-v1`, 21 AI/engineering pre-reviewed candidates, with `以下`、`位置`、`結果` excluded; 12 unique encounters per session.
- Adult facilitator: present throughout. Any alternative reading、ambiguity、unnatural meaning、high grade burden、over-revealing hint or unfamiliar word is flagged `CONTENT ISSUE`, not attributed to child error.
- Claims prohibited: learning effect、certified educational content、curriculum alignment、public-release readiness。
- Consent/privacy: guardian consent、child assent、voluntary participation、stop anytime/no penalty、anonymous ID、no raw typed text、no precise location、recording off by default and separate recording consent。
- Immediate stop: distress、technical failure、unusable input、severe confusion、visual/performance issue、guardian/child request。

Formal sections below remain the stronger educational-study baseline. Where they require 9〜12 participants or human-certified content, this limited overlay intentionally substitutes the narrower 5〜8 UX pilot and supervised 21-item pre-reviewed pool only.

## Objective

Determine whether grades 4〜6 can understand, operate, and enjoy 漢字防衛隊 while recognizing that its learning goal is Kanji reading. The first study is a tuning study, not a release approval or learning-effect claim.

## Participants

- 9〜12 participants across grades 4, 5, and 6 where feasible.
- Include a mix of Japanese-input familiarity and reading confidence.
- Do not recruit more participants to compensate for an unusable build; stop and fix the build first.

## Consent / privacy

- Obtain guardian consent and age-appropriate child assent before observation.
- Explain that participation is optional, stopping has no penalty, and this is a game test—not a test of the child.
- Use anonymous participant IDs. Do not collect names, precise location, account credentials, free-form personal details, or persistent identifiers.
- Do not retain raw typed strings. Record only categorized input errors and aggregate timing/outcomes.
- Obtain separate explicit consent for any screen/audio/video recording; default to no recording.

## Test build

- Current MVP mechanics, normal mechanical difficulty, silent-safe, no persistence.
- Exactly one human-approved content subset of at least 16 items; a session samples 12 without duplicates.
- Browser/device matrix must already have passed desktop, 390 × 844, 844 × 390, IME, soft keyboard, pause/visibility, Replay, and Back.
- No new reward, analytics, account, network content, or experimental mechanic in the test build.

## Session script

1. Welcome, obtain assent, and state: “ゲームを分かりやすくするためのテストです。あなたを採点するテストではありません。”
2. Show the title without explaining controls. Start the rule-understanding timer when 漢字防衛隊 opens.
3. If the participant has not acted after 30 seconds, give only: “近づいてくる相手を一つ選んでみてください。” Record assistance.
4. Observe the first target, IME entry, first correct, wrong/retry, target switch, escape, two/three-target pressure, result, Replay choice, and Back.
5. Stop after one completed session unless the participant independently chooses Replay. Cap the visit to avoid fatigue.
6. Ask post-play questions without leading to the expected learning answer.

## Observer script

Observers do not teach answers, express disappointment, or praise only high scores. Note what happened before asking why. If a participant reads a word aloud correctly but cannot enter it before escape, record a typing-bias event rather than a reading failure. Separate reading unknown, IME, typing speed, target selection, Monster speed, feedback, visual overload, and rule confusion.

## Metrics

| Metric | Definition | Initial target |
| --- | --- | ---: |
| Rule understanding | open to first intentional target + reading-input action without direct control instruction | median ≤ 30 s |
| First completion | participant reaches a result without technical stop | ≥ 80% |
| Replay intent | independently chooses Replay or answers yes with a concrete reason | ≥ 60% |
| Learning recognition | says “漢字の読み” or equivalent to an open question | ≥ 80% |
| Accuracy | terminal correct / resolved encounters | 55〜85% |
| First correct target time | open to first terminal correct | descriptive |
| Input error frequency | categorized IME/typing errors per encounter | descriptive |
| Target mis-selection | unintended target changes / session | descriptive |
| Retry success | retry-correct / first-wrong encounters | descriptive |
| Escape count | escaped encounters / session | descriptive |
| Average active Monsters | time-weighted active count if safely observable | descriptive |
| Session duration | active, pause-excluded duration | target 2〜5 min |

## Observation sheet

```text
Participant anonymous ID:
Grade: 4 / 5 / 6
Japanese input familiarity: low / medium / high
Device / OS / browser / input method:
Session start:
Rule understood time (seconds):
Assistance before first action: none / prompt / direct instruction
First successful target time:
First correct time:
Target switching issue (count/notes):
IME issue (category/count; no raw text):
Wrong → retry understood: yes / no / unclear
Escape understood: yes / no / unclear
Completion: yes / no / stopped
Replay choice: yes / no
Replay reason: score / combo / Monster / Kanji / revenge / curiosity / other
Accuracy:
Retry success rate:
Escape count:
Observed average active Monsters:
Active session duration:
Frustration moments: reading / IME / typing / target / speed / feedback / overload / rules
Correct oral reading but escaped before entry (count):
Verbalized learning goal:
Stop-rule invoked: no / yes (reason):
Free comments:
```

## Post-play questions

1. どんなゲームだった？
2. 何の練習をしたゲームだと思う？
3. どこが一番楽しかった？ どうして？
4. どこが分かりにくかった、または困った？
5. 近いMonsterが二体いたとき、どちらを先にした？ どうして？
6. 間違えたあと、次に何をすればよいか分かった？
7. もう一回遊びたい？ そう思う理由は？

## Stop criteria

Stop immediately for child distress, unusable input, repeated technical failure, severe confusion that cannot be resolved with the single neutral prompt, flashing/rendering problems, or an observer/guardian request. Do not continue merely to complete a metric row.

## Data handling

Store the anonymous sheet only for the minimum study period. Aggregate results before sharing. Keep consent records separately with restricted access. Delete raw notes/recordings on the pre-declared schedule. Do not feed child-entered text or recordings to generative AI.

## Success criteria

All headline metrics must be reported with participant count and missing data. A small first study supports tuning decisions only. Browser defects, child-safety incidents, or materially misleading content override aggregate thresholds.

Typing-bias warning: if at least 25% of participants have multiple encounters where they can say the correct reading but escape before entering it, mechanical tuning is mandatory. Strategy claim warning: if participants do not inspect threat/position or switch targets under two/three-target pressure, weaken the strategy claim and retune before release.

## Iteration decisions

- Continue: targets met, no critical defect, and frustration is learning-related rather than input-related.
- Tune: speed, grace, target readability, or hint presentation is the dominant issue; do not change learning difficulty at the same time.
- Pivot input: typing-bias threshold is exceeded after one mechanical tuning iteration.
- Stop: two iterations still show replay intent below 50%, comprehension median above 45 seconds, learning recognition failure, or input/target frustration dominating learning.

`PLAYTEST PROTOCOL READY`

`EXECUTION NOT AUTHORIZED UNTIL BROWSER AND HUMAN CONTENT GATES PASS`
