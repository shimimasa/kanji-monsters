# 漢字ヨミタビ — V1a-1 HKD-E01 Asset Build Report

実施日：2026-09-08 JST。対象：HKD-E01 ジャガイモスライム、asset version `v1a.1`。

## 1. Executive Summary

**ASSET BUILD PASS  READY FOR GLB INTEGRATION**

Blender **5.2.1 LTS**を実行確認して新規制作した。編集可能なmaster、4 animationを含むGLB、独立構造検査、Khronos Validator、別プロセスの空sceneへの再import、小表示確認を完了。これはasset制作の合格であり、Babylon接続・runtime性能・V1b開始の合格ではない。

| 成果物・検査 | 結果 |
| --- | --- |
| [制作master](art/3d/monsters/HKD-E01/HKD-E01.v1a.1.blend) | 146,587 bytes。編集用15部品とexport meshを保持 |
| [GLB](public/assets/3d/monsters/HKD-E01/HKD-E01.v1a.1.glb) | 43,616 bytes。1 mesh / 1 primitive / 1 material / texture 0 |
| 4 clip | idle / attack / hit / defeat。唯一のTRS targetはSlimeMotion |
| 独立構造・包絡検査 | PASS。実GLBの頂点・TRSを600 Hzでsample |
| Khronos Validator | ERROR 0 / WARNING 0 / INFO 0 / HINT 0 |
| 新規sceneへの再import | PASS。4 clipを240 Hzでsample |
| 232×112、174×84小表示 | 再importしたGLBからrenderして確認 |

前回は5.1.2しか確認できず制作前に停止した。今回は途中成果物を引き継いでいない。前回版は[停止履歴](artifacts/v1a/build-01/previous-stopped-report.md)へ保存した。

全文確認：本レポートの前回版、[Asset Spec](YOMITABI_3D_V1A_ASSET_SPEC.md)、[V0 Git Freeze](YOMITABI_3D_V0_GIT_FREEZE.md)。source of truthはAsset Spec **1.0.0**のまま変更していない。

| Git / 作業場所 | 開始・終了時の確認値 |
| --- | --- |
| worktree | C:/kanji-game-latest/artifacts/yomitabi-e0/worktrees/experiment |
| branch | experiment/3d-vertical-slice |
| HEAD | 15ee0be672ca8ec56e773a75959ce9535877cb19 |
| V0 tag | yomitabi-3d-v0-babylon-2026-09 |
| V0 tag object / 展開先 | 76e5c7210888ba5f3bf79b86d5e35be86f5b3158 / 上記HEAD |
| main / 2D stable tag展開先 | 2a521dd5aa747314b25e761d976bd4f880cd58c3 |
| E0 | 034915d4133782cc1eff872134e5b8fde04e4bacを保持 |
| tracked / index差分 | ともに空。stage / commit / push / merge / tag更新なし |

既存未追跡文書・benchmark tools・V0 toolsを保持。追加配信資源は上記GLBのみ。制作・検査script、ローカルValidator、render、検査JSONはartifacts/v1a/に隔離した。browser profile、Firebase、Storageへのアクセスなし。

## 2. Blender version

| 項目 | 実行確認値 |
| --- | --- |
| executable | C:/Program Files/Blender Foundation/Blender 5.2/blender.exe |
| version / bpy.app.version | **5.2.1 LTS** / (5, 2, 1) |
| build hash | 9e2066aef7ef |
| build date / time | 2026-08-25 / 02:38:20 |
| build commit date / time | 2026-08-24 / 16:50 |
| build branch / platform / type | blender-v5.2-release / Windows / Release |
| bundled Python | **3.13.13**, main, May 8 2026, 12:37:03 / MSC v.1944 64 bit AMD64 |
| exporter | Khronos glTF Blender I/O v5.2.40（GLB generator実値） |

--versionと実際のBlenderプロセス内のbpy.app / sys.versionで照合。同梱Python executableも3.13.13。制作scriptは5.2.1以外をassertで拒否する。factory startupによるbackground制作で、既存GUI・個人設定に依存しない。

最初の試作実行でユーザー領域へのextension cache書込みが拒否された。以後BLENDER_USER_RESOURCESをworktree内artifacts/v1a/blender-userへ明示し、最終exportでは解消。既存5.1.2の入替えや個人設定変更はしていない。

## 3. Source 2D reference

[HKD-E01.webp](public/assets/images/monsters/full/grade1-hokkaido/HKD-E01.webp)、500×500、13,470 bytes。

SHA-256：`ee2a5e2456227d92efdf4824e7d8b17d3babd74165bd81bf70816e699155110e`

実画像を表示して確認。丸い黄土色の体、下に重さのある形、横に広がる裾、縦長の黒い目、U字の笑顔、外へ開く左右の芽、少数の茶色い斑点を残した。画像は外部の制作参照とし、master/GLBへtextureとして埋め込んでいない。

HKD-E01のID・名称・grade・weakness・HP/ATK計算・stage内順序・10体構成・poolは変更0。教材やmonster dataへの追記なし。

## 4. Modeling result

rounded low-poly stylized。bodyは24分割の輪郭と高さ方向9 ring＋頂点で丸みを作り、弱い不均一さを加えた。裾は連続した一周の広がりで、左右の足に分離していない。芽は各6辺の断面で短い折れを付け、左右をわずかに非対称にした。

目2つとU字口はbody表面へ投影した浅いgeometry。法線offsetは顔0.006、斑点0.004 unit。正面の斑点は8箇所。手足、鼻、眉、歯、舌、頬紅、白目、巨大な葉、透過表現は追加していない。

AUTHOR_HKD_E01_EDITABLEにbody、裾、芽2、目2、口1、斑点8の**15部品**を別objectで保持。非表示の制作collectionから複製し、export側だけjoin・body/裾の同一位置境界をweld・triangulateした。body/裾の接合cap、芽の埋込端cap、顔と斑点の埋込側の裏面を作らず、不要な内部capを避けた。外殻の背面と底は保持した。

export meshにライブmodifier、UV、不要material slotなし。body/裾/顔はsmooth、芽の折れはflat normal。顔の法線がGLB正面+Zを向くこと、全triangleの面積が0でないことも独立検査した。

制作recipe・実presetをmaster内Text datablockにも保存。自動実行scriptやdriverではない。[制作script](artifacts/v1a/build-01/build_asset.py)と[build情報](artifacts/v1a/build-01/build-info.json)を保存した。

script内のmodel/material生成0.119秒、animation生成0.048秒、最終export呼出し0.527秒を記録。これはscript作成・設計・視覚確認・修正を含む工数ではない。それらの工程別実時間は未計測で、量産工数の根拠にはしない。

## 5. Dimensions

neutral、芽・裾を含む。Metric / Unit Scale 1.0。

| Blender軸・規約 | 実測（丸め） | 結果 |
| --- | --- | --- |
| X幅 1.00 ±0.02 | 1.000000 | PASS |
| Y奥行 0.62 ±0.02 | 0.620000 | PASS |
| Z高さ 1.08 ±0.02 | 1.080000 | PASS |
| floor Z=0 | 0.000000 | PASS |
| origin 裾中央 | (0,0,0) | PASS |
| +Z up / −Y front | 再import正面renderで確認 | PASS |

body頂部Z=0.855、芽頂部Z=1.08。裾最大幅1.00、上端Z=0.085。mesh、SlimeMotion、rootのneutral local TRSはidentity。

## 6. Polygon / vertex

| 対象 | 実測 |
| --- | --- |
| source export mesh vertices | 462 |
| GLB vertices | **642** |
| GLB triangles | **768** |
| GLB indices / 型 | **2,304** / UNSIGNED_SHORT |
| GLB buffer bytes | **39,116** |
| GLB file bytes | **43,616**（約42.59 KiB） |
| Validator drawCallCount | 1（asset構造からの算出値） |

600〜1,200 trianglesの初期目標内。1,600超の例外は不要。色・法線境界で頂点が分割されるためsourceとGLBのvertex数は異なる。再importの642 vertices / 768 trianglesはGLBと一致。実Babylonのdraw call・GPU upload・frame負荷は未測定。

## 7. Material / Color

唯一のmaterial：**MAT_HKD_E01_Potato**。Principled BSDF、metallic=0、roughness=0.9、alpha=1。Color属性をBase Colorへ直接接続。Blender FLOAT_COLOR / CORNERをGLB COLOR_0へ出力。

| 用途 | 使用sRGB palette |
| --- | --- |
| body | #C89442 |
| 斑点 | #AA7135 |
| 下部 | #865022 |
| 芽の根 | #625429 |
| 芽の先 | #B8B35C |
| 目・口 | #201A12 |

仕様の明部候補#D5AA5Aはrecipeに保持したが、初号は固定明部面を追加せずlightの陰影を使った。実COLOR_0は6色。sRGBからlinearへ変換して格納し、GLB accessorでも結果を検査。

baseColorFactor省略＝白(1,1,1,1)、roughnessFactor=0.899999976、metallicFactor=0。OPAQUE、doubleSided=false、emissive=0。COLOR_0はVEC3でalphaは暗黙の1。texture / image / UV / tangent / procedural textureは0。

## 8. Hierarchy

```text
SCN_HKD_E01
└─ HKD_E01_Root                 static identity
   └─ SlimeMotion              唯一のanimated TRS node
      └─ HKD_E01_Mesh           neutral identity
         └─ HKD_E01_Geometry    1 TRIANGLES primitive
            └─ MAT_HKD_E01_Potato
```

GLB author nodeは3、sceneは1。root・meshのanimation channelは0。Armature / bone / skin / morph / constraint / driverは0。masterの編集collectionはGLBに含まれない。master自体にもcamera・light objectはない。

## 9. Animation 4 clips

60fps、唯一のtargetはSlimeMotion。translation / quaternion rotation / scaleの3 channel。step=1 frame、全補間LINEAR、key削減なし。static rootは固定。

| clip | 時間 / frame / 各channel key数 | 動き・始終 |
| --- | --- | --- |
| idle | 2.00秒 / 0〜120 / 121 | 微小な呼吸。横0.99〜1.01、高さ0.98〜1.02、上下最大0.004。neutral→neutral、loop前提、継ぎ目の速度変化を抑制 |
| attack | 0.75秒 / 0〜45 / 46 | 20%まで溜め、50%まで左へ突進、終端まで戻る。設計X=+0.04〜−0.16、Y前方最大−0.04、scale 0.94〜1.04、傾き最大3°。neutral→neutral |
| hit | 0.50秒 / 0〜30 / 31 | 最初の25%で高さ約0.88・横約1.08まで潰れ、最大4°傾いて戻る。neutral→neutral、反復振動なし |
| defeat | 1.00秒 / 0〜60 / 61 | 30%まで高さ0.75へ沈み、その後縮小。傾き12°以内。neutral→scale (0.02,0.02,0.02)、終端translation=0、rotation=identity |

振幅はauthoring曲線の設定値。端数frameにピークがある場合、60fps sampling後の極値はわずかに小さい。実頂点包絡は§11。終端scale=0.01999999955は0.02のfloat32表現。

床補正は傾いた子Motionの高さにだけ含めた。笑顔・材質は固定。root motion抽出、material fade、callback、game data、イベント発火はない。

標準glTFにloopフラグを埋め込んでいない。idle loop / 他one shotは後続表示側の契約。既存controllerのattack=750ms、damage=500ms、defeat=1,000msを変更せず、接続時は現在timerからsampleする。animation終了はHP・save・次問・EXP・enemy changeの条件にしない。

## 10. Neutral bounds

実GLB POSITION全頂点から計算し、nodeのneutral identityも確認。

| 座標 | min | max |
| --- | --- | --- |
| GLB +Y up | [-0.500000, 0.000000, -0.310000] | [0.500000, 1.080000, 0.310000] |
| Blender reimport +Z up | [-0.500000, -0.310000, 0.000000] | [0.500000, 0.310000, 1.080000] |

全成分が仕様±0.02内。ゼロextent、NaN / Infinity、遠方helper、author負scaleなし。

## 11. Animation envelope

許容GLB座標：min [-0.66,0,-0.40] / max [0.66,1.20,0.40]。

[bpy非依存検査](artifacts/v1a/build-01/check_glb.py)でGLB bytesから頂点・TRSを再構成。translation/scaleは線形、rotationは最短経路quaternion補間。**600 Hz、合計2,554 sample**で始終・key間も確認した。

| clip | sample数 | 実測min (GLB) | 実測max (GLB) |
| --- | --- | --- | --- |
| idle | 1,201 | [-0.505000, 0, -0.313100] | [0.505000, 1.103616, 0.313100] |
| attack | 451 | [-0.644823, 0, -0.310000] | [0.552572, 1.123147, 0.349951] |
| hit | 301 | [-0.536493, 0, -0.310000] | [0.540785, 1.080000, 0.310000] |
| defeat | 601 | [-0.500000, 0, -0.310000] | [0.501019, 1.080000, 0.310000] |

全clip PASS、観測した最小床高さ0。数値assertの許容誤差1e−6 unit。sample検査であり任意連続時刻の数学的証明ではない。別途reimportの240 Hz検査でも床・包絡内。

## 12. Export preset

**YOMITABI_HKD_E01_GLB_V1A_1**。実機RNAを照合し、master内Textと[build-info.json](artifacts/v1a/build-01/build-info.json)へ実設定を保存。

| 設定 | 実値 |
| --- | --- |
| format / selection / scene | GLB / selected objects only / active scene。root、Motion、meshのみ |
| transform | +Y Up ON、単位1.0、collection center移動なし |
| hierarchy | flatten OFF、full collection hierarchy OFF |
| mesh | export前にjoin / Triangulate / Rotation・Scale適用、export Apply Modifiers OFF |
| attributes | Normal ON、UV / Tangent / custom attributes / loose edges・points OFF |
| color / material | MATERIALで使うColorのみ、all vertex colors OFF、material EXPORT |
| images | format AUTO、unused images / textures OFF、image node自体0 |
| animation | ON、ACTIONS、merge=ACTION。各Actionに1対象slot、NLAはmute保持・scale1・repeat1 |
| range / sampling | Actionの0〜終端、scene range制限OFF、60fps、step1、sampling ON、LINEAR、key削減OFF、定数TRS保持 |
| skin / morph | skins OFF、morph OFF、morph animation OFF |
| camera / light | ともにOFF、選択対象0 |
| compression / extras | Draco / meshopt / gltfpack / GPU instancing / animation pointer / extrasすべてOFF |

初期試作のexport_image_format=NONEでは、同梱exporterのpbr_metallic_roughness.pyがvertex color取得も省略し、COLOR_0欠落となった。最終版はAUTOとし、画像node・画像資源0を出力で検査。**texture 0仕様は維持**。exporterソース変更なし。

未採用の制作中試作を修正して初号を確定した。凍結・公開済みassetの上書きではない。以後の内容変更は仕様のasset版更新規約に従う。

## 13. GLB structure

証拠：[GLB JSON](artifacts/v1a/build-01/glb-structure.json)、[構造検査結果](artifacts/v1a/build-01/structure-check.json)。

| 検査 | 実測 / 判定 |
| --- | --- |
| header / chunks | GLB 2.0、宣言長と実長一致、JSON＋BIN |
| scene / nodes | 1 / 3、名前・親子関係・default scene一致 |
| author mesh / primitive / material | 1 / 1 / 1 |
| texture / image / skin / morph | 0 / 0 / 0 / 0 |
| camera / light | 0 / 0 |
| animations | 4、完全一致、重複なし、各3 TRS channel、全target SlimeMotion |
| external URI / extras | 0 / 0 |
| extensionsUsed / Required | ともに空（省略） |
| attributes | POSITION / NORMAL / COLOR_0のみ |
| finite / scale / bounds | NaN・Infinityなし、負・ゼロscaleなし、bounds PASS |
| triangles / vertices / indices | 768 / 642 / 2,304 |
| buffer / BIN chunk / GLB file | 39,116 / 39,116 / 43,616 bytes |

## 14. Validator

[Khronos公式glTF Validator](https://github.com/KhronosGroup/glTF-Validator)の公式npm配布**gltf-validator@2.0.0-dev.3.10**を使用。registryのrepository URL・版・integrityを確認し、npm pack --ignore-scriptsでartifactsへ取得。製品package / lockfile / node_modulesへの追加なし。不明なnative binaryは導入していない。

tarballのSHA-512を実ファイルから計算し、registry値と一致：

`sha512-odJ4k0tRkGXiDGn78yDBg+fBbAIvBnXxh3RwAta0emSxGtyagFE8B4xELB1oYe3S5RD8Ci3uZAsZaascH2LAEQ==`

validateBytesでbufferも検査。issues抑制・severity上書きなし、maxIssues=0（無制限）、truncated=false。外部URIは独立検査で拒否し、Validatorにも外部参照時にrejectするhandlerを渡した。

**ERROR 0 / WARNING 0 / INFO 0 / HINT 0。** 未解決warningなし。[結果JSON](artifacts/v1a/build-01/khronos-validator.json)、[実行script](artifacts/v1a/build-01/validate.cjs)。ValidatorだけでBabylon描画・性能・disposeを合格としていない。

## 15. Reimport

元masterと分離した**新規Blenderプロセス、factory startup、empty scene**へGLBのみimport。60fpsに設定して4 Actionを切り替え、240 Hz・合計1,024 sampleで床・包絡を再検査した。

名前・親子関係、642 vertices、768 triangles、1材質、1色属性、UV 0、image 0、Armature 0を確認。4 Action完全一致。全clipの開始neutral、idle/attack/hitの終了neutral、defeat終端の高さ0.021600・床0を確認。

[検査JSON](artifacts/v1a/build-01/reimport-check.json)、[検査script](artifacts/v1a/build-01/reimport_preview.py)、[再import blend](artifacts/v1a/build-01/reimport-inspection.blend)、[log](artifacts/v1a/build-01/reimport.log)。最終実行のBlender exit code=0。

初回logではBlender 6.0向けWorld.use_nodes廃止予告がstderrへ出てPowerShellの結果が1となった。検査assertは完了していたが、最終実行ではnative $LASTEXITCODEを明示的に取得・返し0を確認。廃止予告はlogへ残した。例外や検査失敗を0へ置換していない。

制作masterも別プロセスで再openし、編集部品15、export object3、4 Action/各1 slot、唯一のTRS target、1材質、neutral identity、不要資源0を確認。[master-check.json](artifacts/v1a/build-01/master-check.json)に記録。元.blendだけを成功証拠にしていない。

## 16. Small-size visual check

全画像は**再importしたGLB**からrender。Cycles CPU、32 samples、Standard view transform / look None / exposure0 / gamma1。検査時だけcamera・area lightを作り、master/GLBには追加していない。

[正面512px](artifacts/v1a/build-01/reimport-front.png)、[斜め](artifacts/v1a/build-01/reimport-three-quarter.png)。小表示は正面固定・orthographic・232×112、ortho幅2.784 unit。仕様fitに相当する約83.33px/unit、neutral高約90px・幅約83px、床は下端から6px。clipごとに拡大率を変えていない。

![再import後の232×112表示](artifacts/v1a/build-01/small-idle.png)

| 観察項目 | 結果 |
| --- | --- |
| 縦長の目 | 黒い左右2つを識別、約10×14px |
| U字口 | 約22px幅・約2.5px線厚で微笑みを識別 |
| 左右の芽 | bodyから分離する外周として2本を識別 |
| 裾 | 体より横に広がる連続した下部輪郭を識別 |
| ジャガイモらしさ | 黄土色、丸いイモ形、芽と少数の斑点を確認 |
| 立体感 | 斜め画像で奥行・顔の曲面追従を確認 |
| 動作pose | [idleの山](artifacts/v1a/build-01/small-idle-peak.png)、[attack](artifacts/v1a/build-01/small-attack.png)、[hit](artifacts/v1a/build-01/small-hit.png)、[defeat途中](artifacts/v1a/build-01/small-defeat-mid.png)を確認 |
| defeat終端 | [終端](artifacts/v1a/build-01/small-defeat-end.png)は規約どおり微小化。顔識別を要求するposeではない |
| contain縮小の近似 | [174×84・75%](artifacts/v1a/build-01/small-contain-75pct.png)でも顔・芽・裾を識別。斑点は補助情報 |

offlineの視認性確認である。既存漢字UI・DOM・Tutorialとの重ね合わせ、Babylon PBR/light差、実端末contain・DPRの受入は未実施。ユーザーのruntime比較やV1b開始判断を代行していない。

## 17. Asset SHA-256

public/assets/3d/monsters/HKD-E01/HKD-E01.v1a.1.glb

**`da77cb290755bd40005004ecb4b036b8ac4f268888de29cd37b952bd44048d7f`**

43,616 bytes。構造検査とmaster確認の両工程で同じGLB hash。後続接続ではこの実値と版付きURLを使用する。今回はmanifest未実装。

## 18. Source .blend SHA-256

art/3d/monsters/HKD-E01/HKD-E01.v1a.1.blend

**`8afd40323c3fed318524df60173de5c10bdf21c4993455b8332601a252b84dc7`**

146,587 bytes、public外。原画像hashは§3。変更していない仕様書のhash：

`99c92a5059b9c6d0ffa5cb237780bd96ac289a0a40c88d99b0bf426d17a44c82`

## 19. Deviations from spec

**必須の形状・rig・資源数・寸法・clip名・時間・包絡・命名に未解決の逸脱なし。**

- export_image_format=NONEによるCOLOR_0欠落はAUTOで修正。texture/image 0は実出力で確認。
- 7色の開始paletteのうち固定明部色は未使用、実色6種。初期paletteを別色へ変更していない。
- attackは許容最大−0.18を使い切らず−0.16を設計値とした。包絡優先方針に従う。
- loopは標準glTFデータではなく表示側契約。独自metadataを追加していない。

仕様書本体、Babylon構成、製品コードへの変更なし。

## 20. Known limitations

- Babylon接続、loader追加、manifest、live game表示、GLB実transfer/parse/GPU upload/PBR準備/AnimationGroup setup・disposeは**NOT EXECUTED**。今回の範囲外。
- V0初回cold準備付近**156〜169ms Long Task**を既知観測として引き継ぐ。GLBが43,616 bytes・texture0でもstall改善の証拠にはならない。
- headed比較、fallback故障、10往復、実IME/Tutorial検査は未実施。後続接続工程で必要。KNOWN-2D-PAD-TUTORIAL等の既知問題は継承し、今回修正していない。
- 268 baseline＋23 V0 PASSはFreezeのclean検証証拠。今回は製品差分0のasset制作で、正式回帰・buildの新しい実行結果ではない。
- sampling検査とoffline renderはBabylon座標変換・shader・表示時計の検査を代替しない。
- Blender/Python廃止予告は将来6.0向け。採用5.2.1の制作・export・再importは完了。検査ログ・Validator・previewはartifacts内で、Git backupした成果物ではない。
- TRS方式のため芽だけの揺れや独立した表情変化はない。今回の採用仕様どおり。

## 21. Babylon connection readiness

asset側の前提条件は揃った。後続の明示的な接続依頼では、本GLBを対象にV0 Adapter契約を保持して実装・故障検査・正式回帰・性能比較へ進められる。

GLB +Z正面からV0左手系へのloader変換とPlacement yawを仕様どおり確認し、準備中・失敗時は2Dで回答継続する。4 clip完了をゲーム進行条件にせず、退出後load完了とAnimationGroupを含む資源所有を検査する。V0 cold 156〜169msとの比較を保持する。

今回の変更は**master追加、GLB追加、本レポート更新、artifacts内の制作・検査証拠**に限定。src、package.json、package-lock.json、battleScreen、V0 Adapter、save / learning / SRS、教材、stage progression、IME、Tutorialの変更0。main・V0/stable tag・index・HEADを保持。HKD-E01制作で終了し、Babylon接続・背景制作・他monster・V1bは開始していない。

**ASSET BUILD PASS  READY FOR GLB INTEGRATION**
