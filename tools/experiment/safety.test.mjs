import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { makeCsp, safeRequestPath } from './server.mjs';
import { inside, canonical, hash } from './common.mjs';
import { launchChrome } from './chrome.mjs';

test('CSP refuses external scripts/connections and hashes exact existing inline bytes',()=>{
  const inline='\nconsole.log("local")\n';
  const csp=makeCsp(`<script>${inline}</script><script type="module" src="/assets/main.js"></script>`);
  assert.ok(csp.includes("connect-src 'self'"));
  assert.ok(csp.includes(`'sha256-${createHash('sha256').update(inline).digest('base64')}'`));
  assert.ok(csp.includes("worker-src 'none'"));
  assert.ok(csp.includes("form-action 'none'"));
  assert.ok(!/https:|gstatic|unsafe-eval|strict-dynamic/.test(csp));
  assert.ok(!csp.split(';').find(s=>s.includes('script-src')).includes('unsafe-inline'));
});
test('encoded traversal, hidden paths, NUL and Windows separators are refused',()=>{
  for(const value of ['/../secret','/%2e%2e/secret','/.git/config','/%5c..%5csecret','/%00','https://example.invalid/a']) assert.throws(()=>safeRequestPath(value));
  assert.equal(safeRequestPath('/data/stages_proto.json?x=1'),'/data/stages_proto.json');
});
test('real serving root cannot escape to sibling directory',async()=>{
  const temporary=await mkdtemp(path.join(os.tmpdir(),'yomitabi-e0-path-test-'));
  const root=path.join(temporary,'dist');await mkdir(root);
  await writeFile(path.join(root,'index.html'),'local'); await writeFile(path.join(temporary,'secret'),'outside');
  assert.equal(await inside(root,'index.html'),path.join(root,'index.html'));
  await assert.rejects(inside(root,'../secret'));
});
test('fixture digest is independent of entry order but detects changed values',()=>{
  assert.equal(hash(canonical({b:'2',a:'1'})),hash(canonical({a:'1',b:'2'})));
  assert.notEqual(hash(canonical({a:'1'})),hash(canonical({a:'2'})));
});
test('an existing profile is refused before any browser can launch',async()=>{
  const profile=await mkdtemp(path.join(os.tmpdir(),'yomitabi-e0-profile-refusal-'));
  await assert.rejects(launchChrome('must-not-launch.exe',profile),{code:'EEXIST'});
});
