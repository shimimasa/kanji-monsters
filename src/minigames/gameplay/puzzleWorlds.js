export { createConstellationWorld } from './constellationWorld.js';
export function createLanternWorld(effects) {
  let light = 60, towers = 0, bonus = 0, answered = 0, feverMs = 0;
  return {
    act(action) {
      if (action !== 'light-tower' || light < 35 || towers >= 5) return false;
      light -= 30; towers++; bonus += 55; return true;
    },
    update(dt, state) { if (state.phase === 'answering') light = Math.max(5, light - dt * (feverMs > 0 ? .001 : .0035)); feverMs = Math.max(0, feverMs-dt); },
    answer(correct, payload, combo) { answered++; light = Math.max(5, Math.min(100, light + (correct ? 24 : -12))); if (correct && combo % 3 === 0) feverMs = 6000; },
    boost() { light = Math.min(100,light + 30*effects.potency); feverMs=6000*effects.potency; },
    snapshot() { return {kind:'lantern',bonus,progress:towers/5,light,towers,fever:feverMs>0,danger:light<25,
      metric:`灯台 ${towers}/5`,caption:light<25 ? '光が弱い！次の正解で回復できる' : '光を残す？灯台に分ける？5つの灯台を目指そう',
      summary:`灯台 ${towers}/5・残した光 ${Math.round(light)}`,goal:'光35以上で灯台へ分け、正解で補充しよう',
      actions:[{id:'light-tower',label:towers===5?'5つの灯台がつながった！':'光を分けて、灯台に灯す',enabled:light>=35&&towers<5}]}},
  };
}

export function createBridgeWorld(effects) {
  let bridges = 0, bonus = 0, rainbow = false, special = 0, answered = 0;
  return {
    answer(correct, payload, combo) {
      answered++;
      if (correct) {bridges++; const isSpecial=rainbow||combo%3===0; if(isSpecial)special++;
        bonus += isSpecial ? Math.round(45*effects.potency) : 12;}
      rainbow=false;
    },
    boost() {rainbow=true;},
    snapshot() {return {kind:'bridge',bonus,progress:answered/10,bridges,special,rainbow,
      metric:`橋 ${bridges}/10 · 虹の橋 ${special}`,caption:rainbow ? '虹の橋をかけよう！' : '板をつかんで並べ替え。文章がつながると相棒が渡る',
      summary:`橋 ${bridges}本・虹の橋 ${special}本`,goal:'3連続で虹の橋！板を動かす順番も工夫しよう',actions:[]}},
  };
}
