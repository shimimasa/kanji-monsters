import { readFileSync, writeFileSync } from 'node:fs';
import { PROVERB_CASES } from '../../src/minigames/proverbDetective/proverbCases.js';
import { PROVERB_SPLITS } from '../../src/minigames/proverbDetective/proverbDetectiveGame.js';
import { proverbTarget } from '../../src/minigames/buildReview.js';
import { typeOf, typeInfo } from '../../src/minigames/gotomonTypes.js';
// Minimal CSV parser (quoted fields, BOM).
const csv = url => {
  const path = url;
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.slice(1).filter(r => r.length > 1);
};
const pad = (n, w) => String(n).padStart(w, '0');
const reading = csv(new URL('../../docs/photo-rally-reading-check.csv', import.meta.url)).map((r, i) => ({ id: `r-${pad(i + 1, 3)}`, grade: +r[0], kanji: r[1], reading: r[2], sentence: r[3], stages: r[4] }));
const hints = csv(new URL('../../docs/delivery-hints-check.csv', import.meta.url)).map((r, i) => ({ id: `h-${pad(i + 1, 3)}`, pref: r[0], name: r[1], hint: r[3], home: r[4], fact: r[5] }));
const parts = csv(new URL('../../docs/kanji-parts-check.csv', import.meta.url)).map((r, i) => ({ id: `k-${pad(i + 1, 2)}`, kanji: r[0], a: r[1], b: r[2], layout: r[3], reading: r[4], grade: +r[5] }));
const proverbs = PROVERB_CASES.map((p, i) => {
  const t = proverbTarget({ text: p.text, reading: p.reading, split: PROVERB_SPLITS[p.id] });
  let k = 0; const letters = [...t.answer];
  const frame = t.frame.map(part => part.kana ? { kana: part.kana } : { kanji: part.kanji, yomi: letters.slice(k, k += part.size).join('') });
  return { id: `p-${pad(i + 1, 2)}`, caseId: p.id, text: p.text, reading: p.reading, frame, byHand: !!PROVERB_SPLITS[p.id] };
});
// タイプ分け: every Gotomon once (the data files overlap), in id order so the ids stay put.
const monsters = new Map();
for (const file of ['enemies_proto', 'enemies_legend', 'enemy_world']) {
  for (const m of JSON.parse(readFileSync(new URL(`../../public/data/${file}.json`, import.meta.url), 'utf8')).flat(Infinity)) if (m?.id && !monsters.has(m.id)) monsters.set(m.id, m);
}
const types = [...monsters.values()].sort((a, b) => a.id.localeCompare(b.id)).map((m, i) => ({ id: `t-${pad(i + 1, 4)}`, mid: m.id, name: m.name, pref: m.prefecture ?? '',
  category: m.category ?? '', type: typeInfo(typeOf(m)).name, color: typeInfo(typeOf(m)).color, desc: String(m.desc ?? '').slice(0, 60) }));
const data = { reading, hints, parts, proverbs, types };
writeFileSync(new URL('./data.json', import.meta.url), JSON.stringify(data));
console.log(reading.length, hints.length, parts.length, proverbs.length, types.length, JSON.stringify(data).length);
console.log(JSON.stringify(reading[0]), JSON.stringify(hints[0]), JSON.stringify(parts[0]), JSON.stringify(proverbs[10]));
