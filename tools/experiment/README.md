# E0：隔離したヨミタビ実験室

このtoolはstable 2Dとexperimentの**未変更production build**を別originで配信する。3D engine、製品test mode、Firebase emulatorは導入しない。生成元は `2a521dd5aa747314b25e761d976bd4f880cd58c3`。

## 保護契約

- main、stable tag、製品src、教材、save schema、本番Firebase設定を変更しない。
- fixtureは既存のgetDefaultSave→saveNow→readSaveStateを空のMemoryStorageで実行して生成する。実save・backupを入力するオプションはない。
- Baselineとexperimentは別worktree、別port、**それぞれ別の新規Chrome user-data-dir**を使う。生成物・profileをコピーしない。
- Storage、IndexedDB、CacheStorage、SW、Firebase globalの既存状態はSTOP。clearや既存keyへの上書き経路はない。
- 配信はloopback 49721/49722、無害な検査receiverは49723。占有時はEADDRINUSEで停止し、別portへ移らない。
- 強制CSPは全responseに付く。connect-srcはself、script-srcはselfとbuild由来inline hash。Report-OnlyやCSP無効化は不可。
- setupのCSP検査と架空fixture検証が終わるまで、ゲームdocument・資産への直接アクセスは403。
- 実Firebaseへの要求をcanaryに使わない。別portのローカルreceiverへの要求がCSPで拒否され、受信0であることをゲームより先に検査する。

## このworkspaceの配置

```text
C:/kanji-game-latest/                         元main、変更しない
  artifacts/yomitabi-e0/
    worktrees/baseline-2d/                   detached stable commit
    worktrees/experiment/                    experiment/3d-vertical-slice
    runs/initial/                           268 tests、build等
    runs/e0-cert-01/                         今回の架空fixture・profile・証拠
```

`artifacts/` はmainの既存ignore対象。各worktreeのnode_modulesとdistも既存ignore対象。新しいrun名とprofile名を使い、既存パスを消して再利用しない。Gitの所有者エラーではglobal safe.directoryを変更せず、worktreeを作ったユーザーで実行する。

## 再現手順（PowerShell、experiment worktreeから）

worktreeのHEAD・branch・差分を先に確認する。両worktreeで独立に `npm.cmd ci --no-audit --no-fund` と `npm.cmd run build` を実行する。mainのnode_modulesはコピーもリンクもしない。

生成：`runs` 親ディレクトリは用意し、指定する新規runディレクトリ自体は未作成にする。

```powershell
node --experimental-default-type=module tools/experiment/fixture.mjs --baseline ../baseline-2d --out ../../runs/e0-next
node --test tools/experiment/safety.test.mjs
```

生成する13 keyは既存APIの結果で、krb_save、confirmed mirror、projection、空原本のpreserved entriesを含む。run-idやhashは外部manifestにのみ格納する。Browser用save-validator.jsはstable保存moduleから既存esbuild依存で生成する外付けtoolであり、main.jsやFirebaseをimportしない。

サーバー起動（この端末を専用にし、終了時はCtrl+C）：

```powershell
node tools/experiment/server.mjs --baseline ../baseline-2d --experiment . --run ../../runs/e0-next
```

別の端末で安全性・ブラウザー検査：

```powershell
node tools/experiment/verify-http.mjs --run ../../runs/e0-next
node tools/experiment/verify-browser.mjs --role baseline --baseline ../baseline-2d --run ../../runs/e0-next --chrome 'C:/Program Files/Google/Chrome/Application/chrome.exe' --attempt 01
node tools/experiment/verify-browser.mjs --role experiment --baseline ../baseline-2d --run ../../runs/e0-next --chrome 'C:/Program Files/Google/Chrome/Application/chrome.exe' --attempt 01
node tools/experiment/verify-unknown-storage.mjs --run ../../runs/e0-next --chrome 'C:/Program Files/Google/Chrome/Application/chrome.exe' --attempt 01
node tools/experiment/summarize.mjs --run ../../runs/e0-next --baselineAttempt 01 --experimentAttempt 01
```

ブラウザーはインストール済みChromeをheadlessで起動する。既存user-data-dirがあればmkdirで失敗し開かない。Chromeのリモートデバッグportは専用プロセスの自動割当であり、実験originの固定portとは別。Node標準WebSocketでCDPを使用し、新しいnpm依存を追加していない。普通のChromeやin-app browserの保存領域を代用しない。

検証スクリプトは通常UIへのマウス・キー入力を使う。FSMは画面名・描画済みボタン位置の読み取りだけ。change/enter/save/採点を直接呼び出さない。漢字はCanvas fillTextの外付け観測から取得し、教材の登録読みを送信する。これは機能診断用の観測で、B0性能値の計測には使わない。

通常戦闘では既存「たんまつで書く」でかなパッドを閉じてTutorialを最後まで進める。ステージは選択→もう一度押して出発。戦闘の退出は画面の「もどる」（stageSelectへ）。かなパッドを開いたままのGuide重なりは別の未解決な2D表示条件として報告する。Guideを全面無効化・強制クリックしてPASSにしない。

## 手動で表示する場合

通常profileからURLを開かない。**未作成パスであることを確認した専用profile**を指定する。以下はUIを手動確認するときだけ使う例。今回自動検証で作成したprofileは再利用しない。

```powershell
$manualProfile = 'C:/kanji-game-latest/artifacts/yomitabi-e0/runs/e0-next/profile-manual-baseline'
if (Test-Path -LiteralPath $manualProfile) { throw 'STOP: profile already exists' }
& 'C:/Program Files/Google/Chrome/Application/chrome.exe' "--user-data-dir=$manualProfile" --no-first-run --no-default-browser-check --disable-sync --disable-background-networking --disable-component-update --new-window 'http://127.0.0.1:49721/__experiment/setup'
```

実験側は別の新規profile名と49722を使う。setupでorigin・SHA・hash・空Storage・SWなし・CSPを確認し、専用profile確認→通信検査→fixture投入→ゲーム起動の順に進む。unknown状態では続行しない。server再起動でsession許可が消えるので、古い学習済みprofileをsetupで消去せず、別の新規profileで始める。

## 証拠と限界

`manifest.json`、`validator-manifest.json`、`build-*-manifest.json`、`server-manifest.json`、`server-events.jsonl`、`*-evidence.json`、スクリーンショット、`verified-summary.json`をrunに残す。成功だけでなく失敗試行も保持する。正式268テスト・stage integrity・buildは別ログで確認する。

「外部通信0」は監視したゲームdocument由来のNetworkに対する判定。PC全体やChrome内部のOSサービスを含めたネットワーク遮断証明ではない。CSPに加え、global firebase未生成、Auth/Firestore要求0、SDKのloadingFailed blockedReason=csp、receiver受信0を照合する。

現E0の判定はWindows Chrome headless、local-only、device入力条件に限定。実IME、音の実聴、iPad等、公開配信、性能、全10体クリア、slot/backup UI往復、3Dは未認証。CSPの役割は[MDN connect-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src)、headlessの位置づけは[Chrome公式](https://developer.chrome.com/docs/automation-and-testing/headless)を参照。

commitするのはこのディレクトリのsource、テスト、README、匿名の検証要約だけ。profile、fixture実体、Storage dump、raw Network、dist、node_modules、runディレクトリはstageしない。一括git addは禁止。E0以降もPC-01〜PC-13の意味を保持し、B0/V0へ自動的に進まない。
