import { createMathSprintGame } from './mathSprint/mathSprintGame.js';
import { shortCourseCount } from './courseLength.js';
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
import { createDrumGame } from './gotomonDrum/drumGame.js';
import { createDrumView } from './gotomonDrum/drumView.js';
import { buildDrumQuestions } from './gotomonDrum/drumContent.js';
import { createRaceGame } from './gotomonRace/raceGame.js';
import { createRaceView } from './gotomonRace/raceView.js';
import { createMergeGame } from './gotomonMerge/mergeGame.js';
import { createMergeView } from './gotomonMerge/mergeView.js';
import { createLinkGame } from './gotomonLink/linkGame.js';
import { createLinkView } from './gotomonLink/linkView.js';
import { buildLinkRounds } from './gotomonLink/linkContent.js';
import { createOthelloGame } from './gotomonOthello/othelloGame.js';
import { createOthelloView } from './gotomonOthello/othelloView.js';
import { createSeekGame } from './gotomonSeek/seekGame.js';
import { createSeekView } from './gotomonSeek/seekView.js';
import { createMazeGame } from './gotomonMaze/mazeGame.js';
import { createMazeView } from './gotomonMaze/mazeView.js';
import { createJumpGame } from './gotomonJump/jumpGame.js';
import { createJumpView } from './gotomonJump/jumpView.js';
import { createTagGame } from './gotomonTag/tagGame.js';
import { createTagView } from './gotomonTag/tagView.js';
import { createGolfGame } from './gotomonGolf/golfGame.js';
import { createGolfView } from './gotomonGolf/golfView.js';
import { createHopGame } from './gotomonHop/hopGame.js';
import { createHopView } from './gotomonHop/hopView.js';
import { createLandGame } from './gotomonLand/landGame.js';
import { createLandView } from './gotomonLand/landView.js';
import { createTraceGame } from './gotomonTrace/traceGame.js';
import { createTraceView } from './gotomonTrace/traceView.js';
import { createHistoryGame } from './historyBuild/historyGame.js';
import { createHistoryView } from './historyBuild/historyView.js';
import { createPushGame } from './gotomonPush/pushGame.js';
import { createPushView } from './gotomonPush/pushView.js';
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
// The slash game, the race, hide-and-seek, the maze, the jump and tag: kanji readings from the stage reached last, English words, or sums.
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
const shortSlashContent = (context, gameId) => {
  const content = slashContent(context);
  return context.courseLength === 'short' && content?.problems
    ? { ...content, problems: content.problems.slice(0, shortCourseCount(gameId)) } : content;
};
const shortContent = (context, gameId, content, key) => context.courseLength === 'short' && Array.isArray(content?.[key])
  ? { ...content, [key]: content[key].slice(0, shortCourseCount(gameId)) } : content;
// The drum asks そう？ちがう？ about kanji readings from the stage reached last, English words, or sums.
const drumContent = ({ sessionId, random, mode, focusKanjiIds }) => {
  const kind = ['english', 'math'].includes(mode) ? mode : 'kanji';
  if (kind !== 'kanji') return { mode: kind, questions: buildDrumQuestions({ sessionId, random, mode: kind }) };
  let visited = ['hokkaido_area1'];
  try { visited = gotomonService.getVisitedStageIds?.() ?? visited; } catch { /* keep Hokkaido */ }
  const stage = [...visited].reverse().map(id => stageData.find(item => item.stageId === id)).find(Boolean)
    ?? stageData.find(item => item.stageId === 'hokkaido_area1');
  return { mode: kind, questions: stage ? buildDrumQuestions({ sessionId, random, mode: kind, focusKanjiIds,
    stageKanji: (stage.kanjiPoolIdList || []).map(getKanjiById).filter(Boolean), gradeKanji: getKanjiByGrade(stage.grade) || [] }) : null };
};
// The lines join kanji of the stage reached last (読み, then 意味), English words, or sums.
const linkContent = ({ random, mode, focusKanjiIds }) => {
  const kind = ['english', 'math'].includes(mode) ? mode : 'kanji';
  if (kind !== 'kanji') return { mode: kind, rounds: buildLinkRounds({ random, mode: kind }) };
  let visited = ['hokkaido_area1'];
  try { visited = gotomonService.getVisitedStageIds?.() ?? visited; } catch { /* keep Hokkaido */ }
  const stage = [...visited].reverse().map(id => stageData.find(item => item.stageId === id)).find(Boolean)
    ?? stageData.find(item => item.stageId === 'hokkaido_area1');
  return { mode: kind, rounds: stage ? buildLinkRounds({ random, mode: kind, focusKanjiIds,
    stageKanji: (stage.kanjiPoolIdList || []).map(getKanjiById).filter(Boolean), gradeKanji: getKanjiByGrade(stage.grade) || [] }) : null };
};
// Othello asks kanji readings of the stage reached last: two sets of the slash game's
// problems, so a long game does not run out.
const othelloContent = ({ sessionId, random, focusKanjiIds }) => {
  let visited = ['hokkaido_area1'];
  try { visited = gotomonService.getVisitedStageIds?.() ?? visited; } catch { /* keep Hokkaido */ }
  const stage = [...visited].reverse().map(id => stageData.find(item => item.stageId === id)).find(Boolean)
    ?? stageData.find(item => item.stageId === 'hokkaido_area1');
  if (!stage) return null;
  const kanji = { mode: 'kanji', focusKanjiIds, stageKanji: (stage.kanjiPoolIdList || []).map(getKanjiById).filter(Boolean), gradeKanji: getKanjiByGrade(stage.grade) || [] };
  const first = buildSlashProblems({ sessionId: `${sessionId}:a`, random, ...kanji }), second = buildSlashProblems({ sessionId: `${sessionId}:b`, random, ...kanji });
  return first && second ? { problems: [...first, ...second] } : null;
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
    create: context => createTossGame({ ...context, content: shortContent(context, 'gotomonToss', tossContent(context), 'problems') }), createView: createTossView }),
  gotomonFishing: Object.freeze({ id: 'gotomonFishing', title: 'ゴトモンつり',
    create: context => createFishGame({ ...context, content: shortContent(context, 'gotomonFishing', fishContent(context), 'problems') }), createView: createFishView }),
  gotomonDelivery: Object.freeze({ id: 'gotomonDelivery', title: 'ゴトモン宅配便',
    create: context => createDeliveryGame({ ...context, content: shortContent(context, 'gotomonDelivery', deliveryContent(context), 'deliveries') }), createView: createDeliveryView }),
  gotomonBubble: Object.freeze({ id: 'gotomonBubble', title: 'ゴトモン・バブル',
    create: context => createBubbleGame({ ...context, content: bubbleContent(context) }), createView: createBubbleView }),
  gotomonPuyo: Object.freeze({ id: 'gotomonPuyo', title: 'けいさんぷよ',
    create: context => createPuyoGame({ ...context, content: { level: context.mathLevel === 'times' ? 'times' : 'addsub' } }), createView: createPuyoView }),
  gotomonShooter: Object.freeze({ id: 'gotomonShooter', title: 'ゴトモン・シューター',
    create: context => createShooterGame({ ...context, content: shortContent(context, 'gotomonShooter', shooterContent(context), 'waves') }), createView: createShooterView }),
  gotomonBreakout: Object.freeze({ id: 'gotomonBreakout', title: 'ゴトモン・ブロックくずし',
    create: context => createBreakoutGame({ ...context, content: { level: context.mathLevel === 'times' ? 'times' : 'addsub' } }), createView: createBreakoutView }),
  gotomonMeteor: Object.freeze({ id: 'gotomonMeteor', title: 'いん石げいげき',
    create: context => createMeteorGame({ ...context, content: { level: context.mathLevel === 'times' ? 'times' : 'addsub' } }), createView: createMeteorView }),
  gotomonSnake: Object.freeze({ id: 'gotomonSnake', title: 'スペルスネーク',
    create: context => createSnakeGame({ ...context, content: null }), createView: createSnakeView }),
  gotomonParts: Object.freeze({ id: 'gotomonParts', title: '漢字パーツ落とし',
    create: context => createPartsGame({ ...context, content: { mode: context.mode === 'all' ? 'all' : 'easy' } }), createView: createPartsView }),
  gotomonSlash: Object.freeze({ id: 'gotomonSlash', title: 'ゴトモン・スラッシュ',
    create: context => createSlashGame({ ...context, content: shortSlashContent(context, 'gotomonSlash') }), createView: createSlashView }),
  gotomonColoring: Object.freeze({ id: 'gotomonColoring', title: 'ゴトモンぬりえ',
    create: context => createColoringGame({ ...context, content: coloringContent(context) }), createView: createColoringView }),
  gotomonDrum: Object.freeze({ id: 'gotomonDrum', title: 'ゴトモン・リズムたいこ',
    create: context => createDrumGame({ ...context, content: shortContent(context, 'gotomonDrum', drumContent(context), 'questions') }), createView: createDrumView }),
  gotomonRace: Object.freeze({ id: 'gotomonRace', title: 'ゴトモン・レース',
    create: context => createRaceGame({ ...context, content: shortSlashContent(context, 'gotomonRace') }), createView: createRaceView }),
  gotomonMerge: Object.freeze({ id: 'gotomonMerge', title: 'けいさん2048',
    create: context => createMergeGame({ ...context, content: { level: context.mathLevel === 'times' ? 'times' : 'addsub' } }), createView: createMergeView }),
  gotomonLink: Object.freeze({ id: 'gotomonLink', title: '線つなぎ',
    create: context => createLinkGame({ ...context, content: linkContent(context) }), createView: createLinkView }),
  gotomonOthello: Object.freeze({ id: 'gotomonOthello', title: '漢字オセロ',
    create: context => createOthelloGame({ ...context, content: othelloContent(context) }), createView: createOthelloView }),
  gotomonSeek: Object.freeze({ id: 'gotomonSeek', title: 'ゴトモンさがし',
    create: context => createSeekGame({ ...context, content: shortSlashContent(context, 'gotomonSeek') }), createView: createSeekView }),
  gotomonMaze: Object.freeze({ id: 'gotomonMaze', title: 'ゴトモン迷路',
    create: context => createMazeGame({ ...context, content: slashContent(context) }), createView: createMazeView }),
  gotomonJump: Object.freeze({ id: 'gotomonJump', title: 'ゴトモン・ジャンプ',
    create: context => createJumpGame({ ...context, content: shortSlashContent(context, 'gotomonJump') }), createView: createJumpView }),
  gotomonTag: Object.freeze({ id: 'gotomonTag', title: 'ゴトモンおにごっこ',
    create: context => createTagGame({ ...context, content: shortSlashContent(context, 'gotomonTag') }), createView: createTagView }),
  gotomonGolf: Object.freeze({ id: 'gotomonGolf', title: 'ゴトモン・ミニゴルフ',
    create: context => createGolfGame({ ...context, content: shortSlashContent(context, 'gotomonGolf') }), createView: createGolfView }),
  gotomonHop: Object.freeze({ id: 'gotomonHop', title: 'ゴトモン・川わたり',
    create: context => createHopGame({ ...context, content: shortSlashContent(context, 'gotomonHop') }), createView: createHopView }),
  gotomonLand: Object.freeze({ id: 'gotomonLand', title: 'ゴトモン・ぼうけんランド',
    create: context => createLandGame({ ...context, content: shortSlashContent(context, 'gotomonLand') }), createView: createLandView }),
  gotomonTrace: Object.freeze({ id: 'gotomonTrace', title: 'ゴトモン・もじなぞり',
    create: context => createTraceGame({ ...context, content: shortSlashContent(context, 'gotomonTrace') }), createView: createTraceView }),
  gotomonPush: Object.freeze({ id: 'gotomonPush', title: 'ゴトモン・おしだし',
    create: context => createPushGame({ ...context, content: slashContent(context) }), createView: createPushView }),
  historyBuild: Object.freeze({ id: 'historyBuild', title: 'れきしのカードづくり',
    create: createHistoryGame, createView: createHistoryView }),
});
