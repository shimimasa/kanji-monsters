// image‐pipeline/process-gotomons.js
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const tinify = require('tinify');
const sharp = require('sharp');

// TinyPNG APIキー（環境変数 or 直書き）
tinify.key = process.env.TINYPNG_API_KEY || "CvXw9ZsCJcs66Ns04VySFH5qfWk20hG4";

// 入力ディレクトリ（引数で上書き可）
const INPUT_DIR = path.resolve(process.argv[2] || path.resolve(__dirname, '../public/assets/asia'));

// 中間出力（TinyPNG圧縮後）と最終出力
const COMP_DIR  = path.resolve(__dirname, 'compressed/asia');
const OUT_FULL  = path.resolve(__dirname, 'output/full');
const OUT_THUMB = path.resolve(__dirname, 'output/thumb');

// 処理対象拡張子（TinyPNG対応: PNG/JPG/JPEG）
const exts = new Set(['.png', '.jpg', '.jpeg']);

function collectFiles(dir) {
  const list = [];
  (function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (exts.has(ext)) list.push(abs);
      }
    }
  })(dir);
  return list;
}

async function ensureDir(p) {
  mkdirp.sync(p);
}

async function run() {
  [COMP_DIR, OUT_FULL, OUT_THUMB].forEach(d => mkdirp.sync(d));

  const files = collectFiles(INPUT_DIR);
  console.log(`→ TinyPNG圧縮 & リサイズ開始: ${files.length} 枚`);

  let i = 0;
  for (const inPath of files) {
    const rel = path.relative(INPUT_DIR, inPath);               // 例: "1年　北海道/foo.png"
    const parsed = path.parse(rel);                              // { dir: "1年　北海道", name: "foo", ext: ".png" }
    const compOutDir = path.join(COMP_DIR, parsed.dir);
    const compOutPath = path.join(compOutDir, parsed.base);

    const fullOutDir = path.join(OUT_FULL, parsed.dir);
    const thumbOutDir = path.join(OUT_THUMB, parsed.dir);
    await ensureDir(compOutDir);
    await ensureDir(fullOutDir);
    await ensureDir(thumbOutDir);

    try {
      // 1) TinyPNG 圧縮
      const source = tinify.fromFile(inPath);
      await source.toFile(compOutPath);

      // 2) Sharp で 512 / 128 に変換（前回同様「幅指定」のみ）
      const name = parsed.name;
      await sharp(compOutPath)
        .resize({ width: 512 })
        .webp({ quality: 80 })
        .toFile(path.join(fullOutDir, `${name}.webp`));

      await sharp(compOutPath)
        .resize({ width: 128 })
        .webp({ quality: 80 })
        .toFile(path.join(thumbOutDir, `${name}.webp`));

      i++;
      if (i % 10 === 0) console.log(`${i}/${files.length} 枚処理完了`);
    } catch (err) {
      console.error(`❌ エラー: ${rel}`, err);
    }
  }

  console.log(`✅ 完了: ${i}/${files.length} 枚を処理しました`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
