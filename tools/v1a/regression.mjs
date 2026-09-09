import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
const out='artifacts/v1a/regression';fs.mkdirSync(out,{recursive:true});
const results=[];
for(const [name,command] of [
  ['phase-a','npm.cmd run test:phase-a'],['phase-b','npm.cmd run test:phase-b'],
  ['phase-c','npm.cmd run test:phase-c'],['no-go','npm.cmd run test:no-go'],
  ['v0','node --experimental-default-type=module --test tests/v0/*.test.mjs'],
  ['v1a','node --experimental-default-type=module --test tests/v1a/*.test.mjs'],
  ['integrity','node scripts/verify_stage_id_integrity.mjs'],['build','npm.cmd run build'],
]) {
  const result=spawnSync('cmd.exe',['/d','/s','/c',command],{encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});
  const log=result.stdout+result.stderr;fs.writeFileSync(`${out}/${name}.log`,log);
  const counts=Object.fromEntries([...log.matchAll(/^# (tests|pass|fail|cancelled|skipped|todo) (\d+)/gm)].map(m=>[m[1],Number(m[2])]));
  results.push({name,command,exit:result.status,...counts});console.log(results.at(-1));
}
fs.writeFileSync(out+'/regression.json',JSON.stringify(results,null,2));
if(results.some(r=>r.exit!==0||r.fail||r.cancelled||r.skipped||r.todo))process.exitCode=1;
