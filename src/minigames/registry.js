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
    create: createMathSprintGame, createView: withCommandAdapter(createMathSprintView) }),
  mathInvader: Object.freeze({ id: 'mathInvader', title: 'けいさんインベーダー',
    create: createMathInvaderGame, createView: withCommandAdapter(createMathInvaderView) }),
  englishChoice: Object.freeze({ id: 'englishChoice', title: 'えいたんご4たく',
    create: createEnglishChoiceGame, createView: withCommandAdapter(createEnglishChoiceView) }),
  sentenceOrder: Object.freeze({ id: 'sentenceOrder', title: '文ならべ',
    create: createSentenceOrderGame, createView: createSentenceOrderView }),
  timedChoice: Object.freeze({ id: 'timedChoice', title: 'タイムことば',
    create: createTimedChoiceGame, createView: withCommandAdapter(createTimedChoiceView) }),
  multiSelect: Object.freeze({ id: 'multiSelect', title: 'えらんで完成',
    create: createMultiSelectGame, createView: createMultiSelectView }),
});
