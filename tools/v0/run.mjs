import {diagnostic} from './diagnostic.mjs';
import {readFile,writeFile,access} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {launchChrome,sleep} from './chrome.mjs';
import {points,names,bundle} from './source-points.mjs';
import {qCapture} from './q-capture.mjs';
import {monitorForeground} from './foreground-monitor.mjs';
import {fileURLToPath} from 'node:url';
import {canonical,hash} from '../experiment/common.mjs';
const [role='baseline',attempt='cold-01',mode='full']=process.argv.slice(2);
const root='C:/kanji-game-latest/artifacts/yomitabi-e0/worktrees/experiment/artifacts/v0/run-01', origin=`http://127.0.0.1:${role==='baseline'?49721:49722}`;
const prefix=path.join(root,role+'-'+attempt), profile=prefix+'-profile';
const data={role,attempt,mode,origin,profile,protocol:'2.0-Q1',startedAt:new Date().toISOString(),requests:[],responses:[],finished:[],failed:[],steps:[],logs:[]};
data.toolHashes={};for(const file of ['run.mjs','probe.js','source-points.mjs','chrome.mjs','foreground-monitor.mjs','q-capture.mjs']){const body=await readFile(new URL(file,import.meta.url));data.toolHashes[file]=hash(body);await writeFile(prefix+'-source-'+file,body,{flag:'wx'});}
const c=await launchChrome('C:/Program Files/Google/Chrome/Application/chrome.exe',profile,{headless:mode==='diagnostic'});let fatal,monitor,qImages;const imageWrites=[];data.casts=[];
c.on(m=>{const p=m.params;if(m.method==='Network.requestWillBeSent')data.requests.push({id:p.requestId,url:p.request.url,type:p.type,t:p.timestamp,wallTime:p.wallTime});
 if(m.method==='Runtime.bindingCalled'&&m.params.name==='__b06DrawNotice')qImages?.notice(JSON.parse(m.params.payload));
 if(m.method==='Debugger.paused'){data.unexpectedPause=p;fatal=Error('STOP unexpected debugger pause');void c.send('Debugger.resume');}
 if(m.method==='Page.screencastFrame'){const file=prefix+'-cast-'+String(data.casts.length).padStart(4,'0')+'.jpg';data.casts.push({file,metadata:p.metadata});imageWrites.push(writeFile(file,Buffer.from(p.data,'base64')));void c.send('Page.screencastFrameAck',{sessionId:p.sessionId});}
 if(m.method==='Network.responseReceived'){data.responses.push({id:p.requestId,url:p.response.url,type:p.type,t:p.timestamp,status:p.response.status,headers:p.response.headers,cache:p.response.fromDiskCache,sw:p.response.fromServiceWorker,mime:p.response.mimeType});if(/^https?:/.test(p.response.url)&&!p.response.url.startsWith(origin+'/')){fatal=Error('STOP external response');void c.close();}}
 if(m.method==='Network.loadingFinished')data.finished.push({id:p.requestId,t:p.timestamp,bytes:p.encodedDataLength});
 if(m.method==='Network.loadingFailed')data.failed.push(p);
 if(m.method==='Log.entryAdded')data.logs.push(p.entry);
});
const ev=s=>{if(fatal)throw fatal;return c.evaluate(s);};
async function checkedSleep(ms){for(let t=0;t<ms;t+=50){if(fatal)throw fatal;await sleep(Math.min(50,ms-t));}}
async function awaitHuman(){await writeFile(prefix+'-waiting.json',JSON.stringify({pid:c.child.pid,targetId:c.targetId,origin,profile,gate:prefix+'-human-ready.json',status:'WAITING FOR USER READY: no fixture or performance run started'},null,2),{flag:'wx'});console.log('WAITING_FOR_HUMAN',prefix);while(true){try{await access(prefix+'-human-ready.json');break;}catch{}await sleep(500);}data.humanReady=JSON.parse(await readFile(prefix+'-human-ready.json','utf8'));assert.equal(data.humanReady.userMessage,'準備完了');console.log('RETURN_TO_CHROME_15_SECONDS');await sleep(15000);data.foregroundStart=await monitor.arm();console.log('MEASUREMENT_STARTED');}

async function until(s,label,timeout=20000){let start=Date.now();while(Date.now()-start<timeout){if(await ev(s))return;await sleep(80);}throw Error('Timeout '+label);}
async function css(x,y){data.steps.push({name:'hit-test',t:await ev('performance.now()'),x,y,hit:await ev(`(()=>{const e=document.elementFromPoint(${x},${y});return{tag:e?.tagName,id:e?.id,text:e?.textContent?.slice(0,60),screen:globalThis.fsm?Object.keys(fsm.states).find(k=>fsm.states[k]===fsm.currentState):null,scrollY,innerHeight}})()`)});for(const type of ['mousePressed','mouseReleased'])await c.send('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1});}
async function sel(s){await ev(`document.querySelector(${JSON.stringify(s)}).scrollIntoView({block:'center',behavior:'instant'})`);await sleep(120);const p=await ev(`(()=>{const b=document.querySelector(${JSON.stringify(s)});if(!b||b.disabled)throw Error('Missing/disabled control');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);await css(p.x,p.y);}
async function canvas(x,y){const p=await ev(`(()=>{const c=document.querySelector('#gameCanvas'),r=c.getBoundingClientRect(),s=Math.min(r.width/c.width,r.height/c.height);return {x:r.x+(r.width-c.width*s)/2+${x}*s,y:r.y+(r.height-c.height*s)/2+${y}*s}})()`);await css(p.x,p.y);}
async function key(){for(const type of ['keyDown','keyUp'])await c.send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13});}
async function text(s,t){await sel(s);if(await ev(`!!document.querySelector(${JSON.stringify(s)}).value`)){await c.send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});await c.send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2});for(const type of ['keyDown','keyUp'])await c.send('Input.dispatchKeyEvent',{type,key:'Backspace',code:'Backspace',windowsVirtualKeyCode:8});}await c.send('Input.insertText',{text:t});}
async function toggle(label){const p=await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(label)})&&b.getClientRects().length);if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);if(p){await css(p.x,p.y);await sleep(350);}return !!p;}
async function guide(padOff=true){await sleep(500);if(padOff)await toggle('たんまつで書く');for(let i=0;i<30;i++){const p=await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>['つぎへ','はじめる！'].includes(b.textContent)&&b.getClientRects().length);if(!b)return null;b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,covered:document.elementFromPoint(x,y)!==b}})()`);if(!p)return;if(p.covered)throw Error('Guide covered');await css(p.x,p.y);await sleep(180);}throw Error('Guide loop');}
async function point(expression){const b=await ev(expression);data.steps.push({name:'ui-point',expression,rect:b,t:await ev('performance.now()')});await canvas(b.x+b.width/2,b.y+b.height/2);}
async function attach(){
 const f=await c.send('Runtime.evaluate',{expression:'fsm.states.battle.update'}),p=await c.send('Runtime.getProperties',{objectId:f.result.objectId});
 const scopes=await c.send('Runtime.getProperties',{objectId:p.internalProperties.find(p=>p.name==='[[Scopes]]').value.objectId});
 const scope=scopes.result.find(p=>p.value?.description==='Module');assert.ok(scope);
 const props=await c.send('Runtime.getProperties',{objectId:scope.value.objectId,ownProperties:true});
 const ids=[names.game,names.battle,names.screen,names.buttons,names.images,names.recorded,names.ready].map(name=>{const p=props.result.find(p=>p.name===name);assert.ok(p?.value.objectId);return {objectId:p.value.objectId};});
 const session=props.result.find(p=>p.name===names.session)?.value.value;assert.equal(typeof session,'number');ids.push({value:session});
 await c.send('Runtime.callFunctionOn',{objectId:f.result.objectId,arguments:ids,functionDeclaration:`function(g,b,s,buttons,images,recorded,saveReady,session){
 if(!g.playerStats||!('inputEnabled'in b)||!s.enter)throw Error('Probe binding mismatch');
 const copy=x=>JSON.parse(JSON.stringify(x));
 __b05.bind(g,b,s,buttons,recorded,session,saveReady);
 globalThis.__b0={
 readyProxy:()=>!!(fsm.currentState===fsm.states.battle&&b.turn==='player'&&b.inputEnabled&&s._answerSubmission?.active&&!s._answerSubmission.locked&&g.currentKanji?._recordQuestion&&s.inputEl?.getClientRects().length&&![...document.querySelectorAll('button')].some(x=>['つぎへ','はじめる！'].includes(x.textContent)&&x.getClientRects().length)),
 ready:()=>__b05.facts().strict,
 read:()=>copy({stage:g.currentStageId,enemy:g.currentEnemy?{id:g.currentEnemy.id,hp:g.currentEnemy.hp,maxHp:g.currentEnemy.maxHp,atk:g.currentEnemy.atk}:null,enemyIndex:g.currentEnemyIndex,enemyCount:g.enemies.length,pool:g.kanjiPool.map(k=>k.id),question:g.currentKanji,player:g.playerStats,battle:{turn:b.turn,inputEnabled:b.inputEnabled,enemyAction:b.enemyAction,enemyActionTimer:b.enemyActionTimer,combo:b.comboCount,lastCommandMode:b.lastCommandMode,log:b.log},stageRun:b.stageRun,hintLevel:g.hintLevel,correct:g.correctKanjiList.map(k=>k.id),wrong:g.wrongKanjiList.map(k=>k.id),generation:s._generation,timerCount:s._timeouts?.length}),
 buttons:()=>copy(buttons), screenKeys:()=>Object.keys(s), command:()=>b.lastCommandMode,
 resources:()=>({visual:s._battleVisual?.resources()??null,visualSession:s._battleVisual?.session??null,canvas:document.querySelectorAll('canvas').length,liveDOM:document.querySelectorAll('*').length,domImages:document.images.length,guideButtons:[...document.querySelectorAll('button')].filter(x=>['つぎへ','はじめる！'].includes(x.textContent)&&x.getClientRects().length).length,images:Object.entries(images).map(([key,i])=>({key,width:i?.naturalWidth,height:i?.naturalHeight,src:(i?.currentSrc||i?.src)?.slice(0,200),srcLength:(i?.currentSrc||i?.src)?.length})),timers:s._timeouts?.length,active:s._active,lifecycleActive:s._lifecycle?.active,interval:!!s._levelUpInterval}),
 };
}`});
 await ev(`(()=>{const old=fsm.states.battle.enter;fsm.states.battle.enter=function(...args){__b0obs.events.push({kind:'E1',t:performance.now()});return old.apply(this,args);};})()`);
}
const entries=()=>ev('Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))');
async function snap(name,extra={}){const storage=await entries(),runtime=await ev('globalThis.__b0?.read()??null'),t=await ev('performance.now()');const s={name,t,runtime,storage,storageHash:hash(canonical(storage)),...extra};if(mode==='memory'||mode==='diagnostic'){s.heap=await c.send('Runtime.getHeapUsage');s.dom=await c.send('Memory.getDOMCounters');s.metrics=await c.send('Performance.getMetrics');s.resources=await ev('__b0.resources()');}data.steps.push(s);console.log(role,attempt,name);return runtime;}
async function section(label,fn){await ev(`__b0obs.label=${JSON.stringify(label)}`);const start=await ev('performance.now()');await fn();const end=await ev('performance.now()');data.steps.push({name:'interval',label,start,end});}
async function stage(){await point("fsm.currentState.stageButtons.find(b=>b.id==='hokkaido_area1')");await sleep(800);if(await ev('fsm.currentState===fsm.states.stageSelect')){if(mode==='boundary'&&!data.qBeforeCaptured){await qImages?.capture('before first E0 confirmation');data.qBeforeCaptured=true;}await ev("__b0obs.stagePending=true");await point("fsm.currentState.stageButtons.find(b=>b.id==='hokkaido_area1')");}await until('fsm.currentState===fsm.states.battle','battle');}
async function leave(){await canvas(55,30);await until('fsm.currentState===fsm.states.stageSelect','exit');await guide();}
async function action(kind){
 const before=await ev('__b0.read()');assert.ok(await ev('__b0.ready()'),'ready');const q=before.question;
 const answer=kind==='wrong'?'ぬぬぬぬぬ':q.readings?.[0]||q.kunyomi?.[0]||q.onyomi?.[0];assert.ok(answer);
 await text('#kanjiInput',answer);
 if(mode==='boundary'&&['correct','wrong','heal','defeat'].includes(kind)){await c.send('Page.startScreencast',{format:'jpeg',quality:75,maxWidth:1100,maxHeight:900,everyNthFrame:1});await sleep(100);}
 await ev(`__b0obs.pending=${JSON.stringify(kind)};__b0obs.actionStart=performance.now()`);
 if(kind==='heal'||kind==='defeat'){const buttons=await ev('__b0.buttons()');const b=buttons[kind==='heal'?'heal':'attack'];assert.ok(b);await canvas(b.x+(b.width??b.w)/2,b.y+(b.height??b.h)/2);}else await key();
 const target=before.player[kind==='wrong'?'totalIncorrect':'totalCorrect']+1;
 await until(`__b0.read().player.${kind==='wrong'?'totalIncorrect':'totalCorrect'}>=${target}`,'answer committed');
 await snap(kind+'-commit',{answer,beforeQuestion:q});
 await until('__b0.ready()','next answer',20000);await sleep(250);await snap(kind+'-ready');
 if(mode==='boundary'&&['correct','wrong','heal','defeat'].includes(kind))await c.send('Page.stopScreencast');await ev('__b0obs.pending=null');
}
async function route(newPlayer){await until("!document.querySelector('#bootProgress')&&fsm.currentState===fsm.states.title",'title boot completed');await guide();await point('fsm.currentState.playButton');if(newPlayer){await until("document.querySelector('#playerNameInputField')?.getClientRects().length",'name');await guide();await text('#playerNameInputField','テスト');await key();}
 await until('fsm.currentState===fsm.states.courseSelect','course');await guide();await canvas(200,300);await until('fsm.currentState===fsm.states.regionSelect','region');await guide();
 const r=await ev('(()=>{const s=fsm.currentState,m=s.mapRect,c=s.camera;return{x:c.x+(m.x+m.width*.82)*c.scale,y:c.y+(m.y+m.height*.175)*c.scale}})()');await canvas(r.x,r.y);await until('fsm.currentState===fsm.states.stageSelect','stage select');await guide();await snap('battle-before');}
const observe=`(()=>{const o=globalThis.__b0obs={frames:[],events:[],longTasks:[],label:'navigation',pending:null};let lastTitle=false,lastReady=false,lastStyle='',lastEnemyAction='';
 document.addEventListener('visibilitychange',()=>o.events.push({kind:'visibility',t:performance.now(),value:document.visibilityState}));
 for(const name of ['keydown','click'])document.addEventListener(name,e=>{if(o.stagePending&&name==='click'){o.events.push({kind:'E0',t:performance.now()});o.stagePending=false;}if((name==='keydown'&&e.key==='Enter'&&e.target.id==='kanjiInput')||(name==='click'&&e.target.id==='gameCanvas'&&['heal','defeat'].includes(o.pending))){o.events.push({kind:'U0',t:performance.now(),action:o.pending});}},true);
 function frame(t){if(${mode!=='control'})o.frames.push([t,o.label]);const title=!!(globalThis.fsm?.currentState===globalThis.fsm?.states?.title&&globalThis.fsm?.currentState?.playButton);if(title&&!lastTitle)o.events.push({kind:'T_visible_proxy',t});lastTitle=title;requestAnimationFrame(frame);}requestAnimationFrame(frame);
 setInterval(()=>{const t=performance.now();if(!o.titleUsable&&globalThis.fsm?.currentState===globalThis.fsm?.states?.title&&globalThis.fsm?.currentState?.playButton&&!document.querySelector('#bootProgress')){o.titleUsable=t;o.events.push({kind:'T1_boot_removed_proxy',t});}if(!globalThis.__b0)return;const ready=__b0.readyProxy(),s=document.querySelector('#kanjiInput')?.style.borderColor??'';if(ready&&!lastReady)o.events.push({kind:'ready_proxy',t,action:o.pending});lastReady=ready;if(s!==lastStyle){o.events.push({kind:'UI_style_proxy',t,value:s,action:o.pending});lastStyle=s;}},20);
 try{new PerformanceObserver(l=>o.longTasks.push(...l.getEntries().map(e=>({start:e.startTime,duration:e.duration,name:e.name})))).observe({type:'longtask',buffered:true});}catch{}
})()`;
try{
 await c.send('Page.enable');await c.send('Runtime.enable');await c.send('Network.enable');await c.send('Log.enable');await c.send('Performance.enable');await c.send('Page.bringToFront');await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
 monitor=await monitorForeground(c,prefix,e=>{if(!fatal){fatal=e;data.foregroundFailure={error:e.message,epoch:Date.now()};console.error(e.message);}});// B0.6 Q refinement: no concurrent PNG captures; Q screencast downscaled only.
data.chromePid=c.child.pid;data.targetId=c.targetId;
 data.window=await c.call('Browser.getWindowForTarget',{targetId:c.targetId});data.targets=await c.call('Target.getTargets');await c.call('Target.activateTarget',{targetId:c.targetId});data.browser=await c.call('Browser.getVersion');data.system=await c.call('SystemInfo.getInfo');
 await c.send('Page.navigate',{url:origin+'/__experiment/setup'});await until("document.querySelector('#isolation')&&!document.querySelector('#isolation').disabled",'setup');
 if(mode!=='diagnostic')await awaitHuman();
 data.initial=await ev('(async()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage),db:await indexedDB.databases(),caches:await caches.keys(),sw:await navigator.serviceWorker.getRegistrations().then(x=>x.length),controller:!!navigator.serviceWorker.controller,firebase:typeof firebase}))()');
 await c.send('Page.bringToFront');data.setupLayout=await ev('({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,visibility:document.visibilityState,screen:{width:screen.width,height:screen.height}})');if(data.setupLayout.visibility!=='visible')throw Error('STOP setup is hidden: no fixture or game navigation');await sel('#profile-confirm');await until("document.querySelector('#profile-confirm').checked",'profile confirmed');await sel('#isolation');await until("!document.querySelector('#seed').disabled",'canary');data.isolation=await ev("document.querySelector('#status').textContent");await sel('#seed');await until("!document.querySelector('#play').hidden",'seed');assert.equal(canonical(await entries()),canonical(JSON.parse(await readFile(root+'/fixture.json','utf8')).entries));
 await c.send('Page.addScriptToEvaluateOnNewDocument',{source:'globalThis.__b05Boundary='+JSON.stringify(mode==='boundary')+';'+await readFile(new URL('./probe.js',import.meta.url),'utf8')+observe});
 if(mode==='diagnostic')await c.send('Page.addScriptToEvaluateOnNewDocument',{source:await readFile(new URL('./diagnostic-probe.js',import.meta.url),'utf8')});
 {
  await c.send('Debugger.enable');data.breakpoints=[];
  for(const [name,p] of Object.entries(points)){
   if(name!=='session')continue;
   const condition=name==='session'?'(__b05.captureSession(()=>'+names.ready+'()),false)':name==='commit'?'(__b05.commit(e,t,n,w,v),false)':name==='hp0'?'(d.currentEnemy.hp===0&&__b05.event("HP0-source",{enemy:d.currentEnemy.id,hp:d.currentEnemy.hp}),false)':'(__b05.event("defeat-source",{enemy:d.currentEnemy.id,hp:d.currentEnemy.hp,action:y.enemyAction,timer:y.enemyActionTimer}),false)';
   const result=await c.send('Debugger.setBreakpointByUrl',{url:origin+'/assets/'+bundle,lineNumber:p.lineNumber,columnNumber:p.columnNumber,condition});
   data.breakpoints.push({name,requested:p,condition,result});
  }
  c.on(m=>{if(m.method==='Debugger.breakpointResolved')data.breakpoints.push({resolved:m.params});});
 }data.gameRequestStart=data.requests.length;await sel('#play');await until('window.fsm?.states?.battle','title');data.timeOrigin=await ev('performance.timeOrigin');if(mode!=='boundary')await c.send('Debugger.disable');await attach();
 data.layoutInitial=await ev('({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,screen:{width:screen.width,height:screen.height},visibility:document.visibilityState,visualViewport:{width:visualViewport.width,height:visualViewport.height,scale:visualViewport.scale}})');
 await snap('title');await route(true);if(mode==='boundary')await c.send('Page.startScreencast',{format:'jpeg',quality:75,maxWidth:550,maxHeight:450,everyNthFrame:1});await stage();
 if(false){
  await sleep(600);data.padTutorial=await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>['つぎへ','はじめる！'].includes(b.textContent)&&b.getClientRects().length);if(!b)return null;const r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {text:b.textContent,rect:r.toJSON(),hit:hit?.outerHTML,covered:hit!==b,pad:document.querySelector('#kanaPad')?.outerHTML.slice(0,300),input:document.querySelector('#kanjiInput')?.value}})()`);await c.screenshot(prefix+'-pad-tutorial.png');
  if(data.padTutorial?.covered){const r=data.padTutorial.rect;await css(r.x+r.width/2,r.y+r.height/2);await sleep(200);data.padTutorialAfter=await ev(`({input:document.querySelector('#kanjiInput')?.value,guide:[...document.querySelectorAll('button')].filter(b=>['つぎへ','はじめる！'].includes(b.textContent)&&b.getClientRects().length).map(b=>b.textContent)})`);}
 }
 await guide();await until('__b0.ready()','first ready');await snap('E01');if(mode==='boundary')await c.send('Page.stopScreencast');await c.screenshot(prefix+'-battle.png');
 await section('idle',async()=>{data.idleBefore=await c.send('Performance.getMetrics');await checkedSleep(10000);data.idleAfter=await c.send('Performance.getMetrics');});
 if(mode!=='control'){
 await section('correct-attack',()=>action('correct'));await section('wrong-enemy-attack',()=>action('wrong'));await section('correct-heal',()=>action('heal'));
 for(let i=0;i<20;i++){if((await ev('__b0.read().enemy.id'))!=='HKD-E01')break;await section('defeat-sequence',()=>action('defeat'));}
 assert.equal(await ev('__b0.read().enemy.id'),'HKD-E02');await snap('E02');await section('E02-idle',()=>checkedSleep(2000));await leave();await snap('exit');await stage();await guide();await until('__b0.ready()','reenter');await snap('reenter');
 if(mode==='memory'){
  for(let i=1;i<=10;i++){await leave();await sleep(2000);await snap('life-exit-'+i);await stage();await guide();await until('__b0.ready()','life ready');await sleep(2000);await snap('life-enter-'+i);}
  await sleep(30000);await snap('life-enter-idle-30s');
 }
 }
 data.performance=await ev('({timeOrigin:performance.timeOrigin,observation:__b0obs,b05:__b05.events,resources:performance.getEntriesByType("resource").map(x=>x.toJSON()),navigation:performance.getEntriesByType("navigation").map(x=>x.toJSON())})');
 data.finalFirebase=await ev('typeof firebase');assert.equal(data.finalFirebase,'undefined');data.receiver=await(await fetch(origin+'/__experiment/receiver-status')).json();assert.equal(data.receiver.received,0);
 data.valid=await ev("(async()=>{const a=await import('/__experiment/save-validator.js');return a.readSaveState().status})()");assert.equal(data.valid,'valid');
 if(false){ // No warm expansion in B0.6

  data.warmRequestStart=data.requests.length;const oldOrigin=await ev('performance.timeOrigin');await c.send('Page.reload');await until(`performance.timeOrigin!==${oldOrigin}&&window.fsm?.currentState===window.fsm?.states?.title&&!!window.fsm?.currentState?.playButton`,'warm title');await attach();await snap('warm-title');await route(false);await stage();await guide();await until('__b0.ready()','warm ready');await section('warm-idle',()=>sleep(10000));await snap('warm-battle');data.warm=await ev('({timeOrigin:performance.timeOrigin,observation:__b0obs,resources:performance.getEntriesByType("resource").map(x=>x.toJSON())})');
 }
 if(mode==='diagnostic')await diagnostic({c,ev,until,stage,leave,guide,snap,action,canvas,toggle,data,prefix});
 data.b05=await ev('__b05.events');await monitor.finish();if(fatal)throw fatal;data.pass=true;
}catch(e){data.error=e.stack;console.error(e);try{data.failureState=await c.evaluate('globalThis.__b0?.read()');data.body=await c.evaluate('document.body.innerText');data.failureTimeOrigin=await c.evaluate('performance.timeOrigin');data.observation=await c.evaluate('globalThis.__b0obs');data.b05=await c.evaluate('globalThis.__b05?.events');await c.screenshot(prefix+'-failure.png');}catch{}process.exitCode=1;
}finally{await qImages?.finish();data.qSnapshots=qImages?.records;await monitor?.finish();data.foregroundRecords=monitor?.records;data.end=new Date().toISOString();await Promise.all(imageWrites);await writeFile(prefix+'-evidence.json',JSON.stringify(data,null,2));await c.close();}
async function layout(){return ev(`(()=>{const c=document.querySelector('#gameCanvas'),r=c.getBoundingClientRect(),s=Math.min(r.width/c.width,r.height/c.height),input=document.querySelector('#kanjiInput');return {canvas:r.toJSON(),internal:{width:c.width,height:c.height},contain:{x:r.x+(r.width-c.width*s)/2,y:r.y+(r.height-c.height*s)/2,width:c.width*s,height:c.height*s},bands:{x:(r.width-c.width*s)/2,y:(r.height-c.height*s)/2},dpr:devicePixelRatio,viewport:{width:innerWidth,height:innerHeight,visualWidth:visualViewport.width,visualHeight:visualViewport.height},input:input?.getBoundingClientRect().toJSON(),buttons:__b0.buttons(),domButtons:[...document.querySelectorAll('button')].filter(b=>b.getClientRects().length).map(b=>({text:b.textContent,rect:b.getBoundingClientRect().toJSON()})),canvasCount:document.querySelectorAll('canvas').length,domImages:document.images.length}})()`);}
