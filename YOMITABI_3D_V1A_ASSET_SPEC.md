# 漢字ヨミタビ — V1a HKD-E01 Asset Specification

仕様版：1.0.0／作成日：2026-09-08 JST  
対象：HKD-E01 ジャガイモスライムのみ。**今回は仕様策定完了。モデル制作・GLB接続・V1a実測は未実施。**

## 1. Executive Decision

**rounded low-poly stylized、object transform animation、export時1 mesh・1 primitive・1 PBR material・texture 0枚を採用する。Armature、skin、morphは使わない。** 元画像の丸いジャガイモの体、広がった裾、縦長の黒い目、U字の笑顔、左右2本の芽を残す。`idle` / `attack` / `hit` / `defeat` の4 clipを制作する。

V0のBattle Visual Adapterを外部契約の基準とする。後続実装ではsphere生成とprocedural poseをGLB資源・clipの表示処理へ置き換える。loader・検証・後着破棄は新たに必要であり、URL変更だけで実装が完了するという意味ではない。camera、light、仮背景、canvas stack、battle controllerの所有権は維持する。

本書の寸法・面数目標・animation振幅は、この画像と232×112論理pxの表示枠に対する**制作規約**。性能保証値ではない。見た目と負荷の合否は実GLBで判定する。V0のGOをGLBのGOへ読み替えない。

全文確認した文書：

- [V0 Technical Slice Report](YOMITABI_3D_V0_TECHNICAL_SLICE_REPORT.md)：最終V0 GO、Adapter、実測、156〜169ms cold stall。
- [V0 Git Freeze](YOMITABI_3D_V0_GIT_FREEZE.md)：commit単独の268＋23 PASS、tagとremote backup。
- [Tech Decision](../../../../YOMITABI_3D_TECH_DECISION.md)：採用技術、交換境界、asset pipeline。
- [Experiment Plan](../../../../YOMITABI_3D_EXPERIMENT_PLAN.md)：E0、比較手順、R-01〜16、段階制作。
- [2D Stable Baseline](YOMITABI_2D_STABLE_BASELINE.md)：PC-01〜13、正式回帰、既知残件。

古い文書の未実装・未固定という記述は当時の履歴。現在のV0状態はTechnical Slice ReportとFreezeを優先する。今回のGit読取り結果は次の通り。

| 項目 | 確認値 |
| --- | --- |
| 作業worktree | `C:/kanji-game-latest/artifacts/yomitabi-e0/worktrees/experiment` |
| branch / HEAD | `experiment/3d-vertical-slice` / `15ee0be672ca8ec56e773a75959ce9535877cb19` |
| V0 tag | `yomitabi-3d-v0-babylon-2026-09` |
| V0 tag object / 展開先 | `76e5c7210888ba5f3bf79b86d5e35be86f5b3158` / 上記V0 commit |
| E0 | `034915d4133782cc1eff872134e5b8fde04e4bac` |
| main / 2D stable tag展開先 | `2a521dd5aa747314b25e761d976bd4f880cd58c3` |
| 既存依存 | `@babylonjs/core` 9.25.0。loader未導入 |
| 開始時tracked差分 / index | ともに空 |

既存未追跡のFreeze文書、`tools/benchmark/`、`tools/benchmark-b05/`、`tools/benchmark-b06/`、`tools/v0/prepare-tools.mjs`、`prepare-fault-runner.mjs`を保持。Git参照・indexへ書き込まない。remoteは今回fetchせず、Freezeの確認済み記録を継承する。

## 2. HKD-E01既存デザイン分析

実際に確認した画像は [HKD-E01.webp](public/assets/images/monsters/full/grade1-hokkaido/HKD-E01.webp)。500×500のpixel artで、`assetsLoader.loadMonsterImage()`がgrade 1で最初に試すfull画像である。SHA-256：`EE2A5E2456227D92EFDF4824E7D8B17D3BABD74165BD81BF70816E699155110E`。サムネイルや別の候補画像を原案にしていない。

| 観察対象 | 元画像で確認できる特徴 | 3Dで残すもの |
| --- | --- | --- |
| シルエット | 大きな丸い塊、下部の横に広がった裾、頭頂から離れて伸びる2本の芽 | 「丸い体＋裾＋2本の芽」を一目で読める外周。球だけにはしない |
| 体型 | 頭と胴が一体。上が丸く、下に重さがある。裾は体より広い | 独立した頭・首・手足を追加しない。裾を靴や左右の足にしない |
| 顔 | 正面の広い平面に近い領域に、左右の目と中央の笑顔 | 鼻・眉・頬紅・歯・舌を追加しない。顔の周囲を斑点で混雑させない |
| 目 | 黒に近い縦長の楕円が左右に1つずつ。大きな白目はない | 明確な黒い楕円。極小の点目や大きな白目へ変えない。新しい強いハイライトなし |
| 口 | 黒いU字状の微笑み。歯のない簡単な線 | 正面で読めるU字。既存の親しみやすい表情を維持 |
| ジャガイモらしさ | 黄土色の皮、茶色のまばらな斑点、少し不均一な輪郭 | 滑らかなゼリーではなく、丸みと軽い凹凸のあるイモ。細密な皮textureは不要 |
| 芽／突起 | 左右2本、少し外へ開く。根元が暗い茶〜オリーブ、先が黄緑〜黄色 | 各1本の短い折れを持つ芽。耳、枝角、巨大な葉冠へ変更しない |
| 色 | 黄土〜橙茶のbody、暗褐色の下部、黒褐色の顔、控えめな黄緑の芽 | 暖色のbodyと少量の芽色。透明・発光・高彩度の緑スライムにしない |
| 親しみやすさ | 微笑みと丸い体。鋭い牙や威嚇顔なし | 攻撃・被弾も姿勢で表す。恐怖表現や幼児向けの装飾を足さない |

pixel単位の階段状outlineは3Dへ転写しないが、外周の分かりやすさは残す。元画像に描き込まれた強い陰影・黒縁を全てmeshにすると情報量が増えるため、色の境界と低密度形状、既存lightで置き換える。

実データは [enemies_proto.json](public/data/enemies_proto.json) と [stages_proto.json](public/data/stages_proto.json) を確認した。

| 保持対象 | 現在の値・規則 |
| --- | --- |
| ID / name / stage | `HKD-E01` / ジャガイモスライム / `hokkaido_area1`（北海道奥地） |
| grade / weakness / boss | `1` / `onyomi` / `false` |
| 設定 | category=食文化、habitat=畑。丸いイモの体、芽がツノのように伸び、土中を転がるという既存説明 |
| enemy順 | `HKD-E01`〜`HKD-E10`、10体中先頭、index 0 |
| stage pool | `g1-001`〜`g1-040`、40字 |
| HP / ATK | JSONに固定HP/ATKはない。`battle.enter`→`computeEnemyParams`の既存計算。V0新規fixtureでHP31・ATK9。player条件で変わる値をassetへ固定しない |

HP、ATKの式・呼出し条件、grade、弱点、順序、pool、教材、stage progression、save、learning、SRSの変更は0とする。他9体、図鑑、捕獲、practice／quickの2D画像も保持する。

## 3. 3D Art Direction

rounded low-poly stylizedを採用する。輪郭には丸みを残し、面の変化は弱い程度にする。写実的な皮・水分・透明感、複雑toon shader、outline pass、post processを前提にしない。

顔のあるbodyを中心に面を配分し、斑点は少数の色面とする。芽は左右をわずかに非対称にして元画像の自然さを残す。目を拡大し続けたり、頭身・頬・口を幼児向けへ寄せたりしない。既存漢字と回答UIが視線の主対象であり、idleは小さな呼吸程度に留める。

評価は拡大Blender viewportだけで行わない。既存232×112論理px枠への等比fitと、800×600がcontainで縮小された実表示を必須にする。固定camera正面で「ジャガイモ」「スライム」「笑顔」「2本の芽」を確認でき、短い動きから厚みや弾力が伝わることを狙う。小さい枠の制約をUI全面変更で解消しない。

V1a接続時のcamera、ambient相当、主光源、仮背景はV0と同じ条件。新しい接地影pass、environment texture、背景asset、camera shakeは追加しない。材質の明るさ・faceの見え方は実Babylonで比較し、BlenderのMaterial Previewだけを完成基準にしない。

## 4. Model Specification

以下は初号assetの数値規約。寸法はneutral pose・芽と裾を含む。数値許容差は制作・export検査用であり、3Dの全キャラクター共通の性能上限ではない。

| 項目 | 規約 |
| --- | --- |
| 制作単位 | Blender Metric、Unit Scale=1.0。1 Blender unitをGLBの1mとして書き出す。架空生物の実身長設定ではなく正規化規格 |
| neutral全体寸法 | 幅X=1.00、奥行Y=0.62、高さZ=1.08。各±0.02以内 |
| body / 裾 / 芽 | body幅約0.86、Z約0.10〜0.85。裾の最大幅1.00、厚さ約0.08。芽の先端で全高1.08 |
| 原点・接地 | 床に接する裾の中央、(0,0,0)。制作接地面Z=0。中央のfloor pivotを全同系統モデルで共有 |
| Blender方向 | +Z up、正面−Y、横方向X。mesh頂点をこの向きで制作 |
| GLB方向 | +Y up、正面+Z。exporterの+Y Upで変換。後述のBabylon向き補正と二重適用しない |
| neutral bounds | Blender min=(-0.50,-0.31,0)、max=(0.50,0.31,1.08)。GLB min=(-0.50,0,-0.31)、max=(0.50,1.08,0.31)。各成分±0.02を許容 |
| mesh構成 | 制作用body・裾・芽2本・目2つ・口は別objectで編集可。export複製では1 meshへjoinし、1 material slotに統一。接続されない頂点島は可 |
| 顔 | 目は幅0.12×高さ0.17程度、中心X=±0.16、Z≈0.55。口幅0.26・U字高さ約0.08・線厚0.025〜0.035、Z≈0.38 |
| 顔の持ち方 | 低面数の浅い黒色geometryをbody曲面へ沿わせる。表面から法線方向0.003〜0.008程度離し、交差・Z-fightingなし。全て同じexport meshの一部 |
| shading | body・裾・目はsmooth normals。芽は輪郭の折れだけedgeを残す。全面flat shadingや極端に高光沢な丸球にはしない |
| modifier | Mirror等は制作中可。export用複製で適用→法線確認→Triangulateを適用。Subdivision、Solidify等を未適用で残さず、評価meshを固定 |
| hidden faces | body内部に埋まった芽・顔の裏面、重複面、試作objectを除く。見えないからと外殻の背面・底を全削除し、傾きで穴が出る状態は不可 |
| transform apply | animation制作前にmeshのRotation/Scaleをapply。親とmeshのneutral local TRSは位置0・回転identity・scale1。頂点座標でfloor原点へ合わせる。animation開始後に全actionへCtrl+Aを掛けない |
| 禁止transform | author側の負scale、shear、0 scale。defeatもscale各軸0.02以上。loaderが作る座標変換用負scaleは別扱い |

初回modelingの目安は**export後600〜1,200 triangles**。body・裾400〜800、芽と顔200〜400を出発点とする。1,600を超える場合は、輪郭に必要な箇所と低面数比較を制作記録へ残す。1,600超を自動性能FAIL、1,200以下を自動PASSとはしない。export後のvertices、indices、buffer bytes、draw callsを実測する。色境界・法線境界で頂点が増える点も記録する。

全clipの表示用包絡は、GLB座標で **min=(-0.66,0,-0.40)、max=(0.66,1.20,0.40)** に収める。neutral boundsと全clip包絡を混同しない。各clipをsampleして接地・最大変形を検査し、姿勢補間中のはみ出しも確認する。§6の移動・scale・回転の最大値を同時に使う必要はなく、組合せ後の包絡を優先する。突進の最遠点では傾きを戻すなど、枠内で読めるposeを制作する。

232×112枠では内側余白を左右12、上下6論理pxとする。現cameraの100論理px/Babylon unitに対し、共通等比scaleは `min((rect.width-24)/(100×1.32), (rect.height-12)/(100×1.20))`。この枠では約0.8333、neutral高約90px・幅約83px、包絡最大110×100px。横に余白があることを理由に横伸ばししない。floorをrect下端−6px、Xをrect中央へ配置する。微小・無効rectは2Dへ戻し、毎frameの現在boundsで拡大率を変えない。

glTFの右手系、Y-up、単位とTRSは[glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#coordinate-system-and-units)を根拠とする。上の寸法・包絡・fitは本作の設計判断。

## 5. Rig Decision

| 方式 | 4 clipへの適合 | 同系統へ再利用 | 今回の判断 |
| --- | --- | --- | --- |
| A. bone rig | 部位ごとの曲げ・芽の揺れを作れるが、weight、rest pose、skin、骨の検査が増える | 骨名と体型比率を揃えれば可能 | 手足も局所変形も必須でなく不採用 |
| B. shape key / morph | 滑らかな潰れ、口・目の変化に強い | topologyと頂点対応に依存。別meshへそのまま転用しにくい | 初号の4反応に対して制作・データ管理が増えるため不採用 |
| C. object transform animation | 全体の小さな伸縮、短い移動、傾き、縮小で4状態を表現可能 | 同じfloor pivot・寸法・node名ならActionを再利用しやすい | **採用** |
| D. 組み合わせ | 表現幅は広い | 複数の仕組みと資源を管理する必要 | 初号では追加価値が小さく不採用 |

静的rootの下に共通名`SlimeMotion`を置き、この1 nodeのTRSだけをanimation対象にする。顔と芽も同じmeshとして追従する。手足のないbodyにArmatureは必須ではない。

同系統のスライムは制作templateの寸法・floor pivot・`SlimeMotion`・4 Actionを共有する。別体型へ自動retargetできるとは保証しない。芽の独立した揺れや複雑な表情を理由に初号へbone/morphを足さず、必要ならこの仕様を別版として見直す。今回は他モンスターへtemplateを適用しない。

## 6. Animation Specification

clip名はASCII小文字、完全一致で **`idle`、`attack`、`hit`、`defeat`**。接頭辞・`.001`・大小文字違いを認めない。制作60fps、下表のframe 0開始、終端を含む。GLB内時刻は秒。4 clipとも`SlimeMotion`のtranslation / rotation / scaleを先頭・終端で定義し、切替後に前clipのscaleが残らないようにする。

| clip | 制作時間 / frame | 目的・動き | loop / 開始・終了pose | 表情 / root移動 |
| --- | --- | --- | --- | --- |
| idle | 2.00s / 0〜120 | ごく小さい呼吸。高さscale 0.98〜1.02、横scale 0.99〜1.01、上下移動最大0.01 unit | loop。開始と終了はneutral、接続時の速度変化を小さくする | 笑顔固定。world root固定。芽と目も全体に追従 |
| attack | 0.75s / 0〜45 | 0〜20%で軽く溜め、20〜50%で画面左への短い突進、50〜100%で戻る。Blender local Xは+0.04〜−0.18、Y前方は−0.06以内。scale各軸0.92〜1.06、傾き最大6° | one shot。neutral→neutral。接触判定・SE発火なし | 笑顔固定、威嚇顔なし。`SlimeMotion`の一時offsetのみ。root motionの蓄積なし |
| hit | 0.50s / 0〜30 | 最初の25%で小さく潰れ、25〜100%で戻る。高さ0.88〜1.00、横1.00〜1.08、正面に対する傾き最大5°。連続振動なし | one shot。neutral→neutral | 笑顔固定。材質点滅なし。静的rootは移動しない |
| defeat | 1.00s / 0〜60 | 最初の30%で高さ0.75程度へ沈み、その後小さく縮む。傾き最大12°。終端scale=(0.02,0.02,0.02)、translation=0 | one shot。neutral→小さい終端pose。loopしない | 顔texture交換・死亡顔なし。透明度animationなし。root固定、下方へ突き抜けない |

回転・潰れで床より下に頂点が出る場合は、Motionのローカル高さを補正する。高さ補正を含め§4の包絡内に収める。物理simulationや落下計算にはしない。root移動禁止は「配置を所有するrootをclipで動かさない」という意味で、子Motionの上記局所offsetは許可する。

現在の [battle/theme.js](src/screens/battle/theme.js) はdamage=500ms、attack=750ms、defeat=1,000ms。`battleScreen.update()`がtimerを減らし、0でactionをnullにする。`waitForDefeatAnimationThen()`もこの既存状態・世代・期限を使う。これらの定数・待ち条件は変更しない。

| 既存snapshot | 選ぶclip・表示上の意味 |
| --- | --- |
| null等 | idle |
| `enemyAction === 'attack'` | 敵の反撃としてattack。プレイヤーの正答attackとは別 |
| `enemyAction === 'damage'` | プレイヤーの非致死攻撃を受けたhit |
| `enemyAction === 'defeat'` | 撃破表示。致死攻撃ではhitが上書きされることを許容 |
| heal | 独自heal clipは追加しない。既存controllerが示すenemyActionに従う |

表示時計はV0方式を継承する。generation / session / enemyIndex / enemyId / actionの変化、または同じ非idle actionで残timerが前観測より1ms超増えた時だけ、新しいactionとする。同snapshotを複数回受けてもrestartしない。

one shotは発火を初めて観測した残timerをDとして保存し、`p=clamp(1-currentTimer/D,0,1)`をclip区間へ写す。通常の連続観測では現timerに同期する。準備中も表示側で最新snapshotとこの発火状態を保持し、GLBが後着した時は**現在のp**から提示する。履歴を観測できなかった場合は最初に見た残区間へ合わせ、既に終わったattackを後から一周再生しない。制作clipが長くても既存timerへ合わせ、切替が早ければ中断する。

idleだけは既存dtから表示用時間を進める。clampされたlogic dtを性能frame測定に流用しない。同じ敵のHP0／defeat後は表示側で終端poseを保持し、timerがnullになって敵交代までの間にneutralへ戻るちらつきを防ぐ。この保持は見た目だけで、HP・敵交代の条件を変更しない。

AnimationGroupの終了通知からHP、採点、save、learning、SRS、入力解除、次問、EXP、capture、stage clear、enemy changeを実行しない。終了通知はゲーム進行に一切不要。root motion extraction、独自setTimeout、独立render loopも不要。

reduced motionではidle / attack / hitをneutral静止、defeatをV0と同様の静的scale 0.25とする。途中ONで即静止し、OFFで現在のaction進捗へ合わせる。過去の動きを巻き戻して再生しない。正誤情報は既存UIに残す。

## 7. Material / Texture

| 選択肢 | 長所 | 負担・見た目差 | 採否 |
| --- | --- | --- | --- |
| vertex color | 画像取得・decode不要、paletteを1材質にまとめやすい | 色境界で頂点増加。細かい図柄には不向き | **採用。色属性1個** |
| Babylon StandardMaterial | V0で検証済み、単純 | BlenderのglTF標準PBR材質をそのままStandardへ変換する仕様ではない | 仮背景は現状維持。GLB monsterには使わない |
| glTF metallic-roughness PBR | Blender Principled→GLB→Babylonの標準経路 | V0のStandardとshader・初回準備負荷が変わる。実表示比較が必要 | **monsterの1材質として採用** |
| 小texture / palette atlas | 少ない頂点で模様や細部を持てる | UV、画像bytes、decode、upload、filtering検査が増える | 初号不採用 |
| 顔だけtexture | 描き直しや表情差分を作りやすい | face planeの透過・ちらつき、atlas管理、縮小時の滲みを検査する必要 | 初号不採用。顔はgeometry |

BlenderはColor Attribute `Color`をPrincipled BSDFのBase Colorへ接続する最小構成。出力は`COLOR_0`のみ、PBR baseColorFactorは白(1,1,1,1)、metallic=0、roughness=0.9、alpha=1、emissive=0、doubleSided=false。同じ色をvertexとbaseColorFactorへ二重に掛けない。normal／AO／metallic-roughness／emissive textureは0。UV・tangentも初号では出力しない。

paletteの制作開始値はbody `#C89442`、明部 `#D5AA5A`、斑点 `#AA7135`、下部 `#865022`、芽の根 `#625429`、芽の先 `#B8B35C`、目・口 `#201A12`。これは目視参照から選んだsRGBの制作値であり、原画像全pixelの自動抽出値ではない。斑点は正面で6〜10箇所程度、眼や口より低contrast。強い影を固定色で全面に描き込まない。

色値はBlenderの色入力を通し、exported vertex colorのlinear値へsRGB byteを無変換で詰めない。Babylon側で追加の独自gamma変換を掛けない。Blender作業previewはStandard view transform、exposure 0、gamma 1を比較用に固定するが、lightや表示変換の差によりpixel一致を保証しない。

材質互換の根拠は[Blender 5.2 glTF material説明](https://docs.blender.org/manual/fr/5.2/addons/scene_gltf2.html#materials)、色属性とPBRの関係は[glTF mesh attributes](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#meshes)。制作presetの出力を検査し、顔が暗すぎる場合はまずこのpalette・形状の範囲で調整する。outlineやshaderの追加を自動解決策にしない。

GLB monsterの目標draw callは1（単一pass時）。現仮背景分は別。1 meshでもmaterial slotやexport primitiveが増えればdraw callが増え得るため、mesh数だけで合格にしない。Scene全体のdraw callとshader variantを診断で記録する。

## 8. Naming Convention

現repoは`public/assets/images/`、`public/assets/audio/`で配信資源を管理している。3D成果物は同じ`public/assets/`配下に独立した`3d/monsters/`を設ける方針とする。下記は**将来配置の規約であり、今回作成したファイルではない**。

| 対象 | 固定名・候補配置 |
| --- | --- |
| GLB | `public/assets/3d/monsters/HKD-E01/HKD-E01.v1a.1.glb` |
| runtime URL | `/assets/3d/monsters/HKD-E01/HKD-E01.v1a.1.glb` |
| asset version | `v1a.1`。GLB bytesを修正したら`v1a.2`等へ更新し、同URLへ別内容を置かない |
| spec / manifest schema version | 本書1.0.0 / manifest schema 1。glTFの`asset.version="2.0"`とは別 |
| 制作master | `art/3d/monsters/HKD-E01/HKD-E01.v1a.1.blend`を候補。現時点でart directory未作成。publicへ.blendを置かない |
| export collection | `EXPORT_HKD_E01` |
| scene | `SCN_HKD_E01` |
| static asset root | `HKD_E01_Root` |
| animated transform node | `SlimeMotion` |
| mesh object / mesh data | `HKD_E01_Mesh` / `HKD_E01_Geometry` |
| Armature / bones | なし。名前予約のためだけの空Armatureも作らない |
| animation | `idle` / `attack` / `hit` / `defeat`、各1個 |
| material / color attribute | `MAT_HKD_E01_Potato` / Blender `Color`→GLB `COLOR_0` |
| 制作検査記録 | asset SHA-256、source版、Blender build、export設定、bounds、各資源数、検査結果。将来`docs/3d/`に要約を置く候補 |

runtimeが使うのは既存ID `HKD-E01`。内部node名のunderscore化を教材ID変更へ波及させない。大文字小文字はWindowsだけでなく実配信のcase-sensitive条件で検査する。

## 9. GLB Scene Specification

```text
SCN_HKD_E01  (default scene、1 scene)
└─ HKD_E01_Root  (static TRS identity、floor原点)
   └─ SlimeMotion  (neutral TRS identity、4 clipの唯一のtarget)
      └─ HKD_E01_Mesh  (static TRS identity)
         └─ HKD_E01_Geometry / 1 TRIANGLES primitive
            └─ MAT_HKD_E01_Potato / COLOR_0
```

mesh 1、material 1、skin 0、morph target 0、image／texture 0、camera 0、light 0、animation 4を期待する。地面、装飾camera、reference画像、collision mesh、制作helper、別LOD、未使用Action、physicsを含めない。Blenderのcollection階層を全てGLB node化しない。

GLB 2.0、JSON chunk＋BIN chunk、外部`.bin`・外部texture URLなし。mesh圧縮、quantization、Draco、meshopt、KTX2、GPU instancing、material variants、animation pointer等のextensionを初号では要求しない。`extensionsRequired`は空／省略。意図しない`extensionsUsed`が出た場合はexport設定を確認し、未評価機能として黙って受け入れない。

neutral boundsとanimation包絡は§4のroot-local GLB座標で検査する。NaN／Infinity、空mesh、0 extent、遠方の捨てobject、逆法線、負scaleを拒否する。manifest上の予想値だけでなく、出力頂点とTRSから実際のboundsを計算する。

Babylon import後の`__root__`はloaderが生成する非描画rootであり、author側の余分なmesh数には数えない。runtimeのmesh/node総数には含め、author資源と別欄で記録する。配列の先頭がbodyであると仮定しない。

Babylon 9.25.0のAUTO変換は、左手系sceneではloader rootへY軸180°のrotationとZ負scaleを設定する。この組合せはglTFの+Z正面をそのままcamera側−Zへ向ける変換ではない。**loader rootを保持したまま、その外の表示専用Placement nodeにY軸180°を設定する**。これでBlender−Y→GLB+Z→最終Babylon−Zとなり、V0 camera位置(0,0,−10)を向く。根拠：[採用版glTFLoaderのroot変換](https://github.com/BabylonJS/Babylon.js/blob/9.25.0/packages/dev/loaders/src/glTF/2.0/glTFLoader.pure.ts#L731)。

Placement nodeは位置と等比fitも所有する。scene.useRightHandedSystemやcameraを変更しない。loaderの負scaleを「transform未適用」と誤認して消さない。正面・左右・接地を検査用座標と顔で確認し、見た目だけでさらに180°を重ねない。

## 10. Blender Export Preset

制作候補を**Blender 5.2.1 LTS**に固定する。2026-09-08の公式掲載は5.2.1（2026-08-25）で、5.2 LTSの保守予定は2028-07まで。[公式5.2 Releases](https://www.blender.org/releases/5-2/)

今回Blenderは起動していない。以下は採用する設定の意味を固定したpreset仕様。5.2英語manual本文の取得に制約があり、公式5.2他言語manual・公式API掲載・V0にあるBabylon APIを照合した。制作開始時に**実際の5.2.1同梱exporterのUI／RNA名と出力**を確認し、presetを保存する。API main/devの引数名を5.2.1で実行確認済みとはしない。[5.2 glTF manual](https://docs.blender.org/manual/es/5.2/addons/scene_gltf2.html)、[公式Export Scene API](https://docs.blender.org/api/main/bpy.ops.export_scene.html)

| 設定群 | 固定する設定 |
| --- | --- |
| preset識別 | `YOMITABI_HKD_E01_GLB_V1A_1`。Blender版・build hash、exporter版、設定一覧を制作記録へ保存 |
| Format | glTF Binary `.glb`（GLB 2.0） |
| Include | selected objects ON。export collectionのroot、Motion、meshのみ選択。active sceneはSCN_HKD_E01。reference・hidden試作は選択しない |
| Transform | +Y Up ON。単位1.0。原点offsetなし。collection中心への自動移動OFF。独自の軸変換を事前にbakeしない |
| Scene Graph | object hierarchyを保持。flatten OFF、collectionの全階層export OFF |
| Mesh | 適用済み評価meshを出力。Normals ON、UV OFF、Tangents OFF、Loose edges/points OFF。未使用attributeなし |
| Modifiers | export用複製で適用済みなのでexport時Apply Modifiers OFF。ライブmodifierの評価差へ依存しない |
| Vertex Color | materialで使う`Color`だけ出力。all vertex colors OFF。結果はCOLOR_0のみ |
| Material | Export。Principledの単純PBR、1材質。placeholderやmaterial除外にしない |
| Texture | 未使用image/texture export OFF。画像node自体なし。GLB JSONでimages/textures=0を確認 |
| Animation | ON、Mode=Actions。4 ActionをSlimeMotionへ割当可能なTRS slotとして作り、各Actionをstashして保持。Action名を上記clip名にする |
| Action / NLA | 1 Actionに1対象slot。NLAは保持用でstrip scale=1、repeat=1、offset=0。未使用Action全出力、Active Actions merged、Scene一括animationは選ばない |
| Range / Sampling | 各Actionの0〜終端を使用。sceneのframe rangeで他clipを切らない。60fps、sample step=1 frame、sampling ON。出力補間LINEAR、回転quaternion |
| Animation最適化 | 初号はkey削減OFF、定数TRS channelも保持。4 clipの先頭・終端・長さ・neutral復帰を優先 |
| Skin / Morph | skins OFF、morph OFF、morph animation OFF。Armature・leaf boneなし |
| Cameras / Lights | ともにOFF。選択対象にも含めない |
| Extras / Extensions | custom properties OFF、compression/instancing/animation pointer等OFF。game dataをextrasに埋めない |

複数Actionを単に作成しただけで4 clip全てexportされるとは仮定しない。Action slots導入後の挙動も踏まえ、4 Actionを対象へ関連付け、export直後にGLB JSONの`animations[].name`と対象nodeを検査する。NLAのtrack名だけを頼りに自動mergeへ依存しない。[公式manualのAction説明](https://docs.blender.org/manual/nl/5.2/addons/scene_gltf2.html#animations)

初号ではconstraint・driver不要。制作補助として使った場合は、export複製のSlimeMotion TRSへvisual transformをbakeし、constraint・driverを除いても4 clipが同じ姿勢となることを確認する。Blender固有制御やmaterialのalpha keyframeが標準GLBにそのまま残るとはしない。

## 11. Babylon Integration Contract

外向き契約はV0のまま：`prepare()`、`present(snapshot,dt,layout)`、`resize(layout)`、`dispose()`と2D fallback。snapshotのfieldも増やさない。

`stageId, enemyId, enemyIndex, enemyAction, enemyActionTimer, enemyHp, enemyMaxHp, shield, reducedMotion, monsterRect, generation, session`のみを値として受け取る。gameState／save object／採点・commit関数／教材やSRSの可変参照を渡さない。GLB objectをcurrentEnemyへ格納しない。

| 後続で追加する内部機能 | 所有者と契約 |
| --- | --- |
| glTF loader | 実装承認後に`@babylonjs/loaders`をcoreと同じ9.25.0にexact固定。glTF用登録だけを遅延renderer経路から使用。rootで全loaderを静的importしない |
| GLB取得 | 表示専用fetchでAbortControllerを所有。URLはmanifest由来。教材loaderとImage cacheを流用しない |
| parse / container | 取得したbytesを`LoadAssetContainerAsync`へ渡す方針。9.25.0 core型定義のArrayBufferView入力を使用できる。`.glb`指定等は実装時のloader型と照合。sceneへ無条件appendしない |
| material準備 | PBR shaderの遅延取得・compileを含め準備を確認。GLB Promise resolveを初回描画可能と同一視しない |
| AnimationGroup | 4 groupを完全一致で検査。自動再生をNONEにして取り込み、表示時計で制御する |
| 表示成功 | 有効sessionで、構造・clip・bounds検査と描画準備を終え、現在のE01 snapshotを描ける時だけpresent=true |
| lifecycle | container、Placement、scene、engine、DOM listener、loader observer、request、表示deadlineはそのrenderer sessionが所有 |

`LoadAssetContainerAsync`はsceneへ追加しない資源集合を返すため、検査・世代確認後に追加できる。[Babylon公式loader説明](https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/importers/loadingFileTypes.md#loadassetcontainerasync)。cloneやinstantiateは初号では不要。container単位の所有とsceneへの追加／除去を区別する。[AssetContainer公式説明](https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/importers/assetContainers.md)

**pending中もdispose可能なhandleを先に確保する。** 現V0の内部factory `preparePrimitive({canvas,onFailure})`は早期にhandleを返す。後続GLB factoryでもこの性質を保ち、内部のGLB Promise完了までhandle公開を待たせない。既存adapterとのfactory接続は互換wrapper等の小差分に限定する。GLB load待ちのsceneを外側から破棄できない構造にしない。

handleは同期的にpending状態で成立し、presentは準備中falseを返す。内部の非同期処理では各awaitの後でdisposedと所有sessionを確認する。現行adapterのgeneration／canvas owner検査も残す。成功handleへ渡す前のfactory例外はfactory自身で部分資源を破棄する。

AnimationGroupを毎frame`start()`しない。action切替時だけ以前のgroupをstopし、全TRSをneutralへ戻し、新groupを一度start→pauseしてsampling可能にする。以後`goToFrame(from+p×(to-from))`で提示する。9.25.0の`AnimationGroup.goToFrame`は未startなら何もしないことをinstalled sourceで確認したため、未startへの呼出しだけで動く設計にしない。paused groupとscene.renderの順序、初回pose反映は接続試験で確認する。

稼働groupは最大1つ、3 TRS channelなら稼働Animatableは最大3を目安とし、実数を記録する。4 groupを同時にstartして競合させない。pause中でも登録資源は存在するためexitでdisposeする。sceneの自動時計でone shotを進めながらcontrollerのtimerでも進める二重駆動は禁止。

disposeの順序は、(1)表示権失効・pendingフラグ無効化・request abortとdeadline取消、(2)loader／独自observer解除、(3)group停止、(4)container.disposeで所有group・mesh・geometry・material等を解放、(5)renderer固有Placement等を解放、(6)scene→engine、(7)adapterによるsurface解除。所有資源を個別処理とcontainer処理で無条件に二重破棄しない。dispose入口と後着cleanupはそれぞれ複数回安全にする。

exit後にcontainerが到着したら、sceneにaddせずそのcontainerをdisposeする。loaderがscene破棄を検知してrejectした場合もcatchし、未処理rejectionを出さない。通信abortだけでparse・GPU処理まで必ず停止できるとは仮定しない。

HKD-E02へ進んだ時はV0同様にadapterが3Dを隠す。同じbattle session内で確保済み資源をexitまで保持することと、退出済みsessionの漏れを区別する。E02中に準備が完了しても表示を開始せず、最終表示権は現在のpresentの対象判定に限る。画面をまたぐGPU／AssetContainer cacheは初号では設けない。

PC-10は追加資源の寿命接続、PC-13はGLBのfitと描画選択が確認対象。他PCの意味変更は不要。既存contain、DPR上限1.5、背面canvas、pointer-events:none、tabIndex=-1、inert、camera controlなし、既存DOM／Tutorial前面を保持する。

## 12. Visual Manifest

表示専用moduleの配置候補は`src/visuals/monsterVisualManifest.js`。教材JSONの`image`、stage pool、enemy dataへGLB URLやclipを混ぜない。manifestはmodule内の値定義としてfreezeし、saveへserializeしない。

次は仕様例であり、今回追加するJS／JSONではない。`sha256`は実asset完成後の値を必須とし、未確定値のまま登録しない。

```json
{
  "schemaVersion": 1,
  "monsters": {
    "HKD-E01": {
      "stageIds": ["hokkaido_area1"],
      "assetVersion": "v1a.1",
      "url": "/assets/3d/monsters/HKD-E01/HKD-E01.v1a.1.glb",
      "sha256": "<export後に確定するSHA-256>",
      "rigKind": "object-trs-slime-v1",
      "assetRoot": "HKD_E01_Root",
      "motionNode": "SlimeMotion",
      "mesh": "HKD_E01_Mesh",
      "material": "MAT_HKD_E01_Potato",
      "neutralBounds": {"min": [-0.50, 0, -0.31], "max": [0.50, 1.08, 0.31]},
      "animationEnvelope": {"min": [-0.66, 0, -0.40], "max": [0.66, 1.20, 0.40]},
      "placementYawRadians": 3.141592653589793,
      "paddingLogicalPx": {"x": 12, "y": 6},
      "clips": {
        "idle": {"name": "idle", "loop": true, "seconds": 2.0},
        "attack": {"name": "attack", "loop": false, "seconds": 0.75},
        "hit": {"name": "hit", "loop": false, "seconds": 0.50},
        "defeat": {"name": "defeat", "loop": false, "seconds": 1.0}
      }
    }
  }
}
```

neutralBoundsは検査基準値、animationEnvelopeは固定fit用の許容包絡。GLB実測が外れたら自動で巨大／微小assetを正規化して隠さず検査FAILとする。loopは表示側規約で、標準glTFにloop再生設定が自動保存される前提にしない。HP、ATK、weakness、grade、教材、enemy順、採点callbackをmanifestへ重複定義しない。

manifestがないID／stageは既存2D。2D fallbackは既存Image loaderと既存画像を使い続ける。asset SHA-256とURL版は配信／検証の指紋であり、monster IDやsave版ではない。

## 13. Asset Validation Checklist

本節は将来の受入条件。**今回GLBが存在しないため全項目は未実施**。Blender viewport、GLB構造、Babylon実描画、Core不変、実性能を別の証拠にする。

| 検査 | 合格条件 |
| --- | --- |
| 同一性 | ID、2D原案hash、source・GLB版、実GLB hashが記録済み |
| glTF構造 | Khronos Validator ERROR 0。warningは全件説明し、未解決のruntime影響なし。validator版も記録 |
| scene / 名前 | 1 scene、root/Motion/mesh/materialの完全一致、4 clip名が各1個。配列順に依存しない |
| 資源 | author mesh1 / primitive1 / material1 / texture0 / skin0 / morph0 / camera0 / light0。外部URIなし |
| bounds / pose | neutral寸法と床原点、全clip包絡、finite TRS、正面−Zへの最終補正、face法線、scale異常なし |
| clip | 全clipの始終、loop継ぎ目、attack再発火、長短clip、action中の後着、defeat終端保持、reduced motion |
| 描画 | 232×112内、縮小contain内で目・U字口・芽・裾が識別可能。UIを覆わず、ちらつき・顔の沈み・素材欠落なし |
| layout / 入力 | pad開閉・縦横・resize・黒帯、主要44 CSS px、input48px、focus／IME入口、Tutorialの前面を維持 |
| 負荷 | export triangles/vertices/buffer/GLB bytes、draw calls、PBR初回準備、idle frame/CPU、cold stallを取得 |
| 退出 | 10往復およびpending/逆順完了で退出sessionのcontainer/group/GPU/listener累積0 |
| Core | 268 baseline＋23 V0を維持、V1a追加試験全PASS、integrity/build PASS、save/learning/SRS/進行意味差0 |

構造検証器は[Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator)を使用する方針。今回インストール／実行していない。Validator PASSだけで小表示・shader・disposeまで合格とはしない。

新規リスクごとのfallback契約を以下に固定する。

| 新規リスク | 検出／故障試験 | 継続と後始末 |
| --- | --- | --- |
| GLB transfer遅延 | low bandwidth、永続pending、途中切断 | 準備中から2D。表示専用10秒deadlineで当該試行終了・abort。教材の10秒期限とは別所有 |
| GLB parse失敗 | 不正header／長さ／JSON／buffer | exception/rejectを捕捉し部分資源破棄、2D継続 |
| texture decode | 初号はimages/textures 0を構造検査。故障用GLBでは不正imageも拒否 | 想定外texture付きassetは表示前に拒否。decode費用0は本assetの範囲だけ |
| GPU upload | context loss、buffer生成失敗、初回render例外 | 3D表示権を失効、session資源破棄、同じbattleで2D |
| shader/material準備 | PBR chunk遮断、compile失敗、永続not-ready | readyまでは2D。失敗／表示deadlineで終了。黒画面をreadyとしない |
| clip不足 | idle以外も含め1本ずつ欠落 | 4本検査で失敗、container破棄、2D。存在するclipを勝手に代用しない |
| animation名違い | `Attack`、`hit.001`、重複名 | 完全一致検査で拒否。曖昧な前方一致なし |
| bounds異常 | 0 extent、NaN、遠方helper、包絡超過 | 検査拒否し2D。camera/UIを広げて吸収しない |
| scale異常 | unit違い、100倍、author負scale | 検査拒否し2D。loader固有変換は許容対象として識別 |
| orientation異常 | 顔が背面、上下反転、二重yaw | offline・実描画検査で不採用。実装検査FAILのassetをmanifestへ登録しない。runtimeで顔の意味を自動認識できるとはしない |
| missing asset | 404、SPA rewriteでHTML 200、case違い | statusとGLB header検査で失敗、2D。page reload不要 |
| late load | action進行中／E02表示中に成功 | 現在のsnapshotのみ提示。終了済みaction再生なし。E02はadapterが3Dを隠す |
| exit後load完了 | pending→exit→resolve/reject、旧新両順 | 旧containerをaddせずdispose。reject捕捉。新sessionのcanvas・guideを触らない |
| AnimationGroup故障・disposal | sample例外、停止、完了0/複数、dispose後callback | 2Dへ戻し、group/Animatable/observerを解放。callbackから進行させない |

JS main threadを長く占有するparse／compileは、Promise化しただけでは中断可能にも非blockingにもならない。deadline callbackもそのtask終了まで走れない。準備待ちの表示は2Dであっても入力応答が悪化し得るため、これを§14〜15で別に測りSTOP判定する。

R-01〜16は全て引き継ぐ。特にR-01は同じcontroller tick・論理乱数・業務時計でrender 0/1/複数を比較、R-04〜06はcontainer後着と二重dispose、R-08はload/hit/attack/defeat時のcontext loss、R-12は表示再試行による教材loader再実行0、R-14はclip時間・完了通知に進行が依存しないことを追加実GLBで検査する。practice／quickは2D、実Firebase接続0を維持する。

KNOWN-2D-PAD-TUTORIAL = REPRODUCED、resultWin centerBox fallback、実mobile／物理IME等の既知範囲を継承する。pad ONも悪化確認は実施するが、今回その既存不具合を修正しない。3Dだけで発生する遮蔽は既知問題へ分類しない。

## 14. Performance Measurement Plan

### V0の既存証拠

次の値は[V0 Report §15〜17](YOMITABI_3D_V0_TECHNICAL_SLICE_REPORT.md)から継承した実測であり、本書作成時の新しい測定ではない。

| 観測点 | V0の記録 |
| --- | --- |
| cold初回準備付近Long Task | 165 / 156 / 169ms。Babylon module取得後・scene準備付近。CPU stack内訳は未確定 |
| T1の2Dとの差 | −146.4 / +4.1 / −24.0ms。負の差を高速化の証明にしない |
| E0A0Sの2Dとの差 | −45.4 / −20.1 / −34.2ms。初回Tutorialを含む |
| idle | median16.7ms、p95 16.9ms、V max17.5 / 17.6 / 17.8ms |
| idle CPU増分 | +3.66 / +3.91 / +3.67 percentage points |
| 通常idle／回答Long Task | 50ms超0。初回cold準備stallは別に存在 |
| >33ms frame | B=2/4825、V=4/4697。撃破直後の少数、V1の2連続あり |
| Babylon追加transfer | 各1,180,095 bytes。rendererとshader等5資源。loopback、無圧縮、HTTP header込み |

**156〜169msを消えたことにしない。** V1aのcold値、当日のV0対照、上記履歴を並記する。「GLB追加費用」をV1a総時間から単純に156ms引いた値として作らない。重なった処理区間・ばらつき・異なる観測markerを区別する。

### 比較条件とrun

主比較はWindows／Chrome **152.0.7977.82**／DPR1.5／screen1280×800 CSS px／inner1086×723、headed専用Chrome、新規専用profile、E0隔離を継承する。OS、CPU/GPU、電源、省電力、Chrome実版、実buffer寸法、fixture/tool/build/asset hash、CSPを毎run記録する。Chrome等が変わればV0対照も再測定し、過去と同条件とは記載しない。

安定2D=`2a521dd...`、primitive V0=`15ee0be...`、将来のGLB候補commitの3者をproduction buildから用意する。**各3 run、B1→P1→G1、B2→P2→G2、B3→P3→G3**を主比較とする。PはV0 primitive、GはV1a GLB。2D比とV0比の両方を報告し、V0増分を無視してCPU予算をもう一度+5pt加算しない。

各runのsetup画面で停止し、必ず次を求める：

> 専用Chromeを最前面にして、他のアプリを操作しないでください。準備できたら『準備完了』と入力してください。

そのrunの返信を受けるまで測定開始禁止。前runの返信を再利用しない。返信後の復帰猶予とforeground監視を全run同じにする。hidden／focus喪失／minimizedや測定失敗は記録し、除外理由なしに成功runへ差し替えない。今回はbrowserを起動せず、この準備確認も実行しない。

profileはrunごと新規、Storage／SW空、同じ架空fixture、外部Firebase接続0、receiver0を確認。E0専用originとCSPを維持する。raw Network／profile／screenshot／生Storageは将来`artifacts/v1a/`へ置き、製品assetと混ぜない。公開CDNの圧縮量をloopback値から断定しない。

主シナリオは従来の初回Tutorialあり・pad OFFでT1→stage→A0S→idle→正答attack→誤答attack→heal→defeat→E02→退出→再入場。idleの観測長は全armで同じ手順を固定し、実測wall timeを記録する。最低10秒の取得を狙い、CPU分母を指定sleep秒で代用しない。

**追加の必須対照はTutorial既読のcold初回入場**。同じ派生fixtureを新規profileへ用い、P/G各3 runを交互に実行する。module cacheはcoldのまま、UIのTutorial遮蔽だけを除いた条件で、読み・最初の入力中にstallが重なるか測る。全Tutorial停止や主比較への混入はしない。warm再入場・context fallback・資源診断は別シナリオにする。

### 準備処理の分離

| 区間 | 観測方法・記録 | 限界 |
| --- | --- | --- |
| Babylon module取得／初期化 | Resource Timing / Networkとdynamic import開始・resolve、Chrome traceのscript評価 | import Promise区間には通信・依存評価を含む。全時間をCPU初期化と呼ばない |
| glTF loader取得／登録 | loader／関連chunkを別分類、import前後marker | coreと共有chunkは二重加算しない |
| engine / scene準備 | constructor前後marker、初回描画までのtrace | 既存156〜169msの原因を未取得stackから断定しない |
| GLB transfer | requestStart / responseEnd、encodedDataLength、body受取完了 | downloadとbyte copy/hash検査を区別。N0A0S後の取得も別に集計 |
| GLB parse / resource構築 | bytesを渡す前→container resolve、loaderのparse/animation counterが取れれば併記、CPU trace | container待ち全体は純parse時間ではない。分離不能部分は複合区間と明記 |
| texture decode | image/texture数、decode event | 初号は0枚なのでasset由来N/A（発生なし）。将来texture付きの一般性能保証にはしない |
| GPU upload | WebGL buffer/upload呼出しの診断、trace、最初のready frame | JS呼出時間はGPU完了時間ではない。取得不能なGPU実時間は未観測。通常測定にgl.finishを追加しない |
| shader / material | PBR chunk転送、compile/link、material readyまでのmarker | GPU driverの非同期処理とCPU taskを区別。PBRによる増分をGLB bytesだけの問題にしない |
| animation setup | 4 group検査、target解決、初回start/pause/sample前後 | loader内でgroupが作られる部分との重複を説明 |
| 最初の3D提示 | scene ready、present=true、実表示frameの区間 | A0Sとは別。3D readyを回答可能条件に追加しない |

CPU trace／GPU create-delete probe／heap snapshotは重い診断として主性能runと分ける。通常runはV0と同じ軽い観測負荷。frameは生rAF間隔、Long Taskは50ms超taskとして別に数える。markerの総和が全体時間に必ず一致するとしない。

### 収集値と予算

| 指標 | 判定規約 |
| --- | --- |
| T1−N0 | 最終2D比+30ms以内目標。3組一貫+50ms超なら原因調査 |
| E0A0S / U0→次AS | 意図的3D blocking 0ms。A0S差が一貫+100ms級なら調査。正答、誤答、heal、致死attack、HP0→E02を別集計 |
| idle frame | median約16.7ms目標。p95>20msが持続する場合STOP候補。median/p95/max/件数/観測秒を報告 |
| >33ms frame | 件数・全frameに対する率・連続数・発生操作を記録。V0撃破直後の少数観測を保持。新規頻発ならSTOP候補 |
| >50ms stall | rAF間隔とLong Taskを分離。cold／idle／各回答／再入場別。通常操作中に新規反復ならSTOP候補 |
| TaskDuration / idle CPU | `100×ΔTaskDuration/ΔCDP Timestamp`。2D比+5pt以内目標、+10pt級一貫ならSTOP候補。Windows全CPU/GPU使用率ではない |
| Network | N0A0S transfer、全準備完了までのtransfer、core／loader／PBR shader／GLBを独立計上。BGM差・HTTP header・圧縮・cache区分を保持。MB hard limitなし |
| Memory | MB hard limitなし。10往復のsession固有資源非累積を優先。heap値だけでGPU解放を証明しない |
| save / learning | 各自然回答・退出・再入場の意味を比較。時刻/UUID差を説明し、SRS期限は記録時刻との関係で検査。byte完全一致を乱数のある異runへ要求しない |

GLB bytesの制作記録は必須だが「一般に何MBなら安全」という上限は置かない。600〜1,200 triangles、1 material、texture0という初号構成で見た目と実測を得てから、別版の必要性を判断する。

10回のbattle→stageSelect→battleで、Renderer session / engine / scene / canvas / AssetContainer / Placement / mesh / geometry / material / texture / AnimationGroup / Animatable / observer / listener / request / deadline / loopと、取得可能なWebGL資源数をenter・exit・後着settled後に記録する。退出直後に通信停止処理がpendingなら、その件数とsettled後0を別々に残す。**退出済みsession由来の生存資源が往復ごとに増えないことが必須**。module cache、既存Image cache、測定bufferは別集計。初号の独立loopは0のまま。

## 15. V1a STOP Conditions

| 条件 | 判定・対応 |
| --- | --- |
| GLB成功が回答開始条件になる | 即STOP。pending/failureで同じ問題を読めて回答できる境界へ戻す |
| GLB clipが次問・HP・EXP・敵交代を待たせる | 即STOP。既存timerへ表示を合わせる。Coreの待ちを伸ばさない |
| fallback不能・黒画面・page reload必須 | STOP。2D継続と資源破棄が成立するまで接続を合格にしない |
| 退出後container/group/GPU/listener累積 | STOP。guardだけで後着資源を捨てる実装を認めない |
| save / learning / SRS / stage progression回帰 | 即STOP。表示の成功と相殺しない |
| 268条件／V0 23条件後退、integrity/build失敗 | STOP。skip、assert削除、timeout握り潰しで通さない |
| Adapterを大幅再設計、battle/UI移植が必要 | STOP。限定表示交換の前提を再評価し、PCをBabylon都合で変更しない |
| 小さい敵枠で価値が見えない | STOP。輪郭・顔・芽が読めない、別キャラに見える、立体感の利益が確認できない場合V1bへ進まない |
| cold初回stallが著しく悪化 | 拡大停止してtrace調査。既存156〜169msを記録に残し、当日のV0対照と比較する |
| frame / CPUがV0 Budgetを大きく超える | §14の持続p95>20ms、新規33ms超頻発、通常50ms超反復、CPU一貫+10pt級をSTOP候補として確認。未解決のままV1bへ進まない |
| 証拠不足 | GLBの実負荷・2D対照・退出・fallback・視認性が未確認ならV1a性能GOを出さない |

「coldが著しく悪化」の初号用運用基準は、**同条件P/G cold 3組で、3D準備に対応する最大Long Taskが一貫してV0より100ms以上増える、または約300ms以上になる**場合に拡大停止・原因調査とする。これは新たなV1aの暫定調査トリガーで、既存承認済みV0 Budgetの書換えや300ms未満なら自動合格という意味ではない。stallが分割され最大値だけ下がる場合も、50ms超taskの件数・合計時間・入力応答を併記する。通常回答中の反復stall条件は数値トリガー未満でも適用する。

STOP時はGLB表示を2Dへ戻し、原因・asset版・比較証拠を保存する。V0 tag移動、main変更、save初期化、教材変更、PROTECTED CORE変更を解決策にしない。Blenderモデルを作り終えていてもV1bへ自動進行しない。

## 16. Blender制作手順

以下は**次に制作を依頼された時の手順**。今回の実施記録ではない。

1. experiment branchとV0 tag展開先、未コミット作業を確認。本書と元WebPを制作参照にし、Blender 5.2.1の実版・buildを記録する。
2. Metric/scale1、+Z up・−Y front、床原点で制作sceneを用意。referenceは非export collectionへ配置する。
3. bodyと裾、2本の芽を低面数で作る。正面silhouetteを原画像と比較し、幅1.00・高さ1.08へ合わせる。背面は同じイモ形状の自然な延長に留める。
4. 縦長の目とU字口を浅いgeometryで作り、bodyへ沿わせる。6〜10程度の控えめな斑点とpaletteをColor Attributeで付ける。
5. 232×112枠の想定サイズで顔・芽・裾を確認する。細部を増やす前に、同一キャラと分かる形を確定する。
6. export用複製でmodifierを適用、hidden内部面を整理、join、1材質、Triangulate、法線、neutral TRSとfloor原点を確認する。
7. static root→SlimeMotion→meshを構成し、4 Actionを60fpsで制作。rootは固定、MotionのTRSだけにkeyを持たせる。
8. 全clipの始終・loop・床・包絡を検査し、各Actionを保持。未使用Action・camera/light・helperを選択から外す。
9. §10のpresetを実UIで照合し保存。§8の版付きGLBへexportする。制作masterはpublicへ配信しない。
10. GLB JSON・Validator・別sceneへのreimportで資源数、4 clip、色、boundsを確認する。source/GLB hash、triangles/vertices/bytes、設定を記録する。

作業時間はmodel、face/material、animation、export修正に分けて記録する。1体の所要時間を47面の量産時間へ外挿しない。結果が仕様を満たさない場合は制作物を修正して再exportし、後続コードで無理に補正しない。

## 17. GLB接続工程

1. 制作物の構造合格後、実装の依頼範囲を確認して同じexperiment branchで接続する。V0 primitive commit/tagは復帰基点として維持する。
2. core9.25.0を保持し、loader9.25.0だけを必要時に追加・lock。Viteや他依存のupgradeを混ぜない。manifestにHKD-E01のみ登録する。
3. 現在のrenderer handleの内側で、sphereをGLB containerとclip samplingへ置き換える。camera/light/plane/stack、snapshot、controller ready条件は維持する。
4. pending中のhandle所有、abort、後着container disposal、4 clip完全一致、bounds／材質準備を先に確認する。通常表示が動くことだけで先へ進めない。
5. 正常4 action、reduced motion、target外E02、late load、failure、context loss、再入場、旧新両順を検査。既存R-01〜16の契約にGLB経路を追加する。
6. 正式回帰を実行する：`npm.cmd run test:phase-a`、`test:phase-b`、`test:phase-c`、`test:no-go`、`node --experimental-default-type=module --test tests/v0/*.test.mjs`、V1a追加test、`node scripts/verify_stage_id_integrity.mjs`、`npm.cmd run build`。既存268・V0 23、追加条件すべてFAIL/cancelled/skipped/todo=0を要求する。
7. 機能診断と性能runを分けて、§14の3者比較、Tutorial既読cold、10往復、fallback、save/learning監査を実施する。performance値が未取得なら未取得と記録する。
8. asset/source/preset/manifest、製品差分、PC-10/13、回帰、GLB追加transfer、cold内訳、見た目比較、STOP判定をV1a結果へまとめる。

この工程表は今回のpackage追加・src変更の実施承認ではない。本書作成ではBlender起動、.blend/GLB生成、manifest実装、npm install、製品変更、test/build再実行、Git commitを行っていない。268＋23 PASSはFreezeのclean検証証拠を継承した値である。

## 18. V1bへ進む条件

V1bの北海道背景制作へ進めるのは、次の条件が揃った後とする。

- HKD-E01が元のキャラクターとして認識でき、実敵枠で顔・芽・裾を判別できる。2Dとの比較で立体化の価値をユーザーが確認できる。
- 4 clipが既存timerに従い、GLB未準備・故障・animation停止でも同じbattleを2Dで継続できる。
- PCの意味変更0、268＋V0 23＋V1a追加test全PASS、integrity/build PASS、実Firebase接続0。
- late load／exit後完了／旧新両順／double dispose／context loss／最低10往復で資源非累積を確認済み。
- 2D対照・V0対照付きのheaded foreground実測、Tutorial既読cold、Network内訳、通常frame/CPU、156〜169msの既存観測とGLB追加負荷の比較がある。
- §15の未解決STOP条件がなく、既知2D問題と新規回帰を区別したV1a結果が残っている。

現在は**V1a asset仕様確定、制作・GLB接続・性能合格は未実施**。V0は `V0 GO  READY FOR BLENDER V1a` のまま。本書の完成だけをV1a実装GOやV1b開始許可にしない。次の依頼では本仕様によるHKD-E01の制作から着手できるが、このセッションでは開始しない。

今回の成果物は本書1件のみ。既存V0コード、Babylon構成、教材、依存、main、stable/V0 tag、既存未コミット作業を保持する。

完了確認：指定18章と文書内のローカル参照先を検査。tracked差分・index差分は空、Git statusの開始時からの追加は本書のみ。HEAD、main、stable tag展開先、V0 tag objectと展開先は開始時の値を保持した。

**V1a ASSET SPEC COMPLETE — 制作開始待ち／V1b未開始**
