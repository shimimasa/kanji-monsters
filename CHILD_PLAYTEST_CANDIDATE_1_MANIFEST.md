# Candidate ID

**CHILD PLAYTEST CANDIDATE 1**。ローカル凍結。児童の反応は未測定。

# Commit

基準親commit：`148553c48f18905ae5aed8c95354ef8792f4ae34`、開始branch：`main`。
Candidate commitはannotated tagの参照先：`git rev-parse 'child-playtest-candidate-1^{commit}'`。
自己参照hashをコミット内へ埋め込むことはできないため、このファイルは不変tagを参照する。凍結後に取得した実hashは外部証明書 `CHILD_PLAYTEST_CANDIDATE_1_CERTIFICATION.md` に記録する（証明書は対象commit外）。

# Tag

ローカルbranch `release/child-playtest-candidate-1`、annotated tag `child-playtest-candidate-1`。push/deploy/remote変更なし。tagの付け直しは禁止。修正が必要なら再認証し新Candidateを明示する。

# Build Environment

Windows x64、Node v22.14.0、npm 10.9.2、Vite 5.4.19、Playwright 1.63.0（既存lock）。記録開始2026-09-13 14:55 JST。実ビルド時刻と出力SHA256は認証書・再現receiptに記録。

- root `package-lock.json` SHA256：`cd00e39cfb76d2a1c602948616a688476e9c77e335d7c2b295ab630e358e4b74`
- browser QA lock SHA256：`1d671652b15542f9f9c44d57e9942af727c608dfbc6b46b4abcb8269e8afadb3`
- 両lockとpackageは既存から変更なし。再現はcommitからビルド入力（src/public/scripts/tests/browser-tools/index/style/manifest/package/lock/vite-config）をZIP展開＋`npm ci --offline`（キャッシュなし端末は事前に通常の`npm ci`）。raw素材の過去archiveやhostingキャッシュはビルド入力ではない。Windows tarの日本語名展開失敗を受け、ZIP/.NET方式へ修正した。
- `scripts/reproduce-candidate.mjs` は通常／観察ON／OFFの全生成物（コピーされた音・画像・データを含む）をSHA256比較する。Windowsのcore.autocrlf=trueと作業ツリーの混在改行により、既存QA版とのraw byte差は別表示し、テキストCRだけを除いた一致とバイナリ一致を検査する。各クリーン版を2回ビルドした全出力は、改行を除外せずraw byte一致を必須とする。両者を同じ「完全一致」と呼ばない。
- 通常：`npm.cmd run build`→dist。観察：`node scripts/start-playtest.mjs --record`→5181、フラグOFF比較は同コマンド引数なし→5182。観察生成物はartifacts配下のみ。

# Included Features

既存タイトル、本編開始、ミニゲーム広場、捕獲済み相棒、共通Shell・結果・再挑戦。開始時の差分は分類表を参照。3D資料・個人設定・デプロイ補助・生成キャッシュの差分は含めない。

# Mini Games

registryの順：けいさんスプリント／けいさんインベーダー／えいたんご4たく／文ならべ／タイムことば／えらんで完成／よみこみクイズ／漢字防衛隊。8本のCore/問題/ゲームフィールを今回変更しない。防衛Core/Content/Viewは基準commitと同一。

# Gotomon Growth

Lv1〜10、累積XP0/60/140/240/370/530/730/960/1220/1520、なかよし、既存技・category差、C/B/A/S、自己ベストを固定。SSOTは `krb_save.player.collection.gotomonIds`。初期条件は固定運営JSON（3体Lv1/XP0）で、既存saveNow方式から復元。

# Logger

明示child-playtestモード AND フラグ1 AND loopback。さらにconsentConfirmed付きstartまで記録しない。通常devを許す旧guardは今回の運用条件に合わせて閉じた。ゲーム挙動の変更ではない。
メモリのみ、相対時刻、匿名ID、明示field allowlist。生save・回答・問題文・実sessionID・個人情報・送信なし。reloadで未出力分が消える。2000events/100runs超はtruncatedで無効。
専用運営Chromeは外部通信・Service Workerを遮断し、既存プロフィールへ接続しない。end→JSON検証→clear→初期復元。

# Automated Tests

基準648 PASS /0 FAIL、内数の漢字防衛隊59 PASS /0 FAIL。加えて45条件のmode/flag/host監査、ロガー全8主要導線、運用Dry Run、旧セーブ/音量/ポーズ/5viewport。本書の判定は証明書の最終再実行結果と合わせて読む。既存の歴史的scope除外方針は変更しない。

# Known Limitations

小さい教材バンク、長期XPの反復量、5秒問題の負荷、メモリログの消失、既存bundle/CJS/import警告。自動QAから好評・高い再挑戦率とは言えない。最初の3体は同じ食文化categoryの固定条件であり属性選好の比較ではない。

# Manual Checks Required

人のWindows Chrome操作・実IME、iPad/iPhone Safari・指ドラッグ・ソフトキーボード・safe-area、実スピーカー/イヤホンでの音量差、運営者自身によるVisible ChromeのNEXT手順。自動Chrome/CSS viewportから実機PASSにしない。iOSでloggerをLAN公開して制限を外さない。

# Do Not Change During First Playtest

**最初の3〜5人のテスト終了まで、ゲーム内容を変更しない。** 教材、正誤、XP、Lv、音、演出、能力、初期値、順序、表示サイズを途中変更しない。クラッシュ・入力不能・進行不能・ログ欠損等なら観察を中断し、新版を再凍結・再認証し、同じ群へ混ぜない。
