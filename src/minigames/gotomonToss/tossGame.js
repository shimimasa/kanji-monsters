import { TOSS_BASKETS } from './tossContent.js';
import { equationTarget } from '../buildReview.js';

export const TOSS_RULES = Object.freeze({
  // Each Gotomon walks its own row; faster rows are nearer the thrower.
  rows: Object.freeze([0.28, 0.43, 0.58, 0.73]),
  speedsPerMs: Object.freeze([0.00007, 0.00009, 0.00011, 0.00013]),
  // Later problems walk a little faster; ゆっくり walks at a bit over half speed.
  speedUpPerProblem: 0.04,
  slowPaceFactor: 0.55,
  minX: 0.1, maxX: 0.9,
  maxSimulationStepMs: 100,
});

// Nonpersistent Core. Problems (a calculation and four basket numbers) and the
// Gotomon who carry the baskets come from the caller. The baskets never stop walking
// left and right; the child throws a ball by tapping the basket with the answer.
// A miss bounces off, the right basket glows, and the same problem stays until the
// ball goes in. There is no game over. One learning result per problem, on the first
// throw; each throw is its own problem id so the Host's feedback timing restarts.
export function createTossGame({ sessionId, random = Math.random, onEvent = () => {}, content, pace = 'normal' }) {
  const rules = TOSS_RULES, problems = content?.problems ?? null, carriers = content?.carriers ?? [];
  const paceFactor = pace === 'slow' ? rules.slowPaceFactor : 1;
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, index = 0, tries = 0, throwSerial = 0;
  let answered = 0, correct = 0, incorrect = 0, scored = 0;
  let result = null, lastAnswer = null, aborted = false, completeEmitted = false, problem = null, attemptId = null, hintBasketId = null;
  const missed = [];
  const baskets = Array.from({ length: TOSS_BASKETS }, (_, row) => {
    const carrier = carriers.length ? carriers[row % carriers.length] : null;
    const start = Math.min(Math.max(Number(random()) || 0, 0), .999999);
    return { basketId: `${sessionId}:basket:${row}`, row, y: rules.rows[row], x: rules.minX + start * (rules.maxX - rules.minX),
      dir: row % 2 ? -1 : 1, speed: rules.speedsPerMs[row], number: null, name: carrier?.name ?? 'ゴトモン', imageUrl: carrier?.imageUrl ?? '', balls: 0 };
  });

  const current = () => problems?.[index] ?? null;
  const basketById = basketId => baskets.find(basket => basket.basketId === basketId) ?? null;
  const snapshot = () => Object.freeze({
    gameId: 'gotomonToss', mode: 'toss', sessionId, phase, paused, active, aborted, seq, activeElapsedMs, pace: pace === 'slow' ? 'slow' : 'normal',
    baskets: Object.freeze(baskets.map(basket => Object.freeze({ ...basket }))), hintBasketId,
    problemIndex: index, total: problems ? problems.length : 0, scored,
    problem, attemptId, answered, correct, incorrect, result, lastAnswer, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonToss', sessionId, seq: ++seq, type,
      problemId: problem?.problemId ?? null, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  const openThrow = () => {
    const item = current();
    const answerBasket = baskets.find(basket => basket.number === item.answer);
    problem = Object.freeze({ problemId: `${item.problemId}:${tries}`, contentId: item.problemId, skillId: item.skillId,
      operation: item.operation, question: item.question, answer: item.answer,
      choices: Object.freeze(baskets.map(basket => Object.freeze({ choiceId: basket.basketId, text: String(basket.number) }))),
      correctChoiceId: answerBasket.basketId });
    attemptId = `${problem.problemId}:attempt`; lastAnswer = null; phase = 'answering';
  };
  const startProblem = at => {
    index = at; tries = 0; hintBasketId = null;
    current().numbers.forEach((number, row) => { baskets[row].number = number; });
    notify('problemPresented', { skillId: current().skillId, operation: current().operation });
    openThrow();
  };
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null; hintBasketId = null;
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, scored, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !Array.isArray(problems) || !problems.length
        || problems.some(item => item.numbers?.length !== TOSS_BASKETS || !item.numbers.includes(item.answer))) return false;
      startProblem(0); return true;
    },
    update(dtMs) {
      if (!active || paused || ['ready', 'completed'].includes(phase) || !Number.isFinite(dtMs)) return;
      const dt = Math.max(0, dtMs);
      activeElapsedMs += dt;
      const step = Math.min(dt, rules.maxSimulationStepMs), faster = 1 + index * rules.speedUpPerProblem;
      for (const basket of baskets) {
        basket.x += basket.dir * basket.speed * paceFactor * faster * step;
        if (basket.x >= rules.maxX) { basket.x = rules.maxX; basket.dir = -1; }
        if (basket.x <= rules.minX) { basket.x = rules.minX; basket.dir = 1; }
      }
    },
    setPaused(value) { if (active) paused = !!value; },
    throw({ sessionId: sourceSession, attemptId: sourceAttempt, basketId } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || sourceSession !== sessionId || sourceAttempt !== attemptId) return false;
      const basket = basketById(basketId);
      if (!basket) return false;
      const item = current(), right = basket.number === item.answer, first = tries === 0;
      const committedAttempt = attemptId; attemptId = null; phase = 'feedback';
      if (first) { answered++; if (right) correct++; else incorrect++; }
      if (right) { scored++; basket.balls++; hintBasketId = null; }
      else {
        tries++; hintBasketId = problem.correctChoiceId;
        if (first) missed.push(Object.freeze({ contentId: item.problemId, question: item.question, answer: item.answer, chosen: basket.number, questionNumber: answered,
          build: equationTarget({ question: item.question, answer: item.answer, others: item.numbers.filter(n => n !== item.answer) }) }));
      }
      lastAnswer = Object.freeze({ attemptId: committedAttempt, throw: ++throwSerial, choiceId: basket.basketId, correctChoiceId: problem.correctChoiceId,
        correct: right, first, value: basket.number, answer: item.answer, question: item.question, name: basket.name, x: basket.x, y: basket.y, row: basket.row });
      const payload = { attemptId: committedAttempt, choiceId: basket.basketId, correctChoiceId: problem.correctChoiceId, contentId: item.problemId,
        skillId: item.skillId, value: basket.number, answer: item.answer };
      // One learning result per problem: the first throw. Later throws are just play.
      if (first) notify(right ? 'correct' : 'incorrect', payload);
      else notify(right ? 'scored' : 'retry', payload);
      return true;
    },
    next({ sessionId: sourceSession } = {}) {
      if (!active || paused || notifying || sourceSession !== sessionId || phase !== 'feedback') return false;
      if (lastAnswer?.correct) {
        if (index + 1 >= problems.length) { complete(); return true; }
        startProblem(index + 1); return true;
      }
      openThrow();
      return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'throw') return this.throw(command.payload);
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
