import http from 'node:http';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { args } from './common.mjs';
const options=args(), results=[];
function request(port,route,headers={},method='GET',body='') {
  return new Promise((resolve,reject)=>{
    const req=http.request({hostname:'127.0.0.1',port,path:route,method,headers},res=>{
      let data='';res.on('data',c=>data+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:data}));
    });req.on('error',reject);req.end(body);
  });
}
for(const port of [49721,49722]) {
  for(const [name,route,headers,method,body,status] of [
    ['game locked','/',{},'GET','',403],
    ['fixture locked','/__experiment/fixture',{},'GET','',404],
    ['Host allowlist','/__experiment/info',{Host:'not-allowed.invalid'},'GET','',403],
    ['hidden Git','/.git/config',{},'GET','',400],
    ['encoded traversal','/%2e%2e/package.json',{},'GET','',400],
    ['Windows traversal','/%5c..%5cpackage.json',{},'GET','',400],
    ['external absolute URL','https://example.invalid/',{},'GET','',400],
    ['method rejected','/',{},'PUT','',405],
    ['arm lacks origin/session','/__experiment/arm',{'Content-Type':'application/json'},'POST','{}',403],
    ['same origin ping','/__experiment/ping',{},'GET','',200]
  ]) {
    const response=await request(port,route,headers,method,body);
    assert.equal(response.status,status,name);assert.ok(response.headers['content-security-policy'].includes("connect-src 'self'"));
    assert.equal(response.headers['content-security-policy-report-only'],undefined);
    assert.ok(response.headers['x-yomitabi-e0']);results.push({port,name,status:response.status,pass:true});
  }
}
await writeFile(path.join(options.run,'http-safety-evidence.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify({passed:results.length}));
