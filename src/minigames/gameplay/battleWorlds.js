export function createShootingWorld(effects) {
  let kills=0, bonus=0, bossHp=8, shots=0, danger=false, priority=null, aimed=null, hitLane=1,hitY=.35;
  return {
    context(state) {
      const enemies = state.enemies || [];
      priority = enemies.reduce((best,enemy)=>!best||enemy.y>best.y?enemy:best,null)?.enemyId;
      aimed=state.selectedEnemy?.enemyId; hitLane=state.selectedEnemy?.lane??hitLane;
      hitY=state.selectedEnemy?.y??hitY;
      danger=state.life<=1||enemies.some(enemy=>enemy.y>=.6);
    },
    answer(correct) {
      if(!correct)return;
      kills++; if(aimed && aimed===priority)bonus+=12;
      if(kills>=8&&bossHp>0){bossHp=Math.max(0,bossHp-(shots>0 ? Math.round(4*effects.potency) : 2)); if(bossHp===0)bonus+=60;}
      if(shots>0)shots--;
    },
    boost(){shots=2;},
    snapshot(){return {kind:'shoot',bonus,progress:kills/10,bossHp,shots,danger,priority,hitLane,hitY,
      metric:kills>=7?`大型機 HP ${bossHp}/8 · 強化弾 ${shots}`:`WAVE ${Math.min(3,1+Math.floor(kills/3))}/3 · 撃破 ${kills}/10`,
      caption:kills>=7?'ラスト3機で大型機を撃退！技を合わせて連射':'手前の敵を優先して撃退。選択中はゆっくり計算できる',
      summary:bossHp===0?'大型機を撃退！':`大型機 残りHP ${bossHp}`,goal:'技を最後の3機に合わせ、大型機を撃退しよう',actions:[]}},
  };
}

export function createDefenseWorld() {
  let correct=0, bonus=0, encouragement=0;
  return {
    answer(success){if(success){correct++;if(encouragement>0){bonus+=15;encouragement--;}}},
    boost(){encouragement=2;},
    snapshot(){return {kind:'defend',bonus,progress:correct/12,encouragement,
      metric:encouragement?`相棒エール：次の正解${encouragement}回を応援`:'相棒と旅路を守ろう',
      caption:'読みで攻撃。相棒技は得点だけを後押し',summary:`${correct}体を撃退`,goal:'迫る敵の順番を見て、連続撃退を目指そう',actions:[]}},
  };
}
