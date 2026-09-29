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
import { createPhotoRallyView } from './photoRally/photoRallyView.js';
import { buildPhotoRally } from './photoRally/photoRallyContent.js';
import { stageData, getKanjiById, getKanjiByGrade, getMonsterById } from '../loaders/dataLoader.js';
import { gotomonService } from './gotomonService.js';

// The rally is built from the loaded game data for the chosen stage.
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
});
