import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
export async function launchChrome(executable, profile) {
  await mkdir(profile); // Exclusive: an existing profile is never opened.
  const child = spawn(executable, ['--headless=new',`--user-data-dir=${profile}`,'--remote-debugging-port=0',
    '--no-first-run','--no-default-browser-check','--disable-sync','--disable-background-networking',
    '--disable-component-update','--window-size=1100,900','--mute-audio','about:blank'],
  { windowsHide:true,stdio:['ignore','ignore','pipe'] });
  let stderr='';child.stderr.on('data',v=>{stderr+=v;});
  let endpoint;
  for(let i=0;i<100;i++) {
    if(child.exitCode !== null) throw Error('Dedicated Chrome exited: '+stderr);
    try { const lines=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).trim().split('\n'); endpoint=`ws://127.0.0.1:${lines[0]}${lines[1]}`;break; } catch {}
    await sleep(100);
  }
  if(!endpoint) {child.kill();throw Error('Dedicated Chrome endpoint unavailable');}
  const socket=new WebSocket(endpoint); await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let next=1;const pending=new Map(), listeners=[];
  socket.onmessage=event=>{
    const msg=JSON.parse(event.data);
    if(msg.id) {const p=pending.get(msg.id);if(p){pending.delete(msg.id);clearTimeout(p.timer);msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result);}}
    else for(const callback of listeners) callback(msg);
  };
  const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{
    const id=next++,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},20000);
    pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
  });
  const {targetId}=await call('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});
  const send=(method,params)=>call(method,params,sessionId);
  const evaluate=async expression=>{
    const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    if(result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  return {child,call,send,evaluate,on:cb=>listeners.push(cb),
    screenshot:async filename=>{const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(filename,Buffer.from(r.data,'base64'));},
    close:async()=>{try{await call('Browser.close');}catch{}socket.close();if(child.exitCode===null){await sleep(500);if(child.exitCode===null)child.kill();}}
  };
}
