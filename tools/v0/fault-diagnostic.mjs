import assert from 'node:assert/strict';
export async function diagnostic({ev,until,data,snap}) {
  const kind=process.argv[5];
  data.fault=await ev('__v0Fault');
  if(kind!=='import-failure') {assert.equal(data.fault.fired,true);assert.equal(data.fault.fallbackObserved,true);}
  else assert.ok(data.requests.some(r=>/babylonPrimitiveRenderer-/.test(r.url)&&data.failed.some(f=>f.requestId===r.id)));
  if(['import-failure','webgl-unavailable'].includes(kind))assert.equal(await ev("document.querySelector('#gameCanvas').classList.contains('yomitabi-3d-active')"),false);
  else await until("document.querySelector('#gameCanvas').classList.contains('yomitabi-3d-active')",'ready after fault reentry');
  assert.equal(await ev('__b0.ready()'),true);await snap('fault-complete');
}
