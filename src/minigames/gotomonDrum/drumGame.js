export const DRUM_RULES = Object.freeze({
  // One beat (normal / ゆっくり), in ms. A note takes 4 beats to cross to the drum.
  beatMs: Object.freeze({ normal: 600, slow: 760 }), travelBeats: 4, leadBeats: 4, blockBeats: 8,
  // Plain notes (only for the rhythm) come on these beats of each question's block.
  plainBeats: Object.freeze([4, 6]),
  // How far from its beat a hit still counts, in ms (normal / ゆっくり), and a perfect hit.
  window: Object.freeze({ normal: 260, slow: 320 }), great: 90,
});
const R = DRUM_RULES;

function take(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('random must be in [0, 1)');
  return value;
}

// Nonpersistent Core: a taiko rhythm game of そう？ちがう？. Notes slide to the drum on the
// beat. A big question note asks 「3+5 = 9？」: ドン (the face) says そう, カッ (the rim)
// says ちがう. Small red and blue notes between them are only for the rhythm. A question
// note that slips by comes round again later, and one answered wrongly comes back once
// for another go, so every question is met; there is no game over. One learning result
// per question, on its first hit; each question note is its own problem id.
export function createDrumGame({ sessionId, random = Math.random, onEvent = () => {}, content, pace = 'normal' }) {
  const questions = content?.questions ?? null;
  const slow = pace === 'slow';
  const beat = R.beatMs[slow ? 'slow' : 'normal'], window = R.window[slow ? 'slow' : 'normal'], travel = beat * R.travelBeats;
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, songMs = 0, noteSerial = 0, hitSerial = 0, lastBlock = 0;
  let answered = 0, correct = 0, incorrect = 0, joined = 0, drumCombo = 0, bestDrumCombo = 0, greats = 0;
  let result = null, lastHit = null, aborted = false, completeEmitted = false, problem = null, attemptId = null, tailUntil = null;
  let notes = [], states = [];
  const missed = [];

  const upcoming = () => notes.filter(note => note.kind === 'quiz' && note.state === 'coming').sort((a, b) => a.at - b.at)[0] ?? null;
  const snapshot = () => Object.freeze({
    gameId: 'gotomonDrum', mode: 'drum', sessionId, phase, paused, active, aborted, seq, activeElapsedMs, pace: slow ? 'slow' : 'normal',
    songMs, beatMs: beat, travelMs: travel, windowMs: window,
    notes: Object.freeze(notes.filter(note => note.state === 'coming' || songMs - note.at < 700).map(note => Object.freeze({ ...note }))),
    total: questions ? questions.length : 0, resolved: states.filter(item => item.done).length, joined, drumCombo, bestDrumCombo, greats,
    problem, attemptId, answered, correct, incorrect, result, lastHit, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}, problemId = problem?.problemId ?? null) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonDrum', sessionId, seq: ++seq, type,
      problemId, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  // A block of 8 beats: the question note on its first beat, plain notes after it.
  const addBlock = index => {
    const start = Math.max(lastBlock + R.blockBeats * beat, Math.ceil((songMs + travel + beat) / beat) * beat);
    lastBlock = start;
    const tries = states[index].notes++;
    notes.push({ noteId: `${sessionId}:note:${++noteSerial}`, kind: 'quiz', at: start, state: 'coming', index, problemId: `${questions[index].problemId}:${tries}` });
    for (const at of R.plainBeats) notes.push({ noteId: `${sessionId}:note:${++noteSerial}`, kind: take(random) < 0.6 ? 'don' : 'ka', at: start + at * beat, state: 'coming', index: null });
  };
  // The question on screen is the next question note to reach the drum.
  const present = () => {
    const note = upcoming();
    // After the last question the plain notes left can still be played.
    if (!note) { problem = null; attemptId = `${sessionId}:tail`; return; }
    if (problem?.problemId === note.problemId) return;
    const item = questions[note.index];
    problem = Object.freeze({ problemId: note.problemId, contentId: item.contentId, skillId: item.skillId, kind: item.kind,
      statement: item.statement, sentence: item.sentence, noteId: note.noteId, again: states[note.index].tries > 0 || states[note.index].notes > 1 });
    attemptId = `${note.problemId}:attempt`;
    if (!states[note.index].presented) { states[note.index].presented = true; notify('problemPresented', { skillId: item.skillId, kind: item.kind }); }
  };
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null;
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, joined, greats, bestDrumCombo, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };
  const strike = (note, drum) => {
    const off = songMs - note.at, grade = Math.abs(off) <= R.great ? 'great' : 'good';
    hitSerial++;
    if (note.kind !== 'quiz') {
      const right = note.kind === drum;
      note.state = right ? 'hit' : 'miss';
      if (right) { drumCombo++; bestDrumCombo = Math.max(bestDrumCombo, drumCombo); if (grade === 'great') greats++; } else drumCombo = 0;
      lastHit = Object.freeze({ hit: hitSerial, noteId: note.noteId, kind: note.kind, drum, right, grade, quiz: false });
      return;
    }
    const item = questions[note.index], state = states[note.index], first = state.tries === 0;
    const right = (drum === 'don') === item.truth;
    state.tries++;
    note.state = right ? 'hit' : 'miss';
    if (right) { drumCombo++; bestDrumCombo = Math.max(bestDrumCombo, drumCombo); if (grade === 'great') greats++; joined++; } else drumCombo = 0;
    if (first) { answered++; if (right) correct++; else incorrect++; }
    if (!right && first) missed.push(Object.freeze({ contentId: item.contentId, prompt: item.statement, chosen: drum === 'don' ? 'そう' : 'ちがう', explain: item.explain, questionNumber: answered }));
    lastHit = Object.freeze({ hit: hitSerial, noteId: note.noteId, kind: 'quiz', drum, right, grade, quiz: true, first, truth: item.truth,
      statement: item.statement, shown: item.shown, shownNote: item.shownNote, answer: item.answer, explain: item.explain });
    const payload = { attemptId, contentId: item.contentId, skillId: item.skillId, chosen: drum, truth: item.truth };
    const problemId = note.problemId;
    // A wrong first answer comes round once more; after that the question is done.
    if (right || !first) state.done = true; else addBlock(note.index);
    notify(first ? (right ? 'correct' : 'incorrect') : (right ? 'fixed' : 'retry'), payload, problemId);
  };
  const settle = () => {
    present();
    if (states.every(item => item.done) && !notes.some(note => note.state === 'coming')) {
      if (tailUntil === null) tailUntil = songMs + beat * 2;
      if (songMs >= tailUntil) complete();
    }
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !Array.isArray(questions) || !questions.length
        || questions.some(item => typeof item.truth !== 'boolean' || !item.statement)) return false;
      states = questions.map(() => ({ tries: 0, notes: 0, done: false, presented: false }));
      lastBlock = R.leadBeats * beat - R.blockBeats * beat + travel;
      phase = 'answering';
      questions.forEach((_, index) => addBlock(index));
      present();
      return true;
    },
    update(dtMs) {
      if (!active || paused || phase !== 'answering' || !Number.isFinite(dtMs) || notifying) return;
      const dt = Math.max(0, Math.min(dtMs, 100));
      activeElapsedMs += dt; songMs += dt;
      for (const note of notes) {
        if (note.state !== 'coming' || songMs - note.at <= window) continue;
        note.state = 'passed';
        if (note.kind === 'quiz') { drumCombo = 0; addBlock(note.index); }
      }
      notes = notes.filter(note => note.state === 'coming' || songMs - note.at < 1500);
      settle();
    },
    setPaused(value) { if (active) paused = !!value; },
    // A hit on the drum: ドン (don) or カッ (ka). It meets the note nearest its beat, if any is close enough.
    hit({ sessionId: s, attemptId: a, drum } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || s !== sessionId || a !== attemptId) return false;
      if (!['don', 'ka'].includes(drum)) return false;
      const near = notes.filter(note => note.state === 'coming' && Math.abs(songMs - note.at) <= window)
        .sort((x, y) => Math.abs(songMs - x.at) - Math.abs(songMs - y.at))[0];
      if (!near) return false;
      strike(near, drum);
      settle();
      return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'hit') return this.hit(command.payload);
      return false;
    },
    snapshot,
    exit() {
      if (!active) return;
      active = false; attemptId = null; aborted = phase !== 'completed'; observer = null;
    },
  };
}
