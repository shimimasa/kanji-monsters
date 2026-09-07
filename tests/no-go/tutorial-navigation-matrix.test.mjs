import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fixture,screens,tutorial,gameState,storage,snapshot,drain,FSM,tutorialScreens} from './helpers/tutorial-navigation-fixture.mjs';
for (const scenario of ['seen-stage-shared-completion','new-stage-guide-then-old-result']) test('FINAL-QA-02 resultWin -> real stageSelect '+scenario,async t=>{
  const f=await fixture(t),result=screens.resultWin,stage=screens.stageSelect;
  if(scenario==='seen-stage-shared-completion')storage.setItem('tutorial_seen_stageSelect','1');
  assert.equal(storage.getItem('tutorial_seen_resultWin'),null);
  let fsm;f.onTransition(id=>{f.label('stage');fsm.change(id,f.canvas);f.track(fsm.currentState);});
  f.label('result');fsm=new FSM('resultWin',{resultWin:result,stageSelect:stage});f.track(result);
  for(let i=0;i<100&&f.imports.length===0;i++)await drain();
  assert.equal(f.imports.length,1);assert.ok(f.imports[0].url.endsWith('/resultWinScreen.js'));assert.ok(result._clickHandler);
  fsm.update(16);assert.equal(f.overlays().length,0);
  // Real drawn next-stage control: [300,480,200,50].
  assert.ok(f.draws.some(([op,text])=>op==='fillText'&&text==='ステージ選択へ'));
  f.advance(400);f.click(400,505);
  assert.equal(fsm.currentState,stage);assert.equal(result.canvas,null);fsm.update(16);
  assert.equal(f.imports.length,2);
  let currentGuide=null,destroyed=0;
  if(scenario==='new-stage-guide-then-old-result'){
    await f.release('stage');currentGuide=tutorial.guide;assert.ok(currentGuide);
    const destroy=currentGuide.destroy;
    t.mock.method(currentGuide,'destroy',function(){destroyed++;return destroy.call(this);});
  }
  const before=snapshot(),oldAdds=f.overlayAdds(),oldStarts=f.starts.length;
  if(scenario==='seen-stage-shared-completion'){
    // Release the same shared module to both registered callers, in registration order.
    const values=await Promise.all(f.imports.map(i=>i.ready));
    f.imports.forEach((i,n)=>i.resolve(values[n]));await drain();
  }else await f.release('result');
  fsm.update(16);
  const observed={scenario,screen:fsm.currentState===stage?'stageSelect':'other',
    starts:f.starts.slice(oldStarts),overlayAdds:f.overlayAdds()-oldAdds,liveOverlays:f.overlays().length,
    currentGuideDestroyed:destroyed,guidePreserved:tutorial.guide===currentGuide,stateChanges:Number(before!==snapshot()),
    style:f.overlays()[0]?.style};
  process.stdout.write('ADJACENT_OBS '+JSON.stringify(observed)+'\n');
  assert.deepEqual({starts:observed.starts.length,overlayAdds:observed.overlayAdds,destroyed,stateChanges:observed.stateChanges},
    {starts:0,overlayAdds:0,destroyed:0,stateChanges:0},'departed resultWin must not interfere with real stageSelect');
  assert.equal(tutorial.guide,currentGuide);
});


for (const id of tutorialScreens) {
  const screen=screens[id], tutorialId=id==='quickReviewPractice'?'practiceBattle':id;
  test('Tutorial matrix '+id+': current import completes before exit, unseen starts once',async t=>{
    const f=await fixture(t);await f.enter(screen);
    assert.equal(f.imports.length,1);assert.equal(f.calls.length,0);assert.equal(f.overlayAdds(),0);
    await f.release('g1');await f.release('g1');
    assert.deepEqual(f.starts,[{delivery:'g1',id:tutorialId}]);
    assert.equal(f.overlayAdds(),1);assert.equal(f.overlays().length,1);
    assert.ok(f.overlays()[0].children[1].children[0].textContent,'real guide renders its first step');
    assert.equal(f.destroyCalls.filter(Boolean).length,0);
    f.exit();
  });
  test('Tutorial matrix '+id+': stale import after real exit has no side effects',async t=>{
    const f=await fixture(t);await f.enter(screen);
    assert.equal(f.imports.length,1);f.exit();f.markNext();
    let destroyed=0;const guide={destroy(){destroyed++;}};tutorial.guide=guide;
    const before=snapshot();await f.release('g1');
    const observation={starts:f.starts.length,calls:f.calls.length,overlayAdds:f.overlayAdds(),destroyed,stateChanges:Number(snapshot()!==before)};
    process.stdout.write('MATRIX_STALE '+JSON.stringify({id,...observation})+'\n');
    assert.deepEqual(observation,{starts:0,calls:0,overlayAdds:0,destroyed:0,stateChanges:0});
    assert.equal(tutorial.guide,guide);assert.equal(f.destroyCalls.length,0);
  });
  for(const order of [['g1','g2'],['g2','g1']]) test('Tutorial matrix '+id+': exit/reenter '+order.join(' -> '),async t=>{
    const f=await fixture(t);await f.enter(screen,'g1');f.exit();await f.enter(screen,'g2');
    assert.equal(f.imports.length,2);
    const before=snapshot();let newGuide,destroyed=0;
    for(const group of order) {
      await f.release(group);
      if(group==='g2') {
        newGuide=tutorial.guide;assert.ok(newGuide);
        const destroy=newGuide.destroy;
        t.mock.method(newGuide,'destroy',function(){destroyed++;return destroy.call(this);});
      }
      assert.ok(f.overlays().length<=1);
      if(newGuide)assert.equal(tutorial.guide,newGuide);
      assert.equal(f.calls.filter(c=>c.delivery==='g1').length,0,'stale import never enters manager');
    }
    assert.deepEqual(f.starts,[{delivery:'g2',id:tutorialId}]);
    assert.equal(f.overlayAdds(),1);assert.equal(f.overlays().length,1);assert.equal(destroyed,0);
    assert.equal(snapshot(),before);
  });
}

test('Tutorial matrix inventory includes every current screen importing a Tutorial entry point',()=>{
  const root=new URL('../../src/',import.meta.url), paths=[];
  function walk(dir) {
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
      const url=new URL(entry.name+(entry.isDirectory()?'/':''),dir);
      if(entry.isDirectory())walk(url);
      else if(entry.name.endsWith('.js') && /(?:import|from)[^\n]*(?:TutorialManager|TutorialGuide)/.test(fs.readFileSync(url,'utf8')) && !url.href.includes('/src/tutorial/')) paths.push(url.href.slice(root.href.length));
    }
  }
  walk(root);
  const expected=tutorialScreens.filter(id=>id!=='quickReviewPractice').map(id=>'screens/'+(['kanjiDex','monsterDex'].includes(id)?'Dex/':'')+id+'Screen.js');
  assert.deepEqual(paths.sort(),expected.sort(),'new Tutorial callers need a real matrix adapter');
});
test('resultWin: exit during achievement wait cannot later reserve a tutorial',async t=>{
  const f=await fixture(t,{holdAchievements:true}),screen=screens.resultWin;
  const work=f.enter(screen,'g1');assert.equal(f.achievements.length,1);assert.equal(f.imports.length,0);
  // Hold only delivery back to enter. Achievement calculation has its own
  // legitimate save effects, which are not Tutorial lifecycle side effects.
  await f.achievements[0].ready;
  f.exit();f.markNext();const before=snapshot();
  await f.releaseAchievements('g1');await work;
  // Drain any incorrectly created import too, so the before-fix observation is visible.
  if(f.imports.length)await f.release('g1');
  process.stdout.write('RESULT_PREIMPORT '+JSON.stringify({imports:f.imports.length,starts:f.starts.length,overlays:f.overlayAdds()})+'\n');
  assert.equal(f.imports.length,0,'old pre-import continuation must not acquire a new generation guard');
  assert.equal(f.overlayAdds(),0);assert.equal(snapshot(),before);
});
for(const order of [['g1','g2'],['g2','g1']])test('resultWin: achievement wait across reentry '+order.join(' -> '),async t=>{
  const f=await fixture(t,{holdAchievements:true}),screen=screens.resultWin;
  const oldWork=f.enter(screen,'g1');f.exit();const newWork=f.enter(screen,'g2');
  assert.equal(f.achievements.length,2);assert.equal(f.imports.length,0);
  for(const group of order)await f.releaseAchievements(group);
  await Promise.all([oldWork,newWork]);
  assert.equal(f.imports.length,1,'only the current entry can proceed to tutorial reservation');
  assert.equal(f.imports[0].label,'g2');
  await f.release('g2');
  assert.deepEqual(f.starts,[{delivery:'g2',id:'resultWin'}]);assert.equal(f.overlayAdds(),1);assert.equal(f.overlays().length,1);
});


