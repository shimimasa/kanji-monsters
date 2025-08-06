// enhanced-transparency.js
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

// 特定の画像のみを処理するモード（必要に応じて使用）
const SPECIFIC_FILES = []; // 例: ['PRV-E001.png', 'KNG-E01.webp']

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
    
    // 背景色サンプルを収集（画像の端からサンプリング）
    const backgroundSamples = [];
    const sampleSize = 10; // 端から何ピクセル取るか
    
    // 上下左右の端からサンプリング
    for (let i = 0; i < sampleSize; i++) {
      // 上端
      const topIdx = i * info.width * info.channels;
      backgroundSamples.push({
        r: data[topIdx],
        g: data[topIdx + 1],
        b: data[topIdx + 2]
      });
      
      // 下端
      const bottomIdx = ((info.height - 1 - i) * info.width) * info.channels;
      backgroundSamples.push({
        r: data[bottomIdx],
        g: data[bottomIdx + 1],
        b: data[bottomIdx + 2]
      });
      
      // 左端
      const leftIdx = i * info.channels;
      backgroundSamples.push({
        r: data[leftIdx],
        g: data[leftIdx + 1],
        b: data[leftIdx + 2]
      });
      
      // 右端
      const rightIdx = (info.width - 1 - i) * info.channels;
      backgroundSamples.push({
        r: data[rightIdx],
        g: data[rightIdx + 1],
        b: data[rightIdx + 2]
      });
    }
    
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
        
        // 1. 白っぽい色（高輝度かつRGB値が近い）
        const isWhitish = brightness > 190 && 
                         Math.abs(r - g) < 40 && 
                         Math.abs(g - b) < 40 && 
                         Math.abs(b - r) < 40;
        
        // 2. チェッカーボードパターン
        const isCheckerboard = (
          // 水色系
          (b > g && b > r && g > r && g > 150 && b > 150) ||
          // 薄い青系
          (b > 170 && b > r + 15 && b > g + 15)
        );
        
        // 3. サンプリングした背景色に近いか
        let isBackgroundColor = false;
        for (const sample of backgroundSamples) {
          const colorDistance = Math.sqrt(
            Math.pow(r - sample.r, 2) + 
            Math.pow(g - sample.g, 2) + 
            Math.pow(b - sample.b, 2)
          );
          // 色の距離が近い場合は背景色と判断
          if (colorDistance < 35) {
            isBackgroundColor = true;
            break;
          }
        }
        
        // 4. 画像の端に多い色
        const isEdgeColor = (
          (r > 230 && g > 230 && b > 230) || // 白に近い色
          (r < 30 && g < 30 && b < 30) || // 黒に近い色
          (r < 40 && g < 40 && b > 190) // 濃い青
        );
        
        // 5. グレースケールに近い色（白〜グレー）
        const isGrayish = Math.abs(r - g) < 20 && 
                          Math.abs(g - b) < 20 && 
                          Math.abs(b - r) < 20 && 
                          brightness > 170;
        
        // いずれかの条件に当てはまれば透明化
        if (isWhitish || isCheckerboard || isBackgroundColor || isEdgeColor || isGrayish) {
          // 完全に透明に
          newData[outputIdx + 3] = 0;
        }
        
        // 半透明の輪郭線を処理（アンチエイリアス対策）
        else if (brightness > 160 && (
          Math.abs(r - g) < 30 && 
          Math.abs(g - b) < 30 && 
          Math.abs(b - r) < 30
        )) {
          // 明るさに応じて透明度を調整（輪郭線のアンチエイリアス処理）
          const alpha = Math.max(0, Math.min(255, Math.floor((190 - brightness) * 2)));
          newData[outputIdx + 3] = alpha;
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
    let files = fs.readdirSync(inputDir)
      .filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file));
    
    // 特定のファイルのみ処理する場合
    if (SPECIFIC_FILES.length > 0) {
      files = files.filter(file => SPECIFIC_FILES.includes(file));
    }
    
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
  console.log('🔄 画像の強化透明化処理を開始します...');
  
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
