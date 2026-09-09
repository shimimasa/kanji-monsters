import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const routes = new Map([
  ['/', 'tools/motion-01/index.html'],
  ...['demo.mjs', 'demo.css', 'bridges.mjs', 'legacy.mjs'].map(f => ['/' + f, 'tools/motion-01/' + f]),
  ...['motionProfile.js', 'motionTimeline.js', 'monsterMotionManifest.js', 'monsterRenderer.js',
    'monsterMotionHost.js'].map(f => ['/src/visuals/motion/' + f, 'src/visuals/motion/' + f]),
  ...['src/loaders/assetsLoader.js', 'src/core/idCanonicalizer.js', 'src/core/asyncDeadline.js', 'src/utils/monsterImagePaths.js']
    .map(f => ['/' + f, f]),
  ...['assets/images/monsters/full/grade1-hokkaido/HKD-E01.webp',
    'assets/images/backgrounds/hokkaido_area1.webp'].map(f => ['/' + f, 'public/' + f]),
]);
const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname, file = routes.get(path);
  res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!file || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); res.end(); return; }
  try {
    const data = await readFile(resolve(root, file));
    res.setHeader('Content-Type', file.endsWith('.webp') ? 'image/webp' : file.endsWith('.css') ?
      'text/css; charset=utf-8' : file.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8');
    res.writeHead(200); res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end(); }
});
server.listen(Number(process.env.MOTION_PORT || 49731), '127.0.0.1', () =>
  console.log('MOTION-01 standalone: http://127.0.0.1:' + server.address().port + '/'));
