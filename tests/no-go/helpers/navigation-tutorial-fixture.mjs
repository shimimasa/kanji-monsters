import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';
import { installStorage } from '../../phase-a/storage-helper.mjs';

register('./navigation-tutorial-loader.mjs', import.meta.url);
export const storage = installStorage();
const { getDefaultSave, saveNow } = await import('../../../src/core/saveData.js');
export const { gameState, battleState, loadGameData } = await import('../../../src/core/gameState.js');
export const { default: tutorial } = await import('../../../src/tutorial/TutorialManager.js');
const { subscribe } = await import('../../../src/core/eventBus.js');
const { loadAllGameData } = await import('../../../src/loaders/dataLoader.js');
const previousFetch = globalThis.fetch;
globalThis.fetch = async url => ({ ok: true, json: async () =>
  JSON.parse(fs.readFileSync(new URL('../../../public' + url, import.meta.url), 'utf8')) });
assert.ok(await loadAllGameData());
globalThis.fetch = previousFetch;

export const drain = () => new Promise(resolve => setImmediate(resolve));
function element() {
  const classes = new Set();
  return Object.assign(new EventTarget(), {
    value: '', children: [], style: { setProperty(k,v) { this[k]=v; }, removeProperty(k) { delete this[k]; } },
    classList: { add: k => classes.add(k), remove: k => classes.delete(k), contains: k => classes.has(k) },
    focus() {}, blur() {}, setAttribute() {}, removeAttribute() {},
    appendChild(e) { this.children.push(e); e.parentElement = this; return e; },
    removeChild(e) { this.children = this.children.filter(child => child !== e); e.parentElement = null; },
    remove() { this.parentElement?.removeChild(this); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 48 }),
  });
}

export async function navigationFixture(t) {
  const errors = [];
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'warn', () => {});
  t.mock.method(console, 'error', (...args) => errors.push(args.map(String).join(' ')));
  storage.clear();
  assert.equal(saveNow(getDefaultSave(), { replace: true }).ok, true);
  assert.equal(await loadGameData(), true);
  gameState.currentGrade = 1;
  const keys = ['document','window','requestAnimationFrame','cancelAnimationFrame','__holdNavigationTutorial'];
  const previous = new Map(keys.map(k => [k, Object.getOwnPropertyDescriptor(globalThis,k)]));
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({ measureText: s => ({ width: String(s).length * 16 }),
    createLinearGradient: () => gradient, createRadialGradient: () => gradient },
    { get: (o,k) => k in o ? o[k] : () => {} });
  const canvas = Object.assign(element(), { id: 'gameCanvas', width: 800, height: 600, getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 13, top: 27, width: 390, height: 700 }) });
  const body = element(); body.appendChild(canvas);
  const findId = (e,id) => e.id === id ? e : e.children.map(child => findId(child,id)).find(Boolean);
  globalThis.document = Object.assign(new EventTarget(), { body, documentElement: element(),
    getElementById: id => findId(body,id) || null, createElement: () => element(),
    querySelector: () => null, querySelectorAll: () => [] });
  globalThis.window = Object.assign(new EventTarget(), { innerWidth: 390, innerHeight: 700,
    matchMedia: () => ({ matches: true }), scrollTo() {} });
  const frames = new Map(); let frameId = 0;
  globalThis.requestAnimationFrame = fn => { frames.set(++frameId,fn); return frameId; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  let time = 1000, label = 'old', delivery = '', current = null, subscribed = true;
  t.mock.method(performance, 'now', () => time);
  const imports = [], starts = [];
  globalThis.__holdNavigationTutorial = (ready,url) => {
    let release; const held = new Promise(resolve => release = resolve);
    imports.push({ label, ready, release, url }); return held;
  };
  const start = tutorial._start;
  t.mock.method(tutorial, '_start', function(...args) {
    starts.push({ label: delivery, id: args[0] }); return start.apply(this,args);
  });
  let overlaysAdded = 0;
  const append = body.appendChild;
  t.mock.method(body, 'appendChild', function(e) {
    if (e.style.zIndex === 100002) overlaysAdded++;
    return append.call(this,e);
  });
  async function release(group) {
    delivery = group;
    for (const item of imports.filter(i => i.label === group)) item.release(await item.ready);
    await drain();
  }
  function exit() { const screen = current; current = null; screen?.exit(); }
  t.after(async () => {
    subscribed = false; exit();
    for (const group of new Set(imports.map(i => i.label))) await release(group);
    tutorial._destroy();
    for (const [k,d] of previous) if (d) Object.defineProperty(globalThis,k,d); else delete globalThis[k];
    assert.deepEqual(errors, [], 'screen initialization, transition and guide must execute without errors');
  });
  return {
    canvas, imports, starts, body, release, exit,
    enter(screen, group='old') { label = group; current = screen; screen.enter(canvas); },
    track(screen) { current = screen; },
    advance(ms) { time += ms; },
    onTransition(callback) { subscribe('changeScreen', target => { if (subscribed) callback(target); }); },
    overlays: () => body.children.filter(e => e.style.zIndex === 100002),
    overlaysAdded: () => overlaysAdded,
    click(rect) {
      const r = canvas.getBoundingClientRect(), scale = Math.min(r.width/800, r.height/600);
      const event = new Event('click', { cancelable: true });
      Object.defineProperties(event, {
        clientX: { value: r.left+(r.width-800*scale)/2+(rect.x+rect.width/2)*scale },
        clientY: { value: r.top+(r.height-600*scale)/2+(rect.y+rect.height/2)*scale },
      });
      canvas.dispatchEvent(event);
    },
  };
}
