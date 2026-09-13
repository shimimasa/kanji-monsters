# Candidate 1 差分分類

基準HEAD `148553c48f18905ae5aed8c95354ef8792f4ae34` / main。開始時indexにstaged変更なし。既存変更をdiscardせず、ファイル境界で分類できる。A/B/C/Dのみ明示stage。E/Fは作業ツリーへそのまま残し、Candidate差分へ入れない。

本表は凍結直前の変更（今回の運営資料・ツールを含む）。Aのコード・学習内容は本作業中変更なし。Bの唯一のアプリ修正は観察mode専用guard。既存testsの差分は前段の再設計によるもので、この凍結作業では削除・期待値変更なし。

| Path | 分類 | 判断 |
| --- | --- | --- |
| `.firebase/hosting.ZGlzdA.cache` | E | 除外：生成hostingキャッシュ |
| `.gitignore` | B | 採用：安全な観察運用（ゲーム機能ではない） |
| `index.html` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/init/fsmsetup.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/minigames/companionAdapter.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/minigames/miniGameHost.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/minigames/sentenceOrder/sentenceOrderGame.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/minigames/sentenceOrder/sentenceOrderView.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/screens/Dex/monsterDexScreen.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/screens/monsterCaptureScreen.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/screens/titleScreen.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/tutorial/TutorialGuide.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/tutorial/tutorialData.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `tests/minigame-04/lifecycle.test.mjs` | C | 採用：再現・回帰／運用Dry Run |
| `tests/minigame-05/lifecycle.test.mjs` | C | 採用：再現・回帰／運用Dry Run |
| `tests/minigame-06/lifecycle.test.mjs` | C | 採用：再現・回帰／運用Dry Run |
| `tests/minigame-07/lifecycle.test.mjs` | C | 採用：再現・回帰／運用Dry Run |
| `tests/minigame-production-kanji-defense/lifecycle.test.mjs` | C | 採用：再現・回帰／運用Dry Run |
| `tests/minigame-production-kanji-defense/scope.test.mjs` | C | 採用：再現・回帰／運用Dry Run |
| `tests/no-go/helpers/navigation-tutorial-fixture.mjs` | C | 採用：再現・回帰／運用Dry Run |
| `.claude/settings.local.json` | F | 除外：別実験・個人設定・公開監査／デプロイ補助 |
| `CHILD_PLAYTEST_CANDIDATE_1_MANIFEST.md` | D | 採用：対象版・運用資料 |
| `PLAYTEST_CANDIDATE_1_GO_NO_GO.md` | D | 採用：対象版・運用資料 |
| `PLAYTEST_OBSERVATION_SHEET.md` | D | 採用：対象版・運用資料 |
| `PLAYTEST_OPERATOR_RUNBOOK.md` | D | 採用：対象版・運用資料 |
| `PLAYTEST_RESET_PROCEDURE.md` | D | 採用：対象版・運用資料 |
| `YOMITABI_2D_BASELINE_GIT_FREEZE.md` | F | 除外：別実験・個人設定・公開監査／デプロイ補助 |
| `YOMITABI_3D_B0_BENCHMARK.md` | F | 除外：別実験・個人設定・公開監査／デプロイ補助 |
| `YOMITABI_3D_B0_COMPLETION_REPORT.md` | F | 除外：別実験・個人設定・公開監査／デプロイ補助 |
| `YOMITABI_3D_B0_FINAL_REPORT.md` | F | 除外：別実験・個人設定・公開監査／デプロイ補助 |
| `YOMITABI_3D_E0_ISOLATION_REPORT.md` | F | 除外：別実験・個人設定・公開監査／デプロイ補助 |
| `YOMITABI_3D_EXPERIMENT_PLAN.md` | F | 除外：別実験・個人設定・公開監査／デプロイ補助 |
| `YOMITABI_3D_REMOTE_BACKUP_REPORT.md` | F | 除外：別実験・個人設定・公開監査／デプロイ補助 |
| `YOMITABI_3D_TECH_DECISION.md` | F | 除外：別実験・個人設定・公開監査／デプロイ補助 |
| `YOMITABI_3D_V0_BUDGET_PROPOSAL.md` | F | 除外：別実験・個人設定・公開監査／デプロイ補助 |
| `YOMITABI_3D_V0_BUDGET_PROPOSAL_V2.md` | F | 除外：別実験・個人設定・公開監査／デプロイ補助 |
| `YOMITABI_3D_V0_BUDGET_PROPOSAL_V3.md` | F | 除外：別実験・個人設定・公開監査／デプロイ補助 |
| `YOMITABI_3D_V1A_PERFORMANCE_RESUME.md` | F | 除外：別実験・個人設定・公開監査／デプロイ補助 |
| `YOMITABI_B0_MEASUREMENT_PROTOCOL.md` | F | 除外：別実験・個人設定・公開監査／デプロイ補助 |
| `YOMITABI_CHILD_PLAYTEST_PROTOCOL.md` | D | 採用：対象版・運用資料 |
| `YOMITABI_GOTOMON_GROWTH_AND_GAMEPLAY_REPORT.md` | D | 採用：対象版・運用資料 |
| `YOMITABI_GOTOMON_MINIGAME_REDESIGN_REPORT.md` | D | 採用：対象版・運用資料 |
| `YOMITABI_MINIGAME_80PLUS_POLISH_REPORT.md` | D | 採用：対象版・運用資料 |
| `YOMITABI_MINIGAME_PLATFORM_STRATEGY.md` | F | 除外：別実験・個人設定・公開監査／デプロイ補助 |
| `YOMITABI_MINIGAME_PLAY_QUALITY_AUDIT.md` | D | 採用：対象版・運用資料 |
| `public/adventure.css` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `public/growth-gameplay.css` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `public/minigame-polish.css` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `public/minigame-shell.css` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `scripts/audit-minigame-content.mjs` | C | 採用：再現・回帰／運用Dry Run |
| `scripts/check-playtest-gates.mjs` | C | 採用：再現・回帰／運用Dry Run |
| `scripts/deploy-vercel-preview.ps1` | F | 除外：別実験・個人設定・公開監査／デプロイ補助 |
| `scripts/reproduce-candidate.mjs` | C | 採用：再現・回帰／運用Dry Run |
| `scripts/start-playtest.mjs` | B | 採用：安全な観察運用（ゲーム機能ではない） |
| `scripts/test-gotomon-minigames.mjs` | C | 採用：再現・回帰／運用Dry Run |
| `src/minigames/companionGrowth.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/minigames/companionPlay.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/minigames/companionScene.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/minigames/gameExperiences.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/minigames/gameplay/battleWorlds.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/minigames/gameplay/constellationWorld.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/minigames/gameplay/gameplayRun.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/minigames/gameplay/puzzleWorlds.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/minigames/gameplay/trailWorlds.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/minigames/gotomonService.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/minigames/growthResult.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/minigames/miniGameShell.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/minigames/scenePolish.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/minigames/scoreRank.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/playtest/developmentLogger.js` | B | 採用：匿名計測 |
| `src/playtest/recorder.js` | B | 採用：匿名計測 |
| `src/playtest/summary.js` | B | 採用：匿名計測 |
| `src/screens/adventureTitle.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/screens/miniGameHubScreen.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `src/ui/adventureUI.js` | A | 採用：既存対象版（Host/HubはB接続も含む） |
| `tests/gotomon-minigames/growth.test.mjs` | C | 採用：再現・回帰／運用Dry Run |
| `tests/gotomon-minigames/integration.test.mjs` | C | 採用：再現・回帰／運用Dry Run |
| `tests/gotomon-minigames/playtest.test.mjs` | C | 採用：再現・回帰／運用Dry Run |
| `tests/gotomon-minigames/polish.test.mjs` | C | 採用：再現・回帰／運用Dry Run |
| `tools/kanji-defense-browser-cert/CHILD_PLAYTEST_INITIAL_SAVE.json` | B | 採用：安全な観察運用（ゲーム機能ではない） |
| `tools/kanji-defense-browser-cert/candidate-dry-run.mjs` | C | 採用：再現・回帰／運用Dry Run |
| `tools/kanji-defense-browser-cert/gotomon-redesign.mjs` | C | 採用：再現・回帰／運用Dry Run |
| `tools/kanji-defense-browser-cert/growth-flow.mjs` | C | 採用：再現・回帰／運用Dry Run |
| `tools/kanji-defense-browser-cert/initial-save.mjs` | B | 採用：安全な観察運用（ゲーム機能ではない） |
| `tools/kanji-defense-browser-cert/operator-session.mjs` | B | 採用：安全な観察運用（ゲーム機能ではない） |
| `tools/kanji-defense-browser-cert/play-quality.mjs` | C | 採用：再現・回帰／運用Dry Run |
| `tools/kanji-defense-browser-cert/playtest-logger.mjs` | C | 採用：再現・回帰／運用Dry Run |
| `tools/kanji-defense-browser-cert/polish-flow.mjs` | C | 採用：再現・回帰／運用Dry Run |
| `tools/kanji-defense-browser-cert/public-audit.mjs` | F | 除外：別実験・個人設定・公開監査／デプロイ補助 |

本表自身はD。最終認証書はcommit後の外部証明書D（Candidate外）。ignored `artifacts/`、`dist/`、`playtest-records/`、node_modules、スクリーンショット、生ログはEとして全て追加対象外。基準commitにすでに追跡された古いartifactは履歴を変更せず継承し、新規追加・更新はしない。package/両lockは差分なし。

実験Fの内容を読んで採用したものではない。名称・場所と今回の依存経路から対象外とし、全体をgit addしない。安全な分離不能箇所は認められず、FREEZE BLOCKED条件には該当しない。
