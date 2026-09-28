import { createWordLearningService } from '../wordLearningService.js';
import { ENGLISH_CHOICE_FIXTURE } from './englishChoiceQuestions.js';

export function createEnglishLearningService(options = {}) {
  return createWordLearningService({ ...options, storageKey: 'englishLearning', gameId: 'englishChoice',
    contentIds: ENGLISH_CHOICE_FIXTURE.map(entry => entry.id) });
}
export const englishLearningService = createEnglishLearningService();
