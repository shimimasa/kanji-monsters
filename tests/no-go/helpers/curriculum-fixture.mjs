import assert from 'node:assert/strict';
import fs from 'node:fs';
export const grade7URL = '/data/kanji_g7_proto.json';
export const readData = url => JSON.parse(fs.readFileSync(new URL('../../../public'+url,import.meta.url),'utf8'));
export const normalStages = readData('/data/stages_proto.json');
export const drain = () => new Promise(resolve => setImmediate(resolve));
export function curriculumFixture(mode='healthy', target=grade7URL) {
  const requests=[];
  const malformed=new SyntaxError('injected grade7 malformed JSON');
  let reached,release;
  const atFault=new Promise(resolve=>reached=resolve);
  const pending=new Promise(resolve=>release=resolve);
  const fetch=async (url,{signal}={})=>{
    assert.equal(typeof url,'string');
    const entry={url,signal,status:200,body:'unread',fault:null};requests.push(entry);
    if(url===target && mode!=='healthy') {
      entry.fault=mode;reached(entry);
      if(mode==='503'){entry.status=503;return {ok:false,status:503};}
      if(mode==='reject')throw new Error('injected offline: '+url);
      if(mode==='pending-fetch')await pending;
    }
    return {ok:true,status:200,json:async()=>{
      entry.body='reading';
      if(url===target && mode==='malformed'){entry.body='malformed';throw malformed;}
      if(url===target && mode==='pending-body')await pending;
      entry.body='complete';return readData(url);
    }};
  };
  return {fetch,requests,malformed,atFault,release};
}
export function assertHealthy(loader,result,fixture) {
  // Product API returns a data object / null; success is the observable Boolean.
  assert.equal(Boolean(result),true,'success:true for healthy curriculum');
  assert.equal(loader.getKanjiByGrade(7).length,readData(grade7URL).length);
  assert.deepEqual(loader.getKanjiByGrade(7).map(k=>k.id).sort(),readData(grade7URL).map(k=>k.id).sort());
  const expectedURLs=[...Array.from({length:10},(_,i)=>`/data/kanji_g${i+1}_proto.json`),
    '/data/enemies_proto.json','/data/enemies_legend.json','/data/stages_proto.json','/data/stages.bonus.json'];
  assert.deepEqual(fixture.requests.map(r=>r.url).sort(),expectedURLs.sort(),'exact requested curriculum URLs');
  assert.ok(fixture.requests.every(r=>r.status===200&&r.body==='complete'&&!r.fault));
  assert.equal(normalStages.length,88);
  assert.deepEqual(loader.stageData.filter(s=>/_area\d+$/.test(s.stageId)).map(s=>s.stageId).sort(),
    normalStages.map(s=>s.stageId).sort(),'normal stage definition set');
  for(const stage of normalStages)assert.deepEqual(loader.getKanjiByStageId(stage.stageId).map(k=>k.id).sort(),
    [...stage.kanjiPoolIdList].sort(),stage.stageId+' exact defined pool');
}
export function assertExplicitFailure(loader,result,fixture,errors,mode='503',target=grade7URL) {
  assert.equal(Boolean(result),false,'failed curriculum must not be a success');
  assert.equal(result,null);
  assert.equal(loader.getKanjiByGrade(7).length,0,'never substitute grade6 for grade7');
  assert.equal(loader.getKanjiByStageId('asia_area1').length,0,'no substitute stage pool');
  const faults=fixture.requests.filter(r=>r.url===target);
  assert.equal(faults.length,1,'intended URL reached exactly once');
  assert.equal(faults[0].fault,mode,'intended fault injected');
  assert.equal(errors.length,1,'one caught load failure: '+errors.map(e=>String(e)).join(' | '));
  const error=errors[0];
  if(mode==='503') {
    assert.equal(faults[0].status,503);assert.equal(faults[0].body,'unread');
    assert.equal(error.message,'教材を読み込めませんでした: '+target,'failure caused by intended HTTP response');
  } else if(mode==='malformed') {
    assert.equal(faults[0].body,'malformed');assert.equal(error,fixture.malformed,'actual injected JSON error');
  } else if(mode==='reject')assert.equal(error.message,'injected offline: '+target);
  else {
    assert.equal(error.message,'読み込みが時間内に終わりませんでした。もう一度ためしてください。');
    assert.equal(faults[0].signal.aborted,true,'pending grade7 request aborted');
    assert.equal(faults[0].body,mode==='pending-body'?'reading':'unread');
  }
  for(const r of fixture.requests.filter(r=>r.url!==target)) {
    assert.equal(r.status,200);assert.equal(r.fault,null);assert.equal(r.body,'complete');assert.equal(r.signal.aborted,false);
  }
}
