# YOMITABI MiniGame Platform Contract v1 Final Audit Report

- 監査日: 2026-09-11
- 対象worktree: `artifacts/minigame-03/worktree`
- 対象branch: `experiment/minigame-english-choice-probe`
- 監査開始時HEAD: `ca1d1c31648d9c020f2215bf0f4325022e4656f8`
基準tag: `yomitabi-minigame-contract-v1-checkpoint-2026-09`

## 1. Executive Summary

MINIGAME-01〜04の実装、Contract文書、Host、adapter、テスト、過去レポートをrepo実体から横断監査した。4つのゲームは、同一のDefinition、Instance lifecycle、View return shape、opaque dispatch、LearningEvent、pause、cleanup境界で成立している。MINIGAME-03は教科横断、MINIGAME-04は複数回の編集後に一度だけ採点する操作を、Stable Contractの変更なしで実証した。

今回、Contractの意味を拡張する製品変更、新抽象化、依存追加は行っていない。Contract文書は、実証された最小境界とgame-localな実装詳細を区別する表現に限定して明確化した。補強した回帰テストを含む463 testsは全件PASSし、stage ID integrityとproduction buildもPASSした。

Hostのルーティングとdispatchはgame-agnosticであり、`gameId`条件分岐は0である。ただしHostには互換用の既定game ID文字列 `'mathSprint'` が1箇所ある。これは分岐でもgame固有importでもないが、「Host内のgame ID literalが完全に0」という保証には含めない。

実ブラウザーは利用可能なbindingが0件だったため、Browser Certificationは実施していない。DOM/lifecycle自動テストをBrowser PASSとは表現しない。この制約は製品sourceを変更して回避していない。

## 2. Git / Workspace State

- target worktreeは専用branch `experiment/minigame-english-choice-probe`、開始時HEADは上記のContract v1 checkpointだった。
- 開始時のstaged fileは0。
- MINIGAME-03 / 04のproduct、tests、tools、各probe reportは未commitだった。
- top-level `main` worktreeにはFirebase cacheと複数artifact等の別作業が存在した。対象worktreeへ移動、コピー、削除、stageしていない。
- `reset --hard`、`clean -fd`、checkoutによる破棄、rebase、merge、pushは行っていない。
- remoteは`origin`が設定されているが、対象branchにupstreamはない。したがってcheckpointはlocal commit/tagまでとし、push対象の明示がない限りpushしない。

## 3. Audit Scope

監査対象は次のとおり。

- MINIGAME-01 `mathSprint`
- MINIGAME-02 `mathInvader`
- MINIGAME-03 `englishChoice`
- MINIGAME-04 `sentenceOrder`
- registry、title入口、`miniGameHost.js`、Contract文書
- LearningEvent、pause、identity gate、lifecycle
- Companion / Collection adapter
- result、scheduler、Storage境界
- 全既存test suite、integrity、production build
- Git差分、package/lock、protected stable files

## 4. MINIGAME-01〜04 Comparison

| 項目 | MINIGAME-01 | MINIGAME-02 | MINIGAME-03 | MINIGAME-04 |
| --- | --- | --- | --- | --- |
| 教科/用途 | 算数・計算 | 算数・侵入阻止 | 英語・4択 | 国語・文節順序 |
| 入力方式 | 数値入力→確定 | 対象選択＋数値入力→確定 | 選択肢回答→次へ | chunk選択・左右移動→確定→次へ |
| realtime性 | なし | あり（Host updateで進行） | なし | なし |
| multi-step操作 | なし | 選択後に回答 | なし | あり（複数reorder後にsubmit） |
| numeric helper | 所有 | 01から再利用 | 非依存 | 非依存 |
| dispatch利用 | あり | あり | あり | あり |
| commands | `submit`, `next` | `select`, `submit` | `answer`, `next` | `reorder`, `submit`, `next` |
| LearningEvent | 既存4 types | 既存4 types | 既存4 types | 既存4 types |
| View shape | 共通shape | 共通shape＋optional canvas | 共通shape | 共通shape |
| pause | Host external pause | Host external pause＋game-local simulation pause | Host external pause | Host external pause |
| Companion | 共通adapter | 共通adapter | 共通adapter | 共通adapter |
| Collection | read-only ownership | read-only ownership | read-only ownership | read-only ownership |
| result | game-local | game-local | game-local | game-local |
| lifecycle | 共通Instance lifecycle | 共通Instance lifecycle | 共通Instance lifecycle | 共通Instance lifecycle |
| Storage write | なし | なし | なし | なし |
| game-owned RAF | なし | なし | なし | なし |

共通して必要だったのは、定義登録、lifecycle、opaque dispatch、snapshot描画、pause、LearningEvent、cleanupである。command名、payload、snapshot fields、result、fixture、入力UIはgame固有だった。

## 5. Contract v1 Stable Surface

現在の複数gameとテストから、追加gameが依存してよい最小Stable surfaceを次のように再構成した。

1. Definitionは`id`, `title`, `create`, `createView`を提供する。
2. Instanceは`enter`, `update`, `setPaused`, `snapshot`, `dispatch`, `exit`を提供する。
3. Viewは`root`, `update`, `stopInput`, `dispose`とoptional `canvas`を返す。
4. Hostはcommand objectを解釈せず、current instanceへ渡す。
5. `dispatch`のaccept/rejectはbooleanで表し、accept時はHostが同期的にviewを更新する。
6. LearningEventは固定envelopeと既存4 typesを用い、状態commit後に通知する。
7. external pause、終了、cleanup、stale input拒否のsemanticsを守る。

個別methodの戻り値（`dispatch`以外）、snapshot shape、command vocabulary、payload、View callback名、result schemaはStable surfaceではない。

## 6. Definition Contract

4 definitionsはいずれも`id`, `title`, `create`, `createView`で成立し、registryからHostへ渡される。field追加は不要だった。registryの「現在exactly 4 entries」はcheckpoint回帰条件であり、Contractが4 gameを上限とする意味ではない。

## 7. Instance Contract

4 instancesはいずれも次を実装する。

- `enter`: session開始
- `update`: Host deltaによる進行
- `setPaused`: external pause状態の反映
- `snapshot`: side-effectなしの表示用状態取得
- `dispatch`: opaque commandの検証・適用とaccept/reject
- `exit`: session無効化と終了

semanticsは一貫している。ただし、たとえばMINIGAME-01の`enter`は値を返さず、他gameは`true`を返す。このため`dispatch` boolean以外の戻り値を共通仕様にはしない。snapshot fieldsもgame-localである。

## 8. View Contract

4 Viewは`root`, `update`, `stopInput`, `dispose`を返し、MINIGAME-02のみ必要に応じて`canvas`を返す。MINIGAME-04の複数操作UIもこのshape内で成立した。新しいView abstractionは不要である。

StableなのはHostが利用するreturn shapeとcleanup semanticsであり、`onAnswer`、`onReorder`相当の内部callback名、DOM構造、keyboard割当、CSS classはStableではない。

## 9. Dispatch Contract

Stableと判断できるのは、Hostがopaqueなcommand objectを`current.dispatch(command)`へgenericに渡し、`true`なら`host.update(0)`で同期描画することまでである。

Hostにcommand typeの`if`/`switch`はなく、MINIGAME-03の`answer`とMINIGAME-04の`reorder`/`submit`/`next`を理解していない。command名とpayload shapeはGAME-LOCAL / PROVISIONALのままとする。共通command vocabularyやmiddlewareは不要だった。

## 10. LearningEvent Contract

4 gameすべてが次の4 typesだけで成立した。

- `problemPresented`
- `correct`
- `incorrect`
- `sessionComplete`

新typeを要求したprobeはない。MINIGAME-04の途中reorderもLearningEventへ昇格せず、submit時だけ正誤を通知した。

Stable envelopeは`version`, `gameId`, `sessionId`, `seq`, `type`, `problemId`, `activeElapsedMs`, `payload`で維持されている。`sessionId + seq`がsession内event identityとなり、`seq`は1から単調増加する。payload内部のgame固有情報はStable schemaではない。

各gameはattempt/result/score等の状態をcommitしてからeventをobserverへ渡す。observerによるthrow、Promise返却、任意戻り値、reentrant dispatch、snapshot参照がCore進行を壊さないことをテストしている。

`activeElapsedMs`はHostから供給されたactive sessionの経過であり、external pause、ready前、completed後には増加しない。MINIGAME-02のgame-localなsimulation停止はexternal pauseとは別概念であり、Stable pause semanticへ昇格しない。

## 11. Pause Contract

manual external pauseとvisibility pauseはHostで別々に保持され、OR合成された結果だけを`setPaused(boolean)`へ渡す。一方だけresumeしても他方が残れば再開しない。pause中はgame Coreが入力を拒否し、`activeElapsedMs`は増加しない。View disabledだけを防御境界にしていない。

game内部のfeedback待ちやsimulation停止はGAME-LOCALであり、共通pause abstractionには含めない。

## 12. Identity / Stale Input

Stableなsemantic requirementは、「Coreが現在のsession/problem/attempt等とcommandを照合し、stale、invalid、replayed、既にconsume済みの入力を拒否する」ことである。

MINIGAME-03 / 04は`sessionId`, `problemId`, `attemptId`を用い、MINIGAME-01 / 02には各ゲームに適したtokenやentity identityがある。全gameへ特定の3 field名を義務づける根拠はないため、field名とpayload配置はGAME-LOCAL / PROVISIONALに残す。

## 13. Lifecycle

Hostの終了責務は、入力停止、session callback無効化、Core exit、Companion dispose、Host listener cleanup、View disposeの順に実行される。DOMとlistenerはViewが所有範囲をcleanupする。replayは新session identityで再開始し、旧callbackを拒否する。

Stableなのは、exit開始後に入力/eventが進行へ影響せず、owned resourceとlistener/DOMが解放され、repeated enter/exitとreplayが安全であること。その具体的関数名や内部配列はimplementation detailである。

## 14. Companion

`companionAdapter.js`は基準checkpointからbyte差分0で、gameId branchはない。既存LearningEvent mappingだけを使い、`correct`でattack、他の既存eventで既存idle表現を行う。owned時だけ表示し、unowned時はCompanionなしでgameが進行する。

画像pending/failureやreduced motionはgame stateをblockしない。Companionは表示側のoptional consumerであり、game correctnessやlifecycleの前提ではない。現在のselected companion/default選択policyはPROVISIONALであり、MiniGame Contractへ昇格させない。

## 15. Collection

`collectionAdapter.js`は基準checkpointからbyte差分0で、ownership参照に限定される。Core/ViewからStorageへの直接write、新save key、schema変更、score/progress永続化、selected companion policy変更はない。

Stable境界は「gameがCollection ownershipを変更せず、adapter越しのread-only情報にだけ依存できる」ことである。保存schemaや内部pathはMiniGame Contractではない。

## 16. Result

result shapeはgameごとに異なる。Hostはそのshapeを解釈せず、各Viewがgame-local snapshot/resultを描画する。共通wrapperが必要だった実例、共通永続化consumer、2 game以上の共通integration需要は存在しない。

したがってMiniGameResult wrapperはContract v1 Stableには含めず、現時点ではNOT NEEDEDとする。各result schemaとfreeze方法はGAME-LOCALである。

## 17. Scheduler / RAF

全gameにgame-owned RAF、`setInterval`、continuous timerはない。realtimeなMINIGAME-02もmain RAF→Host update→Instance updateで成立した。現在のv1 architectureでは、gameはcontinuous schedulerを別所有せずHost updateを使う。

これは現checkpointのarchitecture constraintであり、将来の全gameに独自schedulerを永久禁止する一般論ではない。独自schedulerが不可避なmechanicが複数gameで実証された場合はv2 triggerになり得る。

## 18. Stable / Provisional Matrix

| Surface | Status | Evidence | Rationale |
| --- | --- | --- | --- |
| Definition `id/title/create/createView` | STABLE | 01〜04 | 全gameとregistry/Hostで共通 |
| Instance lifecycle method set | STABLE | 01〜04 | 全gameが同一Host lifecycleで成立 |
| `dispatch` boolean acceptance | STABLE | 01〜04 | Host同期updateの唯一の共通信号 |
| その他method return value | PROVISIONAL | 01〜04差異 | Hostは値へ依存しない |
| side-effect-free `snapshot()` | STABLE | 01〜04 | Core/View分離に共通 |
| snapshot fields | GAME-LOCAL | 各game | mechanicごとに異なる |
| View return shape | STABLE | 01〜04 | `root/update/stopInput/dispose`, optional `canvas`で成立 |
| View callback/DOM/keyboard | PROVISIONAL | 各game | Host公開境界ではない |
| opaque dispatch routing | STABLE | 01〜04 | Host command knowledge 0 |
| command names | GAME-LOCAL | 各game | 共通語彙の実需要なし |
| command payload schemas | PROVISIONAL | 各game | identityと操作内容が異なる |
| accepted dispatch後の同期update | STABLE | Host＋01〜04 | UI一貫性を共通保証 |
| LearningEvent envelope | STABLE | 01〜04 | byte/contract testで保護 |
| LearningEvent 4 typesと意味 | STABLE | 01〜04 | 追加type不要で成立 |
| event payload内部 | GAME-LOCAL | 各game | consumer共通schemaの実需要なし |
| commit-before-event / observer isolation | STABLE | 01〜04 tests | observerからCore進行を隔離 |
| seq/session event identity | STABLE | 01〜04 tests | 順序とsession境界を共通保証 |
| external pause OR semantics | STABLE | Host＋01〜04 | visibility/manual合成を共通保証 |
| command identity field名 | GAME-LOCAL | 01〜04差異 | semanticは共通、表現は固有 |
| stale/invalid/replayed input拒否 | STABLE | 01〜04 tests | UI disabledに依存しないCore防御 |
| cleanup/replay semantics | STABLE | 01〜04 lifecycle | resourceと旧callbackを隔離 |
| Companion event mapping/display-only | STABLE | adapter＋01〜04 | game固有分岐なし |
| selected companion policy | PROVISIONAL | 現adapter | MiniGame追加者の契約ではない |
| Collection read-only boundary | STABLE | adapter＋scope tests | gameから保存状態を変更しない |
| game-local result shapes | GAME-LOCAL | 01〜04 | Host consumerなし |
| MiniGameResult wrapper | NOT NEEDED | 01〜04 | 共通需要なし |
| persistent result/progress | DEFERRED | scope | 今回のContract外 |
| Host/main update scheduler | STABLE | 01〜04 | realtime gameを含め成立 |
| game-owned continuous scheduler | DEFERRED | 01〜04で不要 | 将来mechanicの実証待ち |
| registry exact 4 count | CHECKPOINT INVARIANT | tests | v1のgame数上限ではない |
| Host default game literal | PROVISIONAL / LEGACY | Host | 分岐ではないが完全なID知識0ではない |

## 19. Explicit Non-Stable Items

次は意図的にStableへ昇格しない。

- `answer`, `select`, `reorder`, `submit`, `next`等の個別command名
- command payloadとView callbackのfield/name
- `sessionId`, `problemId`, `attemptId`, token, enemyId等の具体的identity表現
- snapshot、state、fixture、question/chunkのfield名
- game-local result schema
- DOM構造、CSS、keyboard bindings、drag/pointer convention
- numeric submission helper
- selected companion/default companion policy
- result/score/progress persistence、save schema
- SRS、curriculum、XP、level、badge、rank、party
- async content policy、partial credit、独自scheduler

Stableに含めないことは欠落ではなく、未実証の共通化を避ける設計判断である。

## 20. Contract Documentation Audit

`src/minigames/README.md`は実装と概ね一致していた。今回、Stable semanticsを変更せず、次だけを明確化した。

- Instanceで共通なのはmethod存在、side-effect、`dispatch` boolean semanticsであり、snapshot fieldsと他の戻り値はgame-local。
- commandの具体的identity fieldはgame-localだが、Coreでstale/invalid/replayed/consumed入力を拒否するsemanticは共通。
- event identityは`sessionId + seq`。
- gameは別schedulerを所有せずHost updateを使う現v1境界。
- command/payload/callback/snapshot/result schemaはPROVISIONAL / GAME-LOCAL。

文書hashをMINIGAME-03 / 04 scope testで固定し、Stable意味の偶発変更を検出する。新requirementやfieldは追加していない。

## 21. Test Regression

現在のrepoから列挙した全suiteを実行した。結果は次のとおり。

| Suite | PASS |
| --- | ---: |
| phase-a | 86 |
| phase-b | 22 |
| phase-c | 17 |
| no-go | 143 |
| motion-01 | 39 |
| motion-02 | 32 |
| minigame-01 | 34 |
| minigame-02 | 26 |
| minigame-contract-v1 | 16 |
| minigame-03 | 21 |
| minigame-04 | 27 |
| **Total** | **463** |

`fail 0 / cancelled 0 / skipped 0 / todo 0`。以前の462は、今回追加したContract文書境界test 1件より前の値であり、現在のsource of truthは463である。既存assertの削除、skip/todo化、弱体化は行っていない。

補強内容は、4 definitions exact registry、Hostのgame/command固有分岐なし、legacy default literalが1箇所だけであること、Contract文書がcommand identity/snapshot/payload/resultをStableへ誤昇格させないこと、文書hash保護である。

## 22. Browser Certification

Browser skillの手順に従い、local Vite serverを隔離portで起動して利用可能browser runtimeを確認した。しかしbrowser一覧は空で、URLへのruntime selectionは`No browser is available`となった。serverは確認後に停止した。

したがって以下の実ブラウザー項目は今回NOT RUNである。

- portrait/landscape visual layout、computed overflow、computed 44px touch target
- 実browserでのkeyboard、visibility pause、image failure、reduced motion
- 実browserでのreplay/exit/repeated lifecycle、runtime exception、external request、RAF/interval観測

同等のCore/DOM/lifecycle自動テストはPASSしているが、Browser PASSまたはvisual certificationとは呼ばない。製品sourceを変更して環境制約を回避していない。

## 23. Integrity / Build / Bundle

- stage ID integrity: PASS（old ID hits 0、required reference subset OK）
- `git diff --check`: PASS（内容error 0。環境由来のLF/CRLF warningのみ）
- protected stable files: 基準checkpointから差分0
- package manifest / lock: 差分0
- runtime dependency追加: 0
- production build: PASS（Vite 5.4.19、113 modules）

build warningは既存のCJS API deprecation、static/dynamic import、500 kB超chunkでありerrorではない。

| Artifact | Current | Baseline Contract-v1 | Delta |
| --- | ---: | ---: | ---: |
| main JS | 616,764 B | 591,392 B | +25,372 B |
| main JS gzip | 176,337 B | 169,560 B | +6,777 B |
| all JS | 628,181 B | 602,809 B | +25,372 B |
| all JS gzip | 180,752 B | 173,977 B | +6,775 B |
| CSS | 48,657 B | 48,657 B | 0 B |

増分はMINIGAME-03 / 04 product codeを含む。新dependencyはない。

## 24. Diff Audit

checkpoint対象を次に分類した。

### A. Product code

- registry / title入口
- `src/minigames/englishChoice/`
- `src/minigames/sentenceOrder/`

### B. Tests

- MINIGAME-03 / 04 test suites
- registry、Host、scope、protected boundaryの既存test更新
- Contract v1 final boundary test強化

### C. Contract docs

- `src/minigames/README.md`のStable/Provisional明確化

### D. Reports

- MINIGAME-03 probe report
- MINIGAME-04 probe report
- 本final audit report

### E. Tooling

- MINIGAME-03の隔離Browser QA driver/tooling

### F. Unrelated / pre-existing changes

- top-level `main` worktreeのFirebase cache、artifact、その他未追跡report
- 他worktreeの作業

Fはcheckpointへ含めない。package/lock、Host、Companion、Collection、main lifecycle、battle、Motion stable filesは差分0である。

## 25. Git Checkpoint

監査対象の関連差分だけを明示的にstageし、local commitとlocal annotated tag `yomitabi-minigame-contract-v1-cross-mechanic-checkpoint-2026-09`で固定する。正確なcommitはこのreportを含むtag targetとしてGitで解決できる。対象branchにupstreamがなくremote destinationの明示もないためpushは実施しない。

checkpointはBrowser Certification完了を意味しない。Browser未実施はtagged reportの既知制約として残す。

## 26. Contract v2 Trigger Conditions

次のいずれかが実装上不可避になり、できれば複数gameで再現したときだけv2を検討する。

1. 現Stable surfaceだけではgameを実装できない。
2. Hostにgame固有branchまたはcommand理解が必要になる。
3. 新しい共通LearningEvent semanticが複数game/consumerで必要になる。
4. View return shape不足が複数gameで再現する。
5. 共通result integrationが2 game以上の実需要になる。
6. persistent progressへの安全な共通接続点が必要になる。
7. asynchronous gameplay/cancellationが現在のenter/update/dispatch/exitで安全に表現できない。
8. Host/main schedulerでは成立しないmechanicが実証される。

「より綺麗に見える」「将来必要そう」はtriggerにしない。

## 27. Recommended Next Probe

実装は行わず、未検証dimensionとして次を候補にする。

| Candidate | 未検証dimension | Contractへの圧力 / 得られる情報 | 主なリスク |
| --- | --- | --- | --- |
| deadline型game | 時間切れとframe遅延 | pause、active elapsed、late command、completion競合の限界 | browser timing差とflaky test |
| partial-credit組立問題 | 複数要素の部分点 | 4 event typesで成果を意味づけられるか、result共通化が本当に必要か | payload過剰化、採点仕様の複雑化 |
| async content probe | load/cancel/late completion | enter readiness、exit後callback、決定性の限界 | network非決定性、offline/security |

Browser bindingを回復して現04をvisual certificationした後に、上記を開始するのが安全である。

## 28. Known Limitations

- 実ブラウザー/visual certificationは未実施。
- Hostにはbranchではないlegacy default `'mathSprint'` literalが1箇所ある。
- 4 probesはpersistent progress、partial credit、async external contentを検証していない。
- 教材fixtureはTechnical Probe用で、正式な教材品質審査の対象外。
- bundleはContract-v1 baseline比で増加したが、予算threshold自体はContractで定義していない。
- checkpointはlocalのみでremoteへpushしていない。

## 29. Final Decision

| 問い | 判定 | 根拠 |
| --- | --- | --- |
| A. Contract v1 Stable surfaceは01〜04で一貫して成立したか | **YES** | 4 Definition/Instance/Viewと全回帰で成立 |
| B. Hostはgame-agnosticか | **YES（注記あり）** | routing/dispatch/lifecycleにgame固有挙動なし。legacy default literal 1件は既知 |
| C. Host gameId分岐は0か | **YES** | `if`/`switch`/`case`によるgameId分岐0 |
| D. opaque dispatchは複数入力方式で成立したか | **YES** | numeric、selection、choice、multi-stepで成立 |
| E. LearningEvent 4 typesは今回までのgameで十分だったか | **YES** | 01〜04で新type 0 |
| F. multi-step interactionはContract変更なしで成立したか | **YES** | 04がgame-local reorder stateで実証 |
| G. View return shapeは十分だったか | **YES** | 01〜04で追加field不要 |
| H. Companion/Collectionはgame非依存を維持したか | **YES** | adapter差分0、gameId branch 0、Storage write 0 |
| I. 共通command vocabularyは必要か | **NO** | opaque routingで全game成立 |
| J. MiniGameResult wrapperは必要か | **NO** | Host consumer/共通integration需要なし |
| K. Contract v2を今開始する必要があるか | **NO** | 現Stable surfaceの不足が実証されていない |
| L. Contract v1をcheckpoint化してよいか | **YES** | 463 tests、integrity、build、diff audit PASS |
| M. Browser certificationは完了したか | **NOT CERTIFIED / NOT RUN** | browser binding 0 |

**CONTRACT V1 FINAL AUDIT PASS**

**CROSS-SUBJECT CONTRACT PROVEN**

**MULTI-STEP INTERACTION CONTRACT PROVEN**

**CHECKPOINT READY**

**BROWSER CERTIFICATION NOT RUN**
