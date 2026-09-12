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
    constructor(tag = '') { super(); this.tagName = tag.toUpperCase(); this.children = []; this.style = {}; this.dataset = {};
      this.listeners = new Map(); this.inert = false; this.hidden = false; this.disabled = false; this.textContent = ''; this.className = ''; nodes.push(this); }
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
  doc.createElement = tag => new Element(tag); const walk = node => [node, ...node.children.flatMap(walk)];
  doc.getElementById = id => walk(body).find(node => node.id === id) ?? null;
  viewport.height = 723; viewport.offsetTop = 0; const keyboard = new Element(); keyboard.boundingRect = { height: 0, y: 723 };
  return { doc, win: { visualViewport: viewport, navigator: { virtualKeyboard: keyboard } }, nodes,
    find: fn => walk(body).find(fn), all: fn => walk(body).filter(fn),
    listeners: () => nodes.reduce((count, node) => count + [...node.listeners.values()].reduce((sum, set) => sum + set.size, 0), 0) };
}
const click = node => node.dispatchEvent(new Event('click'));
const key = (doc, value, options = {}) => doc.dispatchEvent(Object.assign(new Event('keydown', { cancelable: true }), {
  key: value, repeat: false, isComposing: false, altKey: false, ctrlKey: false, metaKey: false, ...options,
}));
const choice = (d, choiceId) => d.find(node => node.dataset.choiceId === choiceId);
const chooseIds = (d, ids) => ids.forEach(id => click(choice(d, id)));
const submit = d => click(d.find(node => node.dataset.action === 'submit'));
const advance = d => click(d.find(node => node.dataset.action === 'next'));

test('Registry and title expose Multi Select without replacing the first five games', () => {
  assert.deepEqual(Object.keys(miniGameRegistry),
    ['mathSprint', 'mathInvader', 'englishChoice', 'sentenceOrder', 'timedChoice', 'multiSelect', 'asyncChoice', 'kanjiDefense']);
  const title = fs.readFileSync('src/screens/titleScreen.js', 'utf8');
  assert.match(title, /titleMultiSelectButton[^\n]+multiSelect/); assert.equal(miniGameRegistry.multiSelect.title, 'えらんで完成');
});

test('View source has multi-select semantics, 44px targets, responsive rules, focus and non-color status text', () => {
  const view = fs.readFileSync('src/minigames/multiSelect/multiSelectView.js', 'utf8');
  assert.match(view, /min-width:44px;min-height:44px/); assert.match(view, /overflow:auto/);
  assert.match(view, /aria-pressed/); assert.match(view, /選択した正解/); assert.match(view, /選ばなかった正解/);
  assert.match(view, /@media\(max-width:540px\)/); assert.match(view, /@media\(max-height:430px\)/); assert.match(view, /:focus-visible/);
  assert.doesNotMatch(view, /@keyframes|animation:|requestAnimationFrame|setInterval|setTimeout/);
});

test('unchanged Host runs full, partial, zero, feedback and owned/unowned Companion paths', async () => {
  for (const owned of [true, false]) {
    const d = dom(); const host = createMiniGameHost({ document: d.doc, window: d.win,
      collection: () => owned ? ['HKD-E01'] : [], makeSessionId: () => `owned-${owned}`,
      random: () => 0, loadImage: () => image, reduced: () => false });
    host.enter({ gameId: 'multiSelect' }); await drain(); assert.ok(d.doc.getElementById('multiSelectScreen'));
    assert.equal(host.inspect().companion.selected, owned ? 'HKD-E01' : null);
    let state = host.inspect().session; chooseIds(d, state.problem.correctChoiceIds); submit(d);
    assert.equal(host.inspect().session.fullCorrect, 1); assert.match(d.find(node => node.className === 'ms-feedback').children[0].textContent, /ぜんぶ正解/);
    if (owned) assert.equal(host.inspect().companion.action, 'attack'); advance(d);
    state = host.inspect().session; chooseIds(d, state.problem.correctChoiceIds.slice(0, 2)); submit(d);
    assert.equal(host.inspect().session.partial, 1); assert.match(d.find(node => node.className === 'ms-feedback').children[0].textContent, /一部正解/);
    if (owned) assert.equal(host.inspect().companion.action, 'idle'); advance(d);
    state = host.inspect().session; chooseIds(d, state.problem.choices.map(item => item.choiceId)); submit(d);
    assert.equal(host.inspect().session.incorrect, 1); assert.match(d.find(node => node.className === 'ms-feedback').children[0].textContent, /0点/);
    host.exit(); assert.equal(d.listeners(), 0); assert.equal(d.doc.body.children.length, 0);
  }
});

test('pointer and keyboard toggle/unselect/submit share Core gates', () => {
  const d = dom(); const host = createMiniGameHost({ document: d.doc, window: d.win, collection: () => [],
    makeSessionId: () => 'keyboard', random: () => 0, reduced: () => false });
  host.enter({ gameId: 'multiSelect' }); const state = host.inspect().session;
  key(d.doc, '1', { repeat: true }); assert.deepEqual(host.inspect().session.selectedChoiceIds, []);
  key(d.doc, '1'); assert.equal(host.inspect().session.selectedChoiceIds.length, 1);
  key(d.doc, '1'); assert.deepEqual(host.inspect().session.selectedChoiceIds, []);
  host.setPaused(true); key(d.doc, '2'); key(d.doc, 'Enter'); assert.equal(host.inspect().session.answered, 0);
  host.setPaused(false); key(d.doc, '2'); assert.equal(host.inspect().session.selectedChoiceIds.length, 1);
  key(d.doc, 'Enter'); key(d.doc, 'Enter'); assert.equal(host.inspect().session.answered, 1); host.exit();
});

test('visibility/manual pause OR freezes active elapsed and preserves selection', () => {
  const d = dom(); const host = createMiniGameHost({ document: d.doc, window: d.win, collection: () => [],
    makeSessionId: () => 'pause-host', random: () => 0, reduced: () => false });
  host.enter({ gameId: 'multiSelect' }); key(d.doc, '1'); host.update(300); const selected = host.inspect().session.selectedChoiceIds;
  host.setPaused(true); d.doc.hidden = true; d.doc.dispatchEvent(new Event('visibilitychange')); host.setPaused(false); host.update(1000);
  assert.equal(host.inspect().session.paused, true); assert.equal(host.inspect().session.activeElapsedMs, 300);
  assert.deepEqual(host.inspect().session.selectedChoiceIds, selected); key(d.doc, '2'); assert.deepEqual(host.inspect().session.selectedChoiceIds, selected);
  d.doc.hidden = false; d.doc.dispatchEvent(new Event('visibilitychange')); assert.equal(host.inspect().session.paused, false);
  key(d.doc, '2'); assert.equal(host.inspect().session.selectedChoiceIds.length, 2); host.exit();
});

test('pending image and repeated enter/exit leave no scheduler, stale callback, listener or DOM leak', async t => {
  t.mock.method(globalThis, 'setInterval', () => { throw new Error('new interval'); });
  const previousRAF = globalThis.requestAnimationFrame; globalThis.requestAnimationFrame = () => { throw new Error('new RAF'); };
  t.after(() => { globalThis.requestAnimationFrame = previousRAF; });
  const d = dom(); let serial = 0; const host = createMiniGameHost({ document: d.doc, window: d.win,
    collection: () => ['HKD-E01'], makeSessionId: () => `cycle-${++serial}`, random: () => 0,
    loadImage: () => new Promise(() => {}), reduced: () => false });
  for (let index = 0; index < 10; index++) {
    host.enter({ gameId: 'multiSelect' }); const oldChoice = d.find(node => node.dataset.choiceIndex === '1');
    click(oldChoice); host.exit(); host.exit(); await drain(); click(oldChoice); key(d.doc, '1');
    assert.equal(host.inspect().valid, false); assert.equal(host.inspect().session, null); assert.equal(host.inspect().companion, null);
    assert.equal(d.doc.body.children.length, 0); assert.equal(d.listeners(), 0);
  }
});

test('ten questions produce result, replay, image-failure/reduced-motion isolation and no Storage writes', async t => {
  const storage = installStorage(), save = getDefaultSave(); save.player.collection.gotomonIds = ['HKD-E01'];
  save.player.coreStats.hp = 73; save.player.coreStats.exp = 31; save.player.study.answers = {};
  assert.equal(saveNow(save, { replace: true }).ok, true); assert.equal(await loadGameData(), true);
  const beforeGame = JSON.stringify(gameState), beforeStorage = JSON.stringify([...storage.data]); let writes = 0;
  t.mock.method(storage, 'setItem', () => { writes++; throw new Error('Storage write forbidden'); });
  t.mock.method(storage, 'removeItem', () => { writes++; throw new Error('Storage delete forbidden'); });
  const d = dom(); let serial = 0; const host = createMiniGameHost({ document: d.doc, window: d.win,
    makeSessionId: () => `replay-${++serial}`, random: () => 0,
    loadImage: () => Promise.reject(new Error('missing')), reduced: () => true });
  host.enter({ gameId: 'multiSelect' }); await drain(); const firstSession = host.inspect().session.sessionId;
  for (let index = 0; index < 10; index++) {
    const state = host.inspect().session;
    if (index < 4) chooseIds(d, state.problem.correctChoiceIds);
    else if (index < 8) chooseIds(d, state.problem.correctChoiceIds.slice(0, 2));
    submit(d); if (index < 9) advance(d);
  }
  const result = host.inspect().session.result; assert.deepEqual({ answered: result.answered, fullCorrect: result.fullCorrect,
    partial: result.partial, incorrect: result.incorrect }, { answered: 10, fullCorrect: 4, partial: 4, incorrect: 2 });
  assert.ok(Object.isFrozen(result)); assert.equal(host.inspect().session.seq, 21);
  assert.equal(host.inspect().companion.motion.imageState, 'failed'); click(d.find(node => node.dataset.action === 'replay'));
  assert.notEqual(host.inspect().session.sessionId, firstSession); assert.equal(host.inspect().session.seq, 1);
  host.exit(); await drain(); assert.equal(writes, 0); assert.equal(JSON.stringify(gameState), beforeGame);
  assert.equal(JSON.stringify([...storage.data]), beforeStorage);
});
