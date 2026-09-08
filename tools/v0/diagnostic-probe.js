// External fault-test instrumentation. Never loaded in the performance runs.
(() => {
  const registrations=[];
  const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener=function(type,callback,options) {
    const capture=typeof options==='boolean'?options:!!options?.capture;
    if(callback&&new Error().stack.includes('babylonPrimitiveRenderer-')&&!registrations.some(r=>!r.removed&&r.target.deref()===this&&r.callback.deref()===callback&&r.type===type&&r.capture===capture)) {
      registrations.push({target:new WeakRef(this),callback:new WeakRef(callback),type,capture,removed:false});
    }
    return add.call(this,type,callback,options);
  };
  EventTarget.prototype.removeEventListener=function(type,callback,options) {
    const capture=typeof options==='boolean'?options:!!options?.capture;
    for(const r of registrations)if(r.target.deref()===this&&r.callback.deref()===callback&&r.type===type&&r.capture===capture)r.removed=true;
    return remove.call(this,type,callback,options);
  };
  const gpu={};
  for(const kind of ['Buffer','Texture','Program','Shader','Framebuffer','Renderbuffer','VertexArray','Query']) {
    const active=new Map();gpu[kind]=active;
    const proto=WebGL2RenderingContext.prototype,create=proto['create'+kind],destroy=proto['delete'+kind];
    if(!create||!destroy)continue;
    proto['create'+kind]=function(...args){const result=create.apply(this,args);if(result)active.set(result,this);return result;};
    proto['delete'+kind]=function(value){active.delete(value);return destroy.call(this,value);};
  }
  document.addEventListener('webglcontextlost',event=>{for(const active of Object.values(gpu))for(const [resource,gl]of active)if(gl.canvas===event.target)active.delete(resource);},true);
  globalThis.__v0Audit=()=>({
    listeners:registrations.filter(r=>!r.removed&&r.target.deref()&&r.callback.deref()).map(r=>r.type),
    gpu:Object.fromEntries(Object.entries(gpu).map(([k,v])=>[k,v.size])),
  });
})();
