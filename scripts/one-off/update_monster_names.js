const fs = require('fs');
const path = require('path');

// ファイルパス - 現在のディレクトリからの相対パスに修正
const enemiesPath = './enemies_proto.json';
const proverbsPath = './proverbs_with_monsters.json';

// ファイル読み込み
const enemies = JSON.parse(fs.readFileSync(enemiesPath, 'utf8'));
const proverbs = JSON.parse(fs.readFileSync(proverbsPath, 'utf8'));

// モンスター名の辞書を作成
const monsterNames = {};
proverbs.forEach(proverb => {
  if (proverb.id && proverb.monsterName) {
    monsterNames[proverb.id] = proverb.monsterName;
  }
});

// 敵データの更新
let updatedCount = 0;
enemies.forEach(enemy => {
  if (enemy.id && enemy.id.startsWith('PRV-E')) {
    // PRV-E001 から数字部分を抽出
    const idNumber = parseInt(enemy.id.substring(5), 10);
    
    // 対応するモンスター名が存在する場合は更新
    if (monsterNames[idNumber] && enemy.name !== monsterNames[idNumber]) {
      enemy.name = monsterNames[idNumber];
      updatedCount++;
    }
  }
});

// 更新したデータを書き込み
fs.writeFileSync(enemiesPath, JSON.stringify(enemies, null, 2), 'utf8');

console.log(`更新完了: ${updatedCount}件のモンスター名を更新しました`);