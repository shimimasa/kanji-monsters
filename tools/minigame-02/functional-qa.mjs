// Isolated Chrome + artificial E0 fixture only. Timers here are test-driver waits.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { connect } from '../motion-02/cdp.mjs';

const [fixturePath, out] = process.argv.slice(2);
if (!fixturePath || !out) throw Error('artificial-fixture.json new-output-directory required');
await fs.mkdir(out, { recursive: true });
const fixture = JSON.parse(await fs.readFile(fixturePath, 'utf8'));
assert.equal(fixture.manifest?.runId, 'e0-cert-01');
assert.match(fixture.manifest?.method ?? '', /Fresh MemoryStorage/);

const origin = 'http://127.0.0.1:49761';
const port = 49762;
const bootstrap = await connect(port);
const { targetId } = await bootstrap.call('Target.createTarget', { url: 'about:blank' });
const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
for (const tab of tabs) if (tab.type === 'page' && tab.id !== targetId) {
  await bootstrap.call('Target.closeTarget', { targetId: tab.id });
}
bootstrap.close();

const c = await connect(port);
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
  if (message.method === 'Network.responseReceived') {
    const url = message.params.response.url;
    if (!url.startsWith(origin) && !url.startsWith('data:')) evidence.externalSuccess.push(url);
  }
  if (message.method === 'Runtime.exceptionThrown') evidence.exceptions.push(message.params.exceptionDetails);
});

const ev = expression => c.ev(expression);
const wait = expression => c.wait(expression, expression, 30000);
const check = (name, actual, expected = true) => { assert.deepEqual(actual, expected, name); evidence.checks.push(name); };
const shot = async name => { await c.shot(path.join(out, `${name}.png`)); evidence.screenshots.push(`${name}.png`); };
const state = () => ev('fsm.states.miniGame.inspect()');
const button = async selector => {
  await wait(`document.querySelector(${JSON.stringify(selector)})?.getClientRects().length>0`);
  const point = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await c.click(point.x, point.y);
};
const touch = async selector => {
  await wait(`document.querySelector(${JSON.stringify(selector)})?.getClientRects().length>0`);
  const point = await ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await c.call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await c.call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};
const action = name => button(`[data-action="${name}"]`);
const key = async (keyName, extra = {}) => {
  const code = keyName === 'Enter' ? 13 : 0;
  await c.call('Input.dispatchKeyEvent', { type: 'keyDown', key: keyName, code: keyName, windowsVirtualKeyCode: code, ...extra });
  await c.call('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code: keyName, windowsVirtualKeyCode: code });
};
const type = async value => {
  await wait(`document.querySelector('#mathInvaderScreen input')?.disabled===false`);
  await ev(`(()=>{const input=document.querySelector('#mathInvaderScreen input');input.focus();input.value='';})()`);
  await c.call('Input.insertText', { text: String(value) });
};
const choose = async (enemy = null, useTouch = false) => {
  const current = (await state()).session;
  const target = enemy ?? current.enemies[0];
  const selector = `[data-enemy-id="${target.enemyId}"]`;
  await (useTouch ? touch(selector) : button(selector));
  await wait(`fsm.states.miniGame.inspect().session?.selectedEnemyId===${JSON.stringify(target.enemyId)}`);
};
const enter = async () => {
  await button('#titleMathInvaderButton');
  await wait('fsm.states.miniGame.inspect().session?.gameId==="mathInvader"');
};
const back = async () => { await action('back'); await wait('fsm.currentState===fsm.states.title'); };
const ensureEnemy = async () => {
  if (!(await state()).session.enemies.length) {
    await ev('fsm.states.miniGame.update(900)');
    await wait('fsm.states.miniGame.inspect().session.enemies.length>0');
  }
};
const correctSelected = async (useEnter = false) => {
  const before = (await state()).session, answer = before.selectedEnemy.answer;
  await type(answer); if (useEnter) await key('Enter'); else await action('answer');
  await wait(`fsm.states.miniGame.inspect().session.resolved===${before.resolved + 1}`);
};

const boot = async (owned = true, mode = 'normal') => {
  imageMode = mode;
  for (const requestId of heldImages.splice(0)) await c.call('Fetch.failRequest', { requestId, errorReason: 'Aborted' }).catch(() => {});
  if (initId) await c.call('Page.removeScriptToEvaluateOnNewDocument', { identifier: initId });
  const entries = structuredClone(fixture.entries);
  for (const keyName of ['krb_save', 'yomitabi_confirmed_1']) {
    const save = JSON.parse(entries[keyName]); save.player.collection.gotomonIds = owned ? ['HKD-E01'] : [];
    save.settings.bgmVolume = 0; save.settings.seVolume = 0; save.settings.autosaveEnabled = false;
    save.meta.compatibilityEntries ??= {}; save.meta.compatibilityEntries.tutorial_seen_title = '1';
    entries[keyName] = JSON.stringify(save);
  }
  entries.krb_monster_dex = JSON.stringify(owned ? ['HKD-E01'] : []);
  entries.tutorial_seen_title = '1'; entries.inputMethod = 'device';
  const source = `if(location.origin===${JSON.stringify(origin)}){localStorage.clear();for(const[k,v]of Object.entries(${JSON.stringify(entries)}))localStorage.setItem(k,v);
    window.__mi={raf:0,interval:0,tasks:[],updates:[],listeners:[]};
    const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener=function(type,fn,...args){const owner=new Error().stack.split(String.fromCharCode(10)).find(line=>line.includes('/src/'));if(owner?.includes('/src/minigames/'))__mi.listeners.push({target:this,type,fn});return add.call(this,type,fn,...args);};
    EventTarget.prototype.removeEventListener=function(type,fn,...args){__mi.listeners=__mi.listeners.filter(e=>e.target!==this||e.type!==type||e.fn!==fn);return remove.call(this,type,fn,...args);};
    for(const name of ['requestAnimationFrame','setInterval']){const original=window[name];window[name]=function(...args){if(new Error().stack.includes('/src/minigames/'))__mi[name==='setInterval'?'interval':'raf']++;return original.apply(this,args);};}
    new PerformanceObserver(list=>{for(const entry of list.getEntries())if(document.getElementById('mathInvaderScreen'))__mi.tasks.push({start:entry.startTime,duration:entry.duration});}).observe({type:'longtask',buffered:false});}`;
  initId = (await c.call('Page.addScriptToEvaluateOnNewDocument', { source })).identifier;
  await c.call('Emulation.setDeviceMetricsOverride', { width: 1086, height: 723, deviceScaleFactor: 1, mobile: false });
  await c.call('Page.navigate', { url: `${origin}/` });
  await wait('window.fsm?.states?.miniGame && fsm.currentState===fsm.states.title && document.querySelector("#titleMathInvaderButton")');
  await ev(`(async()=>{window.__game=(await import('/src/core/gameState.js'));const host=fsm.states.miniGame,update=host.update.bind(host);host.update=function(dt){const t=performance.now();try{return update(dt);}finally{__mi.updates.push(performance.now()-t);}};})()`);
};

try {
  await c.call('Page.enable'); await c.call('Runtime.enable'); await c.call('Network.enable');
  await c.call('Network.setCacheDisabled', { cacheDisabled: true });
  await c.call('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });

  await boot(true); await shot('title');
  check('title has Sprint and Invader entries', await ev("!!document.querySelector('#titleMiniGameButton')&&!!document.querySelector('#titleMathInvaderButton')"));
  await enter(); await wait('fsm.states.miniGame.inspect().companion.motion?.imageState==="ready"'); await shot('owned-start');
  check('owned E01 shown', (await state()).companion.selected, 'HKD-E01');
  const beforeCore = await ev(`JSON.stringify({game:__game.gameState,storage:Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))},(k,v)=>k==='playtimeSeconds'?undefined:v)`);
  await wait('fsm.states.miniGame.inspect().session.enemies.length===3');
  check('spawn max three', (await state()).session.enemies.length, 3);
  const y0 = (await state()).session.enemies[0].y; await new Promise(resolve => setTimeout(resolve, 120));
  check('continuous Host update descends enemies', (await state()).session.enemies[0].y > y0);

  let current = (await state()).session; const first = current.enemies[0], second = current.enemies[1];
  await choose(first); const oldAttempt = (await state()).session.selectedEnemy.attemptId;
  await choose(second); check('enemy switch changes attempt', (await state()).session.selectedEnemy.attemptId !== oldAttempt);
  const pausedY = (await state()).session.enemies.map(enemy => enemy.y); await new Promise(resolve => setTimeout(resolve, 140));
  check('answer selection pauses descent', (await state()).session.enemies.map(enemy => enemy.y), pausedY);
  await type('7');
  const activeBefore = (await state()).session.activeElapsedMs;
  await ev(`Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))`);
  await ev('fsm.states.miniGame.update(1000)');
  check('visibility pauses active elapsed', (await state()).session.activeElapsedMs, activeBefore);
  check('visibility retains input buffer', await ev("document.querySelector('#mathInvaderScreen input').value"), '7');
  await ev(`fsm.states.miniGame.setPaused(true);Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))`);
  check('visibility resume preserves manual pause', (await state()).session.paused, true);
  await ev('fsm.states.miniGame.setPaused(false);delete document.hidden');

  current = (await state()).session; await type(String.fromCharCode(0xff10 + current.selectedEnemy.answer));
  await ev(`document.querySelector('#mathInvaderScreen input').dispatchEvent(new CompositionEvent('compositionstart'))`);
  await key('Enter'); await action('answer'); check('IME rejects Enter and button', (await state()).session.resolved, 0);
  await ev(`document.querySelector('#mathInvaderScreen input').dispatchEvent(new CompositionEvent('compositionend'))`);
  await ev(`document.querySelector('#mathInvaderScreen input').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',repeat:true,bubbles:true,cancelable:true}))`);
  check('key repeat rejected', (await state()).session.resolved, 0);
  await key('Enter'); await action('answer'); await key('Enter');
  check('Enter plus button commits once', (await state()).session.resolved, 1);
  check('full-width answer accepted', (await state()).session.correct, 1);
  check('correct starts Companion attack', (await state()).companion.action, 'attack');
  check('correct creates display projectile after commit', (await state()).session.projectiles.length, 1); await shot('correct-attack');

  await ensureEnemy(); await choose(); current = (await state()).session; const retryEnemy = current.selectedEnemy.enemyId, retryAttempt = current.selectedEnemy.attemptId;
  await type(current.selectedEnemy.answer + 1); await action('answer'); await wait('fsm.states.miniGame.inspect().session.incorrect===1');
  const retried = (await state()).session;
  check('incorrect costs local life', retried.life, 2); check('incorrect keeps enemy', retried.selectedEnemy.enemyId, retryEnemy);
  check('incorrect issues new attempt', retried.selectedEnemy.attemptId !== retryAttempt); check('incorrect returns Companion idle', (await state()).companion.action, 'idle');
  await correctSelected(true); check('retry can resolve same enemy', (await state()).session.resolved, 2); await shot('incorrect-retry');

  while (!(await state()).session.result) {
    await ensureEnemy(); if (!(await state()).session.selectedEnemy) await choose(); await correctSelected();
    await ev('fsm.states.miniGame.update(900)');
  }
  const clear = (await state()).session;
  check('ten resolved clears', clear.result.outcome, 'clear'); check('clear result counts',
    { correct: clear.result.correct, incorrect: clear.result.incorrect, resolved: clear.result.resolved, life: clear.result.life },
    { correct: 10, incorrect: 1, resolved: 10, life: 2 });
  check('clear sessionComplete sequence', clear.seq, 22); check('complete leaves Companion idle', (await state()).companion.action, 'idle');
  await shot('clear-result');
  const afterCore = await ev(`JSON.stringify({game:__game.gameState,storage:Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))},(k,v)=>k==='playtimeSeconds'?undefined:v)`);
  check('kanji Core and Storage invariant', afterCore, beforeCore);
  await back(); check('exit clears session and Companion', { session: (await state()).session, companion: (await state()).companion }, { session: null, companion: null });

  await enter(); const replaySession = (await state()).session.sessionId; await back(); await enter();
  check('reenter creates new session', (await state()).session.sessionId !== replaySession); await back();

  await boot(true); await c.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }); await enter();
  for (const [width, height] of [[390, 844], [844, 390]]) {
    await c.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true });
    await c.call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await ensureEnemy(); if (!(await state()).session.selectedEnemy) await choose(null, true);
    const sizes = await ev(`(()=>{const root=document.getElementById('mathInvaderScreen');return{overflow:root.scrollWidth>root.clientWidth,buttons:[...root.querySelectorAll('button')].filter(e=>e.getClientRects().length).map(e=>({h:e.getBoundingClientRect().height,w:e.getBoundingClientRect().width}))}})()`);
    check(`${width}x${height} no horizontal overflow`, sizes.overflow, false);
    check(`${width}x${height} visible buttons 44`, sizes.buttons.every(item => item.h >= 44 && item.w >= 44));
    await touch('[data-digit="0"]'); check(`${width}x${height} touch digit`, await ev("document.querySelector('#mathInvaderScreen input').value.endsWith('0')"));
    await touch('[data-digit="削除"]'); check(`${width}x${height} touch delete`, await ev("document.querySelector('#mathInvaderScreen input').value"), '');
    await shot(`mobile-${width}x${height}`); await correctSelected();
  }
  check('reduced motion does not alter scoring', (await state()).session.resolved, 2); await c.call('Emulation.setEmulatedMedia', { features: [] }); await back();

  await boot(false); await enter(); check('unowned has no Companion', (await state()).companion.selected, null);
  await choose(); for (let i = 0; i < 3; i++) {
    const attempt = (await state()).session; await type(attempt.selectedEnemy.answer + 1); await action('answer');
    await wait(`fsm.states.miniGame.inspect().session.incorrect===${i + 1}`);
  }
  check('three incorrect reaches game over', (await state()).session.result.outcome, 'gameOver');
  check('game over sessionComplete once by sequence', (await state()).session.seq, 5); await shot('unowned-game-over'); await back();

  await boot(true, 'pending'); await enter(); await wait('fsm.states.miniGame.inspect().companion.motion?.imageState==="pending"');
  await choose(); await correctSelected(); check('pending image does not block answer', (await state()).session.resolved, 1); await back();
  imageMode = 'normal'; for (const requestId of heldImages.splice(0)) await c.call('Fetch.continueRequest', { requestId });
  await enter(); check('late image cannot revive old session', (await state()).session.resolved, 0); await back();
  await boot(true, 'fail'); await enter(); await wait('fsm.states.miniGame.inspect().companion.motion?.imageState==="failed"');
  await choose(); await correctSelected(); check('failed image does not block answer', (await state()).session.resolved, 1); await shot('image-failure'); await back();

  await boot(true); for (let i = 0; i < 10; i++) {
    await enter(); await back();
    check(`lifecycle ${i + 1} DOM zero`, await ev("document.querySelectorAll('#mathInvaderScreen').length"), 0);
    check(`lifecycle ${i + 1} listeners zero`, await ev('__mi.listeners.length'), 0);
    check(`lifecycle ${i + 1} refs zero`, { session: (await state()).session, companion: (await state()).companion }, { session: null, companion: null });
  }
  const performance = await ev('({raf:__mi.raf,interval:__mi.interval,maxHostUpdateMs:Math.max(0,...__mi.updates),longTasks:__mi.tasks})');
  evidence.performance.push(performance); check('mini-game RAF zero', performance.raf, 0); check('mini-game interval zero', performance.interval, 0);
  check('Host update below 50ms', performance.maxHostUpdateMs < 50);
  check('Firebase/external successes zero', evidence.externalSuccess.length, 0);
  check('runtime exceptions zero', evidence.exceptions.length, 0);
  evidence.status = 'PASS'; await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} catch (error) {
  evidence.status = 'FAIL'; evidence.error = error.stack; await shot('failure').catch(() => {});
  await fs.writeFile(path.join(out, 'failure.json'), JSON.stringify(evidence, null, 2)); throw error;
} finally {
  c.close();
}
