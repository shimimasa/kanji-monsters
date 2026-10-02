export function element(doc, tag, className = '', text = '') {
  const node = doc.createElement(tag); node.className = className; node.textContent = text; return node;
}
export function button(doc, text, action, className = '') {
  const node = element(doc, 'button', className, text); node.type = 'button'; node.onclick = action; return node;
}
export function companionPortrait(doc, gotomon, className = '') {
  const frame = element(doc, 'span', `gt-portrait ${className}`);
  const fallback = element(doc, 'span', 'gt-image-fallback', gotomon?.name || '相棒');
  fallback.hidden = !!gotomon?.imageUrl; frame.append(fallback);
  if (gotomon?.imageUrl) {
    const img = element(doc, 'img'); img.src = gotomon.imageUrl; img.alt = gotomon.name; img.loading = 'lazy';
    img.onerror = () => { img.hidden = true; fallback.hidden = false; }; frame.append(img);
  }
  if (gotomon?.outfit?.length) dress(doc, frame, gotomon.outfit);
  return frame;
}

// きせかえ over the picture: an SVG layer that scales with the picture wherever it is drawn
// (a cape behind it, the rest in front; an aura glows around it). Items come from companionOutfits.
const OUTFIT_DRAW = {
  ribbon: { x: 74, y: 22, size: 26 }, flowers: { x: 50, y: 15, size: 30 }, hat: { x: 50, y: 14, size: 40 },
  scholar: { x: 50, y: 12, size: 40 }, crown: { x: 50, y: 10, size: 38 },
  glasses: { x: 50, y: 50, size: 30 }, headphones: { x: 50, y: 36, size: 56 },
  sparkle: [{ x: 14, y: 24, size: 18 }, { x: 88, y: 66, size: 15 }, { x: 80, y: 14, size: 12 }],
};
function dress(doc, frame, items) {
  if (!doc.createElementNS) return;
  const ns = 'http://www.w3.org/2000/svg';
  const layer = name => { const svg = doc.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('class', `gt-outfit ${name}`); svg.setAttribute('aria-hidden', 'true'); return svg; };
  const back = layer('gt-outfit-back'), front = layer('gt-outfit-front');
  const text = (svg, icon, { x, y, size }) => {
    const node = doc.createElementNS(ns, 'text');
    node.setAttribute('x', String(x)); node.setAttribute('y', String(y)); node.setAttribute('font-size', String(size));
    node.setAttribute('text-anchor', 'middle'); node.setAttribute('dominant-baseline', 'central'); node.textContent = icon; svg.append(node);
  };
  for (const item of items) {
    frame.dataset[item.slot] = item.id;
    if (item.id === 'cape') {
      const cape = doc.createElementNS(ns, 'path');
      cape.setAttribute('d', 'M32 38 Q50 30 68 38 L84 94 Q50 102 16 94 Z'); cape.setAttribute('fill', '#d62839'); cape.setAttribute('stroke', '#8a1424'); cape.setAttribute('stroke-width', '2');
      back.append(cape); continue;
    }
    if (item.id === 'rainbow') {
      // A rainbow arch behind the companion (the emoji itself is drawn slanted).
      ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'].forEach((color, i) => {
        const arc = doc.createElementNS(ns, 'path'), r = 46 - i * 4;
        arc.setAttribute('d', `M${50 - r} 66 A${r} ${r} 0 0 1 ${50 + r} 66`); arc.setAttribute('fill', 'none');
        arc.setAttribute('stroke', color); arc.setAttribute('stroke-width', '4'); back.append(arc);
      });
      continue;
    }
    const draw = OUTFIT_DRAW[item.id];
    if (!draw) continue;
    for (const spot of [].concat(draw)) text(spot.back ? back : front, item.icon, spot);
  }
  frame.classList.add('gt-dressed');
  frame.prepend(back); frame.append(front);
}
export function isolateScreen(doc, root) {
  const others = [...doc.body.children].filter(node => node !== root && node.tagName !== 'SCRIPT');
  const original = others.map(node => node.inert);
  others.forEach(node => { node.inert = true; });
  return () => others.forEach((node, i) => { node.inert = original[i]; });
}
