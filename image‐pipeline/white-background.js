// white-background.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const mkdirp = require('mkdirp');

// 処理対象のディレクトリ設定
const INPUT_DIR = path.resolve(__dirname, '../public/assets/images_transparent'); // 透過処理済みの画像
const OUTPUT_DIR = path.resolve(__dirname, '../public/assets/images_white'); // 白背景画像の出力先

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
    const image = await sharp(inputPath).toBuffer();
    const metadata = await sharp(inputPath).metadata();
    
    // 白背景を作成
    const whiteBackground = await sharp({
      create: {
        width: metadata.width,
        height: metadata.height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    }).png().toBuffer();
    
    // 元画像を白背景の上に合成
    await sharp(whiteBackground)
      .composite([
        {
          input: image,
          blend: 'over' // 上に重ねる
        }
      ])
      .png()
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
      const outputPath = path.join(outputDir, file);
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

// 元の画像を直接処理するバージョン（透過処理をスキップする場合）
async function processOriginalImages() {
  const INPUT_ORIG_DIR = path.resolve(__dirname, '../public/assets/images');
  
  for (const subdir of TARGET_SUBDIRS) {
    const inputDir = path.join(INPUT_ORIG_DIR, subdir);
    const outputDir = path.join(OUTPUT_DIR, subdir);
    
    // 出力先ディレクトリが存在しない場合は作成
    mkdirp.sync(outputDir);
    
    try {
      // ディレクトリ内のファイル一覧を取得
      const files = fs.readdirSync(inputDir)
        .filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file));
      
      console.log(`📁 元画像ディレクトリ ${subdir} の処理を開始: ${files.length}ファイル`);
      
      // 各ファイルを処理
      for (const file of files) {
        const inputPath = path.join(inputDir, file);
        // 出力ファイル名は拡張子をPNGに変更
        const outputPath = path.join(outputDir, file.replace(/\.(jpg|jpeg|webp)$/i, '.png'));
        
        try {
          // 画像を読み込み
          const image = await sharp(inputPath).toBuffer();
          const metadata = await sharp(inputPath).metadata();
          
          // 白背景を作成
          const whiteBackground = await sharp({
            create: {
              width: metadata.width,
              height: metadata.height,
              channels: 4,
              background: { r: 255, g: 255, b: 255, alpha: 1 }
            }
          }).png().toBuffer();
          
          // 元画像を白背景の上に合成
          await sharp(whiteBackground)
            .composite([
              {
                input: image,
                blend: 'over' // 上に重ねる
              }
            ])
            .png()
            .toFile(outputPath);
          
          console.log(`✅ 処理完了: ${path.basename(inputPath)}`);
          processedCount++;
          
        } catch (err) {
          console.error(`❌ エラー: ${path.basename(inputPath)}`, err);
        }
      }
      
    } catch (err) {
      if (err.code === 'ENOENT') {
        console.warn(`⚠️ ディレクトリが存在しません: ${inputDir}`);
      } else {
        console.error(`❌ ディレクトリ処理中にエラーが発生: ${subdir}`, err);
      }
    }
  }
}

async function run() {
  console.log('🔄 画像の白背景処理を開始します...');
  
  // 出力先の親ディレクトリを作成
  mkdirp.sync(OUTPUT_DIR);
  
  // 透過処理済み画像を使用する場合
  // for (const subdir of TARGET_SUBDIRS) {
  //   await processDirectory(subdir);
  // }
  
  // 元の画像を直接処理する場合（推奨）
  await processOriginalImages();
  
  console.log(`✨ 処理完了！${processedCount}ファイルの背景を白色に変換しました`);
}

run().catch(err => {
  console.error('❌ 実行中にエラーが発生しました:', err);
  process.exit(1);
});
