// Functional QA only. Supply a known artificial E0 fixture; never a user save.
import fs from 'node:fs/promises';
import path from 'node:path';
import {connect} from './cdp.mjs';
const [fixturePath,out,generation='artificial-e0-v2']=process.argv.slice(2);if(!fixturePath||!out)throw Error('usage: node start-qa.mjs artificial-fixture.json output-dir [fixture-generation]');
const fixture=JSON.parse(await fs.readFile(fixturePath,'utf8'));
if(fixture.manifest?.runId!=='e0-cert-01'||!fixture.manifest?.method.includes('Fresh MemoryStorage'))throw Error('Expected certified artificial E0 fixture');
const entries=structuredClone(fixture.entries);
for(const key of ['krb_save','yomitabi_confirmed_1']){const s=JSON.parse(entries[key]);s.settings.gameMode='challenge';s.settings.bgmVolume=0;s.settings.seVolume=0;entries[key]=JSON.stringify(s);}
entries.inputMethod='device';
const c=await connect(),events={blocked:[],exceptions:[]};
c.on(m=>{if(m.method==='Fetch.requestPaused'){const p=m.params,u=p.request.url;const local=u.startsWith('http://127.0.0.1:49741/')||u.startsWith('data:');if(!local)events.blocked.push(u);c.call(local?'Fetch.continueRequest':'Fetch.failRequest',local?{requestId:p.requestId}:{requestId:p.requestId,errorReason:'BlockedByClient'}).catch(()=>{});}
  if(m.method==='Runtime.exceptionThrown')events.exceptions.push(m.params);});
try{
  await c.call('Page.enable');await c.call('Runtime.enable');await c.call('Network.enable');
  await c.call('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  await c.call('Page.addScriptToEvaluateOnNewDocument',{source:`if(location.origin==='http://127.0.0.1:49741'&&sessionStorage.motion02Fixture!==${JSON.stringify(generation)}){localStorage.clear();for(const[k,v]of Object.entries(${JSON.stringify(entries)}))localStorage.setItem(k,v);sessionStorage.motion02Fixture=${JSON.stringify(generation)};}`});
  await c.call('Emulation.setDeviceMetricsOverride',{width:1086,height:723,deviceScaleFactor:1,mobile:false});
  await c.call('Page.navigate',{url:'http://127.0.0.1:49741/'});
  await c.wait('window.fsm?.states?.battle && fsm.currentState===fsm.states.title','title',30000);
  await c.ev(`(async()=>{window.__m2={...(await import('/src/core/gameState.js')),battle:(await import(performance.getEntriesByType('resource').find(e=>e.name.includes('/src/screens/battleScreen.js')).name)).default,theme:await import('/src/screens/battle/theme.js'),tutorial:(await import('/src/tutorial/TutorialManager.js')).default};})()`);
  if(await c.ev(`(async()=> (await import('/src/core/saveData.js')).readSaveState().status)()`)!=='valid')throw Error('Artificial fixture is not valid');
  await c.shot(path.join(out,'title.png'));
  console.log(await c.ev(`JSON.stringify({state:Object.keys(fsm.states).find(k=>fsm.states[k]===fsm.currentState),buttons:[...document.querySelectorAll('button')].map(b=>({text:b.textContent,id:b.id,class:b.className})),save:JSON.parse(localStorage.krb_save).settings})`));
  await fs.writeFile(path.join(out,'startup.json'),JSON.stringify(events,null,2));
  // Blocking remains in Network too, independent of this CDP connection lifetime.
  await c.call('Network.setBlockedURLs',{urls:['*://*.googleapis.com/*','*://*.firebaseio.com/*','*://*.gstatic.com/*','*://*.firebaseapp.com/*']});
}finally{await c.call('Fetch.disable');c.close();}
