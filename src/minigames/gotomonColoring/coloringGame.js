import { pickValues, labelsFor, pick } from '../gotomonBubble/bubbleContent.js';

export const COLORING_RULES = Object.freeze({ size: 10 });
// Every square shows a calculation (never the bare number), so each one is worked out.
const labelFor = (value, level, random) => { const all = labelsFor(value, level); return all.length > 1 ? pick(all.slice(1), random) : all[0]; };

// Nonpersistent Core: colour-by-answer. A picture of a Gotomon comes as a 10x10 grid of
// three colours; each colour stands for an answer (赤＝7 …) and every square to paint shows
// a calculation. The child picks a colour and taps the squares whose answer is its
// number; a square painted in the wrong colour stays blank and says what it was. When
// the last square is painted the real Gotomon appears. No time, no game over. Each
// square is one problem: found when its first tap is the right colour.
export function createColoringGame({ sessionId, random = Math.random, onEvent = () => {}, content }) {
  const picture = content?.picture ?? null, level = content?.level === 'times' ? 'times' : 'addsub';
  const colors = picture ? picture.palette.length : 0;
  const values = colors ? pickValues(level, random).slice(0, colors) : [];
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, selected = 0, tapSerial = 0;
  let answered = 0, correct = 0, incorrect = 0, painted = 0;
  let result = null, lastTap = null, aborted = false, completeEmitted = false, problem = null, attemptId = null;
  let cells = [];
  const missed = [];

  const left = color => cells.filter(cell => cell.color === color && !cell.painted).length;
  const snapshot = () => Object.freeze({
    gameId: 'gotomonColoring', mode: 'coloring', sessionId, phase, paused, active, aborted, seq, activeElapsedMs, level,
    picture: picture ? Object.freeze({ id: picture.id, name: picture.name, palette: picture.palette, imageUrl: picture.imageUrl ?? null }) : null,
    values: Object.freeze([...values]), selected, left: Object.freeze(values.map((_, color) => left(color))),
    cells: Object.freeze(cells.map(cell => Object.freeze({ ...cell }))), painted, total: cells.length,
    problem, attemptId, answered, correct, incorrect, result, lastTap, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonColoring', sessionId, seq: ++seq, type,
      problemId: problem?.problemId ?? null, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  // Each tap is its own problem so the Host's timing restarts.
  const openTap = () => {
    problem = Object.freeze({ problemId: `${sessionId}:tap:${tapSerial}`, contentId: `${level}:${values[selected]}`, skillId: `coloring:${level}`,
      color: selected, answer: values[selected] });
    attemptId = `${problem.problemId}:attempt`;
  };
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null;
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, painted, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !picture || !/^[.0-9]+$/.test(picture.grid ?? '')) return false;
      cells = [...picture.grid].map((mark, index) => mark === '.' ? null : { cellId: `${sessionId}:c${index}`, index,
        row: Math.floor(index / COLORING_RULES.size), column: index % COLORING_RULES.size, color: Number(mark),
        value: values[Number(mark)], label: labelFor(values[Number(mark)], level, random), painted: false, tries: 0 }).filter(Boolean);
      if (!cells.length || cells.some(cell => cell.color >= colors)) return false;
      phase = 'answering'; openTap();
      notify('problemPresented', { skillId: `coloring:${level}` });
      return true;
    },
    update(dtMs) {
      if (!active || paused || phase !== 'answering' || !Number.isFinite(dtMs)) return;
      activeElapsedMs += Math.max(0, dtMs);
    },
    setPaused(value) { if (active) paused = !!value; },
    choose({ sessionId: s, color } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || s !== sessionId) return false;
      if (!Number.isInteger(color) || color < 0 || color >= colors || color === selected) return false;
      selected = color; openTap(); return true;
    },
    paint({ sessionId: s, attemptId: a, cellId } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || s !== sessionId || a !== attemptId) return false;
      const cell = cells.find(item => item.cellId === cellId);
      if (!cell || cell.painted) return false;
      const right = cell.color === selected, first = cell.tries === 0;
      cell.tries++; tapSerial++;
      if (first) { answered++; if (right) correct++; else incorrect++; }
      lastTap = Object.freeze({ tap: tapSerial, cellId, correct: right, first, label: cell.label, value: cell.value, color: selected, chosenValue: values[selected], cellColor: cell.color });
      const payload = { contentId: `${level}:${cell.value}`, skillId: `coloring:${level}`, label: cell.label, chosen: values[selected] };
      if (right) { cell.painted = true; painted++; }
      else if (first) missed.push(Object.freeze({ contentId: `${level}:${cell.value}`, label: cell.label, answer: cell.value, chosen: values[selected], questionNumber: answered }));
      notify(first ? (right ? 'correct' : 'incorrect') : (right ? 'painted' : 'retry'), payload);
      if (painted >= cells.length) { complete(); return true; }
      // A finished colour hands over to the next one with squares left.
      if (right && !left(selected)) selected = values.findIndex((_, color) => left(color) > 0);
      openTap();
      return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'paint') return this.paint(command.payload);
      if (command.type === 'choose') return this.choose(command.payload);
      return false;
    },
    snapshot,
    exit() {
      if (!active) return;
      active = false; attemptId = null; aborted = phase !== 'completed'; observer = null;
    },
  };
}
