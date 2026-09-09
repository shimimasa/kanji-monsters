# YOMITABI V1a-2 GLB Integration Report

作業日: 2026-09-08。対象: experiment worktree。source of truthとしてAsset Build Report、Asset Spec、V0 Technical Slice Report、V0 Git Freezeを全文確認した。

## 1. Executive Summary

HKD-E01 / hokkaido_area1に限り、V0のsphereを検証済みGLBに交換した。既存Battle Visual Adapterのprepare / present / resize / disposeとsnapshot fieldを維持。controller、battleScreen、2D描画、DOM、教材、save / learning / SRSは変更していない。

正式268条件、V0 23条件、V1a 35条件が全PASS。integrity / build PASS。E0隔離headed ChromeでGLB表示、回答、E02の2D表示、10往復の資源非累積、context lossとHTTP故障後の2D回答継続を確認した。

判定は **GLB INTEGRATION CONDITIONAL**。機能接続・回帰は成立したが、機能診断の初回3D準備付近で最大341msのLong Taskを観測した。GLB取得前の区間であり、GLB parseが原因とは断定できない。V0の156〜169msという既知観測を維持し、V1a-3で原因を分離する。正式性能比較・性能GO・V1b開始は行っていない。

## 2. Git / dependencies

| 項目 | 確認値 |
|---|---|
| worktree | C:/kanji-game-latest/artifacts/yomitabi-e0/worktrees/experiment |
| branch | experiment/3d-vertical-slice |
| HEAD | a23285cbff2ffaf990713a38119ecfb9e897ec35 |
| V0 tag | yomitabi-3d-v0-babylon-2026-09 |
| V0 tag展開先 | 15ee0be672ca8ec56e773a75959ce9535877cb19 |
| main / 2D stable展開先 | 2a521dd5aa747314b25e761d976bd4f880cd58c3 |
| core | @babylonjs/core 9.25.0（維持） |
| loader | @babylonjs/loaders 9.25.0（exact追加） |
| loader peer | babylonjs-gltf2interface 9.25.0（lock追加） |

HEADのlockfileと比較し、既存package entryの変更0。Vite resolved 5.4.19を含め既存依存upgradeなし。git diff --check PASS。commit / stage / push / tag変更なし。開始時の未追跡文書・benchmark toolは保持した。

既存ファイルの変更はpackage.json、package-lock.json、src/visuals/battleVisualAdapter.jsのみ。新規製品ファイルは同visuals配下のmonsterVisualManifest.js、glbTimeline.js、glbValidation.js、glbPreparation.js、glbParser.js、babylonGLBRenderer.js。新規検査はtests/v1a/、E0検証sourceはtools/v1a/。artifacts/v1a/のprofile、fixture、Storage、Network、画像、ログはローカル証拠であり製品sourceではない。

## 3. Asset identity / SHA

URL: /assets/3d/monsters/HKD-E01/HKD-E01.v1a.1.glb

SHA-256: `da77cb290755bd40005004ecb4b036b8ac4f268888de29cd37b952bd44048d7f`

43,616 bytes、768 triangles、642 vertices、2,304 indices。GLBとBlender masterは変更0。master SHA-256は `8afd40323c3fed318524df60173de5c10bdf21c4993455b8332601a252b84dc7`。runtimeでも取得bytesのSHA-256を照合し、異なるassetを補正して採用しない。

## 4. Manifest

monsterVisualManifest.jsにHKD-E01のみ登録。stageIds、assetVersion、URL、SHA、assetRoot、motionNode、mesh、material、neutralBounds、animationEnvelope、placementYawRadians、paddingLogicalPx、4 clipsをdeep freezeする。rigKindはobject-trs-slime-v1。

教材JSON、enemy data、gameState、saveへmanifestを格納しない。HKD-E01以外またはhokkaido_area1以外は既存2D選択を返す。

## 5. Loader

採用9.25.0の実配布source / declarationsを確認して、GLTFFileLoaderの公開instance API `loadAssetContainerAsync(scene, IGLTFLoaderData, rootUrl, onProgress, fileName)`を使用した。JSONと埋込みBIN readerを渡す。global plugin observer経由のinstance取得は不要。

登録importは `@babylonjs/loaders/glTF/2.0/glTFLoader.js` のみ。全loader barrel、glTF 1実装、OBJ、STL、Draco、extension barrelは追加していない。buildのparser chunkにもOBJFileLoader / STLFileLoader / KHR_draco_mesh_compression / KHR_materials_variantsは存在しない。共通file loaderにはglTF 1 factoryを選ぶ分岐の文字列があるが、1.0 factory実装を登録するimportはない。

animationStartMode=0、compileMaterials=false、loadSkins=false、loadMorphTargets=false、createInstances=false。glbParserはfetch・header・hash検査後にdynamic importする。

## 6. AssetContainer lifecycle

Rendererは同期的にdispose可能なhandleを返す。表示準備は独立Promiseで進め、battle.enter / 回答開始はawaitしない。

処理順: visual fetch → GLB header / author structure → SHA → loader import → off-scene AssetContainer → runtime structure / session / bounds / clips → material readiness → Placement設定 → addAllToScene → present可能。

AbortController、10,000msのvisual-only deadline、material pollをsession所有にする。各awaitの後とscene追加の前後にcurrent検査。cancel raceで外側Promiseをfalseに収束させ、元parse Promiseにもlate container disposalを接続する。

ready後はcontainerがGLBのmesh / geometry / material / AnimationGroupを所有する。Rendererはplayback停止、parser handle / container解放、Placement、scene、engineの順で解放し、Adapterがcanvas hostを除去する。loader observerは取得完了時に解除する。

parse途中の失敗には9.25.0がJSONへ記録する `_babylonTransformNode` / `_babylonAnimationGroup` とmesh / material observerを使用して部分資源を解放する。これはversion固定の内部field依存である。親子を外してからdisposeし、WeakSetで同じ部分資源を重複処理しない。実9.25.0 parserの開始前dispose、BIN reject、animation accessor異常で解放を検査した。将来loader更新時は再監査が必要。

## 7. Structure validation

author root HKD_E01_Root、SlimeMotion、HKD_E01_Mesh、MAT_HKD_E01_Potatoを完全一致で検査。1 scene / 3 author nodes / 1 mesh / 1 primitive / 1 material、texture / image / skin / camera / extras / external URIなし。loader生成__root__はauthor mesh数と区別する。

runtimeではloader rootを含むmesh 2、author transform 2、geometry 1、material 1を検査。identity author TRS、parent関係、PBR metallic=0 / roughness=.9 / alpha=1、POSITIONの全数有限値、neutral boundsを検査する。clipはidle / attack / hit / defeatの4個のみ、欠落・重複・大小文字違いを拒否。3本のTRS channelはSlimeMotionのみ、clip秒数とkey値の有限性も検査する。

## 8. Placement / bounds

GLB loaderが作るhandedness変換を保持し、その外側のYomitabiVisualPlacementだけにY yaw=PIを設定する。author nodeへ追加180度を適用しない。V0のcamera (0,0,-10)、orthographic 100 logical px/unit、light、ground、canvas stackを維持した。

neutral min[-.5,0,-.31] / max[.5,1.08,.31]、各端許容.02、floorは0。異常をruntime scale補正で隠さない。

fitは固定envelope min[-.66,0,-.40] / max[.66,1.20,.40]、左右12 / 上下6 logical px。232×112枠ではscale=5/6。floorを枠下端から6pxへ置き、毎frameのbounds測定・自動ズームは行わない。4 clip×121 sampleの全vertexについて、実loader変換＋outer yaw後もenvelope内・床以上を検査した。実browserでも正面・左右・上下と顔の視認性を確認した。

## 9. AnimationGroup mapping

| controller | GLB clip | 再生方式 |
|---|---|---|
| null | idle | 表示clockで2秒周期をsample |
| attack | attack | controller残時間を0.75秒clipへ正規化 |
| damage | hit | controller残時間を0.50秒clipへ正規化 |
| defeat | defeat | 既存1000ms timerを1秒clipへ正規化 |

group切替時のみstart→pauseし、以後goToFrameでsampleする。同じsnapshot反復でstartし続けない。AnimationGroup終了callbackの登録なし。HP、採点、EXP、capture、save、次問、敵変更、stage clearは既存controllerが所有する。

## 10. Timer synchronization

Adapter内の表示clockはRenderer module pending中も同じsnapshotを観測する。最初に観測したaction timerを開始残時間として保持し、その後の残時間との差で進捗を算出する。module / GLBが70%時点で後着すれば70%からsampleする。終了済みattackを後から一周しない。同じactionでもtimerが増加して新しいactionが始まった場合はrevisionを更新する。

描画frameで最初に観測した残時間を基準とするため、controllerが代入した瞬間と最初の描画の間には最大でそのframeの観測差がある。controllerへ開始時刻fieldを追加せず、V0同様の値snapshot境界を維持した。

defeatのtimerが0となった後も、同じ敵HP=0の間は終端を保持する。既存controllerがE02へ切り替えたframeでAdapterが3Dを隠し2Dへ戻す。controllerの既存待ち時間へclip秒数を加算していない。

## 11. reduced motion

idle / attack / hitはneutral静止。defeatは静的scale .25。途中ONでpaused groupを停止し、OFF時は現在のcontroller進捗をsampleする。過去clipを0%へ戻して再生しない。unitでON/OFFとdefeat終端保持を検査し、headedでもmedia preferenceのON/OFFと画面を確認した。

## 12. Fallback

pending / failureではpresent=falseにより既存2Dが問題と敵を描く。deadlineは表示準備だけを中止する。page reload、save reset、教材再loadは不要。onFailureは表示資源解放だけを行う。

HTTP / header / SHA / import / parse / structure / material例外、deadline、context loss、sample例外、disposed / stale session、対象外敵で2Dへ戻す。永久pending中でも回答が成立することを実browserで検査した。module cacheは共有されるが、canvas、engine、scene、container、listenerを共有cacheへ保存しない。

## 13. Fault injection

| 故障 | 検査層・結果 |
|---|---|
| GLB 404 | CDP HTTP故障、同battle 2D正答・再入場GLB復帰 PASS |
| HTML 200 rewrite | CDP HTTP故障、同battle 2D正答 PASS |
| 不正header | CDP bytes故障、同battle 2D正答 PASS |
| parse reject | preparation reject、および実parserのBIN / animation異常、scene追加なし・解放 PASS |
| animation欠落 / 重複 / 大小文字違い | 実GLBからのAssetContainerを変更して完全一致検査がreject PASS |
| bounds異常 | 実mesh POSITION異常を補正せずreject PASS |
| loader import失敗 | preparationのimport rejection → onFailure / 解放 PASS |
| shader例外 / material not-ready | 例外と永久false、deadline・poll解除、scene追加なし PASS |
| load永久pending | 実browserでdeadline前にも2D正答、最終資源解放 PASS |
| load中exit / exit後resolve | browserの保留HTTP＋新session、unitの保留parse resolve、旧container追加なし PASS |
| old→new / new→old | unitで両完了順・current sessionだけactivate PASS |
| double dispose / dispose後reject | unitでready前後・後着rejectを処理 PASS |
| context loss | 実WEBGL_lose_context、同battleの同問題を維持して正答・再入場GLB PASS |
| sample例外 | 実AnimationGroup unitでCore / save / controller timer不変 PASS。sample-03で実browserのidle group.goToFrameへ例外注入、同battle 2D正答・再入場GLB復帰 PASS |

故障条件ごとに「実browser」と「実parserを使うunit」「依存を差し替えるunit」を区別した。全条件を実GPUブラウザで個別再現したとするものではない。V0 Adapterの失敗・stale・再入場テストも変更せず維持する。

## 14. 10 lifecycle loops

functional-01でbattle → stageSelect → battleを10往復。全退出で実GPU objectと登録listenerが0。各enterの資源数は同一。

| 資源 | enter（1〜10） | exit（1〜10） |
|---|---:|---:|
| Renderer session / engine / scene | 各1 | 各0、battleのAdapter参照null |
| GLB container / Placement | 各1 | 0 |
| canvas（3D追加分） | 1 | 0、既存gameCanvasのみ |
| scene mesh / geometry / material | 3 / 2 / 2 | 0 |
| AnimationGroup / Animatable / sampled group | 4 / 3 / 1 | 0 |
| scene等observer / renderer listener | 9 / 11 | 所有sceneをdispose / 実listener 0 |
| loader observer / fetch / deadline / poll | 0 / 0 / 0 / 0 | 0 |
| 独立engine render loop | 0 | 0 |
| 実GPU Buffer / Texture / Program / VAO | 15 / 1 / 3 / 2 | すべて0 |
| 実GPU Shader / FBO / Renderbuffer / Query | 0 | 0 |

runtime Texture 1はBabylon PBR内部BRDF用で、GLBのtexture / imageは0。scene/engine所有で退出時に解放された。module cacheとshader source等のJavaScript共有cacheは別扱いで、engine・GPU資源の生存とは区別する。scene破棄後observer countを生sceneのように再取得した値ではなく、owner disposalと外部listener/GPU監査を併用した。

## 15. R-01〜16 GLB extension

| 条件 | GLB経路の証拠 |
|---|---|
| R-01 | 実handleAttack / handleHealの正誤4条件、実AnimationGroupを0 / 1 / 100 sample、HP / EXP / token / learning / save / controller timer不変 |
| R-02 | 同snapshot反復でstart数不増、action変更のみ切替、late 70% |
| R-03 | preparation各失敗、HTTP実browser回答 |
| R-04 | exit後parse containerを一度だけdispose |
| R-05 | 旧新両完了順 |
| R-06 | ready前後double dispose、late reject |
| R-07 | 固定fit、全clip envelope、headed縦横resize |
| R-08 | 実context lossと再入場 |
| R-09 | 実groups reduced motion ON/OFF・defeat .25 |
| R-10 | inert / tabindex -1 / pointer-events none、focus / composition入口 |
| R-11 | 既存guideボタンhitを通過、3Dの前面化なし |
| R-12 | GLB moduleに教材loader / Core importなし、故障時page reloadなし |
| R-13 | HTTP / context fallback後に再入場GLB |
| R-14 | 実group sample例外でも採点後状態と既存timer不変 |
| R-15 | practice / quickのAdapter不生成、headed practice 2D |
| R-16 | asset hash、Core境界、E0実Firebase接続0、save schema差分0 |

## 16. 268 regression

`npm.cmd run test:phase-a`: 86 PASS。

`npm.cmd run test:phase-b`: 22 PASS。

`npm.cmd run test:phase-c`: 17 PASS。

`npm.cmd run test:no-go`: 143 PASS。

合計268 PASS。各commandのFAIL / cancelled / skipped / todo = 0。既存assert削除・skip化・timeout握り潰しなし。

## 17. V0 23 regression

`node --experimental-default-type=module --test tests/v0/*.test.mjs`: 23 PASS、FAIL / cancelled / skipped / todo = 0。tests/v0、primitive renderer、primitivePoseは変更なし。

## 18. V1a tests

`node --experimental-default-type=module --test tests/v1a/*.test.mjs`: 35 PASS、FAIL / cancelled / skipped / todo = 0。

asset.test.mjs 15、controller.test.mjs 5、parser-lifecycle.test.mjs 3、preparation.test.mjs 12。Node NullEngine検査と実WebGL browser検査は別の証拠として扱う。

## 19. integrity / build

`node scripts/verify_stage_id_integrity.mjs`: exit 0 / PASS。

`npm.cmd run build`: exit 0 / PASS。既存chunk-size warningは残る。正式ログはartifacts/v1a/regression/、集計はregression.json、再実行sourceはtools/v1a/regression.mjs。

buildにはglbParser-CZf8e9to.js（約197.04kB、非圧縮）が独立chunkとして出力された。全loader一括importなし。これは正式Network delta測定ではない。

## 20. Headed visual result

Windows / Chrome 152.0.7977.82、DPR 1.5、screen 1280×800 CSS、inner 1086×723、E0隔離、各run新規専用profile、headedで確認。物理foregroundを人間が維持する正式性能runではない。機能確認はCDP診断付き。

functional-01 PASS: 顔がcameraを向き、黒い縦長の目、U字口、左右の芽、裾と輪郭が枠内で識別できる。ground / camera / lightsはV0。正答hit、誤答後attack、heal、defeat、E02への2D移行、exit / reentry、10往復、context loss、reduced motionを検査した。

inputは3D canvas.focus()でもkanjiInputに維持、canvas inert=true / tabindex=-1 / pointer=none。composition中Enterで正答数不増。390×844、844×390、1086×723でcontainと3D矩形の差1px未満、DOM input高さ48px以上、主要操作43.9px以上（44pxの丸め許容）を検査。かなパッドON/OFF、practice 2DもPASS。

faults-01 PASS: 404 / HTML / header / pending / load中exit後の回答と再入場を確認。sample-03 PASS: loaded Babylon EngineStoreから表示sceneを選び、idle AnimationGroupのgoToFrameへ例外注入。canvas除去後も同じ問題で2D正答し、再入場でGLB復帰した。faults-02とsample-01 / sample-02は検証ツールのscope / class取得失敗で停止した診断attemptとして保存し、成功runに数えない。製品例外ではなく、Coreへ誤って書き込まず停止したもの。

actions-01 PASS: idle / hit / attack / defeatのclip名と実controller状態を記録。誤答後attackの途中画像、defeat画像を確認し、4 action後もstable save validatorはvalid。追加の性能測定ではない。

画像・生証拠: artifacts/v1a/integration-01/experiment-*-evidence.json、*-battle.png、*-action-*.png、*-GLB-attack.png、*-layout-*.png、*-pad.png。これらはGitへstageしていない。

## 21. Save / learning diff

製品差分はvisualsと依存のみ。battleScreen、save、learning、SRS、教材loader、教材、stage progression、IME、Tutorialのsource差分0。HKD-E01のID / HP / ATK / weakness / grade / enemy順 / stage pool変更0。

実controllerの採点・保存後に0 / 1 / 100回GLB sampleしてもstate文字列、全Storage entry、既存timeout一覧が同一。sample例外後も同一。実browserの回答によるsave更新は当然発生するため、回答前後のsaveが同一とは主張しない。E0のstable由来readSaveStateでvalid、Firebase global undefined、隔離canary受信0。外部HTTP responseは診断中に検出したら停止する。

## 22. Known issues

KNOWN-2D-PAD-TUTORIAL = 既存REPRODUCEDを継承し、修正しない。今回の3Dによるguide遮蔽追加は観測しなかった。物理IME / 実mobileを全面認証したものではない。

V0 cold 156〜169ms Long Taskは既知のまま。今回の機能診断では初回準備付近に206msと341msを観測した。341ms taskはnavigation約8072〜8413ms、GLB fetch開始は約8397msであり、taskの大部分はGLB取得前。GPU / listener診断、DevTools、Tutorial付きのrunなので正式V0との差を算出しない。入力不能、継続する黒画面、GLB完了を待つ回答gateは再現していない。

loader内部partial-resource fieldへの限定依存、PBR準備負荷、module failure時のブラウザmodule cache挙動は今後の監査点。global module cacheはdisposeしない。機能確認だけでcold stallが解消した、低スペック端末まで性能合格したとはしない。

## 23. Performance handoff

V1a-3の2D / primitive V0 / GLB V1a正式比較は **NOT EXECUTED**。今セッションで開始しない。

次工程ではV0既知156〜169msを保持して、当日paired cold 3組でmodule評価 / engine初期化、GLB transfer、parse、texture decode（asset texture 0、engine内部textureは区別）、GPU upload、material shader準備、AnimationGroup setupを可能な範囲で分離する。今回341msの発生区間を優先してtrace調査する。

T1 / A0S、N0A0S transfer、loader / GLB追加transfer、通常frame、33ms超、50ms超、idle TaskDuration / CPUをV0 Budgetで比較する。Asset Specの「同条件P/G cold 3組で一貫してV0より100ms以上増加または約300ms以上」の調査条件を維持する。単発の診断値を3組一貫の証拠に置き換えないが、未解決のままV1bへ進まない。

## 24. Next Decision

限定AdapterでGLB接続・回帰・fallback・退出資源の非累積は確認した。機能診断でのcold stall観測が残るため、無条件PASSとはせず条件付きとする。次に実施するのは別セッションのV1a-3原因分離と正式性能比較であり、北海道背景制作や他モンスター量産ではない。

main / stable / V0 tagを変更せず、製品commitも行っていない。

**GLB INTEGRATION CONDITIONAL**
