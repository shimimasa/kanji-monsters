import { element, button, companionPortrait } from '../ui/adventureUI.js';
import { installScenePolish } from './scenePolish.js';

// Presentation reads world state, never answers on the player's behalf.
export function createCompanionScene({ doc, root, info, gotomon, act }) {
  const stage = element(doc, 'div', 'gt-stage');
  const scene = element(doc, 'div', `gt-scene gt-${info.scene}`); scene.dataset.scene = info.scene;
  const actor = companionPortrait(doc, gotomon, 'gt-actor'); actor.dataset.gotomonId = gotomon?.id ?? '';
  const objects = element(doc, 'div', 'gt-world-objects'), metric = element(doc, 'strong', 'gt-scene-metric');
  const label = element(doc, 'span', 'gt-scene-label'), actions = element(doc, 'div', 'gt-world-actions');
  const particles = element(doc, 'div', 'gt-particles'); particles.setAttribute('aria-hidden', 'true');
  for (let i=0;i<7;i++) { const spark=element(doc,'i'); spark.style.setProperty('--i',i); spark.style.setProperty('--row',`${i%3*20}%`); particles.append(spark); }
  scene.append(objects, actor, particles, metric, label); stage.append(scene, actions);
  const board = root.querySelector('.mi-board, .kd-board');
  if (board) { board.append(actor); actor.classList.add('gt-board-actor'); scene.classList.add('gt-board-caption'); }
  const pieces = [];
  for (const symbol of ({race:['▴','▴','▴','▴','⚑'],treasure:['1','2','3','4'],bridge:['━','━','━','━','━'],lantern:['✧','✧','✧','✧','✧']}[info.scene] || [])) {
    const piece=element(doc,'span','gt-world-piece',symbol); objects.append(piece); pieces.push(piece);
  }
  const rival = info.scene === 'race' ? element(doc,'span','gt-rival','ベスト平均ペース') : null;
  if(rival)scene.append(rival);
  if(info.scene==='explore') { scene.append(actions); actions.classList.add('gt-map-actions'); }
  const boss = info.scene === 'shoot' ? element(doc,'div','gt-boss') : null;
  if(boss) { boss.textContent='大型機'; board.append(boss); }
  const nodes = new Map(); let state=null, revision=-1, attackMs=0;
  const polish=installScenePolish({doc,root,stage,scene,actor,board,info});
  return { root:stage, update(next,play,dt=0) {
    state=next; const world=play.world || {};
    stage.hidden=actor.hidden=!!state.result;
    scene.dataset.mode=state.paused?'paused':world.fever||world.boostMs>0?'fever':world.danger?'danger':world.progress>=.8?'climax':play.combo>=3?'combo':'normal';
    scene.dataset.reaction=actor.dataset.reaction=state.paused?'idle':play.reaction;
    if(revision!==play.revision) {
      revision=play.revision;
      for(const node of [actor,particles]) {node.style.animation='none';void node.offsetWidth;node.style.animation='';}
      if(play.reaction==='correct')attackMs=400;
    }
    metric.textContent=world.metric || info.goal;
    label.textContent=state.paused?'一時停止中':play.reaction==='boost'?`${gotomon?.name}の${info.skill}！`:world.caption || info.goal;
    if(board) {
      const lane=state.selectedEnemy?.lane??world.hitLane;
      if(lane!==undefined)actor.style.left=`${(lane+.5)*100/3}%`;
      attackMs=Math.max(0,attackMs-dt);actor.classList.toggle('gt-firing',attackMs>0||play.reaction==='boost');
      for(const enemy of board.querySelectorAll('[data-enemy-id]'))enemy.classList.toggle('gt-priority',enemy.dataset.enemyId===world.priority);
      if(boss) {boss.hidden=(world.progress??0)<.7;boss.style.setProperty('--hp',`${(world.bossHp??8)/8*100}%`);boss.textContent=world.bossHp===0?'大型機 撃退！':`大型機 HP ${world.bossHp}/8`;}
    } else actor.style.left=`${info.scene==='explore'?12+(world.route>=0?world.route:(world.path?.at(-1)??0))*18:8+Math.min(1,world.progress||0)*76}%`;
    if(rival) {rival.hidden=!world.bestTimeMs;rival.style.left=`${8+Math.min(1,(world.timeMs||0)/(world.bestTimeMs||1))*76}%`;rival.textContent=world.paceDeltaMs===null?'ベスト平均':`ベスト比 ${world.paceDeltaMs<=0?'−':'+'}${(Math.abs(world.paceDeltaMs)/1000).toFixed(1)}秒`;scene.style.setProperty('--stride',`${.65/(world.speed||1)}s`);}
    pieces.forEach((piece,i)=>{piece.classList.toggle('gt-collected',i<(world.towers??world.chests??Math.floor((world.progress||0)*5)));piece.classList.toggle('gt-built',info.scene==='bridge'&&play.reaction==='correct');});
    if(info.scene==='lantern')scene.style.setProperty('--light',String(Math.max(.05,(world.light||0)/100)));
    for(const action of world.actions || []) {
      let node=nodes.get(action.id);
      if(!node) {node=button(doc,'',()=>act?.(action.id),'gt-button');node.dataset.worldAction=action.id;if(info.scene==='explore')node.dataset.action='explore';actions.append(node);nodes.set(action.id,node);}
      node.textContent=action.label;node.disabled=state.paused||!!state.result||!['answering','playing'].includes(state.phase)||!action.enabled;
      node.setAttribute('aria-pressed',String(!!action.selected));node.dataset.visited=String(!!action.visited);
      if(action.hint)node.title=action.hint;
    }
    if(info.scene==='explore') {const area=root.querySelector('.ac-play');if(area){const locked=world.waiting&&state.phase==='answering';area.hidden=!!state.result||locked;area.inert=!!locked;}}
    if(info.scene==='bridge')for(const [i,piece] of [...root.querySelectorAll('[data-chunk-id]')].entries()) {piece.dataset.slot=String(i+1);piece.classList.toggle('gt-snapped',!!state.lastAnswer&&state.problem?.correctOrder?.[i]===piece.dataset.chunkId);}
    polish.update(state,play,dt);
  }};
}
