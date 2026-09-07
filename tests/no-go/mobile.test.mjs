import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {installStorage} from '../phase-a/storage-helper.mjs';
installStorage();
const {getDefaultSave,saveNow}=await import('../../src/core/saveData.js');
const {loadGameData,gameState,battleState,beginQuestion}=await import('../../src/core/gameState.js');
const {subscribe}=await import('../../src/core/eventBus.js');
const {default:review}=await import('../../src/screens/reviewStage.js');
const {default:battle}=await import('../../src/screens/battleScreen.js');
const {default:practice}=await import('../../src/screens/practiceBattleScreen.js');
const {default:quiz}=await import('../../src/screens/gradeQuizScreen.js');
const {BTN}=await import('../../src/screens/battle/theme.js');
const {getContainedRect}=await import('../../src/ui/viewportLayout.js');
const {gameToScreenCoordinates}=await import('../../src/utils/coordinateUtils.js');
const loader=await import('../../src/loaders/dataLoader.js');
globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(new URL('../../public'+url,import.meta.url),'utf8'))});await loader.loadAllGameData();
const points=b=>[[b.x+b.w/2,b.y+b.h/2],[b.x+2,b.y+2],[b.x+b.w-2,b.y+2],[b.x+2,b.y+b.h-2],[b.x+b.w-2,b.y+b.h-2]];
function fixture(t) {
 for(const key of ['log','warn','error'])t.mock.method(console,key,()=>{});
 const draws=[],texts=[];
 const ctx=new Proxy({fillRect:(...args)=>draws.push(args),fillText:(s,x,y)=>texts.push({s,x,y,font:ctx.font}),measureText:s=>({width:String(s).length*16}),createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}})}, {get:(o,k)=>k in o?o[k]:(()=>{})});
 const canvas=new EventTarget();Object.assign(canvas,{width:800,height:600,getContext:()=>ctx,getBoundingClientRect:()=>({left:13,top:27,width:390,height:700}),style:{},classList:{add(){},remove(){}}});
 const input=new EventTarget();Object.assign(input,{value:'',style:{setProperty(){},removeProperty(){}},focus(){},blur(){},setAttribute(){},removeAttribute(){},getBoundingClientRect:()=>({left:parseFloat(input.style.left)||0,top:parseFloat(input.style.top)||0,width:320,height:48})});
 globalThis.document={getElementById:id=>id==='gameCanvas'?canvas:input};
 return {canvas,ctx,input,draws,texts};
}
test('NEW-05: actual review back drawing and five CSS tap positions agree at 390px',async t=>{
 const {canvas}=fixture(t);const save=getDefaultSave();save.player.study.reviewQueueDetail=[{id:'g1-001',repetition:0,interval:0,eFactor:2.5,nextReviewAt:0}];saveNow(save,{replace:true});await loadGameData();
 review.enter(canvas);review.update(0);
 // Publicly exposed layout, or the original draw rectangle before the fix.
 const back=review.getControls?.().back||{x:20,y:20,w:100,h:30};
 let changes=0;subscribe('changeScreen',s=>{if(s==='stageSelect')changes++;});
 for(const [x,y]of points(back)) {const p=gameToScreenCoordinates(x,y,canvas);review._clickHandler({clientX:p.x,clientY:p.y});}
 assert.equal(changes,5,'all five visible points must return');
 const scale=getContainedRect(canvas.getBoundingClientRect(),800,600).scale;
 assert.ok(back.h*scale>=44);assert.ok(back.w*scale>=44);
 review.exit();
});
test('NEW-02/U01: effective practice update draws both completion commands at the actual tap rectangles',async t=>{
 const {canvas,ctx,input,draws,texts}=fixture(t);saveNow(getDefaultSave(),{replace:true});await loadGameData();
 Object.assign(practice,{canvas,ctx,inputEl:input,practiceComplete:true});
 practice.update(16);
 assert.ok(texts.some(t=>t.s==='もう1もん'));assert.ok(texts.some(t=>t.s==='今日はここまで'));
 const {getLearningControls}=await import('../../src/ui/learningControls.js');const controls=getLearningControls(canvas);
 for(const key of ['continue','finish']) {const b=controls[key];assert.ok(draws.some(r=>r.join() === [b.x,b.y,b.w,b.h].join()));}
});
for(const width of [390,768])test(`U01: battle targets have >=44 CSS px and five points hit each command at width ${width}`,t=>{
 const {canvas,ctx,input}=fixture(t);battle.canvas=canvas;battle.ctx=ctx;battle.inputEl=input;
 canvas.getBoundingClientRect=()=>({left:13,top:27,width,height:1024});
 gameState.currentStageId='hokkaido_area1';gameState.previousScreen='stageSelect';battleState.turn='player';battleState.inputEnabled=true;
 let target;subscribe('changeScreen',s=>target=s);
 let answers=0;battle._answerSubmission={submit(){answers++;}};
 gameState.currentKanji={id:'g1-001',text:'一',onyomi:['いち'],kunyomi:['ひと']};
 // Let the real handler refresh responsive geometry before measuring it.
 battle.handleClick({clientX:-10,clientY:-10,preventDefault(){}});
 const scale=getContainedRect(canvas.getBoundingClientRect(),800,600).scale;
 for(const key of ['stage','practice','attack','heal','hint']) {
   const b=BTN[key];assert.ok(b.h*scale>=44,`${key}: actual height ${b.h*scale}`);
   for(const [x,y] of points(b)) {
     target=null;gameState.hintLevel=0;const before=answers;const p=gameToScreenCoordinates(x,y,canvas);
     battle.handleClick({clientX:p.x,clientY:p.y,preventDefault(){}});
     if(key==='stage')assert.equal(target,'stageSelect');
     if(key==='practice')assert.ok(target==='practiceBattle'||Array.isArray(target)&&target[0]==='practiceBattle');
     if(['attack','heal'].includes(key))assert.equal(answers,before+1);
     if(key==='hint')assert.equal(gameState.hintLevel,1);
   }
 }
});

test('NEW-05/E09: review submit five CSS positions record once and reject composition taps',async t=>{
 const {canvas,input}=fixture(t);t.mock.timers.enable({apis:['setTimeout']});
 const save=getDefaultSave();save.player.study.reviewQueueDetail=[{id:'g1-001',repetition:0,interval:0,eFactor:2.5,nextReviewAt:0}];
 saveNow(save,{replace:true});await loadGameData();review.enter(canvas);review.update(0);
 for(const [i,[x,y]] of points(review.getControls().submit).entries()) {
   review.currentKanji._recordQuestion=beginQuestion('review');review._answerSubmission.unlock();input.value='いち';
   const p=gameToScreenCoordinates(x,y,canvas);const event={clientX:p.x,clientY:p.y};
   input.dispatchEvent(new Event('compositionstart'));review._clickHandler(event);
   assert.equal(gameState.kanjiAnswerStats['g1-001']?.correct||0,i);
   input.dispatchEvent(new Event('compositionend'));review._clickHandler(event);review._clickHandler(event);
   assert.equal(gameState.kanjiAnswerStats['g1-001'].correct,i+1);
 }
 review.exit();
});

test('T03/E08: zero due reviews hide input, schedule one return, and cancel it on leaving',async t=>{
 const {canvas,input}=fixture(t);saveNow(getDefaultSave(),{replace:true});await loadGameData();
 t.mock.timers.enable({apis:['setTimeout']});let changes=0;subscribe('changeScreen',()=>changes++);
 review.enter(canvas);review.update(16);assert.equal(input.style.display,'none');assert.ok(review.emptyMessage);
 const before=changes;review.exit();t.mock.timers.tick(2000);assert.equal(changes,before);
});

test('U01: quiz draws a 44 CSS px submit target and keeps it separate from the question and input',t=>{
 const {canvas,ctx,input,draws}=fixture(t);
 Object.assign(quiz,{canvas,ctx,inputEl:input,phase:'quiz',current:{kanji:'一'},order:['g1-001'],feedback:'',stageBgImage:null});
 quiz.update(16);
 const {scale}=getContainedRect(canvas.getBoundingClientRect(),800,600);
 assert.ok(draws.some(r=>r[1]>350&&r[2]*scale>=44&&r[3]*scale>=44),'visible answer button');
 assert.equal(input.style.height,'48px');
 const controls=quiz.getControls();
 assert.ok(controls.submit.h*scale>=44);
 const buttonTop=gameToScreenCoordinates(controls.submit.x,controls.submit.y,canvas).y;
 assert.ok(parseFloat(input.style.top)+48<buttonTop);
});

test('U01: actual battle rendering uses the same primary rectangles as its click handler',async t=>{
 const {canvas,ctx,input,draws}=fixture(t);saveNow(getDefaultSave(),{replace:true});await loadGameData();
 Object.assign(battle,{canvas,ctx,inputEl:input,stageBgImage:null});
 gameState.currentEnemy={id:'HKD-E01',hp:100,maxHp:100,atk:9};
 gameState.currentKanji={id:'g1-001',text:'一',onyomi:['いち'],kunyomi:['ひと']};
 globalThis.window={matchMedia:()=>({matches:true})};
 battle.update(16);
 for(const key of ['stage','practice','attack','heal','hint']) {
  const b=BTN[key];assert.ok(draws.some(r=>r.join()===[b.x,b.y,b.w,b.h].join()),key);
 }
 delete globalThis.window;
});

test('U04/E03: practice retry/save failure notice remains 16 CSS px at 390px',t=>{
 const {canvas,ctx,texts}=fixture(t);practice.canvas=canvas;practice.ctx=ctx;
 practice.nearMissNotice={lines:['ほぞんできませんでした。','もう一度こたえてね。'],until:Date.now()+5000};
 practice._drawNearMissNotice();
 assert.ok(texts.length>=2);
 for(const text of texts)assert.ok(Number(text.font.match(/([\d.]+)px/)[1])*390/800>=16);
});
