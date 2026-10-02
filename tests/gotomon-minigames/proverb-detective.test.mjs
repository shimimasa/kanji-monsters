import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installStorage } from '../phase-a/storage-helper.mjs';
import { getDefaultSave, loadSave } from '../../src/core/saveData.js';
import { loadGameData } from '../../src/core/gameState.js';
import { validateSave } from '../../src/core/saveValidation.js';
import { createGotomonService } from '../../src/minigames/gotomonService.js';
import { PROVERB_CASES, CASE_MASK } from '../../src/minigames/proverbDetective/proverbCases.js';
import { createProverbDetectiveGame, buildDetectiveCases, DETECTIVE_CASES } from '../../src/minigames/proverbDetective/proverbDetectiveGame.js';
import { createQuizWorld } from '../../src/minigames/gameplay/quizWorlds.js';
import { growthStatus } from '../../src/minigames/companionGrowth.js';

const source = JSON.parse(readFileSync(new URL('../../public/data/proverbs_final_400.json', import.meta.url), 'utf8'));

test('cases are the 90 elementary proverbs quoted in their examples, with kana readings and a masked question', () => {
  assert.equal(PROVERB_CASES.length, 90);
  const byId = new Map(source.map(item => [item.id, item]));
  for (const item of PROVERB_CASES) {
    const original = byId.get(item.id);
    assert.equal(original.difficulty, '小学生'); assert.equal(item.text, original.text); assert.equal(item.meaning, original.meaning);
    assert.match(item.reading, /^[ぁ-んー]+$/, item.text);
    assert.equal(item.question.split(CASE_MASK).length, 2, item.text);
    // The story never gives the answer away.
    assert.equal([...item.clues, item.question].join('').includes(item.text), false, item.text);
  }
  // Particles are written as particles, and the hand-checked slips are fixed.
  const reading = id => PROVERB_CASES.find(item => item.id === id).reading;
  assert.equal(reading(19), 'もちはもちや'); assert.equal(reading(48), 'もんぜんのこぞうならわぬきょうをよむ');
  assert.equal(reading(40), 'ねみみにみず'); assert.equal(reading(83), 'にとをおうものはいっとをもえず');
});

test('ten cases per run, four distinct suspects including the right one', () => {
  const cases = buildDetectiveCases({ sessionId: 's', random: () => .37 });
  assert.equal(cases.length, DETECTIVE_CASES); assert.equal(new Set(cases.map(item => item.caseId)).size, DETECTIVE_CASES);
  for (const item of cases) {
    assert.equal(item.choices.length, 4); assert.equal(new Set(item.choices.map(choice => choice.text)).size, 4);
    assert.equal(item.choices.find(choice => choice.choiceId === item.correctChoiceId).text, item.text);
    assert.ok(item.choices.every(choice => choice.meaning));
  }
});

test('a wrong suspect is ruled out, play goes on, and only a first-try solve counts as correct', () => {
  const events = [];
  const game = createProverbDetectiveGame({ sessionId: 'd', random: () => .21, onEvent: event => events.push(event) });
  game.enter();
  for (let index = 0; index < DETECTIVE_CASES; index++) {
    const state = game.snapshot(), problem = state.problem;
    const identity = { sessionId: 'd', problemId: problem.problemId, attemptId: state.attemptId };
    const wrong = problem.choices.find(choice => choice.choiceId !== problem.correctChoiceId);
    if (index % 3 === 0) {
      assert.equal(game.dispatch({ type: 'answer', payload: { ...identity, choiceId: wrong.choiceId } }), true);
      assert.deepEqual([...game.snapshot().ruledOut], [wrong.choiceId]); assert.equal(game.snapshot().phase, 'answering');
      assert.equal(game.snapshot().lastTry.ok, false);
      // The same wrong suspect cannot be named twice.
      assert.equal(game.dispatch({ type: 'answer', payload: { ...identity, choiceId: wrong.choiceId } }), false);
    }
    if (index === 1) { game.setPaused(true); assert.equal(game.dispatch({ type: 'answer', payload: { ...identity, choiceId: problem.correctChoiceId } }), false); game.setPaused(false); }
    assert.equal(game.dispatch({ type: 'answer', payload: { ...identity, choiceId: problem.correctChoiceId } }), true);
    assert.equal(game.dispatch({ type: 'answer', payload: { ...identity, choiceId: problem.correctChoiceId } }), false);
    if (index < DETECTIVE_CASES - 1) game.dispatch({ type: 'next', payload: { sessionId: 'd', problemId: problem.problemId } });
  }
  assert.deepEqual({ ...game.snapshot().result }, { answered: 10, correct: 6, incorrect: 4, accuracy: .6 });
  assert.equal(game.snapshot().missed.length, 4); assert.equal(game.snapshot().missed[0].tries, 2);
  // Only the kanji's readings are built; with the written kana they make the whole reading.
  for (const m of game.snapshot().missed) {
    let k = 0; const letters = [...m.build.answer];
    assert.equal(m.build.frame.map(p => p.kana ?? letters.slice(k, k += p.size).join('')).join(''), m.reading);
    assert.ok(m.build.answer.length < m.reading.length); assert.ok(m.build.note.includes(m.meaning));
  }
  // One learning outcome per case: wrong tries add no extra events.
  assert.equal(events.filter(event => ['correct', 'incorrect'].includes(event.type)).length, 10);
  assert.ok(events.filter(event => event.type === 'incorrect').every(event => event.payload.caseId && event.payload.tries === 2));
});

test('stars: a first try before the hint is 名推理, after the hint 2, after a wrong suspect 1', () => {
  const effects = growthStatus().effects;
  const solve = (wait, firstTry) => {
    const world = createQuizWorld('case', effects); world.context({ phase: 'answering', problem: { problemId: 'p' } });
    world.update(wait); world.answer(firstTry, { caseId: 7 }, 1); return world.snapshot();
  };
  assert.equal(solve(2000, true).cases[0].stars, 3); assert.equal(solve(2000, true).brilliant, 1);
  assert.equal(solve(10000, true).cases[0].stars, 2);
  assert.equal(solve(2000, false).cases[0].stars, 1);
  assert.match(solve(2000, false).summary, /事件を1件解決/);
});

test('case files keep best stars per proverb, feed the dex, and validate', async () => {
  const snapshot = getDefaultSave(); snapshot.player.name = '探偵QA'; snapshot.player.collection.gotomonIds = ['HKD-E01'];
  installStorage({ krb_save: JSON.stringify(snapshot) }); await loadGameData();
  const service = createGotomonService({ lookup: id => ({ id, name: id, grade: 1, category: '食文化' }) });
  const award = (sessionId, cases, gameId = 'proverbDetective') => {
    const args = { owner: service.getOwner(), sessionId, gameId, gotomonId: 'HKD-E01', score: 1500, correct: 8, maxCombo: 4,
      completed: true, finished: true, activeElapsedMs: 90000, cases };
    args.ticket = service.beginPlay(args); return service.awardGotomonPlayResult(args);
  };
  assert.deepEqual(award('one', [{ caseId: 5, stars: 1 }, { caseId: 7, stars: 3 }]).reward.newCases, ['5', '7']);
  assert.deepEqual(award('two', [{ caseId: 5, stars: 3 }]).reward.newCases, []);
  award('three', [{ caseId: 9, stars: 3 }], 'englishChoice');
  const files = service.getCaseFiles();
  assert.deepEqual(Object.keys(files).sort(), ['5', '7']); assert.equal(files['5'].stars, 3); assert.equal(files['5'].solves, 2);
  assert.doesNotThrow(() => validateSave(loadSave(), loadSave().meta.version));
  const broken = loadSave(); broken.player.miniGames.caseFiles = { abc: { stars: 2, solves: 1, firstAt: 1 } };
  assert.throws(() => validateSave(broken, broken.meta.version), /case file/i);
});
