(() => {
  const kind=globalThis.__v0FaultKind;
  const fault=globalThis.__v0Fault={kind,fired:false,fallbackObserved:false};
  const capture=()=>({t:performance.now(),enemy:__b05.binding.g.currentEnemy.id,hp:__b05.binding.g.currentEnemy.hp,
    playerHp:__b05.binding.g.playerStats.hp,token:__b05.binding.g.currentKanji._recordQuestion.id});
  if(kind==='webgl-unavailable') {
    const original=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){
      if(type==='webgl2'&&this.classList.contains('yomitabi-3d-canvas')) {fault.fired=true;return null;}
      return original.call(this,type,...args);
    };
  }
  if(kind==='render-failure') {
    const original=WebGL2RenderingContext.prototype.drawElements;
    WebGL2RenderingContext.prototype.drawElements=function(...args){
      if(!fault.fired&&globalThis.__b05?.binding?.b.enemyAction==='damage') {
        fault.before=capture();fault.fired=true;throw Error('V0 injected draw failure');
      }
      return original.apply(this,args);
    };
  }
  const timer=setInterval(()=>{
    if(kind.startsWith('context-')&&!fault.fired&&globalThis.__b05?.binding?.b.enemyAction===kind.slice(8)) {
      const canvas=document.querySelector('.yomitabi-3d-canvas'),gl=canvas?.getContext('webgl2');
      if(gl){const extension=gl.getExtension('WEBGL_lose_context');if(extension){fault.before=capture();fault.fired=true;extension.loseContext();}}
    }
    if(fault.fired&&!document.querySelector('.yomitabi-3d-canvas')&&!document.querySelector('#gameCanvas').classList.contains('yomitabi-3d-active')) {
      fault.fallbackObserved=true;fault.after=capture();clearInterval(timer);
    }
  },5);
})();
