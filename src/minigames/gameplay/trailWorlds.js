export function createExplorationWorld(effects, { variation = 0 } = {}) {
  const places = ['林道','海辺','遺跡','高原','湖'];
  const links = [[1,2],[0,3,4],[0,3],[1,2,4],[1,3]];
  let route = -1, steps = 0, successes = 0, clues = 0, bonus = 0, rare = 0, survey = false;
  const visited = [], path = [];
  const findings=[];
  const icons=['❧','◈','▣','✦','◇'];
  const treasures=[['葉のしおり','こはく色の実','木の年輪'],['波の貝がら','青い小石','潮の結晶'],['古い紋章','石の地図','金色の文様'],['風の羽根','空色の石','星のかけら'],['水晶のしずく','月の小石','銀のさざなみ']];
  const featured=[4,3,2][variation%3];
  const hints=['手がかりを拾える。遺跡への準備に','手がかりを拾える。湖へ寄り道も','手がかり2つで特別な発見','2問突破で発見ボーナス','持っている手がかりが得点になる'];
  const available = () => visited.length === 0 ? [0,1] : [...new Set(visited.flatMap(id => links[id]))].filter(id => !visited.includes(id));
  return {
    act(action) {
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
      findings.push({label:treasures[route][variation%3],icon:icons[route],kind:isRare?'rare':'normal',place:places[route],points:Math.round(found*(survey?1+effects.potency*.5:1))});
      bonus += Math.round(found * (survey ? 1 + effects.potency * .5 : 1)); survey = false;
      visited.push(route); route = -1;
    },
    boost() { clues++; survey = true; },
    snapshot() {
      const waiting = route < 0 && visited.length < 5;
      return { kind: 'explore', bonus, progress: visited.length / 5, waiting, route, path: [...path], clues, rare,findings:[...findings],variation,featured,
        metric: `発見 ${visited.length}/5 · 手がかり ${clues}`,
        caption: waiting ? `今回のうわさ：${places[featured]}は3地点目まで発見+25pt` : `${places[route] ?? '探検完了'} · 調査 ${steps}/2 · ${hints[route]??''}`,
        hint:waiting?'林道・海辺で手がかり／遺跡で使う／湖では残して得点':hints[route]??'',
        summary: `${visited.length}地点を探索・レア発見${rare}回`,
        goal: rare ? '次は違う順路で発見記録をこえよう' : '林道と海辺で手がかりを集めてから遺跡へ',
        actions: places.map((name,id) => ({id:`route-${id}`,label:`${visited.includes(id) ? '✓ ' : ''}${name}${id === featured ? ' ☆' : ''}`,hint:hints[id],
          enabled: waiting && available().includes(id), selected: id === route, visited: visited.includes(id)})) };
    },
  };
}

export function createRaceWorld(effects,{bestTimeMs=null,course=null}={}) {
  const best=Number.isFinite(bestTimeMs)&&bestTimeMs>0?bestTimeMs:null;
  let leg = 0, speed = 1, energy = 0, tactic = 'charge', boostMs = 0, penaltyMs = 0, cutMs = 0, elapsed = 0, bonus = 0, final = false, shortcuts = 0;
  const rough = () => [2,5,8].includes(leg);
  return {
    act(action) { if (!['charge','push',...(course?.id === 'potato-shortcut' ? ['roll'] : [])].includes(action)) return false; tactic = action; return true; },
    update(dt) { elapsed += dt; boostMs = Math.max(0, boostMs - dt); },
    answer(correct, payload, combo) {
      if (correct) {
        speed = Math.min(5, speed + .4 + combo * .08);
        cutMs += Math.round((speed - 1) * 120);
        if (tactic === 'charge') energy = Math.min(3, energy + 1);
        const jumped = rough() && energy >= 2 && tactic === 'push';
        const rolled = course?.id === 'potato-shortcut' && rough() && energy >= 1 && tactic === 'roll';
        if (jumped) energy -= 2;
        if (rolled) { energy--; shortcuts++; cutMs += 900; }
        if (rough() && !jumped && !rolled && !boostMs) penaltyMs += 1800;
        else if (tactic === 'push' || boostMs) cutMs += boostMs ? 1500 * effects.potency : 600;
        bonus += Math.round((boostMs ? 14 : 4) + (jumped ? 22 : 0));
      } else { speed = Math.max(1, speed - .6); penaltyMs += 2500; }
      leg++;
    },
    boost() { boostMs = 6000 * effects.potency; speed = Math.min(5, speed + 1); },
    complete() { if (final) return; final = true; bonus += Math.max(0, Math.round(140 * (1 - (elapsed + penaltyMs - cutMs) / 120000))); },
    snapshot() {
      const timeMs = Math.max(elapsed * .8, elapsed + penaltyMs - cutMs);
      return { kind:'race', bonus, progress:leg / 10, speed, energy, shortcuts, timeMs, boostMs, danger:rough(),bestTimeMs:best,paceDeltaMs:best&&leg?timeMs-best*leg/10:null,
        metric:`${(timeMs/1000).toFixed(1)}秒 · 加速 ${speed.toFixed(1)} · 力 ${energy}/3`,
        caption: boostMs ? `ダッシュ！あと${(boostMs/1000).toFixed(1)}秒` : `${leg >= 8 ? 'ラストスパート！' : rough() ? '障害区間：力2でジャンプ突破' : '直線：ためて、次の障害に備えよう'}`,
        summary:`コースタイム ${(timeMs/1000).toFixed(1)}秒${course ? ` · 近道 ${shortcuts}回` : ''}${best?` · ベスト比 ${timeMs<best?'−':'+'}${(Math.abs(timeMs-best)/1000).toFixed(1)}秒`:''}`, goal:best?'ベストの平均ペースを追いこそう！':'8問以上正解で、自分のタイムを残そう',
        actions:[{id:'charge',label:'力をためる',selected:tactic==='charge',enabled:true},{id:'push',label:rough() ? '攻める／ジャンプ' : '攻める／加速',selected:tactic==='push',enabled:true},
          ...(course?.id === 'potato-shortcut' ? [{id:'roll',label:'ころころ近道（力1）',selected:tactic==='roll',enabled:true,hint:'障害区間で力1を使い、正解すると近道へ'}] : [])] };
    },
  };
}

export function createTreasureWorld(effects) {
  let answered = 0, roomCorrect = 0, rooms = 0, chests = 0, bonus = 0, tactic = 'safe', protectedKey = false;
  const findings=[],steps=[],names=['入口の回廊','ふたつの通路','宝の間','最後の宝物庫'];
  return {
    act(action) { if (answered % 3 !== 0 || !['safe','rare'].includes(action)) return false; tactic = action; return true; },
    answer(correct) {
      answered++; steps.push({correct,room:rooms,route:tactic});if (correct) roomCorrect++;
      if (answered % 3 && answered !== 10) return;
      const target = answered === 10 ? 1 : 3;
      const complete = roomCorrect + (protectedKey ? 1 : 0) >= target;
      let points = tactic === 'rare' ? (complete ? 105 : roomCorrect * 25) : roomCorrect * 25 + (roomCorrect?15:0);
      if (protectedKey) points = Math.round(points * effects.potency);
      bonus += points; if (complete) chests++;
      findings.push({label:complete?(tactic==='rare'?'星の宝箱':'旅の宝箱'):'宝のかけら',icon:complete?'▣':'◇',kind:complete&&tactic==='rare'?'rare':'normal',points,place:names[rooms]});
      rooms++; roomCorrect = 0; protectedKey = false;
    },
    boost() { protectedKey = true; },
    snapshot() { return {kind:'treasure',bonus,progress:answered/10,rooms,chests,tactic,protectedKey,steps:[...steps],findings:[...findings],
      metric:`${names[Math.min(3,rooms)]} · 宝箱 ${chests}/4`,
      caption: answered === 9 ? '最後の宝物庫！扉を開けよう' : `${tactic === 'rare' ? 'レア：連続突破で大きな宝、失敗でも通常報酬' : '安全：突破の報酬＋持ち帰り15pt'}${protectedKey ? ' · 守りの鍵' : ''}`,
      summary:`宝箱 ${chests}/4個を発見`,goal:'3連続に自信がついたら、レア部屋へ挑戦',
      actions:[{id:'safe',label:'安全な部屋',selected:tactic==='safe',enabled:answered%3===0},{id:'rare',label:'レア部屋 ★',selected:tactic==='rare',enabled:answered%3===0}]}},
  };
}
