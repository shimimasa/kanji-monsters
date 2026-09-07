import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { args, canonical, hash } from './common.mjs';
import { launchChrome, sleep } from './chrome.mjs';

const options=args();
const role=options.role;
if(!['baseline','experiment'].includes(role) || !options.run || !options.chrome || !options.attempt) throw Error('--role --run --chrome --attempt required');
const run=path.resolve(options.run),origin=`http://127.0.0.1:${role==='baseline'?49721:49722}`;
const profile=path.join(run,`profile-${role}-${options.attempt}`);
const evidence={ role,origin,profile,startedAt:new Date().toISOString(), steps:[],requests:[],responses:[],failures:[],console:[],violations:[],pass:false };
const prefix=path.join(run,`${role}-${options.attempt}`);
const chrome=await launchChrome(options.chrome,profile);
let fatal;
chrome.on(msg=>{
  const p=msg.params;
  if(msg.method==='Network.requestWillBeSent') evidence.requests.push({id:p.requestId,url:p.request.url,type:p.type});
  if(msg.method==='Network.responseReceived') {
    const r={id:p.requestId,url:p.response.url,status:p.response.status,type:p.type};evidence.responses.push(r);
    if(/^https?:/.test(r.url) && !r.url.startsWith(origin+'/')) {fatal=Error('STOP external response: '+r.url);void chrome.close();}
  }
  if(msg.method==='Network.loadingFailed') evidence.failures.push({id:p.requestId,error:p.errorText,blockedReason:p.blockedReason});
  if(msg.method==='Runtime.consoleAPICalled') {
    const values=p.args.map(a=>a.value ?? a.description?.slice(0,300));
    if(evidence.console.length<1000)evidence.console.push({type:p.type,values});
  }
  if(msg.method==='Log.entryAdded') evidence.violations.push(p.entry);
});
const ev=expression=>{if(fatal)throw fatal;return chrome.evaluate(expression);};
async function until(expression,label,timeout=20000) {
  const start=Date.now();while(Date.now()-start<timeout){if(await ev(expression))return;await sleep(150);}throw Error('Timed out: '+label);
}
async function step(name,details={}) { evidence.steps.push({name,at:new Date().toISOString(),...details});console.log(role+': '+name); }
const state=()=>ev("window.fsm ? Object.keys(fsm.states).find(k=>fsm.states[k]===fsm.currentState) : null");
async function clickCss(x,y) {
  await chrome.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});
  await chrome.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});
}
async function clickSelector(selector) {
  await ev(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center'})`);
  const rect=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled||!e.getClientRects().length)throw Error('Control unavailable');const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await clickCss(rect.x,rect.y);
}
async function canvasClick(x,y) {
  const point=await ev(`(()=>{const c=document.querySelector('#gameCanvas'),r=c.getBoundingClientRect();const s=Math.min(r.width/c.width,r.height/c.height);return {x:r.left+(r.width-c.width*s)/2+${x}*s,y:r.top+(r.height-c.height*s)/2+${y}*s};})()`);
  await clickCss(point.x,point.y);
}
async function tutorial() {
  await sleep(600);
  // Use the existing keyboard/pad toggle before the battle guide, so the guide
  // buttons are not behind the open pad. Do not dismiss or disable Tutorial.
  const keyboard=await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('たんまつで書く')&&b.getClientRects().length);if(!b)return null;const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  if(keyboard){await clickCss(keyboard.x,keyboard.y);await sleep(500);await step('existing-device-keyboard-toggle');}
  for(let i=0;i<30;i++) {
    const point=await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>['つぎへ','はじめる！'].includes(b.textContent)&&b.getClientRects().length);if(!b)return null;b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,text:b.textContent,covered:document.elementFromPoint(x,y)!==b};})()`);
    if(!point)return;
    if(point.covered)throw Error('Tutorial control is covered; do not force-click');
    await clickCss(point.x,point.y);await step('tutorial', {button:point.text});await sleep(150);
  }
  throw Error('Tutorial did not finish');
}
async function enterText(selector,text) {
  await clickSelector(selector);
  await chrome.send('Input.insertText',{text});
}
async function enterKey() {
  await chrome.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await chrome.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
}
const entries=()=>ev('Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))');
async function checkpoint(name) {
  const data=await entries(); const save=JSON.parse(data.krb_save);
  assert.equal(data.krb_save,data.yomitabi_confirmed_1,'confirmed mirror');
  await writeFile(prefix+'-'+name+'-synthetic-storage.json',JSON.stringify(data,null,2));
  await step(name,{screen:await state(),storageHash:hash(canonical(data)),player:save.player.name,stats:save.player.coreStats,answers:save.player.study.answers,reviewQueue:save.player.study.reviewQueue});
  return save;
}
try {
  evidence.browser=await chrome.call('Browser.getVersion');
  await chrome.send('Page.enable');await chrome.send('Runtime.enable');await chrome.send('Network.enable');await chrome.send('Log.enable');
  // Read-only Canvas text observation for E0 UI diagnostics, not performance measurement.
  await chrome.send('Page.addScriptToEvaluateOnNewDocument',{source:`globalThis.__e0Text=[]; const original=CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){if(this.canvas.id==='gameCanvas'){__e0Text.push({text:String(text),x,y,font:this.font});if(__e0Text.length>400)__e0Text.splice(0,200);}return original.call(this,text,x,y,...rest);};`});
  await chrome.send('Page.navigate',{url:origin+'/__experiment/setup'});
  await until("document.querySelector('#isolation') && !document.querySelector('#isolation').disabled",'empty setup');
  evidence.initialStorage=await ev('(async()=>({localKeys:Object.keys(localStorage),sessionKeys:Object.keys(sessionStorage),databases:await indexedDB.databases(),caches:await caches.keys(),controller:navigator.serviceWorker.controller?.scriptURL??null,registrations:(await navigator.serviceWorker.getRegistrations()).length,firebase:typeof globalThis.firebase}))()');
  await step('empty-profile',evidence.initialStorage);
  await clickSelector('#profile-confirm');await clickSelector('#isolation');
  await until("!document.querySelector('#seed').disabled",'CSP canary');
  await step('CSP-canary-pass',{status:await ev("document.querySelector('#status').textContent")});
  await clickSelector('#seed');await until("!document.querySelector('#play').hidden",'fixture readback');
  const expected=JSON.parse(await readFile(path.join(run,'fixture.json'),'utf8'));
  assert.equal(canonical(await entries()),canonical(expected.entries));
  await step('fixture-valid',{hash:hash(canonical(await entries()))});
  await chrome.screenshot(prefix+'-setup.png');
  await clickSelector('#play');await until("window.fsm && Object.keys(fsm.states).some(k=>k==='title'&&fsm.states[k]===fsm.currentState)",'title');
  await tutorial();await checkpoint('title');await chrome.screenshot(prefix+'-title.png');
  // Existing title control; read layout values without invoking controller methods.
  const startButton=await ev('(()=>{const b=fsm.currentState.playButton;return b?{x:b.x+b.width/2,y:b.y+b.height/2}:null})()');
  if(startButton)await canvasClick(startButton.x,startButton.y);else await canvasClick(400,405);
  await until("document.querySelector('#playerNameInputField')?.getClientRects().length",'name');
  await tutorial();await enterText('#playerNameInputField','テスト');await enterKey();
  await until("window.fsm && fsm.currentState===fsm.states.courseSelect",'course');await tutorial();await step('fictional-name-course');
  await canvasClick(200,300);await until("fsm.currentState===fsm.states.regionSelect",'region');await tutorial();
  const region=await ev('(()=>{const s=fsm.currentState,m=s.mapRect,c=s.camera;return m&&c?{x:c.x+(m.x+m.width*.82)*c.scale,y:c.y+(m.y+m.height*.175)*c.scale}:null})()');
  if(!region)throw Error('Region layout unavailable');await canvasClick(region.x,region.y);
  await until("fsm.currentState===fsm.states.stageSelect",'stageSelect');await tutorial();await step('hokkaido-selected');
  const selectStage=async()=>{
    const button=await ev("(()=>{const b=fsm.currentState.stageButtons.find(b=>b.id==='hokkaido_area1');return {x:b.x+b.width/2,y:b.y+b.height/2};})()");
    await canvasClick(button.x,button.y);await sleep(800);
    if(await state()==='stageSelect') await canvasClick(button.x,button.y); // Existing select -> confirm UI.
    await until("fsm.currentState===fsm.states.battle",'battle');await tutorial();
    await until("__e0Text.some(t=>t.font==='80px serif') && document.querySelector('#kanjiInput')?.getClientRects().length",'question');
  };
  await selectStage();await checkpoint('first-question');await chrome.screenshot(prefix+'-battle.png');
  const catalog=JSON.parse(await readFile(path.resolve(options.baseline,'public/data/kanji_g1_proto.json'),'utf8'));
  const question=()=>ev("[...__e0Text].reverse().find(t=>t.font==='80px serif')?.text");
  const text=await question(),item=catalog.find(k=>k.kanji===text);if(!item)throw Error('Question missing from catalog');
  // Existing default accepts a registered reading. No hints or game-state mutation.
  const reading=item.kunyomi[0] || item.onyomi[0];
  const before=JSON.parse((await entries()).krb_save).player.coreStats;
  await enterText('#kanjiInput',reading);await enterKey();
  await until(`JSON.parse(localStorage.krb_save).player.coreStats.totalCorrect>${before.totalCorrect}`,'correct saved');
  await checkpoint('correct');await chrome.screenshot(prefix+'-correct.png');await sleep(2600);
  await enterText('#kanjiInput','ぬぬぬぬぬ');await enterKey();
  await until(`JSON.parse(localStorage.krb_save).player.coreStats.totalIncorrect>${before.totalIncorrect}`,'incorrect saved');
  await checkpoint('incorrect');await chrome.screenshot(prefix+'-incorrect.png');await sleep(3500);
  // Exit via the existing visible stage-selection button.
  const exit=await ev("[...__e0Text].reverse().find(t=>t.text==='もどる' && t.x<200 && t.y<70)");
  if(!exit)throw Error('Exit button not observed');await canvasClick(exit.x,exit.y);
  await until("fsm.currentState===fsm.states.stageSelect",'exit');await checkpoint('exit');await tutorial();
  await selectStage();await checkpoint('reenter');await chrome.screenshot(prefix+'-reenter.png');
  await chrome.send('Page.reload',{});await until("window.fsm && fsm.currentState===fsm.states.title",'reload title');await tutorial();
  await checkpoint('reload');await chrome.screenshot(prefix+'-reload.png');
  evidence.finalFirebase=await ev('typeof globalThis.firebase');assert.equal(evidence.finalFirebase,'undefined');
  const final=await ev("(async()=>{const {readSaveState}=await import('/__experiment/save-validator.js');return readSaveState().status;})()");
  assert.equal(final,'valid');
  const receiver=await(await fetch(origin+'/__experiment/receiver-status')).json();assert.equal(receiver.received,0);
  evidence.receiver=receiver;evidence.valid=final;
  const external=evidence.requests.filter(r=>/^https?:/.test(r.url)&&!r.url.startsWith(origin+'/'));
  const sdk=external.filter(r=>r.url.startsWith('https://www.gstatic.com/firebasejs/'));
  assert.ok(sdk.length>0);assert.ok(sdk.every(r=>evidence.failures.some(f=>f.id===r.id&&f.blockedReason==='csp')));
  assert.equal(evidence.responses.filter(r=>/^https?:/.test(r.url)&&!r.url.startsWith(origin+'/')).length,0);
  evidence.pass=true;await step('ISO-browser-PASS',{sdkBlocked:sdk.length,externalResponses:0,receiver:0,valid:final});
} catch(error) {
  evidence.error=String(error.stack||error);console.error(evidence.error);
  try{evidence.screen=await state();evidence.body=await ev('document.body.innerText');evidence.canvasText=await ev('globalThis.__e0Text');await chrome.screenshot(prefix+'-failure.png');}catch{}
  process.exitCode=1;
} finally {
  evidence.finishedAt=new Date().toISOString();await writeFile(prefix+'-evidence.json',JSON.stringify(evidence,null,2));await chrome.close();
}
