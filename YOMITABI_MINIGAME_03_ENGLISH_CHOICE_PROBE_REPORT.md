# YOMITABI MINIGAME-03 English Choice Probe Report

Date: 2026-09-11 (Asia/Tokyo)

## 1. Executive Summary

Contract-v1 checkpointから新しいbranch/worktreeを作り、非数値・別教科の4択game `englishChoice`をTechnical Probeとして実装した。10問、4択、正誤、feedback、Next、result、replay、exitを同じFSM MiniGame Host上で完走できる。

Stable Contract、Host、LearningEventの既存意味、Collection、Companion、main RAF、pause/lifecycle境界は変更していない。新しいgameは`dispatch({type:'answer', payload})`でchoice identityを渡し、numeric submission helperへ依存しない。既存414 testsと新規21 testsは合計435 PASS、integrity/build PASS。隔離Browser QAは79 checks PASSだった。

## 2. Git / checkpoint

| 項目 | 値 |
|---|---|
| parent commit | `ca1d1c31648d9c020f2215bf0f4325022e4656f8` |
| parent tag | `yomitabi-minigame-contract-v1-checkpoint-2026-09` |
| tag peeled commit | `ca1d1c31648d9c020f2215bf0f4325022e4656f8` |
| branch | `experiment/minigame-english-choice-probe` |
| worktree | `C:/kanji-game-latest/artifacts/minigame-03/worktree` |
| 開始時status | clean |
| commit / push / tag | 0 |

前回の`preflight-01` artifactと未実装preflight状態は基点に使っていない。main、stable、Motion、3D、MINIGAME-01、MINIGAME-02、Contract-v1 refsは変更していない。

## 3. Files changed

製品source変更:

- `src/minigames/registry.js`
- `src/screens/titleScreen.js`

製品source追加:

- `src/minigames/englishChoice/englishChoiceQuestions.js`
- `src/minigames/englishChoice/englishChoiceGame.js`
- `src/minigames/englishChoice/englishChoiceView.js`

既存test/scope監査更新:

- `tests/minigame-01/scope-contract.mjs`
- `tests/minigame-02/core.test.mjs`
- `tests/minigame-02/scope-contract.mjs`
- `tests/minigame-02/scope.test.mjs`
- `tests/minigame-contract-v1/contract.test.mjs`
- `tests/minigame-contract-v1/host.test.mjs`
- `tests/minigame-contract-v1/scope.test.mjs`
- `tests/motion-02/scope-audit.mjs`

追加test/再現tool/文書:

- `tests/minigame-03/core.test.mjs`
- `tests/minigame-03/lifecycle.test.mjs`
- `tests/minigame-03/scope.test.mjs`
- `tests/minigame-03/scope-contract.mjs`
- `tools/minigame-03/functional-qa.mjs`
- `tools/minigame-03/README.md`
- `YOMITABI_MINIGAME_03_ENGLISH_CHOICE_PROBE_REPORT.md`

`miniGameHost.js`、`src/minigames/README.md`、Collection、Companion、既存2 View、numeric input helper、FSM、package/lock、save、battle、Motion、public assetは変更していない。

## 4. Contract v1 compliance

`englishChoice` Definitionは`id/title/create/createView`の4 fieldsだけを持つ。instanceは`enter/update/setPaused/snapshot/dispatch/exit`を実装する。Hostは既存のままRegistry entryを生成し、同期dispatchが`true`を返した後だけ`update(0)`する。

Stable境界の変更は0。Contract test 15件の件数を維持し、三つのDefinition/instance/Viewと第三gameのcommit-before-eventを含むようexact assertionを更新した。assert削除、skip、todo、期待値緩和はない。

## 5. English Core

Coreはmemory sessionだけを持つ。状態は`sessionId/questions/index/problem/attemptId/phase/correct/incorrect/answered/result`と既存contract用の`seq/activeElapsedMs/paused/active/aborted`。phaseは`ready/answering/feedback/completed`。

一問のanswer受理時にattemptを先に消費し、正誤counterをcommitし、LearningEventを通知する。誤答再回答はなく、feedbackのNextで次問へ進む。10問目でimmutable resultを一度固定する。

## 6. Question model

各問題は`problemId/prompt/choices[4]/correctChoiceId/skillId`を持つ。各choiceは表示文と独立した`choiceId`を持ち、choice textをidentityに使わない。`problemId`はsessionと問題順・fixture IDから生成する。

repoのGit管理下を`english/vocab/vocabulary/word/英単語/英語/lesson/quiz`で調査したが、英語教材として再利用できるdataset、license、出典情報は見つからなかった。漢字例文中の「英語」は問題poolではない。このため、外部教材をコピーせず、自作の基礎語彙20語をprobe fixtureとして追加した。正史教材、学年別curriculum、永続教材ではない。

注入randomを使う有限Fisher-Yatesで10語を選び、各問の誤選択肢3件とchoice順を生成する。同じsessionId/seedで同じ10問・choice順になる。不正randomは最初の呼出しで例外とし、retry loopはない。

## 7. Choice input

inputは4 buttonのみ。numeric text field、数字pad、`mathSprintInput`、数値normalizeを使わない。buttonは44 CSS px以上を基準とし、click/touchとkeyboard `1`〜`4`を受ける。repeat、pause、completed、旧identityでは入力を受理しない。

double clickは一度目でattemptが消費され、Hostの同期updateでbuttonもdisabledになる。Core側のidentity gateが一次防御なので、古いcallbackを直接送っても二重採点しない。

## 8. dispatch

English固有commandは次の二つ。

- `answer`: `sessionId/problemId/attemptId/choiceId`
- `next`: `sessionId/problemId`

Registryの薄いView adapterが`onAnswer`を`dispatch({type:'answer', payload})`へ変換する。Hostはtypeを読まず、English分岐も持たない。unknown commandは`false`。Promise、queue、middleware、global busは追加していない。

## 9. LearningEvent

既存4 typesだけを使用した。

- `problemPresented`
- `correct`
- `incorrect`
- `sessionComplete`

envelopeは`version/gameId/sessionId/seq/type/problemId/activeElapsedMs/payload`のまま。English固有の`choiceId/correctChoiceId/skillId/attemptId`はpayloadに置いた。Core commit後に通知し、observerの返値、Promise、例外、reentrant dispatchは進行を変えない。10問sessionではseq 1〜21、`sessionComplete`は1回。

## 10. Companion

`companionAdapter.js`はparentとbyte一致する。owned HKD-E01では`problemPresented → idle`、`correct → attack`、`incorrect → idle`、`sessionComplete → idle`を既存mappingのまま確認した。unownedではCompanionなし。

画像pending/failure、reduced motionでも回答・score・Next・resultを止めない。English専用Motion codeは0。

## 11. Collection

`collectionAdapter.js`はparentとbyte一致する。確認済みactive saveから得た`ownedMonsterIds`だけをHostがread-onlyで使う。English Core/ViewからStorageへ直接アクセスせず、ownership書込、新key、新schema、selected companion永続化は0。

## 12. View

Viewは`root/update/stopInput/dispose`とoptional `canvas`を返す。問題、4 choices、feedback、進捗、正解数、戻る、Companion、result/replayをDOMで表示する。正誤commitとLearningEventはViewに置いていない。

既存View contractで不足はなかった。Sprint/Invader Viewの変更は0。Registry-to-View callback名`onAnswer`は既存PROVISIONAL境界内の追加であり、Stable View shapeを変更しない。

## 13. Pause

visibility/manual external pauseは変更なしのHostがOR合成し、booleanを`setPaused`へ渡す。pause中はchoice buttonとkeyboardを拒否し、active elapsedを停止する。片方のresumeで他方を解除しない。English固有simulation pauseは追加していない。

## 14. Result

game固有resultは`answered/correct/incorrect/accuracy`だけ。10問終了時にimmutable objectとして一度固定する。共通MiniGameResult wrapperは必要にならず、実装していない。ranking、best、XP、badge、persistent progressはない。

## 15. Lifecycle

Hostの既存順序どおり、stop input、session無効化、Core exit、Companion dispose、Host listener解除、View/DOM disposeを行う。Core/View exitは冪等で、旧session、旧problem、旧attempt、late button/keyboard callbackを拒否する。

10 enter/exitでDOM duplicate 0、listener 0、Companion ref 0。mini-game owned RAF 0、continuous interval 0。

## 16. Core isolation

English session前後で、playtimeを除く`gameState`とStorage全entryが一致した。Storage write/delete spyは0。漢字SRS、漢字answer stats、HP、EXP、stage progression、collection、battle Coreを変更していない。新save schema/key、runtime dependency、assetは0。

## 17. Tests

`tests/minigame-03/`は21 PASS。

| file | PASS | 主な対象 |
|---|---:|---|
| `core.test.mjs` | 11 | fixture/seed、4 choices、identity、正誤、pause、10問、event、observer、exit |
| `lifecycle.test.mjs` | 5 | 同Host、choice/keyboard、owned/unowned、pause合成、10 lifecycle、replay/isolation |
| `scope.test.mjs` | 5 | allowlist、Stable byte一致、Host分岐0、numeric/scheduler/Storage隔離、protected paths |
| 合計 | 21 | fail/cancelled/skipped/todo 0 |

## 18. Existing 414 regression

| suite | PASS |
|---|---:|
| Baseline phase-a | 86 |
| Baseline phase-b | 22 |
| Baseline phase-c | 17 |
| Baseline no-go | 143 |
| MOTION-01 | 39 |
| MOTION-02 | 32 |
| MINIGAME-01 | 34 |
| MINIGAME-02 | 26 |
| Contract-v1 | 15 |
| 既存合計 | 414 |
| MINIGAME-03 | 21 |
| 全合計 | 435 |

全suiteでfail/cancelled/skipped/todoは0。既存assertを削除・skip・todo化していない。Registry件数のexact assertionは三件へ強化し、旧二gameの存在・挙動assertを維持した。

## 19. Build / bundle

`node scripts/verify_stage_id_integrity.mjs`はoldIdHits 0、referenced subset PASS。`npm.cmd run build`はVite 5.4.19、110 modulesでPASSした。既存のCJS、static/dynamic import、500 kB超chunk警告は残るがbuild errorは0。

| disk bytes / local gzip | Contract-v1 | MINIGAME-03 | 増分 |
|---|---:|---:|---:|
| main JS | 591,392 | 602,000 | +10,608 |
| main gzip | 169,560 | 172,197 | +2,637 |
| all JS | 602,809 | 613,417 | +10,608 |
| all JS gzip | 173,977 | 176,615 | +2,638 |
| CSS | 48,657 | 48,657 | 0 |

main JS SHA-256は`c3e83f7453da64c876d26a9c3c7cc6503157a5fbff16d1cb3b5a692bbc559bb6`。新dependencyとpackage/lock差分は0。

## 20. Browser QA

認証済み架空E0 fixture `e0-cert-01 / Fresh MemoryStorage`、新規隔離headless Chrome profile、localhost Vite/CDP、外部request遮断を使用した。実ユーザーsave/profileは不使用。

最初のrunはvisibility event直前の値と比較したdriver側raceでFAILし、製品sourceを変更せずdriverの観測点をpause確定直後へ修正した。失敗runは`artifacts/minigame-03/browser-final-01/`へ保存。最終runは`browser-final-02/result.json`で79 checks PASS。

- title → English Choice → correct/incorrect → 10問 → result → replay → exit
- owned/unowned、correct attack、incorrect idle
- double click、keyboard 1〜4、repeat、pause
- 390×844 / 844×390、touch、全主要button 44px以上、横overflow 0
- 10 enter/exit、listener/DOM/Companion cleanup
- image pending/failure、late completion、reduced motion
- external/Firebase success 0、runtime exception 0
- new RAF 0、interval 0、Host update最大0.9ms

96ms/68msのlong taskを2件観測したが、Host updateは最大0.9msであり、English Core/Viewへの帰属は確認されない。物理端末・実OS keyboard認証やbenchmarkは主張しない。

## 21. Stable Contract evaluation

| 問い | 判定 |
|---|---|
| A. Stable Contract変更0で成立したか | はい |
| B. Host gameId分岐0か | はい。Host byte変更0 |
| C. LearningEvent変更0か | はい。既存envelope/4 typesの意味変更0 |
| D. Companion変更0か | はい。adapter byte変更0 |
| E. Collection変更0か | はい。adapter byte変更0 |
| F. numeric submission helper非依存か | はい。import/利用0 |
| G. dispatchでchoice inputを自然に扱えたか | はい。`answer` payloadだけで成立 |
| H. View contractは十分だったか | はい。既存return shapeで成立 |
| I. Result wrapperは必要だったか | いいえ |
| J. Platform v1が算数専用ではないか | はい。このprobe範囲で実証 |

## 22. Provisional findings

`answer` commandと`onAnswer` callbackは、command payload/View callback名をgame固有のまま追加できることを示した。共通command vocabularyへ昇格させる必要はない。randomは既存Host context注入で十分だった。MiniGameResult wrapperとselected companion policyも必要にならなかった。

これらは引き続きPROVISIONALであり、Stableへ昇格させていない。

## 23. Cross-subject evaluation

数値normalize、numeric pad、enemy/spawn/lifeを持たない英語4択でも、同じDefinition、instance lifecycle、Host、dispatch、LearningEvent、Collection、Companion、pause、cleanup、session identityが成立した。

第三game追加の製品integrationはgame Core、question fixture/generator、View、Registry entry、title入口だけ。Host/Companion/CollectionへgameId分岐は増えていない。この結果からContract v1は算数数値入力専用ではないと判断できる。

## 24. Known limitations

- 20語はprobe専用の自作fixtureで、正式教材・学年別curriculum・SRSではない。
- 音声、綴り入力、難易度、時間制限、永続progress、rankingはない。
- keyboardは`1`〜`4`だけ。物理mobile/OS支援技術の認証は未実施。
- Browser QAはheadless Chromeと合成visibilityを使う。
- 共通Result wrapper、selected companion永続policy、Contract v2は未実装。
- 本branchは未commitで、checkpoint化は別タスク。

## 25. Decision

English Choiceは、Stable Contract、Host、LearningEvent、Companion、Collectionを変更せず、numeric helperへ依存せずに同一Host上で10問を完走した。既存414 regression、新規21 tests、integrity/build、隔離Browser QA 79 checksがPASSし、STOP条件に該当する変更は発生していない。

今回の完了範囲はMINIGAME-03 Technical Probeまで。Contract v2、永続save、大量game展開、party/EXP/level、1000体、main merge、Git commit/push/tagへ進んでいない。

MINIGAME-03 PASS  CROSS-SUBJECT CONTRACT PROVEN
