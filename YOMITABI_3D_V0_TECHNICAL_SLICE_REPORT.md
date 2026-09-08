# YOMITABI 3D V0 Technical Slice Report

2026-09-08 JST。experiment worktreeの実装・診断記録。**V0 GO  READY FOR BLENDER V1a：headed foreground比較3組を完了。適用範囲は本Windows／Chrome条件のprimitive V0。Blender制作は本セッションでは開始しない。**

## 1. Executive Summary

既存の通常battleへBabylon.jsの表示専用Adapterを接続した。`hokkaido_area1`の`HKD-E01`だけをsphere＋planeで表示し、他の敵とpractice／quickは2Dを維持する。初期backendはWebGL 2。3Dの準備・描画・animation完了を起動、回答、採点、保存、敵交代の条件へ追加していない。

正式268条件、追加V0 23条件、stage integrity、production buildはPASS。専用Chrome headlessの故障・資源診断では10往復、context loss後の同一battleでの回答、再入場、layout、focus、practiceを確認した。これをheaded性能値へ転用しない。

追加の実browser故障5種もPASS。import遮断、WebGL利用不能、hit中のdraw例外、attack中／defeat中のcontext loss後も正誤回答・回復・敵交代・再入場を完了。headed比較も含む保存snapshot 267件はstable APIで全valid。V0のidle p95は3runとも16.9ms、CPU増分は+3.66〜+3.91pt。初回準備付近の156〜169ms Long Taskは残存課題として17・21節へ記録した。

指定6文書を全文確認した。過去文書の「予算未承認」「V0未実装」は各文書作成時点の記録として保持し、今回のユーザー指示によるBudget A〜Fと性能targetを適用する。

## 2. Git / dependencies

| 項目 | 値 |
|---|---|
| 作業場所 | `C:/kanji-game-latest/artifacts/yomitabi-e0/worktrees/experiment` |
| branch | `experiment/3d-vertical-slice` |
| 開始HEAD | `034915d4133782cc1eff872134e5b8fde04e4bac` |
| baseline / main | `2a521dd5aa747314b25e761d976bd4f880cd58c3` |
| stable tag | `yomitabi-2d-stable-2026-09` |
| 新規依存 | `@babylonjs/core: 9.25.0`、exact指定 |
| Vite | 既存指定`^5.3.1`、解決版5.4.19を維持 |

開始前にstatus、branch、HEAD、worktree listを確認。mainの`.firebase`差分・未追跡資料、experimentの既存`tools/benchmark/`、`benchmark-b05/`、`benchmark-b06/`を保持した。reset／restore／clean／stash、main統合、tag移動は行っていない。

採用時に`npm view @babylonjs/core version dist.integrity --json`で9.25.0を再確認した。[公式npm公開情報](https://www.npmjs.com/package/%40babylonjs/core?activeTab=versions)も同版。lockfileはregistry URLとSHA-512 integrityを保持。GLBを使わないため`@babylonjs/loaders`は不要と判断し導入していない。既存の各package entryはbaselineとdeep-equalで、新規entryはcore 1件のみ。npmが以前不一致だったlockfileのルートnameを既存package.jsonに合わせた差分も含む。

## 3. V0 architecture

```text
既存main rAF → 既存battle.update(dt) → 敵timer／UI／進行
                               └→ 値snapshot → Battle Visual Adapter
                                               └→ Babylon scene.render()
既存入力 → 既存採点 → learning／SRS／save／HP／EXP／次問
```

Babylonの`runRenderLoop`は使わない。Controllerから表示への一方向接続。`present`のbooleanは背景・敵画像の2D描画を選ぶためだけに使う。ready／failureは回答ゲート、既存timer、stage progressionへ渡さない。

## 4. 追加/変更ファイル

| ファイル | 役割 |
|---|---|
| `src/visuals/battleVisualAdapter.js` | session、遅延prepare、surface、contain、fallback、dispose |
| `src/visuals/babylonPrimitiveRenderer.js` | WebGL 2、sphere／plane、camera／light、render／GPU破棄 |
| `src/visuals/primitivePose.js` | action／timerから表示poseを計算 |
| `src/screens/battleScreen.js` | enter／updateの表示箇所／exit、敵枠の背景塗り切替 |
| `style.css` | 背面canvasと黒帯、前面2Dの透過 |
| `package.json` / `package-lock.json` | core 9.25.0のみ追加 |
| `tests/v0/adapter.test.mjs` / `controller.test.mjs` | 新しい表示境界・実回答との独立性 |
| `tools/v0/` | E0隔離を継承する専用server、診断、paired測定、集計・監査 |
| 本書 | 結果と限定条件 |

生成物・profile・fixture・rawは`artifacts/v0/`。B0/E0の原本toolとrawには上書きしていない。

## 5. Adapter contract

- `prepare()`：遅延moduleを読み、session固有surfaceとresource handleを準備。controllerはawaitしない。
- `present(snapshot, dt, layout)`：表示のみ。初期化・shader未準備・失敗ならfalseとなり2D継続。
- `resize(layout)`：既存Canvasの実boxとcontain内容矩形、buffer寸法を反映。変化のないframeでDOM styleを再代入しない。
- `dispose()`：そのsessionの表示権とsurface・rendererを解放。複数回安全。

snapshotは`stageId, enemyId, enemyIndex, enemyAction, enemyActionTimer, enemyHp, enemyMaxHp, shield, reducedMotion, monsterRect, generation, session`。値だけをコピーし、snapshotとmonsterRectをfreezeする。gameState、question token、save、SRS可変参照、採点／commit関数を渡さない。

## 6. Babylon canvas / stack

背面の黒帯用div内にGPU canvasを置き、その前面に従来gameCanvas、さらに既存DOM／Tutorialを維持。GPU canvasは`pointer-events:none`、`tabIndex=-1`、`inert`、`aria-hidden=true`。camera controlsをattachしない。

`getContainedRect()`で従来の800×600内容矩形を取得する。黒帯divはgameCanvasの実box、GPUはその内部のcontain矩形。単純な100vw×100vhのGPU配置ではない。buffer DPRは最大1.5。3Dが描画可能な間だけgameCanvasの背景を透明にする。fallback／exitでは黒い既存背景へ戻る。

敵表示矩形は従来と同じ232×112論理px。枠は保持して塗りだけ抑制し、`_lastMonsterFrameArea`を供給し続ける。盾経由の2回目の枠呼出しにも同じ描画方式を渡す。

## 7. primitive scene

直径0.82、segments16のsphere 1個、背景plane 1個、固定orthographic camera、HemisphericLightとDirectionalLight各1個、StandardMaterial各1個。sphere位置は既存敵矩形中心から計算する。planeは低彩度の仮地面表現。

shadow／post-processing／physics／WebGPU／outline／particle／GLB／Blender assetは使用していない。core内部の遅延texture loader・WGSL等のchunkがbuildに出力されることと、これらの機能を使うこと・network取得することを区別する。

## 8. action mapping

| Controller状態 | 表示 | 動き |
|---|---|---|
| null等 | idle | 微小上下動 |
| attack | attack | 短い左右移動 |
| damage | hit | 小さな縮み・傾き・emissive反応 |
| defeat | defeat | 縮小・回転 |

世代／session／敵index／ID／actionの変化と、残timerの増加で新規actionを区別する。同じsnapshotを繰り返してもrestartしない。既存timerの終端を表示へ写す。完了callbackは存在しない。reduced motionでは移動・回転・flashを0にし、defeatは静的な小さいpose。

2Dのdamage揺れに使われる既存Math.random呼出しは残した。新pose計算は乱数を使わない。実プレイのランダム出題列の完全一致を保証する主張はしない。

## 9. lifecycle / dispose

normal battle.enterで生成したAdapterをその画面の`_generation`へ接続。canvasごとのWeakMap所有者と固有session番号でも旧新を区別する。exitはRendererをdisposeしてから既存のlifecycle終了へ進む。Tutorialのlifecycle処理は無変更。

import完了前にexitした場合はGPUを作らない。handle準備中のexit後にresolveした場合は受け取ったhandleを明示disposeする。旧callbackは新sessionのstyle／surfaceを変更しない。dispose後rejectもcatch済み。

scene.dispose→engine.dispose、独自context listener解除、surface削除。独立loopは0。共有ES module cacheはブラウザーのcacheとして残るが、退出済みscene／Mesh／engineのcacheは作っていない。

## 10. fallback

import／WebGL 2取得／engine初期化／prepare／描画の失敗は2Dへ戻す。shader準備中も2Dを維持。context lossでは自動再構築を選ばず、当該Rendererを破棄して同じbattleを2D継続する。次の入場は新Rendererで試せる。

対象外enemy／stage、旧世代・dispose済みsessionも3Dを表示しない。page reload、save reset、教材再loadは要求しない。

実browser追加故障の証拠は[fault-audit.json](artifacts/v0/run-01/fault-audit.json)と`experiment-fault-*-evidence.json`。取得失敗はCDPのURL遮断で注入し、WebGL取得失敗は装飾canvasだけに注入した。draw例外とattack／defeat中のcontext lossでは故障前後の敵ID・HP・player HP・question tokenが一致。全5runで初回回答可能時点から再入場までの教材データ再requestは0。

## 11. PC-10 / PC-13差分

| PC | 変更箇所・理由 | 回帰条件 |
|---|---|---|
| PC-10 TOUCH | battle.enter／exit。追加GPU資源の寿命を既存画面へ接続するため、Adapter単体だけでは画面退出を検知できない | 旧新両順、後着resource破棄、二重dispose、10往復、既存Tutorial全回帰 |
| PC-13 TOUCH | battle.updateの背景・敵画像・枠塗り、CSSの前後関係。既存2Dの不透明描画が背面3Dを覆うため限定した描画切替が必要 | 同じ矩形、44px操作、48px入力、contain／黒帯、focus、Tutorial、reduced motion |

PC-01〜09／11／12の意味変更なし。battle内の113関数・メソッドはbaselineとAST位置抽出後の本文が一致した。変更対象はenter、exit、update、drawMonsterFrameだけ。

## 12. R-01〜16

| ID | 結果・証拠範囲 |
|---|---|
| R-01 | PASS：freeze snapshotを0／1／複数回。実attack／heal×正誤後のHP／EXP／token／learning／保存全文／予約に変化なし、表示による保存write0 |
| R-02 | PASS：同snapshot連続、timer再発火、敵／session変更 |
| R-03 | PASS：import／prepare reject、永続pendingで即2D選択。実browserのimport遮断／WebGL利用不能でも同じbattle完走 |
| R-04 | PASS：prepare→exit→handle resolveで明示dispose |
| R-05 | PASS：旧→新／新→旧、旧success／failure、新表示権維持 |
| R-06 | PASS：ready前後／二重dispose／dispose後reject |
| R-07 | PASS：単体resize＋Chrome 390×844、844×390、1086×723でcontain一致、入力48px、主要44px維持 |
| R-08 | PASS：実`WEBGL_lose_context`で同じ問題を維持し2D回答、次入場で3D。実OS memory pressureの認証ではない |
| R-09 | PASS：pose各actionのreduced motion、Chrome media切替 |
| R-10 | PASS：装飾canvasへのfocus試行でもkanjiInput維持、inert／Tab除外、composition＋229で正答記録増分0。物理IMEは未実施 |
| R-11 | PASS：通常未読Tutorialを実UIで完了、Guide buttonのhit-test確認、既存正式Tutorial試験維持。既知pad問題は別扱い |
| R-12 | PASS：表示moduleに教材loader／save importなし。failureから教材再起動経路なし |
| R-13 | PASS：E01 3D→E02 2D、exit→reenter、context fallback→回答→reenter |
| R-14 | PASS：hit描画の実draw例外、attack／defeat中のcontext lossでも2D回答・敵交代が継続。primitiveに完了通知は存在しない |
| R-15 | PASS：Chrome practice遷移時canvas1、3Dなし。quickの共有入口は既存正式回帰とnormal-only条件で確認 |
| R-16 | PASS：実Firebase成功接続0、SDKはCSP拒否、receiver0、既存保存APIでsnapshot valid。save形式と教材無変更 |

GLB decoder、skinning、texture asset、実AnimationGroup clip互換は対象外。headless機能試験を全端末／実IME／性能合格へ読み替えない。

## 13. 正式268 regression

| コマンド | PASS | FAIL / cancelled / skipped / todo | exit |
|---|---:|---|---:|
| npm.cmd run test:phase-a | 86 | 0 / 0 / 0 / 0 | 0 |
| npm.cmd run test:phase-b | 22 | 0 / 0 / 0 / 0 | 0 |
| npm.cmd run test:phase-c | 17 | 0 / 0 / 0 / 0 | 0 |
| npm.cmd run test:no-go | 143 | 0 / 0 / 0 / 0 | 0 |
| 合計 | 268 | 0 / 0 / 0 / 0 | 0 |

追加V0は別枠23 PASS。既存test／helperは無変更。ログ：[regression.json](artifacts/v0/regression.json)、各`artifacts/v0/*.log`。

## 14. integrity / build

`node scripts/verify_stage_id_integrity.mjs`：PASS、oldIdHits0、referenced⊆stages。
`npm.cmd run build`：PASS、exit0。Vite CJS、static/dynamic import混在、大きいchunkの警告を保持し、握り潰していない。

main JS 527.13 kB（gzip158.02 kB）、遅延Babylon renderer JS 1,029.40 kB（gzip245.33 kB）。これはbuild出力値でありheaded transfer実測ではない。baseline dist SHA-256 `8effc5c2e2110a2a5c248c431d3552cf2f4772e747a2dee2b527096c2ab43cad`、V0 dist `9bf913445c7e52693891379d1c5eb3fdf997fd705b7777f32d4aa0be432b1db6`。診断04と追加故障runは同じ最終buildを使用した。

## 15. 2D vs V0 Benchmark

2026-09-08 JSTにB1→V1→B2→V2→B3→V3の順で6run完了。各runのsetup画面で停止し、ユーザーから別々の「準備完了」を受領後、15秒の復帰時間を置いて測定した。前runの返信を次runへ転用していない。共通のbatch-human-readyファイルは作成していない。

Windows、Chrome **152.0.7977.82**、DPR **1.5**、screen **1280×800 CSS px**、inner **1086×723**、headed専用Chrome、新規profileを全6runで確認。各profileの初期localStorage／sessionStorage／IndexedDB／Cache／SWは空。E0のbaseline origin49721、V0 origin49722、receiver49723、同一fixture・CSP・既存buildを使用した。OSのfile cacheやGPU driver cacheを消去した試験ではない。

測定中のvisibility hidden、1秒pollでのfocus=false、minimizedは全6runで0。1秒poll数はB1/V1/B2/V2/B3/V3で40/38/40/39/39/40。run／probe／source-points／Chrome制御／foreground監視等の測定tool hashは6run一致。失敗runの除外・再試行・timeout無視はない。前回のheadless診断値はこの性能比較に含めない。

集計：[foreground-details.json](artifacts/v0/run-01/foreground-details.json)、[analysis.json](artifacts/v0/run-01/analysis.json)。元データは同じdirectoryのbaseline-cold-B1〜B3-evidence.json、experiment-cold-V1〜V3-evidence.json。各runのhuman-ready.json、foreground.jsonl、sourceコピー、profile、battle.pngも保持した。

T1はN0（game document navigation）から保存session準備を含むtitle操作可能境界まで。6runとも非停止source境界のexactBoundary=true。E0A0Sは有効stage確認操作から、Tutorial終了・入力／attack／healのhit-test・有効question tokenを満たす正式回答可能点まで。3D readyはこの条件に含めない。単位ms、差はV−B。

| 組 | B T1 | V T1 | 差 | B E0A0S | V E0A0S | 差 |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 272.6 | 126.2 | -146.4 | 2035.9 | 1990.5 | -45.4 |
| 2 | 129.0 | 133.1 | +4.1 | 2013.1 | 1993.0 | -20.1 |
| 3 | 170.5 | 146.5 | -24.0 | 2008.4 | 1974.2 | -34.2 |

T1は全組で+30ms以内。3組一貫+50ms超、E0A0Sの一貫+100ms級増加はない。B1 T1はB2/B3より長いため、1組目の負の差をBabylonによる高速化とは解釈しない。Tutorial・自動操作の時間を含むE0A0Sから、初期化CPU時間が0という結論も導かない。**意図的な3D待ちの追加は0ms**という判断は、既存ready条件・timerへの依存追加0と前回のpending／failure試験を合わせたもの。

以下は入力U0→次の正式回答可能AS。defeatは最後の致死攻撃だけを抽出し、HP0→E02も併記。再入場はbattle.enter→ASで、stage選択クリックや3D readyまでの時間ではない。単位ms。

| run | 正答attack | 誤答attack | heal | 致死attack→AS | HP0→E02 | 再enter→AS |
|---|---:|---:|---:|---:|---:|---:|
| B1 | 1329.4 | 3025.0 | 1973.0 | 1034.9 | 1027.4 | 1.5 |
| V1 | 1327.6 | 3031.3 | 1973.6 | 1025.4 | 1017.9 | 1.8 |
| B2 | 1325.5 | 3039.2 | 1988.0 | 1025.7 | 1018.6 | 1.4 |
| V2 | 1321.7 | 3023.5 | 1973.4 | 1025.2 | 1017.5 | 1.5 |
| B3 | 1324.5 | 3029.9 | 1978.3 | 1022.0 | 1014.3 | 1.7 |
| V3 | 1323.3 | 3028.9 | 1982.2 | 1022.8 | 1015.9 | 1.6 |

正答attack差は−3.8〜−1.2ms、誤答attack差は−15.7〜+6.3ms、heal差は−14.6〜+3.9ms、致死attack差は−9.5〜+0.8ms。既存1〜3秒級のcontroller演出待ちが主体で、3D clip時間を次問へ追加した証拠はない。各runの乱数による問題・critical・BGMを固定しておらず、致死攻撃までの追加attack回数はB1/V1/B2/V2/B3/V3で3/2/3/2/2/3。総defeat-sequence時間の単純比較はしない。

全runでHKD-E01→HKD-E02、stageSelectへの退出、同stageへの再入場とAS到達を完了。VのE01 sphere表示はbattle.pngで確認し、E02では既存対象外2D経路へ移行した。実context loss／import failure等の故障注入は前回の独立診断を継承し、今回の6runへ故障probeを追加していない。

## 16. Network delta

N0→A0Sまでに完了した同originのencodedDataLengthを合計した。E0制御endpointは除外。単位byte、HTTP headerを含む実転送値。圧縮なし／no-storeのloopback条件であり、公開CDNのgzip転送量ではない。取得済みの全資源を回答に必須の資源と呼ぶものでもない。

| 組 | B N0A0S transfer | V N0A0S transfer | 差 | V Babylon追加5資源 |
|---|---:|---:|---:|---:|
| 1 | 30740638 | 32124960 | +1384322 | 1180095 |
| 2 | 30941256 | 32124960 | +1183704 | 1180095 |
| 3 | 30941256 | 31924342 | +983086 | 1180095 |

Babylon固有の追加取得は3runとも**1,180,095 bytes（1.180 MB、約1.125 MiB）**。内訳はrenderer chunk 1,030,135、default vertex 30,667、default fragment 108,815、logDepthDeclaration 2,915、helperFunctions 7,563 bytes。core以外のloader packageやGLB取得はない。全5資源はA0S前に取得完了し、T1以前のBabylon取得完了は0。実request開始もbattle.enter後である。

総転送差の揺れは既存BGMのa/b選択で説明できる。北海道BGMのaとbは約200,618 bytes差があり、1組目はV側が大きいb、3組目はV側が小さいa。2組目は同じb。この差を除く総増分は各組とも1,183,704 bytesで、そのうち1,180,095 bytesがBabylon、残り3,609 bytesがmain JS／CSS等とHTTP header差。資源別差分はforeground-details.jsonのcriticalDiffsに保持。

外部HTTP(S)成功responseは全6runで0、Firebase SDKはCSPで拒否、receiver受信0、global firebaseはundefined。新しいMB hard limitは設定していない。

## 17. CPU / frame delta

idleはE01で操作しない区間。指定sleepは10秒だが監視付き小刻みwaitの実測wall timeは約12.3〜12.4秒なので、CPUを固定10秒で割らず、CDP Timestamp差で正規化した。CPU = 100 × ΔTaskDuration / ΔTimestamp。これはrenderer main-threadのTaskDurationに基づく比率で、Windows全CPU使用率やGPU使用率ではない。同一観測probe・CDP処理を含むpaired比較。

| run | frame数 | median ms | p95 ms | max ms | >33ms | >50ms frame | idle秒 | TaskDuration秒 | idle CPU % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B1 | 743 | 16.7 | 16.9 | 17.4 | 0 | 0 | 12.401 | 2.042711 | 16.47 |
| V1 | 735 | 16.7 | 16.9 | 17.5 | 0 | 0 | 12.277 | 2.471649 | 20.13 |
| B2 | 743 | 16.7 | 16.9 | 17.6 | 0 | 0 | 12.410 | 2.035628 | 16.40 |
| V2 | 739 | 16.7 | 16.9 | 17.6 | 0 | 0 | 12.334 | 2.505817 | 20.32 |
| B3 | 740 | 16.7 | 16.9 | 17.6 | 0 | 0 | 12.356 | 2.034926 | 16.47 |
| V3 | 739 | 16.7 | 16.9 | 17.8 | 0 | 0 | 12.333 | 2.484378 | 20.14 |

paired CPU増分は**+3.66 / +3.91 / +3.67 percentage points**。3組とも+5pt目標以内で、+10pt級一貫には該当しない。idle median16.7ms、p95 16.9msを維持し、idle >20ms、>33ms、>50ms frameは全runで0。

通常操作区間の最大rAF間隔とstall数を以下に示す。defeatは致死攻撃までの全追加attackを含む。区間内p95は全て16.8〜17.1ms。Long TaskはPerformanceObserverで検出した50ms超のmain-thread taskで、rAF間隔とは別に数える。

| run | 正答 max ms | 誤答 max ms | heal max ms | defeat max ms | 区間合計 >33ms | >50ms frame | idle/回答 Long Task |
|---|---:|---:|---:|---:|---:|---:|---:|
| B1 | 17.5 | 17.4 | 17.5 | 17.4 | 0 | 0 | 0 |
| V1 | 17.0 | 17.3 | 17.1 | 33.4 | 2 | 0 | 0 |
| B2 | 17.3 | 17.3 | 17.3 | 33.3 | 1 | 0 | 0 |
| V2 | 17.6 | 17.4 | 17.4 | 33.4 | 1 | 0 | 0 |
| B3 | 17.2 | 17.5 | 17.3 | 33.4 | 1 | 0 | 0 |
| V3 | 17.4 | 17.6 | 17.6 | 33.4 | 1 | 0 | 0 |

33ms超はすべて撃破直後の短い区間に発生。B合計2/4,825 frame、V合計4/4,697 frame（約0.04%／0.09%、E02 idleも分母に含む）。V1は33.4msが2回連続、V2/V3は各1回。頻発・持続p95悪化とは判定しないが、追加分の原因をCPU traceなしでBabylon／既存処理のどちらかへ断定しない。通常idle・回答区間の50ms超frame／Long Taskは0。E02の約2.4秒idleでも>33msは0。A0S以後から退出／再入場までのLong Taskも0。

**初回準備時のstallは残る。** BのN0→A0SにLong Taskが各6件（max117/122/125ms）、Vには各7件（max165/156/169ms）。Vで増えた1件は初回Babylon module取得後・scene準備付近、A0S前のTutorial表示中に発生した。V1はN0+7066.5msから165ms、V2は7544.0msから156ms、V3は7104.6msから169ms。実行時間帯の一致はあるが、今回はCPU stack traceを取得していないためcompile／engine作成／shaderの内訳は未確定。

このcold初期化の単発stallを除外して「50ms超が全くない」とは報告しない。承認済みV0 Budgetの通常idle／回答中の反復stall条件、T1、E0A0Sの差を評価した結果は合格。再入場では同じstallは観測されなかった。Tutorial既読のcold初回入場やGLB追加時の応答性へ、この結果を無条件に外挿しない。今回は追加最適化・Babylon構成変更をしていない。

## 18. lifecycle 10往復

成功証拠：[experiment-diagnostic-04-evidence.json](artifacts/v0/run-01/experiment-diagnostic-04-evidence.json)。10回とも同じ結果。

| 資源 | 入場 | 退出 |
|---|---:|---:|
| Renderer session | 1（固有番号2〜11） | 0 |
| Babylon engine / scene | 各1 | 各0 |
| Babylon canvas | 1（全canvas2） | 0（全canvas1） |
| observer | 3 | 所有scene／engine破棄 |
| DOM listener | 11 | 0 |
| procedural animation状態 | 1 | 0 |
| 独立render loop | 0 | 0 |
| WebGL Buffer | 13 | 0 |
| WebGL Program | 1 | 0 |
| WebGL VertexArray | 2 | 0 |
| Texture／Shader／Framebuffer／Renderbuffer／Query | 0 | 0 |

listenerは登録／解除の実呼出し、GPUはcreate／deleteを外付けprobeで監査した。observerは対象objectのObservable登録数、session等はAdapterの所有状況を読む。GPU process memoryのMB値や全retainer完全解析ではない。ES module cache、従来Image cache、測定bufferは画面固有GPU資源と別扱い。

今回のheaded性能6runへ資源create/delete監視を追加していないため、10往復の細かな資源数は上記の前回診断値を継承する。今回確認したのは全6runの退出・再入場・回答可能への復帰と、V0のlifecycle実装が固定hashのままという点。共有module cacheと画面固有資源の区別は変更なし。

## 19. Save / Learning diff

今回のheaded6runの**102 snapshot**を追加し、計267 snapshotをstableのreadSaveStateでoffline検証して全valid。検証Storageはwrite禁止。267件には前回の失敗診断02/03の途中snapshotを含み、267回の独立プレイという意味ではない。[audit.json](artifacts/v0/run-01/audit.json)にrun・step・raw hashを保存。

各自然回答のquestionId／source（attack、heal）／correct／supportを保存lastObservationと照合した。全6runでE01→E02、敵10／pool40、未clear／checkpoint未追加を維持。各run内でE02回答後→exit→reenterのstudyはdeep-equal。表示が採点・保存・SRSを書き換えた証拠はない。異なるrunのUUID・問題・critical・回答件数・時刻は異なるため、BとVのsave全文byte一致を主張しない。

baseline由来のsrc／public／testsでbattle以外4,097ファイル、battleの保護関数113本の一致を再確認。今回の測定開始前に固定したbattleScreen・visual3ファイル・style.css・package.json・lockfileのhashも測定後一致。測定中の実装変更0、依存変更0、再build0。正式268＋V0 23、integrity／buildは14節までの同じ製品状態のPASSを継承し、無変更のため再実行していない。main／stable tag／既存未コミット作業に変更を加えていない。

## 20. Known 2D issues

`KNOWN-2D-PAD-TUTORIAL = REPRODUCED`を継承。今回修正していない。主比較は従来手順でpad OFF。3D追加後もGuideの前面位置・button hit-testを維持し、pad ONの表示確認を別記録にする。

resultWin centerBox fallback、実mobile／物理IME／音の実聴／学校端末／公開配信等のBL-01〜13の制約も継承する。headlessの390pxエミュレーションを実mobile認証としない。

headed6runでもpad OFFで従来Tutorialを完了し、入力・attack・healのhit-testをAS条件で確認した。前回の故障5種と10往復のheadless結果は機能証拠として保持し、headed性能値に混ぜていない。

## 21. STOP判定

| 条件 | 判定・根拠 |
|---|---|
| save／learning／SRS／stage progression／268回帰 | 該当なし。製品hash不変、102追加snapshot valid、保護対象一致 |
| 3Dが回答開始を条件としてblock | 該当なし。ready条件追加0、pending/failureでも2D、E0A0S差−45.4/−20.1/−34.2ms |
| clipが採点／次問／敵交代を遅延 | 該当なし。既存timer無変更、action/defeat測定で一貫した遅延なし |
| T1一貫+50ms超 | 該当なし。差−146.4/+4.1/−24.0ms |
| p95 >20ms持続 | 該当なし。V idleは全て16.9ms |
| 新規33ms超frame頻発 | 該当なし。V4/4697、撃破直後のみ。Bにも2/4825あり、V1の2連続を記録 |
| 通常idle／回答中の反復50ms超stall | 該当なし。全6runで0。初回準備の単発156〜169msは残存課題 |
| idle CPU一貫+10pt級 | 該当なし。+3.66/+3.91/+3.67pt、+5pt目標内 |
| focus／Tutorial／tap破壊 | 該当なし。foreground監視違反0、正式入力と操作hit-test成立 |
| fallback不能／退出資源累積 | 該当なし。対象外E02と再入場を完了。実故障5種・10往復診断は同一製品状態でPASS |
| 限定Adapterでは成立せず大規模移植必要 | 該当なし。今回追加の製品変更は0 |

現BudgetのSTOP条件に該当する反復悪化を認めない。初回module／scene準備付近の単発stallは実在し、V1aでcold入場を評価する際の観測点として残す。これを消すためにPROTECTED COREを変更したり、今回は最適化を加えたりしていない。

前回診断01は巨大JSON保存でRangeError、02/03はprobe挿入の区切り不足で失敗した。これらは前回の測定tool不備の記録として保持し、成功に再分類しない。今回のheaded6runは全て初回の測定で成功し、悪いrunの差替えはない。

## 22. Blender開始可否

**V0 GO  READY FOR BLENDER V1a**。

指定Windows／Chrome152／DPR1.5条件で、既存2D学習ゲームの進行を保ちつつ、限定Adapterでprimitive 3D描画層を追加する実証は完了した。V1aへ進むためのV0条件を満たしたという判定であり、完成GLB・texture・skinning・実mobileの性能を認証したものではない。初回準備stall、既知2D問題、既存baselineの制約は記録したまま継承する。

ユーザー指示に従い、このセッションではBlender、GLB、追加最適化、Babylon構成変更を開始しない。

## 23. 次工程

今回の未実施項目だったheaded foreground性能比較3組と15〜23節の更新は完了。個別の準備完了、raw、CPU／frame／network集計、save監査、固定hashをartifacts/v0/run-01に保持した。

次工程は別タスクとして承認されたV1aの範囲で進める。その際はV0のAdapter・fallback・Core保護を維持し、assetを含むcold準備のstall、転送、定常frame／CPU、退出資源を改めて測定する。main統合・他9体3D化・47面展開は今回行っていない。

**V0 GO  READY FOR BLENDER V1a**
