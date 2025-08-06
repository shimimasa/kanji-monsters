// remove-background.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const mkdirp = require('mkdirp');

// 処理対象のディレクトリ設定
const INPUT_DIR = path.resolve(__dirname, '../public/assets/images'); // 入力元ディレクトリ
const OUTPUT_DIR = path.resolve(__dirname, '../public/assets/images_transparent'); // 出力先ディレクトリ

// 処理対象のサブディレクトリ（必要に応じて調整）
const TARGET_SUBDIRS = [
  'enemy',
  'monsters/full/grade1-hokkaido',
  'monsters/full/grade2-touhoku',
  'monsters/full/grade3-kantou',
  'monsters/full/grade4-chuubu',
  'monsters/full/grade5-kinki',
  'monsters/full/grade6-chuugoku',
  'proverbs/full'
];

// 処理済みファイル数のカウンター
let processedCount = 0;
let totalFiles = 0;

async function processImage(inputPath, outputPath) {
  try {
    // 画像を読み込み
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    // 画像のサイズを取得
    const width = metadata.width;
    const height = metadata.height;
    
    // 新しい白背景画像を作成
    const whiteBackground = Buffer.alloc(width * height * 4, 255);
    
    // 元の画像を読み込み、白背景に合成
    const originalImage = await image.toBuffer();
    
    // 白背景の画像を作成
    const whiteCanvas = await sharp({
      create: {
        width: width,
        height: height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    }).png().toBuffer();
    
    // 元画像を白背景の上に合成
    const result = await sharp(whiteCanvas)
      .composite([
        {
          input: originalImage,
          gravity: 'center'
        }
      ])
      .png()
      .toBuffer();
    
    // 出力先ディレクトリが存在しない場合は作成
    const outputDir = path.dirname(outputPath);
    mkdirp.sync(outputDir);
    
    // 処理した画像を保存
    await sharp(result)
      .toFile(outputPath);
    
    console.log(`✅ 処理完了: ${path.basename(inputPath)}`);
    processedCount++;
    
  } catch (err) {
    console.error(`❌ エラー: ${path.basename(inputPath)}`, err);
  }
}

async function processDirectory(subdir) {
  const inputDir = path.join(INPUT_DIR, subdir);
  const outputDir = path.join(OUTPUT_DIR, subdir);
  
  // 出力先ディレクトリが存在しない場合は作成
  mkdirp.sync(outputDir);
  
  try {
    // ディレクトリ内のファイル一覧を取得
    const files = fs.readdirSync(inputDir)
      .filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file));
    
    totalFiles += files.length;
    
    console.log(`📁 ディレクトリ ${subdir} の処理を開始: ${files.length}ファイル`);
    
    // 各ファイルを処理
    for (const file of files) {
      const inputPath = path.join(inputDir, file);
      const outputPath = path.join(outputDir, file.replace(/\.(jpg|jpeg|webp)$/i, '.png'));
      await processImage(inputPath, outputPath);
    }
    
    console.log(`📁 ディレクトリ ${subdir} の処理が完了しました`);
    
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn(`⚠️ ディレクトリが存在しません: ${inputDir}`);
    } else {
      console.error(`❌ ディレクトリ処理中にエラーが発生: ${subdir}`, err);
    }
  }
}

async function run() {
  console.log('🔄 画像の背景処理を開始します...');
  
  // 出力先の親ディレクトリを作成
  mkdirp.sync(OUTPUT_DIR);
  
  // 各サブディレクトリを処理
  for (const subdir of TARGET_SUBDIRS) {
    await processDirectory(subdir);
  }
  
  console.log(`✨ 処理完了！${processedCount}/${totalFiles}ファイルの背景を処理しました`);
}

run().catch(err => {
  console.error('❌ 実行中にエラーが発生しました:', err);
  process.exit(1);
});
