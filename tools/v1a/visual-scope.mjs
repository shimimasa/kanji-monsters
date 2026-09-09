// CDP-only fault injection into the loaded Babylon AnimationGroup prototype.
// This never reads or changes controller/Core objects.
export async function injectSampleFailure(c){
  await c.evaluate(`(async()=>{
    const url=performance.getEntriesByType('resource').find(x=>/\\/babylonGLBRenderer-[^/]+\\.js$/.test(x.name))?.name;
    if(!url)throw Error('Renderer module URL not found');
    const module=await import(url);
    const scenes=[...new Set(Object.values(module).flatMap(x=>[x?.LastCreatedScene,...(Array.isArray(x?.Instances)?x.Instances.flatMap(e=>e.scenes||[]):[])]))].filter(s=>s?.animationGroups?.length===4);
    if(scenes.length!==1)throw Error('Babylon display scene is not unique: '+scenes.length);
    const group=scenes[0].animationGroups.find(g=>g.name==='idle');
    if(!group)throw Error('idle group missing');
    const original=group.goToFrame;
    globalThis.__v1aUndoSampleFault=()=>{group.goToFrame=original;delete globalThis.__v1aUndoSampleFault;};
    group.goToFrame=function(){throw Error('V1a test sample failure');};
  })()`);
}
