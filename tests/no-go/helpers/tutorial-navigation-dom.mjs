// DOM boundary for lifecycle tests. Runs real screen/guide DOM construction;
// it does not model browser layout, hit testing, or parse innerHTML markup.
export function element(tag = 'div') {
  const el = Object.assign(new EventTarget(), {
    tagName: tag.toUpperCase(), value: '', children: [], dataset: {}, className: '',
    style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
    focus() {}, blur() {},
    setAttribute(k, v) {
      if (k === 'class') this.className = String(v);
      else if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(v);
      else this[k] = String(v);
    },
    getAttribute(k) { return k === 'class' ? this.className : this[k] ?? null; },
    removeAttribute(k) { delete this[k]; },
    appendChild(child) { child.remove(); this.children.push(child); child.parentElement = this; return child; },
    append(...children) { children.forEach(child => this.appendChild(child)); },
    removeChild(child) { this.children = this.children.filter(c => c !== child); child.parentElement = null; },
    remove() { this.parentElement?.removeChild(this); },
    insertBefore(child, before) {
      child.remove(); const index = this.children.indexOf(before);
      if (index < 0) throw Error('Missing insertBefore reference');
      this.children.splice(index, 0, child); child.parentElement = this; return child;
    },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    querySelectorAll(selector) {
      const descendants = node => node.children.flatMap(c => [c, ...descendants(c)]);
      return descendants(this).filter(node => matches(node, selector));
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 48 }),
  });
  el.classList = {
    contains: k => el.className.split(/\s+/).includes(k),
    add: (...keys) => { el.className = [...new Set([...el.className.split(/\s+/).filter(Boolean), ...keys])].join(' '); },
    remove: (...keys) => { el.className = el.className.split(/\s+/).filter(k => !keys.includes(k)).join(' '); },
  };
  let html = '';
  Object.defineProperties(el, {
    innerHTML: { get: () => html, set: value => { html = String(value); for (const c of [...el.children]) c.remove(); } },
    firstElementChild: { get: () => el.children[0] || null },
    parentNode: { get: () => el.parentElement },
  });
  return el;
}

function simple(node, selector) {
  const nth = selector.match(/:nth-of-type\((\d+)\)/);
  if (nth) {
    if (node.parentElement?.children.filter(c => c.tagName === node.tagName).indexOf(node) !== Number(nth[1]) - 1) return false;
    selector = selector.replace(nth[0], '');
  }
  const tag = selector.match(/^[a-z][\w-]*/i)?.[0];
  if (tag && node.tagName !== tag.toUpperCase()) return false;
  const id = selector.match(/#([\w-]+)/)?.[1];
  if (id && node.id !== id) return false;
  return [...selector.matchAll(/\.([\w-]+)/g)].every(([, name]) => node.classList.contains(name));
}
function matches(node, selector) {
  const parts = selector.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/);
  if (!simple(node, parts.pop())) return false;
  while (parts.length) {
    const direct = parts.at(-1) === '>';
    if (direct) parts.pop();
    const part = parts.pop(); node = node.parentElement;
    while (node && !simple(node, part) && !direct) node = node.parentElement;
    if (!node || !simple(node, part)) return false;
  }
  return true;
}
