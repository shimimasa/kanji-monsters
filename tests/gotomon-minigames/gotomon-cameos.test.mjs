import test from 'node:test';
import assert from 'node:assert/strict';
import { miniGameRegistry } from '../../src/minigames/registry.js';
import { createBingoView } from '../../src/minigames/kanjiBingo/bingoView.js';
import { BINGO_LINES } from '../../src/minigames/kanjiBingo/bingoContent.js';

// A minimal DOM: enough for the arcade views, nothing more.
function fakeDocument() {
  class Element extends EventTarget {
    constructor(tag = '') {
      super(); this.tagName = tag.toUpperCase(); this.children = []; this.style = { setProperty() {} }; this.dataset = {};
      this.hidden = false; this.disabled = false; this.parent = null; this.textContent = ''; this.className = ''; this.attributes = {};
    }
    append(...items) { for (const item of items) { if (typeof item === 'object') { this.children.push(item); item.parent = this; } } }
    prepend(...items) { this.append(...items); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(item => item !== this); this.parent = null; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    focus() {}
  }
  const doc = new EventTarget(); doc.body = new Element('body');
  doc.createElement = tag => new Element(tag);
  return doc;
}
const all = node => [node, ...node.children.flatMap(all)];
const cast = Object.freeze({ friends: [{ id: 'f', name: 'フレンド', imageUrl: 'f.webp' }],
  wild: [{ id: 'w1', name: 'ワイルド1', imageUrl: 'w1.webp' }, { id: 'w2', name: 'ワイルド2', imageUrl: 'w2.webp' }], boss: { id: 'b', name: 'ボス', imageUrl: 'b.webp' } });

test('every view accepts a Gotomon cast, and plays on without one', () => {
  for (const [id, definition] of Object.entries(miniGameRegistry)) {
    for (const given of [cast, undefined]) {
      const doc = fakeDocument();
      const view = definition.createView({ document: doc, dispatch: () => false, onBack() {}, onReplay() {}, getSnapshot: () => ({}), cast: given });
      assert.ok(view.root, id);
      view.dispose?.();
    }
  }
});

test('a bingo line earns a Gotomon sticker on that line', () => {
  const doc = fakeDocument();
  const card = Array.from({ length: 16 }, (_, i) => ({ cellId: `c${i}`, kanji: '山' }));
  const base = { sessionId: 's', card, marked: Array(16).fill(null), lines: [], phase: 'answering', paused: false, stampArmed: false, stamps: 0, calls: { made: 1, total: 10 },
    problem: { problemId: 'p', cellId: 'c0', kind: 'reading', clue: { before: '', reading: 'やま', after: '' } }, seq: 1, answered: 0 };
  const view = createBingoView({ document: doc, dispatch: () => false, onBack() {}, getSnapshot: () => base, cast });
  view.update(base);
  assert.equal(all(doc.body).filter(node => node.className === 'kb-sticker').length, 0);
  const marked = Array(16).fill(null); for (const i of BINGO_LINES[0]) marked[i] = 'call';
  view.update({ ...base, marked, lines: [0], seq: 2 });
  const stickers = all(doc.body).filter(node => node.className === 'kb-sticker');
  assert.equal(stickers.length, 1);
  assert.equal(stickers[0].children[0].src, 'w1.webp');
  view.update({ ...base, marked, lines: [0], seq: 3 });
  assert.equal(all(doc.body).filter(node => node.className === 'kb-sticker').length, 1, 'one sticker per line');
});
