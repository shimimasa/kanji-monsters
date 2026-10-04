import test from 'node:test';
import assert from 'node:assert/strict';
import { subscribe } from '../../src/core/eventBus.js';
import { gameState } from '../../src/core/gameState.js';
import { openLeaveConfirm, closeLeaveConfirm, isLeaveConfirmOpen } from '../../src/screens/battle/leaveConfirm.js';

// バトルの「もどる」は、1タップで地図へ行かず「ちずに もどる？」で確かめる（2026-10-04）。

// 必要なところだけの 小さな DOM
function fakeDocument() {
  const listeners = {};
  const make = (tag) => {
    const node = { tagName: tag, style: {}, children: [], attrs: {}, handlers: {}, textContent: '', id: '' };
    node.setAttribute = (k, v) => { node.attrs[k] = v; };
    node.append = (...kids) => { for (const k of kids) { k.parent = node; node.children.push(k); } };
    node.addEventListener = (type, fn) => { (node.handlers[type] ||= []).push(fn); };
    node.remove = () => { if (node.parent) node.parent.children = node.parent.children.filter(c => c !== node); node.parent = null; };
    node.focus = () => { doc.activeElement = node; };
    node.click = () => (node.handlers.click || []).forEach(fn => fn({ target: node, stopPropagation() {} }));
    node.ownerDocument = doc;
    return node;
  };
  const doc = {
    body: null, activeElement: null, createElement: make,
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
    removeEventListener: (type, fn) => { listeners[type] = (listeners[type] || []).filter(f => f !== fn); },
    key: (key) => (listeners.keydown || []).forEach(fn => fn({ key, preventDefault() {} })),
  };
  doc.body = make('body');
  doc.find = (id, node = doc.body) => node.id === id ? node : node.children.map(c => doc.find(id, c)).find(Boolean);
  doc.text = (node = doc.body) => node.textContent + node.children.map(c => doc.text(c)).join('');
  return doc;
}

const screens = [];
subscribe('changeScreen', s => screens.push(s));

test('もどる asks first; つづける stays in the battle and ちずに もどる goes to the map', () => {
  const doc = fakeDocument();
  gameState.currentStageId = 'hokkaido_area1'; gameState.previousScreen = 'stageSelect'; gameState.stageProgress = {};
  screens.length = 0;
  openLeaveConfirm(doc);
  assert.ok(isLeaveConfirmOpen());
  assert.match(doc.text(), /ちずに もどる？/);
  assert.match(doc.text(), /はじめから/, 'no flag yet: the stage starts over');
  assert.match(doc.text(), /よめた かんじは ちゃんと のこっている/);
  assert.equal(doc.activeElement?.id, 'battleLeaveStay', 'the safe choice has the focus');
  doc.find('battleLeaveStay').click();
  assert.equal(isLeaveConfirmOpen(), false);
  assert.deepEqual(screens, [], 'つづける does not leave');

  openLeaveConfirm(doc);
  doc.find('battleLeaveGo').click();
  assert.equal(isLeaveConfirmOpen(), false);
  assert.deepEqual(screens, ['stageSelect']);
});

test('the world battle goes back to the world map, and the flag message shows after 5 defeated', () => {
  const doc = fakeDocument();
  gameState.currentStageId = 'europe_area1'; gameState.previousScreen = 'worldStageSelect';
  gameState.stageProgress = { europe_area1: { checkpoint: 5 } };
  screens.length = 0;
  openLeaveConfirm(doc);
  assert.match(doc.text(), /はたの ところから/);
  doc.find('battleLeaveGo').click();
  assert.deepEqual(screens, ['worldStageSelect']);
});

test('Escape and leaving the screen close it without leaving', () => {
  const doc = fakeDocument();
  screens.length = 0;
  openLeaveConfirm(doc);
  doc.key('Escape');
  assert.equal(isLeaveConfirmOpen(), false);
  openLeaveConfirm(doc);
  closeLeaveConfirm();
  assert.equal(isLeaveConfirmOpen(), false);
  assert.equal(doc.body.children.length, 0);
  assert.deepEqual(screens, []);
});
