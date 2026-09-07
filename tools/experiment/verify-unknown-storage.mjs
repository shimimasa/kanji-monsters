import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { args } from './common.mjs';
import { launchChrome, sleep } from './chrome.mjs';
const options=args(), run=path.resolve(options.run);
if(!options.attempt || !options.chrome)throw Error('--run --attempt --chrome required');
const profile=path.join(run,'profile-negative-'+options.attempt);
const browser=await launchChrome(options.chrome,profile);
const evidence={profile,at:new Date().toISOString(),pass:false};
try {
  await browser.send('Page.enable');await browser.send('Runtime.enable');
  // Deliberate synthetic sentinel in this newly-created profile only.
  await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:"if(location.origin==='http://127.0.0.1:49722')localStorage.setItem('e0_synthetic_unknown','fictional safety sentinel');"});
  await browser.send('Page.navigate',{url:'http://127.0.0.1:49722/__experiment/setup'});
  let stopped=false;
  for(let i=0;i<100;i++){stopped=await browser.evaluate("document.querySelector('#status')?.textContent.includes('STOP:')");if(stopped)break;await sleep(100);}
  assert.equal(stopped,true);
  evidence.state=await browser.evaluate("({keys:Object.keys(localStorage),sentinel:localStorage.getItem('e0_synthetic_unknown'),save:localStorage.getItem('krb_save'),text:document.querySelector('#status').textContent,disabled:[...document.querySelectorAll('button')].every(b=>b.disabled)})");
  assert.deepEqual(evidence.state.keys,['e0_synthetic_unknown']);assert.equal(evidence.state.sentinel,'fictional safety sentinel');assert.equal(evidence.state.save,null);assert.equal(evidence.state.disabled,true);
  evidence.locked=await browser.evaluate("(async()=>({game:(await fetch('/')).status,fixture:(await fetch('/__experiment/fixture')).status}))()");
  assert.equal(evidence.locked.game,403);assert.equal(evidence.locked.fixture,404);
  await browser.screenshot(path.join(run,'unknown-storage-stop.png'));evidence.pass=true;
} finally {await writeFile(path.join(run,'unknown-storage-evidence.json'),JSON.stringify(evidence,null,2));await browser.close();}
console.log('Unknown Storage STOP / no overwrite PASS');
