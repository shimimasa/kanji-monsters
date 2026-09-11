import test from 'node:test';
import assert from 'node:assert/strict';
import { installStorage } from '../phase-a/storage-helper.mjs';
import { createMiniGameHost } from '../../src/minigames/miniGameHost.js';
import { createCompanionAdapter } from '../../src/minigames/companionAdapter.js';
import { createMonsterMotionHost } from '../../src/visuals/motion/monsterMotionHost.js';
import { readActiveCollection, ownedIdsFromSnapshot } from '../../src/minigames/collectionAdapter.js';
import { getDefaultSave, saveNow } from '../../src/core/saveData.js';
import { gameState, loadGameData } from '../../src/core/gameState.js';

const drain = () => new Promise(resolve => setImmediate(resolve));
const image = { complete:true, naturalWidth:512, naturalHeight:512 };
function dom() {
  const nodes=[];
  class Element extends EventTarget {
    constructor(tag=''){super();this.tagName=tag.toUpperCase();this.children=[];this.style={};this.dataset={};this.value='';this.listeners=new Map();this.inert=false;nodes.push(this);}
    addEventListener(type,fn,...args){super.addEventListener(type,fn,...args);if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
    removeEventListener(type,fn,...args){super.removeEventListener(type,fn,...args);this.listeners.get(type)?.delete(fn);}
    append(...items){for(const item of items){this.children.push(item);item.parent=this;}}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}
    setAttribute(key,value){this[key]=value;}
    getContext(){return {clearRect(){},save(){},restore(){},clip(){},translate(){},rotate(){},scale(){},drawImage(){},globalAlpha:1};}
  }
  const body=new Element('body'),doc=new Element('document'),viewport=new Element();doc.body=body;doc.hidden=false;
  doc.createElement=tag=>new Element(tag);
  const walk=node=>[node,...node.children.flatMap(walk)];
  doc.getElementById=id=>walk(body).find(n=>n.id===id)??null;
  viewport.height=723;viewport.offsetTop=0;
  const keyboard=new Element();keyboard.boundingRect={height:0,y:723};
  return {doc,win:{visualViewport:viewport,navigator:{virtualKeyboard:keyboard}},nodes,find:fn=>walk(body).find(fn),listeners:()=>nodes.reduce((n,e)=>n+[...e.listeners.values()].reduce((a,s)=>a+s.size,0),0)};
}
const click = node => node.dispatchEvent(new Event('click'));

test('read-only collection: confirmed active snapshot only; no mutation or mirror fallback',()=>{
  const save={player:{collection:{gotomonIds:['HKD-E01','HKD-E01','HKD-E02',null]}}};
  const before=JSON.stringify(save),context=JSON.stringify(['1','epoch',JSON.stringify(save)]);
  assert.deepEqual(readActiveCollection({ready:()=>true,capture:()=>context}),['HKD-E01','HKD-E02']);
  assert.deepEqual(readActiveCollection({ready:()=>false,capture:()=>{throw Error('must not read');}}),[]);
  assert.deepEqual(readActiveCollection({ready:()=>true,capture:()=>'{broken'}),[]);
  let count=0;assert.deepEqual(readActiveCollection({ready:()=>true,capture:()=>++count===1?context:'changed'}),[]);
  assert.equal(JSON.stringify(save),before);assert.ok(Object.isFrozen(ownedIdsFromSnapshot(save)));
});
test('companion ownership, mapping, latest reaction, reduced motion and dispose',async()=>{
  let loads=0;const poses=[];
  const make=ownedMonsterIds=>createCompanionAdapter({sessionId:'s',ownedMonsterIds,loadImage:()=>{loads++;return image;},
    createHost:args=>createMonsterMotionHost({...args,draw:(ctx,img,layout,pose)=>{poses.push(pose);return true;}})});
  const absent=make([]);await drain();assert.equal(loads,0);assert.equal(absent.inspect().hostCount,0);absent.dispose();
  const companion=make(['HKD-E01']);await drain();assert.equal(loads,1);
  const observe=(type,seq)=>companion.observe({type,seq,sessionId:'s'});
  observe('problemPresented',1);companion.update(0);assert.equal(companion.inspect().action,'idle');
  observe('correct',2);companion.update(100);assert.equal(companion.inspect().remainingMs,650);
  observe('correct',3);assert.equal(companion.inspect().remainingMs,750);
  companion.observe({type:'incorrect',seq:4,sessionId:'old'});assert.equal(companion.inspect().action,'attack');
  observe('incorrect',2);assert.equal(companion.inspect().action,'attack');
  companion.update(100,true);companion.present({}, {imageRect:{x:0,y:0,width:240,height:120}});
  assert.equal(poses.at(-1).x,0);assert.equal(poses.at(-1).scaleX,1);
  observe('incorrect',4);assert.equal(companion.inspect().action,'idle');
  observe('sessionComplete',5);assert.equal(companion.inspect().action,'idle');
  companion.dispose();companion.dispose();assert.equal(companion.inspect().hostCount,0);assert.equal(companion.inspect().selected,null);
});
test('late image success/rejection cannot revive an exited companion',async()=>{
  for(const fails of [false,true]){
    let resolve,reject;const pending=new Promise((a,b)=>{resolve=a;reject=b;});
    const companion=createCompanionAdapter({sessionId:'s',ownedMonsterIds:['HKD-E01'],loadImage:()=>pending});
    await drain();companion.dispose();fails?reject(Error('late')):resolve(image);await drain();
    assert.equal(companion.inspect().hostCount,0);assert.equal(companion.present({},{}),false);
  }
});
test('real Host/View: ten enter/exit, visibility buffer, no RAF/interval, no listeners/DOM/companion accumulation', async t=>{
  t.mock.method(globalThis,'setInterval',()=>{throw Error('new interval');});
  const previousRAF=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=()=>{throw Error('new RAF');};
  t.after(()=>{globalThis.requestAnimationFrame=previousRAF;});
  const d=dom();let id=0,back=0;
  const host=createMiniGameHost({document:d.doc,window:d.win,collection:()=>['HKD-E01'],makeSessionId:()=>`host-${++id}`,
    random:()=>0,loadImage:()=>new Promise(()=>{}),reduced:()=>false,onBack:()=>back++});
  for(let i=0;i<10;i++){
    host.enter();const session=host.inspect().session;
    assert.equal(d.doc.body.children.length,1);assert.equal(host.inspect().companion.selected,'HKD-E01');
    d.win.navigator.virtualKeyboard.boundingRect={height:300,y:423};
    d.win.navigator.virtualKeyboard.dispatchEvent(new Event('geometrychange'));
    assert.equal(d.doc.getElementById('mathSprintScreen').style.height,'423px');
    d.win.navigator.virtualKeyboard.boundingRect={height:0,y:723};
    d.win.navigator.virtualKeyboard.dispatchEvent(new Event('geometrychange'));
    const input=d.find(n=>n.tagName==='INPUT');input.value=String(session.problem.answer);
    d.doc.hidden=true;d.doc.dispatchEvent(new Event('visibilitychange'));host.update(500);
    assert.equal(host.inspect().session.activeElapsedMs,0);assert.equal(input.disabled,true);assert.equal(input.value,String(session.problem.answer));
    click(d.find(n=>n.dataset.action==='answer'));assert.equal(host.inspect().session.answered,0);
    host.setPaused(true);d.doc.hidden=false;d.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(host.inspect().session.paused,true);
    host.setPaused(false);click(d.find(n=>n.dataset.action==='answer'));host.update(0);
    assert.equal(host.inspect().session.answered,1);assert.equal(host.inspect().companion.action,'attack');
    click(d.find(n=>n.dataset.action==='next'));host.update(0);assert.equal(host.inspect().session.phase,'answering');
    assert.notEqual(host.inspect().session.token,session.token);
    const oldInput=input,oldButton=d.find(n=>n.dataset.action==='answer');
    click(d.find(n=>n.dataset.action==='back'));host.exit();host.update(50);await drain();
    assert.equal(host.inspect().valid,false);assert.equal(host.inspect().companion,null);assert.equal(d.listeners(),0);assert.equal(d.doc.body.children.length,0);
    click(oldButton);oldInput.dispatchEvent(Object.assign(new Event('keydown'),{key:'Enter'}));assert.equal(host.inspect().session,null);
  }
  assert.equal(back,10);
});
test('real Host/View: image failure fallback, full result, replay new identity/seq and Core isolation',async t=>{
  const storage=installStorage();const save=getDefaultSave();save.player.collection.gotomonIds=['HKD-E01'];
  save.player.coreStats.hp=73;save.player.coreStats.exp=31;save.player.study.answers={};
  assert.equal(saveNow(save,{replace:true}).ok,true);assert.equal(await loadGameData(),true);
  const beforeGame=JSON.stringify(gameState),beforeStorage=JSON.stringify([...storage.data]);
  let writes=0;
  t.mock.method(storage,'setItem',()=>{writes++;throw Error('Storage write forbidden');});t.mock.method(storage,'removeItem',()=>{writes++;throw Error('Storage delete forbidden');});
  const d=dom();let id=0;const host=createMiniGameHost({document:d.doc,window:d.win,makeSessionId:()=>`replay-${++id}`,random:()=>0,
    loadImage:()=>Promise.reject(Error('missing')),reduced:()=>true});
  host.enter();await drain();host.update(0);assert.equal(host.inspect().companion.motion.imageState,'failed');
  assert.equal(d.find(n=>n.tagName==='FIGCAPTION').textContent,'仲間といっしょに！');
  const first=host.inspect().session;
  for(let i=0;i<10;i++){
    const s=host.inspect().session;d.find(n=>n.tagName==='INPUT').value=String(s.problem.answer+(i===3?1:0));
    click(d.find(n=>n.dataset.action==='answer'));host.update(16);
    if(i<9){click(d.find(n=>n.dataset.action==='next'));host.update(0);}
  }
  assert.equal(host.inspect().session.result.correct,9);assert.equal(host.inspect().session.seq,21);
  const replay=d.find(n=>n.dataset.action==='replay');click(replay);host.update(0);
  assert.notEqual(host.inspect().session.sessionId,first.sessionId);assert.notEqual(host.inspect().session.token,first.token);assert.equal(host.inspect().session.seq,1);
  click(replay);assert.equal(host.inspect().session.seq,1);
  host.exit();await drain();assert.equal(d.listeners(),0);assert.equal(writes,0);assert.equal(JSON.stringify(gameState),beforeGame);assert.equal(JSON.stringify([...storage.data]),beforeStorage);
});
