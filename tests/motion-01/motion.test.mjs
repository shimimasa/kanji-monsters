import test from 'node:test';
import assert from 'node:assert/strict';
import { MOTION_PROFILES, sampleMonsterPose, NEUTRAL_POSE } from '../../src/visuals/motion/motionProfile.js';
import { advanceMonsterTimeline } from '../../src/visuals/motion/motionTimeline.js';
import { HKD_E01_MOTION } from '../../src/visuals/motion/monsterMotionManifest.js';
import { yomitabiView, sprintView } from '../../tools/motion-01/bridges.mjs';
const rect = Object.freeze({ x: 0, y: 0, width: 240, height: 120 });
const sample = (action, progress, options = {}) => sampleMonsterPose({ action, progress, layout: rect, ...options });
const view = (action, remainingMs, extra = {}) => Object.freeze({ session: 1, monsterId: 'HKD-E01',
  action, remainingMs, durationMs: { idle: 2000, attack: 750, hit: 500, defeat: 1000 }[action], ...extra });

test('only slime and the four named actions; all profile keys immutable', () => {
  assert.deepEqual(Object.keys(MOTION_PROFILES), ['slime']);
  assert.deepEqual(Object.keys(MOTION_PROFILES.slime), ['idle', 'attack', 'hit', 'defeat']);
  assert.throws(() => { MOTION_PROFILES.slime.hit.keys[1][4] = 2; }, TypeError);
});
test('same snapshot sampled 0/1/100 times leaves all inputs and display time unchanged', () => {
  const input = Object.freeze({ profile: 'slime', action: 'attack', progress: .37, layout: rect });
  const timeline = advanceMonsterTimeline(null, view('attack', 470));
  const before = JSON.stringify({ input, timeline });
  const expected = sampleMonsterPose(input);
  for (const n of [0, 1, 100]) {
    for (let i = 0; i < n; i++) assert.deepEqual(sampleMonsterPose(input), expected);
    assert.equal(JSON.stringify({ input, timeline }), before);
  }
});
test('idle loop closes and remains a micro motion', () => {
  assert.deepEqual(sample('idle', 0), sample('idle', 1));
  assert.deepEqual(sample('idle', .25), sample('idle', 3.25));
  for (let i = 0; i <= 100; i++) {
    const p = sample('idle', i / 100);
    assert.ok(Math.abs(p.y) < 1); assert.ok(Math.abs(p.scaleY - 1) <= .012001);
  }
});
test('attack anticipates, lunges left, then returns to neutral', () => {
  assert.ok(sample('attack', .2).x > 0);
  assert.ok(sample('attack', .48).x < -20);
  assert.deepEqual(sample('attack', 0), NEUTRAL_POSE);
  assert.deepEqual(sample('attack', 1), NEUTRAL_POSE);
});
test('hit squashes once and returns', () => {
  assert.ok(sample('hit', .2).scaleY < .95);
  assert.ok(sample('hit', .2).scaleX > 1);
  assert.deepEqual(sample('hit', 1), NEUTRAL_POSE);
});
test('defeat sinks, shrinks, fades and clamps at its endpoint', () => {
  const end = sample('defeat', 1);
  assert.ok(end.y > 0 && end.scaleY <= .201 && end.opacity <= .081);
  assert.deepEqual(sample('defeat', 10), end);
});
test('all image corners remain inside the declared fixed envelope at sampled poses', () => {
  const e = HKD_E01_MOTION.fixedEnvelope;
  for (const action of Object.keys(MOTION_PROFILES.slime)) for (let i = 0; i <= 1000; i++) {
    const pose = sample(action, i / 1000), c = Math.cos(pose.rotation), s = Math.sin(pose.rotation);
    for (const x of [-120, 120]) for (const y of [-60, 60]) {
      const px = (.5 * 240 + pose.x + x * pose.scaleX * c - y * pose.scaleY * s) / 240;
      const py = (.5 * 120 + pose.y + x * pose.scaleX * s + y * pose.scaleY * c) / 120;
      assert.ok(px >= e.minX && px <= e.maxX && py >= e.minY && py <= e.maxY);
    }
  }
});
test('reduced motion is static for idle/attack/hit and static defeat', () => {
  for (const a of ['idle','attack','hit']) for (const p of [0,.2,.7,1])
    assert.deepEqual(sample(a,p,{reducedMotion:true}),NEUTRAL_POSE);
  assert.deepEqual(sample('defeat',.2,{reducedMotion:true}), sample('defeat',.8,{reducedMotion:true}));
});
test('unknown profile/action and nonfinite progress fall back to neutral', () => {
  for (const profile of ['missing', '__proto__', 'constructor'])
    assert.deepEqual(sample('attack', .5, {profile}), NEUTRAL_POSE);
  assert.deepEqual(sample('__proto__', .5), NEUTRAL_POSE);
  for (const p of [NaN, Infinity, -Infinity]) assert.deepEqual(sample('attack',p),NEUTRAL_POSE);
});
test('invalid layouts are rejected without NaN poses', () => {
  for (const layout of [null, {}, {...rect,width:0}, {...rect,height:-1}, {...rect,x:Infinity}])
    assert.equal(sample('attack',.5,{layout}), null);
});
test('one-shot progress clamps; layout affects translation only, not image fit', () => {
  assert.deepEqual(sample('attack',-2),NEUTRAL_POSE);
  const a = sample('attack',.48), b = sample('attack',.48,{layout:{...rect,width:180,height:90}});
  assert.equal(b.x, a.x * .75); assert.equal(b.scaleX,a.scaleX);
});
test('timeline follows remaining controller time, including a late first observation', () => {
  const s = advanceMonsterTimeline(null,view('attack',375));
  assert.equal(s.progress,.5); assert.equal(s.remainingMs,375);
  const next = advanceMonsterTimeline(s,view('attack',0));
  assert.equal(next.progress,1); assert.equal(s.progress,.5);
});
test('same-action timer increase restarts; repeated identical notification does not', () => {
  const a = advanceMonsterTimeline(null,view('hit',100));
  const b = advanceMonsterTimeline(a,view('hit',500));
  assert.equal(b.revision,a.revision+1); assert.equal(b.progress,0);
  const c = advanceMonsterTimeline(b,view('hit',500));
  assert.equal(c.revision,b.revision);
});
test('host revision can mark same action refire even with equal remaining time', () => {
  const a = advanceMonsterTimeline(null,view('attack',750,{actionRevision:1}));
  const b = advanceMonsterTimeline(a,view('attack',750,{actionRevision:2}));
  assert.equal(b.revision,a.revision+1);
});
test('hit to defeat, mid-action replacement, and defeat endpoint hold', () => {
  const a = advanceMonsterTimeline(null,view('hit',200));
  const b = advanceMonsterTimeline(a,view('defeat',800));
  assert.equal(b.action,'defeat'); assert.ok(Math.abs(b.progress-.2)<1e-8);
  const c = advanceMonsterTimeline(b,view('idle',0));
  assert.equal(c.action,'defeat'); assert.equal(c.progress,1);
  const d = advanceMonsterTimeline(c,view('attack',750));
  assert.equal(d.action,'attack'); assert.equal(d.progress,0);
});
test('new enemy or session clears terminal hold', () => {
  const a = advanceMonsterTimeline(null,view('defeat',0));
  for (const extra of [{session:2}, {monsterId:'OTHER'}]) {
    const b=advanceMonsterTimeline(a,view('idle',0,extra));
    assert.equal(b.action,'idle'); assert.equal(b.progress,0);
  }
});
test('reduced ON/OFF never resets controller progress', () => {
  const a=advanceMonsterTimeline(null,view('attack',450));
  const b=advanceMonsterTimeline(a,view('attack',300,{reducedMotion:true}));
  const c=advanceMonsterTimeline(b,view('attack',150,{reducedMotion:false}));
  assert.equal(c.revision,a.revision); assert.equal(c.progress,.8);
  assert.deepEqual(sample('attack',c.progress),sample('attack',.8));
});
test('host clock advances idle; repeated sampling never advances it', () => {
  const a=advanceMonsterTimeline(null,view('idle',0),100);
  assert.equal(a.progress,.05);
  const b=advanceMonsterTimeline(a,view('idle',0,{elapsedMs:1500}));
  assert.equal(b.progress,.75);
  for(let i=0;i<100;i++)sample(b.action,b.progress);
  assert.equal(b.progress,.75);
});
test('Yomitabi mapping stays at bridge and Sprint requires no enemy object', () => {
  assert.equal(yomitabiView({enemyAction:'damage',enemyActionTimer:200}).action,'hit');
  assert.equal(yomitabiView({enemyAction:'attack',enemyActionTimer:200}).durationMs,750);
  assert.equal(sprintView({notification:'correct',remainingMs:200}).action,'attack');
  assert.equal(sprintView({notification:'complete'}).action,'idle'); // no fifth clip
});
