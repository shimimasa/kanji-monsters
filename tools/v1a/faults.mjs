import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {injectSampleFailure} from './visual-scope.mjs';

// CDP HTTP fault injection into the display-only URL; no game-state writes.
export async function faults({c,ev,until,stage,leave,guide,snap,action,data,prefix}) {
  let fault=null;const paused=new Set();let intercepted=0;
  const bytes=await readFile('public/assets/3d/monsters/HKD-E01/HKD-E01.v1a.1.glb');
  c.on(m=>{if(m.method!=='Fetch.requestPaused')return;const id=m.params.requestId;
    if(!fault){void c.send('Fetch.continueRequest',{requestId:id});return;}
    intercepted++;
    if(fault==='pending'||fault==='exit-pending'){paused.add(id);return;}
    const status=fault==='404'?404:200;
    const body=fault==='HTML-200'?Buffer.from('<html>rewrite</html>'):fault==='header'?Buffer.from('invalid GLB header'):bytes;
    void c.send('Fetch.fulfillRequest',{requestId:id,responseCode:status,responseHeaders:[{name:'Content-Type',value:fault==='HTML-200'?'text/html':'model/gltf-binary'}],body:body.toString('base64')});
  });
  await c.send('Fetch.enable',{patterns:[{urlPattern:'*HKD-E01.v1a.1.glb*',requestStage:'Request'}]});
  data.faults=[];
  for(const kind of (process.env.V1A_SAMPLE_TEST==='1'?[]:['404','HTML-200','header','pending','exit-pending'])){
    await leave();fault=kind;const calls=intercepted;await stage();await guide();await until('__b0.ready()','fault battle answer ready');
    assert.ok(intercepted>calls,kind+' intercepted');
    const before=await ev('__b0.read()');
    assert.equal(await ev("document.querySelector('#gameCanvas').classList.contains('yomitabi-3d-active')"),false);
    if(kind==='exit-pending'){
      await leave();fault=null;await stage();await guide();await until('__b0.ready()','new session answer');
      await until("document.querySelector('#gameCanvas').classList.contains('yomitabi-3d-active')",'new GLB session');
      const current=await ev('__b0.resources().visualSession');
      for(const id of paused){try{await c.send('Fetch.fulfillRequest',{requestId:id,responseCode:200,body:bytes.toString('base64')});}catch(e){data.cancelledLateResponse=e.message;}paused.clear();}
      assert.equal(await ev('__b0.resources().visualSession'),current);
      await action('correct');data.faults.push({kind,current,answered:true});continue;
    }
    // Even indefinite fetch must allow an answer before the visual deadline.
    await action('correct');
    assert.equal((await ev('__b0.read()')).player.totalCorrect,before.player.totalCorrect+1);
    await until("!document.querySelector('.yomitabi-3d-canvas')",'fault disposed',15000);
    const actual=await ev('__v0Audit()');assert.deepEqual(actual.listeners,[]);
    for(const n of Object.values(actual.gpu))assert.equal(n,0);
    data.faults.push({kind,answered:true,actual,resources:await ev('__b0.resources()')});await snap('fault-'+kind);
    for(const id of paused){try{await c.send('Fetch.failRequest',{requestId:id,errorReason:'Aborted'});}catch{}paused.clear();}
    fault=null;await leave();await stage();await guide();await until('__b0.ready()','fault recovery answer');
    await until("document.querySelector('#gameCanvas').classList.contains('yomitabi-3d-active')",'fault recovery GLB');
  }
  fault=null;await c.send('Fetch.disable');
  const before=await ev('__b0.read()');await injectSampleFailure(c);
  await until("!document.querySelector('.yomitabi-3d-canvas')",'sample exception fallback');
  await ev('__v1aUndoSampleFault()');
  assert.deepEqual((await ev('__b0.read()')).question,before.question);
  await action('correct');data.faults.push({kind:'sample-exception',answered:true});
  await leave();await stage();await guide();await until('__b0.ready()','sample recovery answer');
  await until("document.querySelector('#gameCanvas').classList.contains('yomitabi-3d-active')",'sample recovery GLB');
  await c.screenshot(prefix+'-faults-recovered.png');
}
