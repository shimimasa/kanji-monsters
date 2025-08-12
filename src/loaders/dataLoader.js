// js/dataLoader.js

export let stageData = [];
let enemyData = [];
export let kanjiData = [];
let stageKanjiMap = {};
// 学年別の漢字データを保持するオブジェクトを追加
let kanjiByGrade = {};

export async function loadAllGameData() {
  try {
    console.log("外部JSONファイルの読み込みを開始します...");

    // 複数学年の漢字データをまとめて読み込む
    const grades = [1, 2, 3, 4, 5, 6];
    const kanjiPromises = grades.map(n =>
      fetch(`/data/kanji_g${n}_proto.json`).then(r => {
        if (!r.ok) throw new Error(`漢字データ g${n} の読み込みに失敗: ${r.statusText}`);
        return r.json();
      })
    );
    const kanjiArrays = await Promise.all(kanjiPromises);
    kanjiData = kanjiArrays.flat().map(k => ({
      ...k,
      incorrectCount: k.incorrectCount ?? 0
    }));
    console.log("漢字データ読み込み完了");

    // 漢字データを学年別に整理
    kanjiByGrade = {};
    for (const kanji of kanjiData) {
      const grade = kanji.grade || 1;
      if (!kanjiByGrade[grade]) {
        kanjiByGrade[grade] = [];
      }
      kanjiByGrade[grade].push(kanji);
    }
    console.log("漢字データを学年別に整理しました:", Object.keys(kanjiByGrade).map(g => `${g}年生: ${kanjiByGrade[g].length}件`));

    // 中学生用の漢字データを読み込む（7〜10年生相当）
    try {
      // 漢検4級（7年生相当）
      const g7Response = await fetch('/data/kanji_g7_proto.json').catch(() => null);
      if (g7Response && g7Response.ok) {
        const g7Data = await g7Response.json();
        kanjiByGrade[7] = g7Data;
        console.log(`漢検4級（7年生相当）の漢字データ: ${g7Data.length}件`);
      }

      // 漢検3級（8年生相当）
      const g8Response = await fetch('/data/kanji_g8_proto.json').catch(() => null);
      if (g8Response && g8Response.ok) {
        const g8Data = await g8Response.json();
        kanjiByGrade[8] = g8Data;
        console.log(`漢検3級（8年生相当）の漢字データ: ${g8Data.length}件`);
      }

      // 漢検準2級（9年生相当）
      const g9Response = await fetch('/data/kanji_g9_proto.json').catch(() => null);
      if (g9Response && g9Response.ok) {
        const g9Data = await g9Response.json();
        kanjiByGrade[9] = g9Data;
        console.log(`漢検準2級（9年生相当）の漢字データ: ${g9Data.length}件`);
      }

      // 漢検2級（10年生相当）
      const g10Response = await fetch('/data/kanji_g10_proto.json').catch(() => null);
      if (g10Response && g10Response.ok) {
        const g10Data = await g10Response.json();
        kanjiByGrade[10] = g10Data;
        console.log(`漢検2級（10年生相当）の漢字データ: ${g10Data.length}件`);
      }
    } catch (error) {
      console.warn("中学生用漢字データの読み込みに一部失敗しました:", error);
    }

    // 中学生用の漢字データがない場合のフォールバック
    if (!kanjiByGrade[7]) {
      console.log("漢検4級の漢字データが見つからないため、小学6年生の漢字を代用します");
      kanjiByGrade[7] = kanjiByGrade[6] || [];
    }
    if (!kanjiByGrade[8]) {
      console.log("漢検3級の漢字データが見つからないため、小学6年生の漢字を代用します");
      kanjiByGrade[8] = kanjiByGrade[6] || [];
    }
    if (!kanjiByGrade[9]) {
      console.log("漢検準2級の漢字データが見つからないため、小学6年生の漢字を代用します");
      kanjiByGrade[9] = kanjiByGrade[6] || [];
    }
    if (!kanjiByGrade[10]) {
      console.log("漢検2級の漢字データが見つからないため、小学6年生の漢字を代用します");
      kanjiByGrade[10] = kanjiByGrade[6] || [];
    }

    // 敵データ読み込み
    const enemyPath = '/data/enemies_proto.json';
    const enemyResponse = await fetch(enemyPath);
    if (!enemyResponse.ok) throw new Error(`敵データの読み込みに失敗: ${enemyResponse.statusText}`);
    enemyData = await enemyResponse.json();
    console.log("敵データ読み込み完了");

    // ステージデータ読み込み
    const stagePath = '/data/stages_proto.json';
    const stageResponse = await fetch(stagePath);
    if (!stageResponse.ok) throw new Error(`ステージデータの読み込みに失敗: ${stageResponse.statusText}`);
    stageData = await stageResponse.json();
    console.log("ステージデータ読み込み完了");

    // 🔽 正しいマッピング処理（stageIdごとにグループ化）
    const kanjiMap = {};
    for (const k of kanjiData) {
      const stageIds = Array.isArray(k.stageId) ? k.stageId : [k.stageId];
      for (const sid of stageIds) {
        if (!kanjiMap[sid]) kanjiMap[sid] = [];
        kanjiMap[sid].push(k);
      }
    }
    setStageKanjiMap(kanjiMap);

    // --- 学年ボーナスステージを動的に追加（1〜10年） ---
    // stageId: bonus_g{grade}
    // name   : "{n}年 学年ボーナス"（7〜10は級表記）
    // grade  : 対象学年
    // region : 1〜6は"ボーナス"、7〜10は世界タブのフィルタ基準（アジア/ヨーロッパ/アメリカ大陸/アフリカ大陸）
    // enemyIdList: 学年ボス1体（見つからなければ空配列）
    const gradeToKankenName = (g) => (g===7?'4級':g===8?'3級':g===9?'準2級':'2級');
    const gradeToWorldRegion = (g) => (g===7?'アジア':g===8?'ヨーロッパ':g===9?'アメリカ大陸':'アフリカ大陸');
    for (let g = 1; g <= 10; g++) {
      const id = `bonus_g${g}`;
      if (!stageData.some(s => s.stageId === id)) {
        const name = (g <= 6) ? `${g}年 学年ボーナス` : `学年ボーナス（${gradeToKankenName(g)}）`;
        const region = (g <= 6) ? 'ボーナス' : gradeToWorldRegion(g);
        const boss = findBonusBossForGrade(g, enemyData);
        const enemyIdList = boss ? [boss.id] : [];
        stageData.push({ stageId: id, name, grade: g, region, enemyIdList });
        console.log(`👍 追加: ${id} name=${name}, grade=${g}, region=${region}, enemies=${enemyIdList.length}`);
      }
    }

    return { kanjiData, enemyData, stageData };
  } catch (error) {
    console.error("ゲームデータの読み込み中にエラーが発生しました:", error);
    return null;
  }
}


export function getEnemiesByStageId(stageId) {
  // 学年ボーナス: 学年ボスのみ
  const bonusMatchForEnemy = /^bonus_g(\d+)$/i.exec(stageId);
  if (bonusMatchForEnemy) {
    const g = parseInt(bonusMatchForEnemy[1], 10);
    const fights = g <= 6 ? 3 : 4;

    // 学年内の通常ステージを抽出（ボーナス自身は除外）
    const gradeStages = stageData.filter(s => s.grade === g && !/^bonus_/i.test(s.stageId));
    const byId = new Map(enemyData.map(e => [e.id, e]));

    // 各ステージからボス（isBoss=true）を優先、無ければ末尾ID(最大)を採用
    const picked = [];
    const pickedIds = new Set();
    for (const s of gradeStages) {
      if (!Array.isArray(s.enemyIdList) || s.enemyIdList.length === 0) continue;
      const enemies = s.enemyIdList.map(id => byId.get(id)).filter(Boolean);
      let boss = enemies.find(e => e.isBoss);
      if (!boss) {
        const sorted = [...enemies].sort((a,b) => String(a.id).localeCompare(String(b.id)));
        boss = sorted[sorted.length - 1];
      }
      if (boss && !pickedIds.has(boss.id)) {
        // 念のためボス扱い
        if (!boss.isBoss) boss.isBoss = true;
        picked.push(boss);
        pickedIds.add(boss.id);
      }
      if (picked.length >= fights) break;
    }

    // 足りない場合は学年内の敵からID末尾が大の順で補完（重複なし）
    if (picked.length < fights) {
      const gradeEnemyIds = new Set(
        gradeStages.flatMap(s => Array.isArray(s.enemyIdList) ? s.enemyIdList : [])
      );
      const candidates = [...gradeEnemyIds]
        .map(id => byId.get(id)).filter(Boolean)
        .sort((a,b) => String(a.id).localeCompare(String(b.id)));

      for (let i = candidates.length - 1; i >= 0 && picked.length < fights; i--) {
        const e = candidates[i];
        if (!pickedIds.has(e.id)) {
          if (!e.isBoss) e.isBoss = true;
          picked.push(e);
          pickedIds.add(e.id);
        }
      }
    }

    return picked;
  }

  const stage = stageData.find(s => s.stageId === stageId);
  if (!stage || !stage.enemyIdList) return [];
  
  // IDリストに基づいて敵データをフィルタリング
  let enemies = enemyData.filter(e => stage.enemyIdList.includes(e.id));
  
  // 敵が見つからない場合、IDの接頭辞マッピングを試す
  if (enemies.length === 0) {
    console.warn(`⚠️ ステージ ${stageId} の敵が見つかりません。IDマッピングを試みます。`);
    
    // ステージIDから地域を判断
    const regionMapping = {
      'tohoku_area1': 'AOM',   // 青森
      'tohoku_area2': 'IWT',   // 岩手
      'tohoku_area3': 'AKT',   // 秋田
      'tohoku_area4': 'MYG',   // 宮城
      'tohoku_area5': 'YMG',   // 山形
      'tohoku_area6': 'HKS',   // 福島
      'kanto_area1': 'TOC',    // 栃木
      'kanto_area2': 'GNM',    // 群馬
      'kanto_area3': 'IBK',    // 茨城
      'kanto_area4': 'SIT',    // 埼玉
      'kanto_area5': 'TB',     // 千葉
      'kanto_area6': 'TKY',    // 東京
      'kanto_area7': 'KNG',    // 神奈川
      'chubu_area1': 'NGT',    // 新潟
      'chubu_area2': 'TYM',    // 富山
      'chubu_area3': 'ISK',    // 石川
      'chubu_area4': 'HKI',    // 福井
      'chubu_area5': 'NGN',    // 長野
      'chubu_area6': 'GF',     // 岐阜
      'kinki_area1': 'ME',    // 三重
      'kinki_area2': 'SG',    // 滋賀
      'kinki_area3': 'OSK',    // 大阪
      'kinki_area4': 'KYT',    // 京都
      'kinki_area5': 'HYG',    // 兵庫
      'kinki_area6': 'NR',    // 奈良
      'kinki_area7': 'WKY',   // 和歌山
      'chuugoku_area1': 'TTR',    // 鳥取
      'chuugoku_area2': 'OKY',    // 岡山
      'chuugoku_area3': 'SMN',    // 島根
      'chuugoku_area4': 'HRS',    // 広島
      'chuugoku_area5': 'YMGC',    // 山口
    };
    
    const prefCode = regionMapping[stageId];
    if (prefCode) {
      // 該当する都道府県コードの敵を検索
      enemies = enemyData.filter(e => e.id.startsWith(prefCode));
      console.log(`${prefCode} で始まる敵を ${enemies.length} 件見つけました。`);
      
      // 敵をIDでソートして、E01からE10の順になるようにする
      enemies.sort((a, b) => {
        const numA = parseInt(a.id.split('-E')[1]) || 0;
        const numB = parseInt(b.id.split('-E')[1]) || 0;
        return numA - numB;
      });
      
      // 最後の敵にisBossフラグが設定されていない場合は設定する
      if (enemies.length > 0) {
        const lastEnemy = enemies[enemies.length - 1];
        if (!lastEnemy.isBoss) {
          console.warn(`最後の敵 ${lastEnemy.id} にisBossフラグがないため、設定します。`);
          lastEnemy.isBoss = true;
        }
      }
    }
  }
  
  // それでも見つからない場合は、北海道の敵を代替として使用
  if (enemies.length === 0) {
    console.warn('代替として北海道の敵を使用します。');
    enemies = enemyData.filter(e => e.id.startsWith('HKD-E')).slice(0, 10);
    
    // 最後の敵をボスとして設定
    if (enemies.length > 0) {
      enemies[enemies.length - 1].isBoss = true;
    }
  }
  
  return enemies;
}

export function setStageKanjiMap(map) {
  stageKanjiMap = map;
}

// getKanjiByStageId関数を修正
export function getKanjiByStageId(stageId) {
  // ステージIDを正規化（大文字小文字を区別しない）
  const normalizedId = stageId.toLowerCase();
  // 学年ボーナス: 学年の全漢字を出題
  const bonusM = /^bonus_g(\d+)$/i.exec(stageId);
  if (bonusM) {
    const g = parseInt(bonusM[1], 10);
    console.log(`bonus_g${g}: 学年全漢字プールを使用します`);
    return getKanjiByGrade(g);
  }
  
  // 中学生ステージの場合、学年に基づいて漢字プールを取得
  if (normalizedId.startsWith('asie_')) {
    console.log('4級（grade 7）の漢字プールを使用します');
    return getKanjiByGrade(7);
  } else if (normalizedId.startsWith('europe_')) {
    console.log('3級（grade 8）の漢字プールを使用します');
    return getKanjiByGrade(8);
  } else if (normalizedId.startsWith('america_')) {
    console.log('準2級（grade 9）の漢字プールを使用します');
    return getKanjiByGrade(9);
  } else if (normalizedId.startsWith('africa_')) {
    console.log('2級（grade 10）の漢字プールを使用します');
    return getKanjiByGrade(10);
  }
  
  // 既存のロジック
  if (!stageKanjiMap[normalizedId]) {
    console.log(`stageKanjiMap[${normalizedId}] が見つかりません。正規化されたID: ${normalizedId}`);
    
    // ステージIDから学年を推測
    const grade = getGradeFromStageId(normalizedId);
    if (grade) {
      console.log(`代替として学年${grade}の漢字 ${kanjiByGrade[grade]?.length || 0}件を使用します。`);
      return kanjiByGrade[grade] || [];
    }
    
    return [];
  }
  
  return stageKanjiMap[normalizedId];
}

// ステージIDから学年を推測するヘルパー関数
function getGradeFromStageId(stageId) {
  // ステージIDから学年を推測するロジック
  if (stageId.startsWith('hokkaido_')) return 1;
  if (stageId.startsWith('tohoku_')) return 2;
  if (stageId.startsWith('kanto_')) return 3;
  if (stageId.startsWith('chubu_')) return 4;
  if (stageId.startsWith('kinki_')) return 5;
  if (stageId.startsWith('chugoku_')) return 6;
  if (stageId.startsWith('asie_')) return 7;
  if (stageId.startsWith('europe_')) return 8;
  if (stageId.startsWith('america_')) return 9;
  if (stageId.startsWith('africa_')) return 10;
  
  return null;
}

// 学年別の漢字データを取得する関数をエクスポート
export function getKanjiByGrade(grade) {
  // 既存の漢字データを使用
  if (kanjiByGrade[grade] && kanjiByGrade[grade].length > 0) {
    return kanjiByGrade[grade];
  }
  
  // 該当する学年の漢字がない場合、代替として小学6年生の漢字を使用
  console.warn(`学年${grade}の漢字データがありません。代替として小学6年生の漢字を使用します。`);
  return kanjiByGrade[6] || kanjiData.filter(k => k.grade === 6) || [];
}

// 追加: ID から単一の漢字データを取得するヘルパ関数
export function getKanjiById(id) {
  const k = kanjiData.find(item => item.id === id);
  if (!k) {
    console.warn(`kanjiData に ID=${id} のデータが見つかりません`);
    return null;
  }
  return k;
}

// 以下を追加：monsterDexScreen.js からインポートする getMonsterById / getAllMonsterIds
/**
 * 敵データ（モンスター）を ID から取得
 * @param {number|string} id
 * @returns {object|null}
 */
export function getMonsterById(id) {
  const m = enemyData.find(item => item.id === id);
  if (!m) {
    console.warn(`enemyData に ID=${id} のデータが見つかりません`);
    return null;
  }
  return m;
}

/**
 * 全モンスターの ID リストを返却
 * @returns {Array<number|string>}
 */
export function getAllMonsterIds() {
  return enemyData.map(item => item.id);
}

// --- 学年ボーナス用のボス探索ヘルパ ---
function findBonusBossForGrade(grade, allEnemies) {
  if (!Array.isArray(allEnemies) || allEnemies.length === 0) return null;
  // 1) 明示ボス（isBoss=true）かつ学年一致を優先
  const bosses = allEnemies.filter(e => e && e.grade === grade && e.isBoss);
  if (bosses.length > 0) return bosses[0];
  // 2) 学年一致の中でID順最後
  const sameGrade = allEnemies.filter(e => e && e.grade === grade);
  if (sameGrade.length > 0) {
    const sorted = [...sameGrade].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const last = sorted[sorted.length - 1];
    // 念のためボス扱い
    if (last && !last.isBoss) last.isBoss = true;
    return last;
  }
  // 3) 何もなければ北海道の最後をボス扱い
  const hkd = allEnemies.filter(e => String(e.id).startsWith('HKD-E'));
  if (hkd.length > 0) {
    const sortedHkd = [...hkd].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const lastHkd = sortedHkd[sortedHkd.length - 1];
    if (lastHkd && !lastHkd.isBoss) lastHkd.isBoss = true;
    return lastHkd;
  }
  return null;
}


