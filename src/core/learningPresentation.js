export function getQuizResultSummary(answers = [], total = answers.length) {
  const correct = answers.filter(item => item?.ok);
  const independent = correct.filter(item => item.support === 'independent');
  return {
    total,
    correctInputs: correct.length,
    independentCorrect: independent.length,
    independentKanjiIds: [...new Set(independent.map(item => item.id).filter(Boolean))].slice(0, 3),
  };
}

