export function createExplorationWorld(effects, { variation = 0, course = null } = {}) {
  const places = ['林道','海辺','遺跡','高原','湖'];
  const links = [[1,2],[0,3,4],[0,3],[1,2,4],[1,3]];
  let route = -1, steps = 0, successes = 0, clues = 0, bonus = 0, rare = 0, survey = false, compass = 0, compassPending = false, compassFindings = 0;
  const visited = [], path = [];
  const findings=[];
  const icons=['❧','◈','▣','✦','◇'];
  const treasures=[['葉のしおり','こはく色の実','木の年輪'],['波の貝がら','青い小石','潮の結晶'],['古い紋章','石の地図','金色の文様'],['風の羽根','空色の石','星のかけら'],['水晶のしずく','月の小石','銀のさざなみ']];
  const featured=[4,3,2][variation%3];
  const hints=['手がかりを拾える。遺跡への準備に','手がかりを拾える。湖へ寄り道も','手がかり2つで特別な発見','2問突破で発見ボーナス','持っている手がかりが得点になる'];
  const available = () => visited.length === 0 ? [0,1] : [...new Set(visited.flatMap(id => links[id]))].filter(id => !visited.includes(id));
  return {
    act(action) {
      if (course?.id === 'explorer-compass' && action === 'use-compass' && route === -1 && compass > 0 && !compassPending) {
        compass--; compassPending = true; survey = true; return true;
      }
      const id = Number(action.replace('route-', ''));
      if (!action.startsWith('route-') || route !== -1 || !available().includes(id)) return false;
      route = id; steps = successes = 0; path.push(id); return true;
    },
    answer(correct) {
      if (route < 0) return;
      steps++; if (correct) successes++;
      if (steps < 2) return;
      let found = successes * 20;
      const isRare=route===2&&clues>=2&&successes===2;
      if (isRare) { found += 35; clues -= 2; rare++; }
      else if ([0,1].includes(route) && successes) clues++;
      else if (route === 3 && successes === 2) found += 25;
      else if (route === 4) found += clues * 10;
      if(route===featured&&visited.length<3&&successes)found+=25;
      if (compassPending) { compassFindings++; compassPending = false; }
      if (course?.id === 'explorer-compass' && successes === 2) compass = Math.min(2, compass + 1);
      findings.push({label:treasures[route][variation%3],icon:icons[route],kind:isRare?'rare':'normal',place:places[route],points:Math.round(found*(survey?1+effects.potency*.5:1))});
      bonus += Math.round(found * (survey ? 1 + effects.potency * .5 : 1)); survey = false;
      visited.push(route); route = -1;
    },
    boost() { clues++; survey = true; },
    snapshot() {
      const waiting = route < 0 && visited.length < 5;
      return { kind: 'explore', bonus, progress: visited.length / 5, waiting, route, path: [...path], clues, rare,findings:[...findings],variation,featured,compass,compassFindings,
        metric: `発見 ${visited.length}/5 · 手がかり ${clues}${course ? ` · 羅針盤 ${compass}` : ''}`,
        caption: waiting ? `今回のうわさ：${places[featured]}は3地点目まで発見+25pt` : `${places[route] ?? '探検完了'} · 調査 ${steps}/2 · ${hints[route]??''}`,
        hint:waiting?'林道・海辺で手がかり／遺跡で使う／湖では残して得点':hints[route]??'',
        summary: `${visited.length}地点を探索・レア発見${rare}回${course ? ` · 羅針盤の発見${compassFindings}回` : ''}`,
        goal: rare ? '次は違う順路で発見記録をこえよう' : '林道と海辺で手がかりを集めてから遺跡へ',
        actions: [...places.map((name,id) => ({id:`route-${id}`,label:`${visited.includes(id) ? '✓ ' : ''}${name}${id === featured ? ' ☆' : ''}`,hint:hints[id],
          enabled: waiting && available().includes(id), selected: id === route, visited: visited.includes(id)})),
          ...(course?.id === 'explorer-compass' ? [{id:'use-compass',label:`羅針盤を使う（${compass}）`,enabled:waiting&&compass>0&&!compassPending,hint:'次の発見を強める'}] : [])] };
    },
  };
}

export function createTreasureWorld(effects,{course=null}={}) {
  let answered = 0, roomCorrect = 0, rooms = 0, chests = 0, bonus = 0, tactic = 'safe', protectedKey = false, streak = 0, keys = 0, usedKeys = 0, keyUsedThisRoom = false, guardedChests = 0;
  const findings=[],steps=[],names=['入口の回廊','ふたつの通路','宝の間','最後の宝物庫'];
  return {
    act(action) {
      if (course?.id === 'treasure-key' && action === 'use-key' && keys > 0 && !protectedKey) {
        keys--; usedKeys++; keyUsedThisRoom = true; protectedKey = true; return true;
      }
      if (answered % 3 !== 0 || !['safe','rare'].includes(action)) return false; tactic = action; return true;
    },
    answer(correct) {
      streak = correct ? streak + 1 : 0;
      if (course?.id === 'treasure-key' && streak >= 2) { keys = Math.min(2, keys + 1); streak = 0; }
      answered++; steps.push({correct,room:rooms,route:tactic});if (correct) roomCorrect++;
      if (answered % 3 && answered !== 10) return;
      const target = answered === 10 ? 1 : 3;
      const complete = roomCorrect + (protectedKey ? 1 : 0) >= target;
      let points = tactic === 'rare' ? (complete ? 105 : roomCorrect * 25) : roomCorrect * 25 + (roomCorrect?15:0);
      if (protectedKey) points = Math.round(points * effects.potency);
      bonus += points; if (complete) { chests++; if (keyUsedThisRoom) guardedChests++; }
      findings.push({label:complete?(tactic==='rare'?'星の宝箱':'旅の宝箱'):'宝のかけら',icon:complete?'▣':'◇',kind:complete&&tactic==='rare'?'rare':'normal',points,place:names[rooms]});
      rooms++; roomCorrect = 0; protectedKey = false; keyUsedThisRoom = false;
    },
    boost() { protectedKey = true; },
    snapshot() { return {kind:'treasure',bonus,progress:answered/10,rooms,chests,tactic,protectedKey,keys,usedKeys,guardedChests,steps:[...steps],findings:[...findings],
      metric:`${names[Math.min(3,rooms)]} · 宝箱 ${chests}/4${course ? ` · 鍵 ${keys}` : ''}`,
      caption: answered === 9 ? '最後の宝物庫！扉を開けよう' : `${tactic === 'rare' ? 'レア：連続突破で大きな宝、失敗でも通常報酬' : '安全：突破の報酬＋持ち帰り15pt'}${protectedKey ? ' · 守りの鍵' : ''}`,
      summary:`宝箱 ${chests}/4個を発見${course ? ` · 鍵を使用${usedKeys}回` : ''}`,goal:'3連続に自信がついたら、レア部屋へ挑戦',
      actions:[{id:'safe',label:'安全な部屋',selected:tactic==='safe',enabled:answered%3===0},{id:'rare',label:'レア部屋 ★',selected:tactic==='rare',enabled:answered%3===0},
        ...(course?.id === 'treasure-key' ? [{id:'use-key',label:`ひみつの鍵を使う（${keys}）`,enabled:keys>0&&!protectedKey,hint:'部屋の宝箱を守る'}] : [])]}},
  };
}
