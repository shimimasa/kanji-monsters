import test from 'node:test';
import assert from 'node:assert/strict';
import { installStorage } from '../phase-a/storage-helper.mjs';
import { createMiniGameHost } from '../../src/minigames/miniGameHost.js';
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
const choice = (d, choiceId) => d.find(node => node.dataset.choiceId === choiceId);

test('unchanged Host runs English choice with owned and unowned Companion behavior', async () => {
  for (const owned of [true, false]) {
    const d = dom(); const host = createMiniGameHost({ document: d.doc, window: d.win,
      collection: () => owned ? ['HKD-E01'] : [], makeSessionId: () => `owned-${owned}`,
      random: () => 0, loadImage: () => image, reduced: () => false });
    host.enter({ gameId: 'englishChoice' }); await drain(); host.update(0);
    assert.ok(d.doc.getElementById('englishChoiceScreen'));
    assert.equal(host.inspect().companion.selected, owned ? 'HKD-E01' : null);
    let state = host.inspect().session; click(choice(d, state.problem.correctChoiceId));
    assert.equal(host.inspect().session.correct, 1);
    if (owned) assert.equal(host.inspect().companion.action, 'attack');
    click(d.find(node => node.dataset.action === 'next')); state = host.inspect().session;
    const wrong = state.problem.choices.find(item => item.choiceId !== state.problem.correctChoiceId);
    click(choice(d, wrong.choiceId)); assert.equal(host.inspect().session.incorrect, 1);
    if (owned) assert.equal(host.inspect().companion.action, 'idle');
    host.exit(); assert.equal(d.listeners(), 0); assert.equal(d.doc.body.children.length, 0);
  }
});

test('choice click and keyboard share identity gates for double click, repeat, and pause', () => {
  const d = dom(); const host = createMiniGameHost({ document: d.doc, window: d.win, collection: () => [],
    makeSessionId: () => 'input', random: () => 0, reduced: () => false });
  host.enter({ gameId: 'englishChoice' }); let state = host.inspect().session;
  const correctButton = choice(d, state.problem.correctChoiceId); click(correctButton); click(correctButton);
  assert.equal(host.inspect().session.answered, 1);
  click(d.find(node => node.dataset.action === 'next')); state = host.inspect().session;
  d.doc.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: '1', repeat: true }));
  assert.equal(host.inspect().session.answered, 1);
  host.setPaused(true); click(choice(d, state.problem.correctChoiceId));
  d.doc.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: '1', repeat: false }));
  assert.equal(host.inspect().session.answered, 1);
  host.setPaused(false); const firstChoice = state.problem.choices[0];
  d.doc.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), { key: '1', repeat: false }));
  assert.equal(host.inspect().session.answered, 2);
  assert.equal(host.inspect().session.lastAnswer.choiceId, firstChoice.choiceId);
  host.exit();
});

test('visibility and manual pause compose without releasing each other', () => {
  const d = dom(); const host = createMiniGameHost({ document: d.doc, window: d.win, collection: () => [],
    makeSessionId: () => 'pause-host', random: () => 0, reduced: () => false });
  host.enter({ gameId: 'englishChoice' }); const state = host.inspect().session;
  host.setPaused(true); d.doc.hidden = true; d.doc.dispatchEvent(new Event('visibilitychange'));
  host.setPaused(false); assert.equal(host.inspect().session.paused, true);
  click(choice(d, state.problem.correctChoiceId)); assert.equal(host.inspect().session.answered, 0);
  d.doc.hidden = false; d.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(host.inspect().session.paused, false); click(choice(d, state.problem.correctChoiceId));
  assert.equal(host.inspect().session.answered, 1); host.exit();
});

test('ten English enter/exit cycles leave no scheduler, listener, DOM, or Companion refs', async t => {
  t.mock.method(globalThis, 'setInterval', () => { throw new Error('new interval'); });
  const previousRAF = globalThis.requestAnimationFrame; globalThis.requestAnimationFrame = () => { throw new Error('new RAF'); };
  t.after(() => { globalThis.requestAnimationFrame = previousRAF; });
  const d = dom(); let serial = 0;
  const host = createMiniGameHost({ document: d.doc, window: d.win,
    collection: () => serial % 2 ? ['HKD-E01'] : [], makeSessionId: () => `cycle-${++serial}`,
    random: () => 0, loadImage: () => new Promise(() => {}), reduced: () => false });
  for (let index = 0; index < 10; index++) {
    host.enter({ gameId: 'englishChoice' }); const state = host.inspect().session;
    const oldButton = choice(d, state.problem.correctChoiceId); click(oldButton);
    assert.equal(host.inspect().session.answered, 1); host.exit(); host.exit(); host.update(1000); await drain();
    click(oldButton); assert.equal(host.inspect().valid, false); assert.equal(host.inspect().session, null);
    assert.equal(host.inspect().companion, null); assert.equal(d.doc.body.children.length, 0); assert.equal(d.listeners(), 0);
  }
});

test('result, replay, late callback, and Core/Storage isolation hold through Host', async t => {
  const storage = installStorage(), save = getDefaultSave(); save.player.collection.gotomonIds = ['HKD-E01'];
  save.player.coreStats.hp = 73; save.player.coreStats.exp = 31; save.player.study.answers = {};
  assert.equal(saveNow(save, { replace: true }).ok, true); assert.equal(await loadGameData(), true);
  const beforeGame = JSON.stringify(gameState), beforeStorage = JSON.stringify([...storage.data]); let writes = 0;
  t.mock.method(storage, 'setItem', () => { writes++; throw new Error('Storage write forbidden'); });
  t.mock.method(storage, 'removeItem', () => { writes++; throw new Error('Storage delete forbidden'); });
  const d = dom(); let serial = 0; const host = createMiniGameHost({ document: d.doc, window: d.win,
    makeSessionId: () => `replay-${++serial}`, random: () => 0,
    loadImage: () => Promise.reject(new Error('missing')), reduced: () => true });
  host.enter({ gameId: 'englishChoice' }); await drain(); const first = host.inspect().session;
  for (let index = 0; index < 10; index++) {
    const state = host.inspect().session; click(choice(d, state.problem.correctChoiceId));
    if (index < 9) click(d.find(node => node.dataset.action === 'next'));
  }
  assert.deepEqual(host.inspect().session.result, { answered: 10, correct: 10, incorrect: 0, accuracy: 1 });
  assert.equal(host.inspect().session.seq, 21);
  const replay = d.find(node => node.dataset.action === 'replay'); click(replay);
  assert.notEqual(host.inspect().session.sessionId, first.sessionId); assert.equal(host.inspect().session.seq, 1);
  click(replay); assert.equal(host.inspect().session.seq, 1);
  host.exit(); await drain(); assert.equal(writes, 0);
  assert.equal(JSON.stringify(gameState), beforeGame); assert.equal(JSON.stringify([...storage.data]), beforeStorage);
});
