# Yomitabi 3D V1a — 正式性能比較 最終報告

作成日: 2026-09-09 JST。対象: 2D Stable / primitive V0 / GLB V1a、HKD-E01のみ。

## 1. Executive Summary

**V1a CONDITIONAL GO**

保存済み引継ぎから再開し、RCG1 → RCP2 → RCG2 → RCP3 → RCG3の残り5 runのみ新規実行した。5件すべて初回IDで有効。主比較9 run、RCP1、GLB区間診断D1-r3、lifecycle L1-r1は既存証拠を再利用した。旧RP/RGの6件は既読比較から除外したまま。製品変更、最適化、再build、GLB変更、commit/push/tag操作は実施していない。

機能・Core不変・保存・退出資源の条件は通過した。正式主比較のG−P cold最大Long Task差は−10 / +77 / −21ms、既読比較は−8 / −96 / +67ms。全3組+100ms以上、G全3組約300ms以上のいずれも観測していない。

ただし、2D比idle CPUはGで+5.977 / +10.383 / +4.443ptとなり、+5pt目標を2組で超えた。既読coldではP/G全runで回答可能A0Sの後にLong Taskが生じ、Gの3D提示はA0Sから789.0〜972.4ms後。これは回答gateへの3D依存とは異なる、実在するmain-thread stallである。最初のユーザー入力をstall中に送る試験はなく、応答遅延そのものを認証した結果ではない。

またRCP1だけChrome .82、残り既読5 runは.83で、既読1組目は同一browser版の対照ではない。更新差を報告して一度停止し、ユーザーの「続けてください」を受けて既存runを保持した。以上により無条件のV1b準備完了とはしない。背景制作は今回開始しない。

## 2. Tested commits / hashes

Gはasset checkpoint上の**未commit GLB Integration working tree**。HEAD単独で測定対象Gを再現できるとはしない。


| arm | 役割 / worktree | HEAD |
| --- | --- | --- |
| B | 2D Stable / ../baseline-2d | 2a521dd5aa747314b25e761d976bd4f880cd58c3 |
| P | primitive V0 / ../v0-freeze-verify-20260908 | 15ee0be672ca8ec56e773a75959ce9535877cb19 |
| G | GLB V1a / experiment | a23285cbff2ffaf990713a38119ecfb9e897ec35 |


branch: experiment/3d-vertical-slice。作業場所: C:/kanji-game-latest/artifacts/yomitabi-e0/worktrees/experiment。

保護refsは開始時から最終確認まで不変:

| ref | hash |
| --- | --- |
| main | 2a521dd5aa747314b25e761d976bd4f880cd58c3 |
| yomitabi-2d-stable-2026-09 | 6fcd0afd23b0066a4f46f1a4169e01c98f490c06 |
| yomitabi-3d-v0-babylon-2026-09 | 76e5c7210888ba5f3bf79b86d5e35be86f5b3158 |
| yomitabi-3d-v0-babylon-2026-09^{} | 15ee0be672ca8ec56e773a75959ce9535877cb19 |


開始時製品ファイルの全SHA-256は[product-freeze.json](artifacts/v1a/performance-01/product-freeze.json)（B 4,061 / P 4,064 / G 4,072ファイル）、production distは[build-freeze.json](artifacts/v1a/performance-01/build-freeze.json)に保持。dist tree fingerprint（隔離サーバーmanifestの値）:

| arm | dist files | tree SHA-256 |
| --- | --- | --- |
| B | 3963 | 8effc5c2e2110a2a5c248c431d3552cf2f4772e747a2dee2b527096c2ab43cad |
| P | 3987 | 9bf913445c7e52693891379d1c5eb3fdf997fd705b7777f32d4aa0be432b1db6 |
| G | 4054 | 08b96bbee86320a39254c63f596d4148c1ed2ac1e192604ff5de8815e970f6ad |


GLB SHA-256: da77cb290755bd40005004ecb4b036b8ac4f268888de29cd37b952bd44048d7f。
既読fixture entries SHA-256: ad3bb4b53470a114aedd63d23a03ea769a343bb22bb35f58f8ae347029b0fdd5。
元B1-r2 evidence SHA-256: 6dfcc14a385d963ba5e0a3d78e236c4e61255125136dfa46f480ec3ffc49f62e。

測定toolは中断時pause-2026-09-08T13-13-07-343Z.jsonの全tools/v1a-performance SHA-256と一致。各runのsourceコピーとtoolHashesも保存。今回追加したのはartifacts配下の集計・検証スクリプト／記録と本報告。最終検証は[final-integrity.json](artifacts/v1a/performance-01/final-integrity.json)。

## 3. Environment

Windows 10.0.26200 x64、AMD Ryzen 7 7735HS、logical 16、RAM 33,049,239,552 bytes、Node 22.14.0。GPUはAMD Radeon(TM) Graphics、AMD driver 32.0.21037.3009。SystemInfoにはMicrosoft Basic Render Driverも列挙されるが、これを実使用GPUとは断定しない。各evidenceのsystemに実際のGPU/ANGLE情報を保持する。

DPR 1.5、screen 1280×800 CSS、inner 1086×723 CSS。Chrome windowはleft10/top10、1100×818、normal。各runで空の新規profile、visible/focus、minimized、bounds、Chrome PID、targetを監視。能動的な最前面固定・visibility偽装なし。document-start直後の短いfocus=falseはpageshow前のfocus取得を検査し、途中blurとは分離した。有効15 runすべて監査通過。OSの任意瞬間のforegroundや全process負荷を完全に証明するものではない。

主9 run・RCP1・D1-r3・L1-r1はChrome 152.0.7977.82。今回のRCG1/RCP2/RCG2/RCP3/RCG3は152.0.7977.83。再開時[不一致記録](artifacts/v1a/performance-01/resume-preflight-2026-09-09T02-55-01-768Z.json)と[ユーザー続行承認記録](artifacts/v1a/performance-01/resume-browser-authorization-correction.json)を保持。既読pair 1は版・日をまたぐ参考対照、pair 2/3は.83内の対照である。再測定禁止と続行承認に従いRCP1を置換していない。

G2前には約2時間半の間隔があり、G2だけでなくB3/P3もT1・CPUが高い。電源plan、温度、他process負荷を固定・連続観測した証拠はなく、時間帯変動を製品差へ断定しない。指定idle sleepは10秒だが監視付きwaitの実時間は主11.288〜11.618秒、RCP1 11.220秒、今回12.375〜12.403秒。実測分母でCPUを計算し、一定10秒だったとは記載しない。

## 4. B/P/G protocol

同じ保存済みproduction buildをloopbackで配信。ports B49721/P49724/G49722、canary49723。CSP connect-src self、no-store、無圧縮、架空fixture。空Storage/SW/cacheを確認し、隔離preflight→fixture seed→readback→通常UIを実行。各run直前に新しい「準備完了」を受け、15秒復帰猶予後にvisible/focusを2回確認してarmした。

主比較順はB1→P1→G1、B2→P2→G2、B3→P3→G3。実IDは§5。初回Tutorialを通常UIで完了、pad OFF、stage→A0S→E01 idle→正答attack→誤答attack→heal→致死まで追加attack→E02 idle→退出→再入場。回答は既存問題のreadingを使用し、HP・乱数・タイマーへ代入していない。乱数による弱点・damage差で致死までの追加attack数は異なる。

N0はdocument performance.timeOrigin、時間は原則N0相対ms。T1は既存起動条件、title、start handler、hit-test、boot overlay除去を満たす観測境界。E0は初回battleへ進む確定クリック、E1Bはbattle.enter入口。A0S/ASは既存turn/inputEnabled、submission active/unlocked、compositionなし、有効question token、入力とattack/healのhit-test、Tutorial終了、visibleを満たす正式観測境界。3D readyは含めない。U0は実Enter/attack/heal操作イベント。主runは停止breakpoint/重いtraceを使わず、軽いprobeと非停止session計測点を使用した。D1-r3の20計測点／GPU wrapperは別診断である。

frameは生rAF timestampの差。interval内に両端が入る間隔のみ集計し、複数defeat区間のpercentileを平均せず生sampleを合算。frame時刻はrAFのcallback timestampであり、各callback実行終了や物理scanoutではない。Long TaskはPerformanceObserver記録。記録durationが50ms（診断には49msもある）の量子化値を保持し、**50ms超件数・合計はduration > 50**で別計算した。

NetworkはCDP loadingFinishedのencodedDataLength（header込み）を完了時刻で集計。CDP Document requestのwallTimeとtimeOriginの差5.033〜14.551msを補正して画面markerと同じ原点にした。補正前summaryのbytesと最終bytesは全15 runで同一だった。responseReceivedの通知時刻をdownload完了と取り違えず、GLB細区間はResource Timingでも照合。Resource Timing transferSizeは別定義（例GLB 43,916）なのでCDP 44,340と混合しない。

## 5. Main 9 runs


| 組 | B | P | G |
| --- | --- | --- | --- |
| 1 | [B1-r2](artifacts/v1a/performance-01/B1-r2-evidence.json) | [P1-r1](artifacts/v1a/performance-01/P1-r1-evidence.json) | [G1](artifacts/v1a/performance-01/G1-evidence.json) |
| 2 | [B2](artifacts/v1a/performance-01/B2-evidence.json) | [P2](artifacts/v1a/performance-01/P2-evidence.json) | [G2-r1](artifacts/v1a/performance-01/G2-r1-evidence.json) |
| 3 | [B3](artifacts/v1a/performance-01/B3-evidence.json) | [P3](artifacts/v1a/performance-01/P3-evidence.json) | [G3-r1](artifacts/v1a/performance-01/G3-r1-evidence.json) |


| ID | runner開始 JST（gate待機を含む） | Chrome | 採用 |
| --- | --- | --- | --- |
| B1-r2 | 2026-09-08 17:29:15 | Chrome/152.0.7977.82 | PASS |
| P1-r1 | 2026-09-08 17:38:08 | Chrome/152.0.7977.82 | PASS |
| G1 | 2026-09-08 17:43:28 | Chrome/152.0.7977.82 | PASS |
| B2 | 2026-09-08 17:47:57 | Chrome/152.0.7977.82 | PASS |
| P2 | 2026-09-08 17:52:37 | Chrome/152.0.7977.82 | PASS |
| G2-r1 | 2026-09-08 20:19:44 | Chrome/152.0.7977.82 | PASS |
| B3 | 2026-09-08 20:24:31 | Chrome/152.0.7977.82 | PASS |
| P3 | 2026-09-08 20:27:30 | Chrome/152.0.7977.82 | PASS |
| G3-r1 | 2026-09-08 20:37:39 | Chrome/152.0.7977.82 | PASS |


既存9 runを再測定せず採用。失敗を含むraw一覧は§23。数値の悪い有効runを除外していない。

## 6. T1 / A0S

単位ms。A0S絶対値には手順上のtitle/stage操作時間も入るため、準備性能の差はE0→A0Sとして比較する。

| run | T1−N0 | E0→A0S | A0S−N0 | 最初の3D提示−N0 |
| --- | --- | --- | --- | --- |
| B1-r2 | 120.5 | 1968.3 | 8543.2 | — |
| P1-r1 | 121.6 | 1989.8 | 8596.1 | 7275.5 |
| G1 | 116.9 | 1954.8 | 8633.1 | 7794.7 |
| B2 | 126.0 | 1969.5 | 8595.5 | — |
| P2 | 123.2 | 1970.1 | 8532.1 | 7193.6 |
| G2-r1 | 227.0 | 2321.1 | 9705.9 | 9157.1 |
| B3 | 251.5 | 2213.4 | 9750.8 | — |
| P3 | 248.5 | 2257.4 | 9576.6 | 8330.3 |
| G3-r1 | 230.0 | 2356.9 | 9645.3 | 9170.0 |


| 組 | P−B T1 | G−P T1 | G−B T1 | P−B E0A0S | G−P E0A0S | G−B E0A0S |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | +1.1 | -4.7 | -3.6 | +21.5 | -35.0 | -13.5 |
| 2 | -2.8 | +103.8 | +101.0 | +0.6 | +351.0 | +351.6 |
| 3 | -3.0 | -18.5 | -21.5 | +44.0 | +99.5 | +143.5 |


G2は2D比T1+101.0ms、E0A0S+351.6msで目標外。G3もE0A0S+143.5ms。全3組一貫の+50ms T1／+100ms級A0S悪化ではない。negative deltaを高速化の証拠とはしない。主比較の3D提示はTutorial終了前に起こり、この表だけでは既読時の応答性を保証できない。

## 7. Input / next-AS

単位ms。致死は最後のdefeat actionのみ。HP0はstate probeが最初にHP0を観測した点、E02は最初の敵変更state。source HP代入の瞬間ではなく観測境界／フレーム精度である。U0→次ASには既存反撃・heal・撃破待ちを含み、低水準input latencyではない。

| run | 正答attack | 誤答attack | heal | 致死attack→AS | HP0観測→E02 | 再enter→AS |
| --- | --- | --- | --- | --- | --- | --- |
| B1-r2 | 1325.9 | 3030.6 | 1975.6 | 1026.6 | 1021.2 | 1.2 |
| P1-r1 | 1309.4 | 3049.2 | 1992.3 | 1022.1 | 1015.1 | 1.1 |
| G1 | 1325.4 | 3013.4 | 1973.8 | 1027.5 | 1021.3 | 1.2 |
| B2 | 1314.2 | 3012.3 | 1993.0 | 1024.4 | 1018.7 | 1.4 |
| P2 | 1330.7 | 3030.6 | 1975.7 | 1021.6 | 1014.3 | 1.1 |
| G2-r1 | 1321.7 | 3028.1 | 1975.6 | 1023.4 | 1014.3 | 1.9 |
| B3 | 1337.5 | 3049.2 | 1978.9 | 1033.7 | 1023.7 | 4.1 |
| P3 | 1324.9 | 3061.6 | 1982.9 | 1024.8 | 1012.9 | 2.0 |
| G3-r1 | 1337.9 | 3043.2 | 1967.9 | 1024.7 | 1014.3 | 2.2 |


正答約1.31〜1.34秒、誤答約3.01〜3.06秒、heal約1.97〜1.99秒、致死約1.02〜1.03秒。Gで一貫した追加待ちは認めない。再enter→ASはG 1.2 / 1.9 / 2.2msで、GLB再準備完了を待たない。値が短くても後続cold workのstallが0という意味ではない。

## 8. Frame comparison

主比較E01 idle:

| run | frame数 | median ms | p95 ms | max ms | >33 | >50 |
| --- | --- | --- | --- | --- | --- | --- |
| B1-r2 | 681 | 16.7 | 17.0 | 17.5 | 0 | 0 |
| P1-r1 | 681 | 16.7 | 17.0 | 17.5 | 0 | 0 |
| G1 | 676 | 16.7 | 17.0 | 17.4 | 0 | 0 |
| B2 | 686 | 16.7 | 16.9 | 18.0 | 0 | 0 |
| P2 | 681 | 16.7 | 17.0 | 17.7 | 0 | 0 |
| G2-r1 | 676 | 16.7 | 17.1 | 19.1 | 0 | 0 |
| B3 | 691 | 16.7 | 17.0 | 18.3 | 0 | 0 |
| P3 | 695 | 16.7 | 17.0 | 19.7 | 0 | 0 |
| G3-r1 | 688 | 16.7 | 17.1 | 19.9 | 0 | 0 |


主比較全interval（E01 idle、各回答、致死までの追加attack、E02 idle）の合算:

| arm | frame数 | >33件 | >33率 % | >50件 |
| --- | --- | --- | --- | --- |
| B | 4622 | 2 | 0.0433 | 1 |
| P | 4607 | 3 | 0.0651 | 0 |
| G | 4489 | 5 | 0.1114 | 2 |


G1正答33.7ms、G2致死付近50.4ms、G3致死付近64.3ms。B3にも50.1ms、P3にも48.4msがある。G2は>33msの連続2 frameがある。定常idleの持続悪化や頻発とは判断しないが、50ms超frameが0とはしない。rAF間隔とLong Taskは別指標で、これら操作interval内のLong Taskは0。

区間別全値（ms、追加attack区間はraw sampleを合算）:

| run | 区間 | 数 | median | p95 | max | >20 | >33 | >50 | 最大>33連続 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B1-r2 | E01 idle | 681 | 16.7 | 17.0 | 17.5 | 0 | 0 | 0 | 0 |
| B1-r2 | 正答attack | 107 | 16.7 | 16.8 | 17.4 | 0 | 0 | 0 | 0 |
| B1-r2 | 誤答attack | 204 | 16.7 | 17.0 | 17.8 | 0 | 0 | 0 | 0 |
| B1-r2 | heal | 145 | 16.7 | 17.0 | 17.2 | 0 | 0 | 0 | 0 |
| B1-r2 | 追加attack〜致死 | 297 | 16.7 | 16.9 | 17.3 | 0 | 0 | 0 | 0 |
| B1-r2 | E02 idle | 136 | 16.7 | 16.9 | 17.8 | 0 | 0 | 0 | 0 |
| P1-r1 | E01 idle | 681 | 16.7 | 17.0 | 17.5 | 0 | 0 | 0 | 0 |
| P1-r1 | 正答attack | 103 | 16.7 | 17.0 | 17.3 | 0 | 0 | 0 | 0 |
| P1-r1 | 誤答attack | 207 | 16.7 | 16.9 | 17.3 | 0 | 0 | 0 | 0 |
| P1-r1 | heal | 147 | 16.7 | 16.9 | 20.1 | 1 | 0 | 0 | 0 |
| P1-r1 | 追加attack〜致死 | 293 | 16.7 | 16.9 | 17.4 | 0 | 0 | 0 | 0 |
| P1-r1 | E02 idle | 134 | 16.7 | 16.9 | 17.4 | 0 | 0 | 0 | 0 |
| G1 | E01 idle | 676 | 16.7 | 17.0 | 17.4 | 0 | 0 | 0 | 0 |
| G1 | 正答attack | 103 | 16.7 | 16.9 | 33.7 | 1 | 1 | 0 | 1 |
| G1 | 誤答attack | 205 | 16.7 | 17.0 | 17.3 | 0 | 0 | 0 | 0 |
| G1 | heal | 146 | 16.7 | 16.9 | 17.4 | 0 | 0 | 0 | 0 |
| G1 | 追加attack〜致死 | 187 | 16.7 | 16.9 | 17.3 | 0 | 0 | 0 | 0 |
| G1 | E02 idle | 136 | 16.7 | 16.9 | 17.5 | 0 | 0 | 0 | 0 |
| B2 | E01 idle | 686 | 16.7 | 16.9 | 18.0 | 0 | 0 | 0 | 0 |
| B2 | 正答attack | 102 | 16.7 | 17.2 | 17.4 | 0 | 0 | 0 | 0 |
| B2 | 誤答attack | 208 | 16.7 | 16.9 | 17.2 | 0 | 0 | 0 | 0 |
| B2 | heal | 145 | 16.7 | 16.9 | 17.3 | 0 | 0 | 0 | 0 |
| B2 | 追加attack〜致死 | 192 | 16.7 | 17.0 | 17.6 | 0 | 0 | 0 | 0 |
| B2 | E02 idle | 137 | 16.7 | 16.8 | 17.0 | 0 | 0 | 0 | 0 |
| P2 | E01 idle | 681 | 16.7 | 17.0 | 17.7 | 0 | 0 | 0 | 0 |
| P2 | 正答attack | 102 | 16.7 | 16.8 | 17.3 | 0 | 0 | 0 | 0 |
| P2 | 誤答attack | 208 | 16.7 | 16.9 | 17.6 | 0 | 0 | 0 | 0 |
| P2 | heal | 145 | 16.7 | 16.9 | 17.6 | 0 | 0 | 0 | 0 |
| P2 | 追加attack〜致死 | 288 | 16.7 | 17.0 | 33.3 | 1 | 1 | 0 | 1 |
| P2 | E02 idle | 137 | 16.7 | 16.8 | 17.1 | 0 | 0 | 0 | 0 |
| G2-r1 | E01 idle | 676 | 16.7 | 17.1 | 19.1 | 0 | 0 | 0 | 0 |
| G2-r1 | 正答attack | 106 | 16.7 | 17.2 | 18.5 | 0 | 0 | 0 | 0 |
| G2-r1 | 誤答attack | 209 | 16.7 | 17.0 | 18.4 | 0 | 0 | 0 | 0 |
| G2-r1 | heal | 143 | 16.7 | 17.0 | 17.8 | 0 | 0 | 0 | 0 |
| G2-r1 | 追加attack〜致死 | 187 | 16.7 | 17.0 | 50.4 | 2 | 2 | 1 | 2 |
| G2-r1 | E02 idle | 135 | 16.7 | 17.2 | 18.7 | 0 | 0 | 0 | 0 |
| B3 | E01 idle | 691 | 16.7 | 17.0 | 18.3 | 0 | 0 | 0 | 0 |
| B3 | 正答attack | 105 | 16.7 | 16.9 | 17.4 | 0 | 0 | 0 | 0 |
| B3 | 誤答attack | 207 | 16.7 | 17.0 | 17.2 | 0 | 0 | 0 | 0 |
| B3 | heal | 145 | 16.7 | 17.0 | 19.9 | 0 | 0 | 0 | 0 |
| B3 | 追加attack〜致死 | 295 | 16.7 | 17.1 | 50.1 | 2 | 2 | 1 | 1 |
| B3 | E02 idle | 139 | 16.7 | 17.1 | 17.4 | 0 | 0 | 0 | 0 |
| P3 | E01 idle | 695 | 16.7 | 17.0 | 19.7 | 0 | 0 | 0 | 0 |
| P3 | 正答attack | 108 | 16.7 | 16.9 | 17.2 | 0 | 0 | 0 | 0 |
| P3 | 誤答attack | 211 | 16.7 | 17.0 | 18.4 | 0 | 0 | 0 | 0 |
| P3 | heal | 145 | 16.7 | 16.9 | 18.0 | 0 | 0 | 0 | 0 |
| P3 | 追加attack〜致死 | 189 | 16.7 | 17.2 | 48.4 | 2 | 2 | 0 | 1 |
| P3 | E02 idle | 133 | 16.7 | 16.9 | 17.1 | 0 | 0 | 0 | 0 |
| G3-r1 | E01 idle | 688 | 16.7 | 17.1 | 19.9 | 0 | 0 | 0 | 0 |
| G3-r1 | 正答attack | 107 | 16.7 | 17.0 | 17.2 | 0 | 0 | 0 | 0 |
| G3-r1 | 誤答attack | 206 | 16.7 | 17.1 | 18.5 | 0 | 0 | 0 | 0 |
| G3-r1 | heal | 145 | 16.7 | 17.0 | 17.6 | 0 | 0 | 0 | 0 |
| G3-r1 | 追加attack〜致死 | 296 | 16.7 | 17.1 | 64.3 | 2 | 2 | 1 | 1 |
| G3-r1 | E02 idle | 138 | 16.7 | 17.0 | 17.3 | 0 | 0 | 0 | 0 |


再入場短区間は定常idleと分ける。G2のp95 33.4msは約0.53秒の過渡区間であり、定常p95>20ms持続へ読み替えない。

| run | 再入場frame数 | median | p95 | max | >33 | >50 | Long Task >50 件 / 合計ms |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B1-r2 | 30 | 16.7 | 16.8 | 16.9 | 0 | 0 | 0 / 0 |
| P1-r1 | 30 | 16.7 | 16.8 | 16.9 | 0 | 0 | 0 / 0 |
| G1 | 30 | 16.7 | 17.2 | 17.3 | 0 | 0 | 0 / 0 |
| B2 | 30 | 16.7 | 17.0 | 17.2 | 0 | 0 | 0 / 0 |
| P2 | 30 | 16.7 | 16.8 | 16.8 | 0 | 0 | 0 / 0 |
| G2-r1 | 27 | 16.7 | 33.4 | 50.0 | 3 | 0 | 1 / 63 |
| B3 | 32 | 16.7 | 17.4 | 17.9 | 0 | 0 | 0 / 0 |
| P3 | 28 | 16.7 | 17.0 | 50.2 | 1 | 1 | 0 / 0 |
| G3-r1 | 29 | 16.7 | 19.9 | 30.7 | 0 | 0 | 0 / 0 |


主比較cold窓のframeも別表に残す。coldはTutorial操作と初期準備を含む過渡区間で、定常idleではない。

| run | cold frame数 | median | p95 | max | >20 | >33 | >50 | 最大>33連続 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B1-r2 | 111 | 16.7 | 17.2 | 133.5 | 4 | 4 | 2 | 4 |
| P1-r1 | 100 | 16.7 | 33.4 | 166.8 | 8 | 7 | 4 | 2 |
| G1 | 102 | 16.7 | 33.3 | 200.1 | 6 | 6 | 2 | 4 |
| B2 | 111 | 16.7 | 17.1 | 166.9 | 4 | 4 | 2 | 4 |
| P2 | 101 | 16.7 | 33.2 | 200.2 | 6 | 6 | 3 | 2 |
| G2-r1 | 98 | 16.7 | 100.0 | 267.2 | 8 | 8 | 6 | 3 |
| B3 | 107 | 16.7 | 17.2 | 266.9 | 4 | 4 | 4 | 3 |
| P3 | 95 | 16.7 | 66.5 | 333.7 | 9 | 9 | 5 | 3 |
| G3-r1 | 96 | 16.7 | 100.2 | 350.4 | 9 | 9 | 6 | 3 |

## 9. CPU comparison

CPU = 100×ΔTaskDuration / ΔCDP Timestamp。renderer main-threadの観測比率でありWindows全CPU使用率・GPU使用率ではない。probe/CDP負荷を含む。

| run | 観測秒 | TaskDuration秒 | CPU % |
| --- | --- | --- | --- |
| B1-r2 | 11.365 | 1.539163 | 13.543 |
| P1-r1 | 11.385 | 2.220953 | 19.509 |
| G1 | 11.300 | 2.205725 | 19.520 |
| B2 | 11.455 | 1.671092 | 14.588 |
| P2 | 11.372 | 2.204155 | 19.383 |
| G2-r1 | 11.288 | 2.818794 | 24.971 |
| B3 | 11.534 | 2.449790 | 21.239 |
| P3 | 11.618 | 2.799124 | 24.093 |
| G3-r1 | 11.487 | 2.950006 | 25.682 |


| 組 | P−B pt | G−P pt | G−B pt |
| --- | --- | --- | --- |
| 1 | +5.965 | +0.011 | +5.977 |
| 2 | +4.795 | +5.589 | +10.383 |
| 3 | +2.854 | +1.589 | +4.443 |


G−Bの+5pt目標は1/3組のみ満たす。G2は+10.383ptだが、全3組+10pt級一貫ではない。G−Pが小さい組だけを示してV0の既存費用を除外したり、新たに+5ptの枠を足したりしない。背景追加のCPU余裕を保証できず、条件付き判定の理由とする。

## 10. Network comparison

CDP transfer bytes、loopback無圧縮・header込み。初期画像／教材／audio等の既存大量取得を含む総量。3D readyはfirst visible-state代理。主Pでは3D提示がA0Sより早いため、ready列がA0S列より小さくなり得る。

| run | N0→A0S bytes | N0→3D ready bytes | A0SまでBGM bytes | A0SまでBGM除外 bytes |
| --- | --- | --- | --- | --- |
| B1-r2 | 30,740,638 | — | 2,207,438 | 28,533,200 |
| P1-r1 | 31,924,331 | 31,918,642 | 2,207,440 | 29,716,891 |
| G1 | 32,666,668 | 32,666,668 | 2,207,442 | 30,459,226 |
| B2 | 30,740,638 | — | 2,207,438 | 28,533,200 |
| P2 | 32,124,949 | 32,119,260 | 2,408,058 | 29,716,891 |
| G2-r1 | 32,867,286 | 32,867,286 | 2,408,060 | 30,459,226 |
| B3 | 30,740,638 | — | 2,207,438 | 28,533,200 |
| P3 | 32,124,949 | 32,119,260 | 2,408,058 | 29,716,891 |
| G3-r1 | 32,666,668 | 32,666,668 | 2,207,442 | 30,459,226 |


北海道BGM a/bのbody選択差に対応するtransfer差は200,618 bytes。BGMを除くG−P差は各742,335 bytes、G−B差は各1,926,026 bytesで一定。B/P/GのX-Yomitabi-E0 role header長等による1〜2 bytes/resource差も総量に含まれ、総差を製品JS bytesだけと呼ばない。

初回3D関連resourceを各URL・初回入場分だけ計上:

| 分類 | P bytes | G bytes | G−P bytes |
| --- | --- | --- | --- |
| renderer chunk（coreを内包） | 1,030,134 | 1,043,421 | 13,287 |
| loader/parser/shared chunk | 0 | 197,767 | 197,767 |
| その他lazy JS（shader/material/BRDF/animation等） | 149,956 | 635,582 | 485,626 |
| GLB | 0 | 44,340 | 44,340 |
| 3D関連初回合計 | 1,180,090 | 1,921,110 | 741,020 |
| main chunk（別枠） | 559,170 | 560,482 | 1,312 |
| Tutorial chunk（別枠） | 12,146 | 12,147 | 1 |


Pの歴史的V0 transfer 1,180,095 bytesと今回は5 bytes差がある。今回Pのrole headerと歴史的experiment header長の差が5 resourceへ現れるため、5 bytesを最適化とは解釈しない。Gは33 JS chunks＋GLBの34 resource、Pは5 JS resource。loader/coreのpackage分離とbundle内分割は同義ではなく、197,767 bytesはloader純増だけを単独抽出した値ではない。

G全runで再入場GLB再fetch 44,340 bytesも記録される。初回合計へ再加算しない。no-store server条件であり実CDN圧縮量・cache-hit性能は未検証。

## 11. Cold Long Task

初回battle cold窓はE0〜max(idle開始, 最初の3D提示)。旧summaryはE0〜idle開始だったが、RCG1/2/3では提示がidle開始後へ129.6 / 304.8 / 142.8msはみ出すため窓を延長した。延長部分に追加Long Taskはなく、最大値は旧集計と一致。start/durationはN0相対ms。

| run | cold開始 | cold終了 | 最大ms | >50件 | >50合計ms | 各task start / duration |
| --- | --- | --- | --- | --- | --- | --- |
| B1-r2 | 6574.9 | 8738.1 | 119 | 1 | 119 | 6761.8 / 119 |
| P1-r1 | 6606.3 | 8781.7 | 204 | 2 | 337 | 6793.8 / 133; 6942.9 / 204 |
| G1 | 6678.3 | 8818.3 | 194 | 3 | 376 | 6859.2 / 129; 7001.6 / 194; 7507.0 / 53 |
| B2 | 6626.0 | 8796.5 | 131 | 1 | 131 | 6817.1 / 131 |
| P2 | 6562.0 | 8731.6 | 181 | 2 | 304 | 6735.1 / 123; 6870.9 / 181 |
| G2-r1 | 7384.8 | 9902.7 | 258 | 2 | 484 | 7742.4 / 226; 7991.1 / 258 |
| B3 | 7537.4 | 9955.2 | 212 | 1 | 212 | 7850.2 / 212 |
| P3 | 7319.2 | 9776.4 | 294 | 2 | 510 | 7625.2 / 216; 7865.5 / 294 |
| G3-r1 | 7288.4 | 9838.8 | 273 | 4 | 653 | 7622.7 / 83; 7705.8 / 239; 7968.2 / 273; 8593.2 / 58 |


N0→A0S全体も別計上（battle前の起動／画面遷移taskを含む）:

| run | 最大ms | >50件 | >50合計ms |
| --- | --- | --- | --- |
| B1-r2 | 119 | 5 | 403 |
| P1-r1 | 204 | 7 | 668 |
| G1 | 194 | 7 | 652 |
| B2 | 131 | 6 | 462 |
| P2 | 181 | 6 | 580 |
| G2-r1 | 258 | 7 | 1141 |
| B3 | 212 | 8 | 935 |
| P3 | 294 | 8 | 1162 |
| G3-r1 | 273 | 10 | 1255 |


主比較G−P最大差−10 / +77 / −21ms。G3にはcold4件・合計653msがあり、最大値だけが下がったことをもって無料とはしない。主比較のA0S後、通常idle／回答interval内Long Taskは0。ただし退出付近にはG2 52ms（N0+34394.3）、G3 56ms（+36444.1）、G2再入場には63ms（+36058.1）を観測。これらをcold表へ混ぜず残す。数回の過渡taskで、連続する定常応答停止を証明したものではない。

V0既知156〜169ms、GLB Integration機能診断206ms / 341msは履歴として保持する。機能診断341msの大部分がGLB fetchより前だった記録も保持する。D1-r3やその機能診断値を正式P/G分布へ追加しない。

## 12. Stall cause analysis

再利用した[D1-r3-evidence.json](artifacts/v1a/performance-01/D1-r3-evidence.json)は20個の非停止CDP条件付き計測点＋WebGL API wrapperによる診断。製品src/distの書換えなし。Debugger／wrapperの負荷があるので正式性能とは別表。

| 区間 | wall ms | 解釈 |
| --- | --- | --- |
| Babylon import開始→prepare到達 | 323.0 | 転送・依存評価・Promise継続を含む |
| engine constructor | 19.0 | constructor前後の観測差 |
| scene constructor | 6.5 | 同上 |
| fetch marker→bytes/header開始 | 44.8 | 純downloadではない |
| header検査 | 2.0 | author構造検査を含む |
| SHA待ち | 0.8 | 非同期wall待ち |
| loader/parser chunk import待ち | 70.5 | 共有依存評価を含む |
| parse / AssetContainer待ち | 116.4 | parser呼出準備11.9ms＋container-call後104.5ms |
| runtime validation | 2.2 | bounds/clips/structure |
| PBR material準備待ち | 424.6 | shader取得／driver／poll／event-loop待ち等の複合区間 |
| AnimationGroup setup | 1.8 | parse内でのgroup生成とは別のplayback準備 |
| scene add→ready | 1.2 | sceneへの有効化 |
| 最初の実GLB render呼出し | 32.3 | r.render前後。GPU完了時間ではない |


Resource TimingのGLB fetchStart 8125.4→responseEnd 8130.2ms（4.8ms）と、原点補正CDP 8125.5→8130.3msは整合。fetch marker8124.0→bytes/header8168.8の44.8msには、bytes読取とmain-threadへ戻る遅れも含む。

Long Task 228msは7579.6〜7807.6でimport開始7629.4に重なる。288msは7847.0〜8135.0でprepare/engine/sceneと重なり、大部分はGLB fetch開始8125.4より前。79msは8833.9〜8912.9で初回render8877.3〜8909.6に重なる。したがって43,616-byte GLBのdownloadだけでstall全体を説明できない。主thread上の既存準備／module評価とPBR準備が調査対象として示唆されるが、各関数の純CPU費用をstack traceなしに断定しない。

scene ready8833.8、最初の実GLB render開始8877.3・終了8909.6、first visible-state9076.5（frame53）を別々に記録。提示代理がrender終了より166.9ms遅いことも隠さない。物理表示・GPU fence完了の証明ではない。


| WebGL API | calls | JS呼出合計ms | 最大ms |
| --- | --- | --- | --- |
| bufferData | 15 | 0.400 | 0.200 |
| texImage2D | 2 | 2.900 | 2.900 |
| compileShader | 8 | 0.000 | 0.000 |
| linkProgram | 4 | 0.300 | 0.200 |
| bufferSubData | 5 | 0.000 | 0.000 |


compileShaderの0msは計時分解能以下で、GPU shader compileが無料という意味ではない。texImage2DはBabylon内部BRDF等で、GLB author texture/imageは0。追加の重いtraceは実行していない。現証拠で指定coldトリガーを評価でき、GPU純時間の不足だけを理由に再計測を増やしていない。

## 13. Tutorial-read cold comparison

fixtureはB1-r2のcorrect-ready snapshotの完全コピー。通常UIでTutorialを閉じて最初の正答を保存した後であり、krb_save.meta.compatibilityEntries.tutorial_seen_battle = "1"。起動後title snapshotの保存本体でも同値を確認し、初回battle全stateでtutorialSeen=true、guide=falseをassert。初期正答数1／誤答数0、HP100、EXP0。fixtureを再生成・編集していない。


| run | 開始 JST（gate待機含む） | Chrome | 採用 |
| --- | --- | --- | --- |
| [RCP1](artifacts/v1a/performance-01/RCP1-evidence.json) | 2026-09-08 22:07:58 | Chrome/152.0.7977.82 | PASS |
| [RCG1](artifacts/v1a/performance-01/RCG1-evidence.json) | 2026-09-09 12:03:37 | Chrome/152.0.7977.83 | PASS |
| [RCP2](artifacts/v1a/performance-01/RCP2-evidence.json) | 2026-09-09 12:06:21 | Chrome/152.0.7977.83 | PASS |
| [RCG2](artifacts/v1a/performance-01/RCG2-evidence.json) | 2026-09-09 12:11:33 | Chrome/152.0.7977.83 | PASS |
| [RCP3](artifacts/v1a/performance-01/RCP3-evidence.json) | 2026-09-09 12:15:55 | Chrome/152.0.7977.83 | PASS |
| [RCG3](artifacts/v1a/performance-01/RCG3-evidence.json) | 2026-09-09 12:22:26 | Chrome/152.0.7977.83 | PASS |


RCP1を再実行せず、今回新規5 runだけで各3有効runを完成。既読pair1は.82→.83をまたぐため、**同一版3組の性能保証は未成立**。版差を含む継続plan上の比較として残す。pair2/3は同日同版P/Gで、両方とも+100ms悪化にもG約300msにも該当しない。主比較3組は全て.82内で成立している。


| run | T1−N0 ms | E0→A0S ms | cold最大ms | >50件 | >50合計ms | N0→A0S bytes | N0→3D ready bytes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RCP1 | 120.1 | 196.4 | 176 | 2 | 294 | 29,626,383 | 32,119,260 |
| RCG1 | 134.8 | 214.4 | 168 | 2 | 295 | 29,627,696 | 32,666,668 |
| RCP2 | 122.2 | 222.4 | 225 | 2 | 359 | 29,626,383 | 32,119,260 |
| RCG2 | 135.5 | 187.8 | 129 | 1 | 129 | 29,627,696 | 32,666,668 |
| RCP3 | 116.7 | 198.6 | 120 | 2 | 174 | 29,626,383 | 31,924,331 |
| RCG3 | 120.0 | 210.6 | 187 | 2 | 304 | 29,627,696 | 32,867,286 |


RCG2のobserver記録は129msと50msの2件だが、厳密な>50集計は1件／129ms。50msの記録を削除せず保持する。frameもLong Taskも丸め前の値で判定する。


| 組 | browser一致 | G−P cold最大ms | G−P T1 ms | G−P E0A0S ms | G−P idle CPU pt |
| --- | --- | --- | --- | --- | --- |
| 1 | NO（承認済み版差） | -8 | +14.7 | +18.0 | +0.079 |
| 2 | yes | -96 | +13.3 | -34.6 | +1.093 |
| 3 | yes | +67 | +3.3 | +12.0 | +1.063 |



| run | idle frame数 | median ms | p95 ms | max ms | >33 | >50 |
| --- | --- | --- | --- | --- | --- | --- |
| RCP1 | 672 | 16.7 | 16.8 | 20.0 | 0 | 0 |
| RCG1 | 742 | 16.7 | 16.8 | 17.4 | 0 | 0 |
| RCP2 | 743 | 16.7 | 16.8 | 17.2 | 0 | 0 |
| RCG2 | 742 | 16.7 | 16.8 | 17.3 | 0 | 0 |
| RCP3 | 741 | 16.7 | 16.8 | 17.9 | 0 | 0 |
| RCG3 | 742 | 16.7 | 16.8 | 17.7 | 0 | 0 |


| run | idle観測秒 | TaskDuration秒 | CPU % |
| --- | --- | --- | --- |
| RCP1 | 11.220 | 1.863405 | 16.608 |
| RCG1 | 12.396 | 2.068547 | 16.687 |
| RCP2 | 12.403 | 2.012750 | 16.227 |
| RCG2 | 12.387 | 2.145486 | 17.321 |
| RCP3 | 12.375 | 1.922900 | 15.539 |
| RCG3 | 12.387 | 2.056519 | 16.602 |


既読Pに2D対照を追加していないため、このCPU差から2D比+5pt目標を判定し直さない。今回の既読idle値は主比較と別分布で、主G2の高値を上書きしない。

回答可能時点と準備の重なり（全てN0相対ms、最終列は正ならidle開始後提示）:

| run | A0S | 3D提示 | 提示−A0S | 最初のLT開始−A0S | GLB request | 提示−idle開始 |
| --- | --- | --- | --- | --- | --- | --- |
| RCP1 | 4470.9 | 4909.7 | 438.8 | 36.9 | N/A | -235.7 |
| RCG1 | 4673.8 | 5493.3 | 819.5 | 39.3 | 5005.6 | 129.6 |
| RCP2 | 4635.7 | 5113.7 | 478.0 | 12.0 | N/A | -190.5 |
| RCG2 | 4507.2 | 5479.6 | 972.4 | 10.3 | 4897.3 | 304.8 |
| RCP3 | 4510.9 | 5014.7 | 503.8 | 36.1 | N/A | -167.3 |
| RCG3 | 4486.7 | 5275.7 | 789.0 | 11.6 | 4804.7 | 142.8 |


全runで最初のcold Long TaskはA0Sの10.3〜39.3ms後に開始。Gの最大taskの開始・終了はRCG1 4853.2〜5021.2ms、RCG2 4517.5〜4646.5ms、RCG3 4631.0〜4818.0ms。RCG1/3は最大task終端付近でGLB取得が始まり、RCG2の最大taskはGLB取得前。この関係は「Tutorialの裏に隠れるだけで、既読なら問題がない」を否定する。**漢字閲覧・回答開始が可能になった直後とcold準備stallが重なる。**

ただし測定driverはidleを経てから回答を送るため、このstall中の実入力／IMEの遅延や取りこぼしを直接測ったものではない。正式ASが成立してもevent-loopがその後占有されるため、非同期Promise・2D fallbackだけでは応答性を保証できない。


| run | cold開始 | cold終了 | 最大ms | >50件 | >50合計ms | 各task start / duration |
| --- | --- | --- | --- | --- | --- | --- |
| RCP1 | 4274.5 | 5145.4 | 176 | 2 | 294 | 4507.8 / 118; 4641.4 / 176 |
| RCG1 | 4459.4 | 5493.3 | 168 | 2 | 295 | 4713.1 / 127; 4853.2 / 168 |
| RCP2 | 4413.3 | 5304.2 | 225 | 2 | 359 | 4647.7 / 134; 4796.8 / 225 |
| RCG2 | 4319.4 | 5479.6 | 129 | 1 | 129 | 4517.5 / 129; 4861.8 / 50 |
| RCP3 | 4312.3 | 5182.0 | 120 | 2 | 174 | 4547.0 / 120; 4863.8 / 54 |
| RCG3 | 4276.1 | 5275.7 | 187 | 2 | 304 | 4498.3 / 117; 4631.0 / 187 |


A0S〜cold終了の短い過渡frame（定常idleとは別）:

| run | frame数 | median | p95 | max | >33 | >50 |
| --- | --- | --- | --- | --- | --- | --- |
| RCP1 | 21 | 16.7 | 83.5 | 116.7 | 2 | 2 |
| RCG1 | 29 | 16.7 | 16.8 | 183.5 | 1 | 1 |
| RCP2 | 17 | 16.7 | 167.4 | 167.4 | 2 | 2 |
| RCG2 | 43 | 16.7 | 17.3 | 116.7 | 2 | 1 |
| RCP3 | 22 | 16.7 | 50.2 | 133.5 | 2 | 2 |
| RCG3 | 30 | 16.7 | 67.3 | 133.4 | 2 | 2 |


RCP1/2には2連続、RCG1には183.5msなどのrAF間隔がある。短区間のp95は分布の少数sampleに左右される。G3のcold合計304msは「最大task304ms」ではなく117+187ms。約300ms単一task判定へ誤用しない。

既読runの通常回答intervalのLong Taskは全て0。再入場はRCG1に83.5ms frameが1件、Long Task0。その他既読Gの再入場>33msは0。これも定常idle表から隠さない。

## 14. GLB asset cost

HKD-E01.v1a.1.glbは43,616 bytes、768 triangles、642 vertices、2,304 indices、1 author mesh / 1 primitive / 1 PBR material、4 clips（idle/attack/hit/defeat）、texture/image/skin/morph 0。Blender masterとGLBは変更していない。runtimeではloader rootを加えたasset mesh2＋仮背景mesh1、geometry2/material2、BRDF内部texture1が生存する。author数とruntime資源数を区別する。

初回GLBのCDP transferは44,340 bytes（body43,616）。V1aの3D関連初回総費用1,921,110 bytesの一部にすぎない。Pとの差741,020 bytesにはloader/parser、PBR/BRDF、animation、shader分割の変化を含む。draw callsの専用per-frame値は本性能runに記録されておらず、mesh数をdraw-call数として代用しない。

G初回resource明細（各正式Gで同bytes。Tutorial/mainは§10別枠）:

| resource | 分類 | transfer bytes |
| --- | --- | --- |
| babylonGLBRenderer-D3AcPX3y.js | renderer | 1,043,421 |
| HKD-E01.v1a.1.glb | GLB | 44,340 |
| texture.pure-BaWxLRO5.js | lazy-js | 20,191 |
| glbParser-CZf8e9to.js | loader-parser-shared | 197,767 |
| effectRenderer.pure-DPn7mLQQ.js | lazy-js | 8,998 |
| brdfTextureTools-CLxz5WFW.js | lazy-js | 62,152 |
| pbrMaterialLoadingAdapter-D2ZmBits.js | lazy-js | 13,269 |
| postProcess.pure-BWcQbUTO.js | lazy-js | 19,233 |
| pbrMaterial.pure-r0GaZydG.js | lazy-js | 137,089 |
| animationGroup.pure-XRIwt3Wd.js | lazy-js | 36,443 |
| helperFunctions-Cn6inckt.js | lazy-js | 7,557 |
| rgbdDecode.fragment-DxcWQo5q.js | lazy-js | 1,298 |
| glTFLoaderAnimation.pure-C5KycuMy.js | lazy-js | 2,596 |
| postprocess.vertex-GvJrfhQm.js | lazy-js | 1,229 |
| sceneUboDeclaration-CZxqnL9P.js | lazy-js | 1,105 |
| logDepthVertex-CZU1LEo8.js | lazy-js | 8,562 |
| pbr.vertex-E95S4xKY.js | lazy-js | 17,581 |
| logDepthDeclaration-C3259IOt.js | lazy-js | 1,478 |
| pbrUboDeclaration-BMYgKmQg.js | lazy-js | 2,543 |
| pbrBRDFFunctions-DP4t_KQ0.js | lazy-js | 12,673 |
| clipPlaneVertex-Dhffr3_y.js | lazy-js | 14,790 |
| harmonicsFunctions-Bfg0oC6W.js | lazy-js | 1,867 |
| bumpVertexDeclaration-BM1SQO4O.js | lazy-js | 1,082 |
| bumpVertex-Dgk56A23.js | lazy-js | 1,263 |
| pbrDebug-CT2ShfxB.js | lazy-js | 38,643 |
| oitFragment-BPTMPDGC.js | lazy-js | 52,577 |
| pbr.fragment-BVp7FMzi.js | lazy-js | 97,398 |
| clipPlaneFragment-CVCxe9hq.js | lazy-js | 6,531 |
| pbrIBLFunctions-d-gq3gAS.js | lazy-js | 3,265 |
| bumpFragment-LvElsRpP.js | lazy-js | 7,612 |
| lightFragment-CtQlVlo2.js | lazy-js | 21,318 |
| defaultUboDeclaration-BQl1haou.js | lazy-js | 2,004 |
| default.vertex-DckU4nNw.js | lazy-js | 8,710 |
| default.fragment-Bk5y-hh0.js | lazy-js | 24,525 |


保存画像[L1-r1 battle](artifacts/v1a/performance-01/L1-r1-battle.png)、[再入場](artifacts/v1a/performance-01/L1-r1-reentry.png)、[D1-r3](artifacts/v1a/performance-01/D1-r3-battle.png)を今回実際に開いて確認した。小さな敵枠内で黒い両目・U字口・芽2本・裾が識別でき、漢字／入力／操作UIを覆っていない。静止画だけでanimationの全品質を再認証したとはしない。4 clipとlayout/reduced motionの機能証拠は[Integration Report](YOMITABI_3D_V1A_GLB_INTEGRATION_REPORT.md)を再利用。

## 15. Lifecycle / fallback

[L1-r1-evidence.json](artifacts/v1a/performance-01/L1-r1-evidence.json)を再利用。10 enter/exit全てPASS、退出1秒settled後の実GPU各種0・GLB由来listener0、旧AdapterはGC済みまたはresources={canvases:0}。最終退出も同じ。再実行していない。

| 資源 | enter 1〜10 | exit settled 1〜10 |
| --- | --- | --- |
| engine / scene / container / Placement | 各1 | 破棄、visual参照null |
| 3D canvas | 1（既存と計2） | 0（既存1のみ） |
| mesh / geometry / material | 3 / 2 / 2 | 所有scene/container破棄 |
| AnimationGroup / Animatable / active sampled group | 4 / 3 / 1 | 所有資源破棄 |
| renderer observer / listener | 9 / 11 | 所有元破棄／実listener0 |
| request / deadline / poll / loaderObserver / loop | 各0（ready時） | 0 |
| 実GPU Buffer / Texture / Program / VAO | 15 / 1 / 3 / 2 | 全0 |
| 実GPU Shader / FBO / Renderbuffer / Query | 全0 | 全0 |


Renderer自己申告と外部WebGL create/delete・listener登録解除の監視を併用。全JS到達性をheap snapshotで証明したものではない。共有module cache、既存Image cache、測定bufferは退出GPUとは別。

L1-r1ではcontext loss後、同じquestionで2D正答、再入場GLB復帰、最終退出解放を確認。Integrationの404、HTML200、不正header、parse/import失敗、material例外・not-ready、永久pending、load中exit/late resolve、旧新両完了順、double dispose、sample例外の証拠も再利用。故障により実browser・実parser unit・依存差替えunitの検査層は異なる（Integration §13）。全faultを今回再注入したとはしない。今回の5 runで新規製品異常は出ていない。

## 16. Save / Learning

最終[summarize](artifacts/v1a/performance-01/summary.json)の採用15 run＋L1-r1だけを入力に[audit.json](artifacts/v1a/performance-01/audit.json)を再作成。**299 snapshot valid**。旧無効6 runを含む中間297件とは母集団が異なる。validatorはstable save APIを使用、Storage書込みを禁止し、networkも禁止したオフライン検査である。

各自然回答の保存observationについてquestionId、attack/heal source、correct、independent supportを確認。追加集計では同一run内で全submitted question tokenが一回、各commitの正答／誤答counter増分が厳密に1または0、battle内stageRun ID不変、再入場では新IDであることをassertした。

| run | 検証commit / unique token | 初期正答 / 誤答 | 誤答後HP | heal後HP / 回数残 | E02 EXP / 撃破数 |
| --- | --- | --- | --- | --- | --- |
| B1-r2 | 6 / 6 | 0 / 0 | 91 | 100 / 2 | 26 / 1 |
| P1-r1 | 6 / 6 | 0 / 0 | 91 | 100 / 2 | 26 / 1 |
| G1 | 5 / 5 | 0 / 0 | 91 | 100 / 2 | 26 / 1 |
| B2 | 5 / 5 | 0 / 0 | 91 | 100 / 2 | 26 / 1 |
| P2 | 6 / 6 | 0 / 0 | 91 | 100 / 2 | 26 / 1 |
| G2-r1 | 5 / 5 | 0 / 0 | 91 | 100 / 2 | 26 / 1 |
| B3 | 6 / 6 | 0 / 0 | 91 | 100 / 2 | 26 / 1 |
| P3 | 5 / 5 | 0 / 0 | 91 | 100 / 2 | 26 / 1 |
| G3-r1 | 6 / 6 | 0 / 0 | 91 | 100 / 2 | 26 / 1 |
| RCP1 | 6 / 6 | 1 / 0 | 91 | 100 / 2 | 26 / 1 |
| RCG1 | 6 / 6 | 1 / 0 | 91 | 100 / 2 | 26 / 1 |
| RCP2 | 5 / 5 | 1 / 0 | 91 | 100 / 2 | 26 / 1 |
| RCG2 | 6 / 6 | 1 / 0 | 91 | 100 / 2 | 26 / 1 |
| RCP3 | 5 / 5 | 1 / 0 | 91 | 100 / 2 | 26 / 1 |
| RCG3 | 5 / 5 | 1 / 0 | 91 | 100 / 2 | 26 / 1 |


全runのE01は敵HP31/ATK9、playerHP100。誤答後91、heal後100・回数3→2、E02でEXP26・撃破数1。敵10体・pool40、E01→E02、退出／再入場によるstudy追加変化なし。問題選択・弱点hit・正答数・UUID・保存時刻は自然に異なり、異runのStorage byte一致を要求していない。

stage clear/checkpointはこのE01シナリオで発火しない。clearedStages=[] / checkpoints={}の保持と、既存回帰によるstage/SRS等の保証を区別する。実Firebaseは全run成功接続0、SDK requestはCSP拒否、receiver0、firebase global undefined。実クラウド同期・長期間SRS期限経過・物理IMEの全面検証ではない。

## 17. 268 / V0 / V1a regression

保存済み[regression.json](artifacts/v1a/performance-01/regression.json)とG-*.logの末尾を確認。再実行はしていない。

| suite | PASS | FAIL / cancelled / skipped / todo |
| --- | --- | --- |
| phase-a | 86 | 0 / 0 / 0 / 0 |
| phase-b | 22 | 0 / 0 / 0 / 0 |
| phase-c | 17 | 0 / 0 / 0 / 0 |
| no-go | 143 | 0 / 0 / 0 / 0 |
| 既存計 | 268 | 0 / 0 / 0 / 0 |
| V0 | 23 | 0 / 0 / 0 / 0 |
| V1a | 35 | 0 / 0 / 0 / 0 |
| 総計 | 326 | 0 / 0 / 0 / 0 |


既存testの弱体化・skip追加なし。auditでstable由来src/public/testsの4,097ファイル、battleの保護113関数、既存lock依存entryが不変。表示用4境界（enter/exit/update/drawMonsterFrame）はV0からの許可されたAdapter差分であり、その全関数が2Dと同じという主張はしない。今回の製品全体はfreezeと一致。

## 18. Integrity / build

保存済みstage integrityはoldIdHits 0、参照stage集合整合PASS。B/P/G production buildはexit0。G-buildには既存500kB超chunk warningが残る。今回buildをやり直さず、build-freeze全SHAを再開前・各製品検査・最終時に照合した。

最終2026-09-09T03:40:18.215Zの検証で製品・dist・保護refs・測定tool・採用raw・除外rawは不変。git diff --check PASS。tracked差分は引継ぎどおりpackage-lock.json、package.json、battleVisualAdapter.jsの3 files / +26 −4。元々の未commit／未追跡製品ファイルを保持。GitのLF/CRLF warning、sandbox所有者によるread拒否には設定変更をせず通常ユーザー権限で読み取り検査を行った。

最終集計SHA-256: summary 872bc3349d6e3f94f30b56d89ab691632b1ab95c2581c4ceb88f7910b303abc1、audit 18d02b7e9765caba41b79d22ef732904105cff58069313b8ea7ee6e905e5aa27、final-analysis-v3 f66e63388e269c5980692b47096b0ca0645e76b173b3511974a58446ac576e76。サーバー／専用Chromeの停止結果は[shutdown.json](artifacts/v1a/performance-01/shutdown.json)に保存。

## 19. V0 Budget evaluation

評価基準は[Asset Spec §14–15](YOMITABI_3D_V1A_ASSET_SPEC.md)と[V0 Report](YOMITABI_3D_V0_TECHNICAL_SLICE_REPORT.md)を継承。新しい閾値を結果に合わせて設定していない。

| 指標 | 基準 | 結果 |
| --- | --- | --- |
| T1−N0 | 2D比+30ms目標／全3組+50ms超で調査 | G−B −3.6 / +101.0 / −21.5ms。1組目標外、全組トリガーなし |
| E0A0S / next-AS | 意図的3D待ち0、全3組+100ms級で調査 | G−B −13.5 / +351.6 / +143.5ms。全組一貫でなく、ready条件追加なし |
| idle frame | median約16.7、p95>20ms持続はSTOP候補 | 全主run median16.7、p95≤17.1 |
| >33 frame | 新規頻発／連続を確認 | G5/4489（0.1114%）、最大連続2。少数過渡を保持 |
| >50 stall | frameとLong Taskを分離、通常新規反復はSTOP候補 | 通常回答LT0、frameはG2/G3各1。退出・再入場taskは別記 |
| idle CPU | 2D比+5pt目標、+10pt級全組一貫でSTOP候補 | +5.977/+10.383/+4.443pt。目標未達2組、STOP一貫条件なし |
| Network | 絶対MB hard limitなし、3D総費用とBGMを分離 | G初回3D関連1,921,110 bytes、P比+741,020 |
| Memory / lifecycle | 10往復session資源非累積 | 実GPU／listener全退出0 |
| Core / save | 意味不変、回帰維持 | 299 valid、326 PASS、4,097ファイル／113関数一致 |


## 20. STOP evaluation


| 条件 | 判定 |
| --- | --- |
| GLB成功が回答開始をgate | 未該当。既読ではA0Sが3D提示に先行し、pending/fallbackの既存機能証拠もPASS |
| clipがHP/EXP/次問/敵交代を制御 | 未該当。controller所有・timer維持・機能回帰・next-ASの証拠 |
| fallback不能・黒画面・reload必須 | 既存故障／lifecycleで未該当。今回新規異常なし |
| 退出session資源累積 | 未該当。L1-r1 10往復の実GPU/listener非累積 |
| save/learning/SRS/進行・268/V0/V1a回帰 | 未該当。上記監査／保存済み回帰 |
| 小枠の視認性不足／大規模移植必要 | 既存限定Adapterで成立。保存画像に顔・芽・裾を確認 |
| A: G最大LTがPより全3組+100ms以上 | 主−10/+77/−21、既読−8/−96/+67。観測上未該当（既読pair1版差あり） |
| B: Gに約300ms以上LTが全3組 | 主194/258/273、既読168/129/187。未該当 |
| 定常p95>20／CPU全組+10pt級／頻発stall | 全組トリガー未該当。ただしCPU目標未達と過渡stallは残る |
| 証拠不足 | 機能・2D対照・資源・実GLBは確認済み。即時入力応答、同版既読3組、低性能端末は保証外 |


300ms未満を自動合格とせず、既読時の件数・合計・A0S後の重なりを評価した。単発341ms診断やG2のCPU高値だけを3組一貫のSTOPへ読み替えていない。

## 21. V1b decision

**V1a CONDITIONAL GO**。限定V1aの機能成立と既存Coreを保った接続は支持するが、「V1a GO  READY FOR V1b BACKGROUND」とはしない。

| 観点 | 判断理由 |
| --- | --- |
| 機能 | 326 PASS、既存fault／context fallback／4clip接続／小枠視認性の証拠あり |
| 性能 | 定常frameは維持、next-ASの一貫悪化なし。ただしG−B CPU+5pt目標を2組で超過し背景用の余裕を保証できない |
| cold stall | 指定A/Bトリガーは未該当。しかし既読直後の回答可能時間に117〜225ms級taskが重なり、即時入力latencyは未測定 |
| 資源 | 10往復実GPU/listener非累積、scene/container/session所有は成立。heap全到達性は未証明 |
| Core不変 | 全製品freeze不変、4,097保護ファイル／113関数一致、299保存snapshot valid |


後続V1bへ進む前の条件は、(1)回答開始直後のcold stall残存とCPU余裕不足を明示した性能判断を引き継ぐこと、(2)既読pair1の版差を同条件3組と宣伝しないこと、(3)背景を加える別工程でも2D対照・Core不変・CPU/資源条件を維持して評価すること。即時入力の保証や同版3組が次工程の必須承認条件となる場合は、その不足に限定した別タスクの検証が必要。今回は追加run／重いtrace／最適化を開始しない。

本判定は背景制作の実行指示ではない。このセッションでは北海道背景、Blender、他敵量産、製品修正、main統合を実施しない。

## 22. Remaining limitations

- RCP1とRCG1は日・Chrome patch版が異なる。RCP1再実行禁止を維持したため、既読3組すべて同版という条件は満たさない。更新後にP2/P3対照は実測済み。
- 主比較は3 run/arm、G2前の長い間隔と後半CPU/T1上昇があり、因果効果の統計的確定ではない。電源／温度／OS負荷の連続記録なし。
- driverはcold中に入力を送らない。AS後のtask重なりは確認したが、物理IME、即時回答の遅延・取りこぼし、低性能端末／実mobileを保証しない。
- GLB提示はvisual-state代理、rAFはcallback timestamp。GPU純時間、物理scanout、全JS heap到達性、専用draw-call計測は未取得。
- RCG1/2/3のidle前半には3D未提示区間が約0.13/0.30/0.14秒ある。idle CPUを完全にGLB描画だけの費用とは扱わない。
- GLBの1 material／texture0という初号構成に限定。内部BRDF texture費用はある。背景・複数mesh・大量textureへ外挿しない。
- localhost no-store/無圧縮/CDP header込み転送。実CDNやwarm cacheの体験とは異なる。教材／画像／BGM既存費用を含む。
- KNOWN-2D-PAD-TUTORIALは既存残件を継承。今回修正していない。stage clear/checkpoint/長期SRSは本シナリオの実発火確認ではない。
- loader partial-resource内部field依存は9.25.0固定の機能監査範囲。将来loader更新時は別監査が必要。

## 23. Excluded / invalid runs and reasons

成功rawのpass=trueだけで旧既読6 runを有効へ戻していない。旧fixtureはstandalone tutorial_seen_battle=1でもcanonical krb_save.meta.compatibilityEntriesにbattleがなく、saveProjection復元で既読が消えTutorialが再表示された。RP1/RG1/RP2/RG2/RP3/RG3を全て既読比較から除外。fixture不成立の診断履歴としてraw/profileを保持する。

| attempt | 除外理由 |
| --- | --- |
| B1 | STOP cannot start: dedicated Chrome is hidden |
| B1-r1 | STOP cannot start: dedicated Chrome not visible/focused |
| D1 | STOP foreground: window focus lost |
| D1-r1 | STOP foreground: window focus lost |
| D1-r2 | ReferenceError: __cost is not defined |
| G2 | STOP cannot start: display dimensions 1086/664/1.5/1280/800 |
| G3 | STOP foreground: window focus lost |
| L1 | TypeError: Cannot read properties of undefined (reading 'session') |
| P1 | STOP cannot start: display dimensions 746/723/1.5/1280/800 |
| RG1 | Invalid Tutorial-read fixture: canonical compatibilityEntries lacks battle; Tutorial reappeared |
| RG2 | Invalid Tutorial-read fixture: canonical compatibilityEntries lacks battle; Tutorial reappeared |
| RG3 | Invalid Tutorial-read fixture: canonical compatibilityEntries lacks battle; Tutorial reappeared |
| RP1 | Invalid Tutorial-read fixture: canonical compatibilityEntries lacks battle; Tutorial reappeared |
| RP2 | Invalid Tutorial-read fixture: canonical compatibilityEntries lacks battle; Tutorial reappeared |
| RP3 | Invalid Tutorial-read fixture: canonical compatibilityEntries lacks battle; Tutorial reappeared |


今回の5 runに失敗・再試行は0。2026-09-08のRCG1中断はrunner開始前でprofile/evidence未作成、再開前のChrome版差停止もrun未開始。架空の失敗性能値として数えない。

D1/D1-r1はfocus loss、D1-r2は診断IIFE連結不備による__cost未定義、L1初回はAdapter参照不備。修正済み既存toolによるD1-r3/L1-r1のみ診断として採用。Integration過去のfaults-02、sample-01/02等もその報告の除外分類を継承し、正式性能runへ昇格させない。

中間summary/audit/summary-consoleは[aggregation-history/2026-09-09T03-27-43-420Z](artifacts/v1a/performance-01/aggregation-history/2026-09-09T03-27-43-420Z/)へコピー保存後、指定summarize→auditを再実行した。最終原本解析は[final-analysis-v3.json](artifacts/v1a/performance-01/final-analysis-v3.json)。初版final-analysis.json（BGM／Tutorial分類の誤り）、v2（Network原点未補正）は中間集計として保持し、最終Network根拠に採用しない。製品やraw runの失敗ではない。最終解析sourceは[final-analysis.mjs](artifacts/v1a/performance-01/final-analysis.mjs)。

採用性能rawのSHA-256:

| run | SHA-256 |
| --- | --- |
| B1-r2 | 6dfcc14a385d963ba5e0a3d78e236c4e61255125136dfa46f480ec3ffc49f62e |
| P1-r1 | 777b1bd66bde2d4c9f2199d7bff6e2ddf90fe5b93fb583151d12b756867c35bf |
| G1 | 4cc462e318347823d8c38b727869de779f1e62a941c092c054b0b46fb088f34f |
| B2 | e2b432a8b0d5cb59fa698408e6c4076c1a748f0c79163b0c560aa5c4da7800e7 |
| P2 | 372072775dafd465eb7e1a49b6d262e612738353fcf2b493a5b566e37f48cf15 |
| G2-r1 | 58ff3a0ac86d468f432f5832d10534e76c8b44c627fb3be0821f61aa18c6a3e8 |
| B3 | 22d888965f969c48641789177f9a0fa353972852f001f3381b4c93fc9cc73de6 |
| P3 | 191c596ff0db0fd5563108c722184958798741375fa9c8ab933b2d6c21cc78ab |
| G3-r1 | 17ed6526fd51612574d22c040f6ac0f7ff8cf88db50f29865b7c510e4a9a87e4 |
| RCP1 | e77b70011108b56d164444d9e641b72c78cda0e0eb22c696922b2c738340e4c9 |
| RCG1 | eb18a68c1a3927b871bd97b5a371d159eb2e99ced84df0016a62dc3722768419 |
| RCP2 | 40ad35043c8fafceaece874075d86821efb7911d353fd64ecc8df77caf490c5b |
| RCG2 | 9f3e09698d2275846fc4a1be89d5e025fe6c5c4cd61dc2816dbb257e4a2c9417 |
| RCP3 | 13b083f8be750533e9233a9ec565005def52b584f78f0140fd73a6d6f335f065 |
| RCG3 | 21f553d7dca1725baec79312f87701126cebf8b3ed9c4ade5e518be2b0cf3e1f |


参照: [再開地点のsource of truth](YOMITABI_3D_V1A_PERFORMANCE_RESUME.md)、[GLB Integration](YOMITABI_3D_V1A_GLB_INTEGRATION_REPORT.md)、[Asset Spec](YOMITABI_3D_V1A_ASSET_SPEC.md)、[V0 Technical Slice](YOMITABI_3D_V0_TECHNICAL_SLICE_REPORT.md)、[B0 Final Report](../../../../YOMITABI_3D_B0_FINAL_REPORT.md)。引継ぎ元文書を過去時点の記録として保持し、本報告が測定完了後の結果を示す。
