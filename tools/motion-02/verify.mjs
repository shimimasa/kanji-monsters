import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const out=process.argv[2];if(!out||fs.existsSync(path.join(out,'verification.json')))throw Error('new output directory required');fs.mkdirSync(out,{recursive:true});
const commands=[['phase-a',['npm.cmd','run','test:phase-a']],['phase-b',['npm.cmd','run','test:phase-b']],['phase-c',['npm.cmd','run','test:phase-c']],['no-go',['npm.cmd','run','test:no-go']],['motion-01',['node','--experimental-default-type=module','--test','tests/motion-01/*.test.mjs']],['motion-02',['node','--experimental-default-type=module','--test','tests/motion-02/*.test.mjs']],['integrity',['node','scripts/verify_stage_id_integrity.mjs']],['build',['npm.cmd','run','build']]];
const results=[];
for(const [name,args] of commands){const result=spawnSync(process.env.ComSpec??'cmd.exe',['/d','/s','/c',args.join(' ')],{encoding:'utf8',maxBuffer:16*1024*1024});const text=(result.stdout??'')+(result.stderr??'');fs.writeFileSync(path.join(out,name+'.log'),text);const counts={};for(const key of ['tests','pass','fail','cancelled','skipped','todo']){const match=text.match(new RegExp('^# '+key+' (\\d+)$','m'));if(match)counts[key]=Number(match[1]);}results.push({name,args,exit:result.status,error:result.error?.message,counts});console.log(JSON.stringify(results.at(-1)));}
fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(results,null,2));process.exitCode=results.some(r=>r.exit!==0)?1:0;
