import test from 'node:test';
import assert from 'node:assert/strict';
import { generateSessionProblems } from '../../src/minigames/mathSprint/mathSprintGenerator.js';
import { createMathSprintGame, normalizeMathAnswer } from '../../src/minigames/mathSprint/mathSprintGame.js';
import { bindMathSprintInput } from '../../src/minigames/mathSprint/mathSprintInput.js';

export const seeded = (seed = 1) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const make = (onEvent = () => {}, sessionId = 's1') => createMathSprintGame({ sessionId, random: seeded(), onEvent });
const answer = (game, value = game.snapshot().problem.answer) => {
  const { sessionId, token } = game.snapshot(); return game.submit({ sessionId, token, value });
};
test('generator: deterministic ten, 5+5, legal operands and answers, no exact duplicate across 1000 seeds', () => {
  for (let seed = 0; seed < 1000; seed++) {
    const generate = () => generateSessionProblems({ sessionId: 'seed', random: seeded(seed) });
    const questions = generate(); assert.deepEqual(questions, generate()); assert.equal(questions.length, 10);
    assert.equal(questions.filter(q => q.operation === 'addition').length, 5);
    assert.equal(questions.filter(q => q.operation === 'subtraction').length, 5);
    assert.equal(new Set(questions.map(q => `${q.a}:${q.operation}:${q.b}`)).size, 10);
    for (const q of questions) {
      assert.ok(Number.isInteger(q.a) && Number.isInteger(q.b));
      assert.ok(q.a >= 1 && q.a <= (q.operation === 'addition' ? 8 : 9));
      assert.ok(q.b >= 1 && q.b <= (q.operation === 'addition' ? 9 - q.a : q.a));
      assert.equal(q.answer, q.operation === 'addition' ? q.a + q.b : q.a - q.b);
      assert.ok(q.answer >= 0 && q.answer <= 9);
    }
  }
});
test('generator: constant random terminates with exactly 88 calls, invalid RNG fails boundedly', () => {
  let calls = 0; generateSessionProblems({ sessionId: 's', random: () => { calls++; return 0; } });
  assert.equal(calls, 88);
  for (const invalid of [1, -1, NaN, Infinity]) assert.throws(() => generateSessionProblems({ random: () => invalid }), RangeError);
});
for (const [raw, expected] of [[' ０ ',0], ['１２',12], ['9',9], ['00',0], ['',null], ['  ',null],
  ['+',null],['-2',null],['2abc',null],['2.0',null],['1e1',null],['∞',null],['9 0',null],['9007199254740992',null]]) {
  test(`normalize full integer ${JSON.stringify(raw)}`, () => assert.equal(normalizeMathAnswer(raw), expected));
}
test('mixed answers commit before notification, result and complete exactly once', () => {
  const events = []; let game;
  game = make(e => {
    const s = game.snapshot();
    if (['correct','incorrect'].includes(e.type)) {
      assert.equal(s.token, null); assert.equal(s.answered, events.filter(x => ['correct','incorrect'].includes(x.type)).length + 1);
      assert.equal(s.answered, s.correct + s.incorrect);
    }
    events.push(e);
  });
  game.enter();
  for (let i = 0; i < 10; i++) {
    const before = game.snapshot(), value = before.problem.answer + (i === 2 || i === 7 ? 1 : 0);
    assert.equal(answer(game, value), true); assert.equal(answer(game, value), false);
    if (i < 9) assert.equal(game.next(before.sessionId, before.problem.problemId), true);
  }
  const result = game.snapshot().result;
  assert.deepEqual(result, { answered:10, correct:8, incorrect:2, accuracy:.8, maxStreak:4 });
  assert.ok(Object.isFrozen(result));
  for (let i = 0; i < 10; i++) { game.update(16); game.enter(); game.snapshot(); answer(game); }
  assert.equal(game.snapshot().result, result);
  assert.equal(events.length, 21); assert.equal(events.filter(e => e.type === 'sessionComplete').length, 1);
  assert.deepEqual(events.map(e => e.seq), Array.from({length:21}, (_,i)=>i+1));
  assert.ok(events.every(e => e.sessionId === 's1' && e.gameId === 'mathSprint' && Object.isFrozen(e.payload)));
});
test('old token/session and stale Next rejected; empty input does not consume token', () => {
  const game = make(); game.enter(); const old = game.snapshot();
  assert.equal(answer(game, ''), false); assert.equal(game.snapshot().token, old.token);
  assert.equal(game.submit({ sessionId:'other', token:old.token, value:old.problem.answer }), false);
  answer(game); game.next(old.sessionId, old.problem.problemId);
  assert.equal(game.submit({ sessionId:old.sessionId, token:old.token, value:old.problem.answer }), false);
  assert.equal(game.next(old.sessionId, old.problem.problemId), false);
  assert.equal(game.snapshot().answered, 1);
});
test('pause stops active time/input; abort is not completed and exit is idempotent', () => {
  const events=[]; const game=make(e=>events.push(e)); game.enter(); game.update(15);
  game.setPaused(true); game.update(500); assert.equal(answer(game),false); assert.equal(game.snapshot().activeElapsedMs,15);
  game.setPaused(false); game.update(10); assert.equal(answer(game),true);
  game.exit(); game.exit(); assert.equal(game.snapshot().aborted,true); assert.equal(game.snapshot().result,null);
  assert.equal(answer(game),false); assert.equal(events.filter(e=>e.type==='sessionComplete').length,0);
});
for (const observer of [() => { throw Error('visual'); }, () => false, () => new Promise(() => {}), () => Promise.reject(Error('visual'))]) {
  test('observer exception/return/Promise never gates progress', async () => {
    const game=make(observer); game.enter();
    for(let i=0;i<10;i++){assert.equal(answer(game),true); const s=game.snapshot(); if(i<9)assert.equal(game.next(s.sessionId,s.problem.problemId),true);}
    assert.equal(game.snapshot().result.correct,10); await new Promise(r=>setImmediate(r));
  });
}
test('observer reentrancy cannot submit/advance during notification', () => {
  let game; game=make(e=>{ if(e.type==='problemPresented')assert.equal(answer(game),false); if(e.type==='correct'){const s=game.snapshot();assert.equal(game.next(s.sessionId,s.problem.problemId),false);} });
  game.enter(); assert.equal(answer(game),true); assert.equal(game.snapshot().answered,1);
});
function key(target, fields={}) { const e=new Event('keydown',{cancelable:true}); Object.assign(e,{key:'Enter',...fields}); target.dispatchEvent(e); }
test('actual shared input gate: Enter/button simultaneous, repeat, IME, pause, dispose and old callback', () => {
  const game=make(); game.enter(); const s=game.snapshot();
  const input=Object.assign(new EventTarget(),{value:String(s.problem.answer)}), button=new EventTarget();
  const binding=bindMathSprintInput(input,button,{sessionId:s.sessionId,token:s.token},a=>game.submit(a),()=>!game.snapshot().paused);
  key(input,{repeat:true}); assert.equal(game.snapshot().answered,0);
  input.dispatchEvent(new Event('compositionstart')); key(input); button.dispatchEvent(new Event('click')); assert.equal(game.snapshot().answered,0);
  input.dispatchEvent(new Event('compositionend')); key(input,{isComposing:true}); key(input,{keyCode:229}); assert.equal(game.snapshot().answered,0);
  game.setPaused(true); key(input); game.setPaused(false);
  key(input); button.dispatchEvent(new Event('click')); key(input); assert.equal(game.snapshot().answered,1);
  game.next(s.sessionId,s.problem.problemId); binding.dispose(); binding.dispose(); key(input); button.dispatchEvent(new Event('click'));
  assert.equal(game.snapshot().answered,1);
});
test('button alone submits; invalid whole input remains unanswered and can retry',()=>{
  const game=make();game.enter();const s=game.snapshot(),input=Object.assign(new EventTarget(),{value:'2abc'}),button=new EventTarget();
  const b=bindMathSprintInput(input,button,{sessionId:s.sessionId,token:s.token},a=>game.submit(a),()=>true);
  button.dispatchEvent(new Event('click'));assert.equal(game.snapshot().answered,0);
  input.value=String(s.problem.answer);button.dispatchEvent(new Event('click'));assert.equal(game.snapshot().answered,1);b.dispose();
});
