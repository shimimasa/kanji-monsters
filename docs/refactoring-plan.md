# ヨミタビ 完全リファクタリング計画

作成日: 2026-06-10
対象: リポジトリ全体(コード約28,000行 / 追跡ファイル16,109個 / .git 6.7GB)

---

## 現状診断の要約

| 問題 | 規模 | 深刻度 |
|---|---|---|
| `.git` が 6.7GB(LFS 758ファイル、音声・画像の履歴肥大) | 6.7GB | 致命的(clone不能級) |
| `archive/` `音楽/` `音楽2/` `image‐pipeline/` の不要追跡 | 約3.4GB / 7,496ファイル | 高 |
| `battleScreen.js` 単一ファイル6,205行(5責務混在) | 6,205行 | 高 |
| `practiceBattleScreen.js` が battleScreen の60〜70%コピー | 2,493行 | 高 |
| 選択画面4種(stage/worldStage/region/continent)が65〜75%コピペ | 約4,900行 | 高 |
| 状態の三重化(`gameState` / `battleState` / `battleScreenState`) | — | 高 |
| テストが1件も存在しない | — | 高(リファクタの前提を欠く) |
| デプロイ先が Firebase / Vercel の二重設定 | — | 中 |
| PWAが中途半端(sw.js は空だが index.html で登録) | — | 中 |
| `style.css` 72KB(3,190行)がCanvas描画主体のアプリに同居 | 72KB | 中 |
| console.log 447箇所 / `catch {}` 握りつぶし / `alert()` 使用 | — | 中 |
| `firebaseConfig.js` がAPIキー込みでgit追跡(コメントは「gitignoreする」と矛盾) | — | 要判断 |

**方針**: リスクの低い順に進める。「コード非接触の掃除 → 安全網 → 設定整理 → 状態の正史確立 → 重複排除 → 巨大ファイル分割」。各フェーズは独立してデプロイ可能な状態で完了させる。

---

## Phase 0: 安全網の構築(リファクタ開始の前提)

**目的**: 「壊していないこと」を機械的に確認できる状態を作る。これなしに Phase 3 以降へ進んではならない。

### 0-1. ベースラインの固定
- `git tag pre-refactor-baseline` を打つ。
- 現在の本番デプロイ先を確定する(firebase.json / vercel.json が並存)。`firebase hosting:releases:list` 等で実績を確認し、**どちらか一方に統一する判断**を下す(package.json の deploy スクリプトは firebase を指している)。

### 0-2. 手動スモークテスト・チェックリストの文書化
`docs/smoke-test-checklist.md` を作成。最低限:
1. タイトル → 大陸 → 地域 → ステージ選択 → バトル開始
2. 攻撃(正解/不正解)、ヒント、回復、勝利、敗北、捕獲
3. 練習バトル、クイック復習
4. 図鑑(漢字/モンスター)、実績、設定、プロフィール
5. セーブ → リロード → 進捗復元、Firebase同期
6. スマホ縦持ち + 仮想キーボード(iOS)

各フェーズ完了時にこのリストを通す。

### 0-3. 最小のテスト基盤導入(Vitest)
- `npm i -D vitest` のみ。UIテストは書かない。
- **純粋ロジックだけ**を先にテストで固める(これらは後フェーズで触るため):
  - `src/utils/idCanonicalizer.js` の `canonicalizeStageId()`(表記揺れ kanto↔kantou 等)
  - `src/core/saveData.js` のマイグレーション(旧 `kanjiGameSave` → v1)
  - `src/loaders/dataLoader.js` の敵フォールバック解決ロジック
- `package.json` に `"test": "vitest run"` を追加。

### 0-4. Lint/Format の最小導入
- ESLint(flat config, `eslint:recommended` のみ)+ Prettier。ルールは緩く始め、`no-unused-vars` と `no-undef` だけは error にする(デッドコード検出に直結)。

**完了条件**: タグ・チェックリスト・テスト約20件・lint がCIなしでもローカルで回る。
**工数目安**: 1〜2日 / **リスク**: なし

---

## Phase 1: リポジトリの大掃除(コード非接触)

**目的**: 7,496個の不要追跡ファイルと3.4GBを削減。アプリのコードには一切触れない。

### 1-1. 即削除(参照ゼロを確認済み)
| 対象 | サイズ | 根拠 |
|---|---|---|
| `archive/`(Viteテンプレート残骸) | 99MB | 現行コードから参照ゼロ |
| `image‐pipeline/`(全角ハイフン) | 2.0GB | コミット399b8b5で参照を無害化済み。`ASSET_PATHS` の定義のみ残存 |
| `public/data/enemies_proto_backup.json` | 236KB | `_backup` 明示 |
| `public/data/enemies_proverb - コピー.json` | 104KB | コピー明示 |
| `public/data/csv/`, `py/`, `漢字　比較/` | 約600KB | JSON生成済みの中間形式 |
| `tools/`(optimizeImages.js, 空のvite.config.js, 旧manifest) | 30KB | 使用放棄 |
| `assets-source/` | 0B | 空ディレクトリ |

### 1-2. 検証後に削除(音声 1.32GB)
- `音楽/`(1.2GB, MP3)と `音楽2/`(120MB, m4a/ogg)。
- 現行コードの参照は `/assets/audio/` のみ(= `public/assets/audio/`、861MB)。
- **削除前の検証手順**: `audioManager.js` が参照する全BGMパス(46件)が `public/assets/audio/` に存在することをスクリプトで照合 → 一致すれば `音楽/` `音楽2/` は配布元の作業ディレクトリであり削除可。元データはGitの外(クラウドストレージ等)に退避してから消す。

### 1-3. `public/assets/` 内の重複・旧版画像の整理
- `images_final`, `images_transparent*`, `images_white`, `アジア`, `残ゴトモン`, `四国・九州地方`, `大分`, `徳島` 等の疑わしいディレクトリを、`assetsLoader.js` の `ASSET_PATHS` 実参照と突合して未参照を削除(推定500MB)。
- 突合は機械的に: 参照パス一覧を抽出 → `public/assets/` を走査 → 未参照リストを出してから一括削除。

### 1-4. 一回限りスクリプトの隔離
- `scripts/` のうち現役は `canonicalize_stage_ids.mjs` と `verify_stage_id_integrity.mjs` のみ。残り9本は `scripts/one-off/` へ移動し README に「再実行不可・履歴参照用」と明記(削除はしない)。

### 1-5. 【別判断・任意】git履歴の書き換えで .git 6.7GB を解消
- 上記削除だけでは **`.git` は縮まない**(履歴に残るため)。clone/fetch が実用的でないなら `git-filter-repo` で `音楽/` `音楽2/` `image‐pipeline/` `archive/` `dist/` を履歴から抹消する。
- **注意**: 全コミットハッシュが変わる破壊的操作。共同開発者・CI・既存cloneへの影響を確認し、実施するなら専用の日を設けてバックアップ(ミラーclone)を取ってから。単独開発なら推奨。実施後の見込み: 6.7GB → 数百MB。

**完了条件**: スモークテスト全通過、`npm run build` 成功、追跡ファイル数が約16,000 → 約8,500。
**工数目安**: 1日(1-5を除く)/ **リスク**: 低(全て参照確認済み or 検証手順つき)

---

## Phase 2: 設定・小規模デッドコードの整理

**目的**: コードに軽く触れる範囲で、矛盾した設定と明確なゴミを除去。

### 2-1. デプロイ先の一本化
- Phase 0 の判断に従い、使わない側の設定(`vercel.json` または `firebase.json` + `.firebaserc` + `.firebase/`)を削除。`.firebase/` キャッシュは gitignore へ。

### 2-2. PWA の去就を決める
- 現状: `sw.js` は空、`workbox-config.js` は未実行、しかし `index.html:25` で `serviceWorker.register('/sw.js')` している。**空のSWを登録し続けるのは無駄+将来のキャッシュ事故の温床**。
- 推奨: PWA断念なら index.html の登録コードと `sw.js` / `workbox-config.js` を削除し、既存ユーザーのSW解除コード(`getRegistrations().then(rs => rs.forEach(r => r.unregister()))`)を一時的に入れる。継続なら workbox ビルドを deploy スクリプトに組み込む。

### 2-3. 明確なデッドコード削除
- `assetsLoader.js` の `MONSTER_FULL_PIPELINE` / `MONSTER_PNG_PIPELINE`(参照ゼロ、PRV廃止済み)。
- `audioManager.js` の `setMasterVolume()` 重複定義(2箇所のうち1つ)。
- `fsmsetup.js` のコメントアウト import(proverbMonsterDex)。
- ESLint `no-unused-vars` で検出される未使用 export を横断的に削除。

### 2-4. ログ戦略の統一
- `src/utils/logger.js` を新設: `log.debug/info/warn/error`。`debug/info` は `import.meta.env.DEV` でのみ出力。
- 447箇所の `console.log` を機械置換(エディタ一括 + 目視確認)。`catch {}` の握りつぶし(dataLoader L63/74/81等)は最低限 `log.warn` を入れる。

### 2-5. firebaseConfig の方針確定
- Firebase WebのAPIキーは「秘密」ではない(セキュリティはFirestoreルールで担保)ため、追跡自体は許容可。ただしファイル内コメント「gitignoreに追加して漏洩を防ぐ」と実態が矛盾している。
- **やること**: ①Firestoreセキュリティルールを確認し、匿名認証ユーザーが自分の `users/{uid}` 以外に書けないことを保証。②コメントを実態に合わせて修正。③ルールが緩い場合のみキー再発行+制限(HTTPリファラ制限)を検討。

**完了条件**: スモークテスト全通過。本番で console が静かになる。
**工数目安**: 1〜2日 / **リスク**: 低〜中(SW解除は既存ユーザーに影響するため本番で要観察)

---

## Phase 3: 状態管理と画面基盤の「正史」確立

**目的**: `docs/architecture-constitution.md` の理念を実装に落とす。以降の重複排除・分割が安全になる土台。

### 3-1. 画面インターフェースの明文化と統一
- 全画面が実装すべき契約を定義: `enter(ctx) / update(dt) / render(ctx) / exit()`。`ctx` は `{ canvas, services }` を持つ単一オブジェクトに統一(現状は `enter(canvasEl, onVictory)` と `enter(canvas)` が混在)。
- `src/screens/ScreenBase.js`(またはJSDoc型定義)を作り、`fsmsetup.js` で登録時にインターフェース検証する開発時アサーションを追加。

### 3-2. イベントリスナー管理の共通化
- `ScreenBase` に `addManagedListener(target, type, fn)` を実装し、`exit()` で一括解除。battleScreen の10個超のハンドラ(visualViewport / virtualKeyboard 含む)の登録・解除の非対称(リーク温床)をこの仕組みに寄せる。

### 3-3. 状態三重化の解消
- 正史を定義:
  - **Tier 1 揮発**: `gameState.js`(現在のラン中の状態のみ)
  - **Tier 2 永続**: `saveData.js`(localStorage v1スキーマ、唯一の書き込み口)
  - **Tier 3 同期**: `services/firebase/dataSync.js`(Tier 2 の変更を購読して同期。各所からの直接Firebase呼び出しを禁止)
- `battleState` と `battleScreenState` に分散した HP/EXP/コンボ等のうち、ゲームルール上の状態を `gameState` に集約。表示専用(`playerExpDisplay`, パーティクル等)は画面側に残す——この線引きを文書化。
- `gameState.js` 内の動的 `import('./saveData.js')` 3箇所を静的 import に整理(循環依存が原因なら依存方向を直す)。

### 3-4. パスエイリアス導入
- vite.config.js に `@ → src/` エイリアスを設定し、`../../tutorial/...` 等の深い相対パスを置換。動的import 25箇所のうちチュートリアル遅延読み込みは `TutorialManager.startIfNeeded()` 呼び出しを screen 基盤に一元化。

**完了条件**: スモークテスト + Phase 0 のロジックテスト全通過。セーブ互換性の確認(旧セーブからの起動)。
**工数目安**: 3〜5日 / **リスク**: 中(セーブデータ周りは必ず旧データでの起動試験を行う)

---

## Phase 4: 選択画面4種の共通化(約4,900行 → 推定2,000行)

**目的**: コピペ率65〜75%の `stageSelectScreen` / `worldStageSelectScreen` / `regionSelectScreen` / `continentSelectScreen` を config駆動の共通基盤に載せる。

### 4-1. 共有Canvas描画ユーティリティの抽出
- 4ファイルに完全同一実装がある `drawRoundedRect()` 等を `src/ui/canvasUtils.js` へ。battleScreen にも同種関数があれば同時に寄せる(Phase 5 の準備にもなる)。

### 4-2. `SelectScreenBase` の設計
- 共通化対象: タブ描画(`drawEnhancedTabs` は98%同一)、クリック/ホバー検出、ズームアニメーション(イージング同一)、マーカー描画ループ、スクロール。
- 差分は config に: `{ markers, tabs, iconResolver, title, onSelect, background }`。
- **進め方(重要)**: 一気に4画面やらない。①まず最小の `continentSelectScreen`(707行)を移行してベースを固める → ②`regionSelectScreen` → ③残り2つ。1画面ごとにスモークテストとデプロイ。

### 4-3. 見た目の回帰確認
- Canvas描画はテスト困難なので、移行前後のスクリーンショット比較(各画面・各タブ状態)を手順化する。

**完了条件**: 4画面の見た目・挙動が移行前と一致。合計行数が半分以下。
**工数目安**: 1〜2週間 / **リスク**: 中(見た目の微差は許容範囲を事前に決めておく)

---

## Phase 5: battleScreen の分割と practiceBattle の統合(8,700行 → 推定4,500行)

**目的**: 最大の負債を解体する。Phase 3 の基盤と Phase 4 の描画ユーティリティが前提。

### 5-1. 分割の最終形
```
src/screens/battle/
├── index.js        FSM状態(enter/update/render/exit のみ、~100行)
├── state.js        battleScreenState(表示状態に純化)
├── engine.js       onAttack/onHeal/onHint/enemyTurn/判定(純ロジック化)
├── renderer.js     draw* 関数群(パネル、ログ、敵フレーム)
├── effects.js      パーティクル/フラッシュ/レベルアップ等の生成・更新・描画
├── input.js        キーボード/マウス/タッチ/仮想キーボード(iOS)
└── theme.js        UI_THEME, LOG_STYLE, BTN 等の定数
```

### 5-2. 分割の手順(安全第一)
1. **定数から**: `theme.js` を抽出(挙動変化ゼロ)→ デプロイ。
2. **純ロジック**: `engine.js` を抽出し、**ここで初めて戦闘ロジックの単体テストを書く**(正解判定、ダメージ計算、コンボ、敵ターン)。描画呼び出し(`startStoneAttackEffect` 等)はコールバック/イベント発行に置き換え、engine から座標計算を排除。
3. **エフェクト**: `effects.js` へ。`stoneAttackEffect` / `expParticles` / `flashEffect` 等を「生成・更新・描画」が揃った小クラス群に。
4. **入力**: `input.js` へ。Phase 3-2 の managed listener 機構を使用。
5. **描画**: `renderer.js` へ(最大の塊、約3,000行。機械的移動が主)。

各ステップごとにスモークテスト(特にiOS仮想キーボードと勝敗遷移)。

### 5-3. practiceBattleScreen の載せ替え
- 現在の `{...battleScreenState}` スプレッド+`.call()` という危険な継承を廃止。
- `engine.js` / `renderer.js` / `input.js` を import し、練習モード差分(出題プール=未習得漢字、敗北なし等)を config / フックで表現。2,493行 → 推定500行。
- `battleStateFactory.js` の逆依存も同時に解消。

**完了条件**: 通常バトル・練習バトル・クイック復習の全シナリオがスモークテスト通過。engine の単体テストがCI(またはローカル)で常時通る。
**工数目安**: 2〜4週間 / **リスク**: 高(このプロジェクトの心臓部。1ステップ=1コミット=1動作確認を厳守)

---

## Phase 6: スタイル・UX負債・仕上げ

### 6-1. style.css(3,190行)の監査
- アプリは9割Canvas描画なので、DOM系スタイルの実使用は限定的なはず。使用クラスを `src/` と `index.html` から抽出し、未使用セレクタを削除。CSS変数(`--clr-main` 等)はデザイントークンとして整理し、Canvas側の `UI_THEME`(Phase 5 で theme.js 化済み)との色定義二重化を解消する方針を決める。

### 6-2. エラーUXの改善
- `alert()`(firebaseController 3箇所)をゲーム内通知(トースト)に置換。`docs/claude Opus4.6-review.md` のエモーショナル・セーフティ指摘とも整合する(ネイティブダイアログは世界観破壊+子どもに威圧的)。

### 6-3. ドキュメント更新
- `docs/architecture-constitution.md` を実装後の姿に更新。README にディレクトリ構成・開発手順・デプロイ手順を反映。`CLAUDE.md` を新設し、画面インターフェース契約・状態Tier・「battleScreenを再び肥大化させない」規約を記す。

**工数目安**: 2〜4日 / **リスク**: 低

---

## 実施順序の根拠と全体見積

| Phase | 内容 | 工数 | リスク | 削減効果 |
|---|---|---|---|---|
| 0 | 安全網(テスト・チェックリスト) | 1〜2日 | なし | — |
| 1 | リポジトリ掃除 | 1日(+履歴書換1日) | 低 | 約3.4GB / 7,500ファイル |
| 2 | 設定・小デッドコード | 1〜2日 | 低〜中 | 矛盾設定の解消 |
| 3 | 状態管理・画面基盤の正史 | 3〜5日 | 中 | 三重状態の解消 |
| 4 | 選択画面の共通化 | 1〜2週間 | 中 | 約2,900行 |
| 5 | battleScreen分割+practice統合 | 2〜4週間 | 高 | 約4,200行+テスト可能化 |
| 6 | CSS・UX・ドキュメント | 2〜4日 | 低 | CSS数千行 |

- **順序の原則**: 後のフェーズほどリスクが高く、前のフェーズの成果物(テスト・基盤・ユーティリティ)に依存する。**Phase 0→1→2 は連続実施推奨**(計3〜5日で最大の即効効果)。Phase 3 以降は1フェーズずつ本番投入して安定を確認してから次へ。
- **絶対則**:
  1. 機能追加とリファクタを同一コミットに混ぜない。
  2. 1コミット=1つの機械的変換(レビュー・revert可能性のため)。
  3. 各フェーズ末にスモークテスト全通過+デプロイ可能状態。
  4. セーブデータを触る変更は必ず旧データでの起動試験を行う。
