import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { installStorage } from '../phase-a/storage-helper.mjs';
import { createMiniGameHost } from '../../src/minigames/miniGameHost.js';
import { miniGameRegistry } from '../../src/minigames/registry.js';
import { getDefaultSave, saveNow } from '../../src/core/saveData.js';
import { gameState, loadGameData } from '../../src/core/gameState.js';

const drain = () => new Promise(resolve => setImmediate(resolve));
const image = { complete: true, naturalWidth: 512, naturalHeight: 512 };
function dom() {
  const nodes = [];
  class Element extends EventTarget {
    constructor(tag = '') {
      super(); this.tagName = tag.toUpperCase(); this.children = []; this.style = {}; this.dataset = {};
      this.listeners = new Map(); this.inert = false; this.hidden = false; this.disabled = false;
      this.textContent = ''; this.className = ''; nodes.push(this);
    }
    addEventListener(type, fn, ...args) { super.addEventListener(type, fn, ...args); if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
    removeEventListener(type, fn, ...args) { super.removeEventListener(type, fn, ...args); this.listeners.get(type)?.delete(fn); }
    append(...items) { for (const item of items) { this.children.push(item); item.parent = this; } }
    appendChild(item) { this.append(item); return item; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.parent = null; }
    setAttribute(key, value) { this[key] = String(value); }
    focus() { this.focused = true; }
    getContext() { return { clearRect() {}, save() {}, restore() {}, clip() {}, translate() {}, rotate() {}, scale() {}, drawImage() {}, globalAlpha: 1 }; }
  }
  const body = new Element('body'), doc = new Element('document'), viewport = new Element(); doc.body = body; doc.hidden = false;
  doc.createElement = tag => new Element(tag);
  const walk = node => [node, ...node.children.flatMap(walk)];
  doc.getElementById = id => walk(body).find(node => node.id === id) ?? null;
  viewport.height = 723; viewport.offsetTop = 0;
  const keyboard = new Element(); keyboard.boundingRect = { height: 0, y: 723 };
  return { doc, win: { visualViewport: viewport, navigator: { virtualKeyboard: keyboard } }, nodes,
    find: fn => walk(body).find(fn), all: fn => walk(body).filter(fn),
    listeners: () => nodes.reduce((count, node) => count + [...node.listeners.values()].reduce((sum, set) => sum + set.size, 0), 0) };
}
const click = node => node.dispatchEvent(new Event('click'));
const key = (doc, value, options = {}) => doc.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), {
  key: value, repeat: false, isComposing: false, altKey: false, ctrlKey: false, metaKey: false, ...options,
}));
const chunk = (d, chunkId) => d.find(node => node.dataset.chunkId === chunkId);
// Planks are laid by tapping them in sentence order; the last plank submits.
function layThroughView(d, host, order = host.inspect().session.problem.correctOrder) {
  for (const id of order) click(chunk(d, id));
}
const wrongOrder = state => [...state.problem.correctOrder].reverse();

test('Registry and title retain Sentence Order when the fifth game is added', () => {
  assert.deepEqual(Object.keys(miniGameRegistry), ['mathSprint', 'mathInvader', 'englishChoice', 'sentenceOrder', 'timedChoice', 'multiSelect', 'asyncChoice', 'kanjiDefense']);
  const title = fs.readFileSync('src/screens/titleScreen.js', 'utf8');
  assert.match(title, /publish\('changeScreen', 'miniGameHub'\)/);
  assert.match(fs.readFileSync('src/screens/miniGameHubScreen.js', 'utf8'), /Object.values\(miniGameRegistry\)/);
});

test('View source keeps 44px targets, focus, answer feedback, and no scheduler of its own', () => {
  const view = fs.readFileSync('src/minigames/sentenceOrder/sentenceOrderView.js', 'utf8');
  assert.match(view, /min-height:44px/); assert.match(view, /min-height:52px/);
  assert.match(view, /:focus-visible/); assert.match(view, /aria-label/); assert.match(view, /正しい文/);
  assert.match(view, /createArcadeFrame/);
  assert.doesNotMatch(view, /setTimeout|setInterval|requestAnimationFrame/);
});

test('unchanged Host lays planks, gives correct/incorrect feedback, Next, and owned/unowned Companion', async () => {
  for (const owned of [true, false]) {
    const d = dom(); const host = createMiniGameHost({ document: d.doc, window: d.win,
      collection: () => owned ? ['HKD-E01'] : [], makeSessionId: () => `owned-${owned}`,
      random: () => 0, loadImage: () => image, reduced: () => false });
    host.enter({ gameId: 'sentenceOrder' }); await drain(); host.update(0);
    assert.ok(d.doc.getElementById('sentenceOrderScreen'));
    assert.equal(host.inspect().companion.selected, owned ? 'HKD-E01' : null);
    const correctOrder = host.inspect().session.problem.correctOrder;
    click(chunk(d, correctOrder[0])); assert.equal(chunk(d, correctOrder[0]).dataset.where, 'bridge');
    assert.equal(host.inspect().session.answered, 0);
    // Tapping a laid plank sends it back to the river without answering.
    click(chunk(d, correctOrder[0])); assert.equal(chunk(d, correctOrder[0]).dataset.where, 'river');
    layThroughView(d, host); assert.equal(host.inspect().session.correct, 1);
    if (owned) assert.equal(host.inspect().companion.action, 'attack');
    click(d.find(node => node.dataset.action === 'next')); layThroughView(d, host, wrongOrder(host.inspect().session));
    assert.equal(host.inspect().session.incorrect, 1); assert.match(d.find(node => node.className === 'so-feedback').textContent, /正しい文/);
    if (owned) assert.equal(host.inspect().companion.action, 'idle');
    host.exit(); assert.equal(d.listeners(), 0); assert.equal(d.doc.body.children.length, 0);
  }
});

test('keyboard and pointer share Core identity gates for laying, lifting, repeat, pause, and double submit', () => {
  const d = dom(); const host = createMiniGameHost({ document: d.doc, window: d.win, collection: () => [],
    makeSessionId: () => 'keyboard', random: () => 0, reduced: () => false });
  host.enter({ gameId: 'sentenceOrder' }); const state = host.inspect().session;
  const first = state.currentOrder[1]; key(d.doc, '2');
  assert.equal(host.inspect().session.currentOrder[0], first); assert.equal(chunk(d, first).dataset.where, 'bridge');
  key(d.doc, '1', { repeat: true }); assert.equal(chunk(d, host.inspect().session.currentOrder[1]).dataset.where, 'river');
  key(d.doc, 'Backspace'); assert.equal(chunk(d, first).dataset.where, 'river');
  host.setPaused(true); key(d.doc, '1'); click(chunk(d, state.currentOrder[0]));
  assert.equal(d.all(node => node.dataset.where === 'bridge').length, 0); host.setPaused(false);
  for (let i = 0; i < state.currentOrder.length; i++) key(d.doc, '1');
  assert.equal(host.inspect().session.answered, 1);
  key(d.doc, '1'); click(chunk(d, state.currentOrder[0])); assert.equal(host.inspect().session.answered, 1); host.exit();
});

test('visibility and manual pause compose and freeze active elapsed time', () => {
  const d = dom(); const host = createMiniGameHost({ document: d.doc, window: d.win, collection: () => [],
    makeSessionId: () => 'pause-host', random: () => 0, reduced: () => false });
  host.enter({ gameId: 'sentenceOrder' }); host.update(100); const before = host.inspect().session;
  host.setPaused(true); d.doc.hidden = true; d.doc.dispatchEvent(new Event('visibilitychange'));
  host.setPaused(false); host.update(500); assert.equal(host.inspect().session.paused, true);
  assert.equal(host.inspect().session.activeElapsedMs, before.activeElapsedMs);
  d.doc.hidden = false; d.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(host.inspect().session.paused, false); host.update(50);
  assert.equal(host.inspect().session.activeElapsedMs, before.activeElapsedMs + 50); host.exit();
});

test('replay and repeated enter/exit reject stale and disposed callbacks with no DOM/listener/scheduler leaks', async t => {
  t.mock.method(globalThis, 'setInterval', () => { throw new Error('new interval'); });
  const previousRAF = globalThis.requestAnimationFrame; globalThis.requestAnimationFrame = () => { throw new Error('new RAF'); };
  t.after(() => { globalThis.requestAnimationFrame = previousRAF; });
  const d = dom(); let serial = 0; const host = createMiniGameHost({ document: d.doc, window: d.win,
    collection: () => serial % 2 ? ['HKD-E01'] : [], makeSessionId: () => `cycle-${++serial}`,
    random: () => 0, loadImage: () => new Promise(() => {}), reduced: () => false });
  for (let index = 0; index < 10; index++) {
    host.enter({ gameId: 'sentenceOrder' }); const state = host.inspect().session;
    const oldPlank = chunk(d, state.currentOrder[0]);
    layThroughView(d, host, state.currentOrder); assert.equal(host.inspect().session.answered, 1); host.exit(); host.exit(); await drain();
    click(oldPlank); key(d.doc, '1'); assert.equal(host.inspect().valid, false); assert.equal(host.inspect().session, null);
    assert.equal(host.inspect().companion, null); assert.equal(d.doc.body.children.length, 0); assert.equal(d.listeners(), 0);
  }
});

test('ten questions, immutable result, replay, image failure, reduced motion, and Storage isolation hold through Host', async t => {
  const storage = installStorage(), save = getDefaultSave(); save.player.collection.gotomonIds = ['HKD-E01'];
  save.player.coreStats.hp = 73; save.player.coreStats.exp = 31; save.player.study.answers = {};
  assert.equal(saveNow(save, { replace: true }).ok, true); assert.equal(await loadGameData(), true);
  const beforeGame = JSON.stringify(gameState), beforeStorage = JSON.stringify([...storage.data]); let writes = 0;
  t.mock.method(storage, 'setItem', () => { writes++; throw new Error('Storage write forbidden'); });
  t.mock.method(storage, 'removeItem', () => { writes++; throw new Error('Storage delete forbidden'); });
  const d = dom(); let serial = 0; const host = createMiniGameHost({ document: d.doc, window: d.win,
    makeSessionId: () => `replay-${++serial}`, random: () => 0,
    loadImage: () => Promise.reject(new Error('missing')), reduced: () => true });
  host.enter({ gameId: 'sentenceOrder' }); await drain(); const firstSession = host.inspect().session.sessionId;
  for (let index = 0; index < 10; index++) {
    const state = host.inspect().session;
    layThroughView(d, host, index === 4 ? wrongOrder(state) : state.problem.correctOrder);
    if (index < 9) click(d.find(node => node.dataset.action === 'next'));
  }
  assert.deepEqual(host.inspect().session.result, { answered: 10, correct: 9, incorrect: 1, accuracy: 0.9 });
  assert.ok(Object.isFrozen(host.inspect().session.result)); assert.equal(host.inspect().session.seq, 21);
  // The shell owns the replay button; the Host entry is what it calls.
  host.enter({ gameId: 'sentenceOrder' }); host.update(0);
  assert.notEqual(host.inspect().session.sessionId, firstSession); assert.equal(host.inspect().session.seq, 1);
  host.exit(); await drain(); assert.equal(writes, 0);
  assert.equal(JSON.stringify(gameState), beforeGame); assert.equal(JSON.stringify([...storage.data]), beforeStorage);
});
