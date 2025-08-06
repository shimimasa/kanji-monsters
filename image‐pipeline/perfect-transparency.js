// perfect-transparency.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const mkdirp = require('mkdirp');

// 処理対象のディレクトリ設定
const INPUT_DIR = path.resolve(__dirname, '../public/assets/images'); // 元画像ディレクトリ
const OUTPUT_DIR = path.resolve(__dirname, '../public/assets/images_transparent'); // 出力先ディレクトリ

// 処理対象のサブディレクトリ
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
    console.log(`処理開始: ${path.basename(inputPath)}`);
    
    // 画像を読み込み
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    // 画像のピクセルデータを取得
    const { data, info } = await image
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // 新しいピクセルデータ用のバッファを作成（アルファチャンネル付き）
    const channels = 4; // RGBA
    const newData = Buffer.alloc(info.width * info.height * channels);
    
    // 各ピクセルを処理
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const inputIdx = (y * info.width + x) * info.channels;
        const outputIdx = (y * info.width + x) * channels;
        
        const r = data[inputIdx];
        const g = data[inputIdx + 1];
        const b = data[inputIdx + 2];
        
        // RGBデータをコピー
        newData[outputIdx] = r;
        newData[outputIdx + 1] = g;
        newData[outputIdx + 2] = b;
        
        // アルファチャンネルを設定（デフォルトは不透明）
        newData[outputIdx + 3] = 255;
        
        // 明るさの計算（輝度に近い加重平均）
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // 背景判定条件
        // 1. 白っぽい色（高輝度かつRGB値が近い）
        const isWhitish = brightness > 200 && 
                         Math.abs(r - g) < 30 && 
                         Math.abs(g - b) < 30 && 
                         Math.abs(b - r) < 30;
        
        // 2. チェッカーボードパターン（水色や薄い青系）
        const isCheckerboard = (
          // 水色のチェッカーボードパターン
          (b > g && b > r && g > r && g > 160 && b > 160) ||
          // 薄い青系
          (b > 180 && b > r + 15 && b > g + 15)
        );
        
        // 3. 画像の端に多い色（背景色の可能性が高い）
        const isEdgeColor = (
          // 画像の端に多い色のパターン
          (r > 240 && g > 240 && b > 240) || // 白
          (r < 20 && g < 20 && b < 20) || // 黒
          (r < 30 && g < 30 && b > 200) // 濃い青
        );
        
        // いずれかの条件に当てはまれば透明化
        if (isWhitish || isCheckerboard || isEdgeColor) {
          // 完全に透明に
          newData[outputIdx + 3] = 0;
        }
      }
    }
    
    // 処理した画像を保存
    await sharp(newData, {
      raw: {
        width: info.width,
        height: info.height,
        channels: channels
      }
    })
    .png() // PNG形式で保存（透明度を保持）
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
  console.log('🔄 画像の完全透明化処理を開始します...');
  
  // 出力先の親ディレクトリを作成
  mkdirp.sync(OUTPUT_DIR);
  
  // 各サブディレクトリを処理
  for (const subdir of TARGET_SUBDIRS) {
    await processDirectory(subdir);
  }
  
  console.log(`✨ 処理完了！${processedCount}/${totalFiles}ファイルの背景を完全に透明化しました`);
  console.log('処理後の画像は以下のディレクトリに保存されました:');
  console.log(OUTPUT_DIR);
}

run().catch(err => {
  console.error('❌ 実行中にエラーが発生しました:', err);
  process.exit(1);
});
