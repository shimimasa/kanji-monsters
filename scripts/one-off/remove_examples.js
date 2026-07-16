const fs = require('fs');

// ファイルパス
const inputFilePath = './kanji_g1_proto新.json';
const outputFilePath = './kanji_g1_proto新_no_examples.json';

try {
  // JSONファイルを読み込む
  const data = JSON.parse(fs.readFileSync(inputFilePath, 'utf8'));
  
  // 各漢字オブジェクトから"examples"プロパティを削除
  const modifiedData = data.map(kanji => {
    const { examples, ...rest } = kanji;
    return rest;
  });
  
  // 結果を新しいファイルに書き込む
  fs.writeFileSync(outputFilePath, JSON.stringify(modifiedData, null, 2), 'utf8');
  
  console.log(`処理が完了しました。"examples"プロパティが削除されたデータが${outputFilePath}に保存されました。`);
} catch (error) {
  console.error('エラーが発生しました:', error);
}