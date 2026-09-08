// External observation only. Product objects are read, never assigned.
(() => {
 const o=globalThis.__b05={events:[],last:{},binding:null,serial:0,frame:0};
 o.event=(kind,extra={})=>{const event={kind,t:performance.now(),frame:o.frame,...extra};o.events.push(event);if(kind==='Q-draw')globalThis.__b06DrawNotice?.(JSON.stringify(event));};
 const seen=new Set();
 const hit=(el,x,y)=>{const h=document.elementFromPoint(x,y);return {ok:h===el||!!el?.contains(h),tag:h?.tagName,id:h?.id,text:h?.tagName==='BUTTON'?h.textContent:null};};
 const canvasPoint=(c,b)=>{if(!c||!b)return null;const r=c.getBoundingClientRect(),scale=Math.min(r.width/c.width,r.height/c.height);return {x:r.x+(r.width-c.width*scale)/2+(b.x+(b.width??b.w)/2)*scale,y:r.y+(r.height-c.height*scale)/2+(b.y+(b.height??b.h)/2)*scale};};
 o.title=()=>{const s=globalThis.fsm?.states?.title,c=s?.canvas,p=canvasPoint(c,s?.playButton);return {session:!!o.saveReady?.(),title:!!s&&fsm.currentState===s,handler:!!s?._clickHandler,button:!!s?.playButton,boot:!!document.querySelector('#bootProgress'),hit:p?hit(c,p.x,p.y):null,visibility:document.visibilityState};};
 o.captureSession=fn=>{o.saveReady=fn;const f=o.title();o.event('save-session-ready',{facts:f});if(f.session&&f.title&&f.handler&&f.button&&!f.boot&&f.hit?.ok){o.t1=performance.now();o.event('T1',{exactBoundary:true,facts:f});}else o.event('T1-not-at-session-boundary',{facts:f});};
 o.commit=(id,correct,context,result,quality)=>{if(result?.ok)o.event('C0',{id,correct,token:context.question?.id,session:context.question?.session,source:context.source,quality,action:globalThis.__b0obs?.pending});else o.event('C0-rejected',{id,reason:'save'});};
 o.bind=(g,b,s,buttons,recorded,session,saveReady)=>{
  o.binding={g,b,s,buttons,recorded,session};o.saveReady??=saveReady;
  const oldEnter=s.enter,oldUpdate=s.update;
  s.enter=function(...args){o.serial++;o.last.ready=false;o.last.strict=false;o.event('E1B',{serial:o.serial});const result=oldEnter.apply(this,args);o.sample('enter-return');return result;};
  s.update=function(...args){o.frame++;const result=oldUpdate.apply(this,args);o.sample('draw-return');return result;};
  o.facts=()=>{
   const i=s.inputEl,q=g.currentKanji?._recordQuestion,sub=s._answerSubmission;
   const r=i?.getBoundingClientRect(),style=i?getComputedStyle(i):null,c=s.canvas;
   const inputHit=r?.width&&r?.height?hit(i,r.x+r.width/2,r.y+r.height/2):null;
   const controls=Object.fromEntries(['attack','heal'].map(k=>{const p=canvasPoint(c,buttons[k]);return[k,p?hit(c,p.x,p.y):null];}));
   const guide=[...document.querySelectorAll('button')].some(e=>e.textContent==='つぎへ'||e.textContent==='はじめる！');
   const f={battle:fsm.currentState===fsm.states.battle,turn:b.turn,inputEnabled:b.inputEnabled,active:!!sub?.active,locked:sub?.locked??true,composing:sub?.composing??true,token:q?.id??null,tokenValid:!!q&&!!g.currentKanji?.id&&q.session===session&&!recorded.has(q),inputUsable:!!i?.isConnected&&!i.disabled&&!i.readOnly&&!i.closest('[inert]')&&style?.visibility==='visible'&&style.display!=='none'&&Number(style.opacity)>0&&!!r?.width&&!!r?.height,inputHit,controls,guide,tutorialSeen:localStorage.getItem('tutorial_seen_battle')==='1',visible:document.visibilityState==='visible'};
   f.ready=!!(f.battle&&f.turn==='player'&&f.inputEnabled&&f.active&&!f.locked&&!f.composing&&f.tokenValid&&f.inputUsable&&f.inputHit?.ok&&controls.attack?.ok&&controls.heal?.ok&&!guide&&f.visible);
   f.strict=f.ready&&f.tutorialSeen;
   return f;
  };
  o.sample=reason=>{
   if(fsm.currentState!==fsm.states.battle)return;
   const f=o.facts(),state={serial:o.serial,enemy:g.currentEnemy?.id,hp:g.currentEnemy?.hp,playerHP:g.playerStats.hp,enemyAction:b.enemyAction,enemyActionActive:b.enemyActionTimer>0,flash:!!s.flashEffect.active,hpAnimating:!!b.playerHpAnimating,turn:b.turn,token:f.token,ready:f.ready,strict:f.strict,guide:f.guide,tutorialSeen:f.tutorialSeen};
   const sig=JSON.stringify(state);if(sig!==o.last.sig){o.last.sig=sig;o.event('state',{reason,state,facts:f,timer:b.enemyActionTimer,flashTimer:s.flashEffect.timer});}
   if(reason==='draw-return'){const phase=JSON.stringify([o.serial,state.enemy,state.enemyAction,state.enemyActionActive,state.flash]);if(phase!==o.last.phase){o.last.phase=phase;o.event('phase-draw',{state,timer:b.enemyActionTimer,flashTimer:s.flashEffect.timer});}}
   if(f.ready&&!o.last.ready)o.event('ready_transient',{reason,serial:o.serial,token:f.token,facts:f});
   if(f.strict&&!o.last.strict)o.event('AS',{reason,serial:o.serial,token:f.token,action:globalThis.__b0obs?.pending,facts:f});
   if(!f.strict&&o.last.strict)o.event('AS-lost',{reason,serial:o.serial,token:f.token,action:globalThis.__b0obs?.pending,facts:f});
   o.last.ready=f.ready;o.last.strict=f.strict;
  };
  new MutationObserver(()=>o.sample('DOM-microtask')).observe(document,{subtree:true,attributes:true,childList:true});
  // Q/V diagnostics only; do not retain all Canvas text calls.
  if(globalThis.__b05Boundary){
   const drawImage=CanvasRenderingContext2D.prototype.drawImage;
   CanvasRenderingContext2D.prototype.drawImage=function(...args){
    const result=drawImage.apply(this,args);
    if(this.canvas===s.canvas&&fsm.currentState===fsm.states.battle&&args[0]===g.currentEnemy?.img){
     const key='enemy-image:'+o.serial+':'+g.currentEnemy.id+':'+b.enemyAction;
     if(!seen.has(key)){seen.add(key);o.event('enemy-image-draw',{serial:o.serial,enemy:g.currentEnemy.id,hp:g.currentEnemy.hp,action:b.enemyAction,timer:b.enemyActionTimer,alpha:this.globalAlpha,transform:Array.from(['a','b','c','d','e','f'],k=>this.getTransform()[k]),src:args[0]?.currentSrc||args[0]?.src});}
    }return result;
   };
   const original=CanvasRenderingContext2D.prototype.fillText;
   CanvasRenderingContext2D.prototype.fillText=function(...args){
    const result=original.apply(this,args);
    if(this.canvas===s.canvas&&fsm.currentState===fsm.states.battle){
     const text=String(args[0]),q=g.currentKanji,key='q:'+o.serial;
     if(q?.text===text&&!seen.has(key)){seen.add(key);o.event('Q-draw',{serial:o.serial,kanji:text,id:q.id,token:q._recordQuestion?.id,x:args[1],y:args[2],font:this.font});}
     const action=globalThis.__b0obs?.pending,uk=globalThis.__b0obs?.actionStart;
     const match=action==='correct'?text.includes('せいかい'):action==='wrong'?text.includes('おしい'):action==='heal'?text.includes('かいふくせいこう'):false;
     if(match&&uk&&!seen.has('v:'+uk)){seen.add('v:'+uk);o.event('V-draw',{action,text,x:args[1],y:args[2],font:this.font});}
    }return result;
   };
  }
 };
 new MutationObserver(()=>{if(o.saveReady&&!o.t1){const f=o.title();if(f.session&&f.title&&f.handler&&f.button&&!f.boot&&f.hit?.ok){o.t1=performance.now();o.event('T1-observed',{exactBoundary:false,facts:f});}}}).observe(document,{subtree:true,attributes:true,childList:true});
 document.addEventListener('click',()=>queueMicrotask(()=>o.sample?.('click-end')),true);
 document.addEventListener('keydown',()=>queueMicrotask(()=>o.sample?.('keydown-end')),true);
 document.addEventListener('visibilitychange',()=>o.event('visibility',{value:document.visibilityState}));
 window.addEventListener('resize',()=>o.event('resize',{width:innerWidth,height:innerHeight}));
})();
