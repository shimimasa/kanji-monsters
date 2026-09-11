# YOMITABI MINIGAME-04 Sentence Order Probe Report

Date: 2026-09-11 (Asia/Tokyo)

## 1. Executive Summary

第四の Technical Probe `sentenceOrder`（表示名「文ならべ」）を、MiniGame Platform Contract v1 を変更せずに実装した。3〜6個の文節を複数回並べ替え、Submit時だけ1回のattemptをconsumeする10問sessionが、既存Hostのgeneric `dispatch({ type, payload })`、既存LearningEvent 4 types、既存Companion/Collection、既存View return shapeの上で成立した。

Coreは回答順をchunk ID列として保持し、DOMをsource of truthにしていない。`reorder`は採点・LearningEvent・attempt消費を起こさず、`submit`だけがidentity validation、attempt consume、score commit、LearningEvent通知を順に行う。Stable Host、Contract文書、Companion、Collection、既存3 View、numeric helper、save、main lifecycle、battle、Motion、package/lockの変更は0である。

分離実行した既存435 testsとMINIGAME-04の27 testsは合計462 PASS、fail/cancelled/skipped/todoは0。integrityとproduction buildもPASSした。実ブラウザーQAは実行環境に利用可能なbrowser bindingがなく未実施であり、Browser PASSとは評価していない。操作/lifecycle/layoutの主要条件はDOM統合テストと静的scope testで検証した。

## 2. Git / checkpoint

| 項目 | 値 |
|---|---|
| HEAD / parent checkpoint | `ca1d1c31648d9c020f2215bf0f4325022e4656f8` |
| tag | `yomitabi-minigame-contract-v1-checkpoint-2026-09` |
| branch | `experiment/minigame-english-choice-probe` |
| worktree | `C:/kanji-game-latest/artifacts/minigame-03/worktree` |
| 開始時状態 | MINIGAME-03が未commit。依頼どおり既存変更を保全 |
| commit / push / tag / merge | 0 |

トップレベル`main` worktreeは別に存在し、既存の未追跡レポート群とFirebase cache変更があった。今回それらには触れていない。MINIGAME-04はMINIGAME-03の実体がある専用worktreeへ積み上げた。

## 3. Files changed

MINIGAME-04 product additions:

- `src/minigames/sentenceOrder/sentenceOrderQuestions.js`
- `src/minigames/sentenceOrder/sentenceOrderGame.js`
- `src/minigames/sentenceOrder/sentenceOrderView.js`

Product integration changes:

- `src/minigames/registry.js`
- `src/screens/titleScreen.js`

New verification/report files:

- `tests/minigame-04/core.test.mjs`
- `tests/minigame-04/lifecycle.test.mjs`
- `tests/minigame-04/scope.test.mjs`
- `tests/minigame-04/scope-contract.mjs`
- `YOMITABI_MINIGAME_04_SENTENCE_ORDER_PROBE_REPORT.md`

Strengthened existing assertions/allowlists:

- `tests/minigame-01/scope-contract.mjs`
- `tests/minigame-02/core.test.mjs`
- `tests/minigame-02/scope-contract.mjs`
- `tests/minigame-02/scope.test.mjs`
- `tests/minigame-03/core.test.mjs`
- `tests/minigame-03/scope.test.mjs`
- `tests/minigame-contract-v1/contract.test.mjs`
- `tests/minigame-contract-v1/host.test.mjs`
- `tests/minigame-contract-v1/scope.test.mjs`
- `tests/motion-02/scope-audit.mjs`

assert削除、skip、todo、dependency追加はない。

## 4. Contract v1 compliance

Definitionは既存どおり`id/title/create/createView`の4 fields。Instanceは`enter/update/setPaused/snapshot/dispatch/exit`を実装する。View return shapeは`root/update/stopInput/dispose`とoptional `canvas`だけである。

Hostはbyte変更0で、commandを`current.dispatch(command)`へ渡し、accepted時に`update(0)`を1回呼ぶ既存動作のまま。`sentenceOrder`、command type、game固有stateをHostは認識しない。

## 5. Sentence Order Core

session-local stateは`sessionId/questions/index/problem/attemptId/currentOrder/phase/answered/correct/incorrect/result/lastAnswer`と既存Contract用の`seq/activeElapsedMs/paused/active/aborted`。phaseは`ready/answering/feedback/completed`。

`currentOrder`はfreezeされたchunk ID列であり、reorderごとに新しい配列をcommitする。採点対象はDOM順や表示textではなくこのID列である。10問目で`{ answered, correct, incorrect, accuracy }`を一度だけfreezeする。

## 6. Question model

各問題は`problemId/fixtureId/prompt/chunks/correctOrder/initialOrder/skillId`を持つ。chunkは`chunkId/text`を分離し、正解判定はID sequenceで行うため、将来同じtextが複数あってもidentityが衝突しない。

repo内の`src/public/docs`をsentence/例文/短文/文節/license観点で調査したが、出典・再利用条件まで確認できるsentence-order datasetは見つからなかった。このため外部教材をコピーせず、小学校高学年程度を想定した自作短文20問をprobe fixtureとして追加した。全問3〜6 chunks、固有作品・固有名詞に依存しない。正式教材、学年別curriculum、SRSではない。

Host注入randomを使う有限Fisher-Yatesで出題10問と初期順を生成する。同じsessionId/random列で再現可能。同一順になった場合だけ追加randomを消費せず1回rotateし、初期状態が正解になることを防ぐ。retry loopはない。

## 7. Reorder interaction

操作はdrag-and-dropではなく、chunk選択後の「左へ」「右へ」。mouse/touchはnative button、keyboardは左右矢印で選択chunkを移動する。主要buttonはCSSでmin-width/min-height 44px。chunk selectionはView-localだが、回答順は必ずCore-localである。

左右矢印は有効な移動がacceptedされた時だけbrowser defaultをpreventする。Enterは回答中のSubmitに割り当て、Back/Next/Replayにfocusがある場合は各button本来の動作を優先する。repeat、IME composing、Alt/Ctrl/Meta併用は無視する。

## 8. dispatch

game-local provisional commandsは次の3つ。

- `reorder`: `sessionId/problemId/attemptId/chunkId/direction`
- `submit`: `sessionId/problemId/attemptId`
- `next`: `sessionId/problemId`

Sentence ViewはHostから既に渡される`dispatch`を直接呼ぶ。Registry adapterや共通command vocabularyは追加していない。unknown/malformed commandは`false`。

## 9. LearningEvent

使用typeは既存の`problemPresented/correct/incorrect/sessionComplete`のみ。envelopeは`version/gameId/sessionId/seq/type/problemId/activeElapsedMs/payload`のまま。

`reorder`はLearningEventを発生させない。Submit event payloadだけに`attemptId/skillId/submittedOrder/correctOrder`を置く。attemptを先にconsumeし、score/lastAnswer/resultをcommitしてから通知する。observerのthrow、false return、rejected Promise、state read、reentrant dispatchで進行は戻らず重複もしない。

## 10. Companion

`companionAdapter.js`はbyte変更0。既存mappingのまま、owned時は`problemPresented -> idle`、`correct -> attack`、`incorrect -> idle`、`sessionComplete -> idle`。unowned時はCompanionなし。Sentence専用Companion/Motionコードは0。

pending/failure imageとreduced motionでも回答、Next、result、replayは進むことをDOM lifecycle testで確認した。

## 11. Collection

`collectionAdapter.js`はbyte変更0。Core/ViewからStorageへアクセスせず、Hostの既存read-only collection選択だけを使う。新key/schema、国語progress、score、SRS、XP、level、badge、rankingの永続化は0。session前後のgameState/Storage完全一致とwrite/delete 0をテストした。

## 12. View

既存View contractだけで、問題、順序、chunk選択、左右操作、feedback、正解文、Next、Companion、result、replay、backをDOM描画する。通常の誤答feedbackと、10問目誤答時のresult内feedbackの双方で正解順を表示する。

rootはscroll可能でmax-widthを持ち、portrait/landscape media ruleを持つ。focus-visibleを明示し、並べ替え後は選択chunkへfocusを戻す。独自animationはないためreduced motionで機能停止しない。

## 13. Pause

Hostのvisibility/manual external pause OR合成を変更していない。Coreはpause中の`reorder/submit/next`を拒否し、`activeElapsedMs`を加算しない。Viewもbuttonsとkeyboard pathを拒否する。片方だけresumeしてももう片方が残ればpausedのままであることを統合テストした。

## 14. Result

game-local resultは`{ answered, correct, incorrect, accuracy }`だけ。10問目で一度だけimmutableに固定し、同じreferenceを返す。共通MiniGameResult wrapperは追加していない。

## 15. Lifecycle

Host既存順序の`stopInput -> valid=false -> Core exit -> Companion dispose -> Host listener cleanup -> View dispose`を再利用。session/problem/attempt gatesが、旧session、前問、旧attempt、double Submit、replay前callback、exit後callback、late keyboard、disposed View callbackをCoreで拒否する。

10回のenter/exitでDOM、listener、Companion ref、game-owned RAF、intervalの残留0。Replayは新sessionId/seqで開始する。

## 16. Core isolation

Sentence CoreはDOM、window、Storage、save、gameState、battle、Motion、schedulerをimportしない。ViewもStorage/save/battle/schedulerを所有しない。package/runtime dependencyとasset追加は0。

## 17. Tests

`tests/minigame-04/`は27 PASS。

| file | PASS | 主な対象 |
|---|---:|---|
| `core.test.mjs` | 15 | fixture/identity/seed/shuffle/reorder/no-score/submit/double/stale/pause/10問/result/event/observer/exit |
| `lifecycle.test.mjs` | 7 | Registry/title/Host/UI/keyboard/pause OR/Companion/replay/cleanup/Storage/layout source |
| `scope.test.mjs` | 5 | allowlist/Stable byte protection/Host branch/numeric・scheduler・Storage非依存/protected paths |
| 合計 | 27 | fail/cancelled/skipped/todo 0 |

## 18. Existing regression

全suiteはworker間の干渉を避けて分離・順次実行した。

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
| MINIGAME-03 | 21 |
| 既存合計 | 435 |
| MINIGAME-04 | 27 |
| 全合計 | 462 |

fail 0 / cancelled 0 / skipped 0 / todo 0。

事前監査で`node --test` auto-discoveryを全ファイル同時実行した際、`phase-b/audio-lifecycle.test.mjs` workerに`Unable to deserialize cloned data`が1回発生した。該当suite単独および最終の全suite分離実行では再現せず22/22 PASSで、製品assert failureではなくNode test runnerの同時worker通信失敗と判定した。テスト削除・skip・製品変更は行っていない。

## 19. Build / bundle

`node scripts/verify_stage_id_integrity.mjs`: oldIdHits 0、referenced subset PASS。

`npm.cmd run build`: Vite 5.4.19、113 modules、PASS。既存のCJS API、static/dynamic import、500 kB超chunk warningは残るがbuild error 0。

| disk bytes / local gzip | MINIGAME-03 | MINIGAME-04 | 増分 |
|---|---:|---:|---:|
| main JS | 602,000 | 616,764 | +14,764 |
| main gzip | 172,197 | 176,337 | +4,140 |
| all JS | 613,417 | 628,181 | +14,764 |
| all JS gzip | 176,615 | 180,752 | +4,137 |
| CSS | 48,657 | 48,657 | 0 |

main JS SHA-256は`565DF87C0DFCCD91EAC58ECDA385BFC95D1467A79CA845064061F355300CB7CB`。新dependency、package/lock差分は0。

## 20. Browser QA

Vite local serverは`http://127.0.0.1:4174/`で正常起動したが、Browser runtimeの自動選択は`No browser is available`、利用可能browser一覧は空だった。このため実ブラウザーによるvisual/interactive QAは0 checksで、PASSとは記録しない。ユーザーsave/profileやStorageは開いていない。

製品変更で接続問題を回避せず、次を自動テストで代替確認した。

- title/Registry入口、reorder、correct/incorrect、feedback、Next、10問、result、replay、exit
- owned/unowned Companion、image pending/failure、reduced motion
- keyboard、repeat、double Submit、stale callback、disposed callback
- manual/visibility pause OR、active time freeze
- 10 enter/exit、DOM/listener/Companion cleanup、Storage isolation
- CSS 44px target、scroll root、portrait/landscape media rule、focus-visible、animation非依存
- game-owned RAF 0、continuous interval 0、Host accepted command後update 1回（Contract test）

実ブラウザーでのみ確定できる390x844/844x390のcomputed overflow、computed target size、touch emulation、runtime exception/long task/Host timing、実画像描画は未検証。browser bindingがある環境で再実施する余地を残す。

## 21. Stable Contract evaluation

| 問い | 判定 |
|---|---|
| A. Stable Contract変更0で成立したか？ | **YES** |
| B. Host gameId分岐0か？ | **YES**。Host byte変更0 |
| C. LearningEvent変更0か？ | **YES**。envelope/type意味変更0 |
| D. Companion変更0か？ | **YES**。adapter byte変更0 |
| E. Collection変更0か？ | **YES**。adapter byte変更0 |
| F. 途中操作をgame-local state/commandだけで処理できたか？ | **YES** |
| G. 複数操作Submit型gameをdispatchで自然に扱えたか？ | **YES** |
| H. View contractは十分だったか？ | **YES** |
| I. 共通command abstractionは必要だったか？ | **NO** |
| J. MiniGameResult wrapperは必要だったか？ | **NO** |
| K. Contract v1は「一入力即採点」のゲーム専用ではないと言えるか？ | **YES**。このprobe範囲で実証 |

## 22. Provisional findings

`reorder/submit/next` command名、payload shape、Viewがcontext `dispatch`を直接使う方式はgame-local PROVISIONALであり、Stable vocabularyへ昇格していない。選択focusをView-localにし、学習上意味のある回答順だけCore-localにする境界は今回のbutton UIには十分だった。

途中操作を共通LearningEventへ昇格する必要はなかった。将来、操作履歴自体を分析対象にする明確な要件が出るまでは追加しない。

## 23. Cross-mechanic evaluation

MINIGAME-01の即時numeric Submit、MINIGAME-02のreal-time select/submit、MINIGAME-03の非numeric choice、MINIGAME-04のmulti-step reorder/Submitが、同じDefinition、instance lifecycle、Host、generic dispatch、LearningEvent、pause、Companion、Collection、cleanup境界で成立した。

したがってMINIGAME-03のCROSS-SUBJECT CONTRACTに加え、回答状態を複数操作で構築して最後に確定するMULTI-STEP INTERACTION CONTRACTが実証された。

## 24. Known limitations

- 20問は自作probe fixtureであり、正式教材・複数正解分析・学年別curriculumではない。
- 操作は選択+左右移動のみ。drag-and-drop、undo/reset、音声、難易度、時間制限はない。
- 同一問題の採点attemptは1回だけで、誤答後の再回答はない。
- keyboardは左右矢印とEnterのみ。物理mobile keyboard/各OSの実機認証は未実施。
- 実ブラウザーQAはbrowser binding不在のため未実施。computed layout/touch/performanceは未認証。
- result wrapper、persistent progress、SRS、XP、ranking、Contract v2は実装していない。
- MINIGAME-03とMINIGAME-04は未commit。commit/push/tag/main mergeは行っていない。

## 25. Decision

**MINIGAME-04 Technical Probe: PASS（automated contract/build scope）。Browser visual certification: NOT RUN（environment unavailable）。**

3〜6個のchunkを複数回操作して回答状態を作り、Submitで一度だけ採点する国語ゲームは、Stable Contract / Host / LearningEvent / Companion / Collectionを変更せず、game-local commands/stateだけで同じMiniGame Platform上に成立した。STOP CONDITIONに該当する変更は発生していない。

**MULTI-STEP INTERACTION CONTRACT PROVEN**
