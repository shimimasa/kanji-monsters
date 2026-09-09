import { loadMonsterImage, loadBgImage } from '/src/loaders/assetsLoader.js';
import { createMonsterMotionHost } from '/src/visuals/motion/monsterMotionHost.js';
import { drawMonsterImage } from '/src/visuals/motion/monsterRenderer.js';
import { NEUTRAL_POSE } from '/src/visuals/motion/motionProfile.js';
import { HKD_E01_MOTION } from '/src/visuals/motion/monsterMotionManifest.js';
import { yomitabiView, sprintView } from './bridges.mjs';
import { legacyPose, drawLegacyFrame } from './legacy.mjs';

const $ = id => document.getElementById(id);
const contexts = ['legacy', 'motion', 'sprint'].map(id => $(id).getContext('2d'));
const events = new AbortController();
let image = null, background = null, session = 0, hosts = [], active = false;
let action = 'idle', notification = 'idle', elapsed = 0, mockElapsed = 0, revision = 0;
let interval = null, last = 0;
const durations = { idle: 2000, attack: 750, hit: 500, defeat: 1000 };
const source = loadMonsterImage({ id: 'HKD-E01', name: 'ジャガイモスライム', grade: 1 });
source.then(value => { image = value; if (active) draw(); }).catch(() => {});
loadBgImage('hokkaido_area1').then(value => { background = value; if (active) draw(); }).catch(() => {});
function stop() { if (interval !== null) clearInterval(interval); interval = null; $('play').textContent = '再生'; }
function update() {
  if (!active) return;
  const reducedMotion = $('reduced').checked;
  hosts[0].update(yomitabiView({ session, monsterId: 'HKD-E01',
    enemyAction: action === 'hit' ? 'damage' : action === 'idle' ? null : action,
    enemyActionTimer: Math.max(0, durations[action] - elapsed),
    elapsedMs: elapsed, actionRevision: revision, reducedMotion }));
  hosts[1].update(sprintView({ session, monsterId: 'HKD-E01', notification,
    remainingMs: Math.max(0, 750 - mockElapsed), elapsedMs: mockElapsed,
    actionRevision: revision, reducedMotion }));
  draw();
}
function draw() {
  if (!active) return;
  const scale = Number($('size').value), mode = $('mode').value;
  $('legacy-card').hidden = mode === 'motion';
  $('motion-card').hidden = mode === 'legacy';
  for (let i = 0; i < contexts.length; i++) {
    const ctx = contexts[i], canvas = ctx.canvas;
    canvas.width = 360 * scale; canvas.height = 200 * scale;
    canvas.style.width = canvas.width + 'px';
    ctx.save();
    try {
      ctx.scale(scale, scale);
      if (background) ctx.drawImage(background, 0, 0, 360, 200);
      else { ctx.fillStyle = '#2a5298'; ctx.fillRect(0, 0, 360, 200); }
      const layout = drawLegacyFrame(ctx, 50, 30);
      // Same stationary dark backing for all arms; not affected by the new image pose.
      ctx.save();
      try {
        const clip = new Path2D(); clip.rect(64, 44, 232, 112); ctx.clip(clip);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'; ctx.fillRect(58, 38, 244, 124);
      } finally { ctx.restore(); }
      let shown = false;
      if (i === 0 || mode === 'static') {
        if ($('image-state').value === 'ready') shown = drawMonsterImage(ctx, image, layout,
          mode === 'static' ? NEUTRAL_POSE : legacyPose(action, elapsed / durations[action], $('reduced').checked));
      } else shown = hosts[i - 1].present(ctx, layout);
      if (!shown) {
        // Same existing 240 x 120 fallback rectangle/name, no alternative asset.
        ctx.save();
        try {
          const path = new Path2D(); path.rect(64, 44, 232, 112); ctx.clip(path);
          ctx.fillStyle = '#6b8e23'; ctx.fillRect(60, 40, 240, 120);
          ctx.fillStyle = 'white'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('ジャガイモスライム', 180, 100);
        } finally { ctx.restore(); }
      }
      // Draw after renderer to expose leaked transform/alpha/clip during visual QA.
      ctx.fillStyle = '#fff'; ctx.fillRect(8, 180, 14, 10);
      ctx.fillStyle = '#23352e'; ctx.font = '11px sans-serif'; ctx.fillText('UI', 27, 189);
    } finally { ctx.restore(); }
  }
  const p = action === 'idle' ? (elapsed % 2000) / 2000 : Math.min(1, elapsed / durations[action]);
  $('progress').value = String(Math.round(p * 1000)); $('time').textContent = Math.round(p * 100) + '%';
  const states = hosts.map(h => h.state());
  $('status').textContent = 'session ' + session + ' / 画像 ' + states[0].imageState + ' / 回答・保存処理なし';
  $('state').textContent = JSON.stringify(states.map(s => ({ action: s.timeline?.action,
    progress: s.timeline?.progress, revision: s.timeline?.revision, image: s.imageState })), null, 2);
}
function exit() {
  stop(); active = false; hosts.forEach(h => h.dispose());
  contexts.forEach(ctx => ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height));
  $('status').textContent = '退出済み：画像参照・表示状態を解放。再入場できます。';
  $('state').textContent = JSON.stringify(hosts.map(h => h.state()), null, 2);
}
function enter() {
  exit(); session++; elapsed = mockElapsed = 0; revision++;
  action = notification = 'idle';
  const mode = $('image-state').value;
  const promise = mode === 'pending' ? new Promise(() => {}) :
    mode === 'failed' ? Promise.reject(new Error('Demo image failure')) : source;
  hosts = [0, 1].map(() => createMonsterMotionHost({ session, imagePromise: promise, visual: HKD_E01_MOTION }));
  active = true; update();
  const entered = session;
  Promise.all(hosts.map(h => h.settled)).then(() => { if (active && session === entered) draw(); });
}
function listen(element, event, fn) { element.addEventListener(event, fn, { signal: events.signal }); }
for (const b of document.querySelectorAll('[data-action]')) listen(b, 'click', () => {
  action = b.dataset.action; elapsed = 0; revision++; update();
});
listen($('correct'), 'click', () => { notification = 'correct'; mockElapsed = 0; revision++; update(); });
listen($('mock-idle'), 'click', () => { notification = 'idle'; mockElapsed = 0; revision++; update(); });
listen($('progress'), 'input', () => {
  stop(); elapsed = Number($('progress').value) / 1000 * durations[action];
  mockElapsed = Number($('progress').value) / 1000 * (notification === 'correct' ? 750 : 2000); update();
});
listen($('step'), 'click', () => { stop(); elapsed += 100; mockElapsed += 100; update(); });
listen($('play'), 'click', () => {
  if (interval !== null) { stop(); return; }
  if (!active) return;
  last = performance.now(); $('play').textContent = '一時停止';
  // Development-only transport. Engine/hosts own no timer or frame loop.
  // No requestAnimationFrame and no connection to the production game cycle.
  interval = setInterval(() => {
    const now = performance.now(), delta = now - last; last = now;
    elapsed += delta; mockElapsed += delta; update();
  }, 33);
});
for (const id of ['reduced', 'size', 'mode']) listen($(id), 'change', update);
listen($('image-state'), 'change', enter);
listen($('exit'), 'click', exit); listen($('enter'), 'click', enter);
listen(document, 'visibilitychange', () => { if (document.hidden) stop(); });
listen(window, 'pagehide', () => { exit(); events.abort(); });
enter();
