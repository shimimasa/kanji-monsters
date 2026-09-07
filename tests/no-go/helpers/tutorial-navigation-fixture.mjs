import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import { installStorage } from '../../phase-a/storage-helper.mjs';
import { element } from './tutorial-navigation-dom.mjs';
register('./tutorial-navigation-loader.mjs', import.meta.url);
export const storage = installStorage();
export const {getDefaultSave,saveNow} = await import('../../../src/core/saveData.js');
export const {gameState,battleState,loadGameData} = await import('../../../src/core/gameState.js');
export const {default:tutorial} = await import('../../../src/tutorial/TutorialManager.js');
export const {subscribe} = await import('../../../src/core/eventBus.js');
export const {FSM} = await import('../../../src/core/fsm.js');
export const {images} = await import('../../../src/loaders/assetsLoader.js');
globalThis.fetch = async url => ({ok:true,json:async()=>JSON.parse(fs.readFileSync(new URL('../../../public'+url,import.meta.url),'utf8'))});
export const loader = await import('../../../src/loaders/dataLoader.js');
assert.ok(await loader.loadAllGameData());
export const screens = {};
for (const id of ['battle','practiceBattle','quickReviewPractice','courseSelect','regionSelect','stageSelect','title','resultWin','playerNameInput','continentSelect','profile','settings']) {
  screens[id]=(await import(new URL('../../../src/screens/'+id+'Screen.js',import.meta.url))).default;
}
// The observer is constructed at module load. Only image intersection delivery
// is substituted; monsterDex enter/renderPage/exit remain real.
const previousObserver = globalThis.IntersectionObserver;
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
for (const id of ['kanjiDex', 'monsterDex']) screens[id] = (await import(new URL('../../../src/screens/Dex/'+id+'Screen.js', import.meta.url))).default;
if (previousObserver) globalThis.IntersectionObserver = previousObserver;
else delete globalThis.IntersectionObserver;
export const tutorialScreens = ['title','courseSelect','regionSelect','stageSelect','battle','practiceBattle','quickReviewPractice','resultWin','profile','settings','kanjiDex','monsterDex'];
export const drain = () => new Promise(resolve=>setImmediate(resolve));
export const snapshot = () => JSON.stringify({
  stage:gameState.currentStageId,grade:gameState.currentGrade,name:gameState.playerName,
  question:gameState.currentKanji,enemies:gameState.enemies,player:gameState.playerStats,
  correct:gameState.correctKanjiList,wrong:gameState.wrongKanjiList,progress:gameState.stageProgress,
  turn:battleState.turn,input:battleState.inputEnabled,enemy:battleState.enemy,save:storage.getItem('krb_save')
});
export async function fixture(t, { holdAchievements = false } = {}) {
  const errors=[],knownAnchorFallbacks=[];
  t.mock.method(console,'log',()=>{}); t.mock.method(console,'warn',()=>{});
  t.mock.method(console,'error',(...a)=>{
    // Existing resultWin tutorialData references an undefined centerBox. The
    // real Guide catches it and renders its documented fallback; this suite
    // checks ownership, not anchor layout. Keep that exact finding observable.
    if (a[0]==='Tutorial anchor error:' && a[1] instanceof ReferenceError && a[1].message==='centerBox is not defined') knownAnchorFallbacks.push(a[1]);
    else errors.push(a.map(String).join(' '));
  });
  storage.clear(); assert.equal(saveNow(getDefaultSave(),{replace:true}).ok,true); assert.equal(await loadGameData(),true);
  Object.assign(gameState,{currentStageId:'hokkaido_area1',currentGrade:1,wrongKanjiList:[],correctKanjiList:[],quickReviewTargets:undefined});
  const grad={addColorStop(){}},draws=[];
  const ctx=new Proxy({measureText:s=>({width:String(s).length*16}),createLinearGradient:()=>grad,createRadialGradient:()=>grad,
    getImageData:()=>({data:[]})},{get:(o,k)=>k in o?o[k]:(...args)=>draws.push([k,...args])});
  const canvas=Object.assign(element(),{id:'gameCanvas',width:800,height:600,getContext:()=>ctx,toDataURL:()=> 'data:image/png;base64,QA',
    getBoundingClientRect:()=>({left:13,top:27,width:390,height:700})});
  const body=element(),input=element();input.id='kanjiInput';body.appendChild(canvas);body.appendChild(input);
  const findId=(e,id)=>e.id===id?e:e.children.map(c=>findId(c,id)).find(Boolean);
  const keys=['document','window','Image','alert','confirm','requestAnimationFrame','cancelAnimationFrame','__holdTutorialNavigation','__holdTutorialAchievements'];
  const previous=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  globalThis.document=Object.assign(new EventTarget(),{body,documentElement:element(),getElementById:id=>findId(body,id)||null,
    querySelector:s=>body.querySelector(s),querySelectorAll:s=>body.querySelectorAll(s),
    createTextNode:text=>Object.assign(element('#text'),{textContent:text}),
    createElement:tag=>tag==='canvas'?Object.assign(element(tag),{getContext:()=>ctx,toDataURL:canvas.toDataURL}):element(tag)});
  globalThis.window=Object.assign(new EventTarget(),{innerWidth:390,innerHeight:700,matchMedia:()=>({matches:false}),scrollTo(){}});
  globalThis.alert=s=>errors.push('alert:'+s);globalThis.confirm=()=>false;
  const timers=new Map(),frames=new Map(),intervals=new Map();let sequence=0,time=1000;
  for(const [set,clear,map] of [['setTimeout','clearTimeout',timers],['setInterval','clearInterval',intervals]]) {
    t.mock.method(globalThis,set,(fn,ms)=>{map.set(++sequence,{fn,ms});return sequence;});
    t.mock.method(globalThis,clear,id=>map.delete(id));
  }
  t.mock.method(performance,'now',()=>time);
  globalThis.requestAnimationFrame=fn=>{frames.set(++sequence,fn);return sequence;};
  globalThis.cancelAnimationFrame=id=>frames.delete(id);
  const pendingImages=[];
  globalThis.Image=class {width=800;height=600;set src(url){this.url=url;if(url.startsWith('data:'))queueMicrotask(()=>this.onload?.());else pendingImages.push(this);}};
  let label='g1',delivery='',current=null,live=true;
  const imports=[],calls=[],starts=[],added=[],destroyCalls=[],achievements=[];
  globalThis.__holdTutorialAchievements=ready=>{
    if (!holdAchievements) return ready;
    let resolve; const held = new Promise(r=>resolve=r);
    achievements.push({label,ready,resolve}); return held;
  };
  globalThis.__holdTutorialNavigation=(ready,url)=>{
    let resolve;const p=new Promise(r=>resolve=r);
    imports.push({label,ready,url,resolve,owner:current?._lifecycle});return p;
  };
  const call=tutorial.startIfNeeded,start=tutorial._start,destroy=tutorial._destroy,append=body.appendChild;
  t.mock.method(tutorial,'startIfNeeded',function(id,ctx){calls.push({delivery,id});return call.call(this,id,ctx);});
  t.mock.method(tutorial,'_start',function(id,steps){starts.push({delivery,id});return start.call(this,id,steps);});
  t.mock.method(tutorial,'_destroy',function(){destroyCalls.push(this.guide);return destroy.call(this);});
  t.mock.method(body,'appendChild',function(e){added.push(e);return append.call(this,e);});
  async function release(group){delivery=group;const chosen=imports.filter(i=>i.label===group);assert.ok(chosen.length,'must reach import '+group);
    for(const item of chosen)item.resolve(await item.ready);await drain();}
  function exit(){const s=current;current=null;s?.exit();}
  t.after(async()=>{
    live=false;exit();
    for(const item of achievements)item.resolve(await item.ready);await drain();
    for(const i of imports)i.resolve(await i.ready);await drain();tutorial._destroy();
    for(const [k,d] of previous)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];
    assert.deepEqual(errors,[],'real initialization/guide code must not throw or report errors');
    if(knownAnchorFallbacks.length) {
      assert.ok(calls.some(c=>c.id==='resultWin'));
      t.diagnostic('Existing resultWin centerBox fallback observed: '+knownAnchorFallbacks.length);
    }
  });
  return {canvas,input,ctx,body,draws,imports,calls,starts,added,destroyCalls,timers,frames,intervals,pendingImages,release,exit,achievements,
    async releaseAchievements(group) { const items=achievements.filter(i=>i.label===group); assert.equal(items.length,1); items[0].resolve(await items[0].ready); await drain(); },
    track(s,group){current=s;if(group)label=group;}, label(group){label=group;}, advance(ms){time+=ms;},
    async enter(s,group='g1',stage='hokkaido_area1'){
      label=group;current=s;
      if([screens.battle,screens.practiceBattle,screens.quickReviewPractice].includes(s)){
        Object.assign(gameState,{currentStageId:stage,previousScreen:'stageSelect',wrongKanjiList:[],
          quickReviewTargets:s===screens.quickReviewPractice?{stageId:stage,ids:[loader.getKanjiByStageId(stage)[0].id],texts:[]}:undefined});
      }
      await s.enter(canvas);assert.deepEqual(errors,[]);
    },
    onTransition(fn){subscribe('changeScreen',id=>{if(live)fn(id);});},
    overlays:()=>body.children.filter(e=>e.style.zIndex===100002),
    overlayAdds:()=>added.filter(e=>e.style.zIndex===100002).length,
    click(x,y){const r=canvas.getBoundingClientRect(),scale=Math.min(r.width/800,r.height/600);
      const e=new Event('click',{cancelable:true});
      Object.defineProperties(e,{clientX:{value:r.left+(r.width-800*scale)/2+x*scale},clientY:{value:r.top+(r.height-600*scale)/2+y*scale}});
      canvas.dispatchEvent(e);
    },
    markNext(){gameState.currentStageId='next-screen';battleState.turn='next-screen';}
  };
}

