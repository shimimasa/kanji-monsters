export const SEEK_RULES = Object.freeze({
  // Hiding places across the scene (x, y as 0..1 of the field), and how many Gotomon hide.
  spots: Object.freeze([
    [0.12, 0.34], [0.34, 0.26], [0.6, 0.3], [0.86, 0.36], [0.2, 0.62], [0.46, 0.56],
    [0.74, 0.62], [0.1, 0.86], [0.36, 0.84], [0.62, 0.86], [0.88, 0.82],
  ]),
  hiders: 6,
});
const R = SEEK_RULES;

function take(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('random must be in [0, 1)');
  return value;
}
const shuffled = (items, random) => {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(take(random) * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
};

// Nonpersistent Core: hide and seek. Six Gotomon hide around the scene (behind bushes,
// trees and rocks), each holding a small plate. The child finds the one whose plate
// answers the question and taps it; it jumps out. A wrong one says what its plate is and
// the one to find starts to sparkle. Then they all hide again somewhere else. Twelve
// questions; no time, no game over. One learning result per question, on its first tap;
// each tap is its own problem id.
export function createSeekGame({ sessionId, random = Math.random, onEvent = () => {}, content }) {
  const problems = content?.problems ?? null;
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, index = 0, tries = 0, tapSerial = 0;
  let answered = 0, correct = 0, incorrect = 0, found = 0;
  let result = null, lastTap = null, aborted = false, completeEmitted = false, problem = null, attemptId = null, hintHiderId = null;
  let hiders = [];
  const missed = [];

  const current = () => problems?.[index] ?? null;
  const snapshot = () => Object.freeze({
    gameId: 'gotomonSeek', mode: 'seek', sessionId, phase, paused, active, aborted, seq, activeElapsedMs,
    hiders: Object.freeze(hiders.map(item => Object.freeze({ ...item }))), hintHiderId,
    problemIndex: index, total: problems ? problems.length : 0, found,
    problem, attemptId, answered, correct, incorrect, result, lastTap, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonSeek', sessionId, seq: ++seq, type,
      problemId: problem?.problemId ?? null, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  // Two more plates from other questions, so six Gotomon hide: none may say the answer, repeat a
  // plate, or (for a kanji) come from a word with the same kanji.
  const decoys = item => {
    const kanji = item.kind === 'kanji' ? item.prompt.match(/「(.+?)」/)?.[1] ?? null : null;
    const texts = new Set(item.plates.map(plate => plate.text)), ids = new Set(item.plates.map(plate => plate.plateId)), out = [];
    for (const other of shuffled(problems.filter(p => p !== item), random)) {
      for (const plate of shuffled(other.plates, random)) {
        if (out.length >= R.hiders - item.plates.length) return out;
        if (texts.has(plate.text) || ids.has(plate.plateId) || (kanji && (plate.note ?? '').includes(kanji))) continue;
        texts.add(plate.text); ids.add(plate.plateId); out.push(plate);
      }
    }
    return out;
  };
  const openTry = () => {
    const item = current();
    problem = Object.freeze({ problemId: `${item.problemId}:${tries}`, contentId: item.contentId, skillId: item.skillId, kind: item.kind,
      prompt: item.prompt, sentence: item.sentence ?? null, answerId: item.answerId, explain: item.explain,
      choices: Object.freeze(hiders.map(hider => Object.freeze({ choiceId: hider.plateId, text: hider.text }))), correctChoiceId: item.answerId });
    attemptId = `${problem.problemId}:attempt`; phase = 'answering';
  };
  // Everyone hides again: new spots, new plates.
  const hide = () => {
    const item = current(), plates = shuffled([...item.plates, ...decoys(item)], random), spots = shuffled(R.spots.map((_, i) => i), random);
    hiders = plates.map((plate, i) => ({ hiderId: `${sessionId}:h${index}:${i}`, cast: i, spot: spots[i], x: R.spots[spots[i]][0], y: R.spots[spots[i]][1],
      plateId: plate.plateId, text: plate.text, note: plate.note ?? null, state: 'hiding' }));
    hintHiderId = null;
  };
  const startProblem = at => {
    index = at; tries = 0; hide();
    notify('problemPresented', { skillId: current().skillId, kind: current().kind });
    openTry();
  };
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null; hintHiderId = null;
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, found, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !Array.isArray(problems) || !problems.length
        || problems.some(item => !item.plates?.some(plate => plate.plateId === item.answerId))) return false;
      startProblem(0); return true;
    },
    update(dtMs) {
      if (!active || paused || ['ready', 'completed'].includes(phase) || !Number.isFinite(dtMs)) return;
      activeElapsedMs += Math.max(0, Math.min(dtMs, 100));
    },
    setPaused(value) { if (active) paused = !!value; },
    tap({ sessionId: s, attemptId: a, hiderId } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || s !== sessionId || a !== attemptId) return false;
      const hider = hiders.find(item => item.hiderId === hiderId);
      if (!hider || hider.state !== 'hiding') return false;
      const item = current(), right = hider.plateId === item.answerId, first = tries === 0;
      if (first) { answered++; if (right) correct++; else incorrect++; }
      const answer = hiders.find(h => h.plateId === item.answerId);
      lastTap = Object.freeze({ tap: ++tapSerial, correct: right, first, hiderId, text: hider.text, note: hider.note, explain: item.explain, x: hider.x, y: hider.y, answer: answer.text });
      const payload = { attemptId, contentId: item.contentId, skillId: item.skillId, chosen: hider.plateId };
      if (right) {
        found++; hider.state = 'found'; hintHiderId = null; attemptId = null; phase = 'feedback';
        notify(first ? 'correct' : 'found', payload);
      } else {
        hider.state = 'wrong'; hintHiderId = answer.hiderId;
        if (first) missed.push(Object.freeze({ contentId: item.contentId, prompt: item.prompt, chosen: hider.text, explain: item.explain, questionNumber: answered }));
        notify(first ? 'incorrect' : 'retry', payload);
        const shown = lastTap; tries++; openTry(); lastTap = shown;
      }
      return true;
    },
    next({ sessionId: s } = {}) {
      if (!active || paused || notifying || s !== sessionId || phase !== 'feedback') return false;
      if (index + 1 >= problems.length) { complete(); return true; }
      startProblem(index + 1); return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'tap') return this.tap(command.payload);
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
