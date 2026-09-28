import { createWordLearningService } from '../wordLearningService.js';
import { TIMED_CHOICE_FIXTURE } from './timedChoiceQuestions.js';

export function createTimedLearningService(options = {}) {
  return createWordLearningService({ ...options, storageKey: 'timedLearning', gameId: 'timedChoice', trackTimeouts: true,
    contentIds: TIMED_CHOICE_FIXTURE.map(entry => entry.fixtureId) });
}
export const timedLearningService = createTimedLearningService();
