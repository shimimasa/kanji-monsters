// js/dataLoader.js
import { gameState } from '../core/gameState.js';

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
    
                // 追加: 伝説/幻ゴトモンの読み込みをマージ
                try {
                  const legendResp = await fetch('/data/enemies_legend.json');
                  if (legendResp && legendResp.ok) {
                    const more = await legendResp.json();
                    // 学年推定: stageId / id プレフィックス
                    const stageIdToGrade = {
                      hokkaido_bonus: 1, tohoku_bonus: 2, kanto_bonus: 3, kantou_bonus: 3, chubu_bonus: 4, chuubu_bonus: 4,
                      kinki_bonus: 5,
                      chugoku_bonus: 6, chuugoku_bonus: 6, cyuugoku_bonus: 6,
                      kyushu_bonus: 6, shikoku_bonus: 6, // 便宜的に6に寄せる（後段のステージ定義で正しく補完）
                      asia_bonus: 7, europe_bonus: 8, america_bonus: 9, africa_bonus: 10,
                    };
                    for (const e of more) {
                      if (!e || !e.id) continue;
                      if (typeof e.grade !== 'number') {
                        let g = null;
                        if (e.stageId && stageIdToGrade[e.stageId]) g = stageIdToGrade[e.stageId];
                        else if (String(e.id).startsWith('AS-')) g = 7;
                        else if (String(e.id).startsWith('EUR-')) g = 8;
                        else if (String(e.id).startsWith('AME-')) g = 9;
                        else if (String(e.id).startsWith('AFR-')) g = 10;
                        if (g) e.grade = g;
                      }
                      enemyData.push(e);
                    }
                    console.log(`伝説/幻ゴトモン: 追加 ${more.length} 件`);
                  }
                } catch (e) {
                  console.warn('伝説/幻ゴトモンの読み込みに失敗:', e);
                }

        // ステージデータ読み込み
        const stagePath = '/data/stages_proto.json';
        const stageResponse = await fetch(stagePath);
        if (!stageResponse.ok) throw new Error(`ステージデータの読み込みに失敗: ${stageResponse.statusText}`);
        stageData = await stageResponse.json();
        console.log("ステージデータ読み込み完了");
    
        // 追加: ボーナスステージ定義のマージ（存在時のみ）
        try {
          const bonusResp = await fetch('/data/stages.bonus.json').catch(() => null);
          if (bonusResp && bonusResp.ok) {
            const bonusStages = await bonusResp.json();
            const exists = new Set(stageData.map(s => s.stageId));
            let added = 0;
            for (const s of bonusStages) {
              if (!s || !s.stageId) continue;
              if (!exists.has(s.stageId)) {
                stageData.push(s);
                exists.add(s.stageId);
                added++;
              }
            }
            if (added > 0) console.log(`ボーナスステージを ${added} 件追加`);
          }
        } catch (e) {
          console.warn('stages.bonus.json の読み込みに失敗:', e);
        }

    // 敵データに学年（grade）を補完（stageId → stageData／プレフィックス推定）
    {
      const stageGradeIndex = new Map(stageData.map(s => [s.stageId, s.grade]));
      for (const e of enemyData) {
        if (!e || typeof e.id !== 'string') continue;
        if (String(e.id).startsWith('PRV-')) continue; // ことわざは除外
        if (typeof e.grade !== 'number') {
          let g = stageGradeIndex.get(e.stageId);
          if (!g) g = getGradeFromStageId(String(e.stageId || '')) || null;
          if (g) e.grade = g;
        }
      }
    }

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
        //const gradeToKankenName = (g) => (g===7?'4級':g===8?'3級':g===9?'準2級':'2級');
        //const gradeToWorldRegion = (g) => (g===7?'アジア':g===8?'ヨーロッパ':g===9?'アメリカ大陸':'アフリカ大陸');
    
        // 学年別 伝説/幻 候補取得ヘルパ
        ///const pickLegendaryIdsForGrade = (g) => {
          //const list = enemyData.filter(e =>
            //e && e.grade === g && (
              //(typeof e.category === 'string' && e.category.includes('伝説')) ||
              //String(e.id).includes('-L')
            //)
          //);
          // 安定順にソートして先頭5体
          //return [...list].sort((a,b) => String(a.id).localeCompare(String(b.id))).slice(0, 5).map(e => e.id);
        //};
    
        //for (let g = 1; g <= 10; g++) {
          //const id = `bonus_g${g}`;
          //if (!stageData.some(s => s.stageId === id)) {
            //const name = (g <= 6) ? `${g}年 学年ボーナス` : `学年ボーナス（${gradeToKankenName(g)}）`;
            //const region = (g <= 6) ? 'ボーナス' : gradeToWorldRegion(g);
            // 新仕様: 伝説5体を配置
            //const enemyIdList = pickLegendaryIdsForGrade(g);
            //stageData.push({ stageId: id, name, grade: g, region, enemyIdList });
            //console.log(`👍 追加: ${id} enemies=${enemyIdList.length}`);
          //}
        //}

    return { kanjiData, enemyData, stageData };
  } catch (error) {
    console.error("ゲームデータの読み込み中にエラーが発生しました:", error);
    return null;
  }
}


export function getEnemiesByStageId(stageId) {
  // ボーナス: 通常ステージ型（伝説5体）。レビュー解放で幻が混入
  const m = /^bonus_g(\d+)$/i.exec(stageId);
  if (m) {
    const g = parseInt(m[1], 10);
    // ステージ定義に敵が入っていればそれを使い、無ければ学年伝説から動的生成
    const st = stageData.find(s => s.stageId === stageId);
    let baseIds = Array.isArray(st?.enemyIdList) && st.enemyIdList.length > 0
      ? st.enemyIdList.slice(0, 5)
      : (() => {
          const list = enemyData.filter(e =>
            e && e.grade === g && (
              (typeof e.category === 'string' && e.category.includes('伝説')) ||
              String(e.id).includes('-L')
            )
          ).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
          return list.slice(0,5).map(e=>e.id);
        })();

    // 幻置換: ボーナス初クリア後のレビュー増分を集計 → 30ごとに1体、最大5体
    let replacedCount = 0;
    let eligibleSum = 0;
    try {
      if (gameState && gameState.practiceProgress && Array.isArray(stageData)) {
        const stagesOfGrade = stageData.filter(s => s && s.grade === g);
        for (const stg of stagesOfGrade) {
          const sid = String(stg.stageId || '');
          const entry = gameState.practiceProgress[sid] || {};
          const cur = Math.max(0, Number(entry.reviewScore || 0));
          const snap = Math.max(0, Number(entry.reviewScoreSnapshot || 0));
          eligibleSum += Math.max(0, cur - snap);
        }
      }
      const perPhantom = Math.max(1, parseInt(localStorage.getItem('phantomPerUnit') || '30', 10));
      const maxSlots = 5;
      let need = Math.min(maxSlots, Math.floor(eligibleSum / perPhantom));

      if (need > 0 && baseIds.length > 0) {
        const phantoms = enemyData.filter(e =>
          e && e.grade === g && (
            (typeof e.rarity === 'string' && e.rarity.includes('幻')) ||
            (typeof e.category === 'string' && e.category.includes('幻')) ||
            String(e.id).includes('-F')
          )
        ).sort((a,b)=>String(a.id).localeCompare(String(b.id)));

        if (phantoms.length > 0) {
          // 置換対象インデックス（重複なし）
          const idxs = [...Array(baseIds.length).keys()];
          for (let i = idxs.length - 1; i > 0; i--) {
            const j = (Math.random() * (i + 1)) | 0;
            [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
          }
          const pickedIdx = idxs.slice(0, Math.min(need, baseIds.length));

          // 幻の候補から重複しないように選択
          const pickedPhantoms = [];
          const pool = [...phantoms];
          for (let k = 0; k < pickedIdx.length && pool.length > 0; k++) {
            const pi = (Math.random() * pool.length) | 0;
            pickedPhantoms.push(pool.splice(pi, 1)[0]);
          }

          // 実置換
          for (let t = 0; t < pickedIdx.length && t < pickedPhantoms.length; t++) {
            baseIds[pickedIdx[t]] = pickedPhantoms[t].id;
            replacedCount++;
          }
        }
      }
    } catch {}

    // バトル画面で表示するための情報を格納
    try {
      gameState.__bonusPhantomInfo = {
        grade: g,
        replaced: replacedCount,
        progress: eligibleSum,
        target: 150,
        perUnit: 30
      };
    } catch {}

    // 実体化
    const byId = new Map(enemyData.map(e => [e.id, e]));
    return baseIds.map(id => byId.get(id)).filter(Boolean);
  }

  const stage = stageData.find(s => s.stageId === stageId);
  if (!stage || !stage.enemyIdList) return [];

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
      'kinki_area1': 'ME',     // 三重
      'kinki_area2': 'SG',     // 滋賀
      'kinki_area3': 'OSK',    // 大阪
      'kinki_area4': 'KYT',    // 京都
      'kinki_area5': 'HYG',    // 兵庫
      'kinki_area6': 'NR',     // 奈良
      'kinki_area7': 'WKY',    // 和歌山
      'chuugoku_area1': 'TTR', // 鳥取
      'chuugoku_area2': 'OKY', // 岡山
      'chuugoku_area3': 'SMN', // 島根
      'chuugoku_area4': 'HRS', // 広島
      'chuugoku_area5': 'YMGC',// 山口

      // 追加: 四国
      'shikoku_area1': 'TOKU', // 徳島
      'shikoku_area2': 'KAGA', // 香川（KAG ではなく KAGA）
      'shikoku_area3': 'EHIM', // 愛媛（EHM ではなく EHIM）
      'shikoku_area4': 'KOCH', // 高知

      // 追加: 九州
      'kyushu_area1': 'FUK',   // 福岡（FUKU ではなく FUK）
      'kyushu_area2': 'SAGA',  // 佐賀（SAG ではなく SAGA）
      'kyushu_area3': 'NAGA',  // 長崎（NAG ではなく NAGA）
      'kyushu_area4': 'OITA',  // 大分（OIT ではなく OITA）
      'kyushu_area5': 'KUMA',  // 熊本（KUM ではなく KUMA）
      'kyushu_area6': 'MIYA',  // 宮崎（MIY ではなく MIYA）
      'kyushu_area7': 'KAGO',  // 鹿児島（KAG ではなく KAGO）
      'kyushu_area8': 'OKI',   // 沖縄
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
  if (normalizedId.startsWith('asia_')) {
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
  
  // 既存のロジック + 追加フォールバック
  if (!stageKanjiMap[normalizedId]) {
    console.log(`stageKanjiMap[${normalizedId}] が見つかりません。正規化されたID: ${normalizedId}`);

    // 追加: ステージ定義にある kanjiPoolIdList を直接参照
    try {
      const st = stageData.find(s => String(s.stageId).toLowerCase() === normalizedId);
      if (st && Array.isArray(st.kanjiPoolIdList) && st.kanjiPoolIdList.length > 0) {
        const pool = st.kanjiPoolIdList.map(id => getKanjiById(id)).filter(Boolean);
        if (pool.length > 0) {
          console.log(`✅ stages_proto の kanjiPoolIdList から ${pool.length} 件を構築`);
          return pool;
        }
      }
    } catch {}

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
  if (stageId.startsWith('hokkaido_')) return 1;
  if (stageId.startsWith('tohoku_')) return 2;
  if (stageId.startsWith('kanto_')) return 3;
  if (stageId.startsWith('chubu_')) return 4;
  if (stageId.startsWith('kinki_')) return 5;
  if (stageId.startsWith('chugoku_') || stageId.startsWith('chuugoku_')) return 6;
  if (stageId.startsWith('shikoku_')) return 11;   // 追加
  if (stageId.startsWith('kyushu_'))  return 12;   // 追加
  if (stageId.startsWith('asia_')) return 7;
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
  // まず小学生データ
  let k = kanjiData.find(item => item.id === id);
  if (k) return k;

  // 中学生・高校相当（7〜10）にも対応
  for (let g = 7; g <= 10; g++) {
    const arr = kanjiByGrade?.[g];
    if (Array.isArray(arr)) {
      const f = arr.find(item => item.id === id);
      if (f) return f;
    }
  }

  console.warn(`kanjiData に ID=${id} のデータが見つかりません`);
  return null;
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

// ★★★ マスターモード用のマスター判定関数を追加 ★★★

/**
 * 漢字がマスター済みかどうかを判定する
 * @param {string} kanjiId 漢字のID
 * @returns {boolean} マスター済みならtrue
 */
export function isKanjiMastered(kanjiId) {
  try {
    const gs = (typeof window !== 'undefined' && window.gameState) ? window.gameState : null;
    const progress = gs?.kanjiReadProgress?.[kanjiId];
    return !!(progress && progress.mastered);
  } catch (e) {
    return false;
  }
}

/**
 * ステージの全漢字がマスター済みかどうかを判定する
 * @param {string} stageId ステージのID
 * @returns {boolean} 全ての漢字がマスター済みならtrue
 */
export function isStageFullyMastered(stageId) {
  const kanjiList = getKanjiByStageId(stageId);
  if (kanjiList.length === 0) return true; // 漢字がないステージは完了扱い
  
  return kanjiList.every(kanji => isKanjiMastered(kanji.id));
}

/**
 * ステージの未マスター漢字リストを取得する
 * @param {string} stageId ステージのID
 * @returns {Array} 未マスターの漢字データの配列
 */
export function getUnmasteredKanjiForStage(stageId) {
  const kanjiList = getKanjiByStageId(stageId);
  return kanjiList.filter(kanji => !isKanjiMastered(kanji.id));
}
