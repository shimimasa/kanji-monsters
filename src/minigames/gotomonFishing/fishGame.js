import { FISH_SWIMMERS } from './fishContent.js';

export const FISH_RULES = Object.freeze({
  // Each Gotomon swims its own depth; rows take turns swimming right and left.
  rows: Object.freeze([0.38, 0.52, 0.66, 0.8]),
  speedsPerMs: Object.freeze([0.00009, 0.00011, 0.00008, 0.0001]),
  // Swimmers turn around at the pond's edges, so every plate stays in sight.
  minX: 0.1, maxX: 0.9,
  speedUpPerProblem: 0.03,
  slowPaceFactor: 0.55,
  maxSimulationStepMs: 100,
});

// Nonpersistent Core. Problems (a word or meaning and four plates) and the Gotomon
// who carry the plates come from the caller. The Gotomon never stop swimming and
// turn around at the pond's edges. The child hooks the one
// whose plate answers the problem. A wrong catch lets the Gotomon go (and shows its
// word and meaning), the right one glows, and the same problem stays until it is
// caught. No game over. One learning result per problem, on the first cast; each
// cast is its own problem id so the Host's feedback timing restarts.
export function createFishGame({ sessionId, random = Math.random, onEvent = () => {}, content, pace = 'normal' }) {
  const rules = FISH_RULES, problems = content?.problems ?? null, carriers = content?.carriers ?? [];
  const paceFactor = pace === 'slow' ? rules.slowPaceFactor : 1;
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, index = 0, tries = 0, castSerial = 0;
  let answered = 0, correct = 0, incorrect = 0, caught = 0;
  let result = null, lastAnswer = null, aborted = false, completeEmitted = false, problem = null, attemptId = null, hintSwimmerId = null;
  const missed = [];
  const swimmers = Array.from({ length: FISH_SWIMMERS }, (_, row) => {
    const carrier = carriers.length ? carriers[row % carriers.length] : null;
    const start = Math.min(Math.max(Number(random()) || 0, 0), .999999);
    return { swimmerId: `${sessionId}:swimmer:${row}`, row, y: rules.rows[row], x: rules.minX + start * (rules.maxX - rules.minX), dir: row % 2 ? -1 : 1,
      speed: rules.speedsPerMs[row], plate: null, name: carrier?.name ?? 'ゴトモン', imageUrl: carrier?.imageUrl ?? '', catches: 0 };
  });

  const current = () => problems?.[index] ?? null;
  const swimmerById = swimmerId => swimmers.find(swimmer => swimmer.swimmerId === swimmerId) ?? null;
  const snapshot = () => Object.freeze({
    gameId: 'gotomonFishing', mode: 'fishing', sessionId, phase, paused, active, aborted, seq, activeElapsedMs, pace: pace === 'slow' ? 'slow' : 'normal',
    swimmers: Object.freeze(swimmers.map(swimmer => Object.freeze({ ...swimmer }))), hintSwimmerId,
    problemIndex: index, total: problems ? problems.length : 0, caught,
    problem, attemptId, answered, correct, incorrect, result, lastAnswer, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonFishing', sessionId, seq: ++seq, type,
      problemId: problem?.problemId ?? null, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  const openCast = () => {
    const item = current();
    const answer = swimmers.find(swimmer => swimmer.plate.contentId === item.contentId);
    problem = Object.freeze({ problemId: `${item.problemId}:${tries}`, contentId: item.contentId, skillId: item.skillId,
      kind: item.kind, prompt: item.prompt, word: item.word, meaning: item.meaning,
      choices: Object.freeze(swimmers.map(swimmer => Object.freeze({ choiceId: swimmer.swimmerId, text: swimmer.plate.text }))),
      correctChoiceId: answer.swimmerId });
    attemptId = `${problem.problemId}:attempt`; lastAnswer = null; phase = 'answering';
  };
  const startProblem = at => {
    index = at; tries = 0; hintSwimmerId = null;
    current().plates.forEach((plate, row) => { swimmers[row].plate = plate; });
    notify('problemPresented', { skillId: current().skillId, kind: current().kind });
    openCast();
  };
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null; hintSwimmerId = null;
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, caught, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !Array.isArray(problems) || !problems.length
        || problems.some(item => item.plates?.length !== FISH_SWIMMERS || !item.plates.some(plate => plate.contentId === item.contentId))) return false;
      startProblem(0); return true;
    },
    update(dtMs) {
      if (!active || paused || ['ready', 'completed'].includes(phase) || !Number.isFinite(dtMs)) return;
      const dt = Math.max(0, dtMs);
      activeElapsedMs += dt;
      const step = Math.min(dt, rules.maxSimulationStepMs), faster = 1 + index * rules.speedUpPerProblem;
      for (const swimmer of swimmers) {
        swimmer.x += swimmer.dir * swimmer.speed * paceFactor * faster * step;
        if (swimmer.x >= rules.maxX) { swimmer.x = rules.maxX; swimmer.dir = -1; }
        if (swimmer.x <= rules.minX) { swimmer.x = rules.minX; swimmer.dir = 1; }
      }
    },
    setPaused(value) { if (active) paused = !!value; },
    cast({ sessionId: sourceSession, attemptId: sourceAttempt, swimmerId } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || sourceSession !== sessionId || sourceAttempt !== attemptId) return false;
      const swimmer = swimmerById(swimmerId);
      if (!swimmer) return false;
      const item = current(), right = swimmer.plate.contentId === item.contentId, first = tries === 0;
      const committedAttempt = attemptId; attemptId = null; phase = 'feedback';
      if (first) { answered++; if (right) correct++; else incorrect++; }
      if (right) { caught++; swimmer.catches++; hintSwimmerId = null; }
      else {
        tries++; hintSwimmerId = problem.correctChoiceId;
        if (first) missed.push(Object.freeze({ contentId: item.contentId, word: item.word, meaning: item.meaning, kind: item.kind,
          chosen: swimmer.plate.text, questionNumber: answered }));
      }
      lastAnswer = Object.freeze({ attemptId: committedAttempt, cast: ++castSerial, choiceId: swimmer.swimmerId, correctChoiceId: problem.correctChoiceId,
        correct: right, first, kind: item.kind, word: item.word, meaning: item.meaning,
        plate: swimmer.plate, name: swimmer.name, x: swimmer.x, y: swimmer.y, row: swimmer.row });
      const payload = { attemptId: committedAttempt, choiceId: swimmer.swimmerId, correctChoiceId: problem.correctChoiceId, contentId: item.contentId,
        skillId: item.skillId, chosen: swimmer.plate.contentId };
      // One learning result per problem: the first cast. Later casts are just fishing.
      if (first) notify(right ? 'correct' : 'incorrect', payload);
      else notify(right ? 'caught' : 'retry', payload);
      return true;
    },
    next({ sessionId: sourceSession } = {}) {
      if (!active || paused || notifying || sourceSession !== sessionId || phase !== 'feedback') return false;
      if (lastAnswer?.correct) {
        if (index + 1 >= problems.length) { complete(); return true; }
        startProblem(index + 1); return true;
      }
      openCast();
      return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'cast') return this.cast(command.payload);
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
