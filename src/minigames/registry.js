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
import { createDeliveryGame } from './gotomonDelivery/deliveryGame.js';
import { createDeliveryView } from './gotomonDelivery/deliveryView.js';
import { buildDeliveries } from './gotomonDelivery/deliveryContent.js';
import { createBubbleGame, BUBBLE_RULES } from './gotomonBubble/bubbleGame.js';
import { createBubbleView } from './gotomonBubble/bubbleView.js';
import { createPuyoGame } from './gotomonPuyo/puyoGame.js';
import { createPuyoView } from './gotomonPuyo/puyoView.js';
import { createShooterGame } from './gotomonShooter/shooterGame.js';
import { createShooterView } from './gotomonShooter/shooterView.js';
import { buildShooterWaves } from './gotomonShooter/shooterContent.js';
import { createBreakoutGame } from './gotomonBreakout/breakoutGame.js';
import { createBreakoutView } from './gotomonBreakout/breakoutView.js';
import { createMeteorGame } from './gotomonMeteor/meteorGame.js';
import { createMeteorView } from './gotomonMeteor/meteorView.js';
import { createSnakeGame } from './gotomonSnake/snakeGame.js';
import { createSnakeView } from './gotomonSnake/snakeView.js';
import { createPartsGame } from './gotomonParts/partsGame.js';
import { createPartsView } from './gotomonParts/partsView.js';
import { createSlashGame } from './gotomonSlash/slashGame.js';
import { createSlashView } from './gotomonSlash/slashView.js';
import { buildSlashProblems } from './gotomonSlash/slashContent.js';
import { createColoringGame } from './gotomonColoring/coloringGame.js';
import { createColoringView } from './gotomonColoring/coloringView.js';
import { COLORING_PICTURES as coloringPictures } from './gotomonColoring/pictures.js';
import { createPhotoRallyView } from './photoRally/photoRallyView.js';
import { buildPhotoRally } from './photoRally/photoRallyContent.js';
import { stageData, getKanjiById, getKanjiByGrade, getMonsterById, getAllMonsterIds } from '../loaders/dataLoader.js';
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
// The trapped Gotomon are the child's own (Hokkaido's fill in); the board is built by the Core.
const bubbleContent = ({ random, mathLevel }) => ({ level: mathLevel === 'times' ? 'times' : 'addsub', carriers: playfulGotomon(random, BUBBLE_RULES.trapped) });
// The shooter asks English words, or readings of kanji from the stage the child
// reached most recently; each reading on a plate fits only one of the chosen kanji.
const shooterContent = ({ sessionId, random, mode, focusKanjiIds }) => {
  if (mode !== 'kanji') return { mode: 'english', waves: buildShooterWaves({ sessionId, random, mode: 'english' }) };
  let visited = ['hokkaido_area1'];
  try { visited = gotomonService.getVisitedStageIds?.() ?? visited; } catch { /* keep Hokkaido */ }
  const stage = [...visited].reverse().map(id => stageData.find(item => item.stageId === id)).find(Boolean)
    ?? stageData.find(item => item.stageId === 'hokkaido_area1');
  return { mode: 'kanji', waves: stage ? buildShooterWaves({ sessionId, random, mode: 'kanji', focusKanjiIds,
    stageKanji: (stage.kanjiPoolIdList || []).map(getKanjiById).filter(Boolean), gradeKanji: getKanjiByGrade(stage.grade) || [] }) : null };
};
// The slash game: kanji readings from the stage reached last, English words, or sums.
const slashContent = ({ sessionId, random, mode, focusKanjiIds }) => {
  const kind = ['english', 'math'].includes(mode) ? mode : 'kanji';
  if (kind !== 'kanji') return { mode: kind, problems: buildSlashProblems({ sessionId, random, mode: kind }) };
  let visited = ['hokkaido_area1'];
  try { visited = gotomonService.getVisitedStageIds?.() ?? visited; } catch { /* keep Hokkaido */ }
  const stage = [...visited].reverse().map(id => stageData.find(item => item.stageId === id)).find(Boolean)
    ?? stageData.find(item => item.stageId === 'hokkaido_area1');
  return { mode: kind, problems: stage ? buildSlashProblems({ sessionId, random, mode: kind, focusKanjiIds,
    stageKanji: (stage.kanjiPoolIdList || []).map(getKanjiById).filter(Boolean), gradeKanji: getKanjiByGrade(stage.grade) || [] }) : null };
};
// The colouring picture is a Gotomon the child has caught, else one met on the
// stages visited, else any; its grid of three colours was made from its image.
const coloringContent = ({ random, mathLevel }) => {
  const has = id => Object.hasOwn(coloringPictures, id) && getMonsterById(id);
  let owned = [], visited = ['hokkaido_area1'];
  try { owned = gotomonService.getOwnedGotomon().map(item => item.id).filter(has); } catch { owned = []; }
  try { visited = gotomonService.getVisitedStageIds?.() ?? visited; } catch { /* keep Hokkaido */ }
  const met = visited.flatMap(id => stageData.find(item => item.stageId === id)?.enemyIdList || []).filter(has);
  const pool = owned.length ? owned : met.length ? met : Object.keys(coloringPictures).filter(has);
  if (!pool.length) return null;
  const id = pool[Math.floor(random() * pool.length)], [grid, ...palette] = coloringPictures[id];
  return { level: mathLevel === 'times' ? 'times' : 'addsub',
    picture: { id, name: getMonsterById(id).name, grid, palette, imageUrl: gotomonService.getGotomonById(id).imageUrl } };
};
// Gotomon from every prefecture ask to be taken home; hints come from their notes.
const deliveryContent = ({ sessionId, random, region }) => {
  const monsters = getAllMonsterIds().map(id => getMonsterById(id)).filter(Boolean);
  const regionId = region || 'all';
  const deliveries = buildDeliveries({ sessionId, random, monsters, regionId });
  return { regionId, deliveries: deliveries && deliveries.map(item => ({ ...item, imageUrl: gotomonService.getGotomonById(item.monsterId).imageUrl })) };
};
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
  gotomonDelivery: Object.freeze({ id: 'gotomonDelivery', title: 'ゴトモン宅配便',
    create: context => createDeliveryGame({ ...context, content: deliveryContent(context) }), createView: createDeliveryView }),
  gotomonBubble: Object.freeze({ id: 'gotomonBubble', title: 'ゴトモン・バブル',
    create: context => createBubbleGame({ ...context, content: bubbleContent(context) }), createView: createBubbleView }),
  gotomonPuyo: Object.freeze({ id: 'gotomonPuyo', title: 'けいさんぷよ',
    create: context => createPuyoGame({ ...context, content: { level: context.mathLevel === 'times' ? 'times' : 'addsub' } }), createView: createPuyoView }),
  gotomonShooter: Object.freeze({ id: 'gotomonShooter', title: 'ゴトモン・シューター',
    create: context => createShooterGame({ ...context, content: shooterContent(context) }), createView: createShooterView }),
  gotomonBreakout: Object.freeze({ id: 'gotomonBreakout', title: 'ゴトモン・ブロックくずし',
    create: context => createBreakoutGame({ ...context, content: { level: context.mathLevel === 'times' ? 'times' : 'addsub' } }), createView: createBreakoutView }),
  gotomonMeteor: Object.freeze({ id: 'gotomonMeteor', title: 'いん石げいげき',
    create: context => createMeteorGame({ ...context, content: { level: context.mathLevel === 'times' ? 'times' : 'addsub' } }), createView: createMeteorView }),
  gotomonSnake: Object.freeze({ id: 'gotomonSnake', title: 'スペルスネーク',
    create: context => createSnakeGame({ ...context, content: null }), createView: createSnakeView }),
  gotomonParts: Object.freeze({ id: 'gotomonParts', title: '漢字パーツ落とし',
    create: context => createPartsGame({ ...context, content: { mode: context.mode === 'all' ? 'all' : 'easy' } }), createView: createPartsView }),
  gotomonSlash: Object.freeze({ id: 'gotomonSlash', title: 'ゴトモン・スラッシュ',
    create: context => createSlashGame({ ...context, content: slashContent(context) }), createView: createSlashView }),
  gotomonColoring: Object.freeze({ id: 'gotomonColoring', title: 'ゴトモンぬりえ',
    create: context => createColoringGame({ ...context, content: coloringContent(context) }), createView: createColoringView }),
});
