import { createMathSprintGame } from './mathSprint/mathSprintGame.js';
import { createMathSprintView } from './mathSprint/mathSprintView.js';
import { createMathInvaderGame } from './mathInvader/mathInvaderGame.js';
import { createMathInvaderView } from './mathInvader/mathInvaderView.js';

function withCommandAdapter(createView) {
  return context => createView({
    ...context,
    onSubmit: payload => context.dispatch({ type: 'submit', payload }),
    onNext: (sessionId, problemId) => context.dispatch({
      type: 'next', payload: { sessionId, problemId },
    }),
    onSelect: payload => context.dispatch({ type: 'select', payload }),
  });
}

export const miniGameRegistry = Object.freeze({
  mathSprint: Object.freeze({ id: 'mathSprint', title: 'けいさんスプリント',
    create: createMathSprintGame, createView: withCommandAdapter(createMathSprintView) }),
  mathInvader: Object.freeze({ id: 'mathInvader', title: 'けいさんインベーダー',
    create: createMathInvaderGame, createView: withCommandAdapter(createMathInvaderView) }),
});
