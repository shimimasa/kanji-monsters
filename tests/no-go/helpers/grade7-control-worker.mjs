import { register } from 'node:module';
import { installStorage } from '../../phase-a/storage-helper.mjs';
import { curriculumFixture, assertExplicitFailure, drain } from './curriculum-fixture.mjs';
const mode=process.argv[2];
if(mode==='fallback')register('./grade7-counterfactual-loader.mjs',import.meta.url);
installStorage();
const errors=[];
console.log=()=>{};console.warn=()=>{};console.error=(_message,error)=>errors.push(error);
const fixture=curriculumFixture(mode==='healthy'?'healthy':'503');globalThis.fetch=fixture.fetch;
const loader=await import('../../../src/loaders/dataLoader.js');
const result=await loader.loadAllGameData();await drain();
process.stdout.write(JSON.stringify({success:Boolean(result),grade7:loader.getKanjiByGrade(7).length,
  grade6:loader.getKanjiByGrade(6).length,requests:fixture.requests.map(r=>({url:r.url,fault:r.fault,status:r.status}))})+'\n');
assertExplicitFailure(loader,result,fixture,errors);
