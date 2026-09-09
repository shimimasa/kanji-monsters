# MOTION-02 HKD-E01 Pixel Motion Battle Integration

実施日: 2026-09-09 JST。機能接続・functional QA・回帰のみ。正式性能比較は未実施。

## 1. Executive Summary

**MOTION-02 PASS  READY FOR MOTION-02 FREEZE**。2026-09-09 scope監査再検証で判定更新。今回はfreezeを実行していない。

通常battleの `hokkaido_area1 / HKD-E01` に、既存1枚画像とMOTION-01 slime profileを接続した。実UIからidle / attack / hit / defeat、既存controllerによるE02交代、退出・再入場を確認した。Motion終了・画像readyを回答や進行の条件にしていない。

最新再検証はBaseline **268 PASS**、MOTION-01 **39 PASS**、MOTION-02 **32 PASS**、合計 **339 PASS**。FAIL / cancelled / skipped / todo全0、integrity / build PASS。旧結果は338 PASS / 1 FAILで、Standalone時の「battleScreenを含むstable全ファイル不変」というscope監査が意図した表示接続を検出したものだった。旧FAIL記録は履歴として保持する。

ユーザーが承認した新監査契約へ更新した。stable全pathの保護、承認済み9hookの内容と位置、除去後のbattle全文一致、新規ファイル18pathの明示allowlist、package/lockのbyte・SHA比較を共通helperで検査する。製品挙動変更0。製品source・asset等4,063ファイルの作業前後SHAと、前回MOTION-02のproduction JS/CSS全4ファイルのSHAが一致したため、既存headed QAを再利用する。次は別タスクのMOTION-02 freezeであり、正式性能比較の合格・開始ではない。

## 2. Git / checkpoint

| 項目 | 確認値 |
|---|---|
| Worktree | `C:/kanji-game-latest/artifacts/motion-01/worktree` |
| Branch | `experiment/2d-monster-motion` |
| HEAD | `997a08b8b7e1291901b11e279033b1d5d322eda9` |
| Checkpoint tag | `yomitabi-motion-01-checkpoint-2026-09` |
| Tag object | `ac9a8ef9f022f766bf3bebe10063981b723ab32d` |
| main / 2D stable展開先 | `2a521dd5aa747314b25e761d976bd4f880cd58c3` |
| 3D研究branch / V1a tag展開先 | `a30e5043d707e161a47c71870b0199f46159ab06` |
| V0 tag展開先 | `15ee0be672ca8ec56e773a75959ce9535877cb19` |

開始/終了でbranch、HEAD、保護refs、worktreeを確認。commit / push / tag / reset / restore / clean / stash / branch切替なし。3D worktreeの監査対象2,769ファイルも以前の保存hashと一致し、未完了V1b差分を保持。

参照: `YOMITABI_MOTION_01_GIT_FREEZE.md`、`YOMITABI_MOTION_01_TECHNICAL_SLICE_REPORT.md`、`tools/motion-01/README.md`、3D研究worktreeの `YOMITABI_MONSTER_VISUAL_STRATEGY_REASSESSMENT.md`、`YOMITABI_2D_STABLE_BASELINE.md`。前工程で全文確認済みの文書を継承し、今回のFreeze基点と実コードを照合した。

## 3. Files changed

MOTION-02製品変更は `src/screens/battleScreen.js` の **25 insertions / 1 deletion** と新bridgeで、前回からbyte変更0。今回の監査更新により既存trackedの `tests/motion-01/scope.test.mjs` も変更している。

| 追加 | 用途 |
|---|---|
| `src/visuals/battleMotionBridge.js` | battle固有action/timer/sessionを表示hostへ変換 |
| `tests/motion-02/bridge.test.mjs` | mapping、fault、sampling、canvas、lifecycle |
| `tests/motion-02/battle.test.mjs` | 実battle enter/update/exit、Core/Storage、対象制限 |
| `tests/motion-02/battle-fixture.mjs` | 既存no-go fixtureを参考にした隔離テスト環境 |
| `tests/motion-02/scope.test.mjs` | 全文/Core/依存境界の監査 |
| `tests/motion-02/battle-display-hooks.mjs` | 許可した表示hookの明示リスト |
| `tests/motion-02/scope-audit.mjs` | 両scope suiteで共有する厳密監査。今回追加 |
| `tools/motion-02/` | CDP functional QA、回帰実行、bundle audit、README |
| 本書 | 実装・検証・条件の記録 |

`src/visuals/motion/` の5ファイル、MOTION-01のpure/host tests、tools、package、画像、Coreは未変更。今回の変更は両scope.test.mjs、新scope-audit.mjs、必要なbattle test待機補助（battle-fixture.mjsとbattle.test.mjsの補助呼出し）、本書のみ。既存assertの削除・skip・todo化なし。以前の `YOMITABI_MOTION_01_GIT_FREEZE.md` は開始時からの未追跡文書として保持し、新規製品ファイルのallowlistとは別扱い。rawはroot側 `artifacts/motion-02/` に隔離しstageしていない。

製品差分SHA-256（実ファイル）:

- battleScreen: `808b34010ff9c87c29d97c538a5b1ec0a0e044a11c6cd6b3f994d38b77b1df89`
- battleMotionBridge: `627e7e1446d4e4ffb7795b7e4b2903b2e8171c2fec0a906f9d6729d94e0e406c`

## 4. Battle integration boundary

通常battle singleton、stage `hokkaido_area1`、enemy `HKD-E01` に限定。製品の通常mode実値は `jikkuri / challenge` であり、bridgeへは `normal` として渡す。practice / quickはbattleの派生objectなのでsingleton同一性で除外する。他stage・E02以降も除外。

image draw区間への接続のみ。入力DOM、画像loader、問題生成、回答受付、採点、capture、stage progressionへの新条件なし。question token / HP / EXP / save / learning objectをMotion Engineへ渡さない。

## 5. Host lifecycle

enterで旧bridgeをdisposeし、対象normal battleだけ新bridgeを作る。sessionは既存battle `_generation` を表示寿命の識別に使用。E01の画像ready後にMOTION-01 hostを所有する。E02へ変わるとhost / image / timeline / latest viewを解放。exitの先頭でdisposeして参照をnullにする。

module promiseの後着はdisposedを確認する。旧sessionが新sessionへhostや画像を渡す経路はない。moduleのブラウザーcacheと、loader所有の既存画像cacheはsession資源と区別する。

## 6. Action mapping

| battle action | Motion action |
|---|---|
| null | idle |
| attack | attack |
| damage | hit |
| defeat | defeat |

mappingはbattle bridgeだけに置く。元のdamage / attack / defeat timer設定直後で表示専用revisionを増やす。同じremaining値で同actionが再発火しても区別する。question tokenはrevisionに使わない。

## 7. Timer synchronization

実コード `src/screens/battle/theme.js`: attack **750ms**、damage **500ms**、defeat **1000ms**。変更なし。既存 `advanceTimer` の更新後にremainingを読み、`1 - remaining / duration` をsampleする。MOTION-01のkeyframeは正規化progressなので、controllerをprofileへ合わせ直す必要はない。

timer=0後にdefeat終端を保持しても、敵交代は既存controllerが行う。Motionの返り値やanimation完了を進行条件にしていない。

## 8. Idle clock

既存battle updateのdtから表示elapsedを1回進める。異常dtはfinite確認、0〜100msへ制限。presentはsampleだけで、100回呼んでもelapsed / revisionは増えない。新RAF / setInterval / setTimeout / Date.now / performance.nowをbridgeに導入していない。

製品のbattle updateは描画も含む既存構成。今回それを分割・再設計していない。MOTION-01 demoのsetIntervalは製品へimportしない。

## 9. Renderer integration

既存frame / 背景 / HP / shield / 画像背面の暗い面を維持。旧local translate/rotateの内側でbridgeがsaveし、そのlocal変換だけを逆変換して新poseを適用する。旧damage shake / attack lunge / defeat rotate/alphaをmonster画像へ二重適用しない。元のMath.random呼出し自体は残し、既存乱数列を変える整理はしていない。

画像draw **240×120**、clip **232×112**、既存alpha加工とcrop/fitを維持。MOTION-01 rendererの `save → clip/transform/draw → finally restore` とbridgeのfinally restoreで状態を閉じる。新canvasは0、既存Canvas2Dは1枚。

## 10. Legacy fallback

対象外、画像pending/failure、invalid layout、disposedはpresent=falseで元のdrawImageへ戻る。lazy host importのreject/不正exportもsession内でLegacyへ戻す。描画例外ではsessionのMotionを失効させる。

Standalone hostは例外時にneutralを再試行するため、bridgeのdraw wrapperは最初の例外を捕捉し再試行も失敗扱いにする。これにより一時的な最初のdraw失敗でも、battleでは元のLegacy drawを選ぶ。既存pure hostの挙動を変更していない。

page reload / save reset / 教材reloadをfallback処理へ追加していない。開発QAのfixture再初期化・Vite HMR reloadは検査環境の操作であり、runtime fallbackではない。

## 11. Reduced Motion

既存 `prefersReducedMotion()` が読むOS/browser media queryを値として渡す。idle / attack / hitはneutral、defeatは静的scale .35 / opacity .25。途中切替でaction revisionやprogressを巻き戻さない。unit検査とheaded Chromeのreduce media emulationを実施。

## 12. Image lifecycle

既存 `assetsLoader.loadMonsterImage`、stageLoadingによるcache、battle enterの `images[enemyId]` を維持。bridgeは渡された既存Image参照のcomplete / natural dimensionsを確認するだけで、新fetch/Image/loaderを作らない。

pending中もゲームcontrollerは進行可能。画像failureは既存Legacy/fallbackへ委ねる。late image promiseのresolve/reject、disposed後の再表示禁止はMOTION-01 host testsで維持。新bridgeでは旧sessionへの後着module、pending Imageのready化、E02交代後の解放を追加検査した。

画像SHA-256: `ee2a5e2456227d92efdf4824e7d8b17d3babd74165bd81bf70816e699155110e`。HKD-E01既存WebP以外のasset追加0。

## 13. Input / IME

headed ChromeでkanjiInput focus、compositionstart/end、composition中Enterによる回答抑止、通常Enter、mouseのattack、CDP touchのhealを確認。TabはkanjiInputから既存kanaPadToggleへ移り、Canvas tabIndex=-1。Motion input handler / DOM追加0。

touch healで回復回数が1回減り、敵HPは不変。composition中EnterでHP/EXP/正誤数は不変。プレイ時間は既存game loopに従って増えるため、停止を期待しない。

これは実browser上のDOM composition入口とCDP key/touchイベントの検査。Windows実IME候補選択・実機タッチキーボードまでを検証したとは扱わない。

## 14. Tutorial / pad

新しい架空fixtureのTutorial未読を実UIで通過し、GuideがMotionより前面にあることを確認。通常回答後、保存本体 `krb_save.meta.compatibilityEntries.tutorial_seen_battle === "1"` とambient flagの双方を確認。10往復では既読Guide再表示なし。

pad OFF/ONを既存toggleで切替。Tutorial / kanaPad / DOM layeringのソース差分0。KNOWN-2D-PAD-TUTORIALは既存問題として継承し、新Motionの不具合をそこへ分類しない。全viewport×全Guide step×pad状態の総当たりは今回のheaded証拠には含めない。

## 15. Layout

1086×723、390×844、844×390でpad OFF/ONを記録。論理Canvasは800×600、contain/黒帯は既存のまま。入力高さは通常desktop49.33 CSS px、他の記録条件48 CSS px。主要button高さは既存adaptive layoutにより約44 CSS px以上を維持。

**844×390 / pad ONには既存layout制約が残る。** Canvasが約133.33×100 CSS pxに縮み、入力上端y=-3.83、入力幅は収束後109.33 CSS pxとなる。全画面の快適な可読性合格とはしない。

同じ架空sessionでMotion bridgeだけを有効/無効にして、settled後のinput / Canvas / button全geometryが完全一致することを確認。Legacyでも再現するため、背景や画像fitを変更して解決していない。証拠 `qa-09/legacy-isolation.json` と比較画像。これは同sessionの因果分離であり、別buildでの正式性能比較ではない。

## 16. Visual QA

headed Chromeの実通常回答で4actionを確認。目、U字口、芽、裾が通常サイズと縦の小サイズで識別可能。idleは微小変形、attackは短いlunge、hitは1回の潰れ、defeatは沈み/縮小である。既存clipを越えてUIへtransformが漏れる描画は確認されなかった。

画像撮影中もゲーム時計は進む。hitの撮影完了後JSONがidleになった記録を、hit中央値の定量証拠として扱わない。画像・発生待ちの結果・timer同期unit検査を分けて読む。横画面pad ONの小さすぎる表示は§15の制約。

## 17. E01 → E02

実回答でE01を撃破し、既存controllerでE02へ移行。E02のhostCount=0、timeline=null、imageReference=falseを確認。defeat終端poseが残らない。animation完了待ちなし。

撃破後に退出すると既存checkpointからE02へ復帰する場合があることも確認。この挙動をE01へ戻す製品変更はせず、E01の10往復には別の未撃破架空fixtureを用いた。

## 18. Stage progression

enemy order、HP/ATK、capture、stageRun、stage clear、result、checkpointの既存コードを保持。stage pool / battle balance / learning outcome / lifecycle等のbaseline回帰を実行した。browserではE01→E02と退出・再入場を確認し、10体全撃破の新しいbrowser経路は実施していない。

## 19. Fault injection

| 条件 | 結果 / 検査層 |
|---|---|
| image pending / missing / failed | Legacy、controller非待機。bridge unit |
| pending Imageがreadyになる | 現在remainingから開始。新loaderなし |
| module reject / wrong export | Legacy、host失効 |
| late success / reject、old→new / new→old | old host再表示0、unit |
| E02交代後のlate module | E01復帰0 |
| double dispose / disposed present | 参照0、false |
| invalid layout / draw exception | restore、Legacy |
| 一度だけのdraw例外 | neutral retryへ逃げずLegacy、追加1件 |
| same damage再発火 / hit→defeat | revision / actionを更新 |
| defeat→enemy change | 終端pose解放 |
| resize / reduced途中切替 | progressを巻き戻さずsample |

全faultをbrowserの通信遮断で総当たりしたわけではない。決定的unit、実battle fixture、headed通常経路を分担して検証。native module promiseはキャンセル不能だが、終了後の表示権を失効させる。

## 20. 10 lifecycle loops

headed Chromeのbattle→stageSelect→battle **10往復**: 各enter hostCount=1、異なるactiveSession。各exit hostCount=0 / imageReference=false / timeline=null / activeSession=null、battle._pixelMotion=null。Tutorial再表示なし。`qa-07/lifecycle-layout.json`。

実battleをimportしたNode検査でも10往復。全exitで既存fixtureが捕捉するRAF / timeout / intervalが0。bridgeにscheduler/listener APIがないことをsource監査した。

inspectのraf/timer/listener=0は所有契約の表示であり、それだけをheap測定証拠とはしない。ブラウザー全体heap/GC、画像cache解放、性能計測は今回の判定外。

## 21. Core invariants

実gameState / battleState / Storageをsnapshotし、Motion present 0 / 1 / 100回で同じ値・Storage write増加0。別のfrozen Core sentinelも不変。対象判定・timer同期でCoreへ書き戻すAPIなし。

`battle-display-hooks.mjs` の9差分は内容を変更せず再利用し、canonical JSONのSHA-256 `118c8f0a11b40b66f6e123308e357bd7a0ce0eb0744d1ff0644a85c0db5d9ccd` を固定。checkpointの固定行境界にだけ挿入/置換を許可する。現在全文と期待全文が一致し、その9区間を除去して元のdrawImageを復元するとcheckpoint全文とLF正規化後に完全一致する。単純なsubstring除去で見逃し得たhookの移動も拒否する。

stable由来8,677 pathはbattle以外不変。checkpoint 8,693 pathはbattleと今回明示承認されたMOTION-01 scope監査ファイル以外不変。indexとworking treeの双方を比較し、rename検出を無効にして削除/改名/type変更を検出する。新規Motion-02は18個の具体的pathのみ許可し、regular fileを要求する。src/screens全体やbattle本文全体を除外しない。

negative fixtureは実製品へ書かずメモリ内で検査。余分な実行文、hook変更/削除/移動/複製、本文追加/削除の7ケース、および許可外新規pathの4ケースをすべて拒否した。既存scope test内のassertとして加えたため、MOTION-01 39件 / MOTION-02 32件を維持する。

## 22. Baseline 268

| Command | PASS | FAIL/cancelled/skipped/todo |
|---|---:|---|
| test:phase-a | 86 | 全0 |
| test:phase-b | 22 | 全0 |
| test:phase-c | 17 | 全0 |
| test:no-go | 143 | 全0 |
| 合計 | **268** | **全0** |

最新証拠: root側 `artifacts/motion-02/scope-audit-01/verification-final/` の各logと `verification.json`。以前の `verification-01/` も保持。

## 23. Motion-01 39

**最新: 39件実行、39 PASS / FAIL・cancelled・skipped・todo全0。** 既存の5つのscope testと34個のpure/host testを維持した。scopeの1件を共通helperによる新契約へ更新し、画像hash・import境界・依存監査等の他のassertを保持した。

旧FAIL: `tests/motion-01/scope.test.mjs` の `all baseline tracked source/package/assets remain unchanged`。当時の実差分は `src/screens/battleScreen.js` のみ。Standaloneという前提では正しい監査だが、実battle接続を要求するMOTION-02ではそのまま成立しなかった。実装回帰ではなく監査契約の不整合である。

前回は承認待ちとして38 PASS / 1 FAILのまま保存した。今回ユーザーが「stableのbattle以外不変、battleは承認hookだけ許可」を明示承認したため更新した。baseline比較・hash比較をやめず、§21の位置固定とnegative fixtureによって厳密化した。前回のreport全文は `scope-audit-01/report-before.md`、旧FAIL logと提案 `scope-audit-review.md` も保持。今回の39/39を過去の実行結果へ遡って適用しない。

## 24. Motion-02 tests

| Suite | PASS |
|---|---:|
| bridge.test.mjs | 24 |
| battle.test.mjs | 5 |
| scope.test.mjs | 3 |
| 合計 | **32** |

FAIL / cancelled / skipped / todo 全0。最新証拠 `scope-audit-01/verification-final/motion-02.log`。前回の `verification-01/motion-02-final.log` も保持。

今回の初回再検証で、既存10往復testが11番目のsessionのnative module promise解決前に30回の即時drainを使い切り、loading=trueで失敗した。製品のfaultではなくNode loader workerとの待機競合である。必要なtest補助だけを、ready状態を実時間上限2秒で待つ `waitForMotionReady` へ変更した。failed/disposedなら終了し、ready・参照解放・timer=0等のassertは同じ。Node timers/promisesによる待機はテスト内だけで、製品transportへ追加していない。初回FAILは `scope-audit-01/verification/motion-02.log` に保存し、訂正後に指定8コマンドすべてを再実行して339 PASSを得た。

## 25. integrity / build

`node scripts/verify_stage_id_integrity.mjs`: oldIdHits=0、stageId integrity OK。`npm.cmd run build`: PASS。package / lock変更0、依存追加0。Vite既存のstatic/dynamic import併用・500kB chunk warningを記録し、今回最適化しない。

今回も製品source変更0で指定全コマンドを実行した。git diff --checkは空（Gitの既存LF→CRLF通知を除く）。package/lockはcheckpointのcheckout byteとのBuffer比較および既存SHAを固定した比較の双方に合格。Git raw blobのLFとWindows checkoutのCRLFを混同せず、ファイルを改行変換してPASSさせる操作はしていない。

## 26. Bundle impact

MOTION-01 clean verification worktreeのdistと実bytesを比較。

| 対象 | baseline bytes / gzip | MOTION-02 bytes / gzip | 増分 |
|---|---:|---:|---:|
| main JS | 555,258 / 156,714 | 560,367 / 158,867 | **+5,109 / +2,153** |
| 新lazy host chunk | 0 / 0 | 1,908 / 1,023 | +1,908 / +1,023 |
| 全JS合計 | 566,675 / 161,131 | 573,692 / 164,307 | **+7,017 / +3,176** |

新chunk `monsterMotionHost-CWl2jxFT.js` 1つ。renderer / poseの到達部分はmainへ入り、host/timeline等は対象E01でlazy load。Tutorial chunkはmain参照hashに伴いhashが変わるがbytes/gzipは同じ。CSSはbytes/hashとも完全同一。

追加画像・GLB・texture等のNetwork assetは0。**新JS chunkの通信は1つ増える**ため「全Network request増加0」とは言わない。gzipはローカルzlib参考値でHTTP実transferではない。bundleだけで性能GOを出さない。証拠 `verification-01/bundle.json`。

今回のscope更新後buildは、上記MOTION-02出力のファイル集合・全4ファイルのSHAが完全一致。main `39b2d2da1477bf25edf04dcf8bc0a4c542fd34b469b32a6e21d002d5334f5523`、lazy host `6728cae47d9ebda642748f8f44fc0e8100a7e0a8bed659f2b85885ec064d1aff` を保持。scope監査sourceは製品bundleへ混入していない。証拠 `scope-audit-01/final-invariance.json`。

## 27. Browser functional QA

Windows / Node 22.14.0 / headed **Chrome 152.0.7977.83**。CDP機能操作、Vite localhost:49741。専用profile `artifacts/motion-02/qa-01/chrome-profile`。既存認証済み `e0-cert-01 / Fresh MemoryStorage` 由来の架空fixtureだけを使い、ユーザーsaveを読まない。

bootstrapで外部通信を拒否、以後Firebase関連domainもblock。外部gstatic SDKはresponseStatus=0、Firebase成功接続0。localhostのFirebase wrapper source配信200はクラウド成功接続に数えない。最終確認時visibility=visible、focus=true、Canvas1枚。

| 証拠 | 内容 |
|---|---|
| qa-10/route.json・functional.json・画像 | 最終sourceでtitle→stage→未読E01→既読→4action→E02 |
| qa-07/lifecycle-layout.json・画像 | 実UI10往復、3size×2pad、reduced |
| qa-08/input-isolation-failure.jsonの個別records | Tab・touch healは成立。その後のlayout比較の失敗と分離 |
| qa-09/legacy-isolation.json・比較画像 | settled後のLegacy/Motion layout完全一致 |
| qa-10/environment.json | Chrome、viewport状態、外部SDK遮断 |

Browser skillの接続bootstrapは環境のkernel assets pathエラーで利用できず、専用headed Chrome/CDPで検査した。正式benchmark・Long Task/CPU/frame測定は起動していない。

終了時に専用ChromeとVite serverを停止し、49741 / 49742の待受なしを確認。profile・raw証拠は保存した。

今回のscope監査更新ではBrowserを再起動していない。製品source/asset等4,063ファイルのSHAが作業前後不変、再buildの全JS/CSSも前回MOTION-02と一致したため、上記headed functional QAをそのまま再利用する。別clean checkoutのMotion5ファイルにはCRLF差があったが、本worktreeの5ファイルはcheckpoint raw blobとbyte一致し、製品差分の発生ではない。

## 28. Known limitations

1. 旧scope監査の前提不整合は今回解消。以下の既存UI・実機・性能上の制限は引き続き保持する。
2. 横画面pad ONの可読性制約をLegacy同等として分離。今回のMotion合格を理由に既存layout全条件合格とはしない。
3. OS実IME・実学校端末・実タッチ端末は未確認。CDP composition/touch検査と区別する。
4. 写真取得中にもtimerは進む。実時間を固定した全poseのpixel比較や正式性能評価ではない。
5. 10往復は所有参照とscheduler非累積の検査であり、全ブラウザーheap/GPU/CPU budgetの測定ではない。

過去の失敗・除外を消していない:

| 記録 | 原因と扱い |
|---|---|
| qa-01 | fixture準備でinputMethodを保存本体の許可外compatibility keyへ入れた。既存validatorが拒否。製品を直さずambient設定だけに訂正 |
| qa-02 functional-failure | composition待機中のplaytimeSecondsも不変とした誤assert。既存時計の進行を除いて再確認 |
| qa-03 | QAが問題をbattleStateから読んだ。実際のgameState.currentKanjiへ修正 |
| qa-05 route-failure | 既存courseSelectの350ms input block中にクリック。QA待機を訂正 |
| qa-05 lifecycle-failure | 撃破済みcheckpointのE02復帰をE01待ちとした。別の初期fixtureへ分離 |
| qa-06 | Vite HMR query付き製品moduleとQAの無query importが別instance。製品が実際にロードしたURLを参照して訂正 |
| qa-07/08 input-isolation-failure | resize後の既存input width収束中を厳密比較。Tab/touchの成功と分け、settled同条件のqa-09で再比較 |
| verification初期 / Motion-01 | module待機不足のテスト訂正と、未変更のscope競合FAILをそれぞれ保持 |

これらのQA準備/観測ミスを製品のMotion failureや正式性能runへ混ぜない。最終確認で明らかな入力block・runaway timer・Motion起因黒画面は観察していないが、性能保証はしない。

## 29. Performance handoff

MOTION-03は別タスク。今回のscope監査条件は解決したが、次はMOTION-02 freezeの別タスクを待つ。後のLegacy / New Motion / V1a比較では画像fit・alpha・背景・frame、controller timer、fixtureの保存本体、Chrome版、foreground条件を揃える。MOTION-01 demo intervalを製品transportへ移植しない。

正式比較ではmain +5,109 bytes / lazy host chunk追加、初回module準備、idle/cold/input/CPU/frameを実測する。今回のdev serverや撮影待機を正式性能証拠に使わない。既存V1aの性能制約・異なるChrome patch pairを新Motionの性能根拠へ流用しない。

## 30. Next decision

実battleへの限定接続、表示fault隔離、Core不変、既存headed QAに加え、新監査契約の下でBaseline 268 / MOTION-01 39 / MOTION-02 32 = **339 PASS**、全失敗区分0、integrity/build PASSが成立した。製品挙動変更0。許可範囲を広げて通す修正ではなく、9hookの内容と位置を限定して全文監査を継承した。

**MOTION-02 FREEZEを別タスクで開始できる状態**。今回はscope監査と必要なtest補助・report更新で終了する。commit / push / tag / freeze / 正式performance / Sprint実接続 / 新profile / 1000体展開は実行していない。main・stable tag・3D研究branch/tagも変更していない。

MOTION-02 PASS  READY FOR MOTION-02 FREEZE
