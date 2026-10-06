// Import the two Elementgirl lessons while keeping their story, interaction and SVG.
// Usage: node scripts/one-off/import-elementgirl-pilot.mjs PATH_TO_SOURCE_REPO
// Initial source revision: 25ae109a36c166e3395c540e85b30f0dfbaa02aa
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const source = resolve(process.argv[2]);
const target = resolve('public/lessons/elementgirl');
const images = resolve('public/assets/images/monsters/full/lesson');
mkdirSync(target, { recursive: true });
mkdirSync(images, { recursive: true });

for (const [slug, id] of [['kururu', 'EL-001'], ['hitotsubu', 'EL-002']]) {
  let html = readFileSync(join(source, `${slug}.html`), 'utf8').replace(/\r\n/g, '\n');
  const mascot = html.match(/<svg class="mascot"[^>]*>[\s\S]*?<\/svg>/)?.[0];
  if (!mascot) throw new Error(`Missing mascot: ${slug}`);
  writeFileSync(join(images, `${id}.svg`), mascot.replace('class="mascot"', 'xmlns="http://www.w3.org/2000/svg"') + '\n');
  for (const dependency of ['auth.js', 'orientation-guard.js', 'profile.js', 'progress.js']) {
    const line = `<script src="${dependency}"></script>\n`;
    if (!html.includes(line)) throw new Error(`Missing ${dependency}: ${slug}`);
    html = html.replace(line, '');
  }
  html = html.replace('<meta name="viewport"', '<script src="lesson-bridge.js"></script>\n<meta name="viewport"');
  html = html.replace('</style>\n</head>', '</style>\n<link rel="stylesheet" href="lesson-mobile.css">\n</head>');
  html = html.replace(/<a href="index.html" class="backHome"[^>]*>.*?<\/a>\n/, '');
  html = html.replace("$('tbReset').onclick = () => { if (confirm('さいしょから やりなおしますか？')) location.reload(); };", "$('tbReset').onclick = () => location.reload();");
  html = html.replaceAll("sHmm();\n        say(`ちがうよ。もういちど かんがえてみよう。`);",
    "say(`ヒントを もういちど 見て、いっしょに かんがえよう。`);");
  html = html.replace("if (which === 'A') {\n        sHmm();", "if (which === 'A') {");
  html = html.replace('  sound: true,', "  sound: Number(localStorage.getItem('seVolume') ?? 0.8) > 0,");
  html = html.replace('  g.gain.linearRampToValueAtTime(vol || 0.12, t0 + 0.02);',
    "  const savedVolume = Number(localStorage.getItem('seVolume') ?? 0.8);\n  const lessonVolume = Number.isFinite(savedVolume) ? Math.max(0, Math.min(1, savedVolume)) : 0.8;\n  g.gain.linearRampToValueAtTime((vol || 0.12) * lessonVolume, t0 + 0.02);");
  html = html.replace("const qsStep = new URLSearchParams(location.search).get('step');\ngotoStep(Math.max(0, FLOW.indexOf(qsStep)));", 'gotoStep(0);');
  const marker = '  ending: {\n    enter() {\n';
  if (html.split(marker).length !== 2) throw new Error(`Missing ending: ${slug}`);
  html = html.replace(marker, marker + '      window.yomitabiLessonComplete?.(S.badges.size, 5);\n');
  writeFileSync(join(target, `${slug}.html`), html);

  let sheet = readFileSync(join(source, `${slug}-sheet.html`), 'utf8').replace(/\r\n/g, '\n');
  sheet = sheet.replace('<script src="auth.js"></script>\n', '');
  sheet = sheet.replace(/  <a href=".*?" class="backHomeSheet">.*?<\/a>\n/g, '');
  writeFileSync(join(target, `${slug}-sheet.html`), sheet);
}
console.log('Imported 2 lessons, 2 printable sheets and 2 SVG mascots');
