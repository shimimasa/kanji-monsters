// Nonpersistent Core. Deliveries (a Gotomon who wants to go home, a hint about its
// prefecture and four prefectures to choose from) come from the caller. The child
// picks the prefecture on the map and the companion flies the parcel there. A wrong
// prefecture sends the parcel back with the place's name, the right one glows, and
// the Gotomon waits until it is home. No game over. Each prefecture reached gets a
// stamp on the map. One learning result per delivery, on the first try; each try is
// its own problem id so the Host's feedback timing restarts.
export function createDeliveryGame({ sessionId, onEvent = () => {}, content }) {
  const deliveries = content?.deliveries ?? null, region = content?.regionId ?? 'all';
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, index = 0, tries = 0, trySerial = 0;
  let answered = 0, correct = 0, incorrect = 0, delivered = 0;
  let result = null, lastAnswer = null, aborted = false, completeEmitted = false, problem = null, attemptId = null, hintPrefecture = null;
  const missed = [], stamps = [];

  const current = () => deliveries?.[index] ?? null;
  const snapshot = () => Object.freeze({
    gameId: 'gotomonDelivery', mode: 'delivery', sessionId, phase, paused, active, aborted, seq, activeElapsedMs, regionId: region,
    delivery: current(), deliveryIndex: index, total: deliveries ? deliveries.length : 0, delivered, stamps: Object.freeze([...stamps]), hintPrefecture,
    problem, attemptId, answered, correct, incorrect, result, lastAnswer, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonDelivery', sessionId, seq: ++seq, type,
      problemId: problem?.problemId ?? null, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  const openTry = () => {
    const item = current();
    problem = Object.freeze({ problemId: `${item.deliveryId}:${tries}`, contentId: item.monsterId, skillId: `social.prefecture:${item.prefecture}`,
      prompt: item.hint, choices: Object.freeze(item.candidates.map(name => Object.freeze({ choiceId: name, text: name }))), correctChoiceId: item.prefecture });
    attemptId = `${problem.problemId}:attempt`; lastAnswer = null; phase = 'answering';
  };
  const startDelivery = at => {
    index = at; tries = 0; hintPrefecture = null;
    notify('problemPresented', { skillId: `social.prefecture:${current().prefecture}` });
    openTry();
  };
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null; hintPrefecture = null;
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, delivered, stamps: new Set(stamps).size, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !Array.isArray(deliveries) || !deliveries.length
        || deliveries.some(item => !item.candidates?.includes(item.prefecture))) return false;
      startDelivery(0); return true;
    },
    update(dtMs) {
      if (!active || paused || ['ready', 'completed'].includes(phase) || !Number.isFinite(dtMs)) return;
      activeElapsedMs += Math.max(0, dtMs);
    },
    setPaused(value) { if (active) paused = !!value; },
    deliver({ sessionId: sourceSession, attemptId: sourceAttempt, prefecture } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || sourceSession !== sessionId || sourceAttempt !== attemptId) return false;
      const item = current();
      if (!item.candidates.includes(prefecture)) return false;
      const right = prefecture === item.prefecture, first = tries === 0;
      const committedAttempt = attemptId; attemptId = null; phase = 'feedback';
      if (first) { answered++; if (right) correct++; else incorrect++; }
      if (right) { delivered++; stamps.push(item.prefecture); hintPrefecture = null; }
      else {
        tries++; hintPrefecture = item.prefecture;
        if (first) missed.push(Object.freeze({ contentId: item.monsterId, name: item.name, prefecture: item.prefecture, chosen: prefecture, questionNumber: answered }));
      }
      lastAnswer = Object.freeze({ attemptId: committedAttempt, try: ++trySerial, choiceId: prefecture, correctChoiceId: item.prefecture,
        correct: right, first, name: item.name, prefecture: item.prefecture, chosen: prefecture, fact: item.fact });
      const payload = { attemptId: committedAttempt, choiceId: prefecture, correctChoiceId: item.prefecture, contentId: item.monsterId,
        skillId: `social.prefecture:${item.prefecture}` };
      // One learning result per delivery: the first try. Later tries are just flying.
      if (first) notify(right ? 'correct' : 'incorrect', payload);
      else notify(right ? 'delivered' : 'retry', payload);
      return true;
    },
    next({ sessionId: sourceSession } = {}) {
      if (!active || paused || notifying || sourceSession !== sessionId || phase !== 'feedback') return false;
      if (lastAnswer?.correct) {
        if (index + 1 >= deliveries.length) { complete(); return true; }
        startDelivery(index + 1); return true;
      }
      openTry();
      return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'deliver') return this.deliver(command.payload);
      if (command.type === 'next') return this.next(command.payload);
      return false;
    },
    snapshot,
    exit() {
      if (!active) return;
      active = false; attemptId = null; aborted = phase !== 'completed'; observer = null;
    },
  };
}
