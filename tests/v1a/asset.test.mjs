import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { potatoVisual, monsterVisualManifest, fitMonster } from '../../src/visuals/monsterVisualManifest.js';
import { readGLB, verifyGLBHash, validateContainer } from '../../src/visuals/glbValidation.js';
import { parseGLBAsset } from '../../src/visuals/glbParser.js';
import { createGLBTimeline, createGLBPlayback } from '../../src/visuals/glbTimeline.js';

const bytes = new Uint8Array(fs.readFileSync(new URL('../../public'+potatoVisual.url,import.meta.url)));
async function loaded(t) {
  const engine = new NullEngine(); const scene = new Scene(engine);
  const op = parseGLBAsset(scene,readGLB(bytes)); const container = await op.promise;
  t.after(()=>{ op.dispose(); container.dispose(); scene.dispose(); engine.dispose(); });
  return {engine,scene,container,op,asset:validateContainer(container)};
}
const s = (extra={}) => ({generation:1,session:1,enemyIndex:0,enemyId:'HKD-E01',enemyHp:31,enemyAction:'attack',enemyActionTimer:750,...extra});

test('R-16 asset identity and immutable display-only manifest',async()=>{
  await verifyGLBHash(bytes); assert.equal(bytes.length,43616);
  assert.deepEqual(Object.keys(monsterVisualManifest.monsters),['HKD-E01']);
  assert.equal(Object.isFrozen(potatoVisual.clips.attack),true);
  assert.throws(()=>potatoVisual.stageIds.push('other'));
  const corrupt=bytes.slice();corrupt[corrupt.length-1]^=1;
  await assert.rejects(verifyGLBHash(corrupt),/SHA-256/);
});
test('GLB header, HTML rewrite and malformed chunks are rejected',()=>{
  for(const b of [new TextEncoder().encode('<html>rewritten document</html>'),bytes.subarray(0,12)]) assert.throws(()=>readGLB(b),/validation/);
  const b=bytes.slice();new DataView(b.buffer).setUint32(12,b.length,true);assert.throws(()=>readGLB(b),/JSON chunk/);
});
test('real 9.25.0 parser creates an off-scene container with exact structure',async t=>{
  const {scene,asset,container}=await loaded(t);
  assert.equal(scene.meshes.length,0);assert.equal(scene.animationGroups.length,0);
  assert.equal(asset.mesh.getTotalVertices(),642);assert.equal(asset.mesh.getTotalIndices(),2304);
  assert.equal(asset.loaderRoot.scaling.z,-1);
  assert.equal(container.textures.length,0);
});
test('R-02 actual AnimationGroups sample without repeated starts or automatic progression',async t=>{
  const {asset,scene,container}=await loaded(t);container.addAllToScene();
  const timeline=createGLBTimeline(),play=createGLBPlayback(asset.groups,asset.motion);
  play.sample(timeline.observe(s(),16));
  for(let i=0;i<20;i++)play.sample(timeline.observe(s({enemyActionTimer:225}),16));
  assert.equal(play.resources().starts,1);assert.equal(timeline.current().progress,.7);
  assert.equal(asset.groups.attack.isPlaying,false);assert.equal(scene.animatables.length,3);
  assert.notEqual(asset.motion.position.x,0);
  play.sample(timeline.observe(s({enemyAction:'damage',enemyActionTimer:500}),16));
  assert.equal(play.resources().starts,2);assert.equal(scene.animatables.length,3);
  play.stop();assert.equal(scene.animatables.length,0);
});
test('pending timeline / late load uses 70% progress and drops completed action',()=>{
  const clock=createGLBTimeline();clock.observe(s(),16);clock.observe(s({enemyActionTimer:225}),16);
  assert.equal(clock.current().progress,.7);const revision=clock.current().revision;
  clock.observe(s({enemyActionTimer:225}),16);assert.equal(clock.current().revision,revision);
  clock.observe(s({enemyAction:null,enemyActionTimer:0}),16);assert.equal(clock.current().clip,'idle');
  clock.observe(s(),16);assert.ok(clock.current().revision>revision);
});
test('R-09 reduced motion on/off samples current timer; defeat is held until enemy changes',async t=>{
  const {asset,container}=await loaded(t);container.addAllToScene();
  const clock=createGLBTimeline(),play=createGLBPlayback(asset.groups,asset.motion);
  play.sample(clock.observe(s(),16));play.sample(clock.observe(s({enemyActionTimer:375,reducedMotion:true}),16));
  assert.deepEqual(asset.motion.scaling.asArray(),[1,1,1]);assert.deepEqual(asset.motion.position.asArray(),[0,0,0]);
  play.sample(clock.observe(s({enemyActionTimer:225,reducedMotion:false}),16));assert.equal(clock.current().progress,.7);
  play.sample(clock.observe(s({enemyAction:'defeat',enemyActionTimer:1000,enemyHp:0,reducedMotion:true}),16));
  assert.deepEqual(asset.motion.scaling.asArray(),[.25,.25,.25]);
  play.sample(clock.observe(s({enemyAction:null,enemyActionTimer:0,enemyHp:0}),16));
  assert.equal(clock.current().clip,'defeat');assert.equal(clock.current().progress,1);
  assert.ok(Math.abs(asset.motion.scaling.x-.02)<1e-6);
  clock.observe(s({enemyId:'HKD-E02',enemyIndex:1,enemyAction:null}),16);assert.equal(clock.current().clip,'idle');play.stop();
});
test('R-07 fixed envelope fit remains constant through action bounds and resizes',()=>{
  const rect={x:524,y:124,width:232,height:112},layout={width:800,height:600};
  assert.deepEqual(fitMonster(rect,layout),{scale:5/6,x:2.4,y:.7});
  assert.equal(fitMonster({...rect,width:24},layout),null);
  assert.equal(fitMonster({...rect,x:NaN},layout),null);
  const f=fitMonster({...rect,width:116,height:56},layout);assert.ok(f.scale<5/6);
});
for(const fault of ['missing','duplicate','case','bounds','target','duration'])test(`runtime validation rejects ${fault}`,async t=>{
  const {container,asset}=await loaded(t);
  const originalGroups=container.animationGroups.slice();
  if(fault==='missing')container.animationGroups.pop();
  if(fault==='duplicate')container.animationGroups[0].name=container.animationGroups[1].name;
  if(fault==='case')asset.groups.attack.name='Attack';
  if(fault==='bounds'){const p=asset.mesh.getVerticesData('position').slice();p[0]=-10;asset.mesh.setVerticesData('position',p);}
  if(fault==='target')asset.groups.attack.targetedAnimations[0].target=asset.root;
  if(fault==='duration')asset.groups.attack.targetedAnimations[0].animation.framePerSecond=30;
  assert.throws(()=>validateContainer(container),/validation/);
  container.animationGroups=originalGroups;
});

test('all real clips stay inside the fixed envelope with the preserved loader root and outer yaw',async t=>{
  const {asset,container}=await loaded(t);container.addAllToScene();
  const {TransformNode}=await import('@babylonjs/core/Meshes/transformNode.js');
  const {Vector3}=await import('@babylonjs/core/Maths/math.vector.js');
  const placement=new TransformNode('testPlacement',asset.mesh.getScene());placement.rotation.y=Math.PI;asset.loaderRoot.parent=placement;
  const play=createGLBPlayback(asset.groups,asset.motion),positions=asset.mesh.getVerticesData('position');
  for(const [revision,clip]of ['idle','attack','hit','defeat'].entries())for(let frame=0;frame<=120;frame++){
    play.sample({clip,revision,progress:frame/120,reducedMotion:false});
    placement.computeWorldMatrix(true);asset.loaderRoot.computeWorldMatrix(true);asset.root.computeWorldMatrix(true);asset.motion.computeWorldMatrix(true);
    const world=asset.mesh.computeWorldMatrix(true);
    for(let i=0;i<positions.length;i+=3){const v=Vector3.TransformCoordinates(Vector3.FromArray(positions,i),world).asArray();
      for(let axis=0;axis<3;axis++){assert.ok(v[axis]>=potatoVisual.animationEnvelope.min[axis]-1e-5,clip+' floor/min');assert.ok(v[axis]<=potatoVisual.animationEnvelope.max[axis]+1e-5,clip+' max');}
    }
  }
  play.stop();
});

test('R-12/R-16 GLB modules have no mutable Core or curriculum dependency',()=>{
  for(const name of ['monsterVisualManifest','glbTimeline','glbValidation','glbPreparation','glbParser','babylonGLBRenderer']){
    const source=fs.readFileSync(new URL(`../../src/visuals/${name}.js`,import.meta.url),'utf8');
    assert.doesNotMatch(source,/localStorage|gameState|commitLearning|firebase|runRenderLoop|attachControl\(/);
    for(const m of source.matchAll(/(?:from\s*|import\()['"]([^'"]+)/g))assert.doesNotMatch(m[1],/\.\.\/core\/|learning|SRS|curriculum/i);
  }
});
