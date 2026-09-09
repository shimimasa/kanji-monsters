import assert from 'node:assert/strict';
export async function diagnostic({c,ev,until,stage,leave,guide,snap,action,canvas,toggle,data,prefix}) {
  data.lifecycle=[];
  for(let i=1;i<=10;i++) {
    await until("document.querySelector('#gameCanvas').classList.contains('yomitabi-3d-active')",'3D ready');
    await snap('life-enter-'+i);const counts=await ev('__b0.resources().visual');assert.equal(counts.containers,1);assert.equal(counts.animationGroups,4);assert.equal(counts.meshes,3);assert.equal(counts.placements,1);assert.equal(counts.deadlines,0);assert.equal(counts.requests,0);data.lifecycle.push({phase:'enter',i,resources:await ev('__b0.resources()'),actual:await ev('__v0Audit()')});
    await leave();await snap('life-exit-'+i);const resources=await ev('__b0.resources()');
    assert.equal(resources.canvas,1);assert.equal(resources.visual,null);
    const actual=await ev('__v0Audit()');assert.deepEqual(actual.listeners,[]);
    for(const [kind,count]of Object.entries(actual.gpu))assert.equal(count,0,kind+' still live after exit');
    data.lifecycle.push({phase:'exit',i,resources,actual});
    await stage();await guide();await until('__b0.ready()','reenter');
  }
  await until("document.querySelector('#gameCanvas').classList.contains('yomitabi-3d-active')",'3D ready');
  const before=await ev('__b0.read()');
  data.contextLoss=await ev(`(()=>{const canvas=document.querySelector('.yomitabi-3d-canvas');const gl=canvas.getContext('webgl2');const ext=gl.getExtension('WEBGL_lose_context');if(!ext)return false;ext.loseContext();return true;})()`);
  assert.equal(data.contextLoss,true);
  await until("!document.querySelector('.yomitabi-3d-canvas')",'context fallback');
  assert.equal(await ev('__b0.ready()'),true);
  assert.deepEqual((await ev('__b0.read()')).question,before.question);
  await action('correct');await snap('fallback-answer');
  await leave();await stage();await guide();await until('__b0.ready()','fallback reentry');
  await until("document.querySelector('#gameCanvas').classList.contains('yomitabi-3d-active')",'3D reentry');
  await snap('fallback-reentry');
  data.focus=await ev(`(()=>{const c=document.querySelector('.yomitabi-3d-canvas'),i=document.querySelector('#kanjiInput');i.focus();c.focus();return {id:document.activeElement.id,tabIndex:c.tabIndex,inert:c.inert,pointer:getComputedStyle(c).pointerEvents};})()`);
  assert.equal(data.focus.id,'kanjiInput');assert.equal(data.focus.tabIndex,-1);assert.equal(data.focus.inert,true);assert.equal(data.focus.pointer,'none');
  const learningBefore=await ev('__b0.read().player.totalCorrect');
  data.ime=await ev(`(()=>{const i=document.querySelector('#kanjiInput');i.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:229,isComposing:true,bubbles:true}));i.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));return document.activeElement.id;})()`);
  assert.equal(await ev('__b0.read().player.totalCorrect'),learningBefore);
  await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await new Promise(r=>setTimeout(r,150));await c.screenshot(prefix+'-reduced-motion.png');
  data.reducedMotion=await ev("matchMedia('(prefers-reduced-motion: reduce)').matches");assert.equal(data.reducedMotion,true);
  await c.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  data.layouts=[];
  for(const dimensions of [{width:390,height:844},{width:844,height:390},{width:1086,height:723}]) {
    await c.send('Emulation.setDeviceMetricsOverride',{...dimensions,deviceScaleFactor:1.5,mobile:false});
    await new Promise(r=>setTimeout(r,200));
    const layout=await ev(`(()=>{const c=document.querySelector('#gameCanvas'),r=c.getBoundingClientRect(),v=document.querySelector('.yomitabi-3d-canvas').getBoundingClientRect(),s=Math.min(r.width/c.width,r.height/c.height),i=document.querySelector('#kanjiInput');return {contain:{left:r.left+(r.width-c.width*s)/2,top:r.top+(r.height-c.height*s)/2,width:c.width*s,height:c.height*s},visual:v.toJSON(),input:i.getBoundingClientRect().toJSON(),scale:s,buttons:__b0.buttons(),hit:document.elementFromPoint(i.getBoundingClientRect().x+5,i.getBoundingClientRect().y+5)?.id};})()`);
    for(const k of ['left','top','width','height'])assert.ok(Math.abs(layout.contain[k]-layout.visual[k])<1,k);
    assert.ok(layout.input.height>=48);assert.equal(layout.hit,'kanjiInput');
    for(const k of ['stage','practice','attack','heal','hint'])assert.ok(layout.buttons[k].h*layout.scale>=43.9,k);
    data.layouts.push(layout);await c.screenshot(prefix+'-layout-'+dimensions.width+'.png');
  }
  await toggle('50おんで書く');await new Promise(r=>setTimeout(r,250));await c.screenshot(prefix+'-pad.png');
  data.pad=await ev("({height:document.querySelector('#kanaPad')?.getBoundingClientRect().height,visual:document.querySelector('.yomitabi-3d-canvas').getBoundingClientRect().toJSON()})");
  await toggle('たんまつで書く');
  const p=await ev('__b0.buttons().practice');await canvas(p.x+p.w/2,p.y+p.h/2);
  await until('fsm.currentState!==fsm.states.battle','practice entered');await guide();
  data.practice=await ev("({screen:Object.keys(fsm.states).find(k=>fsm.states[k]===fsm.currentState),canvasCount:document.querySelectorAll('canvas').length,active3D:document.querySelector('#gameCanvas').classList.contains('yomitabi-3d-active')})");
  assert.equal(data.practice.canvasCount,1);assert.equal(data.practice.active3D,false);
}
