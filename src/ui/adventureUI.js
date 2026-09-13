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
  return frame;
}
export function isolateScreen(doc, root) {
  const others = [...doc.body.children].filter(node => node !== root && node.tagName !== 'SCRIPT');
  const original = others.map(node => node.inert);
  others.forEach(node => { node.inert = true; });
  return () => others.forEach((node, i) => { node.inert = original[i]; });
}
