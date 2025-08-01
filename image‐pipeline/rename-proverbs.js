// rename-proverbs.js
const fs = require('fs');
const path = require('path');

// リネーム対象のディレクトリ
const DIRS = [
  path.resolve(__dirname, 'compressed/proverbs'),
  path.resolve(__dirname, 'output/proverbs/full'),
  path.resolve(__dirname, 'output/proverbs/thumb')
];

// 各ディレクトリ内のファイルをリネーム
async function renameFiles() {
  for (const dir of DIRS) {
    console.log(`ディレクトリ ${dir} 内のファイルをリネームします...`);
    
    // ディレクトリが存在するか確認
    if (!fs.existsSync(dir)) {
      console.log(`ディレクトリ ${dir} が見つかりません。スキップします。`);
      continue;
    }
    
    // ディレクトリ内のファイル一覧を取得
    const files = fs.readdirSync(dir);
    
    // proverb_XXX 形式のファイルを探してリネーム
    for (const file of files) {
      const match = file.match(/^proverb_(\d+)\.(\w+)$/);
      if (match) {
        const [_, number, ext] = match;
        
        // 3桁のゼロ埋め数値を作成（例: 001, 012, 123）
        const paddedNumber = number.padStart(3, '0');
        
        // 新しいファイル名を作成（例: PRV-E001.webp）
        const newFileName = `PRV-E${paddedNumber}.${ext}`;
        
        // ファイルをリネーム
        const oldPath = path.join(dir, file);
        const newPath = path.join(dir, newFileName);
        
        try {
          fs.renameSync(oldPath, newPath);
          console.log(`${file} → ${newFileName}`);
        } catch (err) {
          console.error(`${file} のリネームに失敗: ${err.message}`);
        }
      }
    }
  }
  
  console.log('リネーム完了！');
}

renameFiles().catch(console.error);
