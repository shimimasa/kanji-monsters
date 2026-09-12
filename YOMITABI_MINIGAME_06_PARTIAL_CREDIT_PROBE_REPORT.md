# YOMITABI MINIGAME-06 Partial-Credit Probe Report

Date: 2026-09-12 (Asia/Tokyo)

## 1. Executive Summary

MINIGAME-06「えらんで完成」 (`multiSelect`) は、MiniGame Platform Contract v1を変更せず、0〜1の中間scoreを持つ複数選択problemを実装できた。score、classification、selection、payload、resultはすべてgame-localである。Host、Contract文書、LearningEvent envelope/type、Companion、Collection、main RAF、package/lockの変更は0である。

既存文書はanswer/score semanticsとevent payload/result detailsをgame-local責務としている。現在のconsumerは`correct`だけを成功反応として分岐し、`incorrect`を「0点だけ」と解釈していない。このため、満点を`correct`、満点未満のpartial/zero completionを`incorrect`とし、詳細をpayloadの`score`と`classification`で表すことは既存semanticと両立する。

MINIGAME-06 33 tests、全532 tests、stage ID integrity、`git diff --check`、production buildはPASSした。利用可能browser bindingは0件だったためBrowser CertificationはNOT RUNである。

## 2. Git / checkpoint

- 開始checkpoint: `64d7aa79d63988199c340bbb66466fb32d514b1b`
- 開始tag: `yomitabi-minigame-05-checkpoint-2026-09`
- 作業branch: `experiment/minigame-partial-credit-probe`
- local checkpoint tag: `yomitabi-minigame-06-checkpoint-2026-09`
- upstream: 未設定
- push: 未実施

専用worktree `artifacts/minigame-03/worktree`だけを変更した。main worktreeの`.firebase/hosting.ZGlzdA.cache`と既存untracked report/`.claude`は別作業として保持し、変更・stage・checkpointへの混入をしていない。他worktreeも変更していない。

## 3. Files changed

Product:

- `src/minigames/multiSelect/multiSelectQuestions.js`（新規）
- `src/minigames/multiSelect/multiSelectGame.js`（新規）
- `src/minigames/multiSelect/multiSelectView.js`（新規）
- `src/minigames/registry.js`（definition追加のみ）
- `src/screens/titleScreen.js`（entry追加のみ）

Tests:

- `tests/minigame-06/{core,lifecycle,scope}.test.mjs`、`scope-contract.mjs`（新規）
- 既存exact-registry assertionを5から6 definitionsへ更新
- Contract regressionへMINIGAME-06のcommit-before-event実証を追加
- 既存cumulative scope allowlist/hashへ今回のreviewed deltaを追加

Documentation:

- 本reportのみ。`src/minigames/README.md`変更0。

Tooling / dependencies: 変更0。unrelated change混入0。

## 4. Contract v1 compliance

| Surface | Result | Evidence |
| --- | --- | --- |
| Definition `id/title/create/createView` | PASS / unchanged | registry exact-shape tests |
| Instance lifecycle | PASS / unchanged | six-definition Contract tests |
| View `root/update/stopInput/dispose`, optional `canvas` | PASS / unchanged | real Host/View lifecycle tests |
| opaque dispatch | PASS | Host forwards `toggle/submit/next` without inspection |
| LearningEvent envelope | PASS / unchanged | exact field and version assertions |
| fixed four event types | PASS / unchanged | partial uses existing `incorrect` |
| pause OR semantics | PASS / unchanged | visibility/manual pause lifecycle test |
| Companion / Collection | PASS / unchanged | byte protection and runtime isolation |
| common result wrapper | not needed | Host never reads result fields |

Stable Contract filesとHost/adapters/games 01〜05はbase checkpointとのbyte comparisonで一致した。

## 5. Partial-Credit Core

Coreは`selectedChoiceIds`、採点、classification、counters、resultを所有する。DOM stateは採点sourceではない。Submitのみがattemptをconsumeし、identity validation、selection read、score calculation、attempt consume、state commit、LearningEventの順に処理する。

## 6. Question model

20問のself-authored fixtureを追加した。各問は`fixtureId`、`prompt`、5個のidentity-based choices、3個の`correctChoiceIds`、`skillId`を持つ。sessionごとに10問を決定的に選択し、choice順も注入randomでshuffleする。外部教材はコピーしていない。

fixture、choices、correct ID集合、生成結果はfreezeされ、表示textと`fixtureId:choiceId` identityは分離される。

## 7. Selection state

`toggle`はCoreのSetを決定的に反転する。同じchoiceへの2 dispatchは元状態へ戻る。toggleはattempt、score、counter、LearningEventを変更しない。Submit後、pause中、stale/invalid identity、exit後のtoggleはCoreで拒否する。

## 8. Scoring model

採点は次のprecision-aware式である。

```text
TP = 選択した正解数
FP = 選択した不正解数
score = clamp(TP / TOTAL_CORRECT - FP / TOTAL_WRONG, 0, 1)
```

実装は浮動小数の比較誤差を避けるため、`earnedPoints = max(0, TP * TOTAL_WRONG - FP * TOTAL_CORRECT)`、`maxPoints = TOTAL_CORRECT * TOTAL_WRONG`を先に整数計算し、`score = earnedPoints / maxPoints`とする。全正解だけを選ぶと1、empty/完全誤答/全選択は0、正しい選択を増やせば原則上昇し、false positiveは減点される。

## 9. Full / Partial / Zero classification

| score | game-local classification | LearningEvent type |
| ---: | --- | --- |
| `1` | `fullCorrect` | `correct` |
| `0 < score < 1` | `partial` | `incorrect` |
| `0` | `incorrect` | `incorrect` |

classification名と閾値はGAME-LOCAL / PROVISIONALであり、Stable Contractへ追加していない。

## 10. Dispatch

commandsは`toggle`、`submit`、`next`だけで、すべてgame-localである。Viewはgeneric `dispatch(command)`を直接利用する。Host、shared command adapter、共通command vocabularyは変更していない。未知commandと`partial` commandは拒否する。

## 11. LearningEvent semantic evaluation

既存Contract文書は固定typeを列挙しつつ、answer/score semanticsをgame側へ明示的に残している。`incorrect`を「獲得点が必ず0」と定義する文言はない。games 01〜05と現consumerも、typeを共通scoreとしては解釈していない。

現在の安全な意味は次のとおりである。

- `correct`: gameが定義した完全正解completion
- `incorrect`: 完全正解ではないcompletion
- score量、partial/zero理由: game-local payload

この意味ならpartialを`incorrect`へ分類してもscoreを失わず、既存consumerを誤作動させない。新type`partial`/`score`/`graded`は不要だった。ただし将来の共通consumerが`incorrect === zero earned credit`を要求するなら、それはContract v2 triggerである。

## 12. LearningEvent payload

completion payloadは`attemptId`、`skillId`、`selectedChoiceIds`、`correctChoiceIds`、`score`、`earnedPoints`、`maxPoints`、`classification`だけを持つ。payload schemaはgame-localでfreezeされる。envelopeの8 fields、version 1、session-wide `activeElapsedMs`、seq semanticsは変更していない。

1問ごとのorderingは`problemPresented`、続いて`correct OR incorrect`が1回だけである。10問後の`sessionComplete`も1回だけである。

## 13. Pause

既存Hostのvisibility/manual OR合成をそのまま利用する。pause中はtoggle/submit/next/keyboardをCoreまたはView gateで拒否し、`activeElapsedMs`を進めない。選択集合はpause解除後も保持される。

## 14. Companion

`companionAdapter.js`はbyte-identicalで、partial score/payload/gameIdを理解しない。満点の`correct`では既存attack、partial/zeroの`incorrect`では既存idleとなる。image pending/failureとreduced motionはgame進行・score・completionを止めない。

partial専用animationは追加していない。現probeでのidle表現は意味破綻ではないが、partial固有反応が必須になるまではPROVISIONALなUX制約である。

## 15. Collection

`collectionAdapter.js`はbyte-identical。ownershipはread-onlyで、MiniGame側のStorage access/write、save key、progress、XP、ranking、SRS、selected companion persistenceは0である。full/partial/zeroをCollectionへ伝播しない。

## 16. View

既存return shapeだけを使う。Viewはprompt、5 choices、selected state、progress、Submit、feedback、points、正解一覧、Next、result、Companion、Replay、Backをsnapshotから描画する。採点はしない。

選択は`aria-pressed`、check mark、border幅でも示す。buttonは44 CSS px以上、`:focus-visible`、portrait/landscape media rule、`overflow:auto`を持つ。1〜6でtoggle、EnterでSubmitし、repeat/composing/modifierを拒否する。独自RAF/timer/CSS animationは0である。

## 17. Feedback

満点は「ぜんぶ正解」、中間点は「一部正解」、0点は「今回は0点」と表示する。pointsと正解一覧も表示する。各choiceは「選択した正解」「誤って選択」「選ばなかった正解」の文字・記号とstyleを併用し、色だけに依存しない。

## 18. Result

immutable game-local resultは`answered`、`fullCorrect`、`partial`、`incorrect`、`totalPoints`、`maxPoints`、`scoreRate`、`fullCorrectRate`を持つ。二値の`accuracy`へ押し込めず、満点率と獲得点率を分離した。Hostはこのshapeを理解せず、MiniGameResult wrapperも追加していない。

## 19. Lifecycle

Hostの既存順序（stop input、session invalidate、Core exit、Companion dispose、Host listener cleanup、View dispose/DOM removal）を変更していない。10回のenter/exit、pending image、old callback、idempotent exitでlistener/DOM/Core/Companion leak 0を確認した。Replayは新session/attempt identityを作る。

## 20. Core isolation

Coreはdocument/window、Storage/save、gameState、Companion/Collection、Motion/battle、wall clock、schedulerへ依存しない。stale session/problem/attempt、unknown choice、double submit、post-submit toggle、exit後commandを拒否する。

observerのthrow、rejected Promise、arbitrary return、snapshot read、reentrant submitでもcommit済みscoreは戻らず、attemptは復活せず、completion/sessionCompleteは重複しない。

## 21. Tests

MINIGAME-06 suite: **33 PASS**。

- Core: 19（fixture/generation/identity/scoring/toggle/submit/pause/stale/event/observer/result/exit）
- Lifecycle: 7（registry/view/Host paths/keyboard/pause/repeated lifecycle/Storage isolation）
- Scope: 7（allowlist/byte protection/Host opacity/LearningEvent semantic/adapters/no scheduler/no protected delta）

初回実行で英語choiceの表示textとIDが同一だった2 assertionsが失敗した。identityをfixture namespace付きへ修正し、assertion削除・skip/todo・弱体化なしで再実行33/33 PASSとした。

## 22. Existing regression

現在repoから全suiteを列挙し、固定値499を流用せず再実行した。

Windows上のparallel全件実行で一度だけNode test runner自身のIPC deserialize errorが`phase-b/audio-lifecycle.test.mjs` processに発生した（assertion failureではない）。同suiteの独立再実行と、`--test-concurrency=1`による全件再実行はいずれもPASSしたため、下表は最終serialized regressionをsource of truthとする。

| Suite | PASS | fail | cancelled | skipped | todo |
| --- | ---: | ---: | ---: | ---: | ---: |
| minigame-01 | 34 | 0 | 0 | 0 | 0 |
| minigame-02 | 26 | 0 | 0 | 0 | 0 |
| minigame-03 | 21 | 0 | 0 | 0 | 0 |
| minigame-04 | 27 | 0 | 0 | 0 | 0 |
| minigame-05 | 36 | 0 | 0 | 0 | 0 |
| minigame-06 | 33 | 0 | 0 | 0 | 0 |
| minigame-contract-v1 | 16 | 0 | 0 | 0 | 0 |
| motion-01 | 39 | 0 | 0 | 0 | 0 |
| motion-02 | 32 | 0 | 0 | 0 | 0 |
| no-go | 143 | 0 | 0 | 0 | 0 |
| phase-a | 86 | 0 | 0 | 0 | 0 |
| phase-b | 22 | 0 | 0 | 0 | 0 |
| phase-c | 17 | 0 | 0 | 0 | 0 |
| **Total** | **532** | **0** | **0** | **0** | **0** |

## 23. Browser QA

Browser control runtimeのdefault discoveryは`No browser is available`、binding一覧は`[]`だった。従って実ブラウザーでのportrait/landscape、computed 44px/overflow、keyboard、Companion描画、runtime exception/external request、RAF/interval certificationは0 checksである。

Core/DOM/lifecycle automated testsはPASSしたがBrowser PASSとは表現しない。製品sourceを変更して環境制約を回避していない。

**BROWSER CERTIFICATION NOT RUN**

## 24. Integrity / Build / Bundle

- stage ID integrity: PASS (`oldIdHits: 0`, referenced subset OK)
- `git diff --check`: PASS（content error 0、GitのLF/CRLF checkout warningのみ）
- production build: PASS (Vite 5.4.19, 119 modules)
- package/lock delta: 0
- runtime dependency delta: 0
- protected Contract/Host/adapter/games 01〜05/core/main RAF paths: delta 0

既存のVite CJS、static/dynamic import、500 kB超chunk warningsは非fatalのまま残る。

| Artifact | MINIGAME-05 | MINIGAME-06 | Delta |
| --- | ---: | ---: | ---: |
| main JS | 629,110 B | 645,887 B | +16,777 B |
| main JS gzip | 179,099 B | 183,753 B | +4,654 B |
| all JS | 640,527 B | 657,304 B | +16,777 B |
| all JS gzip | 183,515 B | 188,170 B | +4,655 B |
| CSS | 48,657 B | 48,657 B | 0 B |

## 25. Stable Contract evaluation

Stable surface変更0。MINIGAME-06はopaque dispatch、game-local snapshot/result/payload、one-time consume、commit-before-event、four-type LearningEvent、pause、View lifecycleの既存境界へ新しい実証を追加した。score abstraction、partial event、common answer/result、Host capabilityは追加していない。

## 26. Provisional findings

- `toggle`/`submit`/`next`とpayload fieldsはGAME-LOCAL。
- scoring formula、point scale、classification、threshold、result fieldsはGAME-LOCAL。
- keyboard mapping、feedback文言、choice markerはGAME-LOCAL。
- partial時にCompanionをidleへ戻すpolicyは現consumerの既存挙動であり、共通partial policyではない。
- 共通analyticsがpartial payloadを読む契約は存在せず、必要になるまでDEFERRED。

## 27. Partial-Credit Contract evaluation

PARTIAL-CREDIT OUTCOMEはContract v1上で成立した。重要なのは`incorrect`だけで点数を表現したことではなく、Event typeはcoarse completion classification、獲得量はgame-local payload/resultという既存責務分離で情報を失わなかったことである。

Host/Companion/Collectionがscoreを理解しないまま、0点、中間点、満点をViewとresultで区別でき、各problemのcompletion eventは一つに保たれた。

## 28. Contract v2 trigger evaluation

現probeではtriggerなし。次の場合に初めてv2候補となる。

- 複数game/共通consumerがpartialをfirst-class common semanticとして必要とする。
- 共通consumerが`incorrect`を「獲得点0」に限定し、game-local payloadでは互換性を維持できない。
- 複数gameで共通score aggregation/persistenceが必要になり、Host非関知では成立しない。
- fixed four typesでは必須consumer reactionを安全に区別できないことが複数gameで再現する。

「将来便利そう」だけではtriggerにしない。

## 29. Known limitations

- 実ブラウザーvisual/interaction certificationは未実施。
- fixtureはarchitecture probe用の自作教材で、curriculum/pedagogy certification対象外。
- 全fixtureは5 choices・3 correctであり、Core/Viewは4〜6 choicesを許容するが他比率の実教材UXは未評価。
- partialとzeroは共にcoarse `incorrect`なので、区別が必要なconsumerはgame-local payloadを読む必要がある。現在その共通consumerは存在しない。
- score persistence、SRS、XP、ranking、selected companion persistenceは意図的にscope外。

## 30. Decision

| Question | Decision |
| --- | --- |
| A Stable Contract変更0で成立したか？ | **YES** |
| B Host変更0か？ | **YES** |
| C Hostはpartial scoreを理解していないか？ | **YES** |
| D multi-select stateをgame-localだけで管理できたか？ | **YES** |
| E 部分点scoreをgame-localで保持できたか？ | **YES** |
| F full correctを既存`correct`で表現できたか？ | **YES** |
| G partial resultを既存LearningEvent semanticで安全に表現できたか？ | **YES** |
| H zero scoreを既存`incorrect`で表現できたか？ | **YES** |
| I LearningEvent type追加0か？ | **YES** |
| J LearningEvent envelope変更0か？ | **YES** |
| K Companion変更0か？ | **YES** |
| L Collection変更0か？ | **YES** |
| M MiniGameResult wrapperは不要だったか？ | **YES** |
| N 1 problemにつきcompletion eventは1つか？ | **YES** |
| O Contract v2が必要になったか？ | **NO** |

**MINIGAME-06 TECHNICAL PROBE PASS**

**PARTIAL-CREDIT OUTCOME CONTRACT PROVEN**

**LEARNINGEVENT 4-TYPE MODEL SUFFICIENT**

**CONTRACT V2 NOT REQUIRED**

**BROWSER CERTIFICATION NOT RUN**
