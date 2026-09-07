import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { args, BASELINE, baselineCore, MemoryStorage, canonical, hash } from './common.mjs';

const options = args();
if (!options.baseline || !options.out) throw Error('--baseline and --out required; use node --experimental-default-type=module');
const root = path.resolve(options.baseline), out = path.resolve(options.out);
const modules = await baselineCore(root);
// A fresh process and an empty in-memory store are the ONLY fixture inputs.
if (globalThis.localStorage) throw Error('STOP existing Storage binding');
globalThis.localStorage = new MemoryStorage();
globalThis.fetch = () => { throw Error('STOP network forbidden in fixture generator'); };
const api = await import(pathToFileURL(path.join(root, 'src/core/saveData.js')));
const result = api.saveNow(api.getDefaultSave());
if (!result.ok || api.readSaveState().status !== 'valid') throw Error('Default fixture failed existing save API');
const entries = Object.fromEntries(localStorage.data);
const fixtureHash = hash(canonical(entries));
const manifest = { runId: path.basename(out), generatedAt: new Date().toISOString(), baselineSHA: BASELINE,
  modules, fixtureHash, method: 'Fresh MemoryStorage -> stable getDefaultSave() -> saveNow() -> readSaveState(valid); no user input/save/cloud',
  keyCount: Object.keys(entries).length, node: process.version };
// Deliberately exclusive: never overwrite an existing run or fixture.
await mkdir(out);
await writeFile(path.join(out, 'fixture.json'), JSON.stringify({ manifest, entries }, null, 2), { flag: 'wx' });
await writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
// Browser-side validation uses the same stable save module, bundled as an external TOOL.
// It does not import main/gameState/Firebase or change the product dist.
const esbuild = await import(pathToFileURL(path.join(root, 'node_modules/esbuild/lib/main.js')));
await esbuild.build({ stdin: { contents: 'export { readSaveState } from "./src/core/saveData.js";', resolveDir: root },
  bundle: true, format: 'esm', platform: 'browser', outfile: path.join(out, 'save-validator.js') });
await writeFile(path.join(out, 'validator-manifest.json'), JSON.stringify({ baselineSHA: BASELINE, modules,
  sha256: hash(await readFile(path.join(out, 'save-validator.js'))) }, null, 2), { flag: 'wx' });
console.log(JSON.stringify(manifest, null, 2));
