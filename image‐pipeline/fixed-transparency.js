// fixed-transparency.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const mkdirp = require('mkdirp');

// 処理対象のディレクトリ設定
const INPUT_DIR = path.resolve(__dirname, '../public/assets/images'); 
const OUTPUT_DIR = path.resolve(__dirname, '../public/assets/images_final');

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
    const image = await sharp(inputPath)
      // 最初に画像を拡大して処理精度を上げる
      .resize({ 
        width: 800,
        height: 800,
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .toBuffer();
    
    // 画像のピクセルデータを取得
    const { data, info } = await sharp(image)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // 新しいピクセルデータ用のバッファを作成（アルファチャンネル付き）
    const channels = 4; // RGBA
    const newData = Buffer.alloc(info.width * info.height * channels);
    
    // 各ピクセルを処理
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const idx = (y * info.width + x) * channels;
        
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        // RGBデータをコピー
        newData[idx] = r;
        newData[idx + 1] = g;
        newData[idx + 2] = b;
        
        // アルファチャンネルを設定（デフォルトは不透明）
        newData[idx + 3] = 255;
        
        // 明るさの計算（輝度に近い加重平均）
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // 白っぽい色（高輝度かつRGB値が近い）
        if (brightness > 220 && 
            Math.abs(r - g) < 30 && 
            Math.abs(g - b) < 30 && 
            Math.abs(b - r) < 30) {
          // 完全に透明に
          newData[idx + 3] = 0;
        }
        // 水色のチェッカーボードパターン
        else if (b > g && b > r && g > r && g > 140 && b > 140) {
          newData[idx + 3] = 0;
        }
        // グレーっぽい色
        else if (Math.abs(r - g) < 20 && 
                Math.abs(g - b) < 20 && 
                Math.abs(b - r) < 20 && 
                brightness > 180) {
          newData[idx + 3] = 0;
        }
        // 輪郭線の処理（半透明部分）
        else if (brightness > 200 && 
                Math.abs(r - g) < 40 && 
                Math.abs(g - b) < 40 && 
                Math.abs(b - r) < 40) {
          // 明るさに応じて透明度を調整
          const alpha = Math.max(0, Math.min(255, Math.floor((255 - brightness) * 2)));
          newData[idx + 3] = alpha;
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
    .resize(400, 400, { 
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
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
    let files = fs.readdirSync(inputDir)
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
  console.log('🔄 最終透明化処理を開始します...');
  
  // 出力先の親ディレクトリを作成
  mkdirp.sync(OUTPUT_DIR);
  
  // 各サブディレクトリを処理
  for (const subdir of TARGET_SUBDIRS) {
    await processDirectory(subdir);
  }
  
  console.log(`✨ 処理完了！${processedCount}/${totalFiles}ファイルの背景を透明化しました`);
  console.log('処理後の画像は以下のディレクトリに保存されました:');
  console.log(OUTPUT_DIR);
}

run().catch(err => {
  console.error('❌ 実行中にエラーが発生しました:', err);
  process.exit(1);
});
