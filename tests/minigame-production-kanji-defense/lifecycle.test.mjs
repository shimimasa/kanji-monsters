import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createMiniGameHost } from '../../src/minigames/miniGameHost.js';
import { miniGameRegistry } from '../../src/minigames/registry.js';
import { createCompanionAdapter } from '../../src/minigames/companionAdapter.js';
import { KANJI_DEFENSE_GOLDEN_CONTENT } from '../../src/minigames/kanjiDefense/kanjiDefenseContent.js';
import { installStorage } from '../phase-a/storage-helper.mjs';

const drain = () => new Promise(resolve => setImmediate(resolve));
const companionImage = { complete: true, naturalWidth: 512, naturalHeight: 512 };
const readingFor = enemy => KANJI_DEFENSE_GOLDEN_CONTENT.find(item => item.fixtureId === enemy.fixtureId).acceptedReadings[0];

function dom() {
  const nodes = [];
  class Element extends EventTarget {
    constructor(tag = '') {
      super(); this.tagName = tag.toUpperCase(); this.children = []; this.style = {}; this.dataset = {};
      this.value = ''; this.inert = false; this.hidden = false; this.disabled = false; this.listeners = new Map(); nodes.push(this);
    }
    addEventListener(type, handler, ...args) {
      super.addEventListener(type, handler, ...args);
      if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(handler);
    }
    removeEventListener(type, handler, ...args) { super.removeEventListener(type, handler, ...args); this.listeners.get(type)?.delete(handler); }
    append(...items) { for (const item of items) { this.children.push(item); item.parent = this; } }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.parent = null; }
    setAttribute(key, value) { this[key] = value; }
    focus() { this.focused = true; }
    getContext() { return { clearRect() {}, save() {}, restore() {}, clip() {}, translate() {}, rotate() {}, scale() {}, drawImage() {}, globalAlpha: 1 }; }
  }
  const body = new Element('body'), doc = new Element('document'), viewport = new Element(), keyboard = new Element();
  doc.body = body; doc.hidden = false; doc.createElement = tag => new Element(tag);
  const walk = node => [node, ...node.children.flatMap(walk)];
  doc.getElementById = id => walk(body).find(node => node.id === id) ?? null;
  viewport.height = 723; viewport.offsetTop = 0; keyboard.boundingRect = { height: 0, y: 723 };
  return {
    doc,
    win: { visualViewport: viewport, navigator: { virtualKeyboard: keyboard } },
    find: predicate => walk(body).find(predicate),
    all: predicate => walk(body).filter(predicate),
    listenerCount: () => nodes.reduce((sum, node) => sum + [...node.listeners.values()].reduce((count, set) => count + set.size, 0), 0),
  };
}
const click = node => node.dispatchEvent(new Event('click'));
const dispatchComposition = (node, type) => node.dispatchEvent(new Event(type));
const dispatchKey = (node, key, extra = {}) => {
  const event = new Event('keydown', { cancelable: true });
  for (const [name, value] of Object.entries({ key, repeat: false, isComposing: false,
    ctrlKey: false, altKey: false, metaKey: false, ...extra })) Object.defineProperty(event, name, { value });
  node.dispatchEvent(event); return event;
};
const createHost = (d, options = {}) => createMiniGameHost({
  document: d.doc,
  window: d.win,
  collection: () => [],
  makeSessionId: () => 'kd-host',
  random: () => 0,
  loadImage: () => companionImage,
  reduced: () => false,
  ...options,
});
const choose = (d, host, enemy = host.inspect().session.enemies[0]) => {
  const node = d.all(candidate => candidate.dataset.enemyId).find(candidate => candidate.dataset.enemyId === enemy.enemyId);
  click(node); return host.inspect().session.selectedEnemy;
};
const answer = (d, host, value) => {
  const input = d.find(node => node.tagName === 'INPUT'); input.value = value;
  click(d.find(node => node.dataset.action === 'answer'));
};
const defeat = (d, host) => { const enemy = host.inspect().session.enemies[0]; choose(d, host, enemy); answer(d, host, readingFor(enemy)); };

test('registry and title expose the independent Flagship Definition', () => {
  assert.deepEqual(Object.keys(miniGameRegistry.kanjiDefense).sort(), ['create', 'createView', 'id', 'title']);
  assert.equal(miniGameRegistry.kanjiDefense.id, 'kanjiDefense'); assert.equal(miniGameRegistry.kanjiDefense.title, '漢字防衛隊');
  const title = fs.readFileSync('src/screens/titleScreen.js', 'utf8');
  assert.match(title, /titleKanjiDefenseButton/); assert.match(title, /'旗艦ゲーム：漢字防衛隊', 'kanjiDefense'/);
});
test('generic Host renders three-lane UI and first Monster without game-specific Host logic', () => {
  const d = dom(), host = createHost(d); host.enter({ gameId: 'kanjiDefense' });
  assert.ok(d.doc.getElementById('kanjiDefenseScreen')); assert.equal(host.inspect().session.gameId, 'kanjiDefense');
  assert.equal(d.all(node => node.dataset.lane !== undefined).length, 3); assert.equal(d.all(node => node.dataset.enemyId).length, 1);
  host.exit(); assert.equal(d.doc.body.children.length, 0);
});

test('pointer selection focuses kana input and a correct answer defeats the target', () => {
  const d = dom(), host = createHost(d); host.enter({ gameId: 'kanjiDefense' }); const enemy = host.inspect().session.enemies[0];
  choose(d, host, enemy); const input = d.find(node => node.tagName === 'INPUT'); assert.equal(input.focused, true);
  answer(d, host, readingFor(enemy)); assert.equal(host.inspect().session.correct, 1); assert.equal(host.inspect().session.resolved, 1);
  host.exit();
});

test('keyboard lane shortcut selects a target and Enter submits after composition', () => {
  const d = dom(), host = createHost(d); host.enter({ gameId: 'kanjiDefense' }); const enemy = host.inspect().session.enemies[0];
  dispatchKey(d.doc, String(enemy.lane + 1)); assert.equal(host.inspect().session.selectedEnemyId, enemy.enemyId);
  const input = d.find(node => node.tagName === 'INPUT'); input.value = readingFor(enemy); dispatchKey(input, 'Enter');
  assert.equal(host.inspect().session.correct, 1); host.exit();
});

test('IME composing Enter and repeated Enter never submit', () => {
  const d = dom(), host = createHost(d); host.enter({ gameId: 'kanjiDefense' }); const enemy = host.inspect().session.enemies[0]; choose(d, host, enemy);
  const input = d.find(node => node.tagName === 'INPUT'); input.value = readingFor(enemy); dispatchComposition(input, 'compositionstart');
  dispatchKey(input, 'Enter', { isComposing: true }); assert.equal(host.inspect().session.resolved, 0);
  dispatchComposition(input, 'compositionend'); dispatchKey(input, 'Enter', { repeat: true }); assert.equal(host.inspect().session.resolved, 0);
  dispatchKey(input, 'Enter'); assert.equal(host.inspect().session.resolved, 1); dispatchKey(input, 'Enter'); assert.equal(host.inspect().session.resolved, 1); host.exit();
});

test('wrong answer keeps Monster, shows hint, then retry succeeds', () => {
  const d = dom(), host = createHost(d); host.enter({ gameId: 'kanjiDefense' }); const enemy = host.inspect().session.enemies[0]; choose(d, host, enemy);
  answer(d, host, 'まちがい'); assert.equal(host.inspect().session.resolved, 0); assert.equal(host.inspect().session.life, 3);
  const feedback = d.find(node => node.className === 'kd-feedback'); assert.match(feedback.textContent, /もう一度/);
  answer(d, host, readingFor(enemy)); assert.equal(host.inspect().session.correct, 1); host.exit();
});

test('manual and visibility pause OR freezes movement and rejects input while preserving text', () => {
  const d = dom(), host = createHost(d); host.enter({ gameId: 'kanjiDefense' }); const enemy = host.inspect().session.enemies[0]; choose(d, host, enemy);
  const input = d.find(node => node.tagName === 'INPUT'); input.value = 'かんじ'; const before = host.inspect().session.enemies[0].progress;
  host.setPaused(true); d.doc.hidden = true; d.doc.dispatchEvent(new Event('visibilitychange')); host.update(1000);
  assert.equal(host.inspect().session.enemies[0].progress, before); assert.equal(input.value, 'かんじ'); assert.equal(input.disabled, true);
  d.doc.hidden = false; d.doc.dispatchEvent(new Event('visibilitychange')); assert.equal(host.inspect().session.paused, true);
  host.setPaused(false); assert.equal(host.inspect().session.paused, false); assert.equal(input.value, 'かんじ'); host.exit();
});

test('Act 3 UI renders at most three simultaneous Monster targets with priority labels', () => {
  const d = dom(), host = createHost(d); host.enter({ gameId: 'kanjiDefense' });
  for (let index = 0; index < 9; index++) { defeat(d, host); if (index < 8) host.update(800); }
  host.update(800); host.update(3700); host.update(3700);
  assert.equal(host.inspect().session.act, 3); assert.equal(host.inspect().session.enemies.length, 3);
  assert.equal(d.all(node => node.dataset.enemyId).length, 3);
  for (const node of d.all(candidate => candidate.dataset.enemyId)) assert.match(node['aria-label'], /(接近中|近い|危険)/);
  host.exit();
});

test('Monster image failure reveals text-safe fallback and gameplay remains active', () => {
  const d = dom(), host = createHost(d); host.enter({ gameId: 'kanjiDefense' });
  const image = d.find(node => node.tagName === 'IMG'); image.dispatchEvent(new Event('error'));
  const fallback = d.find(node => node.className === 'kd-fallback'); assert.equal(image.hidden, true); assert.equal(fallback.hidden, false);
  assert.equal(host.inspect().session.phase, 'playing'); host.exit();
});

test('Companion owned, unowned, failure and reduced motion remain display-only', async () => {
  const absent = createCompanionAdapter({ sessionId: 'kd', ownedMonsterIds: [], loadImage: () => companionImage });
  absent.observe({ sessionId: 'kd', seq: 1, type: 'correct' }); assert.equal(absent.inspect().hostCount, 0); absent.dispose();
  const owned = createCompanionAdapter({ sessionId: 'kd', ownedMonsterIds: ['HKD-E01'], loadImage: () => Promise.reject(Error('missing')) });
  await drain(); owned.observe({ sessionId: 'kd', seq: 1, type: 'problemPresented' }); owned.observe({ sessionId: 'kd', seq: 2, type: 'correct' }); owned.update(10, true);
  assert.equal(owned.inspect().action, 'attack'); assert.equal(owned.inspect().motion.imageState, 'failed'); owned.dispose();
});

test('twelve encounters render immutable result, strong/weak words and replay a new session', () => {
  const d = dom(); let serial = 0; const host = createHost(d, { makeSessionId: () => `kd-${++serial}` }); host.enter({ gameId: 'kanjiDefense' });
  for (let index = 0; index < 12; index++) { defeat(d, host); if (index < 11) host.update(800); }
  const first = host.inspect().session; assert.ok(first.result); assert.equal(first.result.strongWords.length, 12);
  const replay = d.find(node => node.dataset.action === 'replay'); click(replay); assert.equal(host.inspect().session.sessionId, 'kd-2');
  assert.equal(host.inspect().session.resolved, 0); assert.equal(d.all(node => node.dataset.enemyId).length, 1); host.exit();
});

test('Back exits through Host and removes input, listeners, Monster and Companion state', () => {
  const d = dom(); let backed = 0; const host = createHost(d, { onBack: () => { backed++; } }); host.enter({ gameId: 'kanjiDefense' });
  const oldEnemy = d.find(node => node.dataset.enemyId); click(d.find(node => node.dataset.action === 'back'));
  assert.equal(backed, 1); assert.equal(host.inspect().valid, false); assert.equal(d.doc.body.children.length, 0); assert.equal(d.listenerCount(), 0);
  click(oldEnemy); assert.equal(host.inspect().session, null);
});

test('repeated enter/exit leaves no DOM, listener, RAF or interval ownership', async t => {
  t.mock.method(globalThis, 'setInterval', () => { throw Error('interval forbidden'); });
  const previousRAF = globalThis.requestAnimationFrame; globalThis.requestAnimationFrame = () => { throw Error('RAF forbidden'); };
  t.after(() => { globalThis.requestAnimationFrame = previousRAF; });
  const d = dom(); let serial = 0; const host = createHost(d, { makeSessionId: () => `cycle-${++serial}`,
    collection: () => serial % 2 ? ['HKD-E01'] : [], loadImage: () => new Promise(() => {}) });
  for (let index = 0; index < 10; index++) {
    host.enter({ gameId: 'kanjiDefense' }); const oldButton = d.find(node => node.dataset.action === 'answer'); host.exit(); host.exit(); host.update(1000); await drain(); click(oldButton);
    assert.equal(host.inspect().session, null); assert.equal(host.inspect().companion, null); assert.equal(d.doc.body.children.length, 0); assert.equal(d.listenerCount(), 0);
  }
});

test('session performs no direct Storage write or deletion', t => {
  const storage = installStorage(); let writes = 0;
  t.mock.method(storage, 'setItem', () => { writes++; throw Error('Storage write forbidden'); });
  t.mock.method(storage, 'removeItem', () => { writes++; throw Error('Storage delete forbidden'); });
  const d = dom(), host = createHost(d); host.enter({ gameId: 'kanjiDefense' }); defeat(d, host); host.exit(); assert.equal(writes, 0);
});

test('responsive, focus, touch target, non-color and reduced-motion rules exist in production CSS', () => {
  const source = fs.readFileSync('src/minigames/kanjiDefense/kanjiDefenseView.js', 'utf8');
  assert.match(source, /min-width:44px;min-height:44px/); assert.match(source, /:focus-visible/);
  assert.match(source, /@media\(max-width:580px\)/); assert.match(source, /@media\(max-height:430px\)/);
  assert.match(source, /@media\(prefers-reduced-motion:reduce\)/); assert.match(source, /選択中/); assert.match(source, /危険/);
});
