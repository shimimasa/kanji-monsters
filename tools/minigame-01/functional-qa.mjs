// Isolated Chrome + artificial E0 fixture only. All timers here are test-driver waits.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {connect} from '../motion-02/cdp.mjs';
const [fixturePath,out]=process.argv.slice(2);
if(!fixturePath||!out)throw Error('artificial-fixture.json new-output-directory required');
await fs.mkdir(out,{recursive:true});
const fixture=JSON.parse(await fs.readFile(fixturePath,'utf8'));
assert.equal(fixture.manifest?.runId,'e0-cert-01');assert.match(fixture.manifest?.method??'',/Fresh MemoryStorage/);
// Each invocation gets a fresh target; old init scripts must not wrap globals twice.
const origin='http://127.0.0.1:49751',bootstrap=await connect(49752);
const {targetId}=await bootstrap.call('Target.createTarget',{url:'about:blank'});
const tabs=await(await fetch('http://127.0.0.1:49752/json/list')).json();
for(const tab of tabs)if(tab.type==='page'&&tab.id!==targetId&&(tab.url==='about:blank'||tab.url.startsWith(origin+'/'))){
  await bootstrap.call('Target.closeTarget',{targetId:tab.id});
}
bootstrap.close();
const c=await connect(49752);
const tracing = process.env.MINIGAME_TRACE === '1';
const evidence={checks:[],blocked:[],externalSuccess:[],exceptions:[],screenshots:[],performance:[]};
let imageMode='normal',heldImages=[];
c.on(m=>{
  if(m.method==='Fetch.requestPaused'){
    const p=m.params,u=p.request.url,local=u.startsWith(origin+'/')||u.startsWith('data:');
    if(!local)evidence.blocked.push(u);
    if(local&&u.includes('/monsters/full/grade1-hokkaido/HKD-E01.webp')&&imageMode==='pending'){heldImages.push(p.requestId);return;}
    const fail=!local||(u.includes('/monsters/full/grade1-hokkaido/HKD-E01.webp')&&imageMode==='fail');
    c.call(fail?'Fetch.failRequest':'Fetch.continueRequest',fail?{requestId:p.requestId,errorReason:'BlockedByClient'}:{requestId:p.requestId}).catch(()=>{});
  }
  if(m.method==='Network.responseReceived'&&!m.params.response.url.startsWith(origin)&&!m.params.response.url.startsWith('data:'))evidence.externalSuccess.push(m.params.response.url);
  if(m.method==='Runtime.exceptionThrown')evidence.exceptions.push(m.params.exceptionDetails);
});
const ev=s=>c.ev(s),wait=s=>c.wait(s,s,30000);
const shot=async name=>{await c.shot(path.join(out,name+'.png'));evidence.screenshots.push(name+'.png');};
const check=(name,actual,expected=true)=>{assert.deepEqual(actual,expected,name);evidence.checks.push(name);};
const state=()=>ev('fsm.states.miniGame.inspect()');
const button=async selector=>{
  await wait(`document.querySelector(${JSON.stringify(selector)})?.getClientRects().length>0`);
  const p=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing button');e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await c.click(p.x,p.y);
};
const action=name=>button(`[data-action="${name}"]`);
const touch=async selector=>{
  await wait(`document.querySelector(${JSON.stringify(selector)})?.getClientRects().length>0`);
  const p=await ev(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await c.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await c.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
};
const key=async(k,extra={})=>{await c.call('Input.dispatchKeyEvent',{type:'keyDown',key:k,code:k,windowsVirtualKeyCode:k==='Enter'?13:0,...extra});await c.call('Input.dispatchKeyEvent',{type:'keyUp',key:k,code:k,windowsVirtualKeyCode:k==='Enter'?13:0});};
const type=async value=>{await wait(`document.querySelector('#mathSprintScreen input')?.disabled===false`);await ev(`(()=>{const i=document.querySelector('#mathSprintScreen input');i.focus();i.value='';})()`);await c.call('Input.insertText',{text:String(value)});};
const enter=async()=>{await button('#titleMiniGameButton');await wait('fsm.states.miniGame.inspect().session?.phase==="answering"');};
const back=async()=>{await action('back');await wait('fsm.currentState===fsm.states.title');};
let initId;
const boot=async(owned=true,mode='normal')=>{
  imageMode=mode;
  for(const requestId of heldImages.splice(0))await c.call('Fetch.failRequest',{requestId,errorReason:'Aborted'}).catch(()=>{});
  if(initId)await c.call('Page.removeScriptToEvaluateOnNewDocument',{identifier:initId});
  const entries=structuredClone(fixture.entries);
  for(const k of ['krb_save','yomitabi_confirmed_1']){
    const save=JSON.parse(entries[k]);save.player.collection.gotomonIds=owned?['HKD-E01']:[];
    save.settings.bgmVolume=0;save.settings.seVolume=0;save.settings.autosaveEnabled=false;
    // Tutorial is unrelated to this new screen and would obscure the entry button.
    save.meta.compatibilityEntries??={};save.meta.compatibilityEntries.tutorial_seen_title='1';
    entries[k]=JSON.stringify(save);
  }
  entries.krb_monster_dex=JSON.stringify(owned?['HKD-E01']:[]);entries.tutorial_seen_title='1';entries.inputMethod='device';
  const source=`if(location.origin===${JSON.stringify(origin)}){localStorage.clear();for(const[k,v]of Object.entries(${JSON.stringify(entries)}))localStorage.setItem(k,v);
    window.__mq={raf:0,interval:0,tasks:[],updates:[],listeners:[]};
    const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener=function(type,fn,...args){const owner=new Error().stack.split(String.fromCharCode(10)).find(line=>line.includes('/src/'));if(owner?.includes('/src/minigames/'))__mq.listeners.push({target:this,type,fn});return add.call(this,type,fn,...args);};
    EventTarget.prototype.removeEventListener=function(type,fn,...args){__mq.listeners=__mq.listeners.filter(e=>e.target!==this||e.type!==type||e.fn!==fn);return remove.call(this,type,fn,...args);};
    for(const name of ['requestAnimationFrame','setInterval']){const original=window[name];window[name]=function(...args){if(new Error().stack.includes('/src/minigames/'))__mq[name==='setInterval'?'interval':'raf']++;return original.apply(this,args);};}
    new PerformanceObserver(list=>{for(const e of list.getEntries())if(document.getElementById('mathSprintScreen'))__mq.tasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:false});}`;
  initId=(await c.call('Page.addScriptToEvaluateOnNewDocument',{source})).identifier;
  await c.call('Emulation.setDeviceMetricsOverride',{width:1086,height:723,deviceScaleFactor:1,mobile:false});
  await c.call('Page.navigate',{url:origin+'/'});await wait('window.fsm?.states?.miniGame && fsm.currentState===fsm.states.title');
  await ev(`(async()=>{window.__game=(await import('/src/core/gameState.js'));const h=fsm.states.miniGame,update=h.update;h.update=function(dt){const t=performance.now();try{return update(dt);}finally{__mq.updates.push(performance.now()-t);}};})()`);
};
try{
  if(tracing)await c.call('Tracing.start',{categories:'devtools.timeline,v8.execute,disabled-by-default-devtools.timeline',transferMode:'ReturnAsStream'});
  await c.call('Page.enable');await c.call('Runtime.enable');await c.call('Network.enable');await c.call('Network.setCacheDisabled',{cacheDisabled:true});
  await c.call('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  await boot();await shot('title');await enter();await wait('fsm.states.miniGame.inspect().companion.motion?.imageState==="ready"');
  check('owned E01 shown',(await state()).companion.selected,'HKD-E01');await shot('desktop-owned');
  const before=await ev(`JSON.stringify({game:__game.gameState,storage:Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))},(k,v)=>k==='playtimeSeconds'?undefined:v)`);
  await type('');await action('answer');check('blank not answered',(await state()).session.answered,0);
  await type('2abc');await action('answer');check('partial integer not answered',(await state()).session.answered,0);
  const first=(await state()).session;await type(String.fromCharCode(0xff10+first.problem.answer));
  await ev(`document.querySelector('#mathSprintScreen input').dispatchEvent(new CompositionEvent('compositionstart'))`);
  await key('Enter');await action('answer');check('IME composition locks Enter and button',(await state()).session.answered,0);
  await ev(`document.querySelector('#mathSprintScreen input').dispatchEvent(new CompositionEvent('compositionend'))`);
  await ev(`document.querySelector('#mathSprintScreen input').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',repeat:true,bubbles:true,cancelable:true}))`);
  check('key repeat rejected',(await state()).session.answered,0);
  await key('Enter');await action('answer');await key('Enter');check('Enter plus button only once',(await state()).session.answered,1);
  check('full-width correct',(await state()).session.correct,1);
  await action('next');await wait('fsm.states.miniGame.inspect().session.phase==="answering"');
  await type('7');
  const pauseBefore=await ev(`(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));return fsm.states.miniGame.inspect().session})()`);
  await key('Enter');await ev('fsm.states.miniGame.update(1000)');
  check('hidden locks and freezes elapsed',(await state()).session.activeElapsedMs,pauseBefore.activeElapsedMs);
  check('hidden buffer retained',await ev(`document.querySelector('#mathSprintScreen input').value`),'7');
  await ev(`fsm.states.miniGame.setPaused(true);Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))`);
  check('visible does not clear manual pause',(await state()).session.paused,true);
  await ev(`fsm.states.miniGame.setPaused(false);delete document.hidden`);
  for(let i=1;i<10;i++){
    const s=(await state()).session;await type(s.problem.answer+([2,7].includes(i)?1:0));await action('answer');
    await wait(`fsm.states.miniGame.inspect().session.answered===${i+1}`);
    if(i===1){check('correct attack',(await state()).companion.action,'attack');await shot('correct-attack');}
    if(i===2){check('incorrect idle',(await state()).companion.action,'idle');await shot('incorrect-feedback');}
    if(i<9){await action('next');await wait('fsm.states.miniGame.inspect().session.phase==="answering"');}
  }
  check('10-question result',(await state()).session.result,{answered:10,correct:8,incorrect:2,accuracy:.8,maxStreak:4});
  check('complete once seq21',(await state()).session.seq,21);await shot('result');
  for(let i=0;i<5;i++)await key('Enter');check('late input cannot repeat complete',(await state()).session.seq,21);
  const after=await ev(`JSON.stringify({game:__game.gameState,storage:Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))},(k,v)=>k==='playtimeSeconds'?undefined:v)`);
  check('kanji Core and Storage invariant',after,before);
  await action('replay');await wait('fsm.states.miniGame.inspect().session.phase==="answering"');
  const replay=(await state()).session;check('replay new session',replay.sessionId!==first.sessionId);check('replay seq reset',replay.seq,1);check('replay fresh token',replay.token!==first.token);
  for(const [width,height] of [[390,844],[844,390]]){
    await c.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
    await c.call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
    await ev('fsm.states.miniGame.update(0)');
    const sizes=await ev(`(()=>{const root=document.getElementById('mathSprintScreen');return{overflow:root.scrollWidth>root.clientWidth,buttons:[...root.querySelectorAll('button')].filter(e=>e.getClientRects().length).map(e=>({text:e.textContent,h:e.getBoundingClientRect().height,w:e.getBoundingClientRect().width}))}})()`);
    check(`${width}x${height} no horizontal overflow`,sizes.overflow,false);check(`${width}x${height} buttons44`,sizes.buttons.every(b=>b.h>=44&&b.w>=44));
    await touch('[data-digit="0"]');
    check(`${width}x${height} touch digit`,await ev(`document.querySelector('#mathSprintScreen input').value.endsWith('0')`));await shot(`mobile-${width}x${height}`);
    await touch('[data-digit="削除"]');check(`${width}x${height} touch delete`,await ev(`document.querySelector('#mathSprintScreen input').value`),'');
    const question=(await state()).session;
    await touch(`[data-digit="${question.problem.answer}"]`);await touch('[data-action="answer"]');
    check(`${width}x${height} touch correct`,(await state()).session.correct,question.correct+1);
    await touch('[data-action="next"]');check(`${width}x${height} touch Next during attack`,(await state()).session.phase,'answering');
  }
  await c.call('Emulation.setDeviceMetricsOverride',{width:390,height:420,deviceScaleFactor:1,mobile:true});
  await type((await state()).session.problem.answer);await shot('keyboard-height-simulation');
  check('short viewport input and answer operable',await ev(`(()=>{const i=document.querySelector('#mathSprintScreen input'),b=document.querySelector('[data-action="answer"]'),r=b.getBoundingClientRect();return !i.disabled&&r.top>=0&&r.bottom<=visualViewport.height})()`));
  await c.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  const beforeReduced=(await state()).session.correct;
  await action('answer');await shot('reduced-feedback');check('reduced does not alter scoring',(await state()).session.correct,beforeReduced+1);
  await c.call('Emulation.setEmulatedMedia',{features:[]});
  await back();check('exit destroys session',(await state()).session,null);
  for(let i=0;i<10;i++){await enter();await back();check(`exit/reenter ${i+1} DOM removed`,await ev(`document.querySelectorAll('#mathSprintScreen').length`),0);check(`exit/reenter ${i+1} listeners removed`,await ev('__mq.listeners.length'),0);check(`exit/reenter ${i+1} companion released`,(await state()).companion,null);}
  evidence.performance.push(await ev('({raf:__mq.raf,interval:__mq.interval,maxHostUpdateMs:Math.max(...__mq.updates),longTasks:__mq.tasks})'));
  check('mini-game RAF zero',evidence.performance.at(-1).raf,0);check('mini-game interval zero',evidence.performance.at(-1).interval,0);
  check('host updates below50ms',evidence.performance.at(-1).maxHostUpdateMs<50);
  await boot(false);await enter();check('unowned none',(await state()).companion.selected,null);await shot('unowned');
  for(let i=0;i<10;i++){await type((await state()).session.problem.answer);await action('answer');if(i<9)await action('next');}
  check('unowned completes',(await state()).session.result.correct,10);await back();
  await boot(true,'pending');await enter();await wait('fsm.states.miniGame.inspect().companion.motion?.imageState==="pending"');
  await type((await state()).session.problem.answer);await action('answer');check('pending image answers',(await state()).session.answered,1);
  await back();imageMode='normal';for(const requestId of heldImages.splice(0))await c.call('Fetch.continueRequest',{requestId});
  await enter();await wait('fsm.states.miniGame.inspect().companion.motion?.imageState==="ready"');check('late image does not revive old session',(await state()).session.answered,0);await back();
  await boot(true,'fail');await enter();await wait('fsm.states.miniGame.inspect().companion.motion?.imageState==="failed"');
  await type((await state()).session.problem.answer);await action('answer');check('failed image answers',(await state()).session.answered,1);await shot('image-failure');await back();
  check('Firebase/external successes zero',evidence.externalSuccess.length,0);check('runtime exceptions zero',evidence.exceptions.length,0);
  evidence.status='PASS';await fs.writeFile(path.join(out,'result.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
}catch(error){evidence.status='FAIL';evidence.error=error.stack;await shot('failure').catch(()=>{});await fs.writeFile(path.join(out,'failure.json'),JSON.stringify(evidence,null,2));throw error;}
finally{
  if(tracing){
    const done=new Promise(resolve=>c.on(m=>{if(m.method==='Tracing.tracingComplete')resolve(m.params.stream);}));
    await c.call('Tracing.end');const handle=await done;let trace='';
    for(;;){const chunk=await c.call('IO.read',{handle});trace+=chunk.data;if(chunk.eof)break;}
    await c.call('IO.close',{handle});await fs.writeFile(path.join(out,'trace.json'),trace);
  }
  c.close();
}
