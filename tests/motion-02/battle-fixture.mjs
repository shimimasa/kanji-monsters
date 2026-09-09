import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import { setTimeout as waitRealTime } from 'node:timers/promises';
import { installStorage } from '../phase-a/storage-helper.mjs';
register('../no-go/helpers/tutorial-import-loader.mjs', import.meta.url);
const storage = installStorage();
const { getDefaultSave, saveNow } = await import('../../src/core/saveData.js');
const { gameState, battleState, loadGameData } = await import('../../src/core/gameState.js');
const { default: battle } = await import('../../src/screens/battleScreen.js');
const { default: practice } = await import('../../src/screens/practiceBattleScreen.js');
const { default: quick } = await import('../../src/screens/quickReviewPracticeScreen.js');
const { default: tutorial } = await import('../../src/tutorial/TutorialManager.js');
const { images } = await import('../../src/loaders/assetsLoader.js');
globalThis.fetch = async url => ({ok:true,json:async()=>JSON.parse(fs.readFileSync(new URL('../../public'+url,import.meta.url),'utf8'))});
const loader = await import('../../src/loaders/dataLoader.js');
await loader.loadAllGameData();
const drain = () => new Promise(resolve => setImmediate(resolve));
function element() {
  const classes = new Set();
  return Object.assign(new EventTarget(), {
    value:'', children:[], style:{setProperty(k,v){this[k]=v;},removeProperty(k){delete this[k];}},
    classList:{add:k=>classes.add(k),remove:k=>classes.delete(k),contains:k=>classes.has(k)},
    focus(){},blur(){},setAttribute(){},removeAttribute(){},
    appendChild(e){this.children.push(e);e.parent=this;return e;},
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(e=>e!==this);},
    getBoundingClientRect:()=>({left:0,top:0,width:320,height:48}),
  });
}
export async function fixture(t, screen) {
  const errors=[];
  t.mock.method(console,'log',()=>{});t.mock.method(console,'warn',()=>{});
  t.mock.method(console,'error',(...args)=>errors.push(args.map(String).join(' ')));
  storage.clear();saveNow(getDefaultSave(),{replace:true});await loadGameData();
  const timers=new Map(),frames=new Map(),intervals=new Map();let id=0;
  for(const [set,clear,map] of [['setTimeout','clearTimeout',timers],['setInterval','clearInterval',intervals]]) {
    t.mock.method(globalThis,set,(fn,ms)=>{map.set(++id,{fn,ms});return id;});
    t.mock.method(globalThis,clear,i=>map.delete(i));
  }
  const globals=['window','document','Image','alert','confirm','requestAnimationFrame','cancelAnimationFrame','__holdTutorialImport'];
  const previous=new Map(globals.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  const grad={addColorStop(){}};
  const ctx=new Proxy({measureText:s=>({width:String(s).length*16}),createLinearGradient:()=>grad,createRadialGradient:()=>grad,
    getImageData:()=>({data:[]})},{get:(o,k)=>k in o?o[k]:()=>{}});
  const canvas=Object.assign(element(),{width:800,height:600,getContext:()=>ctx,toDataURL:()=> 'data:image/png;base64,test'});
  const input=element(),body=element();
  globalThis.window=Object.assign(new EventTarget(),{matchMedia:()=>({matches:false}),innerWidth:390,innerHeight:700,scrollTo(){}});
  globalThis.document=Object.assign(new EventTarget(),{body,documentElement:element(),getElementById:id=>id==='gameCanvas'?canvas:id==='kanjiInput'?input:null,
    querySelector:()=>null,querySelectorAll:()=>[],createElement:tag=>tag==='canvas'?Object.assign(element(),{getContext:()=>ctx,toDataURL:canvas.toDataURL}):element()});
  globalThis.alert=s=>errors.push('alert: '+s);globalThis.confirm=()=>false;
  globalThis.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};
  globalThis.cancelAnimationFrame=i=>frames.delete(i);
  const pendingImages=[];
  globalThis.Image=class {width=800;height=600;set src(url){this.url=url;if(url.startsWith('data:'))queueMicrotask(()=>this.onload?.());else pendingImages.push(this);}};
  const imports=[],starts=[];let label='old';
  globalThis.__holdTutorialImport=(ready,url)=>{
    let release;const held=new Promise(resolve=>release=resolve);
    imports.push({label,url,ready,release,owner:screen._lifecycle});return held;
  };
  const original=tutorial._start;
  t.mock.method(tutorial,'_start',function(...args){starts.push({label:delivery,id:args[0]});return original.apply(this,args);});
  let delivery='';
  async function release(group) {
    delivery=group;
    for(const item of imports.filter(i=>i.label===group))item.release(await item.ready);
    await drain();
  }
  function enter(group='old',stage='hokkaido_area1') {
    label=group;
    Object.assign(gameState,{currentStageId:stage,previousScreen:'stageSelect',quickReviewTargets:{stageId:stage,ids:['g1-001'],texts:[]},wrongKanjiList:[]});
    screen.enter(canvas);
    assert.deepEqual(errors.filter(e=>/初期化に失敗|alert:|enter\(\) でエラー/.test(e)),[],errors.join('\n'));
    assert.ok(imports.some(i=>i.label===group&&i.url.endsWith(screen===battle?'/battleScreen.js':'/practiceBattleScreen.js')),'real enter reached tutorial import');
  }
  t.after(async()=>{
    if(screen._active)screen.exit();
    for(const i of imports)i.owner?.deactivate();
    for(const group of new Set(imports.map(i=>i.label)))await release(group);
    tutorial._destroy();
    for(const [k,d]of previous)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];
  });
  return {canvas,input,body,enter,release,imports,starts,pendingImages,timers,frames,intervals,
    overlays:()=>body.children.filter(e=>e.style.zIndex===100002),
    marker(){gameState.currentStageId='next-screen';battleState.turn='next-screen';return ()=>({stage:gameState.currentStageId,turn:battleState.turn});}};
}

export { gameState, battleState, battle, practice, quick, images, storage, drain };

// Node's loader worker can still be resolving a cached dynamic import after many
// immediate callbacks. Wait for the actual observable state, not 30 event-loop turns.
// This is test-only transport; the fixture's mocked product timers stay untouched.
export async function waitForMotionReady() {
  const deadline = Date.now() + 2000;
  do {
    const state = battle._pixelMotion?.inspect();
    if (state?.imageState === 'ready') return;
    if (state?.failed || state?.disposed) break;
    await waitRealTime(1);
  } while (Date.now() < deadline);
  throw Error('host not ready: ' + JSON.stringify(battle._pixelMotion?.inspect()));
}
