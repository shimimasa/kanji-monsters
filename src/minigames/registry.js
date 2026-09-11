import { createMathSprintGame } from './mathSprint/mathSprintGame.js';

export const miniGameRegistry = Object.freeze({
  mathSprint: Object.freeze({ id: 'mathSprint', title: 'けいさんスプリント', create: createMathSprintGame }),
});
