import { KANJI_PARTS, kanjiOf } from './partsData.js';
import { partsTarget } from '../buildReview.js';

export const PARTS_RULES = Object.freeze({
  columns: 5, targets: 10,
  // Time for the falling part to reach the bases (normal / ゆっくり), in ms.
  fallMs: Object.freeze({ normal: 9000, slow: 14000 }), startY: 0.05, baseY: 0.78,
});
const R = PARTS_RULES;

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

// Ten kanji for a run: grades 1–2, or all of them.
export function pickPartsTargets({ random = Math.random, mode = 'easy' } = {}) {
  const pool = KANJI_PARTS.filter(item => mode === 'all' || item.grade <= 2);
  return shuffled(pool, random).slice(0, R.targets);
}

// Nonpersistent Core: part-dropping. A kanji to make is shown; one of its parts falls
// and five bases on the ground each hold a part (held by Gotomon in the view). The child
// moves the falling part over the base with its partner and drops it: the two join into
// the kanji. A part landing where no kanji can be made bounces back to the top, and the
// partner glows — no game over. Every base part is one no falling part could wrongly
// join (only the partner makes a kanji). One learning result per kanji, on the first landing.
export function createPartsGame({ sessionId, random = Math.random, onEvent = () => {}, content, pace = 'normal' }) {
  const targets = content?.targets ?? pickPartsTargets({ random, mode: content?.mode });
  const fallPerMs = (R.baseY - R.startY) / R.fallMs[pace === 'slow' ? 'slow' : 'normal'];
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, index = 0, tries = 0, landSerial = 0;
  let answered = 0, correct = 0, incorrect = 0, made = 0;
  let result = null, lastAnswer = null, aborted = false, completeEmitted = false, problem = null, attemptId = null, hintColumn = null;
  let falling = null, bases = [], fallIndex = 0;
  const missed = [];

  const current = () => targets?.[index] ?? null;
  const allParts = [...new Set(KANJI_PARTS.flatMap(item => item.parts))];
  // Fill the bases: the partner once, and other parts that make no kanji with the
  // falling part. Parts already standing stay where they are when they still fit.
  const setBases = () => {
    const item = current(), fallingPart = item.parts[fallIndex], partner = item.parts[1 - fallIndex];
    const partnerColumn = Math.floor(take(random) * R.columns), used = new Set([partner]);
    const next = Array.from({ length: R.columns }, (_, column) => {
      if (column === partnerColumn) return { column, part: partner };
      const old = bases[column]?.part;
      if (old && !used.has(old) && !kanjiOf(fallingPart, old)) { used.add(old); return { column, part: old }; }
      return { column, part: null };
    });
    const decoys = shuffled(allParts.filter(part => !used.has(part) && !kanjiOf(fallingPart, part)), random);
    for (const base of next) if (!base.part) { base.part = decoys.shift(); used.add(base.part); }
    bases = next;
  };
  const snapshot = () => Object.freeze({
    gameId: 'gotomonParts', mode: 'parts', sessionId, phase, paused, active, aborted, seq, activeElapsedMs,
    target: current(), falling: falling ? Object.freeze({ ...falling }) : null, bases: Object.freeze(bases.map(base => Object.freeze({ ...base }))),
    hintColumn, targetIndex: index, total: targets ? targets.length : 0, made,
    problem, attemptId, answered, correct, incorrect, result, lastAnswer, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonParts', sessionId, seq: ++seq, type,
      problemId: problem?.problemId ?? null, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  const openDrop = () => {
    const item = current();
    falling = { part: item.parts[fallIndex], column: falling?.column ?? Math.floor(R.columns / 2), y: R.startY };
    problem = Object.freeze({ problemId: `${sessionId}:parts:${index + 1}:${item.kanji}:${tries}`, contentId: `parts:${item.kanji}`, skillId: `kanji.parts:${item.kanji}`,
      kanji: item.kanji, reading: item.reading, parts: item.parts, layout: item.layout });
    attemptId = `${problem.problemId}:attempt`; lastAnswer = null; phase = 'answering';
  };
  const startTarget = at => {
    index = at; tries = 0; hintColumn = null; falling = null;
    // Either part may fall; the other waits on a base.
    fallIndex = take(random) < 0.5 ? 0 : 1;
    setBases(); openDrop();
    notify('problemPresented', { skillId: problem.skillId });
  };
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null; falling = null; hintColumn = null;
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, made, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };
  const land = () => {
    const item = current(), base = bases.find(other => other.column === falling.column);
    const joined = kanjiOf(falling.part, base.part), right = joined?.kanji === item.kanji, first = tries === 0;
    const committedAttempt = attemptId; attemptId = null; phase = 'feedback';
    if (first) { answered++; if (right) correct++; else incorrect++; }
    if (right) { made++; hintColumn = null; }
    else {
      tries++; hintColumn = bases.find(other => other.part === item.parts[1 - fallIndex]).column;
      if (first) missed.push(Object.freeze({ contentId: `parts:${item.kanji}`, kanji: item.kanji, parts: item.parts, chosen: base.part, questionNumber: answered,
        build: partsTarget({ kanji: item.kanji, reading: item.reading, parts: item.parts, layout: item.layout, others: [base.part], fill: allParts }) }));
    }
    lastAnswer = Object.freeze({ attemptId: committedAttempt, landing: ++landSerial, correct: right, first, kanji: item.kanji, reading: item.reading,
      layout: item.layout, part: falling.part, onto: base.part, column: base.column, parts: item.parts });
    const payload = { attemptId: committedAttempt, contentId: `parts:${item.kanji}`, skillId: problem.skillId, onto: base.part };
    if (first) notify(right ? 'correct' : 'incorrect', payload);
    else notify(right ? 'joined' : 'retry', payload);
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !Array.isArray(targets) || !targets.length) return false;
      startTarget(0); return true;
    },
    update(dtMs) {
      if (!active || paused || ['ready', 'completed'].includes(phase) || !Number.isFinite(dtMs) || notifying) return;
      const dt = Math.max(0, Math.min(dtMs, 100));
      activeElapsedMs += dt;
      if (phase !== 'answering') return;
      falling.y += fallPerMs * dt;
      if (falling.y >= R.baseY) { falling.y = R.baseY; land(); }
    },
    setPaused(value) { if (active) paused = !!value; },
    move({ sessionId: s, attemptId: a, column } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || s !== sessionId || a !== attemptId) return false;
      if (!Number.isInteger(column) || column < 0 || column >= R.columns || column === falling.column) return false;
      falling.column = column; return true;
    },
    shift({ sessionId: s, attemptId: a, direction } = {}) {
      if (![-1, 1].includes(direction) || !falling) return false;
      return this.move({ sessionId: s, attemptId: a, column: falling.column + direction });
    },
    drop({ sessionId: s, attemptId: a } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || s !== sessionId || a !== attemptId) return false;
      falling.y = R.baseY; land(); return true;
    },
    next({ sessionId: sourceSession } = {}) {
      if (!active || paused || notifying || sourceSession !== sessionId || phase !== 'feedback') return false;
      if (!lastAnswer?.correct) { openDrop(); return true; }
      if (index + 1 >= targets.length) { complete(); return true; }
      startTarget(index + 1); return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (['move', 'shift', 'drop', 'next'].includes(command.type)) return this[command.type](command.payload);
      return false;
    },
    snapshot,
    exit() {
      if (!active) return;
      active = false; attemptId = null; aborted = phase !== 'completed'; observer = null;
    },
  };
}
