# AGENTS.md — 漢字ヨミタビ（Codex・Claude 共通の 作業の 決まり）

このファイルは どの エージェントでも 最初に 読む。2026-10-04 に Claude Code から Codex へ 切りかえる ときに 作った。
Claude の メモリ（`~/.claude/projects/...`）に あった 決まりを ここに 写してある。

## まず 読むもの（この順）

1. `docs/progress-handoff.md` の 先頭「次回はここから」→「再開するときは」… いまの 状態・次の 作業・待っている 決定
2. `docs/sound-and-visual-review.md` … **いまの 作業**（効果音・BGM・画像の 見直し。Codex で 実装する 予定）
3. `scripts/playtest-cdp/README.md` … ブラウザでの 確かめ方（headless Chrome＋CDP、スマホの 画面は `emusession.mjs`）

## どんな ゲームか・だれが 使うか

- 小学生向けの 漢字の 読みの ゲーム（canvas＋DOM、Vite、npm の 依存は vite だけ）。本番は Vercel（yomitabi.gamanavi.com、main に マージで 自動公開）。
- 開発者は 小学校の 先生（ひとりで 開発）。対象は **漢字の 読みが 苦手で 自信を なくしやすい 子**。
  判断の 基準は「できなかった 瞬間に 子どもが 傷つかないか」。
- 作業ブランチは `feature/content-bank-120`（main ではない）。返事・文書・コミットの 説明は 日本語。

## 守ること

1. **push・PR・マージは ユーザーが はっきり 言った ときだけ**（「PRを作ってマージして本番に出して」など）。1回の 許可は 次に 持ちこさない。
   コミットは ローカルに 積む。
2. **npm パッケージを 足さない**。必要なら 理由を そえて 先に ユーザーに 聞く（以前 vitest/eslint を 断られた）。
3. **文言は 前向きに**。「しっぱい」「不合格」「解放されていません」などは 使わない。間違いの 数を 突きつけない。
   間違えた ときの 音は 追い打ちに しない（復習では 不正解音を 鳴らさない、「今回は ここまで」は 無音）。
4. **学習記録の 公平さ**：答えの 正誤は 子どもが はっきり 選んだ 操作（タップ・入力）だけで 決める。
   物理・照準・着地・時間・音や 演出で 決めない。答えを 見せた あとの 操作は 記録しない。学習記録の しくみは 変えない。
5. **ごほうびは** 運で 決めない・なくならない・がんばりにも 出す・毎日しばらない。
6. ブラウザの `alert`・`confirm` は 使わない（画面が 止まる。子どもには 画面の 中の 案内で）。
7. 判断が いる こと（方針・データの 削除・公開）は 先に ユーザーに 聞く。

## コードを 直す ときの 注意

- **改行コードが ファイルごとに ばらばら**（LF・CRLF・まざったもの）。ふつうに 読んで 書き戻すと 全行が 差分に なる。
  まざった ファイルは `python scripts/one-off/edit-keep-eol.py <file> <spec.json>` で 直す（spec は `[{"find": "行まるごと", "replace": "..."}]`、行単位で 一致）。
  コミット前に `git diff --numstat <file>` と `git diff --numstat --ignore-cr-at-eol <file>` の 数が 同じか 確かめる。
- 盤面は ふだん 800×600。スマホを たてに 持つと（幅600以下で たて長）480×680 に 切りかわる
  （`src/screens/battle/portraitLayout.js` の `syncPortraitCanvas` / `restoreLandscapeCanvas` / `isPortraitCanvas` / `placePortraitInput`）。
  canvas の 画面は ぜんぶ 対応ずみ。新しい 画面も 同じ やり方で。座標は `getGameCoordinates`（`src/utils/coordinateUtils.js`）で 盤面に 直す。
- **凍結（変えると テストが 落ちる）**：
  - `src/audio/audioManager.js` … `tests/gotomon-minigames/english-learning.test.mjs` と
    `tests/minigame-production-kanji-defense/scope.test.mjs` が 一字一句 比べている。**効果音を 足す 前に、ユーザーに 確かめてから 2つの テストの 一覧から 外す**。
  - セーブ（`src/core/saveData.js`）・学習記録（`src/core/learningOutcome.js`）・Motion host なども 同じ テストで 凍結。ここは 変えない。
  - `battleScreen.js` の Motion の 9か所（motion-02 テスト）。
- ミニゲームの 広場と 本体は 遅れて 読み込む（`src/init/lazyState.js`）。

## 確かめ方と コミット

1. `npm run build` が 通る。
2. `bash scripts/playtest-cdp/run-all-tests.sh` の 最後が **`ALL-PASS`**（`DIFFERENT` は どこかが 壊れている）。
3. 画面を さわる 変更は ブラウザで 実際に 操作して 確かめる（`npx vite preview --port 4173 --strictPort` ＋ headless Chrome の 9333番。
   手順は `scripts/playtest-cdp/README.md`）。スマホ たて 390×844 と パソコン 1280×800 の 両方。
   テストで 記録を 書きかえたら 元に 戻す（`krb_save` と `yomitabi_confirmed_1` は 同じ 中身で ないと 起動が 止まる）。
4. データに かかわる 変更は node で 全件を 照合する。
5. コミットの 本文は「なぜ → どう作ったか → 何を どう 確かめたか（**数値や 画面の 事実で**）」。確かめられなかった ことは そう 書く。
6. まとまった 作業の あとは `docs/progress-handoff.md` の 先頭を 更新する。

## 待っている 決定（ユーザーに 聞く）

- Firestore の セキュリティルール（最優先。手順は 引き継ぎ書）／デプロイ先の 一本化（Vercel・Firebase・GitHub Pages が 並んでいる）
- 先生チェック（例文の 読みなど 916件）が 終わったら 元データに 反映
- 使われていない 画像 17枚（約23MB）を 消すか（`docs/sound-and-visual-review.md` の 3.）
