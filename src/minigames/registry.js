import { createMathSprintGame } from './mathSprint/mathSprintGame.js';
import { createMathSprintView } from './mathSprint/mathSprintView.js';
import { createMathInvaderGame } from './mathInvader/mathInvaderGame.js';
import { createMathInvaderView } from './mathInvader/mathInvaderView.js';

export const miniGameRegistry = Object.freeze({
  mathSprint: Object.freeze({ id: 'mathSprint', title: 'けいさんスプリント',
    create: createMathSprintGame, createView: createMathSprintView }),
  mathInvader: Object.freeze({ id: 'mathInvader', title: 'けいさんインベーダー',
    create: createMathInvaderGame, createView: createMathInvaderView }),
});
