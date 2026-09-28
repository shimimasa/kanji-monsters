import { element } from '../ui/adventureUI.js';

export function createFindings(doc, count) {
  const root=element(doc,'div','gt-findings');root.setAttribute('aria-label','今回見つけたもの');
  const slots=Array.from({length:count},()=>{const slot=element(doc,'span','gt-finding'),icon=element(doc,'b','','◇'),name=element(doc,'small','','まだ見ぬ宝');slot.append(icon,name);root.append(slot);return{slot,icon,name};});
  let key='';
  return {root,update(items=[]){const next=JSON.stringify(items);if(key===next)return;key=next;
    slots.forEach(({slot,icon,name},i)=>{const item=items[i];slot.dataset.found=String(!!item);slot.dataset.kind=item?.kind||'';icon.textContent=item?.icon||'◇';name.textContent=item?.label||'まだ見ぬ宝';slot.title=item?`${item.place||''} ${item.points??''}pt`:'';});
  }};
}

// Small, clock-driven presentation additions. No answer logic or independent timer.
export function installScenePolish({doc,root,stage,scene,actor,board,info}) {
  const pop=element(doc,'span','gt-score-pop');pop.setAttribute('aria-hidden','true');(board||scene).append(pop);
  const event=element(doc,'div','gt-world-event');event.setAttribute('aria-hidden','true');(board||scene).append(event);
  const landmark=!board?element(doc,'div','gt-landmark'):null;
  if(landmark){landmark.setAttribute('aria-hidden','true');scene.prepend(landmark);}
  const impact=board?element(doc,'span','gt-impact'):null;if(impact){impact.setAttribute('aria-hidden','true');board.append(impact);}
  const collection=['explore','treasure'].includes(info.scene)?createFindings(doc,info.scene==='explore'?5:4):null;
  const hint=info.scene==='explore'?element(doc,'p','gt-route-hint'):null;
  if(hint)stage.append(hint);if(collection)stage.append(collection.root);
  const dungeon=info.scene==='treasure'?element(doc,'div','gt-dungeon-path'):null;
  const rooms=[];
  if(dungeon){for(let i=0;i<10;i++){const room=element(doc,'span','',String(i+1));dungeon.append(room);rooms.push(room);}scene.append(dungeon);}
  const orb=info.scene==='lantern'?element(doc,'div','gt-light-orb'):null;
  const pips=[];
  if(orb){orb.setAttribute('aria-label','外周が残り時間、明るさが光、3つの点で相棒技');for(let i=0;i<3;i++){const pip=element(doc,'i');orb.append(pip);pips.push(pip);}scene.append(orb);}
  const sky=info.scene==='craft'?doc.createElementNS('http://www.w3.org/2000/svg','svg'):null;
  const routeNodes=[],routeLines=[];
  const shapes=[[[30,75],[20,52],[23,29],[40,14],[60,26],[67,49]],[[118,22],[145,40],[125,64],[150,74],[178,54],[173,22]],[[228,65],[218,25],[242,43],[250,12],[267,44],[284,25]]];
  if(sky){sky.classList.add('gt-route-sky');sky.setAttribute('viewBox','0 0 300 90');sky.setAttribute('role','img');scene.append(sky);
    for(let route=0;route<3;route++){
      const nodes=[],lines=[];
      for(let i=0;i<6;i++){
        const [x,y]=shapes[route][i];
        if(i){const line=doc.createElementNS(sky.namespaceURI,'line');line.setAttribute('x1',nodes[i-1].getAttribute('cx'));line.setAttribute('y1',nodes[i-1].getAttribute('cy'));line.setAttribute('x2',x);line.setAttribute('y2',y);sky.append(line);lines.push(line);}
        const node=doc.createElementNS(sky.namespaceURI,'circle');node.setAttribute('cx',x);node.setAttribute('cy',y);node.setAttribute('r','4.5');sky.append(node);nodes.push(node);
      }routeNodes.push(nodes);routeLines.push(lines);
    }
  }
  let elapsed=0,correct=0,answered=0,boosts=0,score=0,finish=0,bossAlive=true,problem=null;
  const animate=node=>{node.style.animation='none';void node.offsetWidth;node.style.animation='';};
  return {update(state,play,dt=0){
    elapsed+=dt;const world=play.world||{};
    stage.dataset.tier=play.growth.tier;stage.dataset.combo=String(play.combo>=3);stage.dataset.entering=String(elapsed<600);
    actor.dataset.tier=play.growth.tier;actor.dataset.combo=String(play.combo>=3);
    const answerChanged=play.answered!==answered,boostChanged=play.boosts!==boosts;
    if(answerChanged||boostChanged){
      const hit=play.correct>correct;pop.textContent=hit||play.score>score?`+${play.score-score}${hit&&play.combo>=3?' CHAIN!':''}`:'つぎのチャンスへ';
      pop.style.left=actor.style.left||'50%';animate(pop);
      if(state.mode!=='review'){
        const success={race:'ダッシュ！',shoot:'命中！',treasure:'扉が開いた！',bridge:'橋がつながった！',lantern:'光が届いた！',craft:'星が輝いた！',explore:'発見！',defend:'防衛成功！'};
        event.textContent=boostChanged&&!answerChanged?'相棒の技、発動！':hit?(success[info.scene]||'成功！'):'もう一度、挑戦！';
        event.dataset.tone=boostChanged&&!answerChanged?'skill':hit?'success':'retry';
        animate(event);
      }
      if(impact&&hit){impact.style.left=`${((world.hitLane??state.lastResolution?.lane??1)+.5)*100/3}%`;impact.style.top=`${Math.max(15,Math.min(75,(world.hitY??.35)*100))}%`;impact.dataset.chain=String(play.combo>=3);animate(impact);}
      if(info.scene==='bridge'&&hit){scene.dataset.crossing='true';animate(actor);}
    }
    if(info.scene==='bridge'&&problem!==state.problem?.problemId){scene.dataset.crossing='false';problem=state.problem?.problemId;}
    if(info.scene==='bridge'){actor.style.left='9%';scene.classList.toggle('gt-whole-bridge',!!state.lastAnswer?.correct);}
    scene.style.setProperty('--world-gap',`${(1-Math.max(0,Math.min(1,world.progress||0)))*30}%`);
    if(world.bossHp===0&&bossAlive){bossAlive=false;scene.dataset.bossDefeated='true';}
    if(hint)hint.textContent=world.hint||'';
    collection?.update(world.findings);
    if(dungeon){rooms.forEach((room,i)=>{room.dataset.passed=String(i<(world.steps?.length||0));room.dataset.correct=String(!!world.steps?.[i]?.correct);room.dataset.current=String(i===world.steps?.length);});}
    if(orb && state.mode !== 'review'){
      const deadline=state.phase==='answering'?Math.max(0,Math.min(1,state.remainingMs/state.deadlineMs)):1;
      orb.style.setProperty('--deadline',`${deadline*360}deg`);orb.style.setProperty('--glow',String(.3+(world.light||0)/140));
      orb.dataset.danger=String(deadline<.3||world.danger);orb.dataset.ready=String(play.gauge>=3);orb.setAttribute('aria-label',`残り${Math.ceil((state.remainingMs||0)/1000)}秒・${world.danger?'光が弱い':'光は安定'}・${play.gauge>=3?'技が使える':'正解で技がたまる'}`);
      pips.forEach((pip,i)=>pip.classList.toggle('lit',play.gauge>=i+1));actor.style.left='30%';
    }
    if(sky){
      sky.setAttribute('aria-label',`左${(world.routes?.[0]||0).toFixed(1)}、中央${(world.routes?.[1]||0).toFixed(1)}、右${(world.routes?.[2]||0).toFixed(1)}、各6つで完成`);
      routeNodes.forEach((nodes,r)=>{const value=world.routes?.[r]||0;nodes.forEach((node,i)=>{node.style.setProperty('--filled',String(Math.max(.12,Math.min(1,value-i))));node.classList.toggle('chosen',world.route===r);});routeLines[r].forEach((line,i)=>line.classList.toggle('lit',value>=i+2));});
      scene.dataset.skyComplete=String(world.completed===3);scene.dataset.skyClimax=String(!!world.climax);
      if(world.finishRevision!==finish){finish=world.finishRevision;animate(sky);}
    }
    correct=play.correct;answered=play.answered;boosts=play.boosts;score=play.score;
  }};
}
