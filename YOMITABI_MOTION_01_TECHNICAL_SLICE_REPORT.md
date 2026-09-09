# MOTION-01 — HKD-E01 Pixel Companion Slice

実施日: 2026-09-09 / 方針: RECOMMEND 2D MOTION

## 1. Executive Summary

独立した2D Motion開発系列を2D stableから作成し、既存HKD-E01の1枚画像でidle / attack / hit / defeatを実装した。同じpure pose計算をヨミタビ表示通知hostとSprint mock hostが利用する。Standalone SliceとしてPASS。

Baseline 268件、追加Motion 39件、合計307件PASS。全suiteでFAIL / cancelled / skipped / todo = 0。stage integrity、production buildもPASS。Chromeの独立host操作確認24項目PASS。新規画像・sprite sheet・GLB・大型library・製品Core変更は0。

全モンスター3D化・V1b背景接続は現在の製品roadmapから外す。既存3D研究成果、checkpoint、未完了差分、rawは保持した。MOTION-02、正式性能比較、実Sprint接続へは進んでいない。

## 2. Git / branch / baseline

全文参照した文書:

- [Visual Strategy Reassessment](../../yomitabi-e0/worktrees/experiment/YOMITABI_MONSTER_VISUAL_STRATEGY_REASSESSMENT.md)
- [V1a Git Freeze](../../yomitabi-e0/worktrees/experiment/YOMITABI_3D_V1A_GIT_FREEZE.md)
- [2D Stable Baseline](YOMITABI_2D_STABLE_BASELINE.md)

Baseline文書の旧HEAD等は過去時点の記録であり、今回の基点は実Git refで確認した。

| 項目 | 確認結果 |
|---|---|
| 新branch | experiment/2d-monster-motion |
| 新worktree | C:/kanji-game-latest/artifacts/motion-01/worktree |
| HEAD / 復帰基点 | 2a521dd5aa747314b25e761d976bd4f880cd58c3 |
| 起点tag | yomitabi-2d-stable-2026-09 |
| 初期status --porcelain | 空 |
| Babylon混入 | package / lock / srcにV1a・V1b差分なし |
| 最終状態 | 上記HEADのまま、本Slice追加ファイルのみ未追跡。stage / commitなし |

3D worktreeはC:/kanji-game-latest/artifacts/yomitabi-e0/worktrees/experiment、branch experiment/3d-vertical-slice、HEAD a30e5043d707e161a47c71870b0199f46159ab06のまま。開始・終了時ともtracked差分はbabylonGLBRenderer.js / battleVisualAdapter.js / glbParser.jsの3ファイル、55 insertions / 7 deletions。背景準備・検証・manifest・tests・tools・背景asset等の未追跡差分も残した。完成・整理・削除は行っていない。

開始・終了にstatus、branch、HEAD、diff stat/name-status/check、worktree listを確認。3D側のsrc/tests/tools/art/関連public asset/data/文書など確認対象2,769ファイルはSHA-256一致。raw全体を再hashした主張ではなく、rawには書込・削除操作を行っていない。

保護refsは不変:

| Ref | tag object / branch SHA | 展開先 |
|---|---|---|
| main | 2a521dd5aa747314b25e761d976bd4f880cd58c3 | 同左 |
| yomitabi-2d-stable-2026-09 | 6fcd0afd23b0066a4f46f1a4169e01c98f490c06 | 2a521dd5aa747314b25e761d976bd4f880cd58c3 |
| yomitabi-3d-v0-babylon-2026-09 | 76e5c7210888ba5f3bf79b86d5e35be86f5b3158 | 15ee0be672ca8ec56e773a75959ce9535877cb19 |
| yomitabi-3d-v1a-glb-checkpoint-2026-09 | 46dfeeb9e8b5264c592aec3f9a0c17ea859d518f | a30e5043d707e161a47c71870b0199f46159ab06 |

worktree addはGit管理領域のsandbox制限で初回失敗後、承認された同一操作で成功。既存worktreeのbranch切替はしていない。reset / restore / clean / stash / rebase / commit / push / tag操作なし。

## 3. Baseline regression

新規のclean worktreeでnpm ciを実施。初回はユーザーnpm cacheへのEPERMで失敗し、そのlogを保持して権限付き再実行で成功。Node v22.14.0、npm 10.9.2。既存依存のauditは5件（moderate 1 / high 4）を報告したが、fix・upgradeはしていない。

| Command | PASS | fail / cancelled / skipped / todo |
|---|---:|---|
| npm.cmd run test:phase-a | 86 | 0 / 0 / 0 / 0 |
| npm.cmd run test:phase-b | 22 | 0 / 0 / 0 / 0 |
| npm.cmd run test:phase-c | 17 | 0 / 0 / 0 / 0 |
| npm.cmd run test:no-go | 143 | 0 / 0 / 0 / 0 |
| Baseline計 | 268 | 0 / 0 / 0 / 0 |

`node scripts/verify_stage_id_integrity.mjs`: oldIdHits OK(0)、referenced ⊆ stages OK。
`npm.cmd run build`: PASS。追加後もbuild PASS。CJS API・既存dynamic/static import・大きなchunkの警告は残る。

証拠: [baseline logs](../baseline/)、[最終build log](../build-final.log)。既存tracked内容が不変なので268件を意味なく繰り返してはいない。

## 4. Existing HKD-E01 image

使用画像は `public/assets/images/monsters/full/grade1-hokkaido/HKD-E01.webp` のみ。ジャガイモスライム、512×512、13,470 bytes。

SHA-256: `ee2a5e2456227d92efdf4824e7d8b17d3babd74165bd81bf70816e699155110e`。

既存assetsLoader.loadMonsterImageを呼び、既存のalpha処理・cacheを再利用。画像を書き換えず、追加の切抜きやfit補正はしない。通常画像描画240×120、clip232×112を参照。小サイズは全体0.75倍で180×90 / clip174×84。背景も既存hokkaido_area1.webpを使う。

## 5. Motion architecture

| 責務 | ファイル / 契約 |
|---|---|
| MonsterMotionProfile / pose計算 | motionProfile.js。少数keyと補間曲線。profile/action/progress/layout/reducedMotion → pose |
| MonsterAnimationTimeline | motionTimeline.js。previous + display input → 新しいimmutable timeline |
| MonsterVisualState / session所有 | monsterMotionHost.js。画像参照・timeline・reducedMotion・disposedのみ |
| MonsterRenderer | monsterRenderer.js。既存Canvas2D contextへ画像だけ描画 |
| 表示metadata | monsterMotionManifest.js。HKD-E01一件のみ |
| game固有mapping | tools/motion-01/bridges.mjs。damage→hit、correct→attack |

poseはposition / scale / rotation / opacity / flash / effectを返す。flash=0、effect=noneで初号は追加effectを作らない。pure部分にI/O、現在時刻、Math.random、学習Core importなし。monster固有enemy objectを要求しない。manifestはimage URL、profile、pivot、floorAnchor、imageSize、fixedEnvelopeのみを持ち、HP/ATK/owned/EXP等を持たない。

## 6. Slime profile

実装profileはslimeだけ。HKD-E01専用のanimation関数はない。全actionを同一のkey補間で評価する。将来のheavy / floating / beast / staticはprofile登録という拡張点だけを残し、今回のデータには追加していない。

idleのimageRect基準移動は最大約0.72px上 / 0.36px下、scale差は概ね1%程度。画面全体を動かさず、既存画像の小さな変形に留めた。

## 7. Action specification

| Action | 初号の表示 | 時間・終端 |
|---|---|---|
| idle | 微小squash/stretchと上下変化 | 2,000ms周期。開始・終了pose一致 |
| attack | 軽い溜め → 横lunge → 元位置 | ヨミタビbridge 750ms。最大左24px、終端neutral |
| hit | 一度潰れる、微小tilt、戻る | 500ms。scaleY最小0.90、tilt最大約0.025rad、終端neutral |
| defeat | 沈む、縮小、opacity低下 | 1,000ms。終端scale0.20 / opacity0.08を保持 |

固定包絡は画像矩形に対してX[-0.16,1.16] / Y[-0.10,1.10]。全4actionを各1,001 progress、各画像四隅で数値検査した。これは自動fit用ではない。既存clipは維持する。

## 8. Timeline

host updateがcontroller相当のremainingMs / durationMsを観察し、progressを算出する。presentやpose sampleは時計を進めない。idleは外部elapsedMs、または呼出側dtから進める。oneshotは0〜1へclampする。

session / monster identity変更、action変更、remaining増加、display専用actionRevisionにより再発火を識別する。actionRevisionはquestion tokenではなく表示通知の識別値。同action、hit→defeat、途中割込、古いsessionを試験済み。

defeat後のidle通知は終端表示を維持する。敵・sessionの交代はhost所有側の既存進行で決まり、表示の完了callbackはない。MOTION-02ではそのsession境界を明示する必要がある。

## 9. Renderer

ctx.save → Path2D clip → translate / rotate / scale → alpha → drawImage → finally restore。画像の中心pivotを使用し、元のdrawImage寸法を変えない。Path2Dによりcallerの現在のpathも汚さない。UI・次のdrawへtransform、alpha、clip、compositeを漏らさないことをfake contextで試験し、実Chromeでも描画後UI markerを確認した。

新WebGL canvas・requestAnimationFrameは0。Motion Engine / reusable host内のtimerも0。demoには3枚のCanvas2Dを比較用に置くが、製品canvas/DOMは変更していない。

## 10. Standalone host

[起動・操作README](tools/motion-01/README.md)。`node tools/motion-01/server.mjs` でlocalhost:49731を開く。Legacy / Motion / 静止切替、4action、進捗seek、100ms step、reduced motion、大小表示、退出・再入場、画像pending/failureを提供する。

デモ再生ボタンのsetInterval(33ms)は開発用の外部transport。非表示・退出・pagehideで停止する。engineは外部update/renderから呼べる構造であり、MOTION-02でこのデモtimerを製品へ移植しない。今回は「まずStandalone」の指示に従い、既存game cycleにはまだ接続しない。

Legacyは現行寸法・背景・通常enemy frame・attack/defeat式を参照した比較用描画。hitのMath.randomは製品を変更せずデモだけ固定ジッターで近似。枠の角丸実装と画像背面の薄い暗幕は共通のデモ描画で、実battle全体とのpixel同一性は保証しない。画像fit改善の比較ではない。

## 11. Sprint mock host

別host instanceが同一画像・profile・pure engineを使い、correct通知をattackへ、待機通知をidleへ変換する。ヨミタビのenemyAction === damage等はbridge外へ漏れない。デモの進捗transportは両hostの観察に共用するが、image/session/timelineはhostごとに所有する。

採点、保存、EXP、問題生成、party、owned bridgeは0。complete→celebrateは将来のmapping例であり、今回は4actionだけなのでcelebrateを実装していない。実計算スプリントrepoは未変更。

## 12. reduced motion

idle / attack / hitはneutral静止。defeatは静的scale0.35 / opacity0.25。切替時もtimeline progress / revisionは維持し、0%から再生し直さない。単体試験とChrome途中切替で確認した。

## 13. fallback

画像pending / failureはpresent=falseで既存fallback相当をhostが描く。操作は継続可能。draw例外はrestore後に同一画像のneutral描画を試し、それも失敗ならfalse。unknown profileはneutral、invalid layoutは描画せずfalse。画像readyを回答・進行条件にするAPIはない。

画像load成功前にもtimelineを更新し、ready後は現在の進捗を表示する。退出はhostの画像参照・timelineを破棄、late success/rejectを無視。既存assetsLoader cache / 実requestの寿命はloader側に残るため、loader cache解放やpending通信abortまで実装した主張ではない。

## 14. Functional tests

`node --experimental-default-type=module --test tests/motion-01/*.test.mjs`

| Test file | PASS | 主な範囲 |
|---|---:|---|
| motion.test.mjs | 19 | 0/1/100 sample、4action、loop、包絡、再発火、割込、terminal hold、reduced、invalid/unknown、bridge |
| host.test.mjs | 15 | Canvas復元、draw例外、image pending/failure、late resolve/reject、old/new両順、double dispose、10 host退出、Core guard |
| scope.test.mjs | 5 | import境界、manifest、画像hash、stable tracked差分0、依存・demo範囲 |
| Motion計 | 39 | FAIL / cancelled / skipped / todo = 0 |

[最終test log](../motion-tests-final.log)。単体test初回・最終とも39 PASS。

Browser skillの接続はkernel assetsのpathエラーで起動できず、隔離profileのheadless Chrome 152.0.7977.83 / WindowsでCDPによる機能確認を行った。profileは既存ユーザーChromeと別。正式性能runではない。

[Browser result](../browser-01/result.json): 24 checks PASS、runtime exception 0。4action、reduced途中切替、Sprint attack、再発火、hit→defeat、表示モード、pending/failure時操作、退出後保持・再入場、canvas focus除外、幅390px時overflowなし、3D/game entry requestなし。

初回Browser確認では配信allowlistに既存loaderの間接依存asyncDeadline.jsが不足してモジュール初期化できなかった。demo serverの許可リストだけを修正後、全24項目PASS。初回の[failure.json](../browser-01/failure.json)は保持。Coreファイル自体は変更なし。

スクリーンショットは[通常idle](../browser-01/idle-232x112.png)、[縮小attack](../browser-01/attack-mid-174x84.png)、[縮小hit](../browser-01/hit-mid-174x84.png)、[defeat中間](../browser-01/defeat-mid-232x112.png)、[defeat終端](../browser-01/defeat-end.png)、[狭幅](../browser-01/narrow-174x84.png)等を保存・目視した。顔・芽・裾はidle/attack/hitで識別でき、defeatは意図どおり潰れて薄くなる。frame外のUI markerは維持。これはheadless静止pose/DOM機能確認であり、人による連続animationの好みの評価ではない。

## 15. Core invariants

Baseline tracked 8,677ファイルについて開始・終了hash一致。集約SHA-256は `d8ad944a086e28f99adb90f3ac51792b0233e3498a168839566a8ff5cb0a125c`。ソートしたpath、NUL、各file SHA、改行の連結をSHA-256化した値。[監査JSON](../final-audit.json)参照。

save / learning / SRS / 教材 / question token / stage progression / battle controller / battleScreen / IME / Tutorialの既存差分0。

Core sentinelをdeep freezeし、0/1/100 sample/present時のHP・EXP・save・learning・SRS・token・timer・stageRun・enemy progression不変を試験。Storage/fetch/timer/RAF accessとMath.randomを禁止するguard下でPASS、Storage write増加0。Motion Engineは学習Coreをimportしない。demoの既存image loaderが使うID/画像path/通信deadline helperの間接importはあるが、学習処理を呼び出していない。

## 16. Files changed

既存tracked変更0。追加ファイルのみ:

- src/visuals/motion/: motionProfile.js、motionTimeline.js、monsterMotionManifest.js、monsterRenderer.js、monsterMotionHost.js
- tools/motion-01/: bridges.mjs、legacy.mjs、demo.mjs、demo.css、index.html、server.mjs、README.md
- tests/motion-01/: motion.test.mjs、host.test.mjs、scope.test.mjs
- YOMITABI_MOTION_01_TECHNICAL_SLICE_REPORT.md

logs、browser script/profile/screenshots、監査JSONはworktree外のC:/kanji-game-latest/artifacts/motion-01/へ隔離。Git stageはしていない。製品asset、新画像、教材、package、lockの変更なし。

## 17. Bundle / dependency impact

依存追加0。package.json / package-lockはstableとbyte一致。Babylon、Blender、animation library、WebGL経路はない。5つのreusable motion sourceは計8,043 bytes（未bundleの作業ファイル値）。

製品entryからMotionをimportしていないため、今回のproduction JS/CSS出力は追加前後で同一SHA:

| 出力 | SHA-256 |
|---|---|
| index-pfMYKWSh.js | aca6b5d29fa6943c78bdb54f47cd38fc7fa462130c8ad622c51a77dff7c5b9b6 |
| TutorialManager-DxkKCgmJ.js | 5823bbd9ec65ff20fe3219b5f42acf0ef17bde3f08c707dea5030a04c30c9a7b |
| index-BYAeroUh.css | 8db35628314d56609e47d6059e1373ea797bd70c47c5f1ac299f1601f38d52d7 |

将来battleへ接続した場合のbundle増分・CPU・frame・coldは未測定。今回のbuild不変をMOTION-02の性能保証にしない。

## 18. Known limitations

- 実battle、IME/Tutorial/かなパッド、実mobile・学校端末、正式性能比較は未検証。baseline testを実UI確認の代替にしない。
- Legacy比較は一部近似。現行Math.randomを整理していない。新旧の見た目の好みは別途人が評価する。
- 初号profileはslime、登録monsterはHKD-E01だけ。1000体適合・EXP/所有/捕獲・Sprite/3Dは対象外。
- Image loader cacheは既存所有のまま。10 host loopはhost参照/状態解放の試験であり、実battle10往復やブラウザーheap非累積の正式認証ではない。
- reducedMotionはhostから明示入力。製品設定・OS preferenceへの配線はMOTION-02。
- 本実装は未commit。検証済み復帰基点は2D stable SHAで、追加Sliceを保存したGit checkpointではない。
- 初回npm ciの権限失敗、browser bootstrap環境エラー、最初のdemo allowlist不足は最終PASSと分けて記録した。

## 19. MOTION-02 readiness

次工程でbattle integrationを検討できる状態。ただし今回自動開始しない。MOTION-02の必須条件は次のとおり。

1. 既存game update/render cycleから同じdisplay-only hostを呼び、新RAF・demo intervalを持ち込まない。
2. question/enemy/session交代と既存timerをbridgeで扱い、animation完了や画像readyを進行条件にしない。Core/save仕様変更0。
3. 既存画像fit・alpha処理・背景・frameを維持し、monster drawだけへtransformを閉じる。
4. 画像pending/failure、途中退出、同action再発火、defeat終端、reducedMotionを実battleで再確認する。
5. IME/Tutorial/pad/focus・既存fallbackと学習回帰を確認してから、別タスクでLegacy 2D / New 2D Motion / V1a 3Dの比較を設計する。過去3D runを新Motionの性能証拠にしない。

## 20. Decision

Checkpoint準備時の補記（2026-09-09）: scope.test.mjsのbaseline不変検査が未追跡の追加ファイルを前提としており、そのままcommitするとMOTION追加自体を差分として拒否することを発見した。stable treeの元のpath集合を列挙して、その全pathの変更・削除・改名を引き続き拒否する検査へ修正した。新規MOTIONファイルだけを許容する対象範囲の訂正で、assert削除・skip・製品コード変更ではない。正式39件の数は維持する。READMEへMOTION-02のA〜J不変条件を明記した。以下の未commitという記述はSlice終了時点の履歴で、commit/tag/clean再現の確定結果は別のYOMITABI_MOTION_01_GIT_FREEZE.mdに記録する。

安全なbranch/worktree分離、既存1枚による4action、pure poseと独立2host再利用、Core不変、fallback/late completion、baseline / Motion tests / integrity / buildを満たした。判定はStandalone Technical Sliceの機能PASS。性能GO、実battleの製品合格、実Sprint連携完了は宣言しない。

確認用Chromeとデモserverは停止済み。3D研究worktreeと保護refsを保持し、未commitの新Motion系列を引き継ぐ。

MOTION-01 PASS  READY FOR MOTION-02 BATTLE INTEGRATION
