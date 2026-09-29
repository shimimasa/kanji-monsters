import { createMathSprintGame } from './mathSprint/mathSprintGame.js';
import { createMathSprintView } from './mathSprint/mathSprintView.js';
import { createMathInvaderGame } from './mathInvader/mathInvaderGame.js';
import { createMathInvaderView } from './mathInvader/mathInvaderView.js';
import { createEnglishChoiceGame } from './englishChoice/englishChoiceGame.js';
import { createEnglishChoiceView } from './englishChoice/englishChoiceView.js';
import { createSentenceOrderGame } from './sentenceOrder/sentenceOrderGame.js';
import { createSentenceOrderView } from './sentenceOrder/sentenceOrderView.js';
import { createTimedChoiceGame } from './timedChoice/timedChoiceGame.js';
import { createTimedChoiceView } from './timedChoice/timedChoiceView.js';
import { createMultiSelectGame } from './multiSelect/multiSelectGame.js';
import { createMultiSelectView } from './multiSelect/multiSelectView.js';
import { createAsyncChoiceGame } from './asyncChoice/asyncChoiceGame.js';
import { createAsyncChoiceView } from './asyncChoice/asyncChoiceView.js';
import { createKanjiDefenseGame } from './kanjiDefense/kanjiDefenseGame.js';
import { createKanjiDefenseView } from './kanjiDefense/kanjiDefenseView.js';
import { createPhotoRallyGame } from './photoRally/photoRallyGame.js';
import { createProverbDetectiveGame } from './proverbDetective/proverbDetectiveGame.js';
import { createProverbDetectiveView } from './proverbDetective/proverbDetectiveView.js';
import { createTripGame } from './tripSugoroku/tripGame.js';
import { createTripView } from './tripSugoroku/tripView.js';
import { readingPool } from './photoRally/photoRallyContent.js';
import { createBingoGame } from './kanjiBingo/bingoGame.js';
import { createBingoView } from './kanjiBingo/bingoView.js';
import { buildBingoCard } from './kanjiBingo/bingoContent.js';
import { createMemoryGame } from './kanjiMemory/memoryGame.js';
import { createMemoryView } from './kanjiMemory/memoryView.js';
import { buildMemoryRounds } from './kanjiMemory/memoryContent.js';
import { createShopGame } from './gotomonShop/shopGame.js';
import { createShopView } from './gotomonShop/shopView.js';
import { createSortGame } from './kanjiSort/sortGame.js';
import { createSortView } from './kanjiSort/sortView.js';
import { buildSortPuzzles } from './kanjiSort/sortContent.js';
import { createTossGame } from './gotomonToss/tossGame.js';
import { createTossView } from './gotomonToss/tossView.js';
import { buildTossProblems, TOSS_BASKETS } from './gotomonToss/tossContent.js';
import { createFishGame } from './gotomonFishing/fishGame.js';
import { createFishView } from './gotomonFishing/fishView.js';
import { buildFishProblems, FISH_SWIMMERS } from './gotomonFishing/fishContent.js';
import { createPhotoRallyView } from './photoRally/photoRallyView.js';
import { buildPhotoRally } from './photoRally/photoRallyContent.js';
import { stageData, getKanjiById, getKanjiByGrade, getMonsterById } from '../loaders/dataLoader.js';
import { gotomonService } from './gotomonService.js';

// The rally is built from the loaded game data for the chosen stage.
// The trip crosses the chosen stage and ends at its boss monster.
const tripContent = ({ random, stageId, focusKanjiIds }) => {
  const stage = stageData.find(item => item.stageId === stageId) ?? stageData.find(item => item.stageId === 'hokkaido_area1');
  if (!stage) return null;
  const monsters = (stage.enemyIdList || []).map(getMonsterById).filter(Boolean)
    .map(monster => ({ id: monster.id, name: monster.name, isBoss: !!monster.isBoss, imageUrl: gotomonService.getGotomonById(monster.id).imageUrl }));
  const boss = monsters.find(monster => monster.isBoss) ?? monsters.at(-1);
  return { stage: { stageId: stage.stageId, name: stage.name, grade: stage.grade }, focusKanjiIds,
    boss: boss ? { monsterId: boss.id, name: boss.name, imageUrl: boss.imageUrl } : null,
    monsters: monsters.filter(monster => monster !== boss),
    readings: readingPool({ random, focusKanjiIds, stageKanji: (stage.kanjiPoolIdList || []).map(getKanjiById).filter(Boolean),
      gradeKanji: getKanjiByGrade(stage.grade) || [] }) };
};
// The bingo card comes from the chosen stage's kanji (the grade's fill the rest).
const bingoContent = ({ random, stageId, focusKanjiIds }) => {
  const stage = stageData.find(item => item.stageId === stageId) ?? stageData.find(item => item.stageId === 'hokkaido_area1');
  if (!stage) return null;
  return { stage: { stageId: stage.stageId, name: stage.name, grade: stage.grade },
    card: buildBingoCard({ random, focusKanjiIds, stageKanji: (stage.kanjiPoolIdList || []).map(getKanjiById).filter(Boolean),
      gradeKanji: getKanjiByGrade(stage.grade) || [] }) };
};
// The memory cards come from the chosen stage's kanji too.
const memoryContent = ({ random, stageId, focusKanjiIds }) => {
  const stage = stageData.find(item => item.stageId === stageId) ?? stageData.find(item => item.stageId === 'hokkaido_area1');
  if (!stage) return null;
  return { stage: { stageId: stage.stageId, name: stage.name, grade: stage.grade },
    rounds: buildMemoryRounds({ random, focusKanjiIds, stageKanji: (stage.kanjiPoolIdList || []).map(getKanjiById).filter(Boolean),
      gradeKanji: getKanjiByGrade(stage.grade) || [] }) };
};
// The puzzle cards come from the chosen stage's kanji too.
const sortContent = ({ random, stageId, focusKanjiIds }) => {
  const stage = stageData.find(item => item.stageId === stageId) ?? stageData.find(item => item.stageId === 'hokkaido_area1');
  if (!stage) return null;
  return { stage: { stageId: stage.stageId, name: stage.name, grade: stage.grade },
    puzzles: buildSortPuzzles({ random, focusKanjiIds, stageKanji: (stage.kanjiPoolIdList || []).map(getKanjiById).filter(Boolean),
      gradeKanji: getKanjiByGrade(stage.grade) || [] }) };
};
// Gotomon who play along in the toss and the fishing: the child's own, with
// Hokkaido's filling in for a small collection.
const playfulGotomon = (random, count) => {
  let owned = [];
  try { owned = gotomonService.getOwnedGotomon().filter(item => item.imageUrl); } catch { owned = []; }
  const home = stageData.find(item => item.stageId === 'hokkaido_area1');
  const borrowed = (home?.enemyIdList || []).map(id => gotomonService.getGotomonById(id)).filter(item => item.imageUrl && !owned.some(own => own.id === item.id));
  const pool = [...owned, ...borrowed].slice(0, count * 3);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, count).map(item => ({ id: item.id, name: item.name, imageUrl: item.imageUrl }));
};
// The calculations are made for the run (たし算・ひき算 or かけ算).
const tossContent = ({ sessionId, random, mathLevel }) => ({ level: mathLevel === 'times' ? 'times' : 'addsub',
  carriers: playfulGotomon(random, TOSS_BASKETS), problems: buildTossProblems({ sessionId, random, level: mathLevel }) });
// The words come from the English vocabulary of 宝箱キャッチ.
const fishContent = ({ sessionId, random }) => ({ carriers: playfulGotomon(random, FISH_SWIMMERS), problems: buildFishProblems({ sessionId, random }) });
// The shop's customers are the chosen stage's Gotomon; its kanji use the bingo card's checked clues.
const shopContent = context => {
  const base = bingoContent(context);
  if (!base) return null;
  const stage = stageData.find(item => item.stageId === base.stage.stageId);
  const customers = (stage?.enemyIdList || []).map(getMonsterById).filter(Boolean)
    .map(monster => ({ id: monster.id, name: monster.name, imageUrl: gotomonService.getGotomonById(monster.id).imageUrl }));
  return { ...base, customers };
};
const photoRallyContent = ({ sessionId, random, stageId, focusKanjiIds }) => {
  const stage = stageData.find(item => item.stageId === stageId) ?? stageData.find(item => item.stageId === 'hokkaido_area1');
  if (!stage) return { stage: null, shots: [] };
  return buildPhotoRally({ sessionId, random, stage, focusKanjiIds,
    stageKanji: (stage.kanjiPoolIdList || []).map(getKanjiById).filter(Boolean),
    gradeKanji: getKanjiByGrade(stage.grade) || [],
    monsters: (stage.enemyIdList || []).map(getMonsterById).filter(Boolean).map(monster => ({ ...monster, imageUrl: gotomonService.getGotomonById(monster.id).imageUrl })) });
};

function withCommandAdapter(createView) {
  return context => createView({
    ...context,
    onSubmit: payload => context.dispatch({ type: 'submit', payload }),
    onNext: (sessionId, problemId) => context.dispatch({
      type: 'next', payload: { sessionId, problemId },
    }),
    onSelect: payload => context.dispatch({ type: 'select', payload }),
    onAnswer: payload => context.dispatch({ type: 'answer', payload }),
  });
}

export const miniGameRegistry = Object.freeze({
  mathSprint: Object.freeze({ id: 'mathSprint', title: 'けいさんスプリント',
    create: createMathSprintGame, createView: createMathSprintView }),
  mathInvader: Object.freeze({ id: 'mathInvader', title: 'けいさんインベーダー',
    create: createMathInvaderGame, createView: createMathInvaderView }),
  englishChoice: Object.freeze({ id: 'englishChoice', title: 'えいたんご4たく',
    create: createEnglishChoiceGame, createView: createEnglishChoiceView }),
  sentenceOrder: Object.freeze({ id: 'sentenceOrder', title: '文ならべ',
    create: createSentenceOrderGame, createView: createSentenceOrderView }),
  timedChoice: Object.freeze({ id: 'timedChoice', title: 'タイムことば',
    create: createTimedChoiceGame, createView: createTimedChoiceView }),
  multiSelect: Object.freeze({ id: 'multiSelect', title: 'えらんで完成',
    create: createMultiSelectGame, createView: createMultiSelectView }),
  asyncChoice: Object.freeze({ id: 'asyncChoice', title: 'よみこみクイズ',
    create: createAsyncChoiceGame, createView: createAsyncChoiceView }),
  kanjiDefense: Object.freeze({ id: 'kanjiDefense', title: '漢字防衛隊',
    create: createKanjiDefenseGame, createView: createKanjiDefenseView }),
  photoRally: Object.freeze({ id: 'photoRally', title: 'ゴトモン写真ラリー',
    create: context => createPhotoRallyGame({ ...context, content: photoRallyContent(context) }), createView: createPhotoRallyView }),
  proverbDetective: Object.freeze({ id: 'proverbDetective', title: 'ことわざ探偵',
    create: createProverbDetectiveGame, createView: createProverbDetectiveView }),
  tripSugoroku: Object.freeze({ id: 'tripSugoroku', title: '旅すごろく',
    create: context => createTripGame({ ...context, content: tripContent(context) }), createView: createTripView }),
  kanjiBingo: Object.freeze({ id: 'kanjiBingo', title: '漢字ビンゴ',
    create: context => createBingoGame({ ...context, content: bingoContent(context) }), createView: createBingoView }),
  kanjiMemory: Object.freeze({ id: 'kanjiMemory', title: '漢字カードめくり',
    create: context => createMemoryGame({ ...context, content: memoryContent(context) }), createView: createMemoryView }),
  gotomonShop: Object.freeze({ id: 'gotomonShop', title: 'ゴトモンのおねがい',
    create: context => createShopGame({ ...context, content: shopContent(context) }), createView: createShopView }),
  kanjiSort: Object.freeze({ id: 'kanjiSort', title: '漢字ならべパズル',
    create: context => createSortGame({ ...context, content: sortContent(context) }), createView: createSortView }),
  gotomonToss: Object.freeze({ id: 'gotomonToss', title: 'ゴトモン玉入れ',
    create: context => createTossGame({ ...context, content: tossContent(context) }), createView: createTossView }),
  gotomonFishing: Object.freeze({ id: 'gotomonFishing', title: 'ゴトモンつり',
    create: context => createFishGame({ ...context, content: fishContent(context) }), createView: createFishView }),
});
