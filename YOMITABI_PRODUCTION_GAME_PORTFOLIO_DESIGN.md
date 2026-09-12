# YOMITABI Production Game Portfolio Design

Date: 2026-09-12

Status: Product strategy and production authoring decision. This document proposes no Contract v2, product-code change, persistence change, or new Technical Probe.

## 1. Executive Summary

YOMITABI should spend the next 6〜12 months as a **漢字特化 product expanded into 漢字語彙・文脈**, not as a general five-subject mini-game platform. The repository already has the differentiating assets for that choice: 2,136 grade/level-organized Kanji records, 100 regular/bonus stages, roughly 1,129 regional/legend/world Monster records, a Collection and capture flow, review infrastructure, and 400 proverb records. Math and English prove the platform, but they dilute the current product promise.

None of MINIGAME-01〜07 is production-ready without content, UX, editorial, and real-browser work. The right decision is not to retain all seven publicly. Upgrade mechanics 02/04/05/06 into branded Kanji games, replace 01/03 with stronger YOMITABI concepts, and keep 07 dev-only. Source and tests stay as architecture evidence until a separately approved migration.

Recommended Phase 1 is seven deliberately different games:

1. **漢字防衛隊** — realtime strategy/action; Flagship and next implementation.
2. **ことわざモンスター劇場** — narrative construction; Secondary Flagship.
3. **なかま分け図鑑** — classification/partial credit; teacher-friendly.
4. **文脈トレジャー** — meaning-in-context recall.
5. **鬼よみボスラッシュ** — short deadline challenge; home-play score chase.
6. **旅文クラフト** — sentence construction.
7. **まちがい追跡隊** — session-local review and retrieval.

The portfolio stays at contextual world connection (Level 2) in v1. Persistent rewards, Collection mutation, personalized cross-session review, and systemic Level 3 progression require a separately designed platform-layer connection; games must not write save state directly.

## 2. Current Platform Readiness

The current source confirms seven static Definitions with the same `id/title/create/createView` shape, six Instance methods, the established View shape, generic Host dispatch, and four LearningEvent types. The current title exposes all seven probes as peer public buttons. Host, Companion, and Collection remain game-agnostic.

The current production build is Vite 5.4.19 with 122 modules: main JS 660,878 B (187,555 B gzip), all JS 672,295 B (191,972 B gzip), CSS 48,657 B. This portfolio audit added documentation/tests only and changed the production bundle by 0 B. A serialized run of every current suite passed 588/588 tests (including five portfolio-document tests), with zero fail/cancelled/skipped/todo; stage-ID integrity and the production build also passed. Real Browser Certification remains pending.

Content and product assets found in the current repository:

| Asset | Current quantity | Portfolio value |
| --- | ---: | --- |
| Kanji records, grades/levels 1〜10 | 2,136 | reading, meaning, context, grade scaling |
| Regular stages | 88 | regional journey context |
| Bonus stages | 12 | review/boss framing |
| regular/legend/world monsters | about 1,129 | targets, characters, regional flavor |
| proverb records | 400 | high-leverage narrative vocabulary content |
| achievements | 73 | future platform presentation, not game mutation |

Architecture readiness is high; production readiness is not. Probe fixtures are mostly 20 items, single mode, fixed ten-question sessions, and lack curriculum certification. Dataset spot checks also show metadata/example wording that needs editorial review. Existing data is an input corpus, not automatically approved content.

## 3. Product Direction Decision

| Strategy | Strengths | Weaknesses | Differentiation / brand | Content and development cost |
| --- | --- | --- | --- | --- |
| A. 漢字特化YOMITABI | aligns with current battle, Kanji corpus, stages, Monster, review, product name | narrower top-of-funnel; must avoid repetitive reading drills | strongest: 「旅してモンスターと出会い、漢字語彙を使う」 | lowest relative cost; reuses real assets |
| B. 国語・語彙中心 | supports context, sentence, proverbs, parts of speech; more varied learning | requires much more curated sentence/semantic content | still credible if anchored in Kanji | medium/high; editorial work becomes dominant |
| C. 5教科学習platform | widest theoretical market and uses cross-subject capability | weak focus, crowded positioning, huge curriculum/QA load | lowest; risks becoming a generic quiz shelf | highest and unrealistic for one/small team |

**Decision: Strategy A for the next 6〜12 months.** Define it broadly enough to include reading, compounds, meaning, context, antonyms/synonyms, radicals, okurigana, and sentence use, but keep Kanji vocabulary as the common spine. Strategy B is a possible Phase 2 expansion after retention evidence. Strategy C is rejected for the current team scale.

This direction also matches curriculum reality: the elementary Japanese-language guidance treats Kanji instruction with grade burden, furigana support, and links to use in other subjects, while the middle-school guidance organizes Kanji, vocabulary, sentences, and language use systematically. That favors scaffolded Kanji-in-context over an unrelated subject catalog. [MEXT elementary Japanese guidance](https://www.mext.go.jp/content/20220606-mxt_kyoiku02-100002607_002.pdf), [MEXT middle-school Japanese guidance](https://www.mext.go.jp/component/a_menu/education/micro_detail/__icsFiles/afieldfile/2019/03/18/1387018_002.pdf)

## 4. Existing 01〜07 Evaluation

Production Cost uses 5 = low cost and 1 = high cost.

| Probe | Fun | Learning Fit | Replay | Differentiation | Curriculum Scale | Production Cost | YOMITABI Fit | Total / 35 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 01 Math Sprint | 2 | 4 | 3 | 2 | 5 | 5 | 1 | 22 |
| 02 Math Invader | 4 | 4 | 4 | 4 | 5 | 3 | 3 | 27 |
| 03 English Choice | 2 | 3 | 2 | 1 | 5 | 5 | 1 | 19 |
| 04 Sentence Order | 3 | 5 | 3 | 5 | 2 | 2 | 4 | 24 |
| 05 Timed Choice | 3 | 3 | 4 | 3 | 5 | 4 | 3 | 25 |
| 06 Multi Select | 3 | 5 | 3 | 4 | 3 | 3 | 4 | 25 |
| 07 Async Choice | 1 | 2 | 1 | 1 | 5 | 5 | 1 | 16 |

The role assessment behind the scores:

| Probe | A Gameplay / C Replay | B Learning | D Differentiation | E Age fit | F YOMITABI fit | G Effort / H Risk | I Curriculum scale | J Portfolio role |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | clear but worksheet-like; streak gives limited chase | arithmetic recall naturally matches typing | overlaps common drill apps and 02 | mechanically easy for all; content below target for many | math and generic UI do not use travel/Monster meaningfully | low effort/low technical risk | very easy generation | capability donor for fluency, not a public product |
| 02 | strongest game loop; target priority, life, realtime pressure | recall affects visible threats; current math content is off-brand | only action/strategy probe | suitable if speed and input are separately adjustable | Monster action is promising, regional context absent | medium/high polish; manageable v1 risk | large if prompts are curated | Flagship foundation |
| 03 | understandable in seconds but pure four-choice | basic word meaning, shallow retrieval and distractors | heavily overlaps 05/07 and common quizzes | easy, but English scope is undefined | weakest brand/content connection | low code cost, high brand opportunity cost | easy mechanically, no approved English corpus | replace with contextual Kanji choice |
| 04 | deliberate manipulation; less immediately exciting | syntax and sentence construction are mechanic-aligned | clearly unique | good for upper primary/JHS; motor operation needs simplification | travel-diary framing fits | content/editorial cost high; v1 risk low | hard—each item needs valid chunking | Secondary construction role |
| 05 | pressure and score chase work; fixed 5s can frustrate | fluency fit is valid only after knowledge acquisition | distinct challenge mode, but UI is still choice quiz | best for optional challenge, not first exposure | boss framing can make it fit | medium effort/low technical risk | easy-to-medium after item QA | short boss/challenge |
| 06 | selection has agency and informative feedback | classification and partial knowledge are strongly aligned | unique assessment shape | very good for grades 4〜6; quiet classroom use | Monster-dex categorization fits naturally | medium content/UX effort; low technical risk | medium—sets need balanced labels | teacher-friendly classification |
| 07 | loading itself is not fun; ready state becomes another choice quiz | async mechanism has no learning value | duplicates 03 after load | mechanically easy but purposeless to learner | mixed-subject fixture breaks identity | low code effort; no product reason | scalable only as generic questions | dev fixture for lifecycle only |

All seven probes are currently **Level 1: Skin only** at best: Companion or Monster presentation exists, but the learning action is not yet connected to travel, region, exploration, or collection meaning. MINIGAME-02 has the strongest visual bridge, yet its arithmetic task remains unrelated to that world. Production upgrades below therefore target Level 2 (contextual) first; Level 3 is deferred until platform-owned reward/progression integration has a proven product need.

## 5. KEEP / UPGRADE / HIDE / REPLACE

| Probe | Decision | Why |
| --- | --- | --- |
| 01 Math Sprint | **REPLACE** | absorb speed/streak learning into branded Kanji action/challenge; do not ship standalone arithmetic drill |
| 02 Math Invader | **UPGRADE** | strongest game feel and best base for the Flagship, but needs Kanji content, escalation, feedback, art/audio and accessibility |
| 03 English Choice | **REPLACE** | generic English four-choice has no product thesis; replace with Kanji-in-context decision play |
| 04 Sentence Order | **UPGRADE** | excellent learning/mechanic fit; needs authored progression, faster manipulation and travel narrative |
| 05 Timed Choice | **UPGRADE** | retain as optional boss/challenge, never the default teaching experience |
| 06 Multi Select | **UPGRADE** | strong classification and teacher fit; replace mixed fixtures with Kanji/word taxonomy |
| 07 Async Choice | **HIDE / DEV-ONLY** | async lifecycle evidence is valuable, but its learner-facing game is deliberately undifferentiated |

**KEEP: none.** “KEEP” means almost production-ready, and every probe still lacks content certification, real-browser release evidence, and product-level UX. This is not a criticism of their Technical Probe success.

## 6. Portfolio Design Principles

1. **One product promise:** every public game improves Kanji/word knowledge through a journey or Monster context.
2. **Mechanic-learning unity:** speed for retrieval, classification for categories, construction for syntax; never apply a mechanic only because v1 supports it.
3. **Role before count:** no two Phase 1 games may be merely four-choice with different nouns.
4. **2〜5 minute center:** include one 60〜120 second challenge but keep standard sessions classroom-compatible.
5. **Learning and mechanical difficulty separate:** grade/content selection must not automatically increase input complexity or animation speed.
6. **A play arc:** 15〜30 second orientation, two escalation steps, a visible climax, then an explanatory result.
7. **Useful feedback:** answer, reading/meaning, short reason or next hint; feedback duration must not destroy tempo.
8. **Level 2 world connection:** region, route, Monster, and prompt context should matter visually/narratively; persistent systemic rewards stay outside game v1.
9. **Companion as emotion, not rule:** attack, cheer, idle and reward presentation enrich the loop but never gate it.
10. **Evidence-based cuts:** content cost, comprehension, replay, and differentiation can kill a game even after code investment.

## 7. Target User

Primary target: Japanese learners in grades 4〜6 who can independently read UI and use touch/keyboard, with difficulty-adjusted content for mixed mastery. Secondary target: grades 3 and junior-high learners through content selection, not more complex controls.

Two use contexts shape the portfolio:

- **School / teacher-led:** silent-capable, rule explanation under 30 seconds, 2〜5 minutes, clear learning target/result.
- **Home:** short restart, score/combo chase, visible escalation, and meaningful variety without required purchases or persistent grind.

MEXT frames one-device-per-learner ICT use around individual, whole-class, and collaborative learning situations; YOMITABI Phase 1 should first excel at short individual practice and teacher-directed use, not claim to solve every classroom mode. [MEXT ICT learning-situation reference](https://www.mext.go.jp/a_menu/shotou/zyouhou/detail/mext_00964.html)

## 8. YOMITABI Product Identity

Center the identity on **「漢字を使って、旅を進め、土地のモンスターと出会う」**.

| Element | Portfolio role |
| --- | --- |
| 旅 | session framing, routes, escalating destinations, return motivation |
| 都道府県 | Level 2 contexts, local signs/words/scenes; not trivia pasted onto questions |
| Monster | threats, characters, feedback and narrative mnemonic |
| Companion | display-only encouragement and action reaction |
| Collection | visible product aspiration; read-only inside games |
| 漢字・語彙 | non-negotiable learning spine |
| 成長 | within-session mastery/combo now; persistent growth only through future platform layer |
| 探索 | finding context, routes, clues and Monster—not simply a skin over ten questions |

Connection levels:

- Level 1 skin-only is insufficient for a Phase 1 lead game.
- Level 2 contextual is the Phase 1 requirement.
- Level 3 systemic is deferred because v1 games cannot safely mutate Collection/progress and no reward handoff is designed.

## 9. Subject Strategy

Public Phase 1 subject label should be **国語：漢字・語彙**. The content ladder is:

1. read a Kanji/word;
2. connect reading and meaning;
3. discriminate usage in context;
4. classify form/meaning/reading;
5. construct compounds/sentences;
6. retrieve again after an error.

Math and English sources/tests remain useful platform fixtures but should not define the public catalog. Other-subject Kanji can appear contextually—for example science vocabulary—only when the learning objective remains the reading/meaning/use of the word. This also follows elementary guidance that other-subject Kanji may be taught in connection with those subjects rather than treated as disconnected lists. [MEXT elementary Japanese guidance](https://www.mext.go.jp/content/20220606-mxt_kyoiku02-100002607_002.pdf)

## 10. Existing Probe Reuse Opportunities

| Probe pattern | Production reuse | What must be discarded/reworked |
| --- | --- | --- |
| 01 numeric submit/streak | fluency/combo pacing and compact result | arithmetic corpus, worksheet presentation |
| 02 realtime entity priority | 漢字防衛隊 target selection, danger, life, wave climax | math generator, minimal motion, fixed speed and abrupt life loss |
| 03 nonnumeric choice | 文脈トレジャー contextual decisions | English fixture and generic ten-card loop |
| 04 reorder/submit | 旅文クラフト and proverb scene construction | left/right-only friction, flat session arc, probe sentences |
| 05 update deadline | optional boss weak-point windows | universal fixed 5s and timeout-first teaching |
| 06 toggle/partial | なかま分け図鑑 with explanatory partial feedback | mixed-subject sets and uniform 5-choice/3-answer format |
| 07 generation gate | local loading of a future game-owned pack where genuinely needed | visible “async quiz” concept; no game exists merely to demonstrate loading |

Reuse should happen by applying a pattern under the Authoring Guide, not by creating a universal shared mechanic framework.

## 11. 15+ Production Game Concepts

| # / Working title | Subject / age | Learning goal | Core mechanic | Play / difficulty | Replayability | YOMITABI connection | v1 pattern | Effort | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 漢字防衛隊 | Kanji words, G4〜6 | rapid and accurate word reading | choose advancing regional Monster, type/tap reading, protect three routes, chain combo | 3 min; learning adjustable, mechanic medium | high: waves, score, target priority | Level 2 region/Monster/Companion attack | realtime + multi-step + single-consume | High | **P0** |
| 2 旅文クラフト | sentence structure, G4〜JHS | word order, particles, coherent sentences | assemble travel-diary chunks, spend limited hint tokens | 3〜4 min; low→medium | medium/high through routes and clean solves | Level 2 travel diary and destinations | multi-step | High | **P0** |
| 3 なかま分け図鑑 | Kanji/vocabulary, G3〜6 | classify radicals, meanings, readings, word groups | select all fitting specimens; partial feedback annotates each choice | 2〜3 min; low→medium | medium | Level 2 Monster-dex research | multi-step + partial credit | Medium | **P0** |
| 4 文脈トレジャー | vocabulary in context, G4〜JHS | infer word meaning/use from a sentence | choose the fitting word, then reveal one optional clue at score cost | 2〜3 min; learning medium | medium/high with clue-free score | Level 2 route clues/treasure | choice + local score | Medium/High | **P1** |
| 5 鬼よみボスラッシュ | reading fluency, G5〜JHS | retrieve learned readings under bounded pressure | timed weak points, combo windows, generous pause and practice mode | 60〜120 sec; mechanic medium/high | high score chase | Level 2 regional boss battle | deadline + update/dispatch race | Medium | **P1** |
| 6 まちがい追跡隊 | retrieval review, G4〜JHS | correct and recall errors from the same session | failed items become clues, then return in altered order at climax | 3〜4 min; low→medium | high if errors vary | Level 2 detective hunt with Monster footprints | multi-step + local session state | Medium | **P1** |
| 7 部首パズル工房 | character form, G4〜6 | recognize radical/component structure | assemble component tiles into target Kanji with decoys | 3 min; mechanic medium | high through efficient builds | Level 2 craft/repair travel equipment | multi-step + partial | High | P2 |
| 8 熟語ブリッジ | compounds, G4〜JHS | form valid compounds and distinguish readings | connect Kanji stones into bridges; bad links consume stability | 3 min; medium | high route/score variation | Level 2 cross regional rivers | multi-step | Medium | P1 |
| 9 反義語デュエル | semantic relations, G4〜JHS | retrieve antonym pairs | place opposing word cards on two battle sides | 2〜3 min; low/medium | medium/high | Level 2 rival Monster duel | multi-step | Medium | P2 |
| 10 類義語ルート | semantic nuance, G5〜JHS | compare near-synonyms in context | choose a route whose nuance fits a short scene | 3 min; learning high | medium | Level 2 map decisions | choice + multi-step | High | P2 |
| 11 おくりがな整備隊 | orthography, G4〜6 | choose correct okurigana in inflected words | attach kana tiles to repair signposts, then test in a sentence | 2〜3 min; low/medium | high with word variants | Level 2 route/sign repair | multi-step | Medium | P1 |
| 12 音訓レーダー | readings, G3〜6 | distinguish on/kun in compounds and words | scan moving signals and route them to 音/訓 channels | 2 min; mechanic low/medium | medium/high | Level 2 navigation radar | realtime + classification | Medium | P2 |
| 13 ご当地看板ハンター | contextual reading, G4〜JHS | read words in practical/local contexts | explore one scene, find and decode signboards before moving on | 3〜5 min; low | high if scenes vary | strongest Level 2 travel context | choice + multi-step; async only if justified | High | P2 |
| 14 ことわざモンスター劇場 | proverb meaning/use, G5〜JHS | connect proverb, meaning, and usage scene | choose scene outcome, arrange the key line, reveal proverb Monster | 3〜4 min; medium | high with 400-record corpus | Level 2 Monster narrative; near-Level 3 feel without save | choice + multi-step | Medium | **P0** |
| 15 漢字迷宮 | reading/meaning inference, G5〜JHS | combine semantic and reading clues | branching labyrinth; each door consumes one clue decision | 4〜5 min; medium | high route variation | Level 2 exploration centerpiece | choice + multi-step | High | P2 |
| 16 説明文レスキュー | reading composition, G5〜JHS | identify claim, evidence, and sequence | order paragraph cards and connect evidence | 4〜5 min; learning/mechanic high | medium | Level 2 expedition report | multi-step + partial | Very High | P3 |
| 17 語彙しりとり航路 | vocabulary retrieval, G4〜JHS | retrieve readings and word chains | build a route by valid final/initial kana links | 3 min; medium/high | high | Level 2 island route | multi-step | Very High validation | P3 |
| 18 漢字釣り・意味合わせ | meaning retrieval, G3〜6 | match moving words/Kanji to meanings | position a hook, catch only the matching token, preserve streak | 2 min; low/medium | high | Level 2 regional waters and creatures | realtime + choice | Medium | P2 |

Every concept includes risk/reward, combo, timing, spatial decision, progression, Monster reveal, clue economy, or score chase. Only 文脈トレジャー is intentionally close to a simple choice game, because its low mechanical load serves quiet comprehension practice.

## 12. Scoring Matrix

Cost again uses 5 = low. Scores prioritize comparison, not automatic selection; portfolio role and content evidence can override total.

| # Game | Fun | Learn | Replay | Diff | Scale | Cost | YOMITABI | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 漢字防衛隊 | 5 | 5 | 5 | 5 | 4 | 2 | 5 | **31** |
| 2 旅文クラフト | 4 | 5 | 4 | 5 | 2 | 2 | 5 | **27** |
| 3 なかま分け図鑑 | 3 | 5 | 3 | 4 | 4 | 3 | 5 | **27** |
| 4 文脈トレジャー | 3 | 5 | 4 | 3 | 4 | 3 | 5 | **27** |
| 5 鬼よみボスラッシュ | 4 | 4 | 5 | 4 | 5 | 4 | 4 | **30** |
| 6 まちがい追跡隊 | 4 | 5 | 4 | 5 | 3 | 3 | 5 | **29** |
| 7 部首パズル工房 | 4 | 5 | 4 | 5 | 3 | 2 | 4 | 27 |
| 8 熟語ブリッジ | 4 | 5 | 5 | 5 | 4 | 3 | 5 | 31 |
| 9 反義語デュエル | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 28 |
| 10 類義語ルート | 3 | 5 | 3 | 4 | 2 | 2 | 5 | 24 |
| 11 おくりがな整備隊 | 4 | 5 | 4 | 5 | 4 | 3 | 4 | 29 |
| 12 音訓レーダー | 3 | 4 | 4 | 4 | 4 | 3 | 4 | 26 |
| 13 ご当地看板ハンター | 5 | 5 | 5 | 5 | 2 | 1 | 5 | 28 |
| 14 ことわざモンスター劇場 | 4 | 5 | 5 | 5 | 5 | 3 | 5 | **32** |
| 15 漢字迷宮 | 5 | 5 | 5 | 5 | 3 | 2 | 5 | 30 |
| 16 説明文レスキュー | 3 | 5 | 3 | 5 | 1 | 1 | 4 | 22 |
| 17 語彙しりとり航路 | 4 | 4 | 5 | 5 | 2 | 1 | 4 | 25 |
| 18 漢字釣り・意味合わせ | 4 | 4 | 5 | 3 | 4 | 3 | 4 | 27 |

## 13. Tier S/A/B/C

- **Tier S — product-defining:** 漢字防衛隊、ことわざモンスター劇場。
- **Tier A — initial release / next evidence:** 旅文クラフト、なかま分け図鑑、文脈トレジャー、鬼よみボスラッシュ、まちがい追跡隊、熟語ブリッジ、おくりがな整備隊。
- **Tier B — after usage evidence:** 部首パズル工房、反義語デュエル、音訓レーダー、ご当地看板ハンター、漢字迷宮、漢字釣り。
- **Tier C — costly/narrow or dev evidence only:** 類義語ルート、説明文レスキュー、語彙しりとり航路、raw MINIGAME-01/03/07 product concepts.

Tier is “why now,” not an immutable quality ranking. 熟語ブリッジ scores highly but waits until the Phase 1 content workflow proves compound data quality.

## 14. Recommended Phase 1 Portfolio

Phase 1 contains **7 games**, shipped in waves rather than all at once.

| Game | Role | Why now | Probe decision | MVP scope | Production upgrade scope |
| --- | --- | --- | --- | --- | --- |
| 漢字防衛隊 | Strategy / action / fluency | turns the strongest mechanic and Monster assets into the product promise | 02 UPGRADE; absorbs 01 | 3 lanes, 12 encounters, one G4 region pack, kana input, combo/life/result | region waves, clearer telegraphing, adaptive non-persistent speed, audio/mute, richer feedback |
| ことわざモンスター劇場 | narrative / construction | existing 400-record corpus and Monster names create unusual differentiation | 03/04 pattern reuse, new product | 40 reviewed proverbs, scene choice + one line assembly | regional chapters, alternate scenes, performance scoring |
| なかま分け図鑑 | classification / teacher | quiet, explainable and partial-credit-friendly | 06 UPGRADE | 40 Kanji/word sets, 4〜6 choices, annotated feedback | mixed classification types, teacher-selected grade packs |
| 文脈トレジャー | memory / meaning | fills low-pressure comprehension role | 03 REPLACE | 60 sentence-context items, optional clue cost | multi-sentence clues, meaning/usage contrast packs |
| 鬼よみボスラッシュ | challenge / score chase | short home loop and content reuse | 05 UPGRADE | 60 learned-word items, 90-second mode, practice and standard pressure | boss patterns, difficulty/time options, daily pack only after product layer exists |
| 旅文クラフト | construction | adds non-quiz manipulation and language structure | 04 UPGRADE | 30 reviewed travel sentences, 3 difficulty bands, hint tokens | faster drag/tap reorder, paragraph mini-climax, route chapters |
| まちがい追跡隊 | review / retrieval | makes feedback actionable without persistence | new; local patterns from 03〜06 | wrong items return within same session, max 10 source + 5 recall items | future platform-fed due-review pack only after explicit persistence integration |

MVP means a playtestable production slice, not immediate public release. Wave 1 is 漢字防衛隊・なかま分け図鑑・ことわざモンスター劇場; the remaining four enter the release portfolio only after Wave 1 meets comprehension and content-throughput gates.

## 15. Flagship Game

**Flagship: 漢字防衛隊**

- **30-second clarity:** Kanji-word Monsters move down three routes; choose the urgent one and enter its reading before it reaches the gate.
- **Learning/mechanic unity:** reading retrieval directly powers defense. Target priority introduces strategy without changing the learning answer.
- **Visual value:** regional background, multiple Monster silhouettes, projectiles, combo, gate pressure, and Companion attack produce a legible short video.
- **Replay:** score, combo, wave order, target priority and adjustable content pack.
- **YOMITABI:** travel route and regional Monster context are intrinsic, not a title-card skin.

Difficulty has two independent controls:

- Learning: grade, word familiarity, reading ambiguity, context clue availability.
- Mechanical: descent speed, simultaneous targets, grace period, combo requirement.

Session arc: 15-second guided first target → 4 calm encounters → 5 mixed-priority encounters → 3-target boss wave → result with three strongest/weakest words. The MVP should not add persistence, Collection reward, rankings, or a new Host capability.

## 16. Secondary Flagship

**Secondary Flagship: ことわざモンスター劇場**

It deliberately contrasts the action Flagship. A short situation is shown, the learner selects the fitting outcome/meaning, then assembles the key proverb line. Correct completion reveals the associated proverb Monster and a compact explanation. The current 400-record proverb corpus creates a credible content advantage, subject to full editorial QA.

It is shareable because each round has a setup, wrong comic possibility, reveal, and named Monster. It also demonstrates that YOMITABI is not only speed drill. Target session: 3〜4 minutes, 5 story rounds rather than a flat ten-choice sequence.

## 17. Teacher-friendly Game

**Teacher-friendly: なかま分け図鑑**

- explanation: “条件に合うものを全部選ぶ” in under 30 seconds;
- 2〜3 minutes, silent-capable, touch/keyboard;
- explicit objective such as 部首、音読み、同じ意味領域;
- result shows full/partial/incorrect and which choices caused the score;
- teacher can discuss the category after play.

Do not punish partial understanding with only a red X. Preserve detailed local feedback while keeping coarse LearningEvent semantics.

## 18. Home-play Game

**Home-play lead: 鬼よみボスラッシュ**, with 漢字防衛隊 as the deeper replay option.

Boss Rush offers a 90-second score chase, clear combo growth, and instant replay. It must include a no-pressure practice path and must not reduce learning difficulty and mechanical time pressure to one slider. Timeout feedback still shows the reading and one short mnemonic before the next weak point.

## 19. Portfolio Balance

| Game | Subject | Role | Mechanic | Session | Age | Replay | Learning | YOMITABI Fit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 漢字防衛隊 | word reading | strategy/action/fluency | realtime target + reading input | 3 min | G4〜6 | high | retrieval fluency | Level 2, very high |
| ことわざモンスター劇場 | proverbs/context | narrative/construction | scene choice + line assembly | 3〜4 min | G5〜JHS | high | meaning and use | Level 2, very high |
| なかま分け図鑑 | Kanji/vocabulary | classification/teacher | multi-select partial credit | 2〜3 min | G3〜6 | medium | conceptual categories | Level 2, high |
| 文脈トレジャー | vocabulary/context | memory/comprehension | clue economy + choice | 2〜3 min | G4〜JHS | medium/high | infer usage/meaning | Level 2, high |
| 鬼よみボスラッシュ | word reading | boss/challenge | bounded deadline/combo | 1〜2 min | G5〜JHS | high | rapid retrieval | Level 2, high |
| 旅文クラフト | sentence structure | construction | reorder + hint budget | 3〜4 min | G4〜JHS | medium | syntax/coherence | Level 2, very high |
| まちがい追跡隊 | prior session items | review | error clues + delayed return | 3〜4 min | G4〜JHS | high | retrieval correction | Level 2, high |

The portfolio has only one deliberately simple choice-led game and one speed-only challenge. It spans action, narrative, classification, comprehension, construction and review.

## 20. Content Requirements

“Item” means one independently reviewed problem/set/story; variants do not count as new content until validated.

| Game | MVP | Initial release | Strong replayability |
| --- | ---: | ---: | ---: |
| 漢字防衛隊 | 60 word-reading prompts | 180 | 500+ across grades/regions |
| ことわざモンスター劇場 | 40 stories | 120 | 300 reviewed from the 400 corpus |
| なかま分け図鑑 | 40 classification sets | 120 | 300 |
| 文脈トレジャー | 60 context items | 180 | 500 |
| 鬼よみボスラッシュ | 60 prompts | 180 | 500; may reuse approved reading bank with distinct balancing |
| 旅文クラフト | 30 sentences | 90 | 240 |
| まちがい追跡隊 | 40 source/recall pairs | 120 | 300; derived only from approved banks |

MVP total is 330 reviewed units, but shared source facts can reduce duplication: a validated word/reading/meaning record can feed distinct game-specific authoring adapters. This does not justify a universal gameplay schema.

## 21. Content Production Cost

| Game | Cost | Bottleneck |
| --- | --- | --- |
| 漢字防衛隊 | Medium/High | unambiguous word readings, input aliases, balancing reading time against enemy speed |
| ことわざモンスター劇場 | Medium | scene appropriateness, meaning nuance, line segmentation; existing 400 records reduce ideation cost |
| なかま分け図鑑 | Medium | category validity, plausible false positives, explaining omitted/incorrect choices |
| 文脈トレジャー | High | natural sentences and genuinely diagnostic distractors |
| 鬼よみボスラッシュ | Medium | can reuse approved readings, but pressure/grace QA is device- and age-sensitive |
| 旅文クラフト | High | valid alternative orders, chunk boundaries, age-appropriate prose |
| まちがい追跡隊 | Medium | transform/re-present rules and avoiding rote position memory |

Code is unlikely to be the main bottleneck. 文脈トレジャー and 旅文クラフト should be killed or narrowed if reviewed authoring throughput cannot sustain at least 8 accepted items per person-day after tooling stabilizes.

## 22. Generative AI Content Workflow

AI may draft, vary, tag, and flag content; it must not certify it.

1. Define a human-authored item spec: target skill, grade, source Kanji, accepted readings, prohibited ambiguity, feedback length, region relevance.
2. Generate drafts with provenance fields and prompts/version retained outside runtime content.
3. Run deterministic validation: IDs, duplicates/near-duplicates, accepted answer membership, reading notation, length, banned terms, choice balance, and fixture shape.
4. Cross-check target grade and curriculum references; allow furigana/scaffolding where burden requires it.
5. Human Japanese-language reviewer verifies every answer, distractor, sentence, ambiguity, explanation and age fit.
6. Editorial/safety review checks stereotypes, regional claims, violence tone, accessibility, copyright similarity and child appropriateness.
7. Pilot a golden sample with children; only then batch-expand.
8. Track rejection reasons and regenerate only failed fields.

Never copy textbook passages or assume model output is copyright-clear. Never accept a reading or example because two models agree. Current repository content also requires the same gate; AI is not a shortcut around existing-data review.

## 23. Production Acceptance Criteria

### Architecture

- Authoring Guide/checklist PASS; Stable Contract, Host and adapters unchanged.
- Core stale/duplicate/observer/exit/replay isolation covered.
- Full repository regression, integrity, diff check and production build pass.

### Gameplay

- Median unaided rule-understanding time ≤30 seconds after one short instruction.
- First-run completion ≥80% in target-user playtest.
- Session has orientation, escalation, climax and explanatory result.
- Learning and mechanical difficulty can be tuned independently.

### Learning

- One measurable objective per mode; child can state what was practiced.
- Feedback gives correct reading/meaning/reason without derailing pace.
- Deadline is not used for first exposure or treated as evidence of mastery.

### Content / editorial

- 100% answer and ambiguity review, provenance/licensing recorded.
- Grade, notation, furigana, regional facts, feedback tone and duplicate checks pass.
- AI-assisted items are indistinguishable in quality only after human approval.

### Accessibility / browser / performance

- keyboard, touch, focus-visible, non-color state, 44px targets and reduced motion pass.
- real browser certification covers portrait/landscape, overflow, pause, lifecycle, exceptions, requests and scheduler ownership.
- no blocking long task/leak/input latency issue on target school and mobile devices.

### Product evidence

- At least 60% answer “play again” or voluntarily replay in a small test.
- Teacher learning-goal/readability ratings average ≥4/5.
- No critical safety, content, accessibility or data-integrity issue remains.

Technical Probe PASS alone satisfies none of the content, child, teacher or browser gates above.

## 24. Probe Visibility Recommendation

Recommendation only; no title, registry, source or test change is made now.

| Probe | Decision | Public title? | Source retained? | Tests retained? | Replacement |
| --- | --- | --- | --- | --- | --- |
| 01 Math Sprint | REPLACE | no after portfolio migration | yes until migration review | yes | capability absorbed by 漢字防衛隊/鬼よみ |
| 02 Math Invader | UPGRADE | replace label/content with production game | yes as upgrade base | yes, then migrate assertions | 漢字防衛隊 |
| 03 English Choice | REPLACE | no | yes as Contract fixture | yes | 文脈トレジャー |
| 04 Sentence Order | UPGRADE | yes only after production QA | yes | yes | 旅文クラフト |
| 05 Timed Choice | UPGRADE | yes only as optional challenge | yes | yes | 鬼よみボスラッシュ |
| 06 Multi Select | UPGRADE | yes after Kanji content QA | yes | yes | なかま分け図鑑 |
| 07 Async Choice | HIDE / DEV-ONLY | no | yes | yes | none; async pattern reused only on real need |

Do not remove public entries until replacement routing, cumulative scope tests, and browser release behavior have a separate approved implementation plan.

## 25. Bundle / Maintenance Consideration

MINIGAME-03〜07 increased main JS by 69,486 B raw and 17,995 B gzip relative to the pre-03/04 Contract baseline; consolidation itself added 0 production bytes. Bundle size alone is not a reason to delete a valuable game, but shipping low-value probe UIs permanently creates both download and QA surface.

When production replacements exist, remove 01/03/07 from public imports/bundle if measurement shows worthwhile savings, while retaining Core fixtures/tests in an appropriate dev/test location. Do not introduce code splitting until actual startup/network profiling demonstrates a problem. Maintenance cost—seven visible titles, seven content promises, seven browser matrices—is more urgent than the current gzip number.

## 26. Phase 1 / 2 / 3 Roadmap

| Phase | Games | Content target | Success criteria |
| --- | --- | --- | --- |
| Phase 1, months 0〜9 | 7-game portfolio; Wave 1 ships 3 before Wave 2 | 330 MVP units, then at least 120/180 for launched leads | Flagship comprehension ≤30s, completion ≥80%, replay intent ≥60%; teacher ≥4/5; browser/release gates pass |
| Phase 2, months 9〜12 | add at most 2: 熟語ブリッジ and おくりがな整備隊, only if roles show unmet demand | winning three games reach 180〜300; new games 40〜60 MVP each | repeat-week usage and learning feedback beat portfolio median; content throughput sustainable |
| Phase 3, after month 12 | 0〜1 net-new game; deepen top 2〜3 mechanics | winners reach 300〜500+; weak games frozen/removed | validated retention and teacher demand; only then evaluate platform-layer review/reward connection |

Do not target 50 games, five full subjects, or 1,000 stages. New concepts enter only when they fill a measured portfolio gap.

## 27. User Testing Plan

Run two rounds before public release:

### Round 1: concept/MVP

- 9〜12 children: balanced across grades 4, 5 and 6; include different reading confidence and at least two keyboard-only/accessibility observations where possible.
- Each child plays Flagship plus two contrasting games; rotate order.
- Observer does not explain after the scripted 20〜30 second intro.
- Capture rule-understanding time, first-action error, completion, abandonment phase, pause/input friction, verbalized learning target, frustration moments and spontaneous replay.

### Round 2: revised portfolio

- 12〜18 children, including returning and new users.
- Compare tutorial removed/retained, two difficulty settings, quiet classroom mode, and 15-minute free-choice behavior.
- Success: ≥80% first-run completion, ≥60% replay intent/voluntary replay, ≥80% can explain the learning task, critical frustration <20%, no systematic grade/input exclusion.

Use think-aloud selectively; it can distort timed performance. Obtain guardian/school consent, minimize recorded personal data, and never capture raw names in gameplay analytics.

## 28. Teacher Evaluation Plan

Recruit 3〜5 elementary/Japanese-language teachers for a 30-minute structured review.

They score 1〜5:

- learning objective clarity;
- fit in a 5-minute lesson gap;
- explanation burden;
- quiet/mute usability;
- grade/furigana appropriateness;
- feedback usefulness;
- result interpretability;
- concern about speed pressure or guessing.

Gate: mean ≥4/5 for objective clarity, explanation and classroom fit; no unresolved “wrong answer/ambiguous” report. Ask each teacher where the game belongs: introduction, practice, review, or optional challenge. Boss Rush must be labeled optional challenge if teachers do not view it as fair formative evidence.

## 29. Metrics Recommendation

Product analytics are separate from LearningEvent v1 and are not implemented in this task.

Minimum future product events:

- catalog impression and game start;
- tutorial/first-action completion;
- session completion or abandonment phase;
- replay and next-game choice;
- active duration and pause count;
- accuracy/score band, timeout/hint counts and same-session review recall;
- input mode, coarse viewport/device class and runtime error category.

Derived metrics: start→completion, median active time, replay rate, voluntary catalog return, error concentration by item, clue dependency, and seven-day game-level return when privacy/legal design permits it.

Do not expand LearningEvent to carry catalog analytics. Do not collect raw typed answers, child name, precise location or unnecessary identifiers. Define retention, consent, aggregation and deletion policy before instrumentation.

## 30. Kill Criteria

Apply after two focused iteration cycles, not after polishing indefinitely.

| Game | Stop, pivot, or cut when… |
| --- | --- |
| 漢字防衛隊 | median rule comprehension >45s; typing/targeting causes more frustration than reading; replay intent <50%; realtime pressure collapses accuracy across the target group |
| ことわざモンスター劇場 | children choose by comic tone without learning the proverb; explanation is skipped/unread; accepted content throughput <6 stories/day |
| なかま分け図鑑 | category boundaries remain disputed by reviewers; partial feedback is not understood; it feels identical to a worksheet after two UX iterations |
| 文脈トレジャー | distractors are guessable without reading; content throughput <8 accepted items/day; role duplicates Theatre |
| 鬼よみボスラッシュ | frustration/timeout abandonment >25%; learners treat speed as ability/mastery; replay intent <50% even with fair difficulty |
| 旅文クラフト | valid alternate sentences make scoring unfair; manipulation exceeds learning load; content throughput <6 accepted sentences/day |
| まちがい追跡隊 | repeated items are solved by position memory; same-session recall does not improve; users perceive it as punishment |

Portfolio-level kill criteria: two games share >70% of their observed interaction loop; a role has <10% free-choice selection after exposure; browser/device defects remain blocking; or the content team cannot maintain the release bank without lowering review standards.

## 31. Risks

1. **Brand dilution:** leaving Math/English probes public makes product direction look accidental.
2. **Quiz sameness:** cosmetic Monster skins cannot rescue seven answer→feedback loops.
3. **Content correctness:** existing and AI-generated data can contain ambiguity, metadata mismatch or unnatural examples.
4. **Speed bias:** realtime/deadline mechanics can measure motor/input speed instead of Kanji knowledge.
5. **Scope:** seven production games are only feasible in waves with shared reviewed source facts and hard kill gates.
6. **Persistence expectation:** Collection/reward visuals may imply rewards that v1 games cannot safely grant.
7. **Browser uncertainty:** real layout, IME, mobile keyboard, visibility timing and performance remain uncertified.
8. **Bundle/QA growth:** every public game adds startup and release matrix cost.
9. **Age spread:** one UI/content setting cannot serve G3 through JHS; content scaffolding must not complicate controls.
10. **World accuracy/tone:** regional facts and Monster stereotypes need editorial sensitivity review.

Mitigations are editorial gates, separate learning/mechanical difficulty, Wave 1 evidence before Wave 2, no direct save mutation, real-browser/device certification, and removing low-value public probes after approved migration.

## 32. Final Recommendation

| Final question | Decision |
| --- | --- |
| A. 01〜07をすべてpublic production gameとして残すべきか | **NO** |
| B. KEEP | **なし**—Technical Probe PASSとproduction readinessを混同しない |
| C. UPGRADE | **02 Math Invader、04 Sentence Order、05 Timed Choice、06 Multi Select** |
| D. HIDE / DEV-ONLY | **07 Async Choice** |
| E. REPLACE | **01 Math Sprint、03 English Choice** |
| F. 最初のproduction portfolio | **7本、Wave 1は3本** |
| G. Flagship | **漢字防衛隊** |
| H. Product direction | **漢字特化（漢字語彙・文脈まで）** |
| I. 次に実装するproduction game | **漢字防衛隊** |
| J. Technical Probeを増やすべきか | **NO** |

### Next implementation: 漢字防衛隊

- **Why now:** it converts the strongest existing game mechanic and the repository's most distinctive Monster/stage/Kanji assets into one clear product promise. It creates more product evidence than another architecture experiment.
- **MVP scope:** one self-contained G4 regional pack; 60 reviewed word-reading prompts; 3 lanes; max 3 targets; 12-encounter three-act session; kana input; combo/life; informative miss/timeout feedback; Companion display; Back/Replay/pause; no save reward.
- **Core mechanic:** prioritize advancing Monster targets and recall the displayed word's reading before route pressure wins. Core remains authoritative and uses Host update plus opaque commands.
- **Production upgrade:** visual telegraphs, regional Monster selection, onboarding, independent learning/mechanical difficulty, mute/audio cues, reduced motion, stronger results and real device polish.
- **Success criteria:** ≤30s rule comprehension; ≥80% first completion; ≥60% replay intent; ≥80% can explain the reading task; healthy target accuracy band 55〜85%; no critical browser/accessibility/content defect.
- **Kill criteria:** after two iterations, stop/pivot if replay intent <50%, median comprehension >45s, targeting/typing frustration dominates, or pressure measures input speed more than reading knowledge.

**PRODUCTION PORTFOLIO DESIGN COMPLETE**

**TECHNICAL PROBE PHASE CLOSED**

**PRODUCTION AUTHORING PHASE READY**
