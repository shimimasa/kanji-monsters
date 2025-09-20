// src/core/achievementManager.js
// 実績システムの管理

import { gameState, unlockAchievement, isAchievementUnlocked } from './gameState.js';
import { publish } from './eventBus.js';
import { loadDex as loadKanjiDex } from '../models/kanjiDex.js';
import { loadDex as loadMonsterDex } from '../models/monsterDex.js';
import { stageData, kanjiData } from '../loaders/dataLoader.js';

let achievementsData = null;

/**
 * 実績データを読み込む
 * @returns {Promise<Array>} 実績データの配列
 */
async function loadAchievements() {
  if (achievementsData) {
    return achievementsData;
  }

  try {
    const response = await fetch('/data/achievements.json');
    if (!response.ok) {
      throw new Error(`実績データの読み込みに失敗: ${response.statusText}`);
    }
    achievementsData = await response.json();
    console.log(`📋 実績データを読み込みました: ${achievementsData.length}件`);
    return achievementsData;
  } catch (error) {
    console.error('❌ 実績データの読み込みエラー:', error);
    return [];
  }
}

/**
 * 実績の達成条件をチェックする
 * @param {Object} achievement 実績オブジェクト
 * @param {Object} playerStats プレイヤー統計データ
 * @returns {boolean} 条件を満たしているかどうか
 */
function checkCondition(achievement, playerStats) {
  const { condition } = achievement;
  const { type, value } = condition;

  switch (type) {
    case 'enemiesDefeated':
      return playerStats.enemiesDefeated >= value;
    case 'levelReached':
      return playerStats.level >= value;
    case 'stagesCleared':
      return playerStats.stagesCleared >= value;
    case 'stageCleared': {
      const id = value;
      const ls = typeof localStorage !== 'undefined' && localStorage.getItem(`clear_${id}`) === '1';
      const gs = gameState.stageProgress?.[id]?.cleared;
      return !!(ls || gs);
    }
    case 'comboReached':
      return playerStats.comboCount >= value;
    case 'kanjiCollected':
      return loadKanjiDex().size >= value;
    case 'monstersCollected':
      return loadMonsterDex().size >= value;
    case 'totalCorrect':
      return playerStats.totalCorrect >= value;
    case 'skillPointsUsed':
      return playerStats.skillPointsUsed >= value;
    case 'perfectStage':
      if (gameState.justClearedPerfectly) {
        gameState.justClearedPerfectly = false;
        return true;
      }
      return false;
    case 'bossesDefeated':
      return playerStats.bossesDefeated >= value;
    case 'playtimeMinutes':
      return (playerStats.playtimeSeconds / 60) >= value;
    case 'weaknessHits':
      return playerStats.weaknessHits >= value;
    case 'healsSuccessful':
      return playerStats.healsSuccessful >= value;
    case 'regionCleared': {
      const regionStages = stageData.filter(s => s.region === value);
      if (regionStages.length === 0) return false;
      return regionStages.every(s => gameState.stageProgress?.[s.stageId]?.cleared);
    }
    case 'gradeCompleted': {
      const gradeKanji = kanjiData.filter(k => k.grade === value);
      if (gradeKanji.length === 0) return false;
      const kanjiDex = loadKanjiDex();
      return gradeKanji.every(k => kanjiDex.has(k.id));
    }
    default:
      return false;
  }
}

/**
 * 全ての実績をチェックし、条件を満たした実績を解除する
 */
export async function checkAchievements() {
  try {
    // 1. 実績データを読み込み
    const achievements = await loadAchievements();
    if (achievements.length === 0) {
      console.warn('⚠️ 実績データが読み込まれていません');
      return;
    }

    // 2. 現在のプレイヤー統計データを取得
    const { playerStats, unlockedAchievements } = gameState;

    // 3. 新たに解除された実績のリスト
    const newlyUnlocked = [];

    // 4. 全ての実績をループしてチェック
    for (const achievement of achievements) {
      const { id, title, description } = achievement;

      // まだ解除されていない実績のみチェック
      if (!isAchievementUnlocked(id)) {
        // 達成条件をチェック
        if (checkCondition(achievement, playerStats)) {
          // 条件を満たしている場合、実績を解除
          unlockAchievement(id);
          newlyUnlocked.push(achievement);
          
          console.log(`🏆 実績解除: ${title} - ${description}`);
          
          // 実績解除イベントを発行
          publish('achievementUnlocked', {
            id,
            title,
            description,
            achievement
          });
        }
      }
    }

    // 5. 新たに解除された実績がある場合はログ出力
    if (newlyUnlocked.length > 0) {
      console.log(`✨ ${newlyUnlocked.length}個の新しい実績を解除しました!`);
      
      // 複数の実績が同時に解除された場合の通知
      if (newlyUnlocked.length > 1) {
        publish('multipleAchievementsUnlocked', newlyUnlocked);
      }
    }

  } catch (error) {
    console.error('❌ 実績チェック中にエラーが発生しました:', error);
  }
}

/**
 * 実績解除時の効果音やUI表示を管理する関数
 * @param {Object} achievementData 解除された実績データ
 */
export function handleAchievementUnlocked(achievementData) {
  console.log(`🎉 実績「${achievementData.title}」を解除しました！`);
  
  // 効果音を再生
  publish('playSE', 'achievement');
  
  // 実績解除の通知UI表示
  // この部分は後でUIシステムと連携して実装
  console.log(`📜 ${achievementData.description}`);
}

/**
 * 解除済み実績の一覧を取得する
 * @returns {Promise<Array>} 解除済み実績の詳細データ配列
 */
export async function getUnlockedAchievements() {
  const achievements = await loadAchievements();
  const unlockedIds = Array.from(gameState.unlockedAchievements);
  
  return achievements.filter(achievement => 
    unlockedIds.includes(achievement.id)
  );
}

/**
 * 全実績の進捗状況を取得する
 * @returns {Promise<Object>} 実績の進捗情報
 */
export async function getAchievementProgress() {
  const achievements = await loadAchievements();
  const unlockedCount = gameState.unlockedAchievements.size;
  const totalCount = achievements.length;
  
  return {
    unlocked: unlockedCount,
    total: totalCount,
    percentage: totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0,
    achievements: achievements.map(achievement => ({
      ...achievement,
      unlocked: isAchievementUnlocked(achievement.id)
    }))
  };
}

export async function getAchievementById(id) {
  const achievements = await loadAchievements();
  return achievements.find(a => a.id === id) || null;
}


// デバッグ用：全ての実績を強制解除
export function unlockAllAchievements() {
  loadAchievements().then(achievements => {
    achievements.forEach(achievement => {
      unlockAchievement(achievement.id);
    });
    console.log('🏆 全ての実績を解除しました（デバッグ用）');
  });
} 