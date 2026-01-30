# 漢字ヨミタビ（kanji-game）

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
- **PWA/Workbox**: `workbox-config.js` が `dist/` 前提（`globDirectory/dist`, `swDest = dist/sw.js`）

## 正史ディレクトリ

- `src/`: アプリ本体コード
- `public/`: 静的アセット / データ（例：`public/data`）

## 非正史（本体ではない）

- `my-app/`: **試作/アーカイブ**（本体ではない。通常は起動しない）
- `image‐pipeline/`: **素材生成ツール**（本体ではない）
- `dist/`: **ビルド成果物**（編集しない。原則git管理しない）
- `音楽/`, `音楽2/`: **素材置き場（原本）**（本体ではない）

## ガード（誤って管理しない）

- `.gitignore` で `node_modules/` と `dist/` を無視します（既にgit管理されているファイルは別途整理が必要）

## 注意（P2外のTODO）

- `sw.js` の内容が「Service Worker のJS」として正しいか要確認（現状テキスト不整合の可能性あり）

