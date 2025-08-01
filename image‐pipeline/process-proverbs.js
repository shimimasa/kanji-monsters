// process-proverbs.js
const fs     = require('fs');
const path   = require('path');
const mkdirp = require('mkdirp');
const tinify = require('tinify');
const sharp  = require('sharp');

// TinyPNG SDK にキーをセット
tinify.key = process.env.TINYPNG_API_KEY || "CvXw9ZsCJcs66Ns04VySFH5qfWk20hG4";

const PROVERB_DIR = path.resolve(__dirname, 'proverb');
const COMP_DIR    = path.resolve(__dirname, 'compressed/proverbs');
const OUT_FULL    = path.resolve(__dirname, 'output/proverbs/full');
const OUT_THUMB   = path.resolve(__dirname, 'output/proverbs/thumb');

async function run() {
  // 出力先ディレクトリを作成
  [COMP_DIR, OUT_FULL, OUT_THUMB].forEach(d => mkdirp.sync(d));

  // 1) TinyPNG で圧縮
  console.log('→ TinyPNG で圧縮中…');
  const files = fs.readdirSync(PROVERB_DIR).filter(f => f.endsWith('.png'));
  console.log(`${files.length}枚の画像を処理します`);
  
  let processed = 0;
  for (const file of files) {
    try {
      const source = tinify.fromFile(path.join(PROVERB_DIR, file));
      await source.toFile(path.join(COMP_DIR, file));
      processed++;
      if (processed % 10 === 0) {
        console.log(`${processed}/${files.length} 圧縮完了`);
      }
    } catch (err) {
      console.error(`${file}の圧縮中にエラーが発生しました:`, err);
    }
  }

  // 2) Sharp でリサイズ＋WebP変換
  console.log('→ Sharp でリサイズ＆WebP変換中…');
  let converted = 0;
  for (const file of files) {
    try {
      const name = path.parse(file).name;
      const inPath = path.join(COMP_DIR, file);

      await sharp(inPath).resize({ width: 512 }).webp({ quality: 80 }).toFile(path.join(OUT_FULL, name + '.webp'));
      await sharp(inPath).resize({ width: 128 }).webp({ quality: 80 }).toFile(path.join(OUT_THUMB, name + '.webp'));
      
      converted++;
      if (converted % 10 === 0) {
        console.log(`${converted}/${files.length} 変換完了`);
      }
    } catch (err) {
      console.error(`${file}の変換中にエラーが発生しました:`, err);
    }
  }

  console.log(`✅ 完了！${processed}/${files.length}枚の画像を圧縮し、${converted}枚を変換しました`);
}

run().catch(console.error);