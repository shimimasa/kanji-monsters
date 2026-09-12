# YOMITABI 漢字防衛隊 Certification Handoff Report

Date: 2026-09-12

## 1. Executive Summary

「漢字防衛隊」の未完了release gateを、real-browser実行担当と人間の国語教材reviewerへ直接渡せるhandoff packageへ変換した。Architectureは再実装不要でPASSを維持する。Browserはsupported runtime 0のため実行しておらず、ContentはAI/engineering pre-reviewまででhuman certified 0/24である。

packageはBrowser execution sheet、24語review pack、各1ページinstructions、Go / No-Go票、handoff index、既存playtest protocolからなる。不明事項をPASSにせず、Browser/IME/Contentのcritical gate完了前は`CHILD PLAYTEST NOT AUTHORIZED`とする。

## 2. Current Certification State

| Gate | State | Current fact |
| --- | --- | --- |
| Architecture / Regression | PASS | dedicated 58/58、all 647/647、integrity/build PASS |
| Real Browser / Device | BLOCKED / NOT RUN | supported browser binding 0 |
| Human Content | INCOMPLETE | 21 APPROVE (PRE)、3 REVISE、human certified 0 |
| Child Protocol | READY | executionはBrowser/Content gate待ち |
| Child Playtest | NOT AUTHORIZED | critical gate未完 |

## 3. Proven Evidence

Current repositoryと認証文書を再照合した。branchは`product/kanji-defense`、starting checkpointは`cd1056b3f2fe9540ee65a0869ba504e61ad36e38`。kanjiDefense sourceは3 files、golden contentは24 immutable items、sessionは12 encounters。既存evidenceはretry、escape、routeBroken、life、combo、pause OR、stale identity、observer isolation、DOM-level IME event gate、replay/Back cleanup、Storage isolationを保護する。

このhandoff差分を含む現worktreeでfull serialized regressionを再実行し、647/647 PASS、fail/cancelled/skipped/todo 0。関連scope/production suitesは76/76 PASS。Stage ID integrity、production build（Vite 5.4.19、125 modules、main JS 649.70 kB / gzip 196.44 kB）、`git diff --check`もPASSした。今回のhandoff作成はdocumentationとscope allowlist maintenanceだけで、gameplay/score/difficulty/content/runtime schemaを変更していない。

## 4. Remaining Blockers

1. Desktop、390 × 844、844 × 390のreal browser smoke evidenceがない。
2. Actual Japanese IME、soft keyboard、computed touch/overflowが未認証。
3. Console/network/performance/repeated real lifecycleが未認証。
4. Human editorial decisionsが0/24。
5. `以下`、`位置`、`結果`がREVISEで、2文字hint policy未決定。
6. Real UXを含むadult internal QAが未完。

## 5. Browser QA Package

`YOMITABI_KANJI_DEFENSE_BROWSER_QA_HANDOFF.md`にenvironment record、required viewport matrix、smoke flow、10 IME races、soft-keyboard/layout、computed touch/overflow、3-Monster readability、focus/pause/visibility、reduced motion/image failure、runtime/network/scheduler/performance、10-cycle、screenshots、issue template、final decisionを統合した。

Required screenshotsはfirst Monster、first wrong/retry、three Monsters、portrait soft keyboard、landscape、result。各結果はPASS / MINOR / BLOCKER / NOT RUNで記録する。

## 6. Content Review Package

`YOMITABI_KANJI_DEFENSE_HUMAN_CONTENT_REVIEW_PACK.md`は製品sourceから転記した24語すべてについてPrompt、Accepted Reading、Focus Kanji/source ID、Meaning、Hint、Grade Fit、Naturalness、Ambiguity、Decision、Comment欄を持つ。

既存pre-review判断を人間決定と混同せず、3 REVISE語をhighlightした。Child test条件は同一versionで16語以上のhuman APPROVE。理想はcorrectness reviewerとblind ambiguity reviewerの二段階である。

## 7. Reviewer Instructions

`YOMITABI_KANJI_DEFENSE_CONTENT_REVIEWER_INSTRUCTIONS.md`は非エンジニア向けに、ゲーム概要、reading/grade burden/naturalness/ambiguity/meaning/hint/tone基準、4 decision、3語の注意点、2文字hint policy、提出条件を1ページ相当にまとめた。ReviewerにcodeやContract理解を要求しない。

## 8. Browser Tester Instructions

`YOMITABI_KANJI_DEFENSE_BROWSER_TESTER_INSTRUCTIONS.md`は起動、required devices、smoke path、IME/soft keyboard、computed layout、runtime、10-cycle、screenshots、blocker、報告方法を短くまとめた。Browser Testerへ教材correctness判断を要求しない。

## 9. Go / No-Go Logic

`YOMITABI_KANJI_DEFENSE_PLAYTEST_GO_NO_GO.md`はArchitecture、required browser viewports、Actual IME、soft keyboard、runtime errors、16+ Content、Human Review、Protocol、Safetyを独立gateにした。

全required gateが証拠付きPASSの場合だけ`READY FOR CHILD PLAYTEST`。Browser unknown、IME unknown、human reviewなしでのconditional GOは禁止。一つでもcritical gateがNOT RUN / INCOMPLETE / FAILなら`CHILD PLAYTEST NOT AUTHORIZED`。

## 10. Fix Policy

許可するのは認証blockerに直結する最小fixだけ: CSS overflow/touch target、IME gate、focus、short-reading hint、meaning wording、accepted reading。Boss、new score、new content expansion、reward、gameplay redesign、persistence、audio framework、Contract/Event変更は禁止。

IssueはID、environment/content version、steps/current text、expected、actual、severity/decision、evidence、ownerを持たせる。BrowserとContentを同じissue ownerへ混ぜない。

## 11. Re-certification Rule

修正後は以下をすべて実施する。

1. Relevant dedicated test。
2. Full serialized regression。
3. Production buildとstage integrity/diff check。
4. Failed browser caseを同environmentで再実行。
5. Relevant content itemを人間reviewerが再判定。
6. Go / No-Go票のbuild/content versionとevidence pathを更新。

修正によってbuild identityが変わった場合、影響範囲に応じてsmoke flowを再実施し、旧evidenceを新buildへ無条件転用しない。

## 12. Execution Order

1. Browser QAとHuman Content Reviewを並列開始。
2. 各担当がevidence付きfinal decisionを返す。
3. EngineeringがBLOCKER/REVISEだけを最小修正。
4. Regression/buildと該当case/itemを再認証。
5. Release QAがGo / No-Goを更新。
6. 全gate PASS後、Playtest Coordinatorがadult internal QAを確認してchild sessionをauthorizeする。

## 13. Ownership Matrix

| Owner | Accountable for | Must not certify |
| --- | --- | --- |
| Engineering | architecture、minimal fix、regression/build | human content、missing browser result |
| Browser QA | runtime/device/IME/layout/performance | content correctness |
| Human Content Reviewer | reading/grade/meaning/hint/ambiguity | runtime/browser |
| Release QA | evidence completeness、Go / No-Go | unknownを推定PASS |
| Playtest Facilitator | consent/assent、safety stop、metrics/privacy | release gate override |

## 14. Child Playtest Preconditions

- Browser required matrixとActual IME/soft keyboard PASS。
- Runtime blocker 0。
- Human APPROVE 16語以上、reviewer/date/content versionあり。
- 3 REVISE語を承認subsetへ入れる場合は修正後再review済み。
- Adult internal QA最低1 round。
- Anonymous ID、guardian consent、child assent、no raw typed strings、recording default off。
- Stop criteriaとfacilitator確定。

## 15. Known Risks

- Typing biasは子どもで未測定。参加者の25%以上で口頭正解なのに入力前escapeが複数回ならmechanical tuning必須。
- 3体時strategy/readabilityとsoft-keyboard layoutは未観察。
- Actual IMEのtarget/pause/Back raceは未観察。
- 21 pre-approved itemsもhuman-certifiedではない。
- Browser CONDITIONAL PASSのminorがmeasurementを歪める可能性はRelease QAが個別判断する。

## 16. Final Handoff Status

- A Architectureは再実装不要か: **YES**。現証拠を維持し、fix時のみ回帰確認する。
- B Browser QA packageは別環境へ渡せるか: **YES**。
- C Human content review packageは非エンジニアへ渡せるか: **YES**。
- D 24語全部にreview rowがあるか: **YES**。
- E 3 REVISE itemが明示されているか: **YES**（以下、位置、結果）。
- F 2文字hint policyがreview対象か: **YES**。
- G Browser blocker criteriaは明確か: **YES**。
- H Go / No-Go条件は曖昧でないか: **YES**。critical unknownはNO-GO。
- I Child playtest条件は明確か: **YES**。
- J 現在child playtestを開始してよいか: **NO**。

`BROWSER QA HANDOFF READY`

`HUMAN CONTENT REVIEW PACK READY`

`CHILD PLAYTEST PROTOCOL READY`

`CHILD PLAYTEST NOT AUTHORIZED`
