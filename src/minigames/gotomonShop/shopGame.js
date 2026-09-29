import { shuffled } from '../kanjiBingo/bingoContent.js';

export const SHOP_REQUESTS = 12;
export const SHOP_SLOTS = 3;
export const SHELF_SIZE = 6;
// How long a customer waits happily (normal / ゆっくり pace), in ms.
export const PATIENCE = Object.freeze({ normal: 18000, slow: 30000 });

const tipFor = mood => mood >= .6 ? 3 : mood >= .3 ? 2 : 1;

// Nonpersistent Core. The kanji (sixteen with clues that each fit one kanji) and the
// customers come from the caller. Up to three Gotomon wait at the counter, each asking
// for one kanji by its reading or its meaning; the child picks a customer and hands
// over a kanji from the shelf. Waiting lowers a customer's mood (and the tip), but
// nobody leaves: a wrong kanji gets a gentle "ちがうよ", the right card glows, and the
// customer waits until served. One learning result per request, on the first hand-over.
export function createShopGame({ sessionId, random = Math.random, onEvent = () => {}, content, pace = 'normal' }) {
  const stage = content?.stage ?? null, card = content?.card ?? null, visitors = content?.customers ?? [];
  const patience = PATIENCE[pace === 'slow' ? 'slow' : 'normal'];
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, requestSerial = 0, visitorIndex = 0;
  let answered = 0, correct = 0, incorrect = 0, served = 0, tips = 0;
  let result = null, lastAnswer = null, aborted = false, completeEmitted = false, attemptId = null;
  let customers = [], shelf = [], focus = null, hintCellId = null;
  const queue = [], missed = [];

  const cellById = cellId => card?.find(cell => cell.cellId === cellId) ?? null;
  const focused = () => customers.find(customer => customer.slot === focus) ?? null;
  // Each hand-over is its own problem, so the Host's feedback timing restarts on a retry.
  const problemIdOf = customer => customer ? `${customer.problemId}:${customer.tries}` : null;
  const problemOf = customer => customer ? Object.freeze({ problemId: problemIdOf(customer), contentId: customer.kanjiId, skillId: `kanji:${customer.kanjiId}`,
    kind: customer.kind, kanji: customer.kanji, clue: customer.clue, cellId: customer.cellId,
    choices: Object.freeze(shelf.map(cellId => Object.freeze({ choiceId: cellId, text: cellById(cellId).kanji }))), correctChoiceId: customer.cellId }) : null;
  const snapshot = () => Object.freeze({
    gameId: 'gotomonShop', mode: 'shop', stage, sessionId, phase, paused, active, aborted, seq, activeElapsedMs,
    customers: Object.freeze(customers.map(customer => Object.freeze({ ...customer, mood: Math.max(0, 1 - customer.waitMs / patience) }))),
    shelf: Object.freeze(shelf.map(cellId => cellById(cellId))), focus, hintCellId,
    problem: problemOf(focused()), attemptId, served, total: SHOP_REQUESTS, tips,
    answered, correct, incorrect, result, lastAnswer, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonShop', sessionId, seq: ++seq, type,
      problemId: problemIdOf(focused()), activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  // A new customer takes the free slot. Readings and meanings alternate; a kanji with
  // only one kind of clue uses that one.
  const arrive = slot => {
    const cell = queue.shift();
    if (!cell) return null;
    const prefer = requestSerial % 2 === 0 ? 'reading' : 'meaning';
    const kind = cell[prefer] ? prefer : prefer === 'reading' ? 'meaning' : 'reading';
    const visitor = visitors.length ? visitors[visitorIndex++ % visitors.length] : null;
    const customer = { slot, customerId: `${sessionId}:c${++requestSerial}`, problemId: `${sessionId}:shop:${requestSerial}:${cell.kanjiId}`,
      cellId: cell.cellId, kanjiId: cell.kanjiId, kanji: cell.kanji, kind, clue: kind === 'reading' ? cell.reading : Object.freeze({ meaning: cell.meaning }),
      name: visitor?.name ?? 'ゴトモン', imageUrl: visitor?.imageUrl ?? '', waitMs: 0, tries: 0 };
    customers.push(customer);
    notify('problemPresented', { skillId: `kanji:${cell.kanjiId}`, clue: kind });
    return customer;
  };
  // The shelf always holds every waiting customer's kanji; the other places show other
  // kanji from the card. Cards stay where the child saw them: only the served card leaves,
  // and a new customer's kanji goes to a random free place.
  const pick = list => list[Math.floor(random() * list.length)];
  const restock = servedCellId => {
    const wanted = customers.map(customer => customer.cellId);
    if (servedCellId) shelf = shelf.map(cellId => cellId === servedCellId ? null : cellId);
    for (const cellId of wanted) {
      if (shelf.includes(cellId)) continue;
      const free = shelf.map((item, index) => item === null || !wanted.includes(item) ? index : -1).filter(index => index >= 0);
      if (shelf.length < SHELF_SIZE) shelf.push(cellId); else shelf[pick(free)] = cellId;
    }
    const others = shuffled(card.filter(cell => !shelf.includes(cell.cellId)), random).map(cell => cell.cellId);
    shelf = shelf.map(cellId => cellId ?? others.shift());
    while (shelf.length < SHELF_SIZE && others.length) shelf.push(others.shift());
  };
  const openAttempt = () => { attemptId = `${focused().problemId}:attempt:${focused().tries}`; lastAnswer = null; phase = 'answering'; };
  const complete = () => {
    phase = 'completed'; attemptId = null; focus = null; hintCellId = null;
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, served, tips, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !card || card.length < SHELF_SIZE) return false;
      queue.push(...shuffled(card.filter(cell => cell.focus), random), ...shuffled(card.filter(cell => !cell.focus), random));
      queue.splice(SHOP_REQUESTS);
      for (let slot = 0; slot < SHOP_SLOTS; slot++) arrive(slot);
      restock(); shelf = shuffled(shelf, random); focus = customers[0].slot; openAttempt();
      return true;
    },
    update(dtMs) {
      if (!active || paused || ['ready', 'completed'].includes(phase) || !Number.isFinite(dtMs)) return;
      const dt = Math.max(0, dtMs);
      activeElapsedMs += dt;
      if (phase === 'answering') for (const customer of customers) customer.waitMs = Math.min(patience, customer.waitMs + dt);
    },
    setPaused(value) { if (active) paused = !!value; },
    focus({ sessionId: sourceSession, slot } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || sourceSession !== sessionId) return false;
      if (!customers.some(customer => customer.slot === slot) || slot === focus) return false;
      // Switching customers leaves any glowing hint with the customer it belongs to.
      focus = slot; hintCellId = focused().tries ? focused().cellId : null; openAttempt();
      return true;
    },
    give({ sessionId: sourceSession, attemptId: sourceAttempt, cellId } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || sourceSession !== sessionId || sourceAttempt !== attemptId) return false;
      if (!shelf.includes(cellId)) return false;
      const customer = focused(), committedAttempt = attemptId;
      attemptId = null;
      const right = cellId === customer.cellId, first = customer.tries === 0;
      customer.tries++;
      const mood = Math.max(0, 1 - customer.waitMs / patience);
      if (first) { answered++; if (right) correct++; else incorrect++; }
      let tip = 0;
      if (right) { tip = first ? tipFor(mood) : 1; tips += tip; served++; hintCellId = null; }
      else {
        hintCellId = customer.cellId;
        if (first) missed.push(Object.freeze({ contentId: customer.kanjiId, kanji: customer.kanji, clue: customer.kind,
          answer: customer.kind === 'reading' ? customer.clue.reading : customer.clue.meaning, questionNumber: answered }));
      }
      lastAnswer = Object.freeze({ attemptId: committedAttempt, choiceId: cellId, correctChoiceId: customer.cellId, correct: right, first, tip,
        slot: customer.slot, name: customer.name, kanji: customer.kanji, given: cellById(cellId).kanji });
      phase = 'feedback';
      const payload = { attemptId: committedAttempt, choiceId: cellId, correctChoiceId: customer.cellId, contentId: customer.kanjiId,
        skillId: `kanji:${customer.kanjiId}`, clue: customer.kind, tip, served };
      // One learning result per request: the first hand-over. Later tries are just service.
      if (first) notify(right ? 'correct' : 'incorrect', payload);
      else notify(right ? 'served' : 'retry', payload);
      return true;
    },
    next({ sessionId: sourceSession } = {}) {
      if (!active || paused || notifying || sourceSession !== sessionId || phase !== 'feedback') return false;
      if (lastAnswer?.correct) {
        const slot = lastAnswer.slot;
        customers = customers.filter(customer => customer.slot !== slot);
        if (served >= SHOP_REQUESTS || (!customers.length && !queue.length)) { complete(); return true; }
        arrive(slot);
        customers.sort((a, b) => a.slot - b.slot);
        restock(lastAnswer.choiceId);
        // The longest-waiting customer comes next.
        focus = [...customers].sort((a, b) => b.waitMs - a.waitMs)[0].slot;
        hintCellId = focused().tries ? focused().cellId : null;
      }
      openAttempt();
      return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'focus') return this.focus(command.payload);
      if (command.type === 'give') return this.give(command.payload);
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
