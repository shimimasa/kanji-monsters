import test from 'node:test';
import assert from 'node:assert/strict';
import { installStorage } from '../phase-a/storage-helper.mjs';
import { createMiniGameHost } from '../../src/minigames/miniGameHost.js';
import { createCompanionAdapter } from '../../src/minigames/companionAdapter.js';
import { getDefaultSave, saveNow } from '../../src/core/saveData.js';
import { gameState, loadGameData } from '../../src/core/gameState.js';

const drain = () => new Promise(resolve => setImmediate(resolve));
const image = { complete: true, naturalWidth: 512, naturalHeight: 512 };
function dom() {
  const nodes = [];
  class Element extends EventTarget {
    constructor(tag = '') {
      super(); this.tagName = tag.toUpperCase(); this.children = []; this.style = {}; this.dataset = {};
      this.value = ''; this.listeners = new Map(); this.inert = false; this.hidden = false; nodes.push(this);
    }
    addEventListener(type, fn, ...args) { super.addEventListener(type, fn, ...args); if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
    removeEventListener(type, fn, ...args) { super.removeEventListener(type, fn, ...args); this.listeners.get(type)?.delete(fn); }
    append(...items) { for (const item of items) { this.children.push(item); item.parent = this; } }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.parent = null; }
    setAttribute(key, value) { this[key] = value; }
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

test('one Host enters and exits Sprint then Invader without gameId-specific setup', () => {
  const d = dom(); let id = 0;
  const host = createMiniGameHost({ document: d.doc, window: d.win, collection: () => [],
    makeSessionId: () => `cross-${++id}`, random: () => 0, reduced: () => false });
  host.enter({ gameId: 'mathSprint' }); assert.ok(d.doc.getElementById('mathSprintScreen'));
  assert.equal(host.inspect().session.gameId, 'mathSprint'); host.exit(); assert.equal(d.doc.body.children.length, 0);
  host.enter({ gameId: 'mathInvader' }); assert.ok(d.doc.getElementById('mathInvaderScreen'));
  assert.equal(host.inspect().session.gameId, 'mathInvader'); host.exit(); assert.equal(d.doc.body.children.length, 0);
  assert.equal(d.listeners(), 0);
});

test('Invader Host supports select, answer, projectile-independent next enemy and Companion mapping', async () => {
  const d = dom(); const host = createMiniGameHost({ document: d.doc, window: d.win,
    collection: () => ['HKD-E01'], makeSessionId: () => 'owned', random: () => 0,
    loadImage: () => image, reduced: () => false });
  host.enter({ gameId: 'mathInvader' }); await drain(); host.update(900);
  const enemies = d.all(node => node.dataset.enemyId); assert.equal(enemies.length, 2); click(enemies[0]); host.update(0);
  let state = host.inspect().session, input = d.find(node => node.tagName === 'INPUT'); input.value = String(state.selectedEnemy.answer);
  click(d.find(node => node.dataset.action === 'answer')); host.update(0);
  assert.equal(host.inspect().session.resolved, 1); assert.equal(host.inspect().session.projectiles.length, 1);
  assert.equal(host.inspect().companion.action, 'attack');
  click(d.all(node => node.dataset.enemyId)[0]); host.update(0); state = host.inspect().session;
  input = d.find(node => node.tagName === 'INPUT'); input.value = String(state.selectedEnemy.answer);
  click(d.find(node => node.dataset.action === 'answer')); host.update(0);
  assert.equal(host.inspect().session.resolved, 2);
  host.exit(); assert.equal(d.listeners(), 0); assert.equal(d.doc.body.children.length, 0);
});

test('visibility and manual pause remain distinct from answer pause and retain input', () => {
  const d = dom(); const host = createMiniGameHost({ document: d.doc, window: d.win, collection: () => [],
    makeSessionId: () => 'pause', random: () => 0, reduced: () => false });
  host.enter({ gameId: 'mathInvader' }); click(d.find(node => node.dataset.enemyId)); host.update(0);
  const input = d.find(node => node.tagName === 'INPUT'); input.value = '7'; const y = host.inspect().session.enemies[0].y;
  host.update(500); assert.equal(host.inspect().session.enemies[0].y, y); assert.equal(host.inspect().session.activeElapsedMs, 500);
  host.setPaused(true); d.doc.hidden = true; d.doc.dispatchEvent(new Event('visibilitychange')); host.update(500);
  assert.equal(host.inspect().session.activeElapsedMs, 500); assert.equal(input.value, '7'); assert.equal(input.disabled, true);
  d.doc.hidden = false; d.doc.dispatchEvent(new Event('visibilitychange')); assert.equal(host.inspect().session.paused, true);
  host.setPaused(false); assert.equal(host.inspect().session.paused, false); assert.equal(host.inspect().session.answerPaused, true);
  host.exit();
});

test('shared Companion handles owned, unowned, pending, failure and reduced motion for Invader events', async () => {
  const absent = createCompanionAdapter({ sessionId: 'i', ownedMonsterIds: [], loadImage: () => image });
  absent.observe({ sessionId: 'i', seq: 1, type: 'correct' }); assert.equal(absent.inspect().hostCount, 0); absent.dispose();
  let rejectImage; const pending = new Promise((resolve, reject) => { rejectImage = reject; });
  const companion = createCompanionAdapter({ sessionId: 'i', ownedMonsterIds: ['HKD-E01'], loadImage: () => pending });
  await drain(); companion.observe({ sessionId: 'i', seq: 1, type: 'problemPresented' });
  companion.observe({ sessionId: 'i', seq: 2, type: 'correct' }); companion.update(10, true);
  assert.equal(companion.inspect().action, 'attack');
  companion.observe({ sessionId: 'i', seq: 3, type: 'incorrect' }); assert.equal(companion.inspect().action, 'idle');
  rejectImage(Error('missing')); await drain(); assert.equal(companion.inspect().motion.imageState, 'failed');
  companion.dispose(); assert.equal(companion.inspect().hostCount, 0);
});

test('ten Invader enter/exit cycles leave no RAF, interval, listener, DOM, enemy, projectile or Companion refs', async t => {
  t.mock.method(globalThis, 'setInterval', () => { throw Error('new interval'); });
  const previousRAF = globalThis.requestAnimationFrame; globalThis.requestAnimationFrame = () => { throw Error('new RAF'); };
  t.after(() => { globalThis.requestAnimationFrame = previousRAF; });
  const d = dom(); let id = 0;
  const host = createMiniGameHost({ document: d.doc, window: d.win,
    collection: () => id % 2 ? ['HKD-E01'] : [], makeSessionId: () => `life-${++id}`,
    random: () => 0, loadImage: () => new Promise(() => {}), reduced: () => false });
  for (let i = 0; i < 10; i++) {
    host.enter({ gameId: 'mathInvader' }); host.update(900);
    const enemy = d.find(node => node.dataset.enemyId); click(enemy); host.update(0);
    const state = host.inspect().session, input = d.find(node => node.tagName === 'INPUT'); input.value = String(state.selectedEnemy.answer);
    click(d.find(node => node.dataset.action === 'answer')); host.update(0);
    assert.equal(host.inspect().session.resolved, 1); assert.equal(host.inspect().session.projectiles.length, 1);
    const oldButton = d.find(node => node.dataset.action === 'answer'); host.exit(); host.exit(); host.update(1000); await drain();
    click(oldButton); assert.equal(host.inspect().valid, false); assert.equal(host.inspect().session, null);
    assert.equal(host.inspect().companion, null); assert.equal(d.doc.body.children.length, 0); assert.equal(d.listeners(), 0);
  }
});

test('Invader session never changes kanji Core or Storage and creates no key', async t => {
  const storage = installStorage(), save = getDefaultSave(); save.player.collection.gotomonIds = ['HKD-E01'];
  save.player.coreStats.hp = 73; save.player.coreStats.exp = 31; save.player.study.answers = {};
  assert.equal(saveNow(save, { replace: true }).ok, true); assert.equal(await loadGameData(), true);
  const beforeGame = JSON.stringify(gameState), beforeStorage = JSON.stringify([...storage.data]); let writes = 0;
  t.mock.method(storage, 'setItem', () => { writes++; throw Error('Storage write forbidden'); });
  t.mock.method(storage, 'removeItem', () => { writes++; throw Error('Storage delete forbidden'); });
  const d = dom(); const host = createMiniGameHost({ document: d.doc, window: d.win, makeSessionId: () => 'isolation',
    random: () => 0, loadImage: () => Promise.reject(Error('missing')), reduced: () => true });
  host.enter({ gameId: 'mathInvader' }); await drain(); host.update(0);
  for (let i = 0; i < 3; i++) {
    if (!host.inspect().session.selectedEnemy) click(d.find(node => node.dataset.enemyId));
    host.update(0); const state = host.inspect().session, input = d.find(node => node.tagName === 'INPUT');
    input.value = String(state.selectedEnemy.answer + 1); click(d.find(node => node.dataset.action === 'answer')); host.update(0);
  }
  assert.equal(host.inspect().session.result.outcome, 'gameOver'); host.exit();
  assert.equal(writes, 0); assert.equal(JSON.stringify(gameState), beforeGame); assert.equal(JSON.stringify([...storage.data]), beforeStorage);
});
