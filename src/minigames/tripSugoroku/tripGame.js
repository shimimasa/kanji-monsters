import { readingQuestion } from '../photoRally/photoRallyContent.js';
import { buildDetectiveCases } from '../proverbDetective/proverbDetectiveGame.js';
import { readingTarget } from '../buildReview.js';

export const TRIP_COLUMNS = 4;
export const BOSS_HP = 5;
export const BOSS_QUESTIONS = 6;

export const NODE_TYPES = Object.freeze({
  reading: { label: '読みの勝負', icon: '📖', note: '漢字の読み2問。2問とも1回で読めたら🔥' },
  training: { label: '修行の道', icon: '🔥', note: '苦手な漢字2問。がんばると⭐' },
  proverb: { label: 'ことわざの社', icon: '📜', note: 'ことわざ1問。当てると🔥' },
  chest: { label: '宝箱', icon: '🎁', note: '道具がひとつ手に入る' },
  rest: { label: '休けい所', icon: '⛺', note: '相棒と休んで🔥' },
});
export const ITEMS = Object.freeze({
  hint: { label: 'ヒントの火', icon: '🔥', note: 'まちがいの答えが2つ消える' },
  power: { label: 'きらきら', icon: '⭐', note: 'ボスへの次の正解が2ダメージ' },
});

function take(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new TypeError('random must return a finite value in [0, 1)');
  return value;
}
const pick = (items, random) => items[Math.floor(take(random) * items.length)];
function shuffled(items, random) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(take(random) * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}

// Four columns of two different stops. Every column offers a stop with questions, and
// question-free stops (宝箱・休けい所) are capped so a trip always carries some learning.
const QUESTION_STOPS = ['reading', 'training', 'proverb'], FREE_STOPS = ['chest', 'rest'], FREE_LIMIT = 2;
export function buildTripMap(random) {
  let free = 0;
  return Object.freeze(Array.from({ length: TRIP_COLUMNS }, (_, column) => {
    const first = column === 0 ? 'reading' : pick(QUESTION_STOPS, random);
    const options = [...QUESTION_STOPS.filter(kind => kind !== first), ...(free < FREE_LIMIT ? FREE_STOPS : [])];
    const second = pick(options, random);
    if (FREE_STOPS.includes(second)) free++;
    return Object.freeze(shuffled([first, second], random).map((type, index) => Object.freeze({ nodeId: `c${column}-${index}`, type, column })));
  }));
}

// Nonpersistent Core. Content (stage, boss, checked kanji readings) comes from the caller.
// Nothing is lost on the way: every stop gives something, and the boss only leaves.
export function createTripGame({ sessionId, random = Math.random, onEvent = () => {}, content }) {
  const stage = content?.stage ?? null, boss = content?.boss ?? null, monsters = content?.monsters ?? [];
  const pool = content?.readings ?? { ordered: [], all: [] };
  const focusIds = new Set(content?.focusKanjiIds ?? []);
  const map = buildTripMap(random);
  const proverbs = buildDetectiveCases({ sessionId, random });
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', column = 0, seq = 0, activeElapsedMs = 0, questionSerial = 0, proverbIndex = 0;
  let answered = 0, correct = 0, incorrect = 0, result = null, lastAnswer = null, aborted = false, completeEmitted = false;
  let problem = null, attemptId = null, hidden = [], steps = [], node = null, nodeCorrect = 0, nodeAsked = 0;
  let opponent = null, reward = null, powerArmed = false;
  const items = { hint: 1, power: 0 };
  const path = [], used = new Set(), missed = [];
  const bossState = { hp: BOSS_HP, asked: 0, damage: 0 };

  const snapshot = () => Object.freeze({
    gameId: 'tripSugoroku', mode: 'trip', stage, sessionId, phase, paused, active, aborted, seq, activeElapsedMs,
    map, column, path: Object.freeze([...path]), node, opponent, items: Object.freeze({ ...items }), powerArmed, reward,
    boss: boss ? Object.freeze({ ...boss, ...bossState, maxHp: BOSS_HP }) : null,
    problem, attemptId, hiddenChoiceIds: Object.freeze([...hidden]),
    answered, correct, incorrect, result, lastAnswer, missed: Object.freeze([...missed]),
  });
  const notify = (type, payload = {}) => {
    const event = Object.freeze({ version: 1, gameId: 'tripSugoroku', sessionId, seq: ++seq, type,
      problemId: problem?.problemId ?? null, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };

  const nextKanji = ({ focus = false } = {}) => {
    const candidates = pool.ordered.filter(item => !used.has(item.kanji.id));
    const preferred = focus ? candidates.filter(item => focusIds.has(item.kanji.id)) : [];
    for (const item of [...preferred, ...candidates]) {
      used.add(item.kanji.id);
      const question = readingQuestion(item, pool.all, random, `${sessionId}:trip:${++questionSerial}:${item.kanji.id}`);
      if (question) return Object.freeze({ ...question, kind: 'kanji' });
    }
    return null;
  };
  const nextProverb = () => {
    const item = proverbs[proverbIndex++ % proverbs.length];
    return Object.freeze({ ...item, kind: 'proverb', problemId: `${sessionId}:trip:${++questionSerial}:proverb-${item.caseId}` });
  };
  const present = question => {
    if (!question) return false;
    problem = question; attemptId = `${problem.problemId}:attempt`; hidden = []; lastAnswer = null; phase = 'answering';
    notify('problemPresented', { skillId: problem.skillId, stop: node?.type ?? 'boss',
      choiceIds: Object.freeze(problem.choices.map(choice => choice.choiceId)) });
    return true;
  };
  const gain = (item, text) => { if (item) items[item]++; reward = Object.freeze({ item, text }); phase = 'reward'; problem = null; };
  const finishNode = () => {
    const type = node.type;
    if (type === 'reading') {
      if (nodeCorrect === nodeAsked && nodeAsked > 0) return gain('hint', '2問とも1回で読めた！ ヒントの火を手に入れた');
      return gain(null, `読みの勝負をやりとげた！ ${opponent?.name ?? ''}が道をあけてくれた`);
    }
    if (type === 'training') return gain('power', '修行をやりとげた！ きらきらを手に入れた');
    if (type === 'proverb') return nodeCorrect ? gain('hint', 'ことわざを見ぬいた！ ヒントの火を手に入れた')
      : gain(null, 'ことわざをひとつ覚えた！ 社の主が道をあけてくれた');
    return gain(null, '');
  };
  const startBoss = () => { node = null; opponent = boss; column = TRIP_COLUMNS; reward = null; if (!present(nextKanji())) complete(); };
  const complete = () => {
    const defeated = bossState.hp <= 0;
    const stars = defeated ? 3 : bossState.damage >= 3 ? 2 : 1;
    phase = 'completed'; problem = null; attemptId = null;
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, bossDefeated: defeated,
      bossDamage: bossState.damage, stars, finished: true, journey: Object.freeze({ stageId: stage?.stageId ?? null, stars }) });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };
  const identityOk = (sourceSession, problemId, sourceAttempt) =>
    sourceSession === sessionId && problemId === problem?.problemId && sourceAttempt === attemptId;

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !pool.ordered.length || !boss) return false;
      phase = 'map'; return true;
    },
    update(dtMs) {
      if (active && !paused && !['ready', 'completed'].includes(phase) && Number.isFinite(dtMs)) activeElapsedMs += Math.max(0, dtMs);
    },
    setPaused(value) { if (active) paused = !!value; },
    move({ sessionId: sourceSession, nodeId } = {}) {
      if (!active || paused || notifying || phase !== 'map' || sourceSession !== sessionId) return false;
      const target = map[column]?.find(item => item.nodeId === nodeId);
      if (!target) return false;
      node = target; path.push(nodeId); nodeCorrect = 0; nodeAsked = 0; reward = null;
      opponent = target.type === 'reading' ? pick(monsters, random) ?? null : null;
      if (target.type === 'chest') { const item = take(random) < .5 ? 'hint' : 'power'; gain(item, `宝箱から${ITEMS[item].label}が出てきた！`); return true; }
      if (target.type === 'rest') { gain('hint', '相棒とひと休み。ヒントの火を手に入れた'); return true; }
      steps = target.type === 'proverb' ? [nextProverb] : target.type === 'training' ? [() => nextKanji({ focus: true }), () => nextKanji({ focus: true })] : [nextKanji, nextKanji];
      if (!present(steps.shift()())) finishNode();
      return true;
    },
    useItem({ sessionId: sourceSession, item } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || sourceSession !== sessionId || !ITEMS[item] || items[item] < 1) return false;
      if (item === 'hint') {
        if (hidden.length) return false;
        hidden = shuffled(problem.choices.filter(choice => choice.choiceId !== problem.correctChoiceId), random).slice(0, 2).map(choice => choice.choiceId);
      } else {
        if (column < TRIP_COLUMNS || powerArmed) return false; // きらきら is for the boss.
        powerArmed = true;
      }
      items[item]--; return true;
    },
    answer({ sessionId: sourceSession, problemId, attemptId: sourceAttempt, choiceId } = {}) {
      if (!active || paused || notifying || phase !== 'answering' || !identityOk(sourceSession, problemId, sourceAttempt)) return false;
      const choice = problem.choices.find(candidate => candidate.choiceId === choiceId);
      if (!choice || hidden.includes(choiceId)) return false;
      const committedAttempt = attemptId;
      attemptId = null;
      const isCorrect = choiceId === problem.correctChoiceId;
      answered++; nodeAsked++;
      let damage = 0;
      if (isCorrect) {
        correct++; nodeCorrect++;
        if (column >= TRIP_COLUMNS) { damage = powerArmed ? 2 : 1; powerArmed = false; bossState.hp = Math.max(0, bossState.hp - damage); bossState.damage += damage; }
      } else {
        incorrect++;
        missed.push(Object.freeze({ contentId: problem.contentId, kind: problem.kind, text: problem.kind === 'kanji' ? problem.kanji : problem.text,
          answer: problem.kind === 'kanji' ? problem.reading : problem.meaning, chosen: choice.text, questionNumber: answered,
          build: problem.kind === 'kanji' ? readingTarget({ word: problem.kanji, reading: problem.reading, sentence: problem, others: problem.choices.filter(c => c.choiceId !== problem.correctChoiceId).map(c => c.text) }) : null }));
      }
      if (column >= TRIP_COLUMNS) bossState.asked++;
      lastAnswer = Object.freeze({ attemptId: committedAttempt, choiceId, correctChoiceId: problem.correctChoiceId, correct: isCorrect, damage });
      phase = 'feedback';
      notify(isCorrect ? 'correct' : 'incorrect', { attemptId: committedAttempt, choiceId, correctChoiceId: problem.correctChoiceId,
        contentId: problem.contentId, skillId: problem.skillId, stop: node?.type ?? 'boss', damage });
      return true;
    },
    next({ sessionId: sourceSession } = {}) {
      if (!active || paused || notifying || sourceSession !== sessionId || !['feedback', 'reward'].includes(phase)) return false;
      if (phase === 'feedback' && column >= TRIP_COLUMNS) {
        if (bossState.hp <= 0 || bossState.asked >= BOSS_QUESTIONS || !present(nextKanji())) complete();
        return true;
      }
      if (phase === 'feedback' && steps.length) { if (!present(steps.shift()())) finishNode(); return true; }
      if (phase === 'feedback') { finishNode(); return true; }
      // After a reward the trip moves on to the next column, or to the boss.
      column++; node = null; opponent = null; reward = null;
      if (column >= TRIP_COLUMNS) startBoss(); else phase = 'map';
      return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'move') return this.move(command.payload);
      if (command.type === 'answer') return this.answer(command.payload);
      if (command.type === 'useItem') return this.useItem(command.payload);
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
