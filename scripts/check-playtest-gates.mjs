import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source=await fs.readFile(new URL('../src/playtest/developmentLogger.js',import.meta.url),'utf8');
const expression=source.match(/export const PLAYTEST_ENABLED = ([\s\S]*?);/)[1]
  .replaceAll('import.meta.env','env').replaceAll('globalThis.location?.hostname','hostname');
const enabled=new Function('env','hostname',`return ${expression}`);
let cases=0;
for(const MODE of ['production','development','child-playtest'])
for(const VITE_PLAYTEST_LOGGER of [undefined,'0','1'])
for(const hostname of ['localhost','127.0.0.1','[::1]','yomitabi.gamanavi.com','192.168.1.10']) {
  assert.equal(enabled({MODE,VITE_PLAYTEST_LOGGER,DEV:MODE==='development'},hostname),
    MODE==='child-playtest'&&VITE_PLAYTEST_LOGGER==='1'&&['localhost','127.0.0.1','[::1]'].includes(hostname)); cases++;
}
const assets=await fs.readdir(new URL('../dist/assets/',import.meta.url));
for(const file of assets.filter(file=>file.endsWith('.js'))) {
  const code=await fs.readFile(new URL('../dist/assets/'+file,import.meta.url),'utf8');
  for(const token of ['yomitabiPlaytest','milliseconds-from-observation-start','observationStarted']) assert.ok(!code.includes(token),file+': '+token);
}
console.log(`${cases} activation matrix cases PASS; normal production logger stripped PASS`);
