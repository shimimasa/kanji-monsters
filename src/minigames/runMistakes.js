// Per-run selection only. Persisted history remains the source of saved progress.
export function createRunMistakes({ sessionId, gameId }) {
  const mistakes = new Set(), observed = new Set();
  return {
    observe(event) {
      const id = event?.payload?.contentId, attempt = event?.payload?.attemptId;
      if (event?.sessionId !== sessionId || event?.gameId !== gameId ||
          !['correct', 'incorrect'].includes(event?.type) || typeof id !== 'string' || !id ||
          typeof attempt !== 'string' || !attempt || observed.has(attempt)) return;
      observed.add(attempt);
      if (event.type === 'incorrect') mistakes.add(id);
      else mistakes.delete(id);
    },
    ids: () => [...mistakes],
  };
}
