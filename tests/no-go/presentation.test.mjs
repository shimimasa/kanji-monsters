import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {installStorage} from '../phase-a/storage-helper.mjs';
installStorage();
const {getStepsFor}=await import('../../src/tutorial/tutorialData.js');
const {default:battle}=await import('../../src/screens/battleScreen.js');
const {default:practice}=await import('../../src/screens/practiceBattleScreen.js');
test('T01/U04: actual tutorial describes world scope and points hint at its visible button',()=>{
 const canvas={width:800,height:600,getBoundingClientRect:()=>({left:0,top:0,width:390,height:292.5})};
 const world=getStepsFor('courseSelect',{canvas}).map(s=>s.text).join(' ');
 assert.match(world,/漢検4級〜2級/);assert.doesNotMatch(world,/中学生/);
 const steps=getStepsFor('battle',{canvas});assert.match(steps[0].text,/こうげき/);
 const hint=steps.find(s=>s.title==='ヒント').anchor();assert.ok(hint.y>150);
});

test('U04: tutorial hint anchor follows contained Canvas letterboxing at 390px',async()=>{
 const canvas={width:800,height:600,getBoundingClientRect:()=>({left:13,top:27,width:390,height:700})};
 const {getLearningControls}=await import('../../src/ui/learningControls.js');
 const {gameToScreenCoordinates}=await import('../../src/utils/coordinateUtils.js');
 const b=getLearningControls(canvas).hint,p=gameToScreenCoordinates(b.x,b.y,canvas);
 const anchor=getStepsFor('battle',{canvas}).find(s=>s.title==='ヒント').anchor();
 assert.ok(Math.abs(anchor.x-p.x)<1);assert.ok(Math.abs(anchor.y-p.y)<1);
 assert.ok(Math.abs(anchor.h-b.h*390/800)<1);
});
test('T04/T05/G07: existing display copy identifies supported counts and limits mastery claims',()=>{
 const dex=fs.readFileSync('src/screens/Dex/kanjiDexScreen.js','utf8');
 const profile=fs.readFileSync('src/screens/profileScreen.js','utf8');
 const stage=fs.readFileSync('src/screens/stageSelectScreen.js','utf8');
 assert.doesNotMatch(dex,/よめた回数:/);assert.match(dex,/ヒントを含/);assert.match(dex,/すべての場面/);
 assert.doesNotMatch(profile,/回 よめた/);assert.match(profile,/ヒントを含/);
 assert.doesNotMatch(stage,/学年漢字を全マスターで解放/);assert.match(stage,/各ステージの練習/);
});
test('U05: real cosmetic starters suppress particles and stone shake when motion is reduced',()=>{
 globalThis.window={matchMedia:()=>({matches:true})};practice.canvas={width:800,height:600};
 practice.startSuccessParticles();assert.equal(practice.successParticles.active,false);
 battle.startStoneAttackEffect(400,200,180,160);assert.equal(battle.stoneAttackEffect.active,false);
 battle.startExpParticleEffect(0,0,100,100,5);assert.equal(battle.expParticles.active,false);
 delete globalThis.window;
});

test('U05: enabling reduced motion also stops an already running particle effect',()=>{
 globalThis.window={matchMedia:()=>({matches:true})};
 battle.ctx={};battle.expParticles.active=true;
 battle.expParticles.particles=[{delay:10}];
 battle.updateAndDrawExpParticles();
 assert.equal(battle.expParticles.active,false);assert.equal(battle.expParticles.particles.length,0);
 delete globalThis.window;
});
