# YOMITABI 漢字防衛隊 Certification Handoff Index

Prepared: 2026-09-12
Current status: **CHILD PLAYTEST NOT AUTHORIZED**

## 1. What is already proven

- Architecture Gate: PASS。
- kanjiDefense dedicated tests: 58/58 PASS。
- Full regression: 647/647 PASS、fail/cancelled/skipped/todo 0。
- Stage ID integrity、production build、`git diff --check`: PASS。
- Host / Contract / Companion / Collection / save / package-lockへの製品変更0。
- retry、escape、routeBroken、pause、stale identity、observer isolation、cleanup、DOM-level IME gate、Storage isolationは自動test evidenceあり。
- Child playtest protocolとprivacy/data-minimization ruleは準備済み。

これらはreal browser、actual IME、soft keyboard、教育編集者判断を代替しない。

## 2. What remains

1. Real Browser QA: desktop、390 × 844、844 × 390、actual IME、soft keyboard、computed layout/touch、runtime/network/performance、10-cycle。
2. Human Content Review: 24語全行、3 REVISE語、2文字hint policy、16+ human APPROVE subset、provenance。
3. Blocker-only fixesと再認証。
4. Go / No-Go票への証拠反映と正式authorization。

## 3. Handoff file map

| Artifact | Purpose | Primary owner | Completion criterion |
| --- | --- | --- | --- |
| [Browser QA Handoff](./YOMITABI_KANJI_DEFENSE_BROWSER_QA_HANDOFF.md) | 実行sheet、matrix、case、evidence、判定 | Browser QA | critical cases実行、final PASS/conditional/fail |
| [Browser Tester Instructions](./YOMITABI_KANJI_DEFENSE_BROWSER_TESTER_INSTRUCTIONS.md) | 非開発者向け1ページ開始手順 | Browser QA | testerが単独で起動・報告可能 |
| [Human Content Review Pack](./YOMITABI_KANJI_DEFENSE_HUMAN_CONTENT_REVIEW_PACK.md) | 24語の全review rowsとsign-off | 国語教材reviewer | 24 decisions、16+ APPROVE、provenance |
| [Content Reviewer Instructions](./YOMITABI_KANJI_DEFENSE_CONTENT_REVIEWER_INSTRUCTIONS.md) | 非エンジニア向け1ページ基準 | 国語教材reviewer | 判定基準と提出方法を理解 |
| [Playtest Go / No-Go](./YOMITABI_KANJI_DEFENSE_PLAYTEST_GO_NO_GO.md) | 最終authorization票 | Release QA owner | 全required gate PASS後だけGO |
| [Child Playtest Protocol](./YOMITABI_KANJI_DEFENSE_CHILD_PLAYTEST_PROTOCOL.md) | 未成年test手順・metrics・privacy | Playtest facilitator | owner/consent/build確定 |
| [Certification Handoff Report](./YOMITABI_KANJI_DEFENSE_CERTIFICATION_HANDOFF_REPORT.md) | 状態と責務の最終引継ぎ | Handoff owner | package監査完了 |

Reference evidence:

- [Release Certification Report](./YOMITABI_KANJI_DEFENSE_RELEASE_CERTIFICATION_REPORT.md)
- [Browser Certification — current NOT RUN](./YOMITABI_KANJI_DEFENSE_BROWSER_CERTIFICATION.md)
- [Content Pre-Review](./YOMITABI_KANJI_DEFENSE_CONTENT_REVIEW.md)
- [Production Implementation Report](./YOMITABI_KANJI_DEFENSE_PRODUCTION_IMPLEMENTATION_REPORT.md)
- [Production Spec](./YOMITABI_KANJI_DEFENSE_PRODUCTION_SPEC.md)
- [Content Spec](./YOMITABI_KANJI_DEFENSE_CONTENT_SPEC.md)

## 4. Recommended execution order

1. Browser QA担当がbuild identityを固定し、required matrixを実行する。
2. 国語教材reviewerが同じcontent versionの24語をreviewする。Step 1と並列可。
3. BLOCKER/REVISEがあればEngineeringが許可された最小fixだけを行う。
4. 修正後、relevant dedicated tests、full regression、build、失敗browser case、該当content itemを再確認する。
5. Release QA ownerがGo / No-Go票へ証拠path、担当者、日付、versionを転記する。
6. 全required gate PASS後だけPlaytest coordinatorが未成年testをauthorizeする。

## 5. Ownership matrix

| Responsibility | Owns | Does not own |
| --- | --- | --- |
| Engineering | architecture evidence、blocker-only fix、regression/build | 教材認証、child authorization |
| Browser QA | runtime/device/IME/layout/performance evidence | 語彙correctness |
| Content Reviewer | reading/grade/naturalness/ambiguity/meaning/hint | browser UX、code |
| Release QA | evidence completeness、final gate decision | missing evidenceの推定PASS |
| Playtest Facilitator | consent/assent、safe session、observation/data handling | product release認証 |

## 6. Allowed and prohibited work

Allowed blocker fixes: CSS overflow、44px target、IME gate、focus、short-reading hint、meaning wording、accepted reading。必ず最小diffと再認証を伴う。

Handoff中禁止: boss、新score、content大量追加、reward、gameplay redesign、persistence、new audio system、Contract/LearningEvent変更。

## 7. Completion status

- Browser package: READY TO HAND OFF / execution pending。
- Human review package: READY TO HAND OFF / review pending。
- Protocol: READY / execution unauthorized。
- Final Go: NO。

`BROWSER QA HANDOFF READY`

`HUMAN CONTENT REVIEW PACK READY`

`CHILD PLAYTEST PROTOCOL READY`

`CHILD PLAYTEST NOT AUTHORIZED`
