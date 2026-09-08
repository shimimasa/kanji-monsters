import {spawn} from 'node:child_process';
import fs from 'node:fs';
const root='artifacts/v0/run-01';
const sequence=[['baseline','cold-B1'],['experiment','cold-V1'],['baseline','cold-B2'],['experiment','cold-V2'],['baseline','cold-B3'],['experiment','cold-V3']];
for(const [role,attempt]of sequence) {
  const prefix=`${root}/${role}-${attempt}`;
  const child=spawn(process.execPath,['tools/v0/run.mjs',role,attempt,'full'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  const log=fs.createWriteStream(prefix+'-runner.log',{flags:'wx'});
  child.stdout.on('data',data=>{process.stdout.write(data);log.write(data);});child.stderr.on('data',data=>{process.stderr.write(data);log.write(data);});
  const timer=setInterval(()=>{
    if(fs.existsSync(root+'/batch-human-ready.json')&&fs.existsSync(prefix+'-waiting.json')&&!fs.existsSync(prefix+'-human-ready.json')) {
      const ready=JSON.parse(fs.readFileSync(root+'/batch-human-ready.json','utf8'));
      if(ready.userMessage!=='準備完了')throw Error('No human readiness');
      fs.writeFileSync(prefix+'-human-ready.json',JSON.stringify({...ready,role,attempt,scope:'User maintains dedicated Chrome foreground for all six paired runs'},null,2),{flag:'wx'});
    }
  },250);
  const code=await new Promise(resolve=>child.on('exit',resolve));clearInterval(timer);log.end();
  if(code!==0) {console.error('BATCH STOP',role,attempt,code);process.exitCode=1;break;}
}
