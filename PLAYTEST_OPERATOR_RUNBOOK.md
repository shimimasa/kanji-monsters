# CHILD PLAYTEST CANDIDATE 1 — 当日Runbook

対象3〜5人、1人15分程度＋終了後3〜5分。最初の3〜5人が終わるまでゲーム・教材・XP・音・初期条件を変更しない。実機・IME・聴感の未認証を先に解消する。詳細はProtocol／Reset Procedure。

| 順 | 運営者が行うこと |
| --- | --- |
| 1 端末 | commit/tag一致、Chrome・表示390×844、音・実IME確認、同意書とログの保管先を分離。通知を止める |
| 2 初期save | 固定JSONのハッシュを確認。既存Chromeではなく下記専用ランチャーを使う |
| 3 観察build | `node scripts/start-playtest.mjs --record` → `http://127.0.0.1:5181/`。ポート競合なら既存の運営プロセスを確認し、無関係なプロセスを止めない |
| 4 広場 | 別ターミナル：`node --experimental-default-type=module tools/kanji-defense-browser-cert/operator-session.mjs`。新しい広場でゲスト・3体・Lv1/XP0・記録なしを確認 |
| 5 同意 | 保護者同意と本人の意思。「好きに遊んでいいよ。途中でやめても、わからないと言っても大丈夫」 |
| 6 start | 運営側DevToolsで `yomitabiPlaytest.start({consentConfirmed:true})`。返った匿名IDをシートへ。Consoleを児童の画面から隠す |
| 7 観察 | 最初の選択から記録。もう1回・育成・全8本を促さない。自由発言のみ、個人情報は省略 |
| 8 支援 | 必要なら `mark('help')` / `mark('replay-prompt')` / `mark('technical')` / `mark('observer-interruption')`。主語は `yomitabiPlaytest`。紙にもrun・時刻・内容 |
| 9 観察終了 | プレイ中なら既存ポーズ。質問はログを終了してから |
| 10 end | `yomitabiPlaytest.end('child-stop')` または `'time-limit'` / `'interrupted'`。理由を推測しない |
| 11 summary | `yomitabiPlaytest.summary()`。n/N・除外を確認。戦略変更は手動、再挑戦は自発性の候補 |
| 12 download | `yomitabiPlaytest.download()`。タブを閉じたり再読込しない |
| 13 JSON | ターミナルの `JSON VERIFIED`、`playtest-records/` のファイル・匿名ID・ended・truncated:false・run数を確認。既存名への上書きは拒否 |
| 14 シート | run-1等、ゲーム、相棒、秒数、結果、次選択、支援を照合。終了後だけ中立的な質問。実名・学校・連絡先は書かない |
| 15 clear | `yomitabiPlaytest.clear()` → `snapshot()` がnull。ゲームsaveはまだ変わらない |
| 16 次児童 | ターミナルで `NEXT` → 新しい初期状態。最後は `EXIT`。JSON保存後にのみ行う |

準備用依存：rootと `tools/kanji-defense-browser-cert` それぞれの固定lockで `npm.cmd ci`。Chromeは既存インストールを使用。通常版比較は `node scripts/start-playtest.mjs` →5182（APIなし）。通常配布版は `npm.cmd run build`。デプロイしない。

**中止条件：** save不一致、ログ欠損、JSON失敗、進行不能、個人プロフィール使用、未認証端末。安全・休憩を優先。clearや全データリセットで「直そう」としない。
