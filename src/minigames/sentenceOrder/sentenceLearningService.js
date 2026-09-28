import { createWordLearningService } from '../wordLearningService.js';
import { SENTENCE_ORDER_FIXTURE, SENTENCE_CHALLENGE_FIXTURE } from './sentenceOrderQuestions.js';

export function createSentenceLearningService(options = {}) {
  return createWordLearningService({ ...options, storageKey: 'sentenceLearning', gameId: 'sentenceOrder',
    contentIds: [...SENTENCE_ORDER_FIXTURE, ...SENTENCE_CHALLENGE_FIXTURE].map(entry => entry.fixtureId) });
}
export const sentenceLearningService = createSentenceLearningService();
