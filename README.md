# 漢字ヨミタビ（kanji-game）

漢字を見て、登録された読みをかなで答えながら冒険するオンラインWebゲームです。通常設定は漢字1字の読みの想起とかな入力を扱います。「ぶんの なかで よむ」は小学1年生80字だけが例文に対応し、それ以外は1字の問題になります。日本編は小学1〜6年、世界編は漢検4級・3級・準2級・2級の範囲です。正解回数やゲーム上のマスター表示は、漢字学習全体の修了や長期定着を意味しません。

このリポジトリの**プロダクト本体（正史）はルート**です。基本的に **このディレクトリで起動/ビルド/デプロイ**します。

## 起動（開発）

```bash
npm install
npm run dev
```

## ビルド（成果物）

```bash
npm run build
```

- **成果物**: `dist/`
- `vite.config.js` は `build.outDir = dist` 前提

## デプロイ

- **Firebase Hosting**: `firebase.json` が `dist/` 前提（`hosting.public = dist`）
- **Vercel**: `vercel.json` が `dist/` 前提（`outputDirectory = dist`）
- **提供形態**: オンラインWeb版です。オフライン動作を保証するPWAではありません。

### 更新とキャッシュ

- HTMLと学習カタログは再検証し、Viteが生成するハッシュ付きJS/CSS/manifestだけを長期キャッシュします。
- 固定名の画像・音声は1日で再検証可能になります。背景の版は`assetsLoader.js`の`PUBLIC_ASSET_REVISION`で更新します。
- `public/sw.js`は過去版のService Workerを退役させるためだけに残しています。本作の旧キャッシュと`/sw.js`登録だけを対象にし、セーブ・認証Storageや同一オリジンの別アプリのキャッシュは削除しません。

## 正史ディレクトリ

- `src/`: アプリ本体コード
- `public/`: 静的アセット / データ（例：`public/data`）

## 非正史（本体ではない）

- `archive/my-app/`: **試作/アーカイブ**（本体ではない。通常は起動しない）
- `image‐pipeline/`: **素材生成ツール**（本体ではない）
- `dist/`: **ビルド成果物**（編集しない。原則git管理しない）
- `assets-source/`: **素材置き場（原本）**（本体ではない・任意）

## ガード（誤って管理しない）

- `.gitignore` で `node_modules/` と `dist/` を無視します（既にgit管理されているファイルは別途整理が必要）

