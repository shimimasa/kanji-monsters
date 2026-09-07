import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { installStorage, quota } from '../phase-a/storage-helper.mjs';
const storage = installStorage();
const { getDefaultSave, saveNow } = await import('../../src/core/saveData.js');
const { gameState, battleState, loadGameData, beginQuestion } = await import('../../src/core/gameState.js');
const { bindInputSubmission } = await import('../../src/core/answerSubmission.js');
const { createScreenLifecycle } = await import('../../src/core/screenLifecycle.js');
const { subscribe } = await import('../../src/core/eventBus.js');
const { getLearningControls } = await import('../../src/ui/learningControls.js');
globalThis.fetch = async url => ({ok:true,json:async()=>JSON.parse(fs.readFileSync(new URL('../../public'+url, import.meta.url),'utf8'))});
const loader = await import('../../src/loaders/dataLoader.js');
await loader.loadAllGameData();
const {default:battle} = await import('../../src/screens/battleScreen.js');
const {default:practice} = await import('../../src/screens/practiceBattleScreen.js');
const {default:quiz} = await import('../../src/screens/gradeQuizScreen.js');
const {default:quickReview} = await import('../../src/screens/quickReviewPracticeScreen.js');
class Input extends EventTarget {
  value=''; style={setProperty(){},removeProperty(){}};
  focus(){} blur(){} setAttribute(){} removeAttribute(){}
}
const canvas={width:800,height:600,style:{},getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})};
async function reset(t, screen) {
  t.mock.method(console,'log',()=>{}); t.mock.method(console,'warn',()=>{}); t.mock.method(console,'error',()=>{});
  storage.fail=null; saveNow(getDefaultSave(),{replace:true}); await loadGameData();
  const timers=new Map(); let id=0;
  t.mock.method(globalThis,'setTimeout',(fn,ms)=>{timers.set(++id,{fn,ms});return id;});
  t.mock.method(globalThis,'clearTimeout',id=>timers.delete(id));
  Object.assign(gameState,{currentStageId:'hokkaido_area1',kanjiPool:loader.getKanjiByStageId('hokkaido_area1'),
    currentKanji:{id:'g1-001',text:'一',kanji:'一',onyomi:['いち'],kunyomi:['ひと'],_recordQuestion:beginQuestion(screen.recordSource||'battle')},
    hintLevel:0,correctKanjiList:[],wrongKanjiList:[],newlyReadKanjiList:[],
    currentEnemy:{id:'HKD-E01',hp:100,maxHp:100,weakness:'kunyomi',atk:9,isBoss:false}});
  gameState.enemies=[gameState.currentEnemy];
  Object.assign(battleState,{inputEnabled:true,turn:'player',nearMissCount:0,log:[],recentKanjiIds:[],retryQueue:[]});
  screen.canvas=canvas; screen.inputEl=new Input(); screen._active=true;
  screen._lifecycle=createScreenLifecycle(); screen._lifecycle.activate();
  for(const key of ['startKanjiBoxEffect','startStoneAttackEffect','showLogBlock','startComboAnimation']) t.mock.method(screen,key,()=>{});
  t.after(()=>{storage.fail=null;screen._answerSubmission?.dispose();screen._lifecycle.deactivate();});
  return {timers,run(ms){for(const [id,timer] of [...timers]) if(timer.ms===ms){timers.delete(id);timer.fn();}}};
}
const injectQuota=()=>{storage.fail=(op,key)=>{if(op==='set'&&key==='yomitabi_phase_a_pending')throw quota();};};
function submit(screen,value) {screen.inputEl.value=value;return screen._answerSubmission.handleKeydown({key:'Enter',preventDefault(){}},value);}

test('T03/T04: quick review forwards learning outcome and schedules the next question once',async t=>{
  const clock=await reset(t,quickReview);
  Object.assign(quickReview,{practiceComplete:false,reviewMode:false,pendingReviewIds:new Set(['g1-001']),masteredThisSession:new Set()});
  quickReview._setupPracticeKeyHandler();submit(quickReview,'いち');submit(quickReview,'いち');
  assert.equal(gameState.kanjiAnswerStats['g1-001'].correct,1);
  assert.equal([...clock.timers.values()].filter(t=>t.ms===1100).length,1);
});

test('NEW-01: practice wrong → feedback → correction is a new supported attempt, repeated Enter is not',async t=>{
  const clock=await reset(t,practice); practice.practiceComplete=false;practice.reviewMode=false;
  practice._setupPracticeKeyHandler();
  assert.equal(submit(practice,'ねこ').accepted,true);
  assert.equal(practice.lastIncorrectAnswer,'ねこ');
  assert.equal(submit(practice,'いち').accepted,false);
  clock.run(2200);
  assert.equal(submit(practice,'いち').accepted,true);
  submit(practice,'いち');submit(practice,'いち');
  const stats=gameState.kanjiAnswerStats['g1-001'];
  assert.equal(stats.correct,1);assert.equal(stats.incorrect,1);
  assert.equal(stats.lastObservation.support,'revealed');
  assert.equal(JSON.parse(storage.getItem('krb_save')).player.study.answers['g1-001'].correct,1);
  assert.equal([...clock.timers.values()].filter(t=>t.ms===1100).length,1);
  clock.run(1100);assert.equal(battleState.inputEnabled,true);
});
test('NEW-02: completion command accepts blank Enter without recording; ordinary blank stays rejected',async t=>{
  await reset(t,practice);practice.practiceComplete=false;practice._setupPracticeKeyHandler();
  assert.equal(submit(practice,'').accepted,false);
  practice._completePractice();
  const before=gameState.playerStats.totalCorrect;
  submit(practice,'');
  assert.equal(practice.practiceComplete,false);assert.equal(practice.reviewMode,true);
  assert.equal(battleState.inputEnabled,true);assert.equal(practice._answerSubmission.locked,false);
  assert.equal(gameState.playerStats.totalCorrect,before);
});
for(const command of ['handleAttack','handleHeal']) for(const correct of [true,false]) {
  test(`NEW-03: ${command} ${correct?'correct':'wrong'} quota → same question retry commits exactly once`,async t=>{
    const clock=await reset(t,battle);
    battle._answerSubmission=bindInputSubmission(battle.inputEl,()=>{if(!battleState.inputEnabled)return false;battle[command]();return !battleState.inputEnabled;});
    const raw=storage.getItem('krb_save'); const combo=gameState.playerStats.comboCount;
    injectQuota();submit(battle,correct?'いち':'ねこ');
    assert.equal(storage.getItem('krb_save'),raw);assert.equal(battleState.inputEnabled,true);
    assert.equal(battle._answerSubmission.locked,false);assert.equal(gameState.correctKanjiList.length,0);
    assert.equal(gameState.wrongKanjiList.length,0);assert.equal(gameState.playerStats.comboCount,combo);
    assert.equal(clock.timers.size,0);
    storage.fail=null;submit(battle,correct?'いち':'ねこ');submit(battle,correct?'いち':'ねこ');
    assert.equal(gameState.kanjiAnswerStats['g1-001'][correct?'correct':'incorrect'],1);
    assert.equal(JSON.parse(storage.getItem('krb_save')).player.study.answers['g1-001'][correct?'correct':'incorrect'],1);
    assert.equal(gameState[correct?'correctKanjiList':'wrongKanjiList'].length,1);
  });
}
test('NEW-04: real quiz handler quota → retry has one answer, one saved answer, one next-question timer',async t=>{
  const clock=await reset(t,battle);
  Object.assign(quiz,{current:{id:'g1-001',readings:['いち'],_recordQuestion:beginQuestion('quiz')},locked:false,nearMissCount:0,inputEl:new Input(),stats:{correct:0,wrong:0,answers:[]},_lifecycle:battle._lifecycle});
  const raw=storage.getItem('krb_save');injectQuota();
  assert.equal(quiz._checkAnswer('いち'),false);assert.equal(storage.getItem('krb_save'),raw);
  assert.equal(quiz.stats.correct,0);assert.equal(quiz.stats.answers.length,0);assert.equal(clock.timers.size,0);
  storage.fail=null;assert.equal(quiz._checkAnswer('いち'),true);assert.equal(quiz._checkAnswer('いち'),false);
  assert.equal(quiz.stats.correct,1);assert.equal(quiz.stats.answers.length,1);
  assert.equal(gameState.kanjiAnswerStats['g1-001'].correct,1);assert.equal(clock.timers.size,1);
  assert.equal(JSON.parse(storage.getItem('krb_save')).player.study.answers['g1-001'].correct,1);
});

for(const correct of [true,false]) test(`E03/T03: practice ${correct?'correct':'wrong'} quota preserves screen counters and allows retry`,async t=>{
 const clock=await reset(t,practice);practice.practiceComplete=false;practice.reviewMode=false;practice._setupPracticeKeyHandler();
 const before=JSON.stringify(practice.practiceStats);const raw=storage.getItem('krb_save');
 injectQuota();submit(practice,correct?'いち':'ねこ');
 assert.equal(storage.getItem('krb_save'),raw);assert.equal(JSON.stringify(practice.practiceStats),before);
 assert.equal(battleState.inputEnabled,true);assert.equal(practice._answerSubmission.locked,false);assert.equal(clock.timers.size,0);
 storage.fail=null;submit(practice,correct?'いち':'ねこ');submit(practice,correct?'いち':'ねこ');
 assert.equal(gameState.kanjiAnswerStats['g1-001'][correct?'correct':'incorrect'],1);
});

for(const level of [0,1,4])test(`T04: actual attack with hint level ${level} keeps success and observation separate`,async t=>{
 await reset(t,battle);gameState.hintLevel=level;battle.inputEl.value='いち';battle.handleAttack();
 assert.equal(gameState.kanjiAnswerStats['g1-001'].correct,1);assert.equal(gameState.correctKanjiList.length,1);
 assert.equal(gameState.kanjiAnswerStats['g1-001'].lastObservation.support,['independent','hint1',null,null,'revealed'][level]);
});

test('T03/E09: actual quiz blank and near miss stay retryable, composition Enter does not count',async t=>{
 await reset(t,battle);
 Object.assign(quiz,{current:{id:'g1-001',readings:['がく'],_recordQuestion:beginQuestion('quiz')},locked:false,nearMissCount:0,inputEl:new Input(),stats:{correct:0,wrong:0,answers:[]},_lifecycle:battle._lifecycle});
 quiz._answerSubmission=bindInputSubmission(quiz.inputEl,value=>quiz._checkAnswer(value));
 assert.equal(submit(quiz,'').accepted,false);assert.equal(submit(quiz,'かく').accepted,false);
 assert.equal(quiz.stats.answers.length,0);quiz._answerSubmission.compositionStart();
 assert.equal(submit(quiz,'がく').accepted,false);quiz._answerSubmission.compositionEnd();
 submit(quiz,'がく');submit(quiz,'がく');assert.equal(quiz.stats.answers.length,1);quiz._answerSubmission.dispose();
});
test('NEW-02: completion finish is a command and adds no learning record',async t=>{
  await reset(t,practice);practice.practiceComplete=false;practice._setupPracticeKeyHandler();practice._completePractice();
  const raw=storage.getItem('krb_save');let target;subscribe('changeScreen',s=>target=s);
  const b=getLearningControls(canvas).finish;
  practice.handleClick({clientX:b.x+b.w/2,clientY:b.y+b.h/2,preventDefault(){}});
  assert.equal(target,'stageSelect');assert.equal(storage.getItem('krb_save'),raw);
});
for(const screen of [practice,battle]) test(`E09: ${screen===practice?'practice':'battle'} actual bound IME events distinguish composition and answer`,async t=>{
  await reset(t,screen);practice.practiceComplete=false;practice.reviewMode=false;
  if(screen===practice)practice._setupPracticeKeyHandler();
  else battle._answerSubmission=bindInputSubmission(battle.inputEl,()=>{battle.handleAttack();return !battleState.inputEnabled;});
  screen.inputEl.value='いち';screen.inputEl.dispatchEvent(new Event('compositionstart'));
  const enter=()=>{const event=new Event('keydown',{cancelable:true});Object.defineProperty(event,'key',{value:'Enter'});screen.inputEl.dispatchEvent(event);};
  enter();assert.equal(gameState.kanjiAnswerStats['g1-001']?.correct||0,0);
  screen.inputEl.dispatchEvent(new Event('compositionend'));enter();enter();
  assert.equal(gameState.kanjiAnswerStats['g1-001'].correct,1);
});
for(const answer of ['いち','ねこ','defeat'])test(`E08: actual battle exit after ${answer} invalidates timeout and rAF work`,async t=>{
  const clock=await reset(t,battle);const frames=new Map();let frameId=0;
  globalThis.requestAnimationFrame=fn=>{frames.set(++frameId,fn);return frameId;};
  globalThis.cancelAnimationFrame=id=>frames.delete(id);
  globalThis.window={matchMedia:()=>({matches:true})};
  const el={style:{},classList:{remove(){},add(){}}};
  globalThis.document={documentElement:el,body:el,getElementById:()=>null};
  if(answer==='defeat')gameState.currentEnemy.hp=1;
  battle.inputEl.value=answer==='ねこ'?answer:'いち';battle.handleAttack();
  const oldCallbacks=[...clock.timers.values()].map(t=>t.fn),oldFrames=[...frames.values()];
  battle.exit();assert.equal(frames.size,0);
  gameState.currentKanji={id:'new-screen'};battleState.turn='new-screen';
  for(const callback of [...oldCallbacks,...oldFrames])callback();
  assert.equal(gameState.currentKanji.id,'new-screen');assert.equal(battleState.turn,'new-screen');
  t.after(()=>{delete globalThis.document;delete globalThis.window;delete globalThis.requestAnimationFrame;delete globalThis.cancelAnimationFrame;});
});

