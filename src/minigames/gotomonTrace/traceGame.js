export const TRACE_RULES = Object.freeze({
  // A 5 x 5 board of letters; a word is traced through neighbouring tiles (across, up and down, or diagonal), each tile once.
  size: 5,
  // The Gotomon's gauge: answered before it fills is ⭐3; when it fills, the first tile of the word glows (normal / ゆっくり).
  hintMs: Object.freeze({ normal: 15000, slow: 22000 }),
  // After the right word the tiles pop for this long before the next board.
  solvedMs: 900,
  // Questions missed the first time come back at the end, at most this many (practice after a while).
  reviewMax: 4,
});
const R = TRACE_RULES;
const N = R.size * R.size;

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

// Letters that are easy to mix up, so the board trains the small details (dakuten, small kana, b/d …).
const KANA_FAMILIES = ['かが', 'きぎ', 'くぐ', 'けげ', 'こご', 'さざ', 'しじ', 'すず', 'せぜ', 'そぞ', 'ただ', 'ちぢ', 'つづっ', 'てで', 'とど',
  'はばぱ', 'ひびぴ', 'ふぶぷ', 'へべぺ', 'ほぼぽ', 'やゃ', 'ゆゅ', 'よょ', 'あぁ', 'いぃ', 'うぅ', 'えぇ', 'おぉ', 'ぬめ', 'るろ', 'れわね', 'さち', 'はほ'];
const LETTER_FAMILIES = ['bd', 'pq', 'mn', 'uv', 'il', 'ec', 'ao'];
const KANA_FILL = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわん';
const LETTER_FILL = 'aeioustrnlhdcmpgbfwy';
const DIGITS = '0123456789';
const lookalikes = (ch, families) => families.filter(f => f.includes(ch)).flatMap(f => [...f]).filter(c => c !== ch);

// Turns the shared 4-plate questions into words to trace. 漢字: the reading (kana). 英語: the English
// word, always asked from its meaning (「夜」は英語で？), since a meaning may hold kanji. 算数: the
// answer's digits. Other plates' letters and look-alikes of the word's letters are the board's decoys.
export function toTraceItems(problems) {
  return problems.map(item => {
    const answer = item.plates.find(p => p.plateId === item.answerId);
    const others = item.plates.filter(p => p.plateId !== item.answerId);
    if (item.kind === 'kanji') {
      return { ...item, script: 'kana', target: [...answer.text], decoys: others.flatMap(p => [...p.text]) };
    }
    if (item.kind === 'en2ja' || item.kind === 'ja2en') {
      const wordOf = p => (item.kind === 'ja2en' ? p.text : (p.note ?? '').split(' ＝ ')[0]);
      const word = (item.kind === 'ja2en' ? answer.text : item.word ?? item.prompt.split(' ')[0]).toLowerCase();
      const meaning = item.kind === 'ja2en' ? item.prompt.match(/「(.+)」/)?.[1] ?? '' : answer.text;
      return { ...item, kind: 'ja2en', skillId: 'english.basicVocabulary.word', prompt: `「${meaning}」は英語で？`, sentence: null,
        script: 'letters', target: [...word], decoys: others.flatMap(p => [...wordOf(p).toLowerCase()]).filter(c => /[a-z]/.test(c)), explain: `${meaning} ＝ ${word}` };
    }
    return { ...item, script: 'digits', target: [...answer.text], decoys: others.flatMap(p => [...p.text]) };
  });
}

const neighbours = i => {
  const r = Math.floor(i / R.size), c = i % R.size, out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < R.size && cc >= 0 && cc < R.size) out.push(rr * R.size + cc);
  }
  return out;
};
export const touching = (a, b) => neighbours(a).includes(b);

// A board: the word laid along a random path of neighbouring tiles; the other tiles are decoys
// (look-alikes of the word's letters, the other plates' letters, the word's own letters) and fill.
export function buildBoard(item, random) {
  const len = item.target.length;
  let path = null;
  const walk = list => {
    if (list.length === len) { path = list; return true; }
    for (const n of shuffled(neighbours(list.at(-1)), random)) if (!list.includes(n) && walk([...list, n])) return true;
    return false;
  };
  for (const start of shuffled([...Array(N).keys()], random)) if (walk([start])) break;
  const tiles = Array(N).fill(null);
  path.forEach((cell, k) => { tiles[cell] = item.target[k]; });
  const fill = item.script === 'kana' ? KANA_FILL : item.script === 'letters' ? LETTER_FILL : DIGITS;
  const families = item.script === 'kana' ? KANA_FAMILIES : item.script === 'letters' ? LETTER_FAMILIES : [];
  const look = item.target.flatMap(ch => lookalikes(ch, families));
  const pool = [...look, ...look, ...item.decoys, ...item.target];
  for (let i = 0; i < N; i++) {
    if (tiles[i] !== null) continue;
    const roll = take(random);
    tiles[i] = pool.length && roll < 0.6 ? pool[Math.floor(take(random) * pool.length)] : fill[Math.floor(take(random) * fill.length)];
  }
  return { tiles, path };
}

// Nonpersistent Core: tracing words. A Gotomon asks a question (「上」の読みは？, 「夜」は英語で？,
// 6 + 9 = ?) and the child builds the answer letter by letter, tracing neighbouring tiles of a
// 5 x 5 board with a finger. No choices are shown: the answer is recalled and spelled, and the
// board is full of look-alikes (か/が, つ/っ, b/d …). A trace as long as the word is the answer;
// a shorter one is not judged. A wrong word shows where it differs and the first tile of the
// word glows; after a second wrong one the whole word glows. When the Gotomon's gauge fills the
// first tile glows too (no game over). Words missed the first time come back at the end (up to
// four). Stars per word: 3 in time without help, 2 with help, 1 after a wrong try.
// One learning result per question, on its first full trace; every trace its own problem id.
export function createTraceGame({ sessionId, random = Math.random, onEvent = () => {}, content, pace = 'normal' }) {
  const items = Array.isArray(content?.problems) ? toTraceItems(content.problems) : null;
  const slow = pace === 'slow';
  const hintMs = R.hintMs[slow ? 'slow' : 'normal'];
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, serial = 0;
  let queue = [], at = 0, item = null, review = false, tries = 0, board = null, askedMs = 0, hint = 0, solvedLeft = 0;
  let answered = 0, correct = 0, incorrect = 0, stars = 0, reviewed = 0, reviewCorrect = 0, streak = 0, bestStreak = 0;
  let result = null, lastTrace = null, lastSolved = null, aborted = false, completeEmitted = false, problem = null, attemptId = null;
  const missed = [], missedItems = [];

  const snapshot = () => Object.freeze({
    gameId: 'gotomonTrace', mode: 'trace', sessionId, phase, paused, active, aborted, seq, activeElapsedMs, pace: slow ? 'slow' : 'normal',
    size: R.size, tiles: Object.freeze([...(board?.tiles ?? [])]), script: item?.script ?? null, length: item?.target.length ?? 0,
    // Help: 1 = the first tile of the word glows, 2 = the whole word glows.
    hint, hintCells: Object.freeze(board ? (hint >= 2 ? [...board.path] : hint === 1 ? [board.path[0]] : []) : []),
    solvedCells: Object.freeze(phase === 'solved' && board ? [...board.path] : []),
    gauge: item && phase === 'answering' ? Math.min(1, askedMs / hintMs) : 0, review, tries,
    problemIndex: Math.min(at, Math.max(0, queue.length - 1)), total: queue.length, firstRound: items ? items.length : 0,
    problem, attemptId, answered, correct, incorrect, stars, streak, bestStreak, reviewed, reviewCorrect, result,
    lastTrace, lastSolved, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}, problemId = problem?.problemId ?? null) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonTrace', sessionId, seq: ++seq, type,
      problemId, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  const present = () => {
    problem = Object.freeze({ problemId: `${item.problemId}:${review ? 'review:' : ''}${tries}`, contentId: item.contentId, skillId: item.skillId, kind: item.kind,
      prompt: item.prompt, sentence: item.sentence ?? null, answerId: item.answerId, explain: item.explain, review,
      choices: Object.freeze([]), correctChoiceId: item.answerId });
    attemptId = `${problem.problemId}:attempt`;
  };
  const ask = () => {
    ({ item, review } = queue[at]);
    board = buildBoard(item, random); tries = 0; hint = 0; askedMs = 0; phase = 'answering';
    present();
    if (!review) notify('problemPresented', { skillId: item.skillId, kind: item.kind });
  };
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null;
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, stars, reviewed, reviewCorrect, bestStreak, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };
  const next = () => {
    at++;
    // After the first round: the missed words once more.
    if (at === items.length && missedItems.length) queue = [...queue, ...missedItems.slice(0, R.reviewMax).map(it => ({ item: it, review: true }))];
    if (at >= queue.length) { complete(); return; }
    ask();
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !items?.length || items.some(it => !it.target.length || it.target.length > N)) return false;
      queue = items.map(it => ({ item: it, review: false })); at = 0;
      ask();
      return true;
    },
    update(dtMs) {
      if (!active || paused || !['answering', 'solved'].includes(phase) || !Number.isFinite(dtMs) || notifying) return;
      const dt = Math.max(0, Math.min(dtMs, 100));
      activeElapsedMs += dt;
      if (phase === 'solved') { if ((solvedLeft -= dt) <= 0) next(); return; }
      askedMs += dt;
      if (askedMs >= hintMs && hint === 0) hint = 1;
    },
    setPaused(value) { if (active) paused = !!value; },
    // A traced path of tiles (indices 0..24, each touching the one before, none twice).
    trace({ sessionId: s, attemptId: a, cells } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || s !== sessionId || a !== attemptId) return false;
      if (!Array.isArray(cells) || !cells.length || cells.some(c => !Number.isInteger(c) || c < 0 || c >= N)
        || new Set(cells).size !== cells.length || cells.some((c, k) => k > 0 && !touching(cells[k - 1], c))) return false;
      const word = cells.map(c => board.tiles[c]);
      if (cells.length !== item.target.length) {
        lastTrace = Object.freeze({ trace: ++serial, short: true, word: word.join(''), need: item.target.length });
        return false;
      }
      const right = word.join('') === item.target.join(''), first = tries === 0;
      const problemId = problem.problemId, committedAttempt = attemptId;
      const payload = { attemptId: committedAttempt, contentId: item.contentId, skillId: item.skillId, chosen: word.join('') };
      // Where the word goes wrong first (1-based), for the feedback.
      const wrongAt = right ? 0 : word.findIndex((ch, k) => ch !== item.target[k]) + 1;
      lastTrace = Object.freeze({ trace: ++serial, short: false, correct: right, first, review, word: word.join(''), answer: item.target.join(''),
        wrongAt, expected: wrongAt ? item.target[wrongAt - 1] : null, got: wrongAt ? word[wrongAt - 1] : null, explain: item.explain, cells: Object.freeze([...cells]) });
      if (!review && first) { answered++; if (right) correct++; else incorrect++; }
      if (review && first) { reviewed++; if (right) reviewCorrect++; }
      if (right) {
        const earned = tries > 0 ? 1 : hint > 0 ? 2 : 3;
        stars += earned; streak = tries === 0 ? streak + 1 : 0; bestStreak = Math.max(bestStreak, streak);
        lastSolved = Object.freeze({ solved: serial, stars: earned, review, word: item.target.join('') });
        notify(!review && first ? 'correct' : 'passed', payload, problemId);
        phase = 'solved'; solvedLeft = R.solvedMs; attemptId = `${problemId}:solved`;
      } else {
        streak = 0;
        if (!review && first) {
          missed.push(Object.freeze({ contentId: item.contentId, prompt: item.prompt, chosen: word.join(''), explain: item.explain, questionNumber: answered }));
          missedItems.push(item);
        }
        notify(!review && first ? 'incorrect' : 'retry', payload, problemId);
        tries++; hint = Math.max(hint, tries >= 2 ? 2 : 1);
        present();
      }
      return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'trace') return this.trace(command.payload);
      return false;
    },
    snapshot,
    exit() {
      if (!active) return;
      active = false; attemptId = null; aborted = phase !== 'completed'; observer = null;
    },
  };
}
