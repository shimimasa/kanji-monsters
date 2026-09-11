// Isolated Chrome + artificial E0 fixture only. Timers here are test-driver waits.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { connect } from '../motion-02/cdp.mjs';

const [fixturePath, out] = process.argv.slice(2);
if (!fixturePath || !out) throw new Error('artificial-fixture.json new-output-directory required');
await fs.mkdir(out, { recursive: true });
const fixture = JSON.parse(await fs.readFile(fixturePath, 'utf8'));
assert.equal(fixture.manifest?.runId, 'e0-cert-01');
assert.match(fixture.manifest?.method ?? '', /Fresh MemoryStorage/);

const origin = 'http://127.0.0.1:49771', bootstrap = await connect(49772);
const { targetId } = await bootstrap.call('Target.createTarget', { url: 'about:blank' });
const tabs = await (await fetch('http://127.0.0.1:49772/json/list')).json();
for (const tab of tabs) if (tab.type === 'page' && tab.id !== targetId &&
    (tab.url === 'about:blank' || tab.url.startsWith(`${origin}/`))) {
  await bootstrap.call('Target.closeTarget', { targetId: tab.id });
}
bootstrap.close();
const c = await connect(49772);
const evidence = { checks: [], blocked: [], externalSuccess: [], exceptions: [], screenshots: [], performance: [] };
let imageMode = 'normal', heldImages = [], initId;

c.on(message => {
  if (message.method === 'Fetch.requestPaused') {
    const request = message.params, url = request.request.url;
    const local = url.startsWith(`${origin}/`) || url.startsWith('data:');
    if (!local) evidence.blocked.push(url);
    if (local && url.includes('/monsters/full/grade1-hokkaido/HKD-E01.webp') && imageMode === 'pending') {
      heldImages.push(request.requestId); return;
    }
    const fail = !local || (url.includes('/monsters/full/grade1-hokkaido/HKD-E01.webp') && imageMode === 'fail');
    c.call(fail ? 'Fetch.failRequest' : 'Fetch.continueRequest', fail
      ? { requestId: request.requestId, errorReason: 'BlockedByClient' }
      : { requestId: request.requestId }).catch(() => {});
  }
  if (message.method === 'Network.responseReceived' &&
      !message.params.response.url.startsWith(origin) && !message.params.response.url.startsWith('data:')) {
    evidence.externalSuccess.push(message.params.response.url);
  }
  if (message.method === 'Runtime.exceptionThrown') evidence.exceptions.push(message.params.exceptionDetails);
});

const ev = source => c.ev(source), wait = source => c.wait(source, source, 30000);
const shot = async name => { await c.shot(path.join(out, `${name}.png`)); evidence.screenshots.push(`${name}.png`); };
const check = (name, actual, expected = true) => { assert.deepEqual(actual, expected, name); evidence.checks.push(name); };
const state = () => ev('fsm.states.miniGame.inspect()');
const point = async selector => {
  await wait(`document.querySelector(${JSON.stringify(selector)})?.getClientRects().length>0`);
  return ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
};
const click = async selector => { const p = await point(selector); await c.click(p.x, p.y); };
const touch = async selector => { const p = await point(selector); await c.call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] }); await c.call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
const action = name => click(`[data-action="${name}"]`);
const choose = (choiceId, useTouch = false) => (useTouch ? touch : click)(`[data-choice-id="${choiceId}"]`);
const chooseCorrect = async (useTouch = false) => choose((await state()).session.problem.correctChoiceId, useTouch);
const enter = async () => { await click('#titleEnglishChoiceButton'); await wait('fsm.states.miniGame.inspect().session?.phase==="answering"'); };
const back = async () => { await action('back'); await wait('fsm.currentState===fsm.states.title'); };

const boot = async (owned = true, mode = 'normal') => {
  imageMode = mode;
  for (const requestId of heldImages.splice(0)) await c.call('Fetch.failRequest', { requestId, errorReason: 'Aborted' }).catch(() => {});
  if (initId) await c.call('Page.removeScriptToEvaluateOnNewDocument', { identifier: initId });
  const entries = structuredClone(fixture.entries);
  for (const key of ['krb_save', 'yomitabi_confirmed_1']) {
    const save = JSON.parse(entries[key]); save.player.collection.gotomonIds = owned ? ['HKD-E01'] : [];
    save.settings.bgmVolume = 0; save.settings.seVolume = 0; save.settings.autosaveEnabled = false;
    save.meta.compatibilityEntries ??= {}; save.meta.compatibilityEntries.tutorial_seen_title = '1';
    entries[key] = JSON.stringify(save);
  }
  entries.krb_monster_dex = JSON.stringify(owned ? ['HKD-E01'] : []);
  entries.tutorial_seen_title = '1'; entries.inputMethod = 'device';
  const source = `if(location.origin===${JSON.stringify(origin)}){localStorage.clear();for(const[k,v]of Object.entries(${JSON.stringify(entries)}))localStorage.setItem(k,v);
    window.__mq={raf:0,interval:0,tasks:[],updates:[],listeners:[]};
    const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener=function(type,fn,...args){const owner=new Error().stack.split(String.fromCharCode(10)).find(line=>line.includes('/src/'));if(owner?.includes('/src/minigames/'))__mq.listeners.push({target:this,type,fn});return add.call(this,type,fn,...args);};
    EventTarget.prototype.removeEventListener=function(type,fn,...args){__mq.listeners=__mq.listeners.filter(e=>e.target!==this||e.type!==type||e.fn!==fn);return remove.call(this,type,fn,...args);};
    for(const name of ['requestAnimationFrame','setInterval']){const original=window[name];window[name]=function(...args){if(new Error().stack.includes('/src/minigames/'))__mq[name==='setInterval'?'interval':'raf']++;return original.apply(this,args);};}
    new PerformanceObserver(list=>{for(const e of list.getEntries())if(document.getElementById('englishChoiceScreen'))__mq.tasks.push({start:e.startTime,duration:e.duration});}).observe({type:'longtask',buffered:false});}`;
  initId = (await c.call('Page.addScriptToEvaluateOnNewDocument', { source })).identifier;
  await c.call('Emulation.setDeviceMetricsOverride', { width: 1086, height: 723, deviceScaleFactor: 1, mobile: false });
  await c.call('Page.navigate', { url: `${origin}/` });
  await wait('window.fsm?.states?.miniGame && fsm.currentState===fsm.states.title');
  await ev(`(async()=>{window.__game=(await import('/src/core/gameState.js'));const h=fsm.states.miniGame,update=h.update;h.update=function(dt){const t=performance.now();try{return update(dt);}finally{__mq.updates.push(performance.now()-t);}};})()`);
};

try {
  await c.call('Page.enable'); await c.call('Runtime.enable'); await c.call('Network.enable');
  await c.call('Network.setCacheDisabled', { cacheDisabled: true });
  await c.call('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
  await boot(); await shot('title');
  check('English title entry exists', await ev("document.querySelector('#titleEnglishChoiceButton')?.textContent"), 'ミニゲーム：えいたんご4たく');
  await enter(); await wait('fsm.states.miniGame.inspect().companion.motion?.imageState==="ready"');
  check('English game id', (await state()).session.gameId, 'englishChoice');
  check('owned E01 shown', (await state()).companion.selected, 'HKD-E01'); await shot('desktop-owned');
  const before = await ev(`JSON.stringify({game:__game.gameState,storage:Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))},(k,v)=>k==='playtimeSeconds'?undefined:v)`);
  let current = (await state()).session;
  check('four choices', current.problem.choices.length, 4);
  const firstChoiceId = current.problem.correctChoiceId;
  await chooseCorrect(); await choose(firstChoiceId);
  check('double click scores once', (await state()).session.answered, 1);
  check('correct attacks', (await state()).companion.action, 'attack'); await shot('correct-feedback');
  await action('next'); current = (await state()).session;
  const wrong = current.problem.choices.find(choice => choice.choiceId !== current.problem.correctChoiceId);
  await choose(wrong.choiceId); check('incorrect committed', (await state()).session.incorrect, 1);
  check('incorrect idles', (await state()).companion.action, 'idle'); await shot('incorrect-feedback');
  await action('next'); current = (await state()).session;
  await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'1',repeat:true,bubbles:true,cancelable:true}))`);
  check('keyboard repeat rejected', (await state()).session.answered, 2);
  const keyboardChoice = current.problem.choices[0].choiceId;
  await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'1',repeat:false,bubbles:true,cancelable:true}))`);
  check('keyboard 1 answers', (await state()).session.answered, 3);
  check('keyboard identity', (await state()).session.lastAnswer.choiceId, keyboardChoice);
  await action('next'); current = (await state()).session;
  await ev(`(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))})()`);
  const elapsed = (await state()).session.activeElapsedMs;
  await chooseCorrect(); await ev('fsm.states.miniGame.update(1000)');
  check('hidden rejects choice', (await state()).session.answered, 3);
  check('hidden freezes elapsed', (await state()).session.activeElapsedMs, elapsed);
  await ev(`fsm.states.miniGame.setPaused(true);Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))`);
  check('visible keeps manual pause', (await state()).session.paused, true);
  await ev(`fsm.states.miniGame.setPaused(false);delete document.hidden`);
  await chooseCorrect(); check('resume accepts choice', (await state()).session.answered, 4);
  for (let index = 4; index < 10; index++) {
    await action('next'); await chooseCorrect();
    check(`answer ${index + 1}`, (await state()).session.answered, index + 1);
  }
  current = (await state()).session;
  check('ten-question result answered', current.result.answered, 10);
  check('result accounting', current.result.correct + current.result.incorrect, 10);
  check('sessionComplete once seq21', current.seq, 21); await shot('result');
  await ev(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'1',repeat:false,bubbles:true,cancelable:true}))`);
  check('late choice does not repeat complete', (await state()).session.seq, 21);
  const after = await ev(`JSON.stringify({game:__game.gameState,storage:Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))},(k,v)=>k==='playtimeSeconds'?undefined:v)`);
  check('kanji Core and Storage invariant', after, before);
  const oldSessionId = current.sessionId, oldAttemptId = current.attemptId;
  await action('replay'); current = (await state()).session;
  check('replay new session', current.sessionId !== oldSessionId); check('replay seq reset', current.seq, 1);
  check('replay fresh attempt', current.attemptId !== oldAttemptId);
  for (const [width, height] of [[390, 844], [844, 390]]) {
    await c.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    await c.call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await ev('fsm.states.miniGame.update(0)');
    const sizes = await ev(`(()=>{const root=document.getElementById('englishChoiceScreen');return{overflow:root.scrollWidth>root.clientWidth,buttons:[...root.querySelectorAll('button')].filter(e=>e.getClientRects().length).map(e=>({h:e.getBoundingClientRect().height,w:e.getBoundingClientRect().width}))}})()`);
    check(`${width}x${height} no horizontal overflow`, sizes.overflow, false);
    check(`${width}x${height} buttons44`, sizes.buttons.every(button => button.h >= 44 && button.w >= 44));
    const mobileState = (await state()).session; await chooseCorrect(true);
    check(`${width}x${height} touch choice`, (await state()).session.answered, mobileState.answered + 1); await shot(`mobile-${width}x${height}`);
    await touch('[data-action="next"]'); check(`${width}x${height} touch Next`, (await state()).session.phase, 'answering');
  }
  await c.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  current = (await state()).session; await chooseCorrect();
  check('reduced motion keeps scoring', (await state()).session.correct, current.correct + 1);
  await c.call('Emulation.setEmulatedMedia', { features: [] }); await back();
  check('exit destroys session', (await state()).session, null);
  for (let index = 0; index < 10; index++) {
    await enter(); await back();
    check(`exit/reenter ${index + 1} DOM removed`, await ev("document.querySelectorAll('#englishChoiceScreen').length"), 0);
    check(`exit/reenter ${index + 1} listeners removed`, await ev('__mq.listeners.length'), 0);
    check(`exit/reenter ${index + 1} companion released`, (await state()).companion, null);
  }
  evidence.performance.push(await ev('({raf:__mq.raf,interval:__mq.interval,maxHostUpdateMs:Math.max(...__mq.updates),longTasks:__mq.tasks})'));
  check('mini-game RAF zero', evidence.performance.at(-1).raf, 0);
  check('mini-game interval zero', evidence.performance.at(-1).interval, 0);
  check('Host updates below 50ms', evidence.performance.at(-1).maxHostUpdateMs < 50);
  await boot(false); await enter(); check('unowned companion absent', (await state()).companion.selected, null); await shot('unowned');
  for (let index = 0; index < 10; index++) { await chooseCorrect(); if (index < 9) await action('next'); }
  check('unowned completes', (await state()).session.result.correct, 10); await back();
  await boot(true, 'pending'); await enter(); await wait('fsm.states.miniGame.inspect().companion.motion?.imageState==="pending"');
  await chooseCorrect(); check('pending image does not gate answer', (await state()).session.answered, 1); await back();
  imageMode = 'normal'; for (const requestId of heldImages.splice(0)) await c.call('Fetch.continueRequest', { requestId });
  await enter(); await wait('fsm.states.miniGame.inspect().companion.motion?.imageState==="ready"');
  check('late image does not revive old session', (await state()).session.answered, 0); await back();
  await boot(true, 'fail'); await enter(); await wait('fsm.states.miniGame.inspect().companion.motion?.imageState==="failed"');
  await chooseCorrect(); check('failed image does not gate answer', (await state()).session.answered, 1); await shot('image-failure'); await back();
  check('Firebase/external successes zero', evidence.externalSuccess.length, 0);
  check('runtime exceptions zero', evidence.exceptions.length, 0);
  evidence.status = 'PASS'; await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} catch (error) {
  evidence.status = 'FAIL'; evidence.error = error.stack;
  await shot('failure').catch(() => {}); await fs.writeFile(path.join(out, 'failure.json'), JSON.stringify(evidence, null, 2)); throw error;
} finally { c.close(); }
