import {appendFile} from 'node:fs/promises';
export async function monitorForeground(c,prefix,onFailure){
 const records=[];let active=false,busy=false,timer,closed=false,initialLayout;
 let writes=Promise.resolve();
 const log=r=>{const row={epoch:Date.now(),active,pid:c.child.pid,targetId:c.targetId,...r};records.push(row);writes=writes.then(()=>appendFile(prefix+'-foreground.jsonl',JSON.stringify(row)+'\n'));};
 const fail=reason=>{if(active)onFailure(Error('STOP foreground: '+reason));};
 await c.send('Runtime.addBinding',{name:'__b06Visibility'});
 const source=`(()=>{const send=reason=>__b06Visibility(JSON.stringify({reason,t:performance.now(),timeOrigin:performance.timeOrigin,url:location.href,visibility:document.visibilityState,focus:document.hasFocus(),width:innerWidth,height:innerHeight,dpr:devicePixelRatio,screen:{width:screen.width,height:screen.height}}));document.addEventListener('visibilitychange',()=>send('visibilitychange'));window.addEventListener('resize',()=>send('resize'));for(const e of ['freeze','resume','pagehide','pageshow'])window.addEventListener(e,()=>send(e));send('document-start');})()`;
 c.on(m=>{
  if(m.method==='Runtime.bindingCalled'&&m.params.name==='__b06Visibility'){const r=JSON.parse(m.params.payload);log({kind:'document',...r});if(r.visibility==='hidden')fail('document hidden at '+r.timeOrigin+' + '+r.t+' ms');if(active&&initialLayout&&r.reason==='resize'&&[r.width,r.height,r.dpr,r.screen.width,r.screen.height].join('/')!==initialLayout)fail('display dimensions changed');}
  if(m.method==='Page.lifecycleEvent')log({kind:'Page.lifecycleEvent',...m.params});
  if(m.method==='Target.targetInfoChanged')log({kind:'Target.targetInfoChanged',...m.params});
 });
 await c.send('Page.setLifecycleEventsEnabled',{enabled:true});
 await c.send('Page.addScriptToEvaluateOnNewDocument',{source});await c.evaluate(source);
 const sample=async reason=>{if(busy||closed)return;busy=true;try{const window=await c.call('Browser.getWindowForTarget',{targetId:c.targetId});const state=await c.evaluate('({visibility:document.visibilityState,focus:document.hasFocus(),timeOrigin:performance.timeOrigin,t:performance.now(),width:innerWidth,height:innerHeight,dpr:devicePixelRatio,screen:{width:screen.width,height:screen.height}})');log({kind:'poll',reason,window,state});if(state.visibility==='hidden')fail('poll hidden');if(window.bounds.windowState==='minimized')fail('window minimized');return state;}catch(e){log({kind:'monitor-error',error:e.message});fail('monitor unavailable: '+e.message);}finally{busy=false;}};
 await sample('monitor-start');timer=setInterval(()=>void sample('1-second'),1000);
 return {records,async arm(){const state=await sample('before-arm');if(!state||state.visibility!=='visible')throw Error('STOP cannot start: dedicated Chrome is hidden');initialLayout=[state.width,state.height,state.dpr,state.screen.width,state.screen.height].join('/');active=true;log({kind:'measurement-start',layout:initialLayout});return state;},async finish(){clearInterval(timer);while(busy)await new Promise(r=>setTimeout(r,20));await sample('measurement-end');active=false;closed=true;await writes;}};
}
