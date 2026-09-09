import fs from 'node:fs/promises';
export async function connect(port=49742){
  const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target=tabs.find(t=>t.type==='page'),ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r=>ws.addEventListener('open',r,{once:true}));
  let id=0;const pending=new Map(),listeners=[];
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}else for(const fn of listeners)fn(m);});
  const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
  const ev=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const wait=async(expression,label=expression,ms=15000)=>{const end=Date.now()+ms;while(Date.now()<end){try{if(await ev(expression))return;}catch{}await new Promise(r=>setTimeout(r,40));}throw Error('Timeout: '+label);};
  const shot=async path=>{const r=await call('Page.captureScreenshot',{format:'png'});await fs.writeFile(path,Buffer.from(r.data,'base64'));};
  const click=async(x,y)=>{await call('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});};
  const point=async expression=>{const p=await ev(`(()=>{const b=${expression},c=document.getElementById('gameCanvas'),r=c.getBoundingClientRect(),s=Math.min(r.width/c.width,r.height/c.height);return {x:r.x+(r.width-c.width*s)/2+(b.x+(b.w??b.width)/2)*s,y:r.y+(r.height-c.height*s)/2+(b.y+(b.h??b.height)/2)*s}})()`);await click(p.x,p.y);};
  return {call,ev,wait,shot,click,point,on:fn=>listeners.push(fn),close:()=>ws.close()};
}
