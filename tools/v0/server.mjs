import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, appendFile, stat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { args, BASELINE, TAG, git, hash, canonical, baselineCore, inside } from '../experiment/common.mjs';

export function makeCsp(html) {
  const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(m => !/\bsrc\s*=/i.test(m[1])).map(m => "'sha256-" + Buffer.from(hash(m[2]), 'hex').toString('base64') + "'");
  return ["default-src 'self'", "script-src 'self' " + hashes.join(' '), "connect-src 'self'",
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:", "media-src 'self' data: blob:",
    "font-src 'self'", "worker-src 'none'", "object-src 'none'", "frame-src 'none'", "frame-ancestors 'none'",
    "base-uri 'none'", "form-action 'none'"].join('; ');
}
export function safeRequestPath(url) {
  const decoded = decodeURIComponent(url.split('?')[0]);
  if (!decoded.startsWith('/') || decoded.includes('\\') || decoded.includes('\0') || decoded.split('/').some(p => p === '..' || p.startsWith('.'))) throw Error('Invalid path');
  return decoded;
}
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json',
  '.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon',
  '.mp3':'audio/mpeg','.m4a':'audio/mp4','.ogg':'audio/ogg','.wav':'audio/wav','.woff2':'font/woff2' };
async function treeFingerprint(root) {
  const entries = {};
  async function visit(dir) { for (const e of await readdir(dir,{withFileTypes:true})) {
    const name = path.join(dir,e.name);
    if (e.isDirectory()) await visit(name);
    else { const safe = await inside(root,path.relative(root,name)); entries[path.relative(root,name).replaceAll('\\','/')] = hash(await readFile(safe)); }
  } }
  await visit(root); return { files:Object.keys(entries).length, sha256:hash(canonical(entries)), entries };
}
async function body(req) {
  let data = ''; for await (const chunk of req) { data += chunk; if (data.length > 16000) throw Error('Body too large'); }
  return JSON.parse(data);
}
export async function startLab(options) {
  const run = path.resolve(options.run), base = path.resolve(options.baseline), experiment = path.resolve(options.experiment);
  const core = await baselineCore(base);
  if (git(experiment,'branch','--show-current') !== 'experiment/3d-vertical-slice') throw Error('Wrong experiment branch');
  if (git(experiment,'rev-parse',`${TAG}^{}`) !== BASELINE) throw Error('Stable tag mismatch');
  git(experiment,'merge-base','--is-ancestor',BASELINE,'HEAD');

  const changed=git(experiment,'diff','--name-only',BASELINE,'--','src','public','package.json','package-lock.json','index.html','style.css','vite.config.js','firebase.json','vercel.json').split('\n').filter(Boolean);
  const allowed=new Set(['src/screens/battleScreen.js','style.css','package.json','package-lock.json']);
  if(changed.some(p=>!allowed.has(p)&&!p.startsWith('src/visuals/'))) throw Error('STOP V0 protected source changes: '+changed);

  const fixture = JSON.parse(await readFile(path.join(run,'fixture.json'),'utf8'));
  const validation = JSON.parse(await readFile(path.join(run,'validator-manifest.json'),'utf8'));
  if (fixture.manifest.baselineSHA !== BASELINE || canonical(core) !== canonical(fixture.manifest.modules) || fixture.manifest.fixtureHash !== hash(canonical(fixture.entries))) throw Error('Fixture provenance/hash mismatch');
  if (canonical(validation.modules) !== canonical(core) || validation.sha256 !== hash(await readFile(path.join(run,'save-validator.js')))) throw Error('Validator mismatch');
  const fresh = JSON.parse(fixture.entries.krb_save);
  if (fresh.player.name !== '' || Object.keys(fresh.player.study.answers).length || fresh.player.study.reviewQueue.length || fresh.player.progress.currentStage || fresh.player.progress.clearedStages.length || fresh.player.coreStats.totalCorrect || fresh.player.coreStats.totalIncorrect) throw Error('STOP fixture is not fresh default');
  const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../experiment');
  const servers = [], receiver = { received:0 }, startTime = new Date().toISOString();
  const evidence = { startTime, baseline:BASELINE, fixtureHash:fixture.manifest.fixtureHash, roles:[] };
  const log = async entry => appendFile(path.join(run,'server-events.jsonl'),JSON.stringify({ at:new Date().toISOString(),...entry })+'\n');
  const listen = server => new Promise((resolve,reject) => { server.once('error',reject); server.once('listening',resolve); });
  try {
    const canary = http.createServer((req,res) => { receiver.received++; res.writeHead(200); res.end('canary'); });
    servers.push(canary); const ready = listen(canary); canary.listen(49723,'127.0.0.1'); await ready;
    for (const [role,root,port] of [['baseline',base,49721],['experiment',experiment,49722]]) {
      const dist = await inside(root,'dist');
      const html = await readFile(path.join(dist,'index.html'),'utf8');
      const csp = makeCsp(html), origin = `http://127.0.0.1:${port}`, sha = git(root,'rev-parse','HEAD');
      const build = await treeFingerprint(dist);
      await writeFile(path.join(run,`build-${role}-manifest.json`),JSON.stringify(build,null,2));
      const info = { role,origin,sha,baseline:BASELINE,fixtureHash:fixture.manifest.fixtureHash,receiver:'http://127.0.0.1:49723',buildHash:build.sha256 };
      evidence.roles.push({ ...info,root,dist,csp,files:build.files });
      const sessions = new Map();
      const server = http.createServer(async (req,res) => {
        res.setHeader('Content-Security-Policy',csp); res.setHeader('X-Yomitabi-E0',role);
        res.setHeader('X-Yomitabi-Commit',sha); res.setHeader('Cache-Control','no-store');
        res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Referrer-Policy','no-referrer');
        const send = (status,data,type='application/json') => { res.writeHead(status,{'Content-Type':type}); res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data)); };
        try {
          if (req.headers.host !== `127.0.0.1:${port}`) return send(403,{error:'Host rejected'});
          const route = safeRequestPath(req.url);
          let token = /(?:^|;\s*)e0_session=([a-f0-9]+)/.exec(req.headers.cookie || '')?.[1];
          let session = sessions.get(token);
          if (route === '/__experiment/setup' && req.method === 'GET') {
            if (!session) { token = randomBytes(24).toString('hex'); session={preflight:false,armed:false}; sessions.set(token,session);
              res.setHeader('Set-Cookie',`e0_session=${token}; HttpOnly; SameSite=Strict; Path=/`); }
            return send(200,await readFile(path.join(toolRoot,'setup.html')),'text/html; charset=utf-8');
          }
          if (req.method === 'POST') {
            if (!session || req.headers.origin !== origin || req.headers['content-type'] !== 'application/json') return send(403,{error:'Origin/session rejected'});
            const data = await body(req);
            if (route === '/__experiment/preflight') {
              if (data.sameOrigin !== 200 || !data.refused || receiver.received !== 0 || !data.violations?.some(v=>v.directive==='connect-src' && v.disposition==='enforce' && v.blockedURI.startsWith(info.receiver))) return send(409,{error:'Isolation proof rejected'});
              session.preflight = true; await log({role,event:'preflight',proof:data}); return send(200,{ok:true});
            }
            if (route === '/__experiment/arm' && session.preflight && receiver.received === 0 && data.fixtureHash === info.fixtureHash && data.valid === true && data.keyCount === fixture.manifest.keyCount) {
              session.armed = true; await log({role,event:'fixture-readback',proof:data}); return send(200,{ok:true});
            }
            return send(403,{error:'Not armed'});
          }
          if (!['GET','HEAD'].includes(req.method)) return send(405,{error:'Method rejected'});
          const routes = {
            '/__experiment/setup.js':path.join(toolRoot,'setup.js'),
            '/__experiment/save-validator.js':path.join(run,'save-validator.js')
          };
          if (routes[route]) return send(200,await readFile(routes[route]),'text/javascript; charset=utf-8');
          if (route === '/__experiment/info') return send(200,info);
          if (route === '/__experiment/ping') return send(200,{ok:true});
          if (route === '/__experiment/receiver-status') return send(200,receiver);
          if (route === '/__experiment/fixture' && session?.preflight) return send(200,fixture);
          if (route.startsWith('/__experiment/')) return send(404,{error:'Unknown tool route'});
          if (!session?.armed) return send(403,{error:'STOP: use /__experiment/setup in a NEW dedicated profile first'});
          const file = await inside(dist, route === '/' ? 'index.html' : route.slice(1));
          if (!(await stat(file)).isFile()) return send(404,{error:'Not a file'});
          return send(200,await readFile(file),mime[path.extname(file).toLowerCase()] || 'application/octet-stream');
        } catch(e) { if (!res.headersSent) send(400,{error:e.message}); else res.destroy(); }
      });
      servers.push(server); const ready = listen(server); server.listen(port,'127.0.0.1'); await ready;
    }
    await writeFile(path.join(run,'server-manifest.json'),JSON.stringify(evidence,null,2));
    console.log(JSON.stringify({ready:true,...evidence},null,2));
    return { servers,receiver, close:()=>Promise.all(servers.map(s=>new Promise(resolve=>s.close(resolve)))) };
  } catch(e) { for (const s of servers) s.close(); throw e; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = args(); if (!options.baseline || !options.experiment || !options.run) throw Error('--baseline --experiment --run required');
  const lab = await startLab(options);
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal,async()=>{ await lab.close(); process.exit(0); });
}
