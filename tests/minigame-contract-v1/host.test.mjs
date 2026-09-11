import test from 'node:test';
import assert from 'node:assert/strict';
import { createMiniGameHost } from '../../src/minigames/miniGameHost.js';
import { miniGameRegistry } from '../../src/minigames/registry.js';

function environment() {
  const nodes = [];
  class Element extends EventTarget {
    constructor(tag = '') {
      super(); this.tagName = tag.toUpperCase(); this.children = []; this.style = {}; this.dataset = {};
      this.value = ''; this.hidden = false; this.disabled = false; this.inert = false; this.parent = null;
      this.textContent = ''; this.className = ''; nodes.push(this);
    }
    append(...items) { for (const item of items) { this.children.push(item); item.parent = this; } }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(item => item !== this); this.parent = null; }
    setAttribute(name, value) { this[name] = String(value); }
    focus() {}
    getContext() { return this.tagName === 'CANVAS' ? { clearRect() {}, save() {}, restore() {},
      translate() {}, scale() {}, rotate() {}, drawImage() {}, fillRect() {}, beginPath() {},
      arc() {}, fill() {}, stroke() {}, moveTo() {}, lineTo() {}, closePath() {},
      set globalAlpha(_) {}, set fillStyle(_) {}, set strokeStyle(_) {}, set lineWidth(_) {} } : null; }
  }
  const doc = new EventTarget(); doc.hidden = false; doc.body = new Element('body');
  doc.createElement = tag => new Element(tag);
  const viewport = new EventTarget(); Object.assign(viewport, { height: 800, offsetTop: 0 });
  const keyboard = new EventTarget(); keyboard.boundingRect = { height: 0, y: 800 };
  const win = { visualViewport: viewport, navigator: { virtualKeyboard: keyboard } };
  return { doc, win, nodes };
}

function companionFactory(counters) {
  return () => ({
    observe() {}, update() {}, present() {},
    inspect: () => ({ selected: null, motion: null }),
    dispose() { counters.companionDisposals++; },
  });
}

test('Host updates exactly once after an accepted command and never interprets its type', () => {
  const { doc, win } = environment(); const counters = { companionDisposals: 0 };
  let dispatch, updates = 0;
  const makeView = context => {
    dispatch = context.dispatch; const root = doc.createElement('section'); doc.body.append(root);
    return { root, update() { updates++; }, stopInput() {}, dispose() { root.remove(); } };
  };
  const host = createMiniGameHost({ document: doc, window: win, collection: () => [],
    makeSessionId: () => 'host-sprint', random: () => 0.25,
    makeCompanion: companionFactory(counters), makeView });
  host.enter({ gameId: 'mathSprint' }); updates = 0;
  assert.equal(dispatch({ type: 'unknown' }), false); assert.equal(updates, 0);
  const first = host.inspect().session;
  assert.equal(dispatch({ type: 'submit', payload: {
    sessionId: first.sessionId, token: first.token, value: first.problem.answer,
  } }), true); assert.equal(updates, 1);
  assert.equal(dispatch({ type: 'submit', payload: {
    sessionId: first.sessionId, token: first.token, value: first.problem.answer,
  } }), false); assert.equal(updates, 1);
  const feedback = host.inspect().session;
  assert.equal(dispatch({ type: 'next', payload: {
    sessionId: feedback.sessionId, problemId: feedback.problem.problemId,
  } }), true); assert.equal(updates, 2);
  host.exit(); assert.equal(dispatch({ type: 'unknown' }), false); assert.equal(updates, 2);
  assert.equal(counters.companionDisposals, 1);
});

test('one Host enters both games, composes external pause, and rejects an old session port', () => {
  const { doc, win } = environment(); const counters = { companionDisposals: 0 };
  const ports = [], views = [];
  const makeView = context => {
    ports.push(context.dispatch); const root = doc.createElement('section'); doc.body.append(root);
    const view = { root, stops: 0, disposals: 0, update() {}, stopInput() { this.stops++; },
      dispose() { this.disposals++; root.remove(); } }; views.push(view); return view;
  };
  let serial = 0;
  const host = createMiniGameHost({ document: doc, window: win, collection: () => [],
    makeSessionId: () => `host-${++serial}`, random: () => 0.25,
    makeCompanion: companionFactory(counters), makeView });
  host.enter({ gameId: 'mathSprint' }); const oldPort = ports[0];
  host.enter({ gameId: 'mathInvader' });
  assert.equal(views[0].stops, 1); assert.equal(views[0].disposals, 1);
  assert.equal(oldPort({ type: 'unknown' }), false);
  host.setPaused(true); assert.equal(host.inspect().session.paused, true);
  doc.hidden = true; doc.dispatchEvent(new Event('visibilitychange'));
  host.setPaused(false); assert.equal(host.inspect().session.paused, true);
  doc.hidden = false; doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(host.inspect().session.paused, false);
  const enemy = host.inspect().session.enemies[0];
  assert.equal(ports[1]({ type: 'select', payload: { sessionId: 'host-2',
    enemyId: enemy.enemyId, problemId: enemy.problemId } }), true);
  host.exit(); host.exit();
  assert.equal(views[1].stops, 1); assert.equal(views[1].disposals, 1);
  assert.equal(counters.companionDisposals, 2); assert.equal(host.inspect().listeners, 0);
});

test('both registry views retain the v1 return contract behind thin callback adapters', () => {
  for (const id of Object.keys(miniGameRegistry)) {
    const { doc } = environment(); const game = miniGameRegistry[id].create({
      sessionId: `${id}-view`, random: () => 0.25, onEvent: () => {},
    });
    game.enter();
    const view = miniGameRegistry[id].createView({ document: doc, getSnapshot: game.snapshot,
      dispatch: command => game.dispatch(command), onBack() {}, onReplay() {} });
    assert.ok(view.root); assert.equal(typeof view.update, 'function');
    assert.equal(typeof view.stopInput, 'function'); assert.equal(typeof view.dispose, 'function');
    assert.ok(!Object.hasOwn(view, 'canvas') || view.canvas);
    view.update(game.snapshot(), { selected: null, motion: null });
    view.stopInput(); view.dispose(); view.dispose(); game.exit();
  }
});
