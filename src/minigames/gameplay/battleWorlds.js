export function createShootingWorld(effects,{course=null}={}) {
  let kills=0, bonus=0, bossHp=8, shots=0, danger=false, priority=null, aimed=null, hitLane=1,hitY=.35, grains=0, golden=false, goldenHits=0;
  return {
    act(action) { if (course?.id !== 'corn-barrage' || action !== 'golden-burst' || grains < 3 || golden || bossHp === 0) return false;
      grains -= 3; golden = true; return true; },
    context(state) {
      const enemies = state.enemies || [];
      priority = enemies.reduce((best,enemy)=>!best||enemy.y>best.y?enemy:best,null)?.enemyId;
      aimed=state.selectedEnemy?.enemyId; hitLane=state.selectedEnemy?.lane??hitLane;
      hitY=state.selectedEnemy?.y??hitY;
      danger=state.life<=1||enemies.some(enemy=>enemy.y>=.6);
    },
    answer(correct) {
      if(!correct)return;
      kills++; if(aimed && aimed===priority){bonus+=12;if(course?.id==='corn-barrage')grains=Math.min(6,grains+1);}
      if(golden){bossHp=Math.max(0,bossHp-2);golden=false;goldenHits++;if(bossHp===0)bonus+=60;}
      if(kills>=8&&bossHp>0){bossHp=Math.max(0,bossHp-(shots>0 ? Math.round(4*effects.potency) : 2)); if(bossHp===0)bonus+=60;}
      if(shots>0)shots--;
    },
    boost(){shots=2;},
    snapshot(){return {kind:'shoot',bonus,progress:kills/10,bossHp,shots,danger,priority,hitLane,hitY,grains,golden,goldenHits,
      metric:kills>=7?`大型機 HP ${bossHp}/8 · 強化弾 ${shots}`:`WAVE ${Math.min(3,1+Math.floor(kills/3))}/3 · 撃破 ${kills}/10`,
      caption:golden?'黄金弾を準備！次の正解で大型機にも命中':kills>=7?'ラスト3機で大型機を撃退！技を合わせて連射':'手前の敵を優先して撃退。選択中はゆっくり計算できる',
      summary:`${bossHp===0?'大型機を撃退！':`大型機 残りHP ${bossHp}`}${course ? ` · 黄金弾 ${goldenHits}発` : ''}`,goal:'技を最後の3機に合わせ、大型機を撃退しよう',
      actions:course?.id==='corn-barrage'?[{id:'golden-burst',label:golden?'黄金弾を装填中':`黄金弾を装填（粒 ${grains}/3）`,enabled:grains>=3&&!golden&&bossHp>0}]:[]}},
  };
}

export function createDefenseWorld(effects,{course=null}={}) {
  let correct=0, bonus=0, encouragement=0, wards=0, streak=0, wardArmed=false, wardHits=0;
  return {
    act(action){if(course?.id!=='defense-ward'||action!=='use-ward'||wards<1||wardArmed)return false;
      wards--;wardArmed=true;return true;},
    answer(success){
      streak=success?streak+1:0;
      if(success){correct++;if(encouragement>0){bonus+=15;encouragement--;}
        if(wardArmed){bonus+=15;wardHits++;wardArmed=false;}
        if(course?.id==='defense-ward'&&streak>=2){wards=Math.min(2,wards+1);streak=0;}}
    },
    boost(){encouragement=2;},
    snapshot(){return {kind:'defend',bonus,progress:correct/12,encouragement,wards,wardArmed,wardHits,
      metric:`${encouragement?`相棒エール：次の正解${encouragement}回を応援`:'相棒と旅路を守ろう'}${course?` · 札 ${wards}`:''}`,
      caption:wardArmed?'守りの札を構えた！次の正解を強めよう':'読みで攻撃。相棒技は得点だけを後押し',
      summary:`${correct}体を撃退${course?` · 札を使って${wardHits}回正解`:''}`,goal:'迫る敵の順番を見て、連続撃退を目指そう',
      actions:course?.id==='defense-ward'?[{id:'use-ward',label:`守りの札を使う（${wards}）`,enabled:wards>0&&!wardArmed,hint:'次の正解で得点を追加'}]:[]}},
  };
}
