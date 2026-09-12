# YOMITABI 漢字防衛隊 Production Implementation Report

Date: 2026-09-12

## 1. Executive Summary

「漢字防衛隊」のMVP architecture implementationはMiniGame Platform Contract v1を変更せず成立した。新`kanjiDefense`をMath Invaderと分離し、漢字読み、三本のlane、最大3体、3-act/12 encounters、target priority、1 retry、escape、life/combo/score、session-local強弱語を実装した。

これは**Flagship Production Candidate**であり、release済みProduction Gameではない。real browser bindingが利用できずBrowser Certificationは未実施、24語golden packはsource/schema検査済みだが教育編集者のcontent certificationと子どもplaytestは未完了である。

## 2. Git

- Base checkpoint: `56cb8840b9528d3eca86882f5a1537b671a279d8`
- Base tag: `yomitabi-minigame-production-portfolio-2026-09`
- Work branch: `product/kanji-defense`
- Local checkpoint commit message: `feat(minigames): add kanji defense flagship MVP`
- Local checkpoint tag: `yomitabi-kanji-defense-mvp-2026-09`
- main worktreeのFirebase cache、3D資料、その他untracked filesは別worktreeにあり、変更していない。
- remote push: 未実施。

## 3. MVP Scope

実装範囲は3 lanes、最大3 Monsters、最大12 encounters、Grade 4 golden pack、かなIME入力、正解/1 retry/2回誤答、escape、3 life、combo、score、Companion、pause、Back、Replay、result、responsive/accessibility。persistent reward、XP/rank、leaderboard、boss HP、Collection mutation、save、network content、新audio、Contract v2は含めない。

## 4. Files Changed

Product codeは`src/minigames/kanjiDefense`のCore/Content/View 3 files、registry 1 entry、title 1 button。ほかはProduction Spec、Content Spec、Implementation Plan、本report、専用tests、cumulative scope/hash test maintenanceである。Host、Companion、Collection、Math Invader、main RAF、public data/assets、save、package/lockは変更0。

## 5. Platform Compliance

Definitionは`id/title/create/createView`だけ、Instanceは`enter/update/setPaused/snapshot/dispatch/exit`、Viewは`root/update/stopInput/dispose/canvas`。Hostは`kanjiDefense`、reading、retry、escapeを知らず、opaque dispatchとaccepted後`update(0)`だけを使う。

## 6. Content Pack

current Grade 4 source 202 recordsを監査し、ID/漢字重複0、reading欠落0、meaning欠落1、空readingを含む2 records、複数reading 141 recordsを確認した。全件自動採用を避け、current source IDへ追跡可能な24語をgolden packとして実装した。中部地方Monster 12体と既存画像の存在を自動検査する。

## 7. Core Loop

spawn → threat比較 → select → かなreading submit → defeat/retry/failure → 次spawn。Coreがentity、position、attempt、scoreを所有し、DOM/CSSは採点しない。

## 8. Lane / Spawn

lane 0〜2、各lane最大1、全体最大3。Encounter 1〜4はcapacity 1、5〜9は2、10〜12は3。activeが空なら短いgap、残っていればact別gapで次を出し、1 updateでburst spawnしない。

## 9. Reading Input

text inputとOS/ブラウザーIMEを使用する。game-local normalizationはNFKC、trim/空白除去、カタカナ→ひらがな。composition中Enter、repeat、modifier Enterを拒否し、pointer、focusable Monster button、lane key 1〜3を提供する。

## 10. Retry

1回目のwrongは古いattemptをconsumeし、combo reset、最初のかな+文字数hint、新attemptをcommitする。lifeは減らさずLearningEventも出さない。2回目のwrongだけがterminal `incorrect`となる。UI disabledではなくCore identityが一次防御。

## 11. Escape

gate到達はterminal `incorrect` + `reason: 'escaped'`でlife -1。life 0時は残active entityを`routeBroken`として一度ずつ閉じ、未提示encounterを生成せず`sessionComplete`へ進む。

## 12. Life / Combo / Score

lifeはescapeだけで減る。terminal correctでcombo、途中wrong/terminal failureでreset。scoreは正解100、first-try 25、combo bonus最大80、終了life bonus。速度bonusはなく、typing速度を直接performanceへ入れていない。

## 13. LearningEvent

新type/envelope変更0。1 spawnにつき`problemPresented` 1回、terminal `correct`または`incorrect` 1回、終了時`sessionComplete` 1回。途中wrongはgame-local。attempt consume、counters、enemy removal、resultをcommitしてからobserverへ通知し、throw/rejected Promise/reentrant dispatchを隔離する。

## 14. Companion

adapter変更0。terminal correct/incorrectだけが既存mappingへ流れる。Companion画像failure、unowned、reduced motionでもCore進行は独立する。

## 15. Accessibility

44px control、keyboard/touch/pointer、focus-visible、selected文字marker、非色依存の`接近中/近い/危険`、aria-label/live、IME composition gate、pause、画像text fallback、reduced-motion CSSを実装した。実機評価はBrowser Certification待ち。

## 16. Responsive

boardは3 columnsを維持し、580px以下でCompanionを隠してlane/inputを優先、650px以下でboardを190px、landscape 430px以下で170pxへ縮める。Host visual viewport処理を再利用する。computed overflowとsoft keyboard実測は未認証。

## 17. Tests

専用suiteはcore 36、lifecycle 15、scope 7の計58 tests。content/source/asset、determinism、3 acts、movement/huge delta、retry/escape、life/combo/score、event uniqueness、stale identity、observer isolation、IME、pointer/keyboard、pause OR、Companion、image failure、replay/back、cleanup、Storage、protected boundaryを検査する。

## 18. Regression

2026-09-12にrepo内の全`.test.mjs`を`--test-concurrency=1`で実行し、**647/647 PASS**、fail/cancelled/skipped/todoはすべて0だった。suite別は次の通り。

| Suite | PASS |
| --- | ---: |
| minigame-01 | 34 |
| minigame-02 | 26 |
| minigame-03 | 21 |
| minigame-04 | 27 |
| minigame-05 | 36 |
| minigame-06 | 33 |
| minigame-07 | 39 |
| minigame-contract-v1 | 16 |
| minigame-platform-v1 | 18 |
| minigame-production-kanji-defense | 58 |
| motion-01 | 39 |
| motion-02 | 32 |
| no-go | 143 |
| phase-a | 86 |
| phase-b | 22 |
| phase-c | 17 |
| **Total** | **647** |

## 19. Browser Certification

Browser skillを通じてruntime default bindingを確認したが、`No browser is available`であった。製品sourceを変更せず、standalone automationを代替認証にしていない。

**RELEASE CERTIFICATION BLOCKED: BROWSER QA PENDING**

## 20. Build / Bundle

Production build PASS、125 modules。main JS 688,417 B / gzip 196,442 B、all JS 699,834 B / gzip 200,859 B。portfolio checkpointからmain/all JSともraw +27,539 B、gzip +8,887 B。新asset/dependencyなし。既存500kB chunk warningは継続するが、この増分だけを理由にcode splittingは行わない。

## 21. Content QA

24語のschema、unique identity、source Grade 4 ID、reading形式、Monster assetはautomated PASS。`岡`/`潟`の空reading entry、`阜`のmeaning欠落を含むsource品質差を確認し、該当recordsはgolden packへ入れていない。教育的自然さ、学年、意味文、readingは人間の二重review未完了。

**CONTENT CERTIFICATION PENDING**

## 22. Production Acceptance

Architecture、automated lifecycle、build/integrityは合格。rule理解≤30秒、初回完走≥80%、replay intent≥60%、学習理解≥80%、accuracy 55〜85%、実ブラウザーcritical defect 0は未測定。したがってProduction-ready/release-readyとは判定しない。

## 23. Known Limitations

- golden contentは24/60で、editorial certification前。
- 実時間3分、理解30秒、typing負荷、target priorityの楽しさは未playtest。
- 新audioなし。silent classroomには安全だが家庭向けimpactは今後の評価対象。
- actual soft keyboard、touch target computed size、overflow、image decode/performanceは未認証。
- 公開titleは既存probe 7本との並列表示で過密。portfolio migrationは別task。

## 24. Playtest Readiness

Core correctnessを検証する内部adult QAへは進める。子どもplaytestへ進む前に、少なくとも1つのtarget browserでsmoke/IME/viewport検証を行い、24語を国語教材reviewerが確認する必要がある。現時点ではchild-facing test build配布を認証しない。

## 25. Decision

- A Flagshipとして成立: **YES AS A CANDIDATE / NOT RELEASE CERTIFIED**。
- B Math InvaderよりProduction価値が高い: **YES**。漢字読み、地域Monster、三幕、retry feedbackがproduct purposeと一致する。
- C 漢字読みとmechanicの一体化: **YES**。readingがMonster defeatの唯一の手段。
- D target priorityの戦略性: **YES structurally / PLAYTEST PENDING**。
- E typing速度を測りすぎない: **DESIGN YES / EMPIRICAL NOT CERTIFIED**。速度scoreなし、選択中35% speed、retryあり。
- F 約3分: **NOT CERTIFIED**。tuning/実測待ち。
- G 30秒以内の理解: **NOT CERTIFIED**。子ども観察待ち。
- H Grade 4教材安全性: **SCHEMA PASS / CONTENT CERTIFICATION PENDING**。
- I Platform v1変更0: **YES**。
- J Browser Certification: **NO**。
- K 子どもplaytest: **NO, browser smokeとcontent review完了後**。

`KANJI DEFENSE MVP IMPLEMENTATION PASS`

`FLAGSHIP PRODUCTION CANDIDATE READY`

`PLATFORM V1 COMPLIANT`

`RELEASE CERTIFICATION BLOCKED: BROWSER QA PENDING`

`CONTENT CERTIFICATION PENDING`
