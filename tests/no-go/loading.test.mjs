import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {installStorage} from '../phase-a/storage-helper.mjs';
import { curriculumFixture, assertHealthy, assertExplicitFailure, grade7URL, drain } from './helpers/curriculum-fixture.mjs';
installStorage();
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function captureErrors(t) {
  const errors=[];
  t.mock.method(console,'log',()=>{});t.mock.method(console,'warn',()=>{});
  t.mock.method(console,'error',(message,error)=>{
    if(message==='ゲームデータの読み込み中にエラーが発生しました:')errors.push(error);
  });return errors;
}
test('NEW-06 CONTROL A: healthy curriculum succeeds with grade7 and all 88 exact pools',async t=>{
  const errors=captureErrors(t),fixture=curriculumFixture();globalThis.fetch=fixture.fetch;
  const loader=await import('../../src/loaders/dataLoader.js?case=healthy-control');
  assertHealthy(loader,await loader.loadAllGameData(),fixture);assert.deepEqual(errors,[]);
});
for(const [mode,target] of [['503',grade7URL],['malformed',grade7URL],['503','/data/stages_proto.json'],['reject',grade7URL]]) {
  test(`NEW-06 CONTROL B: ${target} ${mode} fails for that cause, then retries`,async t=>{
    const errors=captureErrors(t),fixture=curriculumFixture(mode,target);globalThis.fetch=fixture.fetch;
    const loader=await import('../../src/loaders/dataLoader.js?case='+encodeURIComponent(mode+target));
    const result=await loader.loadAllGameData();await drain();
    assertExplicitFailure(loader,result,fixture,errors,mode,target);
    const restored=curriculumFixture();globalThis.fetch=restored.fetch;
    assertHealthy(loader,await loader.loadAllGameData(),restored);
  });
}
for(const mode of ['pending-fetch','pending-body'])test(`NEW-06: reached grade7 ${mode} alone times out; late result ignored; retry succeeds`,{timeout:5000},async t=>{
  const errors=captureErrors(t),fixture=curriculumFixture(mode);globalThis.fetch=fixture.fetch;
  t.mock.timers.enable({apis:['setTimeout']});
  const loader=await import('../../src/loaders/dataLoader.js?case='+mode);
  let settled=false;const work=loader.loadAllGameData().then(result=>{settled=true;return result;});
  const request=await fixture.atFault;await drain();
  assert.equal(request.url,grade7URL);assert.equal(request.fault,mode);
  assert.equal(request.body,mode==='pending-body'?'reading':'unread');
  assert.ok(fixture.requests.filter(r=>r.url!==grade7URL).every(r=>r.body==='complete'));
  assert.equal(settled,false);t.mock.timers.tick(9999);await drain();assert.equal(settled,false);
  t.mock.timers.tick(1);const result=await work;await drain();
  assertExplicitFailure(loader,result,fixture,errors,mode);
  fixture.release();await drain();assert.equal(loader.getKanjiByGrade(7).length,0);
  const restored=curriculumFixture();globalThis.fetch=restored.fetch;
  assertHealthy(loader,await loader.loadAllGameData(),restored);
});
for(const mode of ['baseline','healthy','fallback'])test(`NEW-06 CONTROL ${mode==='healthy'?'C':mode==='fallback'?'D':'B'}: same failure oracle against ${mode}`,()=>{
  const child=spawnSync(process.execPath,['--experimental-default-type=module',
    fileURLToPath(new URL('./helpers/grade7-control-worker.mjs',import.meta.url)),mode],{encoding:'utf8',timeout:15000});
  assert.ifError(child.error);assert.equal(child.signal,null);
  const observed=JSON.parse(child.stdout.trim());
  const grade7=observed.requests.filter(r=>r.url===grade7URL);assert.equal(grade7.length,1);
  assert.equal(grade7[0].fault,mode==='healthy'?null:'503');assert.equal(grade7[0].status,mode==='healthy'?200:503);
  if(mode==='baseline') {
    assert.equal(child.status,0,child.stderr);assert.equal(observed.success,false);assert.equal(observed.grade7,0);
  } else {
    assert.equal(observed.success,true);assert.ok(observed.grade7>0);
    assert.equal(child.status,1,child.stderr);
    assert.match(child.stderr,/AssertionError/);assert.match(child.stderr,/failed curriculum must not be a success/);
    if(mode==='fallback') {
      assert.match(child.stderr,/GRADE7_COUNTERFACTUAL_APPLIED/);assert.equal(observed.grade7,observed.grade6);
    }
  }
});
test('E06: failed SDK scripts can actually be retried',async t=>{
  const scripts=[];
  globalThis.document={querySelector:selector=>scripts.find(s=>selector.includes(s.src)),createElement:()=>({dataset:{},remove(){scripts.splice(scripts.indexOf(this),1);}}),head:{appendChild(s){scripts.push(s);queueMicrotask(()=>s.onerror());}}};
  const {loadFirebaseSdk}=await import('../../src/services/firebase/sdkLoader.js');
  await assert.rejects(loadFirebaseSdk());
  assert.equal(scripts.length,0,'a failed script must be removed before retry');
  await assert.rejects(loadFirebaseSdk());
  delete globalThis.document;
});
test('E06: logo Image that never settles does not block startup indefinitely',async t=>{
  t.mock.method(console,'warn',()=>{});t.mock.timers.enable({apis:['setTimeout']});
  globalThis.Image=class {};
  const {loadStartupImages}=await import('../../src/loaders/assetsLoader.js');
  let done=false;loadStartupImages().then(()=>done=true);await flush();
  t.mock.timers.tick(11000);await flush();assert.equal(done,true);delete globalThis.Image;
});
test('E06/E08: stage loading has a bounded error with retry/back and ignores late work after exit',async t=>{
  for(const k of ['log','warn','error'])t.mock.method(console,k,()=>{});
  const images=[];
  t.mock.timers.enable({apis:['setTimeout']});globalThis.Image=class {constructor(){images.push(this)}};
  const {default:stage}=await import('../../src/screens/stageLoadingScreen.js');
  const {gameState}=await import('../../src/core/gameState.js');gameState.currentStageId='hokkaido_area1';
  const make=()=>({style:{},children:[],appendChild(el){this.children.push(el);this.firstElementChild=this.children[0]},append(...els){els.forEach(e=>this.appendChild(e))},replaceChildren(){this.children=[]},addEventListener(){},remove(){}});
  globalThis.document={getElementById:()=>null,createElement:tag=>tag==='canvas'?{getContext:()=>({drawImage(){},getImageData:()=>({data:[]}),putImageData(){}}),toDataURL:()=>''}:make(),body:make()};
  const gradient={addColorStop(){}};const ctx=new Proxy({createLinearGradient:()=>gradient},{get:(o,k)=>o[k]||(()=>{})});
  const canvas={width:800,height:600,getContext:()=>ctx};
  let done=false;stage.enter(canvas).then(()=>done=true);await flush();
  t.mock.timers.tick(11000);await flush();assert.equal(done,true);
  assert.ok(stage.loadError,'failure must be explicit');
  stage.exit();gameState.currentStageId='new-screen';
  for(const image of images)image.onload?.();await flush();assert.equal(stage.canvas,null);
  assert.equal(gameState.currentStageId,'new-screen');
  delete globalThis.document;delete globalThis.Image;
});
